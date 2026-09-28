import "server-only";
import { sql } from "./db";
import { queueLabel, timeWIB } from "./format";

const PAID = ["queued", "preparing", "ready", "picked_up"];

export async function todayWIB(): Promise<string> {
  const [r] = await sql`select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as d`;
  return r.d;
}
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Rentang [from 00:00, to+1 00:00) dalam WIB, dinilai dari waktu pembayaran. */
const inRange = (from: string, to: string) => sql`o.paid_at >= (${from}::date)::timestamp at time zone 'Asia/Jakarta'
  and o.paid_at < ((${to}::date + 1)::timestamp at time zone 'Asia/Jakarta')`;

export async function report(from: string, to: string) {
  const [[t], byDay, byHour, top, vouchers] = await Promise.all([
    sql`select count(*) filter (where o.status in ${sql(PAID)})::int as orders,
        coalesce(sum(o.total) filter (where o.status in ${sql(PAID)}), 0)::int as revenue,
        coalesce(sum(o.discount) filter (where o.status in ${sql(PAID)}), 0)::int as discount,
        coalesce(sum((select sum(qty) from order_items i where i.order_id = o.id)) filter (where o.status in ${sql(PAID)}), 0)::int as drinks,
        coalesce(avg(extract(epoch from o.ready_at - o.paid_at) / 60) filter (where o.ready_at is not null and o.scheduled_for is null), 0)::float8 as avg_prep,
        count(*) filter (where o.status = 'cancelled')::int as cancelled
        from orders o where ${inRange(from, to)}`,
    sql`select to_char((o.paid_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as d, count(*)::int as n, sum(o.total)::int as revenue
        from orders o where o.status in ${sql(PAID)} and ${inRange(from, to)} group by 1 order by 1`,
    sql`select extract(hour from o.paid_at at time zone 'Asia/Jakarta')::int as h, count(*)::int as n
        from orders o where o.status in ${sql(PAID)} and ${inRange(from, to)} group by 1 order by 1`,
    sql`select i.name, sum(i.qty)::int as qty, sum(i.unit_price * i.qty)::int as revenue
        from order_items i join orders o on o.id = i.order_id where o.status in ${sql(PAID)} and ${inRange(from, to)}
        group by i.name order by qty desc, revenue desc limit 10`,
    sql`select o.voucher_code as code, count(*)::int as n, sum(o.discount)::int as discount
        from orders o where o.status in ${sql(PAID)} and o.voucher_code is not null and ${inRange(from, to)} group by 1 order by n desc`,
  ]);
  return { totals: t, byDay, byHour, top, vouchers };
}

const csv = (v: unknown) => {
  const s = String(v ?? "");
  // cegah formula injection saat dibuka di Excel
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportCsv(from: string, to: string): Promise<string> {
  const rows = await sql`
    select o.*, (select string_agg(i.qty || 'x ' || i.name ||
        coalesce(' (' || nullif((select string_agg(x->>'name', ', ') from jsonb_array_elements(i.options) x), '') || ')', ''), '; ' order by i.id)
      from order_items i where i.order_id = o.id) as items
    from orders o where o.paid_at is not null and ${inRange(from, to)} order by o.paid_at`;
  const head = ["Waktu bayar", "Antrean", "Nama", "No HP", "Status", "Pengambilan", "Item", "Subtotal", "Diskon", "Voucher", "Total", "Menit ke siap"];
  const lines = rows.map((o) => [
    new Date(o.paid_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false }), queueLabel(o.queue_no), o.customer_name, o.customer_phone, o.status,
    o.scheduled_for ? `Terjadwal ${timeWIB(o.scheduled_for)}` : "Langsung", o.items, o.subtotal, o.discount, o.voucher_code ?? "", o.total,
    o.ready_at ? Math.round((new Date(o.ready_at).getTime() - new Date(o.paid_at).getTime()) / 60000) : "",
  ].map(csv).join(","));
  return "﻿" + [head.join(","), ...lines].join("\r\n");
}
