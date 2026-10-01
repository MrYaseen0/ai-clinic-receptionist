import type { NextRequest } from "next/server";

/**
 * In-memory sliding-window rate limiter (per key, usually per IP).
 * Note: on serverless this is per-instance — good enough for a demo,
 * pair with a platform edge limiter for hard production guarantees.
 */

const windows = new Map<string, number[]>();
const MAX_KEYS = 5000;

function prune(key: string, now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  let arr = windows.get(key);
  if (!arr) {
    arr = [];
    windows.set(key, arr);
    return arr;
  }
  while (arr.length > 0 && arr[0] <= cutoff) arr.shift();
  return arr;
}

/** Returns true when the request should be rejected (limit exceeded). */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const arr = prune(key, now, windowMs);
  if (arr.length >= limit) return true;
  arr.push(now);
  // Bound memory: drop the oldest key when the map grows too large.
  if (windows.size > MAX_KEYS) {
    const oldest = windows.keys().next().value;
    if (oldest) windows.delete(oldest);
  }
  return false;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "unknown";
}
