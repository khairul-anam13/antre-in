import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { sql, type Sql } from "./db";
import { getSettings, loadProducts } from "./menu";
import { PriceError, priceLine, voucherDiscount, type LineInput, type PricedLine, type Voucher } from "./pricing.ts";
import { buildSlots, estimateMinutes, findSlot, isOpenNow, midnightWIB, type Slot } from "./slots.ts";
import { checkStatus, createPayment, midtransEnabled, mockPayments } from "./midtrans";
import { pushOrder } from "./push";
import { queueLabel } from "./format";
import type { User } from "./auth";

export { PriceError };

/* ---------- Keranjang → harga (selalu dihitung ulang di server) ---------- */

export function parseItems(raw: unknown): LineInput[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) throw new PriceError("Keranjang masih kosong");
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const optionIds = Array.isArray(o.optionIds) ? o.optionIds.map(Number) : [];
    if (optionIds.some((n) => !Number.isInteger(n))) throw new PriceError("Opsi tidak valid");
    return { productId: Number(o.productId), qty: Number(o.qty), optionIds, note: typeof o.note === "string" ? o.note : "" };
  });
}

export type Quote = { lines: PricedLine[]; subtotal: number; discount: number; total: number; voucher: string | null; drinks: number };

export async function quote(items: LineInput[], voucherCode: string | undefined, db: Sql = sql): Promise<Quote> {
  const products = await loadProducts(items.map((i) => i.productId), db);
  const lines = items.map((i) => priceLine(products.find((p) => p.id === i.productId), i));
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const drinks = lines.reduce((s, l) => s + l.qty, 0);
  let discount = 0;
  let voucher: string | null = null;
  const code = voucherCode?.trim().toUpperCase();
  if (code) {
    const [v] = await db<Voucher[]>`select * from vouchers where code = ${code}`;
    discount = voucherDiscount(v, subtotal, new Date());
    voucher = code;
  }
  return { lines, subtotal, discount, total: subtotal - discount, voucher, drinks };
}

/* ---------- Slot & estimasi ---------- */

/** Minuman yang sudah di dapur dan harus selesai lebih dulu (pesanan langsung + terjadwal yang sudah jatuh tempo). */
async function drinksAhead(db: Sql, leadMinutes: number, beforePaidAt?: Date) {
  const [r] = await db`
    select coalesce(sum(i.qty), 0)::int as drinks, count(distinct o.id)::int as orders
    from orders o join order_items i on i.order_id = o.id
    where o.status in ('queued','preparing')
      and (o.scheduled_for is null or o.scheduled_for <= now() + make_interval(mins => ${leadMinutes}::int))
      and (${beforePaidAt ?? null}::timestamptz is null or o.paid_at < ${beforePaidAt ?? null}::timestamptz)`;
  return r as { drinks: number; orders: number };
}

async function usedBySlot(db: Sql, now: Date) {
  const day = midnightWIB(now);
  const rows = await db`
    select o.scheduled_for, sum(i.qty)::int as n from orders o join order_items i on i.order_id = o.id
    where o.scheduled_for >= ${new Date(day)} and o.scheduled_for < ${new Date(day + 86400_000)}
      and (o.status in ('queued','preparing','ready','picked_up') or (o.status = 'awaiting_payment' and o.payment_expires_at > now()))
    group by 1`;
  return Object.fromEntries(rows.map((r) => [(r.scheduled_for as Date).toISOString(), r.n as number]));
}

export type Pickup = { open: boolean; shopName: string; asap: boolean; asapMinutes: number | null; slots: Slot[]; closedNote: string | null };

