import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { PASS_FEE_USD, PAY_TO, ABSTRACT_PAY_TO } from "@/lib/server/config";
import { createPublicClient, http, getAddress } from "viem";
import { base } from "viem/chains";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABSTRACT = "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1";
const MIN_AMOUNT = Math.round(Number(PASS_FEE_USD) * 1_000_000); // in USDC units (6 decimals)

const RPC_MAP: Record<string, { rpc: string; usdc: string; chain: any }> = {
  "eip155:8453": {
    rpc: "https://mainnet.base.org",
    usdc: USDC_BASE,
    chain: base,
  },
  "eip155:2741": {
    rpc: "https://api.mainnet.abs.xyz",
    usdc: USDC_ABSTRACT,
    chain: { id: 2741, name: "Abstract", network: "abstract", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://api.mainnet.abs.xyz"] } } },
  },
};

async function verifyTransfer(
  txHash: `0x${string}`,
  network: string,
): Promise<{ verified: boolean; from: string | null; amount: bigint }> {
  const cfg = RPC_MAP[network];
  if (!cfg) return { verified: false, from: null, amount: 0n };

  const client = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpc),
  });

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      console.log("[pass-direct] tx status:", receipt.status);
      return { verified: false, from: null, amount: 0n };
    }

    // Find USDC Transfer event to our receiver (per-chain)
    const receiverAddr = network === "eip155:2741" ? ABSTRACT_PAY_TO : PAY_TO;
    const payToLower = getAddress(receiverAddr).toLowerCase();
    const usdcLower = getAddress(cfg.usdc).toLowerCase();

    console.log("[pass-direct] checking", receipt.logs.length, "logs for USDC transfer to", payToLower);

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcLower) continue;
      if (log.topics.length < 3) continue;

      // Transfer(from, to, value) — topics[1]=from, topics[2]=to
      const toAddr = "0x" + log.topics[2]!.slice(26);
      if (toAddr.toLowerCase() !== payToLower) continue;

      const fromAddr = "0x" + log.topics[1]!.slice(26);
      const value = BigInt(log.data);

      console.log("[pass-direct] found transfer from", fromAddr, "value", value.toString());

      if (value >= BigInt(MIN_AMOUNT)) {
        return { verified: true, from: fromAddr, amount: value };
      }
    }

    console.log("[pass-direct] no matching USDC transfer found in tx logs");
    return { verified: false, from: null, amount: 0n };
  } catch (err: any) {
    console.error("[pass-direct] verify error:", err?.message || String(err));
    return { verified: false, from: null, amount: 0n };
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const { handle, txHash, network } = body || {};

  if (
    !handle ||
    typeof handle !== "string" ||
    !/^[a-zA-Z0-9_]{1,50}$/.test(handle)
  ) {
    return NextResponse.json(
      { ok: false, error: "handle required (^[a-zA-Z0-9_]{1,50}$)" },
      { status: 400 },
    );
  }

  if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
    return NextResponse.json(
      { ok: false, error: "txHash required" },
      { status: 400 },
    );
  }

  if (!network || !RPC_MAP[network]) {
    return NextResponse.json(
      { ok: false, error: `unsupported network. use: ${Object.keys(RPC_MAP).join(", ")}` },
      { status: 400 },
    );
  }

  // Verify the USDC transfer onchain
  const result = await verifyTransfer(txHash as `0x${string}`, network);

  if (!result.verified) {
    return NextResponse.json(
      { ok: false, error: "payment not verified. ensure USDC was sent to the receiver." },
      { status: 402 },
    );
  }

  // Prevent tx replay — reject if this txHash was already used
  const store = await getStore();
  const existing = await store.db.query(
    "select id from passes where tx_hash = $1 limit 1",
    [txHash],
  );
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { ok: false, error: "this transaction has already been used" },
      { status: 409 },
    );
  }

  const message = typeof body.message === "string" ? body.message : null;

  try {
    const passResult = await store.applyPass({
      handle,
      amountUsd: PASS_FEE_USD,
      txHash,
      paymentSignature: `direct:${txHash}`,
      message,
    });

    return NextResponse.json({
      ok: true,
      event: passResult.event,
      current: await store.getCurrent(),
      leaderboardTop10: passResult.leaderboard.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 },
    );
  }
}
