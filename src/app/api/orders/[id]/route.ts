import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getOrderFor } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Polling status pesanan (dipakai halaman pelacakan). Akses: token di query atau pemilik akun. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get("t");
  const order = await getOrderFor(id, t, await getUser());
  return order
    ? NextResponse.json(order, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
}
