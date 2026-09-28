"use client";
// Penyimpanan lokal di browser: profil pemesan & referensi pesanan tamu. Semua akses dibungkus try/catch (mode privat / storage diblokir).
export type OrderRef = { id: string; token: string };

const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };

export const getProfile = () => read<{ name: string; phone: string }>("antre.profile", { name: "", phone: "" });
export const saveProfile = (p: { name: string; phone: string }) => write("antre.profile", p);

export const getOrderRefs = () => read<OrderRef[]>("antre.orders", []);
export const saveOrderRef = (r: OrderRef) => {
  const cur = getOrderRefs().filter((x) => x.id !== r.id);
  write("antre.orders", [r, ...cur].slice(0, 20));
};
