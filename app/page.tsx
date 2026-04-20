"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/topbar";
import { AmbientSmoke } from "@/components/ambient-smoke";
import { HolderCard } from "@/components/holder-card";
import { PassForm } from "@/components/pass-form";
import { Leaderboard } from "@/components/leaderboard";
import type {
  CurrentJoint,
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


  const holder = current?.currentHolder || "nobody";
  const rig = seededPick(RIGS, holder + "-rig");
  const strain = seededPick(STRAINS, holder + "-strain");

  const refresh = useCallback(async () => {
    try {
      const [curRes, lbRes] = await Promise.all([
        fetch("/api/joint/current"),
        fetch("/api/leaderboard"),
      ]);
      if (curRes.ok) setCurrent(await curRes.json());
      if (lbRes.ok) {
        const data = await lbRes.json();
        setLeaderboard(data.items || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refresh();

    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);



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
        <section className="how-section">
          <div className="how-inner">
            <div className="how-title">how to get on the leaderboard</div>
            <div className="how-steps">
              <div className="how-step">
                <span className="how-num">1</span>
                <div className="how-step-body">
                  <div className="h">Connect your wallet</div>
                  <div className="p">Base or Abstract. You need a tiny bit of USDC.</div>
                </div>
              </div>
              <div className="how-step">
                <span className="how-num">2</span>
                <div className="how-step-body">
                  <div className="h">Enter your handle</div>
                  <div className="p">This is your identity on the board.</div>
                </div>
              </div>
              <div className="how-step">
                <span className="how-num">3</span>
                <div className="how-step-body">
                  <div className="h">Pass the joint</div>
                  <div className="p">
                    $0.00402 per pass via{" "}
                    <a href="https://x402.org" target="_blank" rel="noopener">
                      x402
                    </a>
                    . Hold it as long as you can.
                  </div>
                </div>
              </div>
              <div className="how-step">
                <span className="how-num">4</span>
                <div className="how-step-body">
                  <div className="h">Climb the board</div>
                  <div className="p">Ranked by hold time and total passes.</div>
                </div>
              </div>
            </div>
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
