import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { ALL_SUBTYPES, CRA_SECTORS, type EventTypeId } from "@/lib/cra-domain";
import { computeReliabilityScore } from "@/lib/reliability";
import { createDefaultAlertDispatcher } from "@/core/alerts/dispatcher";
import {
  getZernioApiKey,
  replyZernioConversation,
  verifyZernioSignature,
} from "@/lib/zernio";

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

interface ZernioWebhookPayload {
  id?: string;
  event?: string;
  test?: boolean;
  account?: { accountId?: string; id?: string; platform?: string };
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
    }>;
    sender?: {
      id?: string;
      name?: string;
      username?: string;
    };
    metadata?: {
      standby?: boolean;
      latitude?: number;
      longitude?: number;
    };
  };
}

function inferSectorAndCoords(text: string, metaLat?: number, metaLon?: number) {
  // 1. Coordenadas reales enviadas por metadata o pegadas en texto (ej. "10.8719, -75.0972")
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
    }, CRA_SECTORS[2]);
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
    }, CRA_SECTORS[2]);
    return { lat, lon, sector: nearest, isSimulatedGps: false };
  }

  // 2. Inferencia por mención explícita de sector/municipio (marcada honestamente como GPS aproximado/simulado)
  const low = text.toLowerCase();
  if (/mallorqu|barranquilla|bocas|las flores/.test(low)) {
    return { lat: 11.0442, lon: -74.8592, sector: CRA_SECTORS[0], isSimulatedGps: true };
  }
  if (/velero|balboa|salgar|puerto colombia/.test(low)) {
    return { lat: 10.9554, lon: -75.0412, sector: CRA_SECTORS[1], isSimulatedGps: true };
  }
  if (/totumo|pioj|astillero|galerazamba|luruaco/.test(low)) {
    return { lat: 10.7512, lon: -75.2384, sector: CRA_SECTORS[3], isSimulatedGps: true };
  }
  return { lat: 10.8719, lon: -75.0972, sector: CRA_SECTORS[2], isSimulatedGps: true };
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
  if (/tala|cortando|motosierra|tumbaron/.test(low)) {
    return { tipoEvento: "tala_relleno", subtipoId: "tala_poda", priority: "alta" };
  }
  if (/relleno|escombro|maquinaria|excavadora|cerca|obra/.test(low)) {
    return { tipoEvento: "tala_relleno", subtipoId: "relleno_obra", priority: "alta" };
  }
  if (/aceite|combustible|derrame|petr/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "derrame_combustible", priority: "alta" };
  }
  if (/vertimiento|espuma|aguas negras|turbia|mal olor/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "vertimiento_agua", priority: "media" };
  }
  if (/basura|pl[aá]stico|residuo/.test(low)) {
    return { tipoEvento: "contaminacion_residuos", subtipoId: "residuos_solidos", priority: "media" };
  }
  if (/seco|amarill|sequ[ií]a|ca[ñn]o|taponado|erosi/.test(low)) {
    return { tipoEvento: "cambio_hidrico", subtipoId: "dosel_seco", priority: "alta" };
  }
  if (/pez|peces|ave|garza|fauna|muerto|trampa|red/.test(low)) {
    return { tipoEvento: "dano_fauna_especies", subtipoId: "fauna_amenaza", priority: "media" };
  }
  return { tipoEvento: "otro", subtipoId: "verificacion_828ha", priority: "baja" };
}