/** Opsi pengambilan untuk keranjang: sekarang (dengan estimasi) dan slot terjadwal. */
export async function getPickupOptions(drinks: number, db: Sql = sql): Promise<Pickup> {
  const s = await getSettings(db);
  const now = new Date();
  const asap = isOpenNow({ now, open: s.open_time, close: s.close_time, isOpen: s.is_open });
  const slots = s.is_open
    ? buildSlots({ now, open: s.open_time, close: s.close_time, slotMinutes: s.slot_minutes, minLeadMinutes: s.min_schedule_minutes, capacity: s.slot_capacity, used: await usedBySlot(db, now) })
    : [];
  const ahead = asap ? await drinksAhead(db, s.schedule_lead_minutes) : null;
  return {
    open: asap, shopName: s.shop_name, asap,
    asapMinutes: ahead ? estimateMinutes(ahead.drinks, Math.max(1, drinks), s.drinks_per_minute) : null,
    slots,
    closedNote: !s.is_open ? "Kedai sedang tutup." : asap ? null : slots.length ? `Kedai buka pukul ${s.open_time.slice(0, 5)}. Pesan terjadwal tersedia.` : "Kedai sudah tutup untuk hari ini.",
  };
}

/* ---------- Membuat pesanan ---------- */

const cleanPhone = (p: string) => p.replace(/[\s\-().]/g, "");

// Rate limit anti-spam: dihitung dari baris orders (berhasil ATAU tidak) yang sudah tersimpan — sengaja lewat DB,
// bukan Map di memori, supaya tetap benar walau aplikasi jalan di banyak instance serverless (Vercel).
const ORDER_RATE_WINDOW_MIN = 10;
const ORDER_RATE_MAX = 3; // percobaan per nomor HP ATAU per alamat IP dalam jendela waktu ini

async function checkOrderRateLimit(tx: Sql, phone: string, ip: string | null) {
  const [{ n }] = await tx`
    select count(*)::int n from orders
    where created_at > now() - make_interval(mins => ${ORDER_RATE_WINDOW_MIN}::int)
      and (customer_phone = ${phone} or client_ip = ${ip})`;
  if (n >= ORDER_RATE_MAX) throw new PriceError("Terlalu banyak percobaan memesan. Coba lagi dalam beberapa menit.");
}

export type NewOrder = { items: LineInput[]; voucher?: string; name: string; phone: string; note?: string; slot?: string | null; user: User | null; ip?: string | null };

