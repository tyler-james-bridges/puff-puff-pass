export function computeBadges({
  totalPasses,
  currentStreak,
  longestStreak,
  rank,
  reclaimedWithinOneHour = false
}) {
  const badges = [];

  if (totalPasses >= 1) badges.push("spark-starter");
  if (currentStreak >= 3 || longestStreak >= 3) badges.push("rotation-runner");
  if (typeof rank === "number" && rank > 0 && rank <= 3) badges.push("chief-mode");
  if (totalPasses >= 10) badges.push("hotbox-legend");
  if (reclaimedWithinOneHour) badges.push("ashed-and-back");

  return badges;
}

