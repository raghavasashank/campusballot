type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// A key whose bucket has already expired self-heals the next time that same
// key is checked (see the resetAt <= now branch below) — but a key that's
// only ever requested once leaves its expired entry sitting in the Map
// forever. Sweep periodically so a long-running process doesn't accumulate
// one entry per distinct email ever seen.
const SWEEP_EVERY_N_CALLS = 500;
let callsSinceSweep = 0;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// Fixed-window in-memory limiter — no Redis needed for a single-process v1
// deployment. ponytail: swap for a shared store (Redis/Upstash) once this
// runs across multiple instances, since this Map is per-process.
//
// Race-safety note: this function has no `await` in it, so a single call
// always runs to completion before the event loop can interleave another —
// concurrent callers can never both read the same pre-increment count.
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_EVERY_N_CALLS) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

// Test-only visibility into the Map's size, so the eviction sweep is
// verifiable without reaching into module internals.
export function _bucketCount(): number {
  return buckets.size;
}