export async function createOrder(input: NewOrder, appUrl: string): Promise<{ id: string; token: string; url: string }> {
  const name = input.name.trim();
  const phone = cleanPhone(input.phone);
  const ip = input.ip ?? null;
  if (name.length < 1 || name.length > 60) throw new PriceError("Isi nama pemesan");
  if (!/^\+?\d{8,15}$/.test(phone)) throw new PriceError("Nomor HP tidak valid");
  if (!midtransEnabled && !mockPayments) throw new PriceError("Pembayaran online belum dikonfigurasi");

  const token = randomBytes(24).toString("hex");
  const { id, q, expiry } = await sql.begin(async (t) => {
    const tx = t as unknown as Sql; // TransactionSql dipakai persis seperti Sql
    // ponytail: satu kunci global menyerialkan pembuatan pesanan (cukup untuk 1 kedai). Ganti kunci per-slot bila throughput naik.
    await tx`select pg_advisory_xact_lock(42)`;
    await checkOrderRateLimit(tx, phone, ip);
    const s = await getSettings(tx);
    const q = await quote(input.items, input.voucher, tx);
    if (q.drinks > s.max_drinks_per_order) throw new PriceError(`Maksimal ${s.max_drinks_per_order} minuman per pesanan`);

    let scheduled: Date | null = null;
    if (input.slot) {
      const now = new Date();
      const slot = findSlot(
        s.is_open ? buildSlots({ now, open: s.open_time, close: s.close_time, slotMinutes: s.slot_minutes, minLeadMinutes: s.min_schedule_minutes, capacity: s.slot_capacity, used: await usedBySlot(tx, now) }) : [],
        input.slot,
      );
      if (!slot) throw new PriceError("Jam pengambilan tidak tersedia, pilih jam lain");
      if (slot.remaining < q.drinks) throw new PriceError(slot.full ? "Slot itu sudah penuh, pilih jam lain" : `Slot itu hanya tersisa ${slot.remaining} minuman`);
      scheduled = new Date(slot.start);
    } else if (!isOpenNow({ now: new Date(), open: s.open_time, close: s.close_time, isOpen: s.is_open })) {
      throw new PriceError("Kedai sedang tutup. Pilih jam pengambilan terjadwal.");
    }

    if (q.voucher) {
      const r = await tx`update vouchers set used_count = used_count + 1 where code = ${q.voucher} and (max_uses is null or used_count < max_uses) returning code`;
      if (!r.length) throw new PriceError("Kuota voucher sudah habis");
    }
    const [o] = await tx`
      insert into orders (token, user_id, customer_name, customer_phone, client_ip, subtotal, discount, total, voucher_code, scheduled_for, note, payment_expires_at)
      values (${token}, ${input.user?.id ?? null}, ${name}, ${phone}, ${ip}, ${q.subtotal}, ${q.discount}, ${q.total}, ${q.voucher}, ${scheduled},
              ${(input.note ?? "").trim().slice(0, 200)}, now() + make_interval(mins => ${s.payment_expiry_minutes}::int))
      returning id`;
    await tx`insert into order_items ${tx(q.lines.map((l) => ({ order_id: o.id, product_id: l.productId, name: l.name, unit_price: l.unit_price, qty: l.qty, options: tx.json(l.options), note: l.note })))}`;
    return { id: o.id as string, q, expiry: s.payment_expiry_minutes };
  });

  try {
    const finish = `${appUrl}/pesanan/${id}?t=${token}`;
    let url: string;
    if (mockPayments) url = `/bayar/${id}?t=${token}`;
    else {
      const lines = q.lines.map((l, i) => ({ id: String(i + 1), name: l.name, price: l.unit_price, quantity: l.qty }));
      if (q.discount) lines.push({ id: "diskon", name: `Voucher ${q.voucher}`, price: -q.discount, quantity: 1 });
      url = await createPayment({ orderId: id, total: q.total, name, phone, lines, expiryMinutes: expiry, finishUrl: finish });
    }
    await sql`update orders set pay_ref = ${id}, pay_url = ${url} where id = ${id}`;
    return { id, token, url };
  } catch (e) {
    console.error("createPayment gagal", e);
    await cancelUnpaid(id);
    throw new PriceError("Gagal membuat pembayaran, coba lagi sebentar lagi");
  }
}

/* ---------- Pembayaran ---------- */

async function releaseVoucher(code: string | null | undefined, n = 1) {
  if (code) await sql`update vouchers set used_count = greatest(used_count - ${n}, 0) where code = ${code}`;
}

export async function cancelUnpaid(id: string) {
  const [o] = await sql`update orders set status = 'cancelled', cancelled_at = now() where id = ${id} and status = 'awaiting_payment' returning voucher_code`;
  if (o) await releaseVoucher(o.voucher_code);
}

/** Pesanan belum dibayar yang lewat batas waktu → kedaluwarsa, kuota voucher dikembalikan. */
export async function sweepExpired() {
  const rows = await sql`update orders set status = 'expired' where status = 'awaiting_payment' and payment_expires_at < now() returning voucher_code`;
  const counts = new Map<string, number>();
  for (const r of rows) if (r.voucher_code) counts.set(r.voucher_code, (counts.get(r.voucher_code) ?? 0) + 1);
  for (const [code, n] of counts) await releaseVoucher(code, n);
}

