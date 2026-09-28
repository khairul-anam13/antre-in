import { ActionForm } from "@/components/action-form";
import { GlassCard } from "@/components/ios";
import { sql } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { deleteCategory, deleteOptionGroup, deleteProduct, saveCategory, saveOptionGroup, saveProduct } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

type Cat = { id: number; name: string; sort: number };
type Prod = { id: number; category_id: number | null; name: string; description: string; price: number; image_url: string | null; is_available: boolean; is_active: boolean; sort: number; groups: number[] };
type Grp = { id: number; name: string; kind: string; required: boolean; sort: number; options: { name: string; price_delta: number; is_default: boolean }[] };

const Hidden = ({ name, value }: { name: string; value: string | number }) => <input type="hidden" name={name} value={value} />;
const W80 = { width: 80 };

function ProductFields({ p, cats, groups }: { p?: Prod; cats: Cat[]; groups: Grp[] }) {
  return (
    <>
      {p && <Hidden name="id" value={p.id} />}
      <div className="grid-2">
        <div><label className="label">Nama</label><input className="field" name="name" defaultValue={p?.name} required maxLength={60} /></div>
        <div><label className="label">Harga (Rp)</label><input className="field" name="price" type="number" min={0} step={500} defaultValue={p?.price} required /></div>
      </div>
      <div><label className="label">Deskripsi</label><input className="field" name="description" defaultValue={p?.description} maxLength={300} /></div>
      <div className="grid-2">
        <div><label className="label">Kategori</label>
          <select className="field" name="category_id" defaultValue={p?.category_id ?? ""}><option value="">— Tanpa kategori —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Urutan</label><input className="field" name="sort" type="number" defaultValue={p?.sort ?? 0} /></div>
      </div>
      <div><label className="label">URL gambar (opsional)</label><input className="field" name="image_url" type="url" defaultValue={p?.image_url ?? ""} placeholder="https://…" /></div>
      <div><span className="label">Opsi yang tersedia</span>
        <div className="row wrap" style={{ gap: 16 }}>{groups.map((g) => (
          <label key={g.id} className="check"><input type="checkbox" name="groups" value={g.id} defaultChecked={p?.groups.includes(g.id)} /> {g.name}</label>
        ))}</div></div>
      <label className="check"><input type="checkbox" name="is_active" defaultChecked={p ? p.is_active : true} /> Tampil di menu pelanggan</label>
    </>
  );
}

