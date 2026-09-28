// Tes integrasi jalur uang & antrean terhadap Postgres NYATA (bukan mock).
// Jalankan: npm run test:db   (butuh database kosong berskema; default antre_in_test di port 5433, atau set TEST_DATABASE_URL)
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://antre@127.0.0.1:5433/antre_in_test";
delete process.env.MIDTRANS_SERVER_KEY; // paksa mode simulasi
const { sql } = await import("../../src/lib/db.ts");
const o = await import("../../src/lib/orders.ts");

const phone = "081234567890";
let defaults: number[] = [];
const item = (productId = 1, qty = 1) => ({ productId, qty, optionIds: defaults, note: "" });
const order = (over: Partial<Parameters<typeof o.createOrder>[0]> = {}) =>
  o.createOrder({ items: [item()], name: "Uji", phone, user: null, ...over }, "http://localhost");

beforeEach(async () => {
  await sql`truncate orders, queue_counters restart identity cascade`;
  await sql`update vouchers set used_count = 0, max_uses = null`;
  await sql`update products set is_available = true`;
  await sql`update options set is_available = true`;
  await sql`update settings set is_open = true, open_time = '00:00', close_time = '23:59', slot_minutes = 5, slot_capacity = 3,
            min_schedule_minutes = 0, drinks_per_minute = 2, max_drinks_per_order = 20`;
  defaults = (await sql`select id from options where group_id in (1, 2, 3) and is_default order by id`).map((r) => r.id);
});
after(() => sql.end());

test("nomor antrean berurutan dan markPaid idempoten", async () => {
  const [a, b] = [await order(), await order()];
  await o.markPaid(a.id); await o.markPaid(a.id); await o.markPaid(b.id);
  const rows = await sql`select queue_no, status from orders order by created_at`;
  assert.deepEqual(rows.map((r) => r.queue_no), [1, 2]);
  assert.ok(rows.every((r) => r.status === "queued"));
});

test("akses pesanan: token salah ditolak, token benar / staf diterima", async () => {
  const a = await order();
  assert.equal(await o.getOrderFor(a.id, "salah", null), null);
  assert.equal(await o.getOrderFor(a.id, null, null), null);
  assert.equal((await o.getOrderFor(a.id, a.token, null))?.status, "awaiting_payment");
  assert.equal((await o.getOrderFor(a.id, null, { id: "x", email: null, name: "", phone: null, role: "barista" }))?.id, a.id);
});

test("kuota voucher: habis menolak, dikembalikan saat pesanan kedaluwarsa", async () => {
  await sql`update vouchers set max_uses = 1 where code = 'KOPIPAGI'`;
  const first = await order({ voucher: "kopipagi" });
  await assert.rejects(order({ voucher: "KOPIPAGI" }), /[Kk]uota voucher/);
  await sql`update orders set payment_expires_at = now() - interval '1 minute' where id = ${first.id}`;
  await o.sweepExpired();
  const [v] = await sql`select used_count from vouchers where code = 'KOPIPAGI'`;
  assert.equal(v.used_count, 0);
  assert.equal((await sql`select status from orders where id = ${first.id}`)[0].status, "expired");
  await order({ voucher: "KOPIPAGI" }); // kuota kembali
});

test("harga dihitung server & diskon tercatat", async () => {
  const a = await order({ voucher: "KOPIPAGI" });
  const [r] = await sql`select subtotal, discount, total from orders where id = ${a.id}`;
  assert.deepEqual({ ...r }, { subtotal: 22000, discount: 5000, total: 17000 });
});

test("kuota slot terjadwal ditegakkan", async (t) => {
  const { slots } = await o.getPickupOptions(1);
  if (!slots.length) return t.skip("tidak ada slot tersisa hari ini (tes dijalankan mendekati tengah malam)");
  const start = slots[0].start;
  await order({ items: [item(8, 3)], slot: start }); // isi penuh (kapasitas 3)
  await assert.rejects(order({ items: [item(8, 1)], slot: start }), /penuh|tersisa/);
  const after = (await o.getPickupOptions(1)).slots.find((s) => s.start === start)!;
  assert.equal(after.full, true);
  await assert.rejects(order({ slot: "2000-01-01T00:00:00.000Z" }), /tidak tersedia/);
});

test("menu / opsi habis, kedai tutup, dan batas jumlah ditolak", async () => {
  await sql`update products set is_available = false where id = 8`;
  await assert.rejects(order({ items: [item(8)] }), /habis/);
  await sql`update products set is_available = true`;
  await sql`update options set is_available = false where id = ${defaults[0]}`;
  await assert.rejects(order(), /habis/);
  await sql`update options set is_available = true`;
  await sql`update settings set is_open = false`;
  await assert.rejects(order(), /tutup/);
  await sql`update settings set is_open = true, max_drinks_per_order = 2`;
  await assert.rejects(order({ items: [item(8, 3)] }), /Maksimal 2/);
  await assert.rejects(order({ phone: "abc" }), /Nomor HP/);
  await assert.rejects(order({ name: "  " }), /nama/i);
});

test("transisi status hanya maju & estimasi mengikuti antrean", async () => {
  const [a, b] = [await order({ items: [item(8, 4)] }), await order({ items: [item(8, 4)] })];
  await o.markPaid(a.id); await o.markPaid(b.id);
  // 8 minuman di dapur, kecepatan 2/menit → pesanan baru 1 minuman ≈ ceil(9/2) = 5 menit
  assert.equal((await o.getPickupOptions(1)).asapMinutes, 5);
  assert.equal(await o.setStatus(a.id, "ready"), true);
  assert.equal(await o.setStatus(a.id, "preparing"), false);
  assert.equal(await o.setStatus(a.id, "cancelled"), true); // batal dari 'ready' diizinkan (kasir)
  assert.equal(await o.setStatus(a.id, "picked_up"), false);
  assert.equal((await o.getPickupOptions(1)).asapMinutes, 3); // tinggal 4 minuman → ceil(5/2)
});

test("konkurensi: 6 pemesan berebut slot berkuota 3 → tepat 3 berhasil; markPaid ganda → 1 nomor", async (t) => {
  const { slots } = await o.getPickupOptions(1);
  if (!slots.length) return t.skip("tidak ada slot tersisa hari ini");
  const res = await Promise.allSettled(Array.from({ length: 6 }, () => order({ items: [item(8, 1)], slot: slots[0].start })));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 3);

  const a = await order();
  await Promise.all([o.markPaid(a.id), o.markPaid(a.id), o.markPaid(a.id)]);
  const rows = await sql`select queue_no from orders where id = ${a.id}`;
  assert.equal(rows[0].queue_no, 1);
  assert.equal((await sql`select last from queue_counters`)[0].last, 1);
});

test("pembayaran yang telat (setelah kedaluwarsa) tetap diterima", async () => {
  const a = await order();
  await sql`update orders set payment_expires_at = now() - interval '1 minute' where id = ${a.id}`;
  await o.sweepExpired();
  await o.markPaid(a.id);
  assert.equal((await sql`select status from orders where id = ${a.id}`)[0].status, "queued");
});