/** Idempotent. Pembayaran yang masuk sesaat setelah kedaluwarsa tetap diterima (uang sudah masuk). */
export async function markPaid(id: string) {
  await sql.begin(async (t) => {
    const tx = t as unknown as Sql;
    const [o] = await tx`select id, status, scheduled_for from orders where id = ${id} for update`;
    if (!o || (o.status !== "awaiting_payment" && o.status !== "expired")) return;
    const s = await getSettings(tx);
    const [{ day }] = await tx`select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as day`;
    const [{ last }] = await tx`insert into queue_counters (day, last) values (${day}, 1) on conflict (day) do update set last = queue_counters.last + 1 returning last`;
    const [{ n }] = await tx`select sum(qty)::int n from order_items where order_id = ${id}`;
    const ahead = await drinksAhead(tx, s.schedule_lead_minutes);
    await tx`update orders set status = 'queued', paid_at = now(), queue_no = ${last}, queue_day = ${day},
      est_ready_at = coalesce(scheduled_for, now() + make_interval(mins => ${estimateMinutes(ahead.drinks, n, s.drinks_per_minute)}::int))
      where id = ${id}`;
  });
}

const lastCheck = new Map<string, number>();

/** Cadangan webhook: tanya Midtrans langsung (dibatasi 1x / 4 detik per pesanan). */
async function refreshPayment(o: { id: string; status: string; pay_ref: string | null }) {
  if (o.status !== "awaiting_payment" || !o.pay_ref || !midtransEnabled) return;
  const t = Date.now();
  if (t - (lastCheck.get(o.id) ?? 0) < 4000) return;
  lastCheck.set(o.id, t);
  try {
    const st = await checkStatus(o.pay_ref);
    if (st === "paid") await markPaid(o.id);
    else if (st === "failed") await cancelUnpaid(o.id);
  } catch (e) { console.error("checkStatus gagal", e); }
}

/* ---------- Tampilan pesanan (pelanggan) ---------- */

