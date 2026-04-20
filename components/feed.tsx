"use client";

import { explorerUrl, shortHash, type FeedItem } from "@/lib/client/api";

type Props = {
  items: FeedItem[];
  network: string | null;
};

export function Feed({ items, network }: Props) {
  return (
    <section className="feed-section">
      <div className="feed-inner">
        <div className="feed-title">recent activity</div>
        <ul className="feed-list">
          {items.length === 0 ? (
            <li className="lb-empty">no activity yet.</li>
          ) : (
            items.slice(0, 10).map((item) => {
              const url = explorerUrl(network, item.txHash);
              const t = new Date(item.createdAt);
              const timeStr = t.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const txEl = item.txHash
                ? item.txHash === "pending"
                  ? <span className="feed-tx">tx pending</span>
                  : url
                    ? <a className="feed-tx" href={url} target="_blank" rel="noopener">{shortHash(item.txHash)}</a>
                    : <span className="feed-tx">{shortHash(item.txHash)}</span>
                : null;
              return (
                <li key={item.id} className="feed-item">
                  <div>
                    <div className="feed-handle">
                      <span className="at">@</span>{item.handle}
                    </div>
                    <div className="feed-detail">
                      {item.gainLine || item.status || "pass logged"}
                    </div>
                  </div>
                  <div className="feed-right">
                    <span className="feed-time">{timeStr}</span>
                    {txEl}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}
