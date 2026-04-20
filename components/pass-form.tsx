"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useSignTypedData,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CHAIN_NAMES, CHAIN_TO_NETWORK, USDC_META } from "@/lib/client/api";

type Status = { kind: "" | "ok" | "error"; text: string };

type AcceptItem = {
  scheme: string;
  network: string;
  payTo?: string;
  to?: string;
  price: any;
};

function findMatchingAccept(
  accepts: AcceptItem | AcceptItem[] | undefined,
  chainId: number | undefined
): AcceptItem | null {
  if (!chainId || !accepts) return null;
  const net = CHAIN_TO_NETWORK[chainId];
  if (!net) return null;
  const arr = Array.isArray(accepts) ? accepts : [accepts];
  return arr.find((a) => a.network === net) || null;
}

function parsePaymentRequired(res: Response) {
  const h = res.headers.get("payment-required");
  if (!h) return null;
  try {
    return JSON.parse(atob(h));
  } catch {
    return null;
  }
}

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

export function PassForm({ onSuccess }: { onSuccess: () => void }) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>({
    kind: "",
    text: "connect wallet to pass",
  });
  const [busy, setBusy] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { openConnectModal } = useConnectModal();
  const { connectors, connectAsync } = useConnect();

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

  async function buildPaymentSignature(
    accept: AcceptItem,
    payTo: `0x${string}`,
    signerAddress: `0x${string}`
  ) {
    const cid = Number(accept.network.split(":")[1]);
    const meta = USDC_META[cid];
    if (!meta) throw new Error("unsupported chain: " + accept.network);

    let amount: string;
    if (typeof (accept as any).amount === "string") {
      amount = String((accept as any).amount);
    } else if (typeof accept.price === "object" && (accept.price as any)?.amount) {
      amount = String((accept.price as any).amount);
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
      name: meta.name,
      version: meta.version,
      chainId: cid,
      verifyingContract: meta.address,
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
      from: signerAddress,
      to: payTo,
      value: BigInt(amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    };

    setStatus({ kind: "", text: "waiting for wallet signature…" });
    const signature = await signTypedDataAsync({
      account: signerAddress,
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
          from: signerAddress,
          to: payTo,
          value: amount,
          validAfter,
          validBefore,
          nonce,
        },
      },
    };
    return btoa(JSON.stringify(payload));
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
      // After modal connect, user has to click again.
      setStatus({ kind: "", text: "wallet connected. click pass again." });
      return;
    }

    setBusy(true);
    try {
      let res = await fetch("/api/joint/pass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: trimmed }),
      });

      if (res.status === 402) {
        const payReq = parsePaymentRequired(res);
        if (!payReq) throw new Error("no payment-required header");
        const accept = findMatchingAccept(payReq.accepts, chainId);
        if (!accept) {
          const want = (Array.isArray(payReq.accepts) ? payReq.accepts : [payReq.accepts])
            .map((a: AcceptItem) => a.network)
            .join(", ");
          throw new Error(
            `wallet on ${CHAIN_NAMES[chainId!] || chainId}, server wants ${want}`
          );
        }
        const payTo = (accept.payTo || accept.to || payReq.payTo) as `0x${string}` | undefined;
        if (!payTo) throw new Error("no payTo in accept");
        if (payTo.toLowerCase() === address.toLowerCase()) {
          throw new Error("cannot pay yourself. use a different wallet.");
        }

        const paymentHeader = await buildPaymentSignature(
          accept,
          payTo,
          address as `0x${string}`
        );

        setStatus({ kind: "", text: "settling payment…" });

        res = await fetch("/api/joint/pass", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "payment-signature": paymentHeader,
          },
          body: JSON.stringify({ handle: trimmed }),
        });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`server ${res.status}: ${text.slice(0, 160)}`);
      }

      setStatus({ kind: "ok", text: `you're holding the joint. @${trimmed}` });
      setHandle("");
      onSuccess();
    } catch (err: any) {
      setStatus({ kind: "error", text: err?.message || String(err) });
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
        <span className="pass-main">{busy ? "signing…" : "pass it"}</span>
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
        · base · abstract
      </span>
      <span className={"pass-status" + (status.kind ? " " + status.kind : "")}>
        {isConnected ? status.text || "ready to pass." : "connect wallet to pass"}
      </span>
    </form>
  );
}
