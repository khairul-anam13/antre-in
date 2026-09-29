"use server";
import { redirect } from "next/navigation";
import { destroySession, getUser, loginStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PriceError, createOrder, getOrderFor, getPickupOptions, markPaid, cancelUnpaid, parseItems, quote, type Pickup, type Quote } from "@/lib/orders";
import { mockPayments } from "@/lib/midtrans";
import { appUrl, clientIp } from "@/lib/url";

import type { FormState } from "@/lib/form";

/** Harga terverifikasi server + opsi pengambilan untuk halaman keranjang. */
export async function quoteAction(items: unknown, voucher: string): Promise<{ q: Quote | null; error?: string; voucherError?: string; pickup: Pickup }> {
  try {
    const parsed = parseItems(items);
    let q = await quote(parsed, undefined);
    const pickup = await getPickupOptions(q.drinks);
    let voucherError: string | undefined;
    if (voucher.trim()) {
      try { q = await quote(parsed, voucher); } catch (e) { if (e instanceof PriceError) voucherError = e.message; else throw e; }
    }
    return { q, voucherError, pickup };
  } catch (e) {
    if (!(e instanceof PriceError)) throw e;
    return { q: null, error: e.message, pickup: await getPickupOptions(1) };
  }
}

export type PlaceInput = { items: unknown; voucher?: string; name: string; phone: string; note?: string; slot?: string | null };

export async function placeOrder(raw: PlaceInput): Promise<{ ok: true; id: string; token: string; url: string } | { ok: false; error: string }> {
  try {
    const [user, ip, app] = await Promise.all([getUser(), clientIp(), appUrl()]);
    const r = await createOrder({
      items: parseItems(raw.items), voucher: String(raw.voucher ?? ""), name: String(raw.name ?? ""), phone: String(raw.phone ?? ""),
      note: String(raw.note ?? ""), slot: raw.slot ? String(raw.slot) : null, user, ip,
    }, app);
    if (user?.role === "customer") await sql`update users set name = ${String(raw.name).trim().slice(0, 60)}, phone = ${String(raw.phone).trim()} where id = ${user.id}`;
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof PriceError) return { ok: false, error: e.message };
    console.error("placeOrder", e);
    return { ok: false, error: "Terjadi kesalahan, coba lagi." };
  }
}

/** Halaman bayar simulasi (hanya development tanpa kunci Midtrans). */
export async function simulatePay(id: string, token: string, success: boolean) {
  if (!mockPayments) return;
  const o = await getOrderFor(id, token, await getUser());
  if (!o) return;
  if (success) await markPaid(id); else await cancelUnpaid(id);
}

export async function staffLogin(_: FormState, fd: FormData): Promise<FormState> {
  const r = await loginStaff(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (r.error) return { error: r.error };
  redirect(r.role === "admin" ? "/admin" : "/staf");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
