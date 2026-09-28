"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Icon, List, SearchField } from "@/components/ios";
import { rupiah } from "@/lib/format";
import type { Category, MenuProduct } from "@/lib/menu";
import { catColor } from "@/lib/palette";

export function MenuList({ categories, products }: { categories: Category[]; products: MenuProduct[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | null>(null);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = products.filter((p) => (cat == null || p.category_id === cat) && (!needle || `${p.name} ${p.description}`.toLowerCase().includes(needle)));
    const list = categories.map((c) => ({ c, items: shown.filter((p) => p.category_id === c.id) }));
    const loose = shown.filter((p) => !categories.some((c) => c.id === p.category_id));
    if (loose.length) list.push({ c: { id: 0, name: "Lainnya" }, items: loose });
    return list.filter((g) => g.items.length);
  }, [categories, products, q, cat]);

  return (
    <>
      <div className="sticky-bar">
        <div className="page"><SearchField placeholder="Cari minuman" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari minuman" /></div>
        <div className="chips" role="tablist" aria-label="Kategori">
          <Button size="medium" variant={cat == null ? "filled" : "gray"} onClick={() => setCat(null)} role="tab" aria-selected={cat == null}>Semua</Button>
          {categories.map((c) => (
            <Button key={c.id} size="medium" variant={cat === c.id ? "filled" : "gray"} onClick={() => setCat(c.id)} role="tab" aria-selected={cat === c.id}>{c.name}</Button>
          ))}
        </div>
      </div>

      <div className="page mt-8">
        {groups.length === 0 && <p className="empty">Tidak ada menu yang cocok.</p>}
        {groups.map(({ c, items }) => (
          <List key={c.id} header={c.name}>
            {items.map((p) => (
              <Link key={p.id} href={`/menu/${p.id}`} className="product" aria-disabled={!p.is_available} tabIndex={p.is_available ? undefined : -1}>
                <div className="tile" style={{ ["--c" as string]: `var(${catColor(categories, p.category_id)})` }}>
                  {p.image_url ? <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon name="cup" />}
                </div>
                <div className="product__body">
                  <div className="t-headline">{p.name}</div>
                  <div className="t-sub muted product__desc">{p.description}</div>
                </div>
                <div className="right">
                  <div className="t-headline t-num">{rupiah(p.price)}</div>
                  {!p.is_available && <span className="badge badge--red">Habis</span>}
                </div>
              </Link>
            ))}
          </List>
        ))}
      </div>
    </>
  );
}
