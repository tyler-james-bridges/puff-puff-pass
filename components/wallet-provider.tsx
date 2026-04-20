"use client";

import "@rainbow-me/rainbowkit/styles.css";

import dynamic from "next/dynamic";

const WalletProviderInner = dynamic(
  () => import("./wallet-provider-inner").then((m) => m.WalletProviderInner),
  { ssr: false }
);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <WalletProviderInner>{children}</WalletProviderInner>;
}
