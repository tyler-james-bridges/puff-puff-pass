"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { CHAIN_NAMES, CHAIN_TO_NETWORK } from "@/lib/client/api";

type Status = { kind: "" | "ok" | "error"; text: string };

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
  const { data: walletClient } = useWalletClient();
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
    if (!walletClient) {
      setStatus({ kind: "error", text: "wallet not ready, try again" });
      return;
    }

    setBusy(true);
    try {
      // Check if our chain is supported
      const network = CHAIN_TO_NETWORK[chainId];
      if (!network) {
        throw new Error(
          `wallet on ${CHAIN_NAMES[chainId] || chainId}, switch to Base or Abstract`
        );
      }

      // Build x402 SDK client (same pattern as AFK explore page)
      const readContractFn = publicClient
        ? (args: any) => publicClient.readContract(args)
        : undefined;

      const signer = toClientEvmSigner({
        address: address,
        signTypedData: (msg: any) =>
          walletClient.signTypedData({ ...msg, account: address }),
        ...(readContractFn ? { readContract: readContractFn } : {}),
      } as any, publicClient as any);

      const client = new x402Client();
      registerExactEvmScheme(client, { signer });

      // First request to get 402 payment requirements
      setStatus({ kind: "", text: "requesting payment details\u2026" });
      const initialRes = await fetch("/api/joint/pass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: trimmed }),
      });

      if (initialRes.status !== 402) {
        // No payment needed (shouldn't happen but handle gracefully)
        if (initialRes.ok) {
          setStatus({ kind: "ok", text: `you're holding the joint. @${trimmed}` });
          setHandle("");
          onSuccess();
        } else {
          const text = await initialRes.text();
          throw new Error(`server ${initialRes.status}: ${text.slice(0, 160)}`);
        }
        return;
      }

      // Parse payment requirements from 402 response
      const paymentRequiredHeader = initialRes.headers.get("payment-required");
      if (!paymentRequiredHeader) throw new Error("no payment-required header");
      const paymentRequired = JSON.parse(atob(paymentRequiredHeader));

      // Find matching accept for current chain
      const accepts = Array.isArray(paymentRequired.accepts)
        ? paymentRequired.accepts
        : [paymentRequired.accepts];
      const matchingAccept = accepts.find(
        (a: any) => a.network === network
      );
      if (!matchingAccept) {
        throw new Error(
          `server wants ${accepts.map((a: any) => a.network).join(", ")}, wallet on ${network}`
        );
      }

      // Use SDK to create payment payload
      setStatus({ kind: "", text: "waiting for wallet signature\u2026" });

      // Build the payment required object the SDK expects
      const paymentRequiredForSdk = {
        ...paymentRequired,
        // Override accepts with just our matching chain
        accepts: matchingAccept,
      };
      const paymentResult = await client.createPaymentPayload(paymentRequiredForSdk);

      // Encode payment payload
      const paymentHeader = btoa(JSON.stringify(paymentResult));

      // Submit with payment
      setStatus({ kind: "", text: "settling payment\u2026" });
      const res = await fetch("/api/joint/pass", {
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

      setStatus({ kind: "ok", text: `you're holding the joint. @${trimmed}` });
      setHandle("");
      onSuccess();
    } catch (err: any) {
      const raw = err?.message || String(err);
      // Clean up common wallet errors
      const msg = raw.includes("User rejected")
        ? "signature rejected"
        : raw.includes("User denied")
          ? "signature rejected"
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
        <span className="pass-main">{busy ? "signing\u2026" : "pass it"}</span>
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
          ? (status.text === "connect wallet to pass" ? "ready to pass." : status.text || "ready to pass.")
          : "connect wallet to pass"}
      </span>
    </form>
  );
}
