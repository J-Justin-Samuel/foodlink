import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isRedisConfigured, redis } from "@/lib/redis";
import {
  KEY_TTL_SECONDS,
  leaderboardKey,
  periodStart,
  PERIODS,
  type Period,
} from "@/lib/reward-points";

/*
 * Volunteer leaderboards on Redis sorted sets: one set per IST day, per IST month, and all-time.
 *   write: ZINCRBY (inside a Lua script that also skips a ledger row it has already counted)
 *   read:  ZREVRANGEBYSCORE for the top N, ZREVRANK + ZSCORE for "your rank"
 * The PostgreSQL reward_ledger is the truth. Redis is rebuilt from it when it is empty and every
 * hour, so a lost write, a flush or a Redis outage can never leave wrong rankings for long.
 * Without REDIS_URL (or if Redis is down) the same board is computed from PostgreSQL.
 */
export interface RewardEntry {
  id: string;
  userId: string;
  points: number;
  at: Date;
}

export interface BoardRow {
  rank: number;
  userId: string;
  name: string;
  points: number;
}
export interface Board {
  period: Period;
  source: "redis" | "database";
  top: BoardRow[];
  me: null | { rank: number; points: number };
}

const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];
const log = (...a: unknown[]) => console.error("[leaderboard]", ...a);

const INCR_ONCE = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 604800) == false then return 0 end
redis.call('ZINCRBY', KEYS[2], ARGV[1], ARGV[2]); if tonumber(ARGV[3]) > 0 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
redis.call('ZINCRBY', KEYS[3], ARGV[1], ARGV[2]); if tonumber(ARGV[4]) > 0 then redis.call('EXPIRE', KEYS[3], ARGV[4]) end
redis.call('ZINCRBY', KEYS[4], ARGV[1], ARGV[2])
return 1`;

/** Adds points to all three boards. Best effort: never throws (the ledger already has the points). */
export async function recordPoints(entries: RewardEntry[]): Promise<boolean> {
  if (!isRedisConfigured() || entries.length === 0) return false;
  try {
    const r = redis();
    for (const e of entries) {
      await r.eval(
        INCR_ONCE,
        4,
        `lb:seen:${e.id}`,
        leaderboardKey("day", e.at),
        leaderboardKey("month", e.at),
        leaderboardKey("all", e.at),
        String(e.points),
        e.userId,
        String(KEY_TTL_SECONDS.day),
        String(KEY_TTL_SECONDS.month),
      );
    }
    return true;
  } catch (err) {
    log("redis write failed; the hourly rebuild will repair it", err);
    return false;
  }
}

async function totals(
  period: Period,
  now: Date,
): Promise<{ user_id: string; points: number }[]> {
  const start = periodStart(period, now);
  return rows(sql`
    SELECT l.user_id, SUM(l.points)::int AS points
    FROM reward_ledger l JOIN users u ON u.id = l.user_id AND u.role = 'VOLUNTEER'
    WHERE ${start ? sql`l.created_at >= ${start.toISOString()}::timestamptz` : sql`true`}
    GROUP BY l.user_id HAVING SUM(l.points) > 0
  `);
}

/** Rebuilds the current day, month and all-time sets from the ledger. Returns how many volunteers are ranked all-time. */
export async function rebuildLeaderboards(now = new Date()): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const r = redis();
  let allCount = 0;
  for (const period of PERIODS) {
    const data = await totals(period, now);
    if (period === "all") allCount = data.length;
    const key = leaderboardKey(period, now);
    const tmp = `${key}:rebuild:${process.pid}`;
    const pipe = r.multi().del(tmp);
    for (const d of data) pipe.zadd(tmp, d.points, d.user_id);
    if (data.length > 0) {
      pipe.rename(tmp, key);
      const ttl = KEY_TTL_SECONDS[period];
      if (ttl) pipe.expire(key, ttl);
    } else {
      pipe.del(key);
    }
    await pipe.exec();
  }
  // Rows written in the last few minutes may still have an increment on its way: mark them counted.
  const recent = await rows<{ id: string }>(
    sql`SELECT id FROM reward_ledger WHERE created_at > now() - interval '15 minutes'`,
  );
  if (recent.length) {
    const p = r.multi();
    for (const x of recent) p.set(`lb:seen:${x.id}`, "1", "EX", 604800);
    await p.exec();
  }
  await r.set("lb:built", String(now.getTime()));
  return allCount;
}

async function names(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const list = await rows<{ user_id: string; name: string }>(sql`
    SELECT user_id, display_name AS name FROM profiles WHERE user_id IN (${sql.join(
      ids.map((i) => sql`${i}::uuid`),
      sql`, `,
    )})
  `);
  return new Map(list.map((x) => [x.user_id, x.name]));
}

async function fromDatabase(
  period: Period,
  limit: number,
  viewerId: string | null,
  now: Date,
): Promise<Board> {
  const all = (await totals(period, now)).sort(
    (a, b) => b.points - a.points || (a.user_id < b.user_id ? 1 : -1),
  );
  const nm = await names(all.slice(0, limit).map((x) => x.user_id));
  const idx = viewerId ? all.findIndex((x) => x.user_id === viewerId) : -1;
  return {
    period,
    source: "database",
    top: all
      .slice(0, limit)
      .map((x, i) => ({
        rank: i + 1,
        userId: x.user_id,
        name: nm.get(x.user_id) ?? "Volunteer",
        points: x.points,
      })),
    me: idx >= 0 ? { rank: idx + 1, points: all[idx].points } : null,
  };
}

export async function getLeaderboard(
  period: Period,
  limit = 10,
  viewerId: string | null = null,
  now = new Date(),
): Promise<Board> {
  if (!isRedisConfigured()) return fromDatabase(period, limit, viewerId, now);
  try {
    const r = redis();
    if (!(await r.exists("lb:built"))) await rebuildLeaderboards(now);
    const key = leaderboardKey(period, now);
    const flat = await r.zrevrangebyscore(
      key,
      "+inf",
      1,
      "WITHSCORES",
      "LIMIT",
      0,
      limit,
    );
    const ids: string[] = [],
      pts: number[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      ids.push(flat[i]);
      pts.push(Number(flat[i + 1]));
    }
    const nm = await names(ids);
    let me: Board["me"] = null;
    if (viewerId) {
      const [rank, score] = await Promise.all([
        r.zrevrank(key, viewerId),
        r.zscore(key, viewerId),
      ]);
      if (rank !== null && score !== null && Number(score) >= 1)
        me = { rank: rank + 1, points: Number(score) };
    }
    return {
      period,
      source: "redis",
      top: ids.map((id, i) => ({
        rank: i + 1,
        userId: id,
        name: nm.get(id) ?? "Volunteer",
        points: pts[i],
      })),
      me,
    };
  } catch (err) {
    log("redis read failed; using the database", err);
    return fromDatabase(period, limit, viewerId, now);
  }
}
