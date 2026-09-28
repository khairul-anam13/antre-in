import { NextResponse } from "next/server";
import { getUser, isStaff } from "@/lib/auth";
import { getBoard } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Data papan antrean untuk polling layar staf. */
export async function GET() {
  if (!isStaff(await getUser())) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  return NextResponse.json(await getBoard(), { headers: { "Cache-Control": "no-store" } });
}
