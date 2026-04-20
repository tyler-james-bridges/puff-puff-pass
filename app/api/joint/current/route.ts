import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { PASS_FEE_USD } from "@/lib/server/config";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      ok: true,
      passFeeUsd: PASS_FEE_USD,
      ...(await store.getCurrent()),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 }
    );
  }
}
