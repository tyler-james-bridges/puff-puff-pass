export const PASS_FEE_USD = process.env.PASS_FEE_USD || "0.00402";

export const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";

export const FACILITATOR_URL_ABSTRACT =
  process.env.FACILITATOR_URL_ABSTRACT ||
  "https://facilitator.x402.abs.xyz";

export const X402_NETWORKS = (
  process.env.X402_NETWORKS ||
  process.env.X402_NETWORK ||
  "eip155:8453"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const PAY_TO =
  process.env.PAY_TO || "0x0000000000000000000000000000000000000000";

export const ABSTRACT_PAY_TO =
  process.env.ABSTRACT_PAY_TO || PAY_TO;

export const ABSTRACT_USDC_ASSET =
  process.env.ABSTRACT_USDC_ASSET ||
  "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1";

export const ABSTRACT_USDC_NAME =
  process.env.ABSTRACT_USDC_NAME || "Bridged USDC (Stargate)";

export const ABSTRACT_USDC_VERSION =
  process.env.ABSTRACT_USDC_VERSION || "2";

export const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
export const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
