import type { Context } from "elysia";

interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(limit = 60, windowMs = 60_000) {
  return async ({ request, set }: Context) => {
    const ip =
      (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ||
      (request as any).ip ||
      "unknown";
    const key = `${ip}:${new URL(request.url).pathname}`;
    const now = Date.now();
    const b = buckets.get(key);

    if (!b || now > b.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return;
    }

    if (b.count >= limit) {
      const retry = Math.max(0, b.reset - now);
      set.status = 429;
      set.headers["Retry-After"] = Math.ceil(retry / 1000).toString();
      return "Terlalu banyak permintaan. Coba lagi nanti.";
    }

    b.count++;
  };
}
