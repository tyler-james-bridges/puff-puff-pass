const SCORE_WEIGHTS = {
  totalPasses: 10,
  longestStreak: 3,
  firstTakes: 5
};

export function scoreFromStats(stats) {
  return (
    stats.totalPasses * SCORE_WEIGHTS.totalPasses +
    stats.longestStreak * SCORE_WEIGHTS.longestStreak +
    stats.firstTakes * SCORE_WEIGHTS.firstTakes
  );
}

export function buildRankedRows(statsMap) {
  const rows = [...statsMap.values()].map((stats) => ({
    handle: stats.handle,
    score: scoreFromStats(stats),
    totalPasses: stats.totalPasses,
    longestStreak: stats.longestStreak,
    firstTakes: stats.firstTakes,
    lastPassAt: stats.lastPassAt
  }));

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = new Date(a.lastPassAt).getTime();
    const bTime = new Date(b.lastPassAt).getTime();
    return bTime - aTime;
  });

  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

export function findRank(rankedRows, handle) {
  const row = rankedRows.find((item) => item.handle === handle);
  return row ? row.rank : null;
}

