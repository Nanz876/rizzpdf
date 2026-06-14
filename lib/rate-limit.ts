// Lightweight in-memory rate limiter.
//
// This is per serverless-instance (NOT distributed across Vercel lambdas), so it
// stops rapid-fire abuse against a warm instance with zero external setup or cost.
// For production-grade, cross-instance limiting, back this with Upstash Redis
// (@upstash/ratelimit) — the call sites below would not need to change.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Sliding fixed-window limiter. Returns ok=false once `limit` requests have been
 * seen for `key` within `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** Build a rate-limit key from the caller's IP and a route scope. */
export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return `${scope}:${ip}`;
}

/** Standard 429 response with a Retry-After header. */
export function tooMany(retryAfter: number) {
  return Response.json(
    { error: "Too many requests. Slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
