"use server";
import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isNextStatus, setStatus, type NextStatus } from "@/lib/orders";

// Siapa boleh melakukan apa: barista membuat, kasir menyerahkan/membatalkan, admin semuanya.
const ALLOWED: Record<Role, NextStatus[]> = {
  customer: [],
  barista: ["preparing", "ready"],
  cashier: ["picked_up", "cancelled"],
  admin: ["preparing", "ready", "picked_up", "cancelled"],
};

export async function advance(id: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const u = await requireRole("barista", "cashier", "admin");
  if (!isNextStatus(next) || !ALLOWED[u.role].includes(next)) return { ok: false, error: "Tidak diizinkan" };
  return (await setStatus(id, next)) ? { ok: true } : { ok: false, error: "Status pesanan sudah berubah, layar diperbarui." };
}

/** Tandai menu / opsi habis atau tersedia lagi. */
export async function setAvailable(kind: "product" | "option", id: number, value: boolean) {
  await requireRole("barista", "cashier", "admin");
  if (!Number.isInteger(id)) return;
  if (kind === "product") await sql`update products set is_available = ${value} where id = ${id}`;
  else await sql`update options set is_available = ${value} where id = ${id}`;
  revalidatePath("/");
  revalidatePath("/staf/stok");
}
