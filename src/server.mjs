import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { MemoryStore } from "./store/memory-store.mjs";
import { createCdpAuthHeadersFactory } from "./x402/cdp-auth.mjs";

const PORT = Number(process.env.PORT || 4020);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PASS_FEE_USD = process.env.PASS_FEE_USD || "0.00402";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const FACILITATOR_URL_ABSTRACT =
  process.env.FACILITATOR_URL_ABSTRACT || "https://facilitator.x402.abs.xyz";
const X402_NETWORKS = (process.env.X402_NETWORKS || process.env.X402_NETWORK || "eip155:8453")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const PAY_TO = process.env.PAY_TO || "0x0000000000000000000000000000000000000000";
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const store = new MemoryStore();
const app = express();

app.use(express.json({ limit: "1mb" }));

const cdpHeadersFactory = createCdpAuthHeadersFactory({
  facilitatorUrl: FACILITATOR_URL,
  apiKeyId: CDP_API_KEY_ID,
  apiKeySecret: CDP_API_KEY_SECRET
});

const cdpFacilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  createAuthHeaders: cdpHeadersFactory || undefined
});

const abstractFacilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL_ABSTRACT
});

const facilitatorClients =
  FACILITATOR_URL_ABSTRACT === FACILITATOR_URL
    ? [cdpFacilitatorClient]
    : [cdpFacilitatorClient, abstractFacilitatorClient];

const x402Server = new x402ResourceServer(facilitatorClients).register("eip155:*", new ExactEvmScheme());

const accepts = X402_NETWORKS.map((network) => ({
  scheme: "exact",
  price: `$${PASS_FEE_USD}`,
  network,
  payTo: PAY_TO
}));

app.use(
  paymentMiddleware(
    {
      "POST /api/joint/pass": {
        accepts,
        description: "Pay to pass the virtual joint and claim the live holder slot.",
        mimeType: "application/json"
      }
    },
    x402Server
  )
);

app.get("/api/health", (_req, res) => {
  return res.status(200).json({
      ok: true,
      service: "puff-puff-pass-api",
      now: new Date().toISOString(),
      x402: {
        facilitatorUrl: FACILITATOR_URL,
        facilitatorUrlAbstract: FACILITATOR_URL_ABSTRACT,
        networks: X402_NETWORKS,
        payTo: PAY_TO,
        feeUsd: PASS_FEE_USD
      }
  });
});

app.get("/", async (_req, res, next) => {
  try {
    const html = await readFile(path.join(projectRoot, "public", "index.html"), "utf8");
    res.status(200).type("html").send(html);
  } catch (error) {
    next(error);
  }
});

app.get("/api/joint/current", (_req, res) => {
  return res.status(200).json({
      ok: true,
      passFeeUsd: PASS_FEE_USD,
      ...store.getCurrent()
  });
});

app.get("/api/feed", (req, res) => {
  const limit = Math.min(100, Number(req.query.limit || 50));
  return res.status(200).json({
    ok: true,
    items: store.getFeed(limit)
  });
});

app.get("/api/leaderboard", (_req, res) => {
  return res.status(200).json({
    ok: true,
    items: store.getLeaderboard()
  });
});

app.get("/api/handles/:handle", (req, res) => {
  const handleValue = req.params.handle;
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(handleValue)) {
    return res.status(400).json({ ok: false, error: "Invalid handle format" });
  }

  const stats = store.getHandleStats(handleValue);
  if (!stats) {
    return res.status(404).json({ ok: false, error: "Handle not found" });
  }

  return res.status(200).json({ ok: true, item: stats });
});

app.get("/.well-known/x402", async (_req, res, next) => {
  try {
    const raw = await readFile(path.join(projectRoot, "public", ".well-known", "x402"), "utf8");
    return res.status(200).type("json").send(raw);
  } catch (error) {
    next(error);
  }
});

app.get("/openapi.json", async (_req, res, next) => {
  try {
    const raw = await readFile(path.join(projectRoot, "openapi.json"), "utf8");
    return res.status(200).type("json").send(raw);
  } catch (error) {
    next(error);
  }
});

app.post("/api/joint/pass", (req, res) => {
  const handle = req.body?.handle;
  if (!handle || typeof handle !== "string" || !/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
    return res.status(400).json({
      ok: false,
      error: "handle is required and must match ^[a-zA-Z0-9_]{1,50}$"
    });
  }

  const paymentSignature = req.headers["payment-signature"];
  const txHash = typeof req.body.txHash === "string" ? req.body.txHash : "pending";
  const message = typeof req.body.message === "string" ? req.body.message : null;

  const result = store.applyPass({
    handle,
    amountUsd: PASS_FEE_USD,
    txHash,
    paymentSignature,
    message
  });

  return res.status(200).json({
    ok: true,
    event: result.event,
    current: store.getCurrent(),
    leaderboardTop10: result.leaderboard.slice(0, 10)
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found" });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ ok: false, error: String(error.message || error) });
});

app.listen(PORT, () => {
  process.stdout.write(`Puff Puff Pass API listening on ${BASE_URL}\n`);
  process.stdout.write(`x402 facilitators: ${FACILITATOR_URL}, ${FACILITATOR_URL_ABSTRACT}\n`);
  process.stdout.write(`x402 networks: ${X402_NETWORKS.join(", ")}\n`);
});
