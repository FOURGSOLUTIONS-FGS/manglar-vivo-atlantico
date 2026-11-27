interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Limitador de tasa ligero por ventana deslizante (protección contra abuso de SMTP e IA).
 */
export function checkRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, params.maxRequests - 1),
      retryAfterSec: 0,
    };
  }

  if (existing.count >= params.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.maxRequests - existing.count),
    retryAfterSec: 0,
  };
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}
