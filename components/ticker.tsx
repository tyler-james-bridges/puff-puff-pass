"use client";

import type { FeedItem } from "@/lib/client/api";

type Props = {
  items: FeedItem[];
};

function stripRank(line: string): string {
  return line
    .replace(/\s+(at|to|and (claimed|landed at|entered))\s+#\d+/gi, "")
    .replace(/,?\s*now (sitting )?at #\d+/gi, "")
    .replace(/\s+#\d+$/g, "")
    .trim();
}

export function Ticker({ items }: Props) {
  if (items.length === 0) return null;

  // Show last 3 recent entries, static
  const entries = items.slice(0, 3).map((item) => {
    const line = stripRank(item.gainLine || item.status || "pass logged");
    return `@${item.handle} ${line}`;
  });

  return (
    <div className="ticker-bar">
      <span className="ticker-content">{entries.join("  ·  ")}</span>
    </div>
  );
}
