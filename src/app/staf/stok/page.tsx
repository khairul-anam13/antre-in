import { sql } from "@/lib/db";
import { StockList } from "./stock-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stok" };

export default async function StockPage() {
  const [products, options] = await Promise.all([
    sql`select p.id, p.name, p.is_available, coalesce(c.name, 'Lainnya') as cat from products p left join categories c on c.id = p.category_id where p.is_active order by c.sort nulls last, p.sort, p.id`,
    sql`select o.id, o.name, o.is_available, g.name as grp from options o join option_groups g on g.id = o.group_id order by g.sort, g.id, o.sort, o.id`,
  ]);
  return (
    <div className="stack-lg" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div>
        <h1 className="t-title2">Stok menu</h1>
        <p className="t-sub muted">Matikan menu atau topping yang habis — langsung hilang dari halaman pelanggan.</p>
      </div>
      <StockList
        products={products.map((p) => ({ id: p.id, name: p.name, on: p.is_available, group: p.cat }))}
        options={options.map((o) => ({ id: o.id, name: o.name, on: o.is_available, group: o.grp }))}
      />
    </div>
  );
}
