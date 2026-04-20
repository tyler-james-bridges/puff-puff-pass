"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/topbar";
import { AmbientSmoke } from "@/components/ambient-smoke";
import { HolderCard } from "@/components/holder-card";
import { PassForm } from "@/components/pass-form";
import { Leaderboard } from "@/components/leaderboard";
import { Feed } from "@/components/feed";
import type {
  CurrentJoint,
  FeedItem,
  HealthInfo,
  LeaderboardItem,
} from "@/lib/client/api";

const RIGS = [
  "raw cone",
  "backwood",
  "glass piece",
  "hemp wrap",
  "king palm",
  "sherlock",
  "chillum",
  "steamroller",
  "gravity bong",
  "one-hitter",
];
const STRAINS = [
  "og kush",
  "blue dream",
  "girl scout cookies",
  "sour diesel",
  "gelato",
  "wedding cake",
  "purple haze",
  "gorilla glue",
  "northern lights",
  "pineapple express",
];

function seededPick<T>(arr: T[], seed: string): T {
  const hash = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return arr[hash % arr.length];
}

export default function Home() {
  const [current, setCurrent] = useState<CurrentJoint | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const holder = current?.currentHolder || "nobody";
  const rig = seededPick(RIGS, holder + "-rig");
  const strain = seededPick(STRAINS, holder + "-strain");

  const refresh = useCallback(async () => {
    try {
      const [curRes, lbRes, feedRes] = await Promise.all([
        fetch("/api/joint/current"),
        fetch("/api/leaderboard"),
        fetch("/api/feed?limit=10"),
      ]);
      if (curRes.ok) setCurrent(await curRes.json());
      if (lbRes.ok) {
        const data = await lbRes.json();
        setLeaderboard(data.items || []);
      }
      if (feedRes.ok) {
        const data = await feedRes.json();
        setFeed(data.items || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const network = health?.x402?.networks?.[0] || null;

  return (
    <>
      <AmbientSmoke />
      <TopBar />
      <div className="wrap">
        <div className="hero">
          <div className="hero-left">
            <HolderCard current={current} rig={rig} strain={strain} />
            <PassForm onSuccess={refresh} />
          </div>
          <Leaderboard items={leaderboard} />
        </div>
        <Feed items={feed} network={network} />
        <section className="how-section">
          <div className="how-inner">
            <div className="how-title">how to get on the leaderboard</div>
            <ol className="how-list">
              <li>
                <span className="how-num">1</span>
                <div>
                  <strong>Connect your wallet</strong>
                  <p>Base or Abstract. You need a tiny bit of USDC.</p>
                </div>
              </li>
              <li>
                <span className="how-num">2</span>
                <div>
                  <strong>Enter your handle</strong>
                  <p>This is your identity on the board.</p>
                </div>
              </li>
              <li>
                <span className="how-num">3</span>
                <div>
                  <strong>Pass the joint</strong>
                  <p>
                    $0.00402 per pass via{" "}
                    <a
                      href="https://x402.org"
                      target="_blank"
                      rel="noopener"
                      className="x402-link"
                    >
                      <span style={{ color: "var(--text-mid)" }}>x</span>402
                    </a>
                    . Hold it as long as you can.
                  </p>
                </div>
              </li>
              <li>
                <span className="how-num">4</span>
                <div>
                  <strong>Climb the board</strong>
                  <p>Score is based on passes, streaks, and hold time.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <footer className="site-footer">
          <span className="footer-powered">
            powered by{" "}
            <a
              href="https://x402.org"
              target="_blank"
              rel="noopener"
              className="x402-link"
            >
              <span style={{ color: "var(--text-mid)" }}>x</span>402
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