export default async function AdminMenuPage() {
  const [cats, prods, groups] = await Promise.all([
    sql<Cat[]>`select id, name, sort from categories order by sort, id`,
    sql<Prod[]>`select p.*, coalesce((select array_agg(group_id) from product_option_groups where product_id = p.id), '{}') as groups from products p order by p.sort, p.id`,
    sql<Grp[]>`select g.*, coalesce((select json_agg(json_build_object('name', o.name, 'price_delta', o.price_delta, 'is_default', o.is_default) order by o.sort, o.id) from options o where o.group_id = g.id), '[]') as options
               from option_groups g order by g.sort, g.id`,
  ]);
  const optText = (g: Grp) => g.options.map((o) => `${o.is_default ? "*" : ""}${o.name} | ${o.price_delta}`).join("\n");

  return (
    <div className="stack-lg narrow">
      <h1 className="t-title2">Kelola menu</h1>

      <section className="stack">
        <h2 className="t-headline">Kategori</h2>
        {cats.map((c) => (
          <GlassCard key={c.id} variant="strong">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="grow"><ActionForm action={saveCategory} className="row" submit="Simpan" variant="tinted">
                <Hidden name="id" value={c.id} />
                <input className="field grow" name="name" defaultValue={c.name} aria-label="Nama kategori" required maxLength={40} />
                <input className="field" style={W80} name="sort" type="number" defaultValue={c.sort} aria-label="Urutan" />
              </ActionForm></div>
              <ActionForm action={deleteCategory} className="row" submit="Hapus" variant="gray" destructive><Hidden name="id" value={c.id} /></ActionForm>
            </div>
          </GlassCard>
        ))}
        <ActionForm action={saveCategory} className="row" submit="Tambah kategori">
          <input className="field grow" name="name" placeholder="Nama kategori baru" aria-label="Nama kategori baru" required maxLength={40} />
        </ActionForm>
      </section>

      <section className="stack">
        <h2 className="t-headline">Menu ({prods.length})</h2>
        <GlassCard variant="strong">
          <details className="ios-details"><summary className="t-headline tint">+ Tambah menu baru</summary>
            <div className="mt-16"><ActionForm action={saveProduct} submit="Tambah menu"><ProductFields cats={cats} groups={groups} /></ActionForm></div>
          </details>
        </GlassCard>
        {prods.map((p) => (
          <GlassCard key={p.id} variant="strong">
            <details className="ios-details">
              <summary className="spread">
                <span className="t-headline">{p.name}</span>
                <span className="row"><span className="t-num t-sub">{rupiah(p.price)}</span>{!p.is_active && <span className="badge">Disembunyikan</span>}{!p.is_available && <span className="badge badge--red">Habis</span>}</span>
              </summary>
              <div className="mt-16 stack-lg">
                <ActionForm action={saveProduct} submit="Simpan perubahan"><ProductFields p={p} cats={cats} groups={groups} /></ActionForm>
                <ActionForm action={deleteProduct} className="row" submit="Hapus menu ini" variant="gray" destructive><Hidden name="id" value={p.id} /></ActionForm>
              </div>
            </details>
          </GlassCard>
        ))}
      </section>

      <section className="stack">
        <h2 className="t-headline">Grup opsi (ukuran, gula, topping…)</h2>
        <p className="t-foot muted">Satu opsi per baris, format <code>Nama | tambahan harga</code>. Awali dengan <code>*</code> untuk pilihan bawaan. Contoh: <code>*Regular | 0</code>, <code>Large | 5000</code>.</p>
        {groups.map((g) => (
          <GlassCard key={g.id} variant="strong">
            <details className="ios-details">
              <summary className="spread"><span className="t-headline">{g.name}</span><span className="badge">{g.kind === "multi" ? "Boleh banyak" : "Pilih satu"}{g.required ? " · wajib" : ""}</span></summary>
              <div className="mt-16 stack-lg">
                <ActionForm action={saveOptionGroup} submit="Simpan grup">
                  <Hidden name="id" value={g.id} />
                  <div className="grid-2">
                    <div><label className="label">Nama grup</label><input className="field" name="name" defaultValue={g.name} required maxLength={40} /></div>
                    <div><label className="label">Jenis</label><select className="field" name="kind" defaultValue={g.kind}><option value="single">Pilih satu</option><option value="multi">Boleh banyak</option></select></div>
                  </div>
                  <div className="row" style={{ gap: 24 }}>
                    <label className="check"><input type="checkbox" name="required" defaultChecked={g.required} /> Wajib dipilih</label>
                    <div className="row"><span className="t-sub">Urutan</span><input className="field" style={W80} name="sort" type="number" defaultValue={g.sort} /></div>
                  </div>
                  <div><label className="label">Opsi</label><textarea className="field" name="options" rows={5} defaultValue={optText(g)} required /></div>
                </ActionForm>
                <ActionForm action={deleteOptionGroup} className="row" submit="Hapus grup ini" variant="gray" destructive><Hidden name="id" value={g.id} /></ActionForm>
              </div>
            </details>
          </GlassCard>
        ))}
        <GlassCard variant="strong">
          <details className="ios-details"><summary className="t-headline tint">+ Tambah grup opsi</summary>
            <div className="mt-16"><ActionForm action={saveOptionGroup} submit="Tambah grup">
              <div className="grid-2">
                <div><label className="label">Nama grup</label><input className="field" name="name" required maxLength={40} /></div>
                <div><label className="label">Jenis</label><select className="field" name="kind"><option value="single">Pilih satu</option><option value="multi">Boleh banyak</option></select></div>
              </div>
              <label className="check"><input type="checkbox" name="required" /> Wajib dipilih</label>
              <div><label className="label">Opsi</label><textarea className="field" name="options" rows={4} placeholder={"*Regular | 0\nLarge | 5000"} required /></div>
            </ActionForm></div>
          </details>
        </GlassCard>
      </section>
    </div>
  );
}
