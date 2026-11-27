import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { ALL_SUBTYPES, CRA_SECTORS, type EventTypeId } from "@/lib/cra-domain";
import { computeReliabilityScore } from "@/lib/reliability";
import { createDefaultAlertDispatcher } from "@/core/alerts/dispatcher";
import {
  getZernioApiKey,
  replyZernioConversation,
  sendZernioTyping,
  verifyZernioSignature,
} from "@/lib/zernio";
import { fetchNasaFirmsData } from "@/app/api/nasa-fires/route";

// Deduplicación en memoria por X-Zernio-Event-Id (TTL 15 min)
const PROCESSED_EVENTS = new Map<string, number>();

function isDuplicateEvent(eventId: string | null): boolean {
  if (!eventId) return false;
  const now = Date.now();
  for (const [k, exp] of PROCESSED_EVENTS.entries()) {
    if (exp < now) PROCESSED_EVENTS.delete(k);
  }
  if (PROCESSED_EVENTS.has(eventId)) return true;
  PROCESSED_EVENTS.set(eventId, now + 15 * 60 * 1000);
  return false;
}

interface ZernioWebhookMetadata {
  standby?: boolean;
  latitude?: number;
  longitude?: number;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  interactiveType?: string;
  interactiveId?: string;
  quickReplyPayload?: string;
  postbackPayload?: string;
}

interface ZernioWebhookPayload {
  id?: string;
  event?: string;
  test?: boolean;
  account?: { accountId?: string; id?: string; platform?: string };
  metadata?: ZernioWebhookMetadata | null;
  message?: {
    id?: string;
    conversationId?: string;
    platform?: string;
    direction?: "incoming" | "outgoing";
    text?: string | null;
    attachments?: Array<{
      type?: string;
      url?: string;
      mimeType?: string;
      payload?: {
        mimeType?: string;
        latitude?: number;
        longitude?: number;
        coordinates?: { lat?: number; long?: number; lng?: number };
        voice?: boolean;
      };
    }>;
    sender?: {
      id?: string;
      name?: string;
      username?: string;
    };
    metadata?: ZernioWebhookMetadata | null;
  };
}

interface WaSessionRow {
  sender_hash: string;
  platform: string;
  step: "idle" | "awaiting_location" | "awaiting_photo" | "awaiting_note";
  lat: number | null;
  lon: number | null;
  sector_id: number | null;
  sector_name: string | null;
  is_simulated_gps: boolean;
  photo_url: string | null;
  photo_hash: string | null;
  ai_photo_valid: boolean | null;
  ai_classification: Record<string, unknown> | null;
  notes: string | null;
  voice_transcript: string | null;
  last_report_id: string | null;
  last_tracking_code: string | null;
  last_report_at: string | null;
  expires_at: string;
}

function inferSectorAndCoords(text: string, metaLat?: number | null, metaLon?: number | null) {
  // 1. Coordenadas reales enviadas por pin GPS o pegadas en texto
  if (
    typeof metaLat === "number" &&
    typeof metaLon === "number" &&
    metaLat >= 10.2 &&
    metaLat <= 11.4 &&
    metaLon >= -75.6 &&
    metaLon <= -74.5
  ) {
    const nearest = CRA_SECTORS.reduce((best, s) => {
      const d = Math.hypot(s.centroidLat - metaLat, s.centroidLon - metaLon);
      const bd = Math.hypot(best.centroidLat - metaLat, best.centroidLon - metaLon);
      return d < bd ? s : best;
    }, CRA_SECTORS[0]);
    return { lat: metaLat, lon: metaLon, sector: nearest, isSimulatedGps: false };
  }

  const coordMatch = text.match(/(10\.\d{3,6}|11\.\d{3,6})\s*[,\s]\s*(-7[45]\.\d{3,6})/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    const nearest = CRA_SECTORS.reduce((best, s) => {
      const d = Math.hypot(s.centroidLat - lat, s.centroidLon - lon);
      const bd = Math.hypot(best.centroidLat - lat, best.centroidLon - lon);
      return d < bd ? s : best;
    }, CRA_SECTORS[0]);
    return { lat, lon, sector: nearest, isSimulatedGps: false };
  }

  // 2. Mención explícita de sector/municipio (marcada honestamente como aproximada)
  const low = text.toLowerCase();
  if (/mallorqu|barranquilla|bocas|las flores|la playa/.test(low)) {
    return { lat: 11.0442, lon: -74.8592, sector: CRA_SECTORS[0], isSimulatedGps: true };
  }
  if (/velero|balboa|salgar|puerto colombia|sabanilla/.test(low)) {
    return { lat: 10.9554, lon: -75.0412, sector: CRA_SECTORS[1], isSimulatedGps: true };
  }
  if (/totumo|pioj|astillero|galerazamba|luruaco/.test(low)) {
    return { lat: 10.7512, lon: -75.2384, sector: CRA_SECTORS[3], isSimulatedGps: true };
  }
  if (/juan de acosta|tubar|santa ver[oó]nica|boca tocino/.test(low)) {
    return { lat: 10.8719, lon: -75.0972, sector: CRA_SECTORS[2], isSimulatedGps: true };
  }
  return null;
}

function inferEventFromText(text: string): {
  tipoEvento: EventTypeId;
  subtipoId: string;
  priority: "alta" | "media" | "baja";
} {
  const low = text.toLowerCase();
  if (/quema|incendio|fuego|humo|llamas/.test(low)) {
    return { tipoEvento: "tala_relleno", subtipoId: "quema_incendio", priority: "alta" };
  }
  if (/tala|cortando|cortad|motosierra|tumbaron|troncos? ca[ií]d|madera/.test(low)) {
    return { tipoEvento: "tala_relleno", subtipoId: "tala_poda", priority: "alta" };
  }
  if (/relleno|escombro|maquinaria|excavadora|cerca|obra|volqueta/.test(low)) {
    return { tipoEvento: "tala_relleno", subtipoId: "relleno_obra", priority: "alta" };
  }
  if (/aceite|combustible|derrame|petr/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "derrame_combustible", priority: "alta" };
  }
  if (/vertimiento|espuma|aguas negras|turbia|mal olor|alcantarilla/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "vertimiento_agua", priority: "media" };
  }
  if (/basura|pl[aá]stico|residuo|botella|desecho/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "residuos_solidos", priority: "media" };
  }
  if (/seco|amarill|sequ[ií]a|ca[ñn]o|taponado|erosi|muerto/.test(low)) {
    return { tipoEvento: "cambio_hidrico", subtipoId: "dosel_seco", priority: "alta" };
  }
  if (/pez|peces|ave|garza|cangrejo|fauna|trampa|red|pesca/.test(low)) {
    return { tipoEvento: "dano_fauna_especies", subtipoId: "fauna_amenaza", priority: "media" };
  }
  return { tipoEvento: "otro", subtipoId: "verificacion_828ha", priority: "baja" };
}

