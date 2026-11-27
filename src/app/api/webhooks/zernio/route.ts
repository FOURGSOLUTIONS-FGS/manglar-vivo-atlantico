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

// Ubicación GPS reciente enviada por el usuario en WhatsApp antes de mandar la foto (TTL 10 min)
const RECENT_USER_LOCATION = new Map<
  string,
  { lat: number; lon: number; expiresAt: number }
>();

function setRecentLocation(senderHash: string, lat: number, lon: number) {
  const now = Date.now();
  for (const [k, v] of RECENT_USER_LOCATION.entries()) {
    if (v.expiresAt < now) RECENT_USER_LOCATION.delete(k);
  }
  RECENT_USER_LOCATION.set(senderHash, { lat, lon, expiresAt: now + 10 * 60 * 1000 });
}

function popRecentLocation(senderHash: string): { lat: number; lon: number } | null {
  const rec = RECENT_USER_LOCATION.get(senderHash);
  if (!rec || rec.expiresAt < Date.now()) {
    RECENT_USER_LOCATION.delete(senderHash);
    return null;
  }
  RECENT_USER_LOCATION.delete(senderHash);
  return { lat: rec.lat, lon: rec.lon };
}

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
  let rawText = (msg.text || "").trim();
  const interactiveId = (
    meta.interactiveId ||
    meta.quickReplyPayload ||
    meta.postbackPayload ||
    ""
  )
    .trim()
    .toLowerCase();
  const lowText = rawText.toLowerCase();
  // Quitamos emojis/símbolos iniciales para que el texto de botones ("📸 Reportar manglar", "🏠 Menú principal") siempre coincida
  const cleanText = lowText.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://manglar.arpadura.com").replace(/\/$/, "");
  const supabase = createServerSupabase();

  // Privacidad Ley 1581: NUNCA guardamos teléfono ni username real en citizen_reports (solo hash anónimo)
  const anonSenderHash = msg.sender?.id
    ? crypto.createHash("sha256").update(`zernio:${platform}:${msg.sender.id}`).digest("hex").slice(0, 16)
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

  // Extraer posible ubicación GPS compartida desde WhatsApp (metadata o adjunto tipo location)
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

  // 1. Consulta rápida de estado por código (ej: "estado MGL-ZN-1234")
  const codeMatch = rawText.match(/MGL-[A-Z0-9]+-[A-Z0-9]+/i);
  if (codeMatch && /estado|seguimiento|codigo|c[oó]digo|status/i.test(rawText)) {
    const code = codeMatch[0].toUpperCase();
    const { data: found } = await supabase
      .from("citizen_reports")
      .select("tracking_code,zona_manglar,estado_validacion,attention_status,puntaje_confiabilidad")
      .eq("tracking_code", code)
      .maybeSingle();

    const replyText = found
      ? `🌿 Así va tu reporte *${found.tracking_code}* (${found.zona_manglar}):\n• Revisión: ${found.estado_validacion}\n• Atención CRA: ${found.attention_status}\n• Confiabilidad: ${found.puntaje_confiabilidad}/100\n\nVer detalle completo: ${siteUrl}/escuelas?code=${found.tracking_code}`
      : `No encontré el código *${code}*. Revisa las letras o envíame una foto nueva del manglar y yo la registro de una vez.`;

    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: replyText,
        buttons: MAIN_BUTTONS,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "status_lookup", code, assistantReplyPreview: replyText });
  }

  // 2A. Botón interactivo: 🔥 Fuego NASA hoy (consulta EN VIVO a satélites NASA FIRMS VIIRS 375m)
  if (interactiveId === "btn_nasa" || /fuego nasa|sat[eé]lite nasa|incendios hoy/i.test(cleanText)) {
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
      `Si ves humo o fuego real cerca, ¡envíame una foto ahora mismo a distancia segura y avisamos a la CRA!`;

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

  // 2B. Botón interactivo: 🌿 Explorar los 4 manglares (Carrusel deslizable nativo de WhatsApp con 4 fotos + botones!)
  if (interactiveId === "btn_explorar" || /explorar 4 puntos|pasaporte|especies|turista/i.test(cleanText)) {
    const exploreFallbackMsg =
      `🌿 *¡Explora los 4 Manglares del Atlántico y gana tus sellos!*\n\n` +
      `1️⃣ *Mallorquín* (Barranquilla): ${siteUrl}/p/1\n` +
      `2️⃣ *Puerto Velero* (Pto. Colombia): ${siteUrl}/p/2\n` +
      `3️⃣ *Juan de Acosta* (Estuario): ${siteUrl}/p/3\n` +
      `4️⃣ *Ciénaga del Totumo* (Piojó): ${siteUrl}/p/4\n\n` +
      `🎧 Cada punto trae *audioguía en voz colombiana*, retos para niños y guía de las 4 especies.`;

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
          buttons: [
            { type: "postback", title: "📸 Reportar manglar", payload: "btn_reportar" },
            { type: "postback", title: "🔥 Fuego NASA hoy", payload: "btn_nasa" },
            { type: "postback", title: "🏠 Menú principal", payload: "btn_menu" },
          ],
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, handled: "explore_passport_carousel", assistantReplyPreview: exploreFallbackMsg });
  }

  // 2C. Botón interactivo: 📸 Reportar manglar / Enviar otra foto (ofrece ubicación nativa 1 toque en WhatsApp)
  if (
    interactiveId === "btn_reportar" ||
    /^(reportar( manglar| humo)?|enviar otra foto)$/i.test(cleanText)
  ) {
    const guideMsg =
      `📸 *¡Súper fácil! Haz tu reporte en 2 pasos:*\n\n` +
      `1️⃣ Toca el botón de abajo para enviarme tu *ubicación exacta* (opcional si ya me dices el lugar).\n` +
      `2️⃣ Envíame *1 foto* (o una nota de voz) de lo que ves en el manglar.\n\n` +
      `⚠️ *Cuídate:* toma la foto siempre desde una distancia segura.`;

    if (canReply) {
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
    }
    return NextResponse.json({ ok: true, handled: "report_guide", assistantReplyPreview: guideMsg });
  }

  const imageAttachment = (msg.attachments || []).find((a) => a.type === "image" && a.url);
  const audioAttachment = (msg.attachments || []).find((a) => a.type === "audio" && a.url);

  // 2D. Si el usuario compartió su ubicación GPS sola (sin foto aún): la guardamos o la pegamos a su reporte recién enviado!
  if (hasExplicitLocation && !imageAttachment && !audioAttachment) {
    const pinGeo = inferSectorAndCoords("", rawLat, rawLon);
    setRecentLocation(anonSenderHash, rawLat as number, rawLon as number);

    // Revisar si mandó un reporte por WhatsApp en los últimos 10 minutos sin GPS real para actualizarlo automáticamente
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentRep } = await supabase
      .from("citizen_reports")
      .select("id,tracking_code,evidencia_foto_url,puntaje_confiabilidad,ai_classification")
      .eq("qr_station_id", `zernio:${platform}`)
      .eq("is_simulated_gps", true)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentRep) {
      const updatedScore = Math.min(100, (recentRep.puntaje_confiabilidad || 30) + 25);
      await supabase
        .from("citizen_reports")
        .update({
          latitud: pinGeo.lat,
          longitud: pinGeo.lon,
          precision_gps_m: 15,
          is_simulated_gps: false,
          zona_manglar: pinGeo.sector.nombre,
          municipio: pinGeo.sector.municipioPrincipal,
          sector_id: pinGeo.sector.id,
          puntaje_confiabilidad: updatedScore,
        })
        .eq("id", recentRep.id);

      const locUpdatedMsg =
        `📍 *¡Ubicación GPS exacta agregada a tu reporte ${recentRep.tracking_code}!*\n\n` +
        `• Sector: *${pinGeo.sector.nombre}*\n` +
        `• Confiabilidad actualizada: *${updatedScore}/100 pts*\n\n` +
        `¿Quieres enviar una foto nueva o revisar los 4 puntos del Atlántico?`;
      if (canReply) {
        await replyZernioConversation({
          conversationId,
          accountId,
          message: locUpdatedMsg,
          buttons: MAIN_BUTTONS,
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, handled: "location_attached_to_recent", trackingCode: recentRep.tracking_code });
    }

    const locSavedMsg =
      `📍 *¡Ubicación recibida!* (${Number(rawLat).toFixed(4)}, ${Number(rawLon).toFixed(4)})\n` +
      `• Sector más cercano: *${pinGeo.sector.nombre}*\n\n` +
      `Ahora envíame *1 foto* de lo que ves en el manglar (y si quieres una breve nota de texto o audio) y la guardo al instante con tu GPS real.`;
    if (canReply) {
      await replyZernioConversation({
        conversationId,
        accountId,
        message: locSavedMsg,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, handled: "location_cached_waiting_photo", sector: pinGeo.sector.nombre });
  }

  // 2E. Bienvenida inmersiva con FOTO + 3 BOTONES INTERACTIVOS si saluda o toca Menú
  const isGreeting =
    interactiveId === "btn_menu" ||
    /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|menu|men[uú]( principal)?|ayuda|inicio|hi|hey|start|gracias|ok|si|sí)\b/i.test(
      cleanText
    );
  if (!imageAttachment && !audioAttachment && (isGreeting || cleanText.length < 8)) {
    const welcomeMsg =
      `🌿 *¡Hola! Soy el asistente de Manglar Vivo Atlántico (CRA)*\n\n` +
      `Aquí puedes cuidar los manglares del Caribe súper fácil, sin descargar nada:\n` +
      `• Envíame una *foto* y te digo al instante qué detectamos.\n` +
      `• Toca un botón abajo para empezar 👇`;
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
    return NextResponse.json({ ok: true, handled: "welcome_interactive", assistantReplyPreview: welcomeMsg });
  }

  // 2F. Transcripción automática si el usuario envía una nota de voz en WhatsApp
  if (audioAttachment?.url) {
    const audioDl = await downloadAttachmentBuffer(audioAttachment.url, platform).catch(() => null);
    if (audioDl) {
      try {
        const audioDataUrl = `data:${audioDl.contentType};base64,${audioDl.buf.toString("base64")}`;
        const trRes = await fetch(`${siteUrl}/api/ai/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioDataUrl, mimeType: audioDl.contentType }),
          signal: AbortSignal.timeout(15000),
        });
        if (trRes.ok) {
          const trJson = (await trRes.json()) as { text?: string };
          if (trJson.text) {
            rawText = rawText ? `${rawText} · [Nota de voz]: ${trJson.text}` : `[Nota de voz]: ${trJson.text}`;
          }
        }
      } catch {
        // continúa sin fallar
      }
    }
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
  const cachedLoc = hasExplicitLocation ? null : popRecentLocation(anonSenderHash);
  const effectiveLat = hasExplicitLocation ? (rawLat as number) : cachedLoc?.lat;
  const effectiveLon = hasExplicitLocation ? (rawLon as number) : cachedLoc?.lon;
  const geo = inferSectorAndCoords(rawText, effectiveLat, effectiveLon);
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

  const minimapImageUrl = `${siteUrl}/api/minimap?lat=${geo.lat}&lon=${geo.lon}&label=${encodeURIComponent(
    `${geo.sector.municipioPrincipal} · ${trackingCode}`
  )}&color=${aiPhotoValid === false ? "EDB512" : "16794A"}`;

  if (canReply) {
    await replyZernioConversation({
      conversationId,
      accountId,
      attachmentUrl: minimapImageUrl,
      attachmentType: "image",
      message: replyMessage.slice(0, 620),
      buttons: [
        { type: "postback", title: "🌿 Explorar 4 puntos", payload: "btn_explorar" },
        { type: "postback", title: "🔥 Fuego NASA hoy", payload: "btn_nasa" },
        { type: "postback", title: "📸 Enviar otra foto", payload: "btn_reportar" },
      ],
    }).catch(() =>
      replyZernioConversation({ conversationId, accountId, message: replyMessage }).catch(() => {})
    );
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
