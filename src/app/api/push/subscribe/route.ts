import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getOrderFor } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Body = { orderId?: string; token?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };

/** Simpan langganan web push untuk satu pesanan (harus pemilik / pemegang token). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Body | null;
  const s = b?.subscription;
  if (!b?.orderId || !s?.endpoint || !s.keys?.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000)
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const order = await getOrderFor(b.orderId, b.token ?? null, await getUser());
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const [{ n }] = await sql`select count(*)::int n from push_subs where order_id = ${order.id}`;
  if (n >= 5) return NextResponse.json({ error: "Terlalu banyak perangkat" }, { status: 429 });
  await sql`insert into push_subs (endpoint, order_id, p256dh, auth) values (${s.endpoint}, ${order.id}, ${s.keys.p256dh}, ${s.keys.auth})
            on conflict (order_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
  return NextResponse.json({ ok: true });
}
