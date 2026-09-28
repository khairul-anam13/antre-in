// Harga & voucher — logika murni (tanpa DB) agar mudah diuji. Server SELALU menghitung ulang; harga dari client tidak dipercaya.
export type Opt = { id: number; name: string; price_delta: number; is_available: boolean; is_default?: boolean };
export type Group = { id: number; name: string; kind: "single" | "multi"; required: boolean; options: Opt[] };
export type Product = { id: number; name: string; price: number; is_available: boolean; is_active: boolean; groups: Group[] };
export type LineInput = { productId: number; qty: number; optionIds: number[]; note?: string };
export type PricedLine = { productId: number; name: string; unit_price: number; qty: number; options: { group: string; name: string; price_delta: number }[]; note: string };
export type Voucher = {
  code: string; kind: "percent" | "amount"; value: number; min_subtotal: number; max_discount: number | null;
  max_uses: number | null; used_count: number; starts_at: Date | null; ends_at: Date | null; is_active: boolean;
};

export class PriceError extends Error {}

export const MAX_QTY_PER_LINE = 20;

export function priceLine(p: Product | undefined, input: LineInput): PricedLine {
  if (!p || !p.is_active) throw new PriceError("Menu tidak ditemukan");
  if (!p.is_available) throw new PriceError(`${p.name} sedang habis`);
  const qty = input.qty;
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) throw new PriceError(`Jumlah ${p.name} tidak valid`);

  const ids = [...new Set(input.optionIds)];
  const chosen: PricedLine["options"] = [];
  let unit = p.price;
  const used = new Set<number>();
  for (const g of p.groups) {
    const picked = g.options.filter((o) => ids.includes(o.id));
    if (g.kind === "single" && picked.length > 1) throw new PriceError(`Pilih satu untuk ${g.name}`);
    if (g.required && picked.length === 0) throw new PriceError(`Pilih ${g.name} untuk ${p.name}`);
    for (const o of picked) {
      if (!o.is_available) throw new PriceError(`${o.name} sedang habis`);
      used.add(o.id);
      unit += o.price_delta;
      chosen.push({ group: g.name, name: o.name, price_delta: o.price_delta });
    }
  }
  if (ids.some((id) => !used.has(id))) throw new PriceError(`Opsi tidak cocok untuk ${p.name}`);
  return { productId: p.id, name: p.name, unit_price: unit, qty, options: chosen, note: (input.note ?? "").trim().slice(0, 100) };
}

export function voucherDiscount(v: Voucher | undefined, subtotal: number, now: Date): number {
  if (!v || !v.is_active) throw new PriceError("Kode voucher tidak valid");
  if (v.starts_at && now < v.starts_at) throw new PriceError("Voucher belum berlaku");
  if (v.ends_at && now > v.ends_at) throw new PriceError("Voucher sudah berakhir");
  if (v.max_uses != null && v.used_count >= v.max_uses) throw new PriceError("Kuota voucher sudah habis");
  if (subtotal < v.min_subtotal) throw new PriceError(`Minimal belanja Rp${v.min_subtotal.toLocaleString("id-ID")} untuk voucher ini`);
  let d = v.kind === "percent" ? Math.floor((subtotal * v.value) / 100) : v.value;
  if (v.kind === "percent" && v.max_discount != null) d = Math.min(d, v.max_discount);
  return Math.min(d, subtotal);
}
