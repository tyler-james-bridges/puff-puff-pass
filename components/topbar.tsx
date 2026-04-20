"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function TopBar() {
  return (
    <header className="topbar">
      <span className="brand">
        <span className="mark"></span>
        <span>
          <span className="bracket">[</span>puff.puff.pass
          <span className="bracket">]</span>
        </span>
      </span>
      <nav className="topnav">
        <span className="live">live</span>
        <a href="#leaderboard">leaderboard</a>
        <a href="/openapi.json">api</a>
        <span className="wallet-slot">
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "icon" }}
            showBalance={false}
            label="connect wallet"
          />
        </span>
      </nav>
    </header>
  );
}
