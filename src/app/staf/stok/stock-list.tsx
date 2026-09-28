"use client";
import { useState } from "react";
import { List, ListRow, Switch } from "@/components/ios";
import { setAvailable } from "../actions";

type Item = { id: number; name: string; on: boolean; group: string };

export function StockList({ products, options }: { products: Item[]; options: Item[] }) {
  const [state, setState] = useState<Record<string, boolean>>(() => Object.fromEntries([...products.map((p) => [`product:${p.id}`, p.on]), ...options.map((o) => [`option:${o.id}`, o.on])]));

  const toggle = async (kind: "product" | "option", id: number, v: boolean) => {
    const k = `${kind}:${id}`;
    setState((s) => ({ ...s, [k]: v })); // optimistis
    try { await setAvailable(kind, id, v); } catch { setState((s) => ({ ...s, [k]: !v })); }
  };
  const groups = (items: Item[]) => [...new Set(items.map((i) => i.group))];

  const block = (kind: "product" | "option", items: Item[], title: string) =>
    groups(items).map((g) => (
      <List key={`${kind}-${g}`} header={`${title} · ${g}`}>
        {items.filter((i) => i.group === g).map((i) => (
          <ListRow key={i.id} title={i.name} subtitle={state[`${kind}:${i.id}`] ? undefined : "Habis"}
            accessory={<Switch checked={state[`${kind}:${i.id}`]} aria-label={`${i.name} tersedia`} onChange={(v) => toggle(kind, i.id, v)} />} />
        ))}
      </List>
    ));

  return <>{block("product", products, "Menu")}{block("option", options, "Opsi")}</>;
}