function looksLikeReportContent(text: string): boolean {
  const low = text.toLowerCase();
  return /quema|incendio|fuego|humo|tala|cort|tronco|mangle|manglar|relleno|escombro|basura|pl[aá]stico|aceite|derrame|vertimiento|agua|ca[ñn]o|seco|garza|cangrejo|pez|fauna|mallorqu|velero|juan de acosta|tubar|totumo|pioj|ci[eé]naga|playa|erosi|obra|pesca/.test(
    low
  );
}

async function downloadAttachmentBuffer(url: string, platform: string) {
  const apiKey = getZernioApiKey();
  const fullUrl = url.startsWith("/") ? `https://zernio.com${url}` : url;
  const needsAuth = platform === "whatsapp" || fullUrl.includes("zernio.com/api/");
  const res = await fetch(fullUrl, {
    headers: needsAuth && apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(14000),
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType };
}

async function transcribeWhatsAppAudio(params: {
  buf: Buffer;
  mimeType: string;
  siteUrl: string;
  sectorHint?: string | null;
}): Promise<{ transcript: string | null; empty: boolean }> {
  try {
    const res = await fetch(`${params.siteUrl}/api/ai/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: params.buf.toString("base64"),
        mimeType: params.mimeType,
        sectorHint: params.sectorHint || undefined,
      }),
      signal: AbortSignal.timeout(22000),
    });
    if (!res.ok) return { transcript: null, empty: false };
    const json = (await res.json()) as { transcript?: string; empty?: boolean };
    const text = (json.transcript || "").trim();
    if (!text || json.empty) return { transcript: null, empty: true };
    return { transcript: text, empty: false };
  } catch {
    return { transcript: null, empty: false };
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-zernio-signature");
  const eventId = request.headers.get("x-zernio-event-id");

  if (!verifyZernioSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Firma X-Zernio-Signature inválida" }, { status: 401 });
  }

  let payload: ZernioWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ZernioWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const dedupeKey = eventId || payload.id || null;
  if (isDuplicateEvent(dedupeKey)) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  // Test ping oficial de Zernio (POST /v1/webhooks/test)
  if (payload.test || payload.event === "webhook.test") {
    return NextResponse.json({
      ok: true,
      service: "manglar-vivo-atlantico-zernio-webhook",
      receivedEvent: payload.event || "webhook.test",
    });
  }

  if (payload.event !== "message.received" || !payload.message) {
    return NextResponse.json({ ok: true, ignored: true, event: payload.event });
  }

  const msg = payload.message;
  const meta: ZernioWebhookMetadata = {
    ...(msg.metadata || {}),
    ...(payload.metadata || {}),
  };
  if (msg.direction === "outgoing" || meta.standby) {
    return NextResponse.json({ ok: true, skipped: "outgoing_or_standby" });
  }

  const platform = (msg.platform || payload.account?.platform || "whatsapp").toLowerCase();
  const accountId = payload.account?.accountId || payload.account?.id || "";
  const conversationId = msg.conversationId || "";
  const rawText = (msg.text || "").trim();
  const interactiveId = (
    meta.interactiveId ||
    meta.quickReplyPayload ||
    meta.postbackPayload ||
    ""
  )
    .trim()
    .toLowerCase();
  const lowText = rawText.toLowerCase();
  // Quita emojis, slash "/" o caracteres corruptos al inicio (ej. " Reportar manglar", "/reportar")
  const cleanText = lowText.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://manglar.arpadura.com").replace(/\/$/, "");
  const supabase = createServerSupabase();

  // Privacidad Ley 1581: solo guardamos hash anónimo del remitente, nunca su número de teléfono
  const anonSenderHash = msg.sender?.id
    ? crypto.createHash("sha256").update(`zernio:${platform}:${msg.sender.id}`).digest("hex").slice(0, 24)
    : "anon";

  const canReply = Boolean(conversationId && accountId);
  if (canReply) {
    void sendZernioTyping(conversationId, accountId);
  }

  const MAIN_BUTTONS = [
    { type: "postback" as const, title: "📸 Reportar manglar", payload: "btn_reportar" },
    { type: "postback" as const, title: "🌿 Explorar 4 puntos", payload: "btn_explorar" },
    { type: "postback" as const, title: "🔥 Fuego NASA hoy", payload: "btn_nasa" },
  ];

  // Cargar sesión persistente desde Supabase (nunca se pierde entre lambdas de Vercel)
  const loadSession = async (): Promise<WaSessionRow | null> => {
    const { data } = await supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("sender_hash", anonSenderHash)
      .maybeSingle();
    if (!data) return null;
    const row = data as WaSessionRow;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ...row, step: "idle", lat: null, lon: null, sector_id: null, sector_name: null, is_simulated_gps: true, photo_url: null, photo_hash: null, ai_photo_valid: null, ai_classification: null, notes: null, voice_transcript: null };
    }
    return row;
  };

  const upsertSession = async (patch: Partial<WaSessionRow>) => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from("whatsapp_sessions").upsert(
      {
        sender_hash: anonSenderHash,
        platform,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: "sender_hash" }
    );
  };

  const resetDraftFields = async (extra?: Partial<WaSessionRow>) => {
    await upsertSession({
      step: "idle",
      lat: null,
      lon: null,
      sector_id: null,
      sector_name: null,
      is_simulated_gps: true,
      photo_url: null,
      photo_hash: null,
      ai_photo_valid: null,
      ai_classification: null,
      notes: null,
      voice_transcript: null,
      ...extra,
    });
  };

  const sendLocationPrompt = async (guideMsg: string) => {
    if (!canReply) return;
    if (platform === "whatsapp") {
      const res = await replyZernioConversation({
        conversationId,
        accountId,
        interactive: {
          type: "location_request_message",
          body: { text: guideMsg },
          action: { name: "send_location" },
        },
      }).catch(() => null);
      if (!res?.ok) {
        await replyZernioConversation({ conversationId, accountId, message: guideMsg }).catch(() => {});
      }
    } else {
      await replyZernioConversation({ conversationId, accountId, message: guideMsg }).catch(() => {});
    }
  };

  const sendWelcomeMenu = async (prefix?: string) => {
    const welcomeMsg =
      (prefix ? `${prefix}\n\n` : "") +
      `🌿 *¡Hola! Soy el asistente de Manglar Vivo Atlántico (CRA)*\n\n` +
      `Cuidar los manglares aquí es súper fácil:\n` +
      `• Toca *📸 Reportar manglar* y te guío paso a paso (ubicación, foto y nota de voz).\n` +
      `• O toca un botón abajo 👇`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        attachmentUrl: `${siteUrl}/images/og-backdrop.jpg`,
        attachmentType: "image",
        message: welcomeMsg,
        buttons: MAIN_BUTTONS,
      }).catch(() =>
        replyZernioConversation({ conversationId, accountId, message: welcomeMsg }).catch(() => {})
      );
    }
    return welcomeMsg;
  };

  // Función central para publicar el borrador completo en el CRM (1 solo reporte unificado: GPS + Foto + Audio/Texto)
  const finalizeReport = async (draft: {
    lat: number | null;
    lon: number | null;
    isSimulatedGps: boolean;
    photoUrl: string | null;
    photoHash: string | null;
    aiPhotoValid: boolean | null;
    aiClassification: Record<string, unknown> | null;
    notes: string | null;
    voiceTranscript: string | null;
  }) => {
    const combinedText = [draft.notes, draft.voiceTranscript ? `Nota de voz: ${draft.voiceTranscript}` : null]
      .filter(Boolean)
      .join(" · ")
      .trim();

    const geoResolved =
      inferSectorAndCoords(combinedText, draft.lat, draft.lon) || {
        lat: 10.8719,
        lon: -75.0972,
        sector: CRA_SECTORS[2],
        isSimulatedGps: true,
      };
    const isSimulatedGps = draft.lat !== null && draft.lon !== null ? draft.isSimulatedGps : geoResolved.isSimulatedGps;

    const inferred = inferEventFromText(combinedText);
    const suggestedSubId =
      draft.aiPhotoValid && typeof draft.aiClassification?.subtipo_sugerido === "string"
        ? draft.aiClassification.subtipo_sugerido
        : inferred.subtipoId;
    const subMeta = ALL_SUBTYPES.find((s) => s.id === suggestedSubId);

    const trackingCode = `MGL-ZN-${Math.floor(1000 + Math.random() * 9000)}`;
    const reliability = computeReliabilityScore({
      hasPhoto: Boolean(draft.photoUrl),
      photoCount: draft.photoUrl ? 1 : 0,
      aiPhotoValid: draft.aiPhotoValid,
      precisionGpsM: isSimulatedGps ? null : 15,
      inCoastalZone: true,
      isSimulatedGps,
      timestampCaptura: new Date().toISOString(),
      nearGroundTruthM: null,
      estadoValidacion: "nuevo",
    });

    const descText =
      combinedText ||
      (typeof draft.aiClassification?.que_muestra_la_foto === "string"
        ? draft.aiClassification.que_muestra_la_foto
        : "Evidencia ciudadana enviada por WhatsApp.");

    const { data: inserted, error: dbErr } = await supabase
      .from("citizen_reports")
      .insert({
        client_uuid: crypto.randomUUID(),
        tracking_code: trackingCode,
        timestamp_captura: new Date().toISOString(),
        latitud: geoResolved.lat,
        longitud: geoResolved.lon,
        precision_gps_m: isSimulatedGps ? null : 15,
        is_simulated_gps: isSimulatedGps,
        zona_manglar: geoResolved.sector.nombre,
        municipio: geoResolved.sector.municipioPrincipal,
        sector_id: geoResolved.sector.id,
        accion_plan: "Preservación",
        en_zona_por_revisar: true,
        tipo_evento: subMeta?.eventType || inferred.tipoEvento,
        descripcion_ciudadana: `[Canal ${platform.toUpperCase()} · ${subMeta?.label || inferred.subtipoId}] ${descText}`,
        evidencia_foto_url: draft.photoUrl,
        evidencia_exif: {
          source: "zernio_omnichannel",
          platform,
          sender_hash_ley1581: anonSenderHash,
          subtipo_evento: subMeta?.id || inferred.subtipoId,
          subtipo_label: subMeta?.label || inferred.subtipoId,
          factor_dominio: subMeta?.domainId || "fauna_verificacion",
          photo_sha256: draft.photoHash,
          photo_count: draft.photoUrl ? 1 : 0,
          voice_transcript: draft.voiceTranscript || null,
        },
        perfil_reportante: "habitante_local",
        qr_station_id: `zernio:${platform}`,
        estado_sincronizacion: "sincronizado",
        estado_validacion: "nuevo",
        attention_status: "pendiente",
        nivel_prioridad: subMeta?.defaultPriority || inferred.priority,
        puntaje_confiabilidad: reliability.score,
        clasificacion_tecnica:
          (draft.aiClassification?.clasificacion_tecnica as string) || subMeta?.technicalHint || null,
        ai_classification: draft.aiClassification || {
          mode: draft.voiceTranscript ? "zernio_voice_audio" : "zernio_inbound_text",
          es_evidencia_valida: draft.aiPhotoValid,
        },
      })
      .select("*")
      .single();

    if (dbErr) {
      return { error: dbErr.message };
    }

    // Despachar alerta SOLID (correo urgente con minimapa si aplica)
    if (inserted) {
      const dispatcher = createDefaultAlertDispatcher();
      await dispatcher
        .evaluateAndDispatch({
          report: {
            id: inserted.id,
            trackingCode: inserted.tracking_code,
            tipoEvento: inserted.tipo_evento,
            subtipoEvento: subMeta?.id || inferred.subtipoId,
            zonaManglar: inserted.zona_manglar,
            municipio: inserted.municipio,
            sectorId: inserted.sector_id,
            enZonaPorRevisar: inserted.en_zona_por_revisar,
            nivelPrioridad: inserted.nivel_prioridad,
            puntajeConfiabilidad: inserted.puntaje_confiabilidad,
            estadoValidacion: inserted.estado_validacion,
            latitud: Number(inserted.latitud),
            longitud: Number(inserted.longitud),
            isSimulatedGps: inserted.is_simulated_gps,
            aiPhotoValid: draft.aiPhotoValid,
            descripcionCiudadana: inserted.descripcion_ciudadana,
            evidenciaFotoUrl: inserted.evidencia_foto_url,
          },
          baseUrl: siteUrl,
        })
        .catch(() => {});
    }

    // Limpiar borrador pero recordar último reporte por 3 min (si el usuario manda un audio justo después, se adjunta a este mismo reporte!)
    await resetDraftFields({
      last_report_id: inserted?.id || null,
      last_tracking_code: trackingCode,
      last_report_at: new Date().toISOString(),
    });

    const aiSaw =
      typeof draft.aiClassification?.que_muestra_la_foto === "string"
        ? draft.aiClassification.que_muestra_la_foto
        : null;

    const verdictLine =
      draft.aiPhotoValid === false
        ? `⚠️ Foto rechazada por IA (0/25): «${aiSaw || "escena fuera de campo"}». Bloqueada para alerta roja.`
        : draft.aiPhotoValid === true
        ? `✅ Foto confirmada por IA (${reliability.score}/100 pts): «${aiSaw || subMeta?.label}».`
        : `📋 Recibido para revisión de mentores CRA (${reliability.score}/100 pts).`;

    const audioLine = draft.voiceTranscript ? `\n• 🎙️ Audio: «${draft.voiceTranscript.slice(0, 140)}»` : "";

    const replyMessage =
      `🌿 *¡Reporte guardado en el CRM CRA!*\n` +
      `• Código: *${trackingCode}* (Canal WHATSAPP)\n` +
      `• Lugar: *${geoResolved.sector.nombre}*${isSimulatedGps ? " (aproximado)" : " (GPS real ✓)"}\n` +
      `• ${verdictLine}${audioLine}\n\n` +
      `🔎 Sigue el caso aquí:\n${siteUrl}/escuelas?code=${trackingCode}\n` +
      `Escribe *"estado ${trackingCode}"* cuando quieras revisar el avance.`;

    const minimapImageUrl = `${siteUrl}/api/minimap?lat=${geoResolved.lat}&lon=${geoResolved.lon}&label=${encodeURIComponent(
      `${geoResolved.sector.municipioPrincipal} · ${trackingCode}`
    )}&color=${draft.aiPhotoValid === false ? "EDB512" : "16794A"}`;

    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        attachmentUrl: minimapImageUrl,
        attachmentType: "image",
        message: replyMessage.slice(0, 620),
        buttons: [
          { type: "postback", title: "📸 Nuevo reporte", payload: "btn_reportar" },
          { type: "postback", title: "🌿 Explorar 4 puntos", payload: "btn_explorar" },
          { type: "postback", title: "🔥 Fuego NASA hoy", payload: "btn_nasa" },
        ],
      }).catch(() =>
        replyZernioConversation({ conversationId, accountId, message: replyMessage }).catch(() => {})
      );
    }

    return {
      ok: true,
      trackingCode,
      platform,
      channelLabel: `Canal: ${platform.toUpperCase()}`,
      sector: geoResolved.sector.nombre,
      isSimulatedGps,
      aiPhotoValid: draft.aiPhotoValid,
      aiSaw,
      voiceTranscript: draft.voiceTranscript,
      reliabilityScore: reliability.score,
      assistantReplyPreview: replyMessage,
    };
  };

  // ============================================================
  // 1. COMANDOS GLOBALES (funcionan en cualquier paso, anti-dummies)
  // ============================================================

  // 1A. Consulta de estado por código (ej. "estado MGL-ZN-4553")
  const codeMatch = rawText.match(/MGL-[A-Z0-9]+-[A-Z0-9]+/i);
  if (codeMatch && /estado|seguimiento|codigo|c[oó]digo|status/i.test(rawText)) {
    const code = codeMatch[0].toUpperCase();
    const { data: found } = await supabase
      .from("citizen_reports")
      .select("tracking_code,zona_manglar,estado_validacion,attention_status,puntaje_confiabilidad")
      .eq("tracking_code", code)
      .maybeSingle();

    const replyText = found
      ? `🌿 Así va tu reporte *${found.tracking_code}* (${found.zona_manglar}):\n• Revisión: ${found.estado_validacion}\n• Atención CRA: ${found.attention_status}\n• Confiabilidad: ${found.puntaje_confiabilidad}/100\n\nVer detalle: ${siteUrl}/escuelas?code=${found.tracking_code}`
      : `No encontré el código *${code}*. Revisa las letras o toca *📸 Reportar manglar* para crear uno nuevo.`;

    if (canReply) {
      await replyZernioConversation({ conversationId, accountId, message: replyText, buttons: MAIN_BUTTONS }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "status_lookup", code, assistantReplyPreview: replyText });
  }

  // 1B. Cancelar borrador actual
  if (interactiveId === "btn_cancel" || /^(cancelar|anular|salir|reiniciar)$/i.test(cleanText)) {
    await resetDraftFields();
    const preview = await sendWelcomeMenu("🧹 Listo, cancelamos el reporte anterior.");
    return NextResponse.json({ ok: true, handled: "draft_cancelled", assistantReplyPreview: preview });
  }

  // 1C. Botón Menú principal o saludo directo
  const imageAttachment = (msg.attachments || []).find((a) => a.type === "image" && a.url);
  const audioAttachment = (msg.attachments || []).find((a) => a.type === "audio" && a.url);
  const locAttachment = (msg.attachments || []).find((a) => a.type === "location");
  const rawLat =
    meta.latitude ??
    meta.location?.latitude ??
    locAttachment?.payload?.latitude ??
    locAttachment?.payload?.coordinates?.lat;
  const rawLon =
    meta.longitude ??
    meta.location?.longitude ??
    locAttachment?.payload?.longitude ??
    locAttachment?.payload?.coordinates?.long ??
    locAttachment?.payload?.coordinates?.lng;
  const hasExplicitLocation =
    typeof rawLat === "number" &&
    typeof rawLon === "number" &&
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLon);

  if (
    interactiveId === "btn_menu" ||
    (!imageAttachment &&
      !audioAttachment &&
      !hasExplicitLocation &&
      /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|menu|men[uú]( principal)?|ayuda|inicio|hi|hey|start)\b/i.test(
        cleanText
      ))
  ) {
    await resetDraftFields();
    const preview = await sendWelcomeMenu();
    return NextResponse.json({ ok: true, handled: "welcome_interactive", assistantReplyPreview: preview });
  }

  // 1D. Botón 🔥 Fuego NASA hoy (en vivo)
  if (interactiveId === "btn_nasa" || /^(ver )?(fuego nasa|sat[eé]lite nasa|incendios hoy|nasa)/i.test(cleanText)) {
    const nasa = await fetchNasaFirmsData().catch(() => null);
    const atlCount = nasa?.atlantico.length ?? 0;
    const caribeCount = nasa?.caribe.length ?? 0;
    const closest = nasa?.caribe[0];
    const nasaMsg =
      `🛰️ *Monitor de Fuego NASA en Vivo (últimas 24 h)*\n\n` +
      `• Focos de calor en el *Atlántico*: *${atlCount}*\n` +
      `• Focos en el *Caribe cercano*: *${caribeCount}*\n` +
      (closest
        ? `• Punto más cercano al manglar: a *${closest.distanceToMangroveKm} km* de *${closest.nearestSectorName}* (satélite ${closest.satellite}, ${closest.acqTimeUtc}).\n\n`
        : `\n✅ Sin puntos críticos pegados al manglar ahora mismo.\n\n`) +
      `Si ves humo o fuego real cerca, toca *📸 Reportar humo* y avisamos a la CRA de inmediato.`;

    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        attachmentUrl: `${siteUrl}/media/sat/z3_img.jpg`,
        attachmentType: "image",
        message: nasaMsg,
        buttons: [
          { type: "postback", title: "📸 Reportar humo", payload: "btn_reportar" },
          { type: "postback", title: "🌿 Explorar 4 puntos", payload: "btn_explorar" },
          { type: "postback", title: "🏠 Menú principal", payload: "btn_menu" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      handled: "nasa_fire_live",
      atlanticoFires: atlCount,
      caribeFires: caribeCount,
      assistantReplyPreview: nasaMsg,
    });
  }

  // 1E. Botón 🌿 Explorar los 4 manglares (Carrusel deslizable de 4 fotos con botón de audioguía!)
  if (
    interactiveId === "btn_explorar" ||
    /^(explorar( los)? 4 (puntos|manglares)|explorar|pasaporte|especies|turista)/i.test(cleanText)
  ) {
    const exploreFallbackMsg =
      `🌿 *¡Explora los 4 Manglares del Atlántico y gana tus sellos!*\n\n` +
      `1️⃣ *Mallorquín* (Barranquilla): ${siteUrl}/p/1\n` +
      `2️⃣ *Puerto Velero* (Pto. Colombia): ${siteUrl}/p/2\n` +
      `3️⃣ *Juan de Acosta* (Estuario): ${siteUrl}/p/3\n` +
      `4️⃣ *Ciénaga del Totumo* (Piojó): ${siteUrl}/p/4\n\n` +
      `🎧 Cada punto trae *audioguía en voz colombiana* y retos para niños.`;

    if (canReply) {
      let carouselSent = false;
      if (platform === "whatsapp") {
        const res = await replyZernioConversation({
          conversationId,
          accountId,
          interactive: {
            type: "carousel",
            body: {
              text: "🌿 *Desliza los 4 Manglares del Atlántico* ➡️\nToca cualquier punto para escuchar su audioguía en voz colombiana y coleccionar tus sellos del Pasaporte Costero.",
            },
            action: {
              cards: [
                {
                  card_index: 0,
                  type: "cta_url",
                  header: { type: "image", image: { link: `${siteUrl}/media/sat/z1_img.jpg` } },
                  body: { text: "1️⃣ *Ciénaga de Mallorquín* (Barranquilla)\nBosque urbano, aves y 828 ha por verificar." },
                  action: { name: "cta_url", parameters: { display_text: "Abrir audioguía 🎧", url: `${siteUrl}/p/1` } },
                },
                {
                  card_index: 1,
                  type: "cta_url",
                  header: { type: "image", image: { link: `${siteUrl}/media/sat/z2_img.jpg` } },
                  body: { text: "2️⃣ *Puerto Velero – Balboa* (Pto. Colombia)\nCorredor turístico y vigilancia costera." },
                  action: { name: "cta_url", parameters: { display_text: "Abrir audioguía 🎧", url: `${siteUrl}/p/2` } },
                },
                {
                  card_index: 2,
                  type: "cta_url",
                  header: { type: "image", image: { link: `${siteUrl}/media/sat/z3_img.jpg` } },
                  body: { text: "3️⃣ *Estuario Juan de Acosta* (Tubará)\nSello NFC #03, retos escolares y manglar vivo." },
                  action: { name: "cta_url", parameters: { display_text: "Abrir audioguía 🎧", url: `${siteUrl}/p/3` } },
                },
                {
                  card_index: 3,
                  type: "cta_url",
                  header: { type: "image", image: { link: `${siteUrl}/media/sat/z4_img.jpg` } },
                  body: { text: "4️⃣ *Ciénaga del Totumo* (Piojó)\nHumedal sagrado, flora local y protección CRA." },
                  action: { name: "cta_url", parameters: { display_text: "Abrir audioguía 🎧", url: `${siteUrl}/p/4` } },
                },
              ],
            },
          },
        }).catch(() => null);
        carouselSent = Boolean(res?.ok);
      }
      if (!carouselSent) {
        await replyZernioConversation({
          conversationId,
          accountId,
          attachmentUrl: `${siteUrl}/images/og-backdrop.jpg`,
          attachmentType: "image",
          message: exploreFallbackMsg,
          buttons: MAIN_BUTTONS,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, handled: "explore_passport_carousel", assistantReplyPreview: exploreFallbackMsg });
  }

  // 1F. Iniciar reporte guiado en 3 pasos (📸 Reportar manglar / Nuevo reporte / Reportar humo)
  if (
    interactiveId === "btn_reportar" ||
    /^(reportar( algo en el manglar| manglar| humo)?|nuevo reporte|enviar otra foto)$/i.test(cleanText)
  ) {
    await resetDraftFields({ step: "awaiting_location" });
    const guideMsg =
      `📸 *¡Súper fácil! Vamos paso a paso (3 pasos cortos):*\n\n` +
      `📍 *Paso 1 de 3 — ¿Dónde estás?*\n` +
      `Toca el botón de abajo para enviarme tu *ubicación exacta*.\n` +
      `*(Si prefieres, también puedes escribir el nombre del lugar, ej: "Mallorquín" o "Juan de Acosta", o mandarme la foto directo)*.\n\n` +
      `⚠️ *Cuídate:* toma tus fotos siempre desde un lugar seguro.`;
    await sendLocationPrompt(guideMsg);
    return NextResponse.json({ ok: true, handled: "step_1_awaiting_location", assistantReplyPreview: guideMsg });
  }

  // Cargar sesión activa de Supabase para pasos guiados
  const session = await loadSession();

  // 1G. Botón pedir ubicación conservando el borrador actual (cuando mandaron audio o foto primero)
  if (interactiveId === "btn_ask_location") {
    await upsertSession({ step: "awaiting_location" });
    const locPrompt = `📍 Toca el botón de abajo para agregar tu *ubicación exacta* al reporte (o escribe el nombre del manglar):`;
    await sendLocationPrompt(locPrompt);
    return NextResponse.json({ ok: true, handled: "ask_location_keep_draft", assistantReplyPreview: locPrompt });
  }

  // 1H. Botón cambiar foto conservando ubicación y notas
  if (interactiveId === "btn_change_photo" || /^cambiar foto$/i.test(cleanText)) {
    await upsertSession({ step: "awaiting_photo", photo_url: null, photo_hash: null, ai_photo_valid: null, ai_classification: null });
    const msgTxt = `📸 *¡Listo!* Envíame la nueva foto real al aire libre del manglar (conservo tu ubicación).`;
    if (canReply) {
      await replyZernioConversation({ conversationId, accountId, message: msgTxt }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "change_photo", assistantReplyPreview: msgTxt });
  }

  // 1I. Botón confirmar y enviar reporte ya (desde borrador con foto, audio o texto)
  if (
    interactiveId === "btn_confirm_report" ||
    /^(enviar reporte ya|guardar igual|enviar solo con audio|enviar sin foto)/i.test(cleanText)
  ) {
    if (!session || (!session.photo_url && !session.voice_transcript && !session.notes)) {
      const preview = await sendWelcomeMenu("Aún no tengo foto ni audio en tu reporte. Empecemos:");
      return NextResponse.json({ ok: true, handled: "empty_draft_redirect", assistantReplyPreview: preview });
    }
    const result = await finalizeReport({
      lat: session.lat,
      lon: session.lon,
      isSimulatedGps: session.is_simulated_gps,
      photoUrl: session.photo_url,
      photoHash: session.photo_hash,
      aiPhotoValid: session.ai_photo_valid,
      aiClassification: session.ai_classification,
      notes: session.notes,
      voiceTranscript: session.voice_transcript,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  }

  // ============================================================
  // 2. RECEPCIÓN DE UBICACIÓN GPS NATIVA (guarda en Supabase!)
  // ============================================================
  if (hasExplicitLocation && !imageAttachment && !audioAttachment) {
    const pinGeo = inferSectorAndCoords("", rawLat, rawLon) || {
      lat: rawLat as number,
      lon: rawLon as number,
      sector: CRA_SECTORS[0],
      isSimulatedGps: false,
    };

    const alreadyHasPhoto = Boolean(session?.photo_url);
    const alreadyHasNote = Boolean(session?.voice_transcript || session?.notes);

    await upsertSession({
      step: alreadyHasPhoto ? "awaiting_note" : "awaiting_photo",
      lat: pinGeo.lat,
      lon: pinGeo.lon,
      sector_id: pinGeo.sector.id,
      sector_name: pinGeo.sector.nombre,
      is_simulated_gps: false,
    });

    if (alreadyHasPhoto && alreadyHasNote) {
      const result = await finalizeReport({
        lat: pinGeo.lat,
        lon: pinGeo.lon,
        isSimulatedGps: false,
        photoUrl: session!.photo_url,
        photoHash: session!.photo_hash,
        aiPhotoValid: session!.ai_photo_valid,
        aiClassification: session!.ai_classification,
        notes: session!.notes,
        voiceTranscript: session!.voice_transcript,
      });
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json(result);
    }

    if (alreadyHasPhoto) {
      const reply =
        `📍 *¡GPS real guardado en ${pinGeo.sector.nombre}!*\n\n` +
        `🎙️ *Paso 3 de 3 — Te espero:*\n` +
        `Envíame una *nota de voz 🎤* o texto explicando qué pasa, o toca abajo para enviar ya:`;
      if (canReply) {
        await replyZernioConversation({
          conversationId,
          accountId,
          message: reply,
          buttons: [
            { type: "postback", title: "✅ Enviar reporte ya", payload: "btn_confirm_report" },
            { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
          ],
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, handled: "location_saved_waiting_note", sector: pinGeo.sector.nombre });
    }

    const reply =
      `📍 *¡Ubicación exacta guardada!* (${Number(rawLat).toFixed(4)}, ${Number(rawLon).toFixed(4)})\n` +
      `• Sector CRA: *${pinGeo.sector.nombre}*\n\n` +
      `📸 *Paso 2 de 3 — Envíame 1 foto:*\n` +
      `Toma o envía una foto real de lo que ves en el manglar.\n` +
      `*(Después de la foto te esperaré para que me mandes tu nota de voz 🎤 o explicación).*`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: reply,
        buttons: alreadyHasNote
          ? [
              { type: "postback", title: "✅ Enviar sin foto", payload: "btn_confirm_report" },
              { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
            ]
          : undefined,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "step_2_location_saved_waiting_photo", sector: pinGeo.sector.nombre });
  }

  // ============================================================
  // 3. RECEPCIÓN DE FOTO (descarga + Supabase Storage + IA + ESPERA AUDIO!)
  // ============================================================
  if (imageAttachment?.url) {
    let photoUrl: string | null = null;
    let photoHash: string | null = null;
    let aiClassification: Record<string, unknown> | null = null;
    let aiPhotoValid: boolean | null = null;

    const downloaded = await downloadAttachmentBuffer(imageAttachment.url, platform).catch(() => null);
    if (downloaded) {
      photoHash = crypto.createHash("sha256").update(downloaded.buf).digest("hex");
      const ext = downloaded.contentType.includes("png") ? "png" : "jpg";
      const filePath = `reports/zernio-${platform}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("report-evidence")
        .upload(filePath, downloaded.buf, { contentType: downloaded.contentType, upsert: false });

      if (!upErr) {
        const { data: pub } = supabase.storage.from("report-evidence").getPublicUrl(filePath);
        photoUrl = pub.publicUrl;
      }

      try {
        const dataUrl = `data:${downloaded.contentType};base64,${downloaded.buf.toString("base64")}`;
        const aiRes = await fetch(`${siteUrl}/api/ai/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            descripcion: rawText || session?.voice_transcript || session?.notes || "",
          }),
          signal: AbortSignal.timeout(16000),
        });
        if (aiRes.ok) {
          aiClassification = (await aiRes.json()) as Record<string, unknown>;
          if (typeof aiClassification.es_evidencia_valida === "boolean") {
            aiPhotoValid = aiClassification.es_evidencia_valida;
          }
        }
      } catch {
        // continúa sin fallar
      }
    }

    const mergedNotes = [session?.notes, rawText || null].filter(Boolean).join(" · ") || null;
    const mergedVoice = session?.voice_transcript || null;
    const textGeo = rawText ? inferSectorAndCoords(rawText) : null;
    const effectiveLat = session?.lat ?? textGeo?.lat ?? null;
    const effectiveLon = session?.lon ?? textGeo?.lon ?? null;
    const effectiveSectorName = session?.sector_name ?? textGeo?.sector.nombre ?? null;
    const effectiveSectorId = session?.sector_id ?? textGeo?.sector.id ?? null;
    const effectiveSimGps = session?.lat !== null && session?.lat !== undefined ? session.is_simulated_gps : textGeo?.isSimulatedGps ?? true;

    const aiSaw =
      typeof aiClassification?.que_muestra_la_foto === "string"
        ? aiClassification.que_muestra_la_foto
        : "escena capturada";
    const motivoRechazo =
      typeof aiClassification?.motivo_rechazo === "string"
        ? aiClassification.motivo_rechazo
        : "no parece una captura directa al aire libre en el manglar";

    // Caso 3A: FOTO RECHAZADA POR IA (pantalla PC, interior, selfie) → ¡avisa con claridad y deja reemplazarla sin ensuciar el CRM!
    if (aiPhotoValid === false) {
      await upsertSession({
        step: "awaiting_photo",
        lat: effectiveLat,
        lon: effectiveLon,
        sector_id: effectiveSectorId,
        sector_name: effectiveSectorName,
        is_simulated_gps: effectiveSimGps,
        photo_url: photoUrl,
        photo_hash: photoHash,
        ai_photo_valid: false,
        ai_classification: aiClassification,
        notes: mergedNotes,
        voice_transcript: mergedVoice,
      });

      const rejectMsg =
        `⚠️ *¡Ojo! Revisé tu foto con IA y la frené:*\n` +
        `• Lo que veo: «${aiSaw}»\n` +
        `• Motivo: ${motivoRechazo}\n\n` +
        `Así evitamos falsas alarmas en la CRA (quedaría con *0/25 pts* en foto).\n\n` +
        `📸 *Envíame una foto real al aire libre del manglar* para reemplazarla, o toca abajo si quieres guardarla igual como prueba del filtro IA:`;

      if (canReply) {
        await replyZernioConversation({
          conversationId,
          accountId,
          message: rejectMsg,
          buttons: [
            { type: "postback", title: "✅ Guardar igual (0/25)", payload: "btn_confirm_report" },
            { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
            { type: "postback", title: "🏠 Menú principal", payload: "btn_menu" },
          ],
        }).catch(() => {});
      }
      return NextResponse.json({
        ok: true,
        handled: "photo_rejected_waiting_real_photo",
        aiPhotoValid: false,
        aiSaw,
        assistantReplyPreview: rejectMsg,
      });
    }

    // Caso 3B: Si el usuario YA envió caption descriptivo con la foto O ya tenía nota de voz previa → guardar 1 solo reporte completo de una vez!
    if (mergedVoice || (rawText && rawText.length >= 10)) {
      const result = await finalizeReport({
        lat: effectiveLat,
        lon: effectiveLon,
        isSimulatedGps: effectiveSimGps,
        photoUrl,
        photoHash,
        aiPhotoValid,
        aiClassification,
        notes: mergedNotes,
        voiceTranscript: mergedVoice,
      });
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json(result);
    }

    // Caso 3C: Foto válida recibida sin texto ni audio todavía → ¡ESPERAR LA NOTA DE VOZ O TEXTO (Paso 3 de 3)!
    await upsertSession({
      step: "awaiting_note",
      lat: effectiveLat,
      lon: effectiveLon,
      sector_id: effectiveSectorId,
      sector_name: effectiveSectorName,
      is_simulated_gps: effectiveSimGps,
      photo_url: photoUrl,
      photo_hash: photoHash,
      ai_photo_valid: aiPhotoValid,
      ai_classification: aiClassification,
      notes: mergedNotes,
      voice_transcript: mergedVoice,
    });

    const locLine = effectiveSectorName
      ? `📍 Ubicación lista: *${effectiveSectorName}*${effectiveSimGps ? " (aprox.)" : " (GPS real ✓)"}\n\n`
      : `📍 Aún sin GPS exacto (si quieres también puedes mandarme tu pin de ubicación).\n\n`;

    const waitAudioMsg =
      `✅ *¡Foto recibida y verificada con IA!*\n` +
      `• Detecté: «${aiSaw}»\n` +
      locLine +
      `🎙️ *Paso 3 de 3 — Te espero:*\n` +
      `Envíame una *nota de voz 🎤* o escribe un mensaje corto contando qué está pasando.\n` +
      `*(O toca *✅ Enviar reporte ya* si ya terminaste)*`;

    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: waitAudioMsg,
        buttons: [
          { type: "postback", title: "✅ Enviar reporte ya", payload: "btn_confirm_report" },
          { type: "postback", title: "📸 Cambiar foto", payload: "btn_change_photo" },
          { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      handled: "step_3_photo_ok_waiting_audio",
      aiPhotoValid,
      aiSaw,
      sector: effectiveSectorName,
      assistantReplyPreview: waitAudioMsg,
    });
  }

  // ============================================================
  // 4. RECEPCIÓN DE NOTA DE VOZ (🎤) — Transcribe con Gemini 2.5 Flash y unifica!
  // ============================================================
  if (audioAttachment?.url) {
    const audioDl = await downloadAttachmentBuffer(audioAttachment.url, platform).catch(() => null);
    const mime = audioAttachment.payload?.mimeType || audioAttachment.mimeType || audioDl?.contentType || "audio/ogg";
    const tr = audioDl
      ? await transcribeWhatsAppAudio({
          buf: audioDl.buf,
          mimeType: mime,
          siteUrl,
          sectorHint: session?.sector_name,
        })
      : { transcript: null, empty: false };

    if (!tr.transcript) {
      const retryAudioMsg =
        `🎙️ *No alcancé a escuchar bien tu nota de voz.*\n` +
        `¿Puedes grabarla un poquito más cerca del micrófono o escribirme en pocas palabras qué viste?`;
      if (canReply) {
        await replyZernioConversation({
          conversationId,
          accountId,
          message: retryAudioMsg,
          buttons: session?.photo_url
            ? [
                { type: "postback", title: "✅ Enviar sin audio", payload: "btn_confirm_report" },
                { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
              ]
            : MAIN_BUTTONS,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, handled: "audio_unintelligible_retry", assistantReplyPreview: retryAudioMsg });
    }

    const transcript = tr.transcript;

    // Caso 4A: Hay un borrador activo con FOTO (o en awaiting_note) → ¡UNIFICA GPS + FOTO + AUDIO en 1 SOLO REPORTE!
    if (session && (session.photo_url || session.step === "awaiting_note")) {
      const result = await finalizeReport({
        lat: session.lat,
        lon: session.lon,
        isSimulatedGps: session.is_simulated_gps,
        photoUrl: session.photo_url,
        photoHash: session.photo_hash,
        aiPhotoValid: session.ai_photo_valid,
        aiClassification: session.ai_classification,
        notes: session.notes,
        voiceTranscript: transcript,
      });
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json(result);
    }

    // Caso 4B: Mandó nota de voz justo después (< 4 min) de cerrar un reporte → ¡ADJUNTA el audio a ese mismo reporte sin duplicar!
    if (
      session?.last_report_id &&
      session.last_tracking_code &&
      session.last_report_at &&
      Date.now() - new Date(session.last_report_at).getTime() < 4 * 60 * 1000
    ) {
      const { data: prev } = await supabase
        .from("citizen_reports")
        .select("id,descripcion_ciudadana,evidencia_exif")
        .eq("id", session.last_report_id)
        .maybeSingle();

      if (prev) {
        const prevExif = (prev.evidencia_exif as Record<string, unknown>) || {};
        await supabase
          .from("citizen_reports")
          .update({
            descripcion_ciudadana: `${prev.descripcion_ciudadana} · 🎙️ Nota de voz: ${transcript}`,
            evidencia_exif: { ...prevExif, voice_transcript: transcript },
          })
          .eq("id", prev.id);

        const attachedMsg =
          `🎙️ *¡Agregué tu nota de voz al reporte ${session.last_tracking_code}!*\n` +
          `• Escuché: «${transcript}»\n\n` +
          `Ya quedó actualizado al instante en el panel CRA.`;
        if (canReply) {
          await replyZernioConversation({ conversationId, accountId, message: attachedMsg, buttons: MAIN_BUTTONS }).catch(
            () => {}
          );
        }
        return NextResponse.json({
          ok: true,
          handled: "audio_attached_to_last_report",
          trackingCode: session.last_tracking_code,
          voiceTranscript: transcript,
        });
      }
    }

    // Caso 4C: Mandó nota de voz PRIMERO (sin foto todavía) → guarda transcripción y espera foto (o enviar directo)!
    const voiceGeo = inferSectorAndCoords(transcript);
    await upsertSession({
      step: "awaiting_photo",
      lat: session?.lat ?? voiceGeo?.lat ?? null,
      lon: session?.lon ?? voiceGeo?.lon ?? null,
      sector_id: session?.sector_id ?? voiceGeo?.sector.id ?? null,
      sector_name: session?.sector_name ?? voiceGeo?.sector.nombre ?? null,
      is_simulated_gps: session?.lat !== null && session?.lat !== undefined ? session.is_simulated_gps : voiceGeo?.isSimulatedGps ?? true,
      voice_transcript: transcript,
    });

    const heardMsg =
      `🎙️ *¡Escuché tu nota de voz!*\n` +
      `• «${transcript}»\n\n` +
      `📸 Ahora envíame *1 foto* de lo que ves para completar tu reporte (o toca abajo si quieres enviarlo solo con tu audio):`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: heardMsg,
        buttons: [
          { type: "postback", title: "✅ Enviar solo con audio", payload: "btn_confirm_report" },
          { type: "postback", title: "📍 Enviar ubicación", payload: "btn_ask_location" },
          { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      handled: "audio_saved_waiting_photo",
      voiceTranscript: transcript,
      assistantReplyPreview: heardMsg,
    });
  }

  // ============================================================
  // 5. TEXTO PLANO SEGÚN EL PASO ACTUAL (Anti-dummies)
  // ============================================================
  if (session?.step === "awaiting_note" && rawText) {
    // Ya tiene foto y estaba esperando explicación → ¡finaliza 1 solo reporte completo!
    const result = await finalizeReport({
      lat: session.lat,
      lon: session.lon,
      isSimulatedGps: session.is_simulated_gps,
      photoUrl: session.photo_url,
      photoHash: session.photo_hash,
      aiPhotoValid: session.ai_photo_valid,
      aiClassification: session.ai_classification,
      notes: [session.notes, rawText].filter(Boolean).join(" · "),
      voiceTranscript: session.voice_transcript,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  }

  if (session?.step === "awaiting_location" && rawText) {
    const textGeo = inferSectorAndCoords(rawText);
    if (textGeo) {
      await upsertSession({
        step: "awaiting_photo",
        lat: textGeo.lat,
        lon: textGeo.lon,
        sector_id: textGeo.sector.id,
        sector_name: textGeo.sector.nombre,
        is_simulated_gps: textGeo.isSimulatedGps,
        notes: looksLikeReportContent(rawText) ? rawText : session.notes,
      });
      const reply =
        `📍 *¡Anotado! Sector: ${textGeo.sector.nombre}*\n\n` +
        `📸 *Paso 2 de 3 — Envíame 1 foto:*\n` +
        `Toma o envía una foto real de lo que ves en el manglar (o una nota de voz 🎤).`;
      if (canReply) {
        await replyZernioConversation({ conversationId, accountId, message: reply }).catch(() => {});
      }
      return NextResponse.json({ ok: true, handled: "text_location_saved_waiting_photo", sector: textGeo.sector.nombre });
    }
    // Escribió descripción directa en Paso 1 → guárdala y pídele foto/ubicación
    await upsertSession({ step: "awaiting_photo", notes: rawText });
    const reply =
      `📝 *Anoté tu mensaje:* «${rawText.slice(0, 120)}»\n\n` +
      `📸 Ahora envíame *1 foto* del lugar (o toca abajo si quieres agregar tu ubicación o enviarlo ya):`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: reply,
        buttons: [
          { type: "postback", title: "📍 Enviar ubicación", payload: "btn_ask_location" },
          { type: "postback", title: "✅ Enviar sin foto", payload: "btn_confirm_report" },
          { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "text_note_saved_waiting_photo" });
  }

  if (session?.step === "awaiting_photo" && rawText) {
    const mergedNotes = [session.notes, rawText].filter(Boolean).join(" · ");
    await upsertSession({ notes: mergedNotes });
    const reply =
      `📝 *¡Anotado!* «${rawText.slice(0, 120)}»\n\n` +
      `📸 Envíame *1 foto* real del manglar para subir el puntaje al máximo, o toca *✅ Enviar sin foto* si prefieres mandarlo así:`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: reply,
        buttons: [
          { type: "postback", title: "✅ Enviar sin foto", payload: "btn_confirm_report" },
          { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "note_added_still_waiting_photo" });
  }

  // Fuera de flujo guiado: si parece un reporte ambiental real en texto, abrir borrador guiado; si es charla casual ("ok", "gracias", "probando"), mostrar menú!
  if (rawText.length >= 12 && looksLikeReportContent(rawText)) {
    const textGeo = inferSectorAndCoords(rawText);
    await upsertSession({
      step: "awaiting_photo",
      lat: textGeo?.lat ?? null,
      lon: textGeo?.lon ?? null,
      sector_id: textGeo?.sector.id ?? null,
      sector_name: textGeo?.sector.nombre ?? null,
      is_simulated_gps: textGeo?.isSimulatedGps ?? true,
      notes: rawText,
    });
    const reply =
      `🌿 *¡Recibí tu aviso!* «${rawText.slice(0, 120)}»\n` +
      (textGeo ? `📍 Sector detectado: *${textGeo.sector.nombre}*\n\n` : `\n`) +
      `📸 ¿Puedes enviarme *1 foto* o tu ubicación para validarlo con IA? *(O toca ✅ Enviar sin foto)*`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: reply,
        buttons: [
          { type: "postback", title: "📍 Enviar ubicación", payload: "btn_ask_location" },
          { type: "postback", title: "✅ Enviar sin foto", payload: "btn_confirm_report" },
          { type: "postback", title: "❌ Cancelar", payload: "btn_cancel" },
        ],
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "freeform_report_draft_started" });
  }

  // Fallback amigable para cualquier texto casual/corto (nunca crea basura en el CRM!)
  const preview = await sendWelcomeMenu();
  return NextResponse.json({ ok: true, handled: "fallback_welcome_menu", assistantReplyPreview: preview });
}
