import { buildRankedRows, findRank } from "../core/leaderboard.mjs";
import { buildCultureLines } from "../core/culture.mjs";

export class MemoryStore {
  constructor() {
    this.passes = [];
    this.stats = new Map();
    this.currentHolder = null;
  }

  ensureStats(handle) {
    if (!this.stats.has(handle)) {
      this.stats.set(handle, {
        handle,
        totalPasses: 0,
        currentStreak: 0,
        longestStreak: 0,
        firstTakes: 0,
        hasTakenBefore: false,
        lastPassAt: new Date(0).toISOString()
      });
    }
    return this.stats.get(handle);
  }

  applyPass({ handle, amountUsd, txHash, paymentSignature, message = null }) {
    const previousHolder = this.currentHolder;
    const winnerStats = this.ensureStats(handle);

    if (previousHolder && previousHolder !== handle) {
      const previousStats = this.ensureStats(previousHolder);
      previousStats.currentStreak = 0;
    }

    winnerStats.totalPasses += 1;
    winnerStats.currentStreak = previousHolder === handle ? winnerStats.currentStreak + 1 : 1;
    winnerStats.longestStreak = Math.max(winnerStats.longestStreak, winnerStats.currentStreak);
    winnerStats.lastPassAt = new Date().toISOString();

    if (previousHolder !== handle && !winnerStats.hasTakenBefore) {
      winnerStats.firstTakes += 1;
      winnerStats.hasTakenBefore = true;
    }

    this.currentHolder = handle;

    const rankedRows = buildRankedRows(this.stats);
    const winnerRank = findRank(rankedRows, handle);
    const loserRank = previousHolder ? findRank(rankedRows, previousHolder) : null;

    const id = `pass_${Date.now()}_${this.passes.length + 1}`;
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
      createdAt: new Date().toISOString(),
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

    this.passes.unshift(event);

    return {
      event,
      leaderboard: rankedRows
    };
  }

  getCurrent() {
    return {
      currentHolder: this.currentHolder,
      totalPasses: this.passes.length
    };
  }

  getFeed(limit = 50) {
    return this.passes.slice(0, limit);
  }

  getLeaderboard() {
    return buildRankedRows(this.stats);
  }
}

