import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  try {
    const store = await getStore();
    const url = new URL(req.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 50));
    return NextResponse.json({
      ok: true,
      items: await store.getFeed(limit),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 }
    );
  }
}
