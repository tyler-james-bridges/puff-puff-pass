"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { parseAbi } from "viem";
import { CHAIN_NAMES, CHAIN_TO_NETWORK, USDC_META } from "@/lib/client/api";

type Status = { kind: "" | "ok" | "error"; text: string };

const PASS_FEE_USDC = 4020n; // 0.00402 USDC in 6-decimal units

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export function PassForm({ onSuccess }: { onSuccess: () => void }) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>({
    kind: "",
    text: "connect wallet to pass",
  });
  const [busy, setBusy] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { connectors, connectAsync } = useConnect();
  const { writeContractAsync } = useWriteContract();
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

  async function doPass(trimmed: string, network: string) {
    const usdcMeta = USDC_META[chainId];
    if (!usdcMeta) throw new Error("unsupported chain for USDC");

    // Fetch the right receiver for the current chain
    const healthRes = await fetch("/api/health");
    if (!healthRes.ok) throw new Error("could not fetch payment info");
    const health = await healthRes.json();
    const isAbstract = chainId === 2741 || chainId === 11124;
    const receiverAddr = (isAbstract
      ? health.x402?.abstractPayTo
      : health.x402?.payTo) as `0x${string}`;
    if (!receiverAddr) throw new Error("no receiver address configured");

    if (receiverAddr.toLowerCase() === address!.toLowerCase()) {
      throw new Error("cannot pay yourself. use a different wallet.");
    }

    setStatus({ kind: "", text: "confirm USDC transfer in wallet\u2026" });
    const txHash = await writeContractAsync({
      address: usdcMeta.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [receiverAddr, PASS_FEE_USDC],
    } as any);

    // Wait for onchain confirmation before polling server
    setStatus({ kind: "", text: "waiting for tx confirmation\u2026" });
    if (publicClient) {
      try {
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
          timeout: 30_000,
        });
      } catch {
        // receipt fetch failed, still try server verification
      }
    } else {
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Poll server to verify the transfer and record the pass
    setStatus({ kind: "", text: "verifying payment\u2026" });
    let confirmed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
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
        // 409 = tx already used (replay protection). The pass was already recorded.
        if (res.status === 409) {
          confirmed = true;
          break;
        }
        // 402 = payment not verified yet, keep retrying
        if (res.status === 402) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        // 4xx client error (not 402/409) = bad request, stop retrying
        if (res.status >= 400 && res.status < 500) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `error ${res.status}`);
        }
        // 5xx = server error, retry
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        // Network errors: retry. Logic errors: rethrow.
        if (
          err.message &&
          !err.message.includes("not verified") &&
          !err.message.includes("fetch") &&
          !err.message.includes("Failed") &&
          !err.message.includes("NetworkError")
        ) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!confirmed) {
      throw new Error(
        "tx sent but verification timed out. refresh and check the leaderboard."
      );
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
      await doPass(trimmed, network);
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
