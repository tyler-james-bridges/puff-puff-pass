import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
    return NextResponse.json(
      { ok: false, error: "Invalid handle format" },
      { status: 400 }
    );
  }
  try {
    const store = await getStore();
    const stats = await store.getHandleStats(handle);
    if (!stats) {
      return NextResponse.json(
        { ok: false, error: "Handle not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, item: stats });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "internal error" },
      { status: 500 }
    );
  }
}
