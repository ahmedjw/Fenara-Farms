import { NextResponse } from "next/server";
import { treeHoldsForDisplay } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which trees are taken, right now.
 *
 * The picker holds a snapshot from when the page was rendered, and someone
 * choosing their trees can easily sit with it for ten minutes. Without this
 * the first they hear of a tree going is the error at checkout, which is
 * exactly the complaint that started this. The map asks again while it is
 * open, so a tree greys out under them instead.
 */
export async function GET() {
  const holds = await treeHoldsForDisplay();
  return NextResponse.json(holds, {
    headers: { "Cache-Control": "no-store" },
  });
}
