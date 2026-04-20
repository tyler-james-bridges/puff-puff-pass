import { NextResponse } from "next/server";
import {
  FACILITATOR_URL,
  FACILITATOR_URL_ABSTRACT,
  X402_NETWORKS,
  PAY_TO,
  PASS_FEE_USD,
} from "@/lib/server/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "puff-puff-pass-api",
    now: new Date().toISOString(),
    storage: process.env.DATABASE_URL ? "postgres" : "pglite",
    x402: {
      facilitatorUrl: FACILITATOR_URL,
      facilitatorUrlAbstract: FACILITATOR_URL_ABSTRACT,
      networks: X402_NETWORKS,
      payTo: PAY_TO,
      feeUsd: PASS_FEE_USD,
    },
  });
}