export type OrderItemView = { name: string; qty: number; unit_price: number; options: { group: string; name: string }[]; note: string };
export type OrderView = {
  id: string; status: string; queueNo: number | null; customerName: string; total: number; subtotal: number; discount: number; voucher: string | null;
  scheduledFor: string | null; etaAt: string | null; ahead: number; note: string; createdAt: string; paidAt: string | null; readyAt: string | null;
  payUrl: string | null; paymentExpiresAt: string | null; items: OrderItemView[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function toView(o: Record<string, any>): Promise<OrderView> {
  const items = await sql<OrderItemView[]>`select name, qty, unit_price, options, note from order_items where order_id = ${o.id} order by id`;
  let ahead = 0;
  let etaAt = iso(o.scheduled_for) ?? iso(o.est_ready_at);
  if (o.status === "queued" || o.status === "preparing") {
    const s = await getSettings();
    const a = await drinksAhead(sql, s.schedule_lead_minutes, o.paid_at);
    ahead = a.orders;
    if (!o.scheduled_for) {
      const mine = items.reduce((n, i) => n + i.qty, 0);
      etaAt = new Date(Date.now() + estimateMinutes(a.drinks, mine, s.drinks_per_minute) * 60_000).toISOString();
    }
  }
  return {
    id: o.id, status: o.status, queueNo: o.queue_no, customerName: o.customer_name, total: o.total, subtotal: o.subtotal, discount: o.discount,
    voucher: o.voucher_code, scheduledFor: iso(o.scheduled_for), etaAt: o.status === "ready" || o.status === "picked_up" ? null : etaAt, ahead,
    note: o.note, createdAt: o.created_at.toISOString(), paidAt: iso(o.paid_at), readyAt: iso(o.ready_at),
    payUrl: o.status === "awaiting_payment" ? o.pay_url : null, paymentExpiresAt: iso(o.payment_expires_at), items,
  };
}

const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Akses: pemilik (login) atau pemegang token. Null = tidak ditemukan / tidak berhak. */
export async function getOrderFor(id: string, token: string | null, user: User | null): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  await sweepExpired();
  let [o] = await sql`select * from orders where id = ${id}`;
  if (!o) return null;
  const owner = !!user && o.user_id === user.id;
  const staff = !!user && user.role !== "customer";
  if (!owner && !staff && !(token && sameToken(token, o.token))) return null;
  await refreshPayment(o as { id: string; status: string; pay_ref: string | null });
  [o] = await sql`select * from orders where id = ${id}`;
  return toView(o);
}

export async function listOrdersForUser(userId: string): Promise<OrderView[]> {
  await sweepExpired();
  const rows = await sql`select * from orders where user_id = ${userId} order by created_at desc limit 30`;
  return Promise.all(rows.map(toView));
}

/** Tamu: daftar pesanan dari referensi {id, token} yang tersimpan di browser. */
export async function listOrdersByRefs(refs: { id: string; token: string }[]): Promise<OrderView[]> {
  await sweepExpired();
  const out: OrderView[] = [];
  for (const r of refs.slice(0, 20)) {
    if (typeof r?.id !== "string" || typeof r?.token !== "string" || !/^[0-9a-f-]{36}$/.test(r.id)) continue;
    const [o] = await sql`select * from orders where id = ${r.id}`;
    if (o && sameToken(r.token, o.token)) out.push(await toView(o));
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- Papan staf ---------- */

export type BoardOrder = {
  id: string; status: "queued" | "preparing" | "ready"; queueNo: number; name: string; phone: string; note: string; total: number;
  scheduledFor: string | null; due: boolean; paidAt: string; preparingAt: string | null; readyAt: string | null; items: OrderItemView[];
};

export async function getBoard(): Promise<{ orders: BoardOrder[]; drinksInQueue: number; now: string }> {
  await sweepExpired();
  const s = await getSettings();
  const rows = await sql`
    select *, (scheduled_for is null or scheduled_for <= now() + make_interval(mins => ${s.schedule_lead_minutes}::int)) as due
    from orders where status in ('queued','preparing','ready')
    order by coalesce(scheduled_for, paid_at), paid_at`;
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await sql`select order_id, name, qty, unit_price, options, note from order_items where order_id in ${sql(ids)} order by id` : [];
  const orders = rows.map((o): BoardOrder => ({
    id: o.id, status: o.status, queueNo: o.queue_no, name: o.customer_name, phone: o.customer_phone, note: o.note, total: o.total,
    scheduledFor: iso(o.scheduled_for), due: o.due, paidAt: o.paid_at.toISOString(), preparingAt: iso(o.preparing_at), readyAt: iso(o.ready_at),
    items: items.filter((i) => i.order_id === o.id) as unknown as OrderItemView[],
  }));
  const drinksInQueue = orders.filter((o) => o.status !== "ready" && o.due).reduce((n, o) => n + o.items.reduce((m, i) => m + i.qty, 0), 0);
  return { orders, drinksInQueue, now: new Date().toISOString() };
}

const FLOW = {
  preparing: { from: ["queued"], col: "preparing_at" },
  ready: { from: ["queued", "preparing"], col: "ready_at" },
  picked_up: { from: ["ready"], col: "picked_up_at" },
  cancelled: { from: ["queued", "preparing", "ready"], col: "cancelled_at" },
} as const;
export type NextStatus = keyof typeof FLOW;
export const isNextStatus = (s: unknown): s is NextStatus => typeof s === "string" && s in FLOW;

/** Ubah status; mengembalikan false bila transisi tidak sah (mis. sudah diubah staf lain). Notifikasi dikirim di sini. */
export async function setStatus(id: string, next: NextStatus): Promise<boolean> {
  const f = FLOW[next];
  const [o] = await sql`
    update orders set status = ${next}, ${sql(f.col)} = now() where id = ${id} and status in ${sql([...f.from])}
    returning id, token, queue_no`;
  if (!o) return false;
  const url = `/pesanan/${o.id}?t=${o.token}`;
  if (next === "ready") await pushOrder(o.id, { title: "Pesanan siap diambil!", body: `Nomor ${queueLabel(o.queue_no)} sudah siap. Silakan ke kedai.`, url });
  if (next === "cancelled") await pushOrder(o.id, { title: "Pesanan dibatalkan", body: `Pesanan ${queueLabel(o.queue_no)} dibatalkan oleh kedai. Hubungi kasir untuk pengembalian dana.`, url });
  return true;
}
