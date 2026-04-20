import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { PASS_FEE_USD } from "@/lib/server/config";
import { withPayPass } from "@/lib/server/x402";

async function handler(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const handle = body?.handle;
  if (
    !handle ||
    typeof handle !== "string" ||
    !/^[a-zA-Z0-9_]{1,50}$/.test(handle)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "handle is required and must match ^[a-zA-Z0-9_]{1,50}$",
      },
      { status: 400 }
    );
  }

  const paymentSignature = req.headers.get("payment-signature");
  const txHash =
    typeof body.txHash === "string" ? body.txHash : "pending";
  const message =
    typeof body.message === "string" ? body.message : null;

  try {
    const store = await getStore();
    const result = await store.applyPass({
      handle,
      amountUsd: PASS_FEE_USD,
      txHash,
      paymentSignature,
      message,
    });

    return NextResponse.json({
      ok: true,
      event: result.event,
      current: await store.getCurrent(),
      leaderboardTop10: result.leaderboard.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 }
    );
  }
}

export const POST = withPayPass(handler);
