"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function TopBar() {
  return (
    <header className="topbar">
      <span className="brand">
        <span>
          <span className="bracket">[</span>puff.puff.pass
          <span className="bracket">]</span>
        </span>
      </span>
      <nav className="topnav">
        <span className="live">high</span>
        <span className="wallet-slot">
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            chainStatus="none"
            showBalance={false}
            label="connect wallet"
          />
        </span>
      </nav>
    </header>
  );
}
