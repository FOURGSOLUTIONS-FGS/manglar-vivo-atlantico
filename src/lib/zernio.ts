import crypto from "node:crypto";

export const ZERNIO_BASE_URL = "https://zernio.com/api/v1";

export const ZERNIO_SUPPORTED_PLATFORMS = [
  { id: "whatsapp", label: "WhatsApp Cloud API", hint: "Reportes con foto, audio y ubicación desde celular" },
  { id: "telegram", label: "Telegram Bot / Canal", hint: "Ideal para escuelas PRAES y brigadas costeras" },
  { id: "instagram", label: "Instagram DM", hint: "Turistas y jóvenes reportando por mensaje directo" },
  { id: "facebook", label: "Facebook Messenger", hint: "Comunidad local y juntas de acción comunal" },
  { id: "sms", label: "SMS / MMS", hint: "Zonas costeras sin datos móviles (solo señal celular)" },
  { id: "twitter", label: "X (Twitter)", hint: "Alertas públicas y mensajes directos" },
] as const;

export function getZernioApiKey(): string {
  return (process.env.ZERNIO_API_KEY || "").trim();
}

export function getZernioWebhookSecret(): string {
  return (process.env.ZERNIO_WEBHOOK_SECRET || "").trim();
}

export function isZernioConfigured(): boolean {
  return getZernioApiKey().length > 0;
}

export async function zernioFetch<T = Record<string, unknown>>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    requireAuth?: boolean;
  } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const apiKey = getZernioApiKey();
  const requireAuth = options.requireAuth !== false;

  if (requireAuth && !apiKey) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "ZERNIO_API_KEY no está configurada en el servidor.",
        code: "missing_zernio_api_key",
      } as unknown as T,
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(18000),
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Verifica firma HMAC-SHA256 del header X-Zernio-Signature sobre el raw body.
 */
export function verifyZernioSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret = getZernioWebhookSecret()
): boolean {
  if (!secret) return true; // Si aún no hay secreto configurado, permitir recepción controlada
  if (!signatureHeader) return false;
  const cleanSig = signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(cleanSig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Crea o recupera el perfil oficial "Manglar Vivo Atlántico (CRA)" usando externalId idempotente.
 */
export async function ensureCraZernioProfile() {
  const externalId = "cra-atlantico-manglar-vivo";
  const existing = await zernioFetch<{
    profiles?: Array<{ _id: string; name: string; externalId?: string | null }>;
  }>(`/profiles?externalId=${encodeURIComponent(externalId)}`);

  if (existing.ok && Array.isArray(existing.data.profiles) && existing.data.profiles.length > 0) {
    return { ok: true as const, profile: existing.data.profiles[0], created: false };
  }

  const created = await zernioFetch<{
    profile?: { _id: string; name: string; externalId?: string | null };
    _id?: string;
    name?: string;
    details?: { existingProfileId?: string };
    error?: string;
  }>("/profiles", {
    method: "POST",
    body: {
      name: "Manglar Vivo Atlántico · CRA",
      description:
        "Canales ciudadanos de monitoreo ambiental, alertas tempranas y ciencia ciudadana de la CRA Atlántico.",
      color: "#005F96",
      externalId,
    },
  });

  if (created.ok) {
    const prof = created.data.profile || {
      _id: created.data._id || "",
      name: created.data.name || "Manglar Vivo Atlántico · CRA",
      externalId,
    };
    return { ok: true as const, profile: prof, created: true };
  }

  if (created.status === 409 && created.data.details?.existingProfileId) {
    return {
      ok: true as const,
      profile: {
        _id: created.data.details.existingProfileId,
        name: "Manglar Vivo Atlántico · CRA",
        externalId,
      },
      created: false,
    };
  }

  return {
    ok: false as const,
    status: created.status,
    error: created.data.error || "No se pudo crear el perfil en Zernio.",
  };
}

/**
 * Genera el enlace OAuth/conexión white-label oficial de Zernio para cualquier plataforma.
 */
export async function createZernioConnectLink(params: {
  platform: string;
  profileId: string;
  redirectUrl?: string;
}) {
  const qs = new URLSearchParams({
    profileId: params.profileId,
    ...(params.redirectUrl ? { redirect_url: params.redirectUrl } : {}),
  });
  return zernioFetch<{
    authUrl?: string;
    url?: string;
    state?: string;
    error?: string;
  }>(`/connect/${encodeURIComponent(params.platform)}?${qs.toString()}`);
}

export interface ZernioReplyButton {
  type: "postback";
  title: string;
  payload: string;
}

/**
 * Muestra el indicador "Escribiendo..." en WhatsApp / Instagram / Facebook antes de responder.
 */
export async function sendZernioTyping(conversationId: string, accountId: string) {
  return zernioFetch(`/inbox/conversations/${encodeURIComponent(conversationId)}/typing`, {
    method: "POST",
    body: { accountId },
  }).catch(() => null);
}

/**
 * Envía una respuesta enriquecida dentro de una conversación del Inbox Unificado de Zernio
 * (WhatsApp con foto + hasta 3 botones interactivos o solicitud nativa de ubicación, Telegram, IG, FB, SMS).
 */
export async function replyZernioConversation(params: {
  conversationId: string;
  accountId: string;
  message?: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "video" | "audio" | "file";
  buttons?: ZernioReplyButton[];
  interactive?: Record<string, unknown>;
}) {
  const body: Record<string, unknown> = {
    accountId: params.accountId,
  };
  if (params.message) body.message = params.message;
  if (params.attachmentUrl) {
    body.attachmentUrl = params.attachmentUrl;
    body.attachmentType = params.attachmentType || "image";
  }
  if (params.buttons && params.buttons.length > 0 && !params.interactive) {
    body.buttons = params.buttons.slice(0, 3);
  }
  if (params.interactive) {
    body.interactive = params.interactive;
  }

  return zernioFetch<{ data?: { messageId?: string }; error?: string }>(
    `/inbox/conversations/${encodeURIComponent(params.conversationId)}/messages`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body,
    }
  );
}
