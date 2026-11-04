import "server-only";
import Redis from "ioredis";

/**
 * Redis for leaderboards (Upstash works: use its "rediss://" URL). REDIS_URL unset = leaderboards are
 * answered straight from PostgreSQL (slower, same numbers), so nothing breaks without Redis.
 */
export const isRedisConfigured = () => !!process.env.REDIS_URL;

const g = globalThis as unknown as {
  __foodlinkRedis?: { url: string; client: Redis };
};

export function redis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  if (g.__foodlinkRedis?.url !== url) {
    g.__foodlinkRedis?.client.disconnect();
    const client = new Redis(url, {
      // Commands wait for the first connection, then fail fast if Redis is unreachable.
      maxRetriesPerRequest: 2,
      connectTimeout: 4000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    client.on("error", () => {}); // errors surface on each command; avoid unhandled 'error' events
    g.__foodlinkRedis = { url, client };
  }
  return g.__foodlinkRedis.client;
}
