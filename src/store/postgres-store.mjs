import { buildRankedRows, findRank } from "../core/leaderboard.mjs";
import { buildCultureLines } from "../core/culture.mjs";
import { computeBadges } from "../core/badges.mjs";

const SCHEMA_SQL = `
create table if not exists passes (
  id text primary key,
  handle text not null,
  message text,
  amount_usd numeric(10, 6) not null,
  tx_hash text,
  payment_signature text not null,
  displaced_handle text,
  rank_after integer not null,
  status text not null,
  vibe_tag text not null,
  gain_line text not null,
  loss_line text,
  created_at timestamptz not null default now()
);
create index if not exists passes_created_at_idx on passes (created_at desc);
create index if not exists passes_handle_idx on passes (handle);
create table if not exists holder_state (
  id integer primary key,
  current_handle text,
  total_passes integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into holder_state (id, current_handle, total_passes)
values (1, null, 0)
on conflict (id) do nothing;
create table if not exists leaderboard_stats (
  handle text primary key,
  total_passes integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  first_takes integer not null default 0,
  has_taken_before boolean not null default false,
  last_pass_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
`;

function toNumber(value, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return fallback;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "t" || value === "1";
  if (typeof value === "number") return value > 0;
  return false;
}

function toIso(value) {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeStatsRow(row) {
  return {
    handle: row.handle,
    totalPasses: toNumber(row.total_passes),
    currentStreak: toNumber(row.current_streak),
    longestStreak: toNumber(row.longest_streak),
    firstTakes: toNumber(row.first_takes),
    hasTakenBefore: toBoolean(row.has_taken_before),
    lastPassAt: toIso(row.last_pass_at)
  };
}

function mapStatsRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const stats = normalizeStatsRow(row);
    map.set(stats.handle, stats);
  }
  return map;
}

export class PostgresStore {
  constructor(db) {
    this.db = db;
  }

