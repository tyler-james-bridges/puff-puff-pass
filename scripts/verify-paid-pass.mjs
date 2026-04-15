import "dotenv/config";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { privateKeyToAccount } from "viem/accounts";

const PORT = Number(process.env.PORT || 4020);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const API_URL = `${BASE_URL.replace(/\/$/, "")}/api`;

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd()
  });
}

async function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // keep waiting
    }
    await delay(500);
  }
  throw new Error("Timed out waiting for server /api/health");
}

function getHandlePassCount(items, handle) {
  const row = items.find((entry) => entry.handle === handle);
  return row ? Number(row.totalPasses) : 0;
}

async function fetchLeaderboard() {
  const res = await fetch(`${API_URL}/leaderboard`);
  if (!res.ok) {
    throw new Error(`Failed to fetch leaderboard: HTTP ${res.status}`);
  }
  return res.json();
}

async function run() {
  const buyerHandle = process.env.BUYER_HANDLE || "tmoney_145";
  const payTo = process.env.PAY_TO;
  const buyerPrivateKey = process.env.EVM_PRIVATE_KEY;

  if (payTo && buyerPrivateKey && process.env.ALLOW_SELF_PAY !== "1") {
    try {
      const buyerAddress = privateKeyToAccount(buyerPrivateKey).address.toLowerCase();
      if (buyerAddress === payTo.toLowerCase()) {
        throw new Error(
          `PAY_TO (${payTo}) must be different from buyer wallet (${buyerAddress}) for verification runs. Set ALLOW_SELF_PAY=1 to override.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("PAY_TO")) {
        throw error;
      }
      throw new Error(`Could not validate buyer/payTo addresses: ${error?.message || String(error)}`);
    }
  }

  process.stdout.write(`Starting Puff Puff Pass server on ${BASE_URL}\n`);
  const server = spawnProcess("node", ["src/server.mjs"], { stdio: "pipe" });

  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  let serverExited = false;
  server.on("exit", (code) => {
    serverExited = true;
    process.stdout.write(`Server exited with code ${code}\n`);
  });

  try {
    await waitForHealth(API_URL);

    const before = await fetchLeaderboard();
    const beforeCount = getHandlePassCount(before.items, buyerHandle);

    process.stdout.write(`Leaderboard before ${buyerHandle}: ${beforeCount}\n`);
    process.stdout.write("Running paid buyer pass...\n");

    const buyer = spawnProcess("npm", ["run", "test:e2e:buyer"], {
      env: {
        ...process.env,
        BUYER_API_URL: `${API_URL}/joint/pass`
      }
    });

    const buyerExitCode = await new Promise((resolve) => {
      buyer.on("exit", (code) => resolve(code));
    });

    if (buyerExitCode !== 0) {
      throw new Error(`Buyer script failed with code ${buyerExitCode}`);
    }

    const after = await fetchLeaderboard();
    const afterCount = getHandlePassCount(after.items, buyerHandle);

    process.stdout.write(`Leaderboard after ${buyerHandle}: ${afterCount}\n`);

    if (afterCount <= beforeCount) {
      throw new Error(
        `Verification failed: expected leaderboard totalPasses for ${buyerHandle} to increase`
      );
    }

    process.stdout.write("Verification passed: leaderboard changed after paid pass.\n");
  } finally {
    if (!serverExited) {
      server.kill("SIGTERM");
      await delay(500);
    }
  }
}

run().catch((error) => {
  process.stderr.write(`verify-paid-pass failed: ${error?.message || String(error)}\n`);
  process.exit(1);
});
