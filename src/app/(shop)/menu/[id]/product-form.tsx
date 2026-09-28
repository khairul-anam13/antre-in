"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, List } from "@/components/ios";
import { useCart } from "@/components/cart";
import { rupiah } from "@/lib/format";
import type { MenuProduct } from "@/lib/menu";
import type { Product } from "@/lib/pricing.ts";

export function ProductForm({ product, color }: { product: Product & MenuProduct; color: string }) {
  const cart = useCart();
  const router = useRouter();
  const [sel, setSel] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(product.groups.map((g) => [g.id, g.options.filter((o) => o.is_default && o.is_available).slice(0, g.kind === "single" ? 1 : 99).map((o) => o.id)])));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const picked = product.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)));
  const unit = product.price + picked.reduce((s, o) => s + o.price_delta, 0);
  const missing = product.groups.find((g) => g.required && !sel[g.id]?.length);

  const toggle = (gid: number, kind: "single" | "multi", required: boolean, oid: number) =>
    setSel((cur) => {
      const has = cur[gid]?.includes(oid);
      if (kind === "single") return { ...cur, [gid]: has && !required ? [] : [oid] };
      return { ...cur, [gid]: has ? cur[gid].filter((x) => x !== oid) : [...(cur[gid] ?? []), oid] };
    });

  const add = () => {
    cart.add({ productId: product.id, name: product.name, unit, qty, optionIds: picked.map((o) => o.id), optionLabels: picked.map((o) => o.name), note: note.trim(), color });
    cart.toast(`${product.name} ditambahkan`);
    router.push("/");
  };

  return (
    <div className="page stack-lg pt-16">
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="tile tile--lg" style={{ ["--c" as string]: `var(${color})` }}>
          {product.image_url ? <img src={product.image_url} alt="" referrerPolicy="no-referrer" /> : <Icon name="cup" />}
        </div>
        <div className="grow">
          <h1 className="t-title2">{product.name}</h1>
          <p className="t-sub muted mt-8">{product.description}</p>
          <p className="t-headline t-num mt-8">{rupiah(product.price)}</p>
        </div>
      </div>

      {product.groups.map((g) => (
        <List key={g.id} header={g.name} footer={g.required ? "Wajib dipilih" : g.kind === "multi" ? "Boleh pilih lebih dari satu" : "Opsional"}>
          {g.options.map((o) => {
            const on = !!sel[g.id]?.includes(o.id);
            return (
              <button key={o.id} type="button" role={g.kind === "single" ? "radio" : "checkbox"} aria-checked={on} disabled={!o.is_available}
                className={`optrow ${g.kind === "multi" ? "optrow--multi" : ""}`} onClick={() => toggle(g.id, g.kind, g.required, o.id)}>
                <span className="optrow__mark"><Icon name="check" /></span>
                <span className="grow">{o.name}{!o.is_available && <span className="badge badge--red" style={{ marginLeft: 8 }}>Habis</span>}</span>
                {o.price_delta > 0 && <span className="muted t-num">+{rupiah(o.price_delta)}</span>}
              </button>
            );
          })}
        </List>
      ))}

      <div>
        <label className="label" htmlFor="note">Catatan (opsional)</label>
        <input id="note" className="field" maxLength={100} placeholder="Mis. es dipisah" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="checkout-bar">
        <div className="ios-card ios-card--strong" style={{ padding: 12 }}>
          <div className="row">
            <div className="stepper" aria-label="Jumlah">
              <button type="button" aria-label="Kurangi" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Icon name="minus" /></button>
              <span aria-live="polite">{qty}</span>
              <button type="button" aria-label="Tambah" disabled={qty >= 20} onClick={() => setQty(qty + 1)}><Icon name="plus" /></button>
            </div>
            <Button size="large" className="grow" style={{ minWidth: 0 }} disabled={!product.is_available || !!missing} onClick={add}>
              {!product.is_available ? "Sedang habis" : missing ? `Pilih ${missing.name}` : `Tambah · ${rupiah(unit * qty)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
