import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const KEY = process.env.MIDTRANS_SERVER_KEY ?? "";
const PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";
const SNAP = PROD ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";
const API = PROD ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2";
const auth = () => "Basic " + Buffer.from(KEY + ":").toString("base64");

export const midtransEnabled = !!KEY;
/** Simulasi pembayaran: hanya bila kunci kosong DAN bukan produksi — tidak pernah aktif di Vercel. */
export const mockPayments = !KEY && process.env.NODE_ENV !== "production";

export type PayLine = { id: string; name: string; price: number; quantity: number };

/** Membuat transaksi Snap dan mengembalikan URL pembayaran (redirect). */
export async function createPayment(o: { orderId: string; total: number; name: string; phone: string; lines: PayLine[]; expiryMinutes: number; finishUrl: string }) {
  const r = await fetch(SNAP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: auth() },
    body: JSON.stringify({
      transaction_details: { order_id: o.orderId, gross_amount: o.total },
      item_details: o.lines.map((l) => ({ ...l, name: l.name.slice(0, 50) })),
      customer_details: { first_name: o.name.slice(0, 50), phone: o.phone },
      expiry: { unit: "minutes", duration: o.expiryMinutes },
      callbacks: { finish: o.finishUrl },
    }),
  });
  const j = (await r.json()) as { redirect_url?: string; error_messages?: string[] };
  if (!r.ok || !j.redirect_url) throw new Error(`Midtrans: ${j.error_messages?.join(", ") ?? r.status}`);
  return j.redirect_url;
}

export type PayState = "paid" | "pending" | "failed";
const map = (s: string, fraud?: string): PayState =>
  s === "settlement" || (s === "capture" && fraud !== "challenge") ? "paid" : s === "pending" || s === "capture" ? "pending" : "failed";

/** Cek status ke Midtrans (cadangan bila webhook tidak sampai, mis. di localhost). */
export async function checkStatus(orderId: string): Promise<PayState | null> {
  const r = await fetch(`${API}/${orderId}/status`, { headers: { accept: "application/json", authorization: auth() } });
  const j = (await r.json()) as { transaction_status?: string; fraud_status?: string; status_code?: string };
  if (j.status_code === "404" || !j.transaction_status) return null;
  return map(j.transaction_status, j.fraud_status);
}

type Notif = { order_id: string; status_code: string; gross_amount: string; signature_key: string; transaction_status: string; fraud_status?: string };

/** Webhook: tanda tangan = sha512(order_id + status_code + gross_amount + server key). */
export function parseNotification(b: Notif): { orderId: string; state: PayState } | null {
  if (!b?.order_id || !b.signature_key) return null;
  const want = createHash("sha512").update(b.order_id + b.status_code + b.gross_amount + KEY).digest("hex");
  const a = Buffer.from(want), c = Buffer.from(String(b.signature_key));
  if (!KEY || a.length !== c.length || !timingSafeEqual(a, c)) return null;
  return { orderId: b.order_id, state: map(b.transaction_status, b.fraud_status) };
}
