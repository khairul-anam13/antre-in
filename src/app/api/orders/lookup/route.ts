import { NextResponse } from "next/server";
import { listOrdersByRefs } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Daftar pesanan tamu dari referensi {id, token} yang tersimpan di browser. Token yang salah diabaikan diam-diam. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { refs?: { id: string; token: string }[] } | null;
  const orders = await listOrdersByRefs(Array.isArray(body?.refs) ? body!.refs : []);
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
