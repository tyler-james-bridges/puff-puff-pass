import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MemoryStore } from "./store/memory-store.mjs";
import { buildPaymentRequiredHeader, verifyPaymentSignature } from "./x402/challenge.mjs";

const PORT = Number(process.env.PORT || 4020);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PASS_FEE_USD = process.env.PASS_FEE_USD || "0.00402";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const store = new MemoryStore();

function json(res, code, body, headers = {}) {
  res.writeHead(code, {
    "content-type": "application/json",
    ...headers
  });
  res.end(JSON.stringify(body));
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, BASE_URL);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      service: "puff-puff-pass-api",
      now: new Date().toISOString()
    });
  }

  if (req.method === "GET" && url.pathname === "/") {
    const html = await readFile(path.join(projectRoot, "public", "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }

  if (req.method === "GET" && url.pathname === "/api/joint/current") {
    return json(res, 200, {
      ok: true,
      passFeeUsd: PASS_FEE_USD,
      ...store.getCurrent()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/feed") {
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 50));
    return json(res, 200, {
      ok: true,
      items: store.getFeed(limit)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    return json(res, 200, {
      ok: true,
      items: store.getLeaderboard()
    });
  }

  const handleStatsMatch = url.pathname.match(/^\/api\/handles\/([a-zA-Z0-9_]{1,50})$/);
  if (req.method === "GET" && handleStatsMatch) {
    const handleValue = handleStatsMatch[1];
    const stats = store.getHandleStats(handleValue);
    if (!stats) {
      return json(res, 404, { ok: false, error: "Handle not found" });
    }
    return json(res, 200, { ok: true, item: stats });
  }

  if (req.method === "GET" && url.pathname === "/.well-known/x402") {
    const raw = await readFile(path.join(projectRoot, "public", ".well-known", "x402"), "utf8");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(raw);
  }

  if (req.method === "GET" && url.pathname === "/openapi.json") {
    const raw = await readFile(path.join(projectRoot, "openapi.json"), "utf8");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(raw);
  }

  if (req.method === "POST" && url.pathname === "/api/joint/pass") {
    let body;
    try {
      body = await parseJsonBody(req);
    } catch (error) {
      return json(res, 400, { ok: false, error: String(error.message || error) });
    }

    const handle = body?.handle;
    if (!handle || typeof handle !== "string" || !/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
      return json(res, 400, {
        ok: false,
        error: "handle is required and must match ^[a-zA-Z0-9_]{1,50}$"
      });
    }

    const paymentSignature = req.headers["payment-signature"];
    if (!verifyPaymentSignature(paymentSignature)) {
      const paymentRequired = buildPaymentRequiredHeader({
        baseUrl: BASE_URL,
        amountUsd: PASS_FEE_USD
      });

      return json(
        res,
        402,
        {
          ok: false,
          error: "Payment Required"
        },
        {
          "cache-control": "no-store",
          "payment-required": paymentRequired,
          "www-authenticate": 'Payment realm="puffpuffpass.fun", method="x402", intent="charge"'
        }
      );
    }

    const txHash = typeof body.txHash === "string" ? body.txHash : "pending";
    const message = typeof body.message === "string" ? body.message : null;

    const result = store.applyPass({
      handle,
      amountUsd: PASS_FEE_USD,
      txHash,
      paymentSignature,
      message
    });

    return json(res, 200, {
      ok: true,
      event: result.event,
      current: store.getCurrent(),
      leaderboardTop10: result.leaderboard.slice(0, 10)
    });
  }

  return json(res, 404, { ok: false, error: "Not Found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    json(res, 500, { ok: false, error: String(error.message || error) });
  });
});

server.listen(PORT, () => {
  process.stdout.write(`Puff Puff Pass API listening on ${BASE_URL}\n`);
});