  async init() {
    const statements = SCHEMA_SQL
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await this.db.query(`${statement};`);
    }
  }

  async close() {
    if (typeof this.db.close === "function") {
      await this.db.close();
    }
  }

  async ensureStats(client, handle, nowIso) {
    await client.query(
      `insert into leaderboard_stats (
        handle,
        total_passes,
        current_streak,
        longest_streak,
        first_takes,
        has_taken_before,
        last_pass_at,
        updated_at
      )
      values ($1, 0, 0, 0, 0, false, $2::timestamptz, $2::timestamptz)
      on conflict (handle) do nothing`,
      [handle, nowIso]
    );
  }

  async getCurrent() {
    const { rows } = await this.db.query(
      "select current_handle, total_passes, updated_at from holder_state where id = 1"
    );

    if (!rows.length) {
      return {
        currentHolder: null,
        totalPasses: 0,
        currentSince: null
      };
    }

    return {
      currentHolder: rows[0].current_handle,
      totalPasses: toNumber(rows[0].total_passes),
      currentSince: toIso(rows[0].updated_at)
    };
  }

  async getFeed(limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const { rows } = await this.db.query(
      `select
        id,
        handle,
        message,
        amount_usd,
        tx_hash,
        payment_signature,
        displaced_handle,
        rank_after,
        status,
        vibe_tag,
        gain_line,
        loss_line,
        created_at
      from passes
      order by created_at desc
      limit $1`,
      [safeLimit]
    );

    return rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      message: row.message,
      amountUsd: String(row.amount_usd),
      txHash: row.tx_hash,
      paymentSignature: row.payment_signature,
      displacedHandle: row.displaced_handle,
      rankAfter: toNumber(row.rank_after),
      status: row.status,
      vibeTag: row.vibe_tag,
      gainLine: row.gain_line,
      lossLine: row.loss_line,
      createdAt: toIso(row.created_at)
    }));
  }

  async getTimeHeld() {
    // Calculate total hold time per handle from pass history
    const { rows } = await this.db.query(
      `select handle, created_at from passes order by created_at asc`
    );

    const holdTimes = new Map(); // handle -> total ms held
    const now = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const holder = rows[i].handle;
      const startTime = new Date(rows[i].created_at).getTime();
      const endTime = i + 1 < rows.length
        ? new Date(rows[i + 1].created_at).getTime()
        : now; // current holder gets time until now

      const duration = endTime - startTime;
      holdTimes.set(holder, (holdTimes.get(holder) || 0) + duration);
    }

    return holdTimes;
  }

  async getTotalSpent() {
    // Sum actual amount_usd per handle from passes table
    const { rows } = await this.db.query(
      `select handle, sum(amount_usd) as total_spent from passes group by handle`
    );

    const spentMap = new Map();
    for (const row of rows) {
      spentMap.set(row.handle, parseFloat(row.total_spent) || 0);
    }
    return spentMap;
  }

  async getLeaderboard() {
    const { rows } = await this.db.query("select * from leaderboard_stats");
    const statsMap = mapStatsRows(rows);
    const ranked = buildRankedRows(statsMap);
    const holdTimes = await this.getTimeHeld();
    const spentMap = await this.getTotalSpent();

    return ranked.map((row) => ({
      ...row,
      timeHeldMs: holdTimes.get(row.handle) || 0,
      totalSpentUsd: spentMap.get(row.handle) || 0,
      badges: computeBadges({
        totalPasses: row.totalPasses,
        currentStreak: statsMap.get(row.handle)?.currentStreak ?? 0,
        longestStreak: row.longestStreak,
        rank: row.rank
      })
    }));
  }

  async getHandleStats(handle) {
    const { rows } = await this.db.query("select * from leaderboard_stats where handle = $1", [handle]);
    if (!rows.length) return null;

    const base = normalizeStatsRow(rows[0]);
    const allRows = await this.db.query("select * from leaderboard_stats");
    const ranked = buildRankedRows(mapStatsRows(allRows.rows));
    const rank = findRank(ranked, handle);

    return {
      ...base,
      rank,
      badges: computeBadges({
        totalPasses: base.totalPasses,
        currentStreak: base.currentStreak,
        longestStreak: base.longestStreak,
        rank
      })
    };
  }

  async applyPass({ handle, amountUsd, txHash, paymentSignature, message = null }) {
    await this.db.query("begin");
    try {
      const nowIso = new Date().toISOString();

      const holderResult = await this.db.query(
        "select current_handle, total_passes from holder_state where id = 1 for update"
      );

      if (!holderResult.rows.length) {
        await this.db.query(
          "insert into holder_state (id, current_handle, total_passes, updated_at) values (1, null, 0, now())"
        );
      }

      const previousHolder = holderResult.rows[0]?.current_handle ?? null;

      await this.ensureStats(this.db, handle, nowIso);
      if (previousHolder && previousHolder !== handle) {
        await this.ensureStats(this.db, previousHolder, nowIso);
        await this.db.query(
          "update leaderboard_stats set current_streak = 0, updated_at = $2::timestamptz where handle = $1",
          [previousHolder, nowIso]
        );
      }

      const winnerResult = await this.db.query(
        "select * from leaderboard_stats where handle = $1 for update",
        [handle]
      );
      const winner = normalizeStatsRow(winnerResult.rows[0]);

      const nextTotalPasses = winner.totalPasses + 1;
      const nextCurrentStreak = previousHolder === handle ? winner.currentStreak + 1 : 1;
      const nextLongestStreak = Math.max(winner.longestStreak, nextCurrentStreak);
      const nextFirstTakes = previousHolder !== handle && !winner.hasTakenBefore ? winner.firstTakes + 1 : winner.firstTakes;
      const nextHasTakenBefore = winner.hasTakenBefore || previousHolder !== handle;

      await this.db.query(
        `update leaderboard_stats
        set
          total_passes = $2,
          current_streak = $3,
          longest_streak = $4,
          first_takes = $5,
          has_taken_before = $6,
          last_pass_at = $7::timestamptz,
          updated_at = $7::timestamptz
        where handle = $1`,
        [
          handle,
          nextTotalPasses,
          nextCurrentStreak,
          nextLongestStreak,
          nextFirstTakes,
          nextHasTakenBefore,
          nowIso
        ]
      );

      await this.db.query(
        `update holder_state
        set
          current_handle = $1,
          total_passes = total_passes + 1,
          updated_at = $2::timestamptz
        where id = 1`,
        [handle, nowIso]
      );

      const allStatsRows = await this.db.query("select * from leaderboard_stats");
      const rankedRows = buildRankedRows(mapStatsRows(allStatsRows.rows));
      const winnerRank = findRank(rankedRows, handle);
      const loserRank = previousHolder ? findRank(rankedRows, previousHolder) : null;

      const id = `pass_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      const culture = buildCultureLines({
        winnerHandle: handle,
        winnerRank,
        loserHandle: previousHolder,
        loserRank,
        seed: id
      });

      const event = {
        id,
        handle,
        message,
        amountUsd,
        txHash,
        paymentSignature,
        createdAt: nowIso,
        displacedHandle: previousHolder,
        rankAfter: winnerRank,
        status:
          previousHolder === null
            ? "new_holder"
            : previousHolder === handle
              ? "defended"
              : "displaced_someone",
        vibeTag: culture.vibeTag,
        gainLine: culture.gainLine,
        lossLine: culture.lossLine
      };

      await this.db.query(
        `insert into passes (
          id,
          handle,
          message,
          amount_usd,
          tx_hash,
          payment_signature,
          displaced_handle,
          rank_after,
          status,
          vibe_tag,
          gain_line,
          loss_line,
          created_at
        )
        values ($1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)`,
        [
          event.id,
          event.handle,
          event.message,
          event.amountUsd,
          event.txHash,
          event.paymentSignature,
          event.displacedHandle,
          event.rankAfter,
          event.status,
          event.vibeTag,
          event.gainLine,
          event.lossLine,
          event.createdAt
        ]
      );

      await this.db.query("commit");
      return {
        event,
        leaderboard: rankedRows
      };
    } catch (error) {
      await this.db.query("rollback");
      throw error;
    }
  }

  async backfillLatestPendingTxHash(handle, txHash) {
    if (!handle || !txHash || txHash === "pending") return null;

    const target = await this.db.query(
      `select id
      from passes
      where handle = $1
        and (tx_hash is null or tx_hash = 'pending')
      order by created_at desc
      limit 1`,
      [handle]
    );

    const targetId = target.rows[0]?.id;
    if (!targetId) return null;

    const { rows } = await this.db.query(
      `update passes
      set tx_hash = $2
      where id = $1
      returning id`,
      [targetId, txHash]
    );

    return rows[0]?.id ?? null;
  }
}
