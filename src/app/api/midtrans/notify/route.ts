import { NextResponse } from "next/server";
import { parseNotification } from "@/lib/midtrans";
import { cancelUnpaid, markPaid } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Webhook Midtrans (isi URL ini di Dashboard › Settings › Payment › Notification URL). Tanda tangan diverifikasi. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const n = body && parseNotification(body);
  if (!n) return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  if (n.state === "paid") await markPaid(n.orderId);
  else if (n.state === "failed") await cancelUnpaid(n.orderId);
  return NextResponse.json({ ok: true });
}
