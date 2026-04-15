import "dotenv/config";
import { wrapFetchWithPayment, decodePaymentResponseHeader, x402Client } from "@x402/fetch";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
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

const account = privateKeyToAccount(EVM_PRIVATE_KEY);
const signer = toClientEvmSigner(account);

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

  process.stdout.write(`HTTP ${response.status}\n`);
  if (paymentResponse) {
    const decoded = decodePaymentResponseHeader(paymentResponse);
    process.stdout.write(`PAYMENT-RESPONSE: ${JSON.stringify(decoded)}\n`);
  }

  process.stdout.write(`Body: ${bodyText}\n`);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Buyer E2E failed: ${error?.message || String(error)}\n`);
  process.exit(1);
});
