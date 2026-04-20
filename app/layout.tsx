import type { Metadata } from "next";
import { WalletProvider } from "@/components/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "puff puff pass",
  description:
    "x402-gated virtual joint passing game. Grab the joint, pass it on, climb the leaderboard.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Puff Puff Pass",
    description:
      "x402-gated virtual joint passing game. Grab the joint, pass it on, climb the leaderboard.",
    type: "website",
    url: "https://ppp.0x402.sh",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
