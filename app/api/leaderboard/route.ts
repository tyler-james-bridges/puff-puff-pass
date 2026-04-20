import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET() {
  try {
    const store = await getStore();
    return NextResponse.json({
      ok: true,
      items: await store.getLeaderboard(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 }
    );
  }
}
