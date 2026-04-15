import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader, x402Client } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { createPublicClient, http } from "viem";
import { abstract, abstractTestnet, base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const {
  EVM_PRIVATE_KEY,
  BUYER_API_URL = "http://localhost:4020/api/joint/pass",
  BUYER_HANDLE = "tmoney_145",
  BUYER_MESSAGE = "puff puff pass",
  BUYER_X402_NETWORK = "eip155:*"
} = process.env;

if (!EVM_PRIVATE_KEY) {
  process.stderr.write("Missing EVM_PRIVATE_KEY in environment.\n");
  process.exit(1);
}

function getViemChain(network) {
  switch (network) {
    case "eip155:2741":
      return abstract;
    case "eip155:11124":
      return abstractTestnet;
    case "eip155:84532":
      return baseSepolia;
    case "eip155:8453":
      return base;
    default:
      return null;
  }
}

const account = privateKeyToAccount(EVM_PRIVATE_KEY);
const wildcardFallbackNetwork =
  process.env.X402_NETWORK ||
  process.env.X402_NETWORKS?.split(",").map((item) => item.trim()).filter(Boolean)[0] ||
  "eip155:8453";
const selectedNetwork = BUYER_X402_NETWORK === "eip155:*" ? wildcardFallbackNetwork : BUYER_X402_NETWORK;
const selectedChain = getViemChain(selectedNetwork);

if (!selectedChain) {
  process.stderr.write(
    `Unsupported BUYER_X402_NETWORK '${selectedNetwork}'. Use one of: eip155:8453, eip155:84532, eip155:2741, eip155:11124\n`
  );
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: selectedChain,
  transport: http()
});

const signer = toClientEvmSigner(account, publicClient);

const client = new x402Client();
registerExactEvmScheme(client, {
  signer,
  networks: BUYER_X402_NETWORK === "eip155:*" ? undefined : [BUYER_X402_NETWORK]
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function main() {
  process.stdout.write(`Running buyer E2E against ${BUYER_API_URL}\n`);
  process.stdout.write(`Handle: ${BUYER_HANDLE}\n`);

  const response = await fetchWithPayment(BUYER_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      handle: BUYER_HANDLE,
      message: BUYER_MESSAGE
    })
  });

  const bodyText = await response.text();
  const paymentResponse = response.headers.get("payment-response");
  const paymentRequired = response.headers.get("payment-required");

  process.stdout.write(`HTTP ${response.status}\n`);
  if (paymentResponse) {
    const decoded = decodePaymentResponseHeader(paymentResponse);
    process.stdout.write(`PAYMENT-RESPONSE: ${JSON.stringify(decoded)}\n`);
  }
  if (paymentRequired) {
    process.stdout.write(`PAYMENT-REQUIRED: ${paymentRequired}\n`);
  }

  process.stdout.write(`Body: ${bodyText}\n`);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Buyer E2E failed: ${error?.stack || error?.message || String(error)}\n`);
  process.exit(1);
});
