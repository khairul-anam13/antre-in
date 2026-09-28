"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/password.ts";
import type { FormState } from "@/lib/form";

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const int = (fd: FormData, k: string, d = 0) => { const n = Number(String(fd.get(k) ?? "").replace(/[.\s]/g, "")); return Number.isFinite(n) && String(fd.get(k) ?? "") !== "" ? Math.trunc(n) : d; };
const optInt = (fd: FormData, k: string) => (str(fd, k) === "" ? null : int(fd, k));
const flag = (fd: FormData, k: string) => fd.get(k) === "on";
const fail = (error: string): FormState => ({ error });
const saved = (path: string, ok = "Tersimpan"): FormState => { revalidatePath(path); revalidatePath("/"); return { ok }; };
const isUnique = (e: unknown) => (e as { code?: string })?.code === "23505";

/* ---------- Kategori ---------- */
export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = int(fd, "id"), name = str(fd, "name", 40);
  if (!name) return fail("Nama kategori wajib diisi");
  if (id) await sql`update categories set name = ${name}, sort = ${int(fd, "sort")} where id = ${id}`;
  else await sql`insert into categories (name, sort) values (${name}, ${int(fd, "sort")})`;
  return saved("/admin/menu");
}
export async function deleteCategory(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  await sql`delete from categories where id = ${int(fd, "id")}`;
  return saved("/admin/menu", "Dihapus");
}

/* ---------- Produk ---------- */
export async function saveProduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = int(fd, "id"), name = str(fd, "name", 60), price = int(fd, "price", -1), image = str(fd, "image_url", 500);
  if (!name) return fail("Nama menu wajib diisi");
  if (price < 0 || price > 10_000_000) return fail("Harga tidak valid");
  if (image && !/^https?:\/\/\S+$/.test(image)) return fail("URL gambar harus diawali http:// atau https://");
  const cat = optInt(fd, "category_id");
  const groups = [...new Set(fd.getAll("groups").map(Number).filter(Number.isInteger))];
  await sql.begin(async (tx) => {
    const [p] = id
      ? await tx`update products set name = ${name}, description = ${str(fd, "description", 300)}, price = ${price}, category_id = ${cat}, image_url = ${image || null},
                 sort = ${int(fd, "sort")}, is_active = ${flag(fd, "is_active")} where id = ${id} returning id`
      : await tx`insert into products (name, description, price, category_id, image_url, sort, is_active)
                 values (${name}, ${str(fd, "description", 300)}, ${price}, ${cat}, ${image || null}, ${int(fd, "sort")}, ${flag(fd, "is_active")}) returning id`;
    await tx`delete from product_option_groups where product_id = ${p.id}`;
    if (groups.length) await tx`insert into product_option_groups ${tx(groups.map((g) => ({ product_id: p.id, group_id: g })))}`;
  });
  return saved("/admin/menu");
}
export async function deleteProduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  await sql`delete from products where id = ${int(fd, "id")}`; // riwayat pesanan aman: order_items menyimpan salinan nama & harga
  return saved("/admin/menu", "Dihapus");
}

/* ---------- Grup opsi ---------- */
/** Baris: "Nama | harga", awali dengan * untuk pilihan default. */
function parseOptions(text: string) {
  const out: { name: string; price: number; def: boolean }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const def = line.startsWith("*");
    const [n, p = "0"] = line.replace(/^\*/, "").split("|");
    const name = n.trim().slice(0, 40), price = Number(p.replace(/[.\s+]/g, ""));
    if (!name || !Number.isInteger(price) || price < 0) throw new Error(`Baris tidak valid: “${line}”`);
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) throw new Error(`Nama opsi ganda: ${name}`);
    out.push({ name, price, def });
  }
  if (!out.length) throw new Error("Isi minimal satu opsi");
  return out;
}

export async function saveOptionGroup(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = int(fd, "id"), name = str(fd, "name", 40), kind = str(fd, "kind") === "multi" ? "multi" : "single";
  if (!name) return fail("Nama grup wajib diisi");
  let opts;
  try { opts = parseOptions(String(fd.get("options") ?? "")); } catch (e) { return fail((e as Error).message); }
  await sql.begin(async (tx) => {
    const [g] = id
      ? await tx`update option_groups set name = ${name}, kind = ${kind}, required = ${flag(fd, "required")}, sort = ${int(fd, "sort")} where id = ${id} returning id`
      : await tx`insert into option_groups (name, kind, required, sort) values (${name}, ${kind}, ${flag(fd, "required")}, ${int(fd, "sort")}) returning id`;
    const existing = await tx`select id, lower(name) as n from options where group_id = ${g.id}`;
    // cocokkan berdasarkan nama agar id & status stok opsi tetap terjaga
    for (const [i, o] of opts.entries()) {
      const hit = existing.find((e) => e.n === o.name.toLowerCase());
      if (hit) await tx`update options set name = ${o.name}, price_delta = ${o.price}, is_default = ${o.def}, sort = ${i} where id = ${hit.id}`;
      else await tx`insert into options (group_id, name, price_delta, is_default, sort) values (${g.id}, ${o.name}, ${o.price}, ${o.def}, ${i})`;
    }
    const drop = existing.filter((e) => !opts.some((o) => o.name.toLowerCase() === e.n)).map((e) => e.id);
    if (drop.length) await tx`delete from options where id in ${tx(drop)}`;
  });
  return saved("/admin/menu");
}
export async function deleteOptionGroup(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  await sql`delete from option_groups where id = ${int(fd, "id")}`;
  return saved("/admin/menu", "Dihapus");
}

