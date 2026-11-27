import crypto from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export interface SpamEvaluationInput {
  ip: string;
  fingerprint?: string | null;
  honeypot?: string | null;
  formDurationMs?: number | null;
  lat: number;
  lon: number;
  description?: string | null;
  photoHashes?: string[];
  bypassRateLimit?: boolean;
}

export interface SpamCheckResult {
  allowed: boolean;
  code:
    | "OK"
    | "HONEYPOT_TRIGGERED"
    | "TOO_FAST_BOT"
    | "OUT_OF_ATLANTICO_JURISDICTION"
    | "SPAM_OR_GIBBERISH_TEXT"
    | "DUPLICATE_PHOTO_RECENT"
    | "RATE_LIMIT_BURST";
  httpStatus: number;
  reason: string;
}

// Coordenadas reales del departamento del Atlántico (margen amplio seguro para toda la costa + ciénagas)
const ATLANTICO_BOUNDS = {
  minLat: 10.2,
  maxLat: 11.3,
  minLon: -75.6,
  maxLon: -74.5,
};

const SPAM_PATTERNS: RegExp[] = [
  /https?:\/\/|www\.|bit\.ly|t\.me\/|wa\.me\//i,
  /(.)\1{6,}/i, // aaaaaaa / xxxxxxx
  /\b(viagra|casino|crypto|bitcoin|free money|gana dinero|porno|xxx)\b/i,
  /\b(hijueputa|malparido|gonorrea|pirobo|careverga|marica|puta|mierda)\b/i,
];

// Memoria de hashes recientes (30 min) + ventana de deduplicación de correos urgentes (15 min)
const recentPhotoHashes = new Map<string, number>();
const recentUrgentSectorEmails = new Map<string, number>();

export function computeBufferSha256(buf: Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function pruneExpired(map: Map<string, number>, now: number) {
  for (const [k, exp] of map.entries()) {
    if (now >= exp) map.delete(k);
  }
}

export function isGibberishOrSpamText(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  for (const rx of SPAM_PATTERNS) {
    if (rx.test(clean)) return true;
  }
  // Detectar teclazos aleatorios largos sin vocales ("bcdfghjklmnpqrst")
  const tokens = clean.split(/\s+/);
  for (const tok of tokens) {
    const letters = tok.replace(/[^a-záéíóúñ]/gi, "");
    if (letters.length >= 10 && !/[aeiouáéíóú]/i.test(letters)) {
      return true;
    }
  }
  return false;
}

export function isWithinAtlanticoJurisdiction(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= ATLANTICO_BOUNDS.minLat &&
    lat <= ATLANTICO_BOUNDS.maxLat &&
    lon >= ATLANTICO_BOUNDS.minLon &&
    lon <= ATLANTICO_BOUNDS.maxLon
  );
}

/**
 * Escudo anti-spam de 6 capas (SRP): detiene bots, ráfagas, fotos repetidas,
 * coordenadas fuera del Atlántico y texto troll/phishing antes de tocar DB o SMTP.
 */
export function evaluateReportAntiSpam(input: SpamEvaluationInput): SpamCheckResult {
  const now = Date.now();
  pruneExpired(recentPhotoHashes, now);

  // Capa 1A: Honeypot invisible (solo bots llenan este campo)
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return {
      allowed: false,
      code: "HONEYPOT_TRIGGERED",
      httpStatus: 422,
      reason: "Envío automatizado bloqueado por verificación antispam.",
    };
  }

  // Capa 1B: Tiempo mínimo humano de diligenciamiento (>= 2.5 segundos)
  if (
    typeof input.formDurationMs === "number" &&
    Number.isFinite(input.formDurationMs) &&
    input.formDurationMs >= 0 &&
    input.formDurationMs < 2500
  ) {
    return {
      allowed: false,
      code: "TOO_FAST_BOT",
      httpStatus: 422,
      reason: "Envío demasiado rápido para captura real en campo. Verifica tus datos e intenta de nuevo.",
    };
  }

  // Capa 2: Jurisdicción geográfica Atlántico (bloquea reportes desde otras regiones/países)
  if (!isWithinAtlanticoJurisdiction(input.lat, input.lon)) {
    return {
      allowed: false,
      code: "OUT_OF_ATLANTICO_JURISDICTION",
      httpStatus: 400,
      reason:
        "Las coordenadas están fuera de la jurisdicción costera del Atlántico (CRA). Verifica tu GPS.",
    };
  }

  // Capa 3: Filtro de texto troll, insultos, links phishing o teclazos sin sentido
  if (input.description && isGibberishOrSpamText(input.description)) {
    return {
      allowed: false,
      code: "SPAM_OR_GIBBERISH_TEXT",
      httpStatus: 422,
      reason:
        "El texto contiene enlaces externos, repeticiones o lenguaje no permitido para reportes ambientales.",
    };
  }

  // Capa 4: Ráfaga por IP / huella de dispositivo (máx 4 reportes / 10 min)
  if (!input.bypassRateLimit) {
    const actorKey = `rep:${input.ip}:${input.fingerprint || "anon"}`;
    const rl = checkRateLimit({
      key: actorKey,
      maxRequests: 4,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.allowed) {
      return {
        allowed: false,
        code: "RATE_LIMIT_BURST",
        httpStatus: 429,
        reason: `Demasiados reportes seguidos desde este dispositivo. Espera ${rl.retryAfterSec}s para enviar otro.`,
      };
    }
  }

  // Capa 5: Deduplicación criptográfica de fotos idénticas (SHA-256 en ventana de 30 min)
  const hashes = (input.photoHashes || []).filter(Boolean);
  for (const h of hashes) {
    const exp = recentPhotoHashes.get(h);
    if (exp && now < exp) {
      return {
        allowed: false,
        code: "DUPLICATE_PHOTO_RECENT",
        httpStatus: 409,
        reason:
          "Esta misma fotografía ya fue enviada recientemente. Toma una foto nueva desde otro ángulo para corroborar.",
      };
    }
  }

  // Registrar hashes aceptados
  for (const h of hashes) {
    recentPhotoHashes.set(h, now + 30 * 60 * 1000);
  }

  return {
    allowed: true,
    code: "OK",
    httpStatus: 200,
    reason: "Reporte válido.",
  };
}

/**
 * Capa 6: Anti-bombardeo de correos urgentes (deduplicación 15 min por sector + tipo).
 * Si varios vecinos reportan el mismo incendio, se registra corroboración en BD sin spamear 20 correos.
 */
export function checkUrgentEmailCooldown(params: {
  sectorId: number;
  tipoEvento: string;
  cooldownMs?: number;
}): { shouldSend: boolean; remainingSec: number } {
  const now = Date.now();
  pruneExpired(recentUrgentSectorEmails, now);

  const key = `sector:${params.sectorId}:${params.tipoEvento}`;
  const exp = recentUrgentSectorEmails.get(key);
  if (exp && now < exp) {
    return {
      shouldSend: false,
      remainingSec: Math.max(1, Math.ceil((exp - now) / 1000)),
    };
  }

  recentUrgentSectorEmails.set(key, now + (params.cooldownMs ?? 15 * 60 * 1000));
  return { shouldSend: true, remainingSec: 0 };
}

export function resetAntiSpamMemoryForTests() {
  recentPhotoHashes.clear();
  recentUrgentSectorEmails.clear();
}
