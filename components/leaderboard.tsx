"use client";

import { useMemo, useState } from "react";
import { avatarUrl, type LeaderboardItem } from "@/lib/client/api";

type Props = {
  items: LeaderboardItem[];
};

function formatDuration(ms: number): string {
  if (ms < 1000) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatUsd(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(6)}`;
}

export function Leaderboard({ items }: Props) {
  const [mode, setMode] = useState<"time" | "spent">("time");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) =>
      mode === "spent"
        ? (b.totalSpentUsd || 0) - (a.totalSpentUsd || 0)
        : (b.timeHeldMs || 0) - (a.timeHeldMs || 0)
    );
  }, [items, mode]);

  return (
    <div className="hero-right" id="leaderboard">
      <div className="lb-panel">
        <div className="lb-head">
          <span className="lb-title">Leaderboard</span>
          <div className="lb-toggle">
            <button
              className={mode === "time" ? "active" : ""}
              onClick={() => setMode("time")}
              type="button"
            >
              Time
            </button>
            <button
              className={mode === "spent" ? "active" : ""}
              onClick={() => setMode("spent")}
              type="button"
            >
              Spent
            </button>
          </div>
        </div>
        <ul className="lb-list">
          {sorted.length === 0 ? (
            <li className="lb-empty">no one on the board yet.</li>
          ) : (
            sorted.slice(0, 10).map((row, i) => {
              const metric =
                mode === "spent"
                  ? formatUsd(row.totalSpentUsd || 0)
                  : formatDuration(row.timeHeldMs || 0);
              const secondary =
                mode === "spent"
                  ? formatDuration(row.timeHeldMs || 0)
                  : formatUsd(row.totalSpentUsd || 0);
              const rankLabel = i === 0 ? "\u2605" : `#${i + 1}`;
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
