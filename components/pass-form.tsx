"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useWriteContract,
  usePublicClient,
  useSignTypedData,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseAbi } from "viem";
import { CHAIN_NAMES, CHAIN_TO_NETWORK, USDC_META } from "@/lib/client/api";

type Status = { kind: "" | "ok" | "error"; text: string };

const PASS_FEE_USDC = 4020n; // 0.00402 USDC in 6-decimal units

// Direct transfer only on Base (no Blockaid issues with AGW on Abstract)
const DIRECT_TRANSFER_CHAINS = new Set([8453, 84532]);

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

type AcceptItem = {
  scheme: string;
  network: string;
  payTo?: string;
  to?: string;
  price: any;
  amount?: string;
};

export function PassForm({ onSuccess }: { onSuccess: () => void }) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>({
    kind: "",
    text: "connect wallet to pass",
  });
  const [busy, setBusy] = useState(false);
  const [payTo, setPayTo] = useState<`0x${string}` | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { connectors, connectAsync } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();

  async function ensureConnected() {
    if (isConnected && address) return true;
    if (openConnectModal) {
      openConnectModal();
      return false;
    }
    if (connectors[0]) {
      try {
        await connectAsync({ connector: connectors[0] });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // --- Direct transfer flow (Base) ---
  async function doDirectTransfer(trimmed: string, network: string) {
    const usdcMeta = USDC_META[chainId];
    if (!usdcMeta) throw new Error("unsupported chain for USDC");

    let receiverAddr = payTo;
    if (!receiverAddr) {
      const healthRes = await fetch("/api/health");
      if (!healthRes.ok) throw new Error("could not fetch payment info");
      const health = await healthRes.json();
      receiverAddr = health.x402?.payTo as `0x${string}`;
      if (!receiverAddr) throw new Error("no receiver address configured");
      setPayTo(receiverAddr);
    }

    if (receiverAddr.toLowerCase() === address!.toLowerCase()) {
      throw new Error("cannot pay yourself. use a different wallet.");
    }

    setStatus({ kind: "", text: "confirm USDC transfer in wallet\u2026" });
    const txHash = await writeContractAsync({
      address: usdcMeta.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [receiverAddr, PASS_FEE_USDC],
      gas: 100_000n,
    } as any);

    setStatus({ kind: "", text: "waiting for tx confirmation\u2026" });
    if (publicClient) {
      try {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
          timeout: 30_000,
        });
      } catch {
        // try server verification anyway
      }
    } else {
      await new Promise((r) => setTimeout(r, 4000));
    }

    setStatus({ kind: "", text: "verifying payment\u2026" });
    let confirmed = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const res = await fetch("/api/joint/pass-direct", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle: trimmed, txHash, network }),
        });
        if (res.ok) {
          confirmed = true;
          break;
        }
        if (res.status !== 402) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `server error ${res.status}`);
        }
      } catch (err: any) {
        if (err.message && !err.message.includes("not verified") && !err.message.includes("fetch")) {
          throw err;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!confirmed) {
      throw new Error("tx sent but verification timed out. refresh and check the leaderboard.");
    }
  }

  // --- x402 signature flow (Abstract + fallback) ---
  async function doX402Flow(trimmed: string, network: string) {
    const usdcMeta = USDC_META[chainId];
    if (!usdcMeta) throw new Error("unsupported chain for USDC");

    setStatus({ kind: "", text: "requesting payment details\u2026" });
    let res = await fetch("/api/joint/pass", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: trimmed }),
    });

    if (res.status !== 402) {
      if (res.ok) return; // no payment needed
      const text = await res.text();
      throw new Error(`server ${res.status}: ${text.slice(0, 160)}`);
    }

    const paymentRequiredHeader = res.headers.get("payment-required");
    if (!paymentRequiredHeader) throw new Error("no payment-required header");
    const paymentRequired = JSON.parse(atob(paymentRequiredHeader));

    const accepts = Array.isArray(paymentRequired.accepts)
      ? paymentRequired.accepts
      : [paymentRequired.accepts];
    const accept = accepts.find((a: AcceptItem) => a.network === network);
    if (!accept) {
      throw new Error(`server wants ${accepts.map((a: AcceptItem) => a.network).join(", ")}`);
    }

    const payToAddr = (accept.payTo || accept.to || paymentRequired.payTo) as `0x${string}`;
    if (!payToAddr) throw new Error("no payTo in payment requirements");

    // Parse amount
    let amount: string;
    if (typeof accept.amount === "string") {
      amount = accept.amount;
    } else if (typeof accept.price === "object" && accept.price?.amount) {
      amount = String(accept.price.amount);
    } else if (typeof accept.price === "string") {
      const n = parseFloat(accept.price.replace("$", ""));
      amount = String(Math.round(n * 1_000_000));
    } else {
      throw new Error("cannot parse price");
    }

    const validAfter = "0";
    const validBefore = String(Math.floor(Date.now() / 1000) + 900);
    const nonce = randomBytes32();

    const domain = {
      name: usdcMeta.name,
      version: usdcMeta.version,
      chainId: chainId,
      verifyingContract: usdcMeta.address,
    } as const;

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    } as const;

    const message = {
      from: address!,
      to: payToAddr,
      value: BigInt(amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    };

    setStatus({ kind: "", text: "waiting for wallet signature\u2026" });
    const signature = await signTypedDataAsync({
      account: address!,
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    });

    const payload = {
      x402Version: 2,
      accepted: accept,
      payload: {
        signature,
        authorization: {
          from: address!,
          to: payToAddr,
          value: amount,
          validAfter,
          validBefore,
          nonce,
        },
      },
    };
    const paymentHeader = btoa(JSON.stringify(payload));

    setStatus({ kind: "", text: "settling payment\u2026" });
    res = await fetch("/api/joint/pass", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "payment-signature": paymentHeader,
      },
      body: JSON.stringify({ handle: trimmed }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`server ${res.status}: ${text.slice(0, 160)}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) {
      setStatus({ kind: "error", text: "enter a handle first" });
      return;
    }
    if (!isConnected || !address) {
      const ok = await ensureConnected();
      if (!ok) return;
      setStatus({ kind: "", text: "wallet connected. click pass again." });
      return;
    }

    const network = CHAIN_TO_NETWORK[chainId];
    if (!network) {
      setStatus({
        kind: "error",
        text: `switch to ${Object.values(CHAIN_NAMES).join(" or ")}`,
      });
      return;
    }

    setBusy(true);
    try {
      if (DIRECT_TRANSFER_CHAINS.has(chainId)) {
        await doDirectTransfer(trimmed, network);
      } else {
        await doX402Flow(trimmed, network);
      }

      setStatus({
        kind: "ok",
        text: `you're holding the joint. @${trimmed}`,
      });
      setHandle("");
      onSuccess();
    } catch (err: any) {
      const raw = err?.message || String(err);
      const msg = raw.includes("User rejected") || raw.includes("User denied")
        ? "transaction rejected"
        : raw.includes("insufficient")
          ? "insufficient USDC balance"
          : raw.length > 120
            ? raw.slice(0, 120) + "\u2026"
            : raw;
      setStatus({ kind: "error", text: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pass-cta" onSubmit={onSubmit}>
      <input
        className="handle-input"
        name="handle"
        placeholder="your handle"
        maxLength={50}
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        required
      />
      <button className="pass-btn" type="submit" disabled={busy}>
        <span className="pass-main">{busy ? "sending\u2026" : "pass it"}</span>
        <span className="pass-tag">
          <span className="x402-chip">
            <span className="x">x</span>402
          </span>
          <span className="pass-price">$0.00402 usdc</span>
        </span>
      </button>
      <span className="fee-line">
        pay-per-action over{" "}
        <a
          href="https://x402.org"
          target="_blank"
          rel="noopener"
          className="x402-link"
        >
          <span style={{ color: "var(--text-mid)" }}>x</span>402
        </a>{" "}
        &middot; base &middot; abstract
      </span>
      <span className={"pass-status" + (status.kind ? " " + status.kind : "")}>
        {isConnected
          ? status.text === "connect wallet to pass"
            ? "ready to pass."
            : status.text || "ready to pass."
          : "connect wallet to pass"}
      </span>
    </form>
  );
}