async function downloadAttachmentBuffer(url: string, platform: string) {
  const apiKey = getZernioApiKey();
  const needsAuth = platform === "whatsapp" || url.includes("zernio.com/api/");
  const res = await fetch(url, {
    headers: needsAuth && apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType };
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
  if (msg.direction === "outgoing" || msg.metadata?.standby) {
    return NextResponse.json({ ok: true, skipped: "outgoing_or_standby" });
  }

  const platform = (msg.platform || payload.account?.platform || "whatsapp").toLowerCase();
  const accountId = payload.account?.accountId || payload.account?.id || "";
  const conversationId = msg.conversationId || "";
  const rawText = (msg.text || "").trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://manglar.arpadura.com").replace(/\/$/, "");
  const supabase = createServerSupabase();

  // 1. Consulta rápida de estado por código (ej: "estado MGL-2026-1234")
  const codeMatch = rawText.match(/MGL-[A-Z0-9]+-[A-Z0-9]+/i);
  if (codeMatch && /estado|seguimiento|codigo|c[oó]digo|status/i.test(rawText)) {
    const code = codeMatch[0].toUpperCase();
    const { data: found } = await supabase
      .from("citizen_reports")
      .select("tracking_code,zona_manglar,estado_validacion,attention_status,puntaje_confiabilidad")
      .eq("tracking_code", code)
      .maybeSingle();

    const replyText = found
      ? `🌿 Estado de ${found.tracking_code} (${found.zona_manglar}):\n• Validación: ${found.estado_validacion}\n• Atención CRA: ${found.attention_status}\n• Confiabilidad: ${found.puntaje_confiabilidad}/100\nVer detalle: ${siteUrl}/escuelas?code=${found.tracking_code}`
      : `No encontramos el código ${code}. Si deseas reportar algo en el manglar, envíanos una foto y el sector (ej. Mallorquín, Puerto Velero, Juan de Acosta o Totumo).`;

    if (conversationId && accountId) {
      await replyZernioConversation({ conversationId, accountId, message: replyText }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "status_lookup", code });
  }

  // 2. Mensaje de bienvenida/ayuda si solo saludó sin adjuntos
  const imageAttachment = (msg.attachments || []).find((a) => a.type === "image" && a.url);
  if (!imageAttachment && rawText.length < 8) {
    const helpMsg =
      `🌿 ¡Hola! Estás conectado a *Manglar Vivo Atlántico (CRA)* vía ${platform.toUpperCase()}.\n\n` +
      `Para enviar un reporte ciudadano desde aquí:\n` +
      `1️⃣ Envía una foto del manglar o amenaza (tala, quema, basura, caño seco o fauna).\n` +
      `2️⃣ Escribe el sector (Mallorquín, Puerto Velero, Juan de Acosta o Totumo) o comparte tu ubicación.\n\n` +
      `También puedes abrir la app offline: ${siteUrl}/reportar`;
    if (conversationId && accountId) {
      await replyZernioConversation({ conversationId, accountId, message: helpMsg }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "welcome_help" });
  }

  // 3. Descarga de foto adjunta + subida a Supabase Storage + auditoría IA visual
  let photoUrl: string | null = null;
  let aiClassification: Record<string, unknown> | null = null;
  let aiPhotoValid: boolean | null = null;
  let photoHash: string | null = null;

  if (imageAttachment?.url) {
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

      // Llamar nuestro propio filtro visual IA anti-falsos
      try {
        const dataUrl = `data:${downloaded.contentType};base64,${downloaded.buf.toString("base64")}`;
        const aiRes = await fetch(`${siteUrl}/api/ai/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            descripcion: rawText,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (aiRes.ok) {
          aiClassification = (await aiRes.json()) as Record<string, unknown>;
          if (typeof aiClassification.es_evidencia_valida === "boolean") {
            aiPhotoValid = aiClassification.es_evidencia_valida;
          }
        }
      } catch {
        // continúa en modo pendiente_ia sin fallar el webhook
      }
    }
  }

  // 4. Cruce territorial y cálculo de Semáforo de Confiabilidad
  const geo = inferSectorAndCoords(rawText, msg.metadata?.latitude, msg.metadata?.longitude);
  const inferred = inferEventFromText(rawText);
  const suggestedSubId =
    aiPhotoValid && typeof aiClassification?.subtipo_sugerido === "string"
      ? aiClassification.subtipo_sugerido
      : inferred.subtipoId;
  const subMeta = ALL_SUBTYPES.find((s) => s.id === suggestedSubId);

  const trackingCode = `MGL-ZN-${Math.floor(1000 + Math.random() * 9000)}`;
  const reliability = computeReliabilityScore({
    hasPhoto: Boolean(photoUrl),
    photoCount: photoUrl ? 1 : 0,
    aiPhotoValid,
    precisionGpsM: geo.isSimulatedGps ? null : 15,
    inCoastalZone: true,
    isSimulatedGps: geo.isSimulatedGps,
    timestampCaptura: new Date().toISOString(),
    nearGroundTruthM: null,
    estadoValidacion: "nuevo",
  });

  // Privacidad Ley 1581: NUNCA guardamos teléfono ni username real en citizen_reports (solo hash anónimo)
  const anonSenderHash = msg.sender?.id
    ? crypto.createHash("sha256").update(`zernio:${platform}:${msg.sender.id}`).digest("hex").slice(0, 16)
    : "anon";

  const { data: inserted, error: dbErr } = await supabase
    .from("citizen_reports")
    .insert({
      client_uuid: crypto.randomUUID(),
      tracking_code: trackingCode,
      timestamp_captura: new Date().toISOString(),
      latitud: geo.lat,
      longitud: geo.lon,
      precision_gps_m: geo.isSimulatedGps ? null : 15,
      is_simulated_gps: geo.isSimulatedGps,
      zona_manglar: geo.sector.nombre,
      municipio: geo.sector.municipioPrincipal,
      sector_id: geo.sector.id,
      accion_plan: "Preservación",
      en_zona_por_revisar: true,
      tipo_evento: subMeta?.eventType || inferred.tipoEvento,
      descripcion_ciudadana: `[Canal ${platform.toUpperCase()} · ${subMeta?.label || inferred.subtipoId}] ${
        rawText || "Evidencia fotográfica enviada por mensajería."
      }`,
      evidencia_foto_url: photoUrl,
      evidencia_exif: {
        source: "zernio_omnichannel",
        platform,
        sender_hash_ley1581: anonSenderHash,
        subtipo_evento: subMeta?.id || inferred.subtipoId,
        subtipo_label: subMeta?.label || inferred.subtipoId,
        factor_dominio: subMeta?.domainId || "fauna_verificacion",
        photo_sha256: photoHash,
        photo_count: photoUrl ? 1 : 0,
      },
      perfil_reportante: "habitante_local",
      qr_station_id: `zernio:${platform}`,
      estado_sincronizacion: "sincronizado",
      estado_validacion: "nuevo",
      attention_status: "pendiente",
      nivel_prioridad: subMeta?.defaultPriority || inferred.priority,
      puntaje_confiabilidad: reliability.score,
      clasificacion_tecnica:
        (aiClassification?.clasificacion_tecnica as string) || subMeta?.technicalHint || null,
      ai_classification: aiClassification || {
        mode: "zernio_inbound_text",
        es_evidencia_valida: aiPhotoValid,
      },
    })
    .select("*")
    .single();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // 5. Despachar alerta automática CRA si aplica (reutilizando nuestro motor SOLID)
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
          aiPhotoValid,
          descripcionCiudadana: inserted.descripcion_ciudadana,
          evidenciaFotoUrl: inserted.evidencia_foto_url,
        },
        baseUrl: siteUrl,
      })
      .catch(() => {});
  }

  // 6. Responder automáticamente al ciudadano por el mismo canal Zernio (WhatsApp / Telegram / IG / SMS)
  const aiSaw =
    typeof aiClassification?.que_muestra_la_foto === "string"
      ? aiClassification.que_muestra_la_foto
      : null;

  const verdictLine =
    aiPhotoValid === false
      ? `⚠️ Auditoría visual IA: detectamos "${aiSaw || "una escena fuera del manglar"}" (${String(
          aiClassification?.motivo_rechazo || "no corresponde a captura en campo"
        )}). Quedó con 0/25 en foto — envíanos una foto real al aire libre del manglar para validarlo.`
      : aiPhotoValid === true
      ? `✅ Auditoría visual IA confirmada (${reliability.score}/100 pts): "${
          aiSaw || subMeta?.label || "evidencia ambiental válida"
        }".`
      : `📋 Recibido para validación de mentores CRA (${reliability.score}/100 pts).`;

  const replyMessage =
    `🌿 *Manglar Vivo Atlántico · Asistente CRA*\n` +
    `• Código: *${trackingCode}* (vía ${platform.toUpperCase()})\n` +
    `• Sector: ${geo.sector.nombre}${geo.isSimulatedGps ? " (ubicación estimada por texto)" : " (GPS verificado)"}\n` +
    `• ${verdictLine}\n\n` +
    `🔎 Sigue la atención oficial de la CRA:\n${siteUrl}/escuelas?code=${trackingCode}\n\n` +
    `🤝 *¡Invita a tu comunidad y colegio!*\n` +
    `Explora las 4 estaciones NFC del Atlántico y colecciona tu Pasaporte Costero: ${siteUrl}/p/3\n` +
    `Escribe *"estado ${trackingCode}"* cuando quieras ver el avance.`;

  if (conversationId && accountId) {
    await replyZernioConversation({ conversationId, accountId, message: replyMessage }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    trackingCode,
    platform,
    channelLabel: `Canal: ${platform.toUpperCase()}`,
    sector: geo.sector.nombre,
    aiPhotoValid,
    aiSaw,
    reliabilityScore: reliability.score,
    assistantReplyPreview: replyMessage,
  });
}
