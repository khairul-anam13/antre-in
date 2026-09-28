import "server-only";
import webpush from "web-push";
import { sql } from "./db";

const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const enabled = !!(pub && priv);
if (enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@antre.in", pub!, priv!);

export const vapidPublicKey = enabled ? pub! : null;

/** Kirim notifikasi ke semua perangkat yang berlangganan pesanan ini. Langganan mati (404/410) dibersihkan. */
export async function pushOrder(orderId: string, payload: { title: string; body: string; url: string }) {
  if (!enabled) return;
  const subs = await sql`select endpoint, p256dh, auth from push_subs where order_id = ${orderId}`;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`delete from push_subs where endpoint = ${s.endpoint}`;
    }
  }));
}
