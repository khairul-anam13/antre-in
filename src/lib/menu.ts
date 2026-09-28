import "server-only";
import { sql, type Sql } from "./db";
import type { Group, Product } from "./pricing.ts";

export type Settings = {
  shop_name: string; is_open: boolean; open_time: string; close_time: string; slot_minutes: number; slot_capacity: number;
  drinks_per_minute: number; schedule_lead_minutes: number; min_schedule_minutes: number; max_drinks_per_order: number; payment_expiry_minutes: number;
};

export async function getSettings(db: Sql = sql): Promise<Settings> {
  const [s] = await db`select shop_name, is_open, open_time::text, close_time::text, slot_minutes, slot_capacity,
    drinks_per_minute::float8, schedule_lead_minutes, min_schedule_minutes, max_drinks_per_order, payment_expiry_minutes from settings where id = 1`;
  return s as Settings;
}

export type MenuProduct = { id: number; category_id: number | null; name: string; description: string; price: number; image_url: string | null; is_available: boolean };
export type Category = { id: number; name: string };

export async function getMenu() {
  const [categories, products] = await Promise.all([
    sql<Category[]>`select id, name from categories order by sort, id`,
    sql<MenuProduct[]>`select id, category_id, name, description, price, image_url, is_available from products where is_active order by sort, id`,
  ]);
  return { categories, products };
}

/** Produk lengkap dengan grup opsi — dipakai halaman produk dan penghitungan harga di server. */
export async function loadProducts(ids: number[], db: Sql = sql): Promise<(Product & MenuProduct)[]> {
  ids = [...new Set(ids)].filter(Number.isInteger);
  if (!ids.length) return [];
  const [rows, groups, opts] = await Promise.all([
    db<(MenuProduct & { is_active: boolean })[]>`select id, category_id, name, description, price, image_url, is_available, is_active from products where id in ${db(ids)}`,
    db`select pg.product_id, g.id, g.name, g.kind, g.required from product_option_groups pg join option_groups g on g.id = pg.group_id
       where pg.product_id in ${db(ids)} order by g.sort, g.id`,
    db`select o.id, o.group_id, o.name, o.price_delta, o.is_default, o.is_available from options o
       where o.group_id in (select group_id from product_option_groups where product_id in ${db(ids)}) order by o.sort, o.id`,
  ]);
  return rows.map((p) => ({
    ...p,
    groups: groups.filter((g) => g.product_id === p.id).map((g): Group => ({
      id: g.id, name: g.name, kind: g.kind, required: g.required,
      options: opts.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price_delta: o.price_delta, is_available: o.is_available, is_default: o.is_default })),
    })),
  }));
}
