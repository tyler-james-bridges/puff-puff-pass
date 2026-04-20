"use client";

import { useMemo, useState } from "react";
import { avatarUrl, type LeaderboardItem, type FeedItem } from "@/lib/client/api";

type Props = {
  items: LeaderboardItem[];
  feed: FeedItem[];
};

function stripRank(line: string): string {
  return line
    .replace(/\s+(at|to|and (claimed|landed at|entered))\s+#\d+/gi, "")
    .replace(/,?\s*now (sitting )?at #\d+/gi, "")
    .replace(/\s+#\d+$/g, "")
    .trim();
}

export function Leaderboard({ items, feed }: Props) {
  const [mode, setMode] = useState<"score" | "passes" | "activity">("score");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) =>
      mode === "passes"
        ? (b.totalPasses || 0) - (a.totalPasses || 0)
        : (b.score || 0) - (a.score || 0)
    );
  }, [items, mode]);

  return (
    <div className="hero-right" id="leaderboard">
      <div className="lb-panel">
        <div className="lb-head">
          <span className="lb-title">Leaderboard</span>
          <div className="lb-toggle">
            <button
              className={mode === "score" ? "active" : ""}
              onClick={() => setMode("score")}
              type="button"
            >
              Score
            </button>
            <button
              className={mode === "passes" ? "active" : ""}
              onClick={() => setMode("passes")}
              type="button"
            >
              Passes
            </button>
            <button
              className={mode === "activity" ? "active" : ""}
              onClick={() => setMode("activity")}
              type="button"
            >
              Activity
            </button>
          </div>
        </div>
        <ul className="lb-list">
          {mode === "activity" ? (
            feed.length === 0 ? (
              <li className="lb-empty">no activity yet.</li>
            ) : (
              feed.slice(0, 10).map((item) => {
                const t = new Date(item.createdAt);
                const timeStr = t.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={item.id} className="lb-row">
                    <span className="lb-avatar">
                      <div className="fb">{item.handle[0].toUpperCase()}</div>
                      <img
                        src={avatarUrl(item.handle)}
                        alt=""
                        loading="lazy"
                        onLoad={(e) => {
                          const prev = (e.currentTarget.previousElementSibling as HTMLElement);
                          if (prev) prev.style.display = "none";
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </span>
                    <span className="lb-handle" style={{ flex: 1 }}>
                      <span className="at">@</span>{item.handle}
                      <span className="lb-activity-line">{stripRank(item.gainLine || item.status || "pass")}</span>
                    </span>
                    <span className="lb-metric">{timeStr}</span>
                  </li>
                );
              })
            )
          ) : sorted.length === 0 ? (
            <li className="lb-empty">no one on the board yet.</li>
          ) : (
            sorted.slice(0, 10).map((row, i) => {
              const metric =
                mode === "passes"
                  ? `${row.totalPasses || 0} passes`
                  : `${row.score ?? 0} pts`;
              const secondary =
                mode === "passes"
                  ? `${row.score ?? 0} pts`
                  : `${row.totalPasses || 0} passes`;
              const rankLabel = i === 0 ? "★" : `#${i + 1}`;
              return (
                <li
                  key={row.handle}
                  className={"lb-row" + (i === 0 ? " is-first" : "")}
                >
                  <span className="lb-rank">{rankLabel}</span>
                  <span className="lb-avatar">
                    <div className="fb">{row.handle[0].toUpperCase()}</div>
                    <img
                      src={avatarUrl(row.handle)}
                      alt=""
                      loading="lazy"
                      onLoad={(e) => {
                        const prev = (e.currentTarget.previousElementSibling as HTMLElement);
                        if (prev) prev.style.display = "none";
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                  <span className="lb-handle">
                    <span className="at">@</span>
                    {row.handle}
                  </span>
                  <span className="lb-spent">{secondary}</span>
                  <span className="lb-metric">{metric}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
