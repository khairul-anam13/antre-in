"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  key: string; productId: number; name: string; unit: number; qty: number;
  optionIds: number[]; optionLabels: string[]; note: string; color: string;
};
type Ctx = {
  items: CartItem[]; count: number; ready: boolean;
  add: (i: Omit<CartItem, "key">) => void; setQty: (key: string, qty: number) => void; remove: (key: string) => void; clear: () => void;
  toast: (msg: string) => void; toastMsg: string | null;
};

const KEY = "antre.cart";
const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart di luar CartProvider");
  return c;
};

const lineKey = (i: Pick<CartItem, "productId" | "optionIds" | "note">) => `${i.productId}|${[...i.optionIds].sort((a, b) => a - b).join(",")}|${i.note}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch { /* storage diblokir */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* abaikan */ }
  }, [items, ready]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const add = useCallback((i: Omit<CartItem, "key">) => {
    const key = lineKey(i);
    setItems((cur) => {
      const hit = cur.find((c) => c.key === key);
      return hit ? cur.map((c) => (c === hit ? { ...c, qty: Math.min(20, c.qty + i.qty) } : c)) : [...cur, { ...i, key }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => setItems((cur) => cur.map((c) => (c.key === key ? { ...c, qty: Math.max(1, Math.min(20, qty)) } : c))), []);
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((c) => c.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(() => ({
    items, ready, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear, toast: setToastMsg, toastMsg,
  }), [items, ready, add, setQty, remove, clear, toastMsg]);

  return (
    <CartCtx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </CartCtx.Provider>
  );
}
