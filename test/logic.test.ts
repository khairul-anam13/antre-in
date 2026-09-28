// Jalankan: npm test  (Node 24 menjalankan .ts langsung)
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLine, voucherDiscount, PriceError, type Product, type Voucher } from "../src/lib/pricing.ts";
import { buildSlots, estimateMinutes, isOpenNow, findSlot } from "../src/lib/slots.ts";

const kopi: Product = {
  id: 1, name: "Es Kopi Susu", price: 22000, is_available: true, is_active: true,
  groups: [
    { id: 1, name: "Ukuran", kind: "single", required: true, options: [
      { id: 10, name: "Regular", price_delta: 0, is_available: true },
      { id: 11, name: "Large", price_delta: 5000, is_available: true },
    ] },
    { id: 5, name: "Tambahan", kind: "multi", required: false, options: [
      { id: 50, name: "Extra shot", price_delta: 5000, is_available: true },
      { id: 51, name: "Susu oat", price_delta: 6000, is_available: false },
    ] },
  ],
};

test("priceLine: harga = dasar + selisih opsi, dihitung server", () => {
  const l = priceLine(kopi, { productId: 1, qty: 2, optionIds: [11, 50], note: " less ice " });
  assert.equal(l.unit_price, 32000);
  assert.equal(l.qty, 2);
  assert.equal(l.note, "less ice");
  assert.deepEqual(l.options.map((o) => o.name), ["Large", "Extra shot"]);
});

test("priceLine: menolak input tidak sah", () => {
  const bad = (p: Product | undefined, i: Partial<Parameters<typeof priceLine>[1]>) =>
    assert.throws(() => priceLine(p, { productId: 1, qty: 1, optionIds: [10], ...i }), PriceError);
  bad(kopi, { optionIds: [] });            // grup wajib kosong
  bad(kopi, { optionIds: [10, 11] });      // single dua pilihan
  bad(kopi, { optionIds: [10, 999] });     // opsi asing
  bad(kopi, { optionIds: [10, 51] });      // opsi habis
  bad(kopi, { qty: 0 });
  bad(kopi, { qty: 21 });
  bad(kopi, { qty: 1.5 });
  bad({ ...kopi, is_available: false }, {});
  bad(undefined, {});
});

const v = (o: Partial<Voucher> = {}): Voucher => ({
  code: "X", kind: "percent", value: 10, min_subtotal: 30000, max_discount: 10000, max_uses: null, used_count: 0,
  starts_at: null, ends_at: null, is_active: true, ...o,
});
const now = new Date("2026-09-28T03:00:00Z");

test("voucherDiscount: persen dibatasi max, nominal tidak melebihi subtotal", () => {
  assert.equal(voucherDiscount(v(), 50000, now), 5000);
  assert.equal(voucherDiscount(v(), 200000, now), 10000);
  assert.equal(voucherDiscount(v({ kind: "amount", value: 5000, min_subtotal: 0 }), 3000, now), 3000);
});

test("voucherDiscount: menolak voucher tidak layak", () => {
  for (const [voucher, sub] of [
    [undefined, 50000], [v({ is_active: false }), 50000], [v(), 20000],
    [v({ max_uses: 3, used_count: 3 }), 50000],
    [v({ ends_at: new Date("2026-09-01T00:00:00Z") }), 50000],
    [v({ starts_at: new Date("2026-10-01T00:00:00Z") }), 50000],
  ] as const) assert.throws(() => voucherDiscount(voucher, sub, now), PriceError);
});

const cfg = { open: "08:00", close: "21:00", slotMinutes: 15, minLeadMinutes: 20, capacity: 12, used: {} };

test("buildSlots: mulai setelah jeda, selaras grid, selesai sebelum tutup", () => {
  const s = buildSlots({ ...cfg, now: new Date("2026-09-28T03:07:00Z") }); // 10:07 WIB
  assert.equal(s[0].label, "10:30");
  assert.equal(s.at(-1)!.label, "20:45");
  assert.equal(s.length, 42);
});

test("buildSlots: sebelum buka mulai jam buka; setelah tutup kosong; slot penuh ditandai", () => {
  assert.equal(buildSlots({ ...cfg, now: new Date("2026-09-27T23:00:00Z") })[0].label, "08:00"); // 06:00 WIB
  assert.equal(buildSlots({ ...cfg, now: new Date("2026-09-28T14:30:00Z") }).length, 0);          // 21:30 WIB
  const first = buildSlots({ ...cfg, now: new Date("2026-09-28T03:07:00Z") })[0];
  const s = buildSlots({ ...cfg, now: new Date("2026-09-28T03:07:00Z"), used: { [first.start]: 12 } });
  assert.equal(s[0].full, true);
  assert.equal(s[1].remaining, 12);
  assert.equal(findSlot(s, first.start)?.full, true);
  assert.equal(findSlot(s, "2026-09-28T03:31:00.000Z"), undefined);
});

test("isOpenNow & estimateMinutes", () => {
  const o = { open: "08:00", close: "21:00", isOpen: true };
  assert.equal(isOpenNow({ ...o, now: new Date("2026-09-28T03:00:00Z") }), true);
  assert.equal(isOpenNow({ ...o, now: new Date("2026-09-28T14:00:00Z") }), false); // 21:00 WIB tepat
  assert.equal(isOpenNow({ ...o, isOpen: false, now: new Date("2026-09-28T03:00:00Z") }), false);
  assert.equal(estimateMinutes(5, 2, 2), 4);
  assert.equal(estimateMinutes(0, 1, 2), 1);
});
