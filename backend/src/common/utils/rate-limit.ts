/**
 * Per-route request limits (per client IP, per minute). RATE_LIMIT_MULTIPLIER exists only so the
 * automated test-suite can run many requests quickly; leave it unset in real deployments.
 */
const m = () => Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);
export const perMinute = (n: number) => ({ default: { limit: n * m(), ttl: 60_000 } });
