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

  const entries = items.slice(0, 10).map((item) => {
    const line = stripRank(item.gainLine || item.status || "pass logged");
    return `@${item.handle} ${line}`;
  });

  // Duplicate for seamless loop
  const text = entries.join("  ·  ") + "  ·  ";

  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        <span className="ticker-content">{text}</span>
        <span className="ticker-content" aria-hidden="true">{text}</span>
      </div>
    </div>
  );
}