/* ---------- Voucher ---------- */
export async function saveVoucher(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const code = str(fd, "code", 20).toUpperCase(), kind = str(fd, "kind") === "amount" ? "amount" : "percent", value = int(fd, "value");
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return fail("Kode 3–20 karakter: huruf, angka, - atau _");
  if (value < 1 || (kind === "percent" && value > 100)) return fail(kind === "percent" ? "Persen harus 1–100" : "Nominal harus lebih dari 0");
  const d = (k: string, t: string) => (str(fd, k) && /^\d{4}-\d{2}-\d{2}$/.test(str(fd, k)) ? `${str(fd, k)}T${t}+07:00` : null);
  const start = d("starts_at", "00:00:00"), end = d("ends_at", "23:59:59");
  if (start && end && start > end) return fail("Tanggal mulai setelah tanggal berakhir");
  await sql`insert into vouchers (code, kind, value, min_subtotal, max_discount, max_uses, starts_at, ends_at, is_active)
    values (${code}, ${kind}, ${value}, ${Math.max(0, int(fd, "min_subtotal"))}, ${optInt(fd, "max_discount")}, ${optInt(fd, "max_uses")}, ${start}, ${end}, ${flag(fd, "is_active")})
    on conflict (code) do update set kind = excluded.kind, value = excluded.value, min_subtotal = excluded.min_subtotal, max_discount = excluded.max_discount,
      max_uses = excluded.max_uses, starts_at = excluded.starts_at, ends_at = excluded.ends_at, is_active = excluded.is_active`;
  return saved("/admin/voucher");
}
export async function deleteVoucher(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  await sql`delete from vouchers where code = ${str(fd, "code", 20)}`;
  return saved("/admin/voucher", "Dihapus");
}

/* ---------- Pengaturan & staf ---------- */
const time = (s: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null);

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const open = time(str(fd, "open_time")), close = time(str(fd, "close_time"));
  const dpm = Number(str(fd, "drinks_per_minute").replace(",", "."));
  if (!open || !close || open >= close) return fail("Jam buka harus lebih awal dari jam tutup");
  if (!(dpm > 0 && dpm <= 60)) return fail("Kecepatan dapur harus antara 0–60 minuman/menit");
  const slotMin = int(fd, "slot_minutes"), cap = int(fd, "slot_capacity"), lead = int(fd, "schedule_lead_minutes"), minSched = int(fd, "min_schedule_minutes"), maxD = int(fd, "max_drinks_per_order"), exp = int(fd, "payment_expiry_minutes");
  if (slotMin < 5 || slotMin > 120 || cap < 1 || lead < 0 || minSched < 0 || maxD < 1 || exp < 5) return fail("Ada nilai yang tidak valid");
  await sql`update settings set shop_name = ${str(fd, "shop_name", 60) || "Kedai Antre-in"}, is_open = ${flag(fd, "is_open")}, open_time = ${open}, close_time = ${close},
    slot_minutes = ${slotMin}, slot_capacity = ${cap}, drinks_per_minute = ${dpm}, schedule_lead_minutes = ${lead}, min_schedule_minutes = ${minSched},
    max_drinks_per_order = ${maxD}, payment_expiry_minutes = ${exp} where id = 1`;
  revalidatePath("/keranjang");
  return saved("/admin/pengaturan");
}

export async function createStaff(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const email = str(fd, "email", 120).toLowerCase(), name = str(fd, "name", 60), pw = String(fd.get("password") ?? "");
  const role = ["cashier", "barista", "admin"].includes(str(fd, "role")) ? str(fd, "role") : "barista";
  if (!/^\S+@\S+\.\S+$/.test(email) || !name) return fail("Isi nama dan email yang valid");
  if (pw.length < 8) return fail("Password minimal 8 karakter");
  try {
    await sql`insert into users (email, name, role, password_hash) values (${email}, ${name}, ${role}, ${await hashPassword(pw)})`;
  } catch (e) {
    if (isUnique(e)) return fail("Email sudah terdaftar");
    throw e;
  }
  return saved("/admin/pengaturan", "Akun staf dibuat");
}

export async function resetStaffPassword(_: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const pw = String(fd.get("password") ?? "");
  if (pw.length < 8) return fail("Password minimal 8 karakter");
  await sql`update users set password_hash = ${await hashPassword(pw)}, failed_logins = 0, locked_until = null where id = ${str(fd, "id", 40)} and role <> 'customer'`;
  await sql`delete from sessions where user_id = ${str(fd, "id", 40)}`;
  return saved("/admin/pengaturan", "Password diganti");
}

export async function deleteStaff(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const id = str(fd, "id", 40);
  if (id === me.id) return fail("Tidak bisa menghapus akun sendiri");
  await sql`delete from users where id = ${id} and role <> 'customer'`;
  return saved("/admin/pengaturan", "Akun dihapus");
}
