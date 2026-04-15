const USDC_BASE_UNITS = 1_000_000;

export function usdToBaseUnits(amountUsd) {
  const parsed = Number(amountUsd);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid USD amount: ${amountUsd}`);
  }
  return Math.round(parsed * USDC_BASE_UNITS).toString();
}

export function buildPaymentRequiredHeader({ baseUrl, amountUsd }) {
  const amount = usdToBaseUnits(amountUsd);

  const challenge = {
    x402Version: 2,
    resource: {
      url: `${baseUrl}/api/joint/pass`,
      method: "POST",
      description: "Pay to pass the virtual joint and claim the live spot.",
      mimeType: "application/json"
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount,
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x0000000000000000000000000000000000000000",
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2"
        }
      }
    ]
  };

  return Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
}

export function verifyPaymentSignature(signatureHeader) {
  // TODO: replace with facilitator or local verification in production.
  return typeof signatureHeader === "string" && signatureHeader.trim().length > 0;
}

