import { GAIN_LINES, LOSS_LINES, VIBE_TAGS } from "../config/culture-lines.mjs";

export function selectBySeed(items, seedText) {
  if (!items.length) return null;
  const seed = [...seedText].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return items[seed % items.length];
}

export function fillTemplate(template, data) {
  return template
    .replaceAll("{handle}", data.handle)
    .replaceAll("{rank}", String(data.rank));
}

export function buildCultureLines({
  winnerHandle,
  winnerRank,
  loserHandle,
  loserRank,
  seed
}) {
  const gainTemplate = selectBySeed(GAIN_LINES, `${seed}-gain`);
  const gainLine = fillTemplate(gainTemplate, {
    handle: winnerHandle,
    rank: winnerRank
  });

  const lossLine =
    loserHandle && loserRank
      ? fillTemplate(selectBySeed(LOSS_LINES, `${seed}-loss`), {
          handle: loserHandle,
          rank: loserRank
        })
      : null;

  const vibeTag = selectBySeed(VIBE_TAGS, `${seed}-vibe`);

  return {
    gainLine,
    lossLine,
    vibeTag
  };
}

