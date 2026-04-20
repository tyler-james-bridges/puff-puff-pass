import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json({
    name: "puff puff pass",
    description:
      "Pay $0.00402 USDC to take the joint. Hold it as long as you can. Leaderboard tracks hold time and total spent.",
    url: "https://ppp.0x402.sh",
    endpoints: [
      {
        path: "/api/joint/pass",
        method: "POST",
        description:
          "Pass the joint via x402. Send a POST with {handle} in the body. The server returns 402 with payment requirements. Pay via x402 facilitator, then retry with the payment header.",
        price: "$0.00402 USDC",
        networks: ["eip155:8453", "eip155:2741"],
        paymentProtocol: "x402",
        body: {
          handle: {
            type: "string",
            required: true,
            pattern: "^[a-zA-Z0-9_]{1,50}$",
            description: "Your display name on the leaderboard",
          },
          message: {
            type: "string",
            required: false,
            description: "Optional message to display with your pass",
          },
        },
        response: {
          ok: "boolean",
          event: "pass event object",
          current: "current joint holder",
          leaderboardTop10: "top 10 leaderboard entries",
        },
      },
      {
        path: "/api/joint/current",
        method: "GET",
        description: "Get the current joint holder. Free, no payment required.",
        price: "free",
      },
      {
        path: "/api/leaderboard",
        method: "GET",
        description:
          "Get the leaderboard. Free. Returns rankings with hold time and total spent.",
        price: "free",
      },
    ],
    payment: {
      protocol: "x402",
      facilitators: [
        "https://api.cdp.coinbase.com/platform/v2/x402",
        "https://facilitator.x402.abs.xyz",
      ],
      asset: "USDC",
      networks: {
        "eip155:8453": {
          name: "Base",
          usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x106d79890B914D0cDfA1C7CEb2e41e3635765857",
        },
        "eip155:2741": {
          name: "Abstract",
          usdc: "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1",
          payTo: "0x106d79890B914D0cDfA1C7CEb2e41e3635765857",
        },
      },
    },
  });
}
