import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { paymentMiddlewareFromConfig, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { PostgresStore } from "./store/postgres-store.mjs";
import { createDbClient } from "./store/db-client.mjs";
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
const ABSTRACT_USDC_ASSET =
  process.env.ABSTRACT_USDC_ASSET || "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1";
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function startServer() {
  const store = new PostgresStore(await createDbClient());
  await store.init();

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

  const exactEvmScheme = new ExactEvmScheme();

  if (process.env.X402_DEBUG === "1") {
    const originalParsePrice = exactEvmScheme.parsePrice.bind(exactEvmScheme);
    exactEvmScheme.parsePrice = async (price, network) => {
      process.stdout.write(`[x402-debug] parsePrice network=${network} price=${JSON.stringify(price)}\n`);
      return originalParsePrice(price, network);
    };
  }

  exactEvmScheme.registerMoneyParser(async (amount, network) => {
    if (process.env.X402_DEBUG === "1") {
      process.stdout.write(`[x402-debug] moneyParser network=${network} amount=${amount}\n`);
    }

    if (!(network === "eip155:2741" || String(network).includes("2741"))) return null;

    return {
      amount: String(Math.round(amount * 1_000_000)),
      asset: ABSTRACT_USDC_ASSET,
      extra: {
        name: "USD Coin",
        version: "2"
      }
    };
  });

  const x402Server = new x402ResourceServer(facilitatorClients)
    .register("eip155:*", exactEvmScheme)
    .register("eip155:2741", exactEvmScheme);

  if (process.env.X402_DEBUG === "1") {
    const map = x402Server.registeredServerSchemes;
    const entries = map ? Array.from(map.entries()).map(([network, byScheme]) => ({
      network,
      schemes: byScheme ? Array.from(byScheme.keys()) : []
    })) : [];
    process.stdout.write(`[x402-debug] registered schemes: ${JSON.stringify(entries)}\n`);
    process.stdout.write(
      `[x402-debug] exact hasOwn(parsePrice)=${Object.prototype.hasOwnProperty.call(exactEvmScheme, "parsePrice")}\n`
    );
  }

  const microUsd = String(Math.round(Number(PASS_FEE_USD) * 1_000_000));

  const acceptItems = X402_NETWORKS.map((network) => {
    const isAbstract = network === "eip155:2741";
    return {
      scheme: "exact",
      price: isAbstract
        ? {
            amount: microUsd,
            asset: ABSTRACT_USDC_ASSET,
            extra: {
              name: "USD Coin",
              version: "2"
            }
          }
        : `$${PASS_FEE_USD}`,
      network,
      payTo: PAY_TO
    };
  });

  const accepts = acceptItems.length === 1 ? acceptItems[0] : acceptItems;

  app.use(
    paymentMiddlewareFromConfig(
      {
        "POST /api/joint/pass": {
          accepts,
          description: "Pay to pass the virtual joint and claim the live holder slot.",
          mimeType: "application/json"
        }
      },
      facilitatorClients,
      [
        { network: "eip155:*", server: exactEvmScheme },
        { network: "eip155:2741", server: exactEvmScheme }
      ]
    )
  );

  app.get("/api/health", (_req, res) => {
    return res.status(200).json({
      ok: true,
      service: "puff-puff-pass-api",
      now: new Date().toISOString(),
      storage: process.env.DATABASE_URL ? "postgres" : "pglite",
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

  app.get("/api/joint/current", async (_req, res, next) => {
    try {
      return res.status(200).json({
        ok: true,
        passFeeUsd: PASS_FEE_USD,
        ...(await store.getCurrent())
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/feed", async (req, res, next) => {
    try {
      const limit = Math.min(100, Number(req.query.limit || 50));
      return res.status(200).json({
        ok: true,
        items: await store.getFeed(limit)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/leaderboard", async (_req, res, next) => {
    try {
      return res.status(200).json({
        ok: true,
        items: await store.getLeaderboard()
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/handles/:handle", async (req, res, next) => {
    const handleValue = req.params.handle;
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(handleValue)) {
      return res.status(400).json({ ok: false, error: "Invalid handle format" });
    }

    try {
      const stats = await store.getHandleStats(handleValue);
      if (!stats) {
        return res.status(404).json({ ok: false, error: "Handle not found" });
      }

      return res.status(200).json({ ok: true, item: stats });
    } catch (error) {
      next(error);
    }
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

  app.post("/api/joint/pass", async (req, res, next) => {
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

    try {
      const result = await store.applyPass({
        handle,
        amountUsd: PASS_FEE_USD,
        txHash,
        paymentSignature,
        message
      });

      return res.status(200).json({
        ok: true,
        event: result.event,
        current: await store.getCurrent(),
        leaderboardTop10: result.leaderboard.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: "Not Found" });
  });

  app.use((error, _req, res, _next) => {
    if (process.env.X402_DEBUG === "1") {
      process.stderr.write(`${error?.stack || error}\n`);
    }
    res.status(500).json({ ok: false, error: String(error.message || error) });
  });

  const server = app.listen(PORT, () => {
    process.stdout.write(`Puff Puff Pass API listening on ${BASE_URL}\n`);
    process.stdout.write(`x402 facilitators: ${FACILITATOR_URL}, ${FACILITATOR_URL_ABSTRACT}\n`);
    process.stdout.write(`x402 networks: ${X402_NETWORKS.join(", ")}\n`);
    process.stdout.write(`storage: ${process.env.DATABASE_URL ? "postgres" : "pglite"}\n`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((error) => {
  process.stderr.write(`Failed to start server: ${error?.message || String(error)}\n`);
  process.exit(1);
});
