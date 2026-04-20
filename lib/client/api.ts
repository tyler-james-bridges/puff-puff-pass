export type CurrentJoint = {
  ok: boolean;
  passFeeUsd?: string;
  currentHolder: string | null;
  currentMessage?: string | null;
  currentSince?: string | null;
  totalPasses?: number;
};

export type LeaderboardItem = {
  handle: string;
  totalPasses: number;
  score: number;
  timeHeldMs?: number;
  totalSpentUsd?: number;
  lastTxHash?: string | null;
  currentStreak?: number;
  longestStreak?: number;
  rank?: number;
};

export type FeedItem = {
  id: string;
  handle: string;
  message: string | null;
  amountUsd: string;
  txHash: string | null;
  paymentSignature?: string | null;
  displacedHandle?: string | null;
  rankAfter?: number;
  status?: string;
  vibeTag?: string;
  gainLine?: string;
  lossLine?: string | null;
  createdAt: string;
};

export type HealthInfo = {
  ok: boolean;
  service: string;
  now: string;
  storage: string;
  x402: {
    facilitatorUrl: string;
    facilitatorUrlAbstract: string;
    networks: string[];
    payTo: string;
    feeUsd: string;
  };
};

export const CHAIN_NAMES: Record<number, string> = {
  8453: "base",
  2741: "abstract",
  84532: "base sepolia",
  11124: "abstract testnet",
};

export const CHAIN_TO_NETWORK: Record<number, string> = {
  8453: "eip155:8453",
  2741: "eip155:2741",
  84532: "eip155:84532",
  11124: "eip155:11124",
};

export const USDC_META: Record<
  number,
  { address: `0x${string}`; name: string; version: string; decimals: number }
> = {
  8453: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin",
    version: "2",
    decimals: 6,
  },
  2741: {
    address: "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1",
    name: "Bridged USDC (Stargate)",
    version: "2",
    decimals: 6,
  },
  84532: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    name: "USDC",
    version: "2",
    decimals: 6,
  },
};

export function explorerUrl(network: string | null, txHash: string | null): string | null {
  if (!txHash || txHash === "pending" || !network) return null;
  const map: Record<string, string> = {
    "eip155:2741": "https://abscan.org/tx/",
    "eip155:11124": "https://sepolia.abscan.org/tx/",
    "eip155:8453": "https://basescan.org/tx/",
    "eip155:84532": "https://sepolia.basescan.org/tx/",
  };
  return map[network] ? map[network] + txHash : null;
}

export const avatarUrl = (h: string) =>
  `https://unavatar.io/x/${encodeURIComponent(h)}`;

export const shortHash = (h: string | null | undefined) =>
  h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
