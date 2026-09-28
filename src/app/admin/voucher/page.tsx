import { ActionForm } from "@/components/action-form";
import { GlassCard } from "@/components/ios";
import { sql } from "@/lib/db";
import { rupiah } from "@/lib/format";
import { deleteVoucher, saveVoucher } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Voucher" };

type V = { code: string; kind: "percent" | "amount"; value: number; min_subtotal: number; max_discount: number | null; max_uses: number | null; used_count: number; starts: string | null; ends: string | null; is_active: boolean };

function Fields({ v }: { v?: V }) {
  return (
    <>
      <div className="grid-2">
        <div><label className="label">Kode</label><input className="field" name="code" defaultValue={v?.code} readOnly={!!v} required maxLength={20} style={{ textTransform: "uppercase" }} /></div>
        <div><label className="label">Jenis</label><select className="field" name="kind" defaultValue={v?.kind ?? "percent"}><option value="percent">Persen (%)</option><option value="amount">Nominal (Rp)</option></select></div>
      </div>
      <div className="grid-2">
        <div><label className="label">Nilai</label><input className="field" name="value" type="number" min={1} defaultValue={v?.value} required /></div>
        <div><label className="label">Minimal belanja (Rp)</label><input className="field" name="min_subtotal" type="number" min={0} defaultValue={v?.min_subtotal ?? 0} /></div>
      </div>
      <div className="grid-2">
        <div><label className="label">Batas potongan (Rp, untuk persen)</label><input className="field" name="max_discount" type="number" min={0} defaultValue={v?.max_discount ?? ""} /></div>
        <div><label className="label">Kuota pemakaian</label><input className="field" name="max_uses" type="number" min={1} defaultValue={v?.max_uses ?? ""} placeholder="Tanpa batas" /></div>
      </div>
      <div className="grid-2">
        <div><label className="label">Mulai (opsional)</label><input className="field" name="starts_at" type="date" defaultValue={v?.starts ?? ""} /></div>
        <div><label className="label">Berakhir (opsional)</label><input className="field" name="ends_at" type="date" defaultValue={v?.ends ?? ""} /></div>
      </div>
      <label className="check"><input type="checkbox" name="is_active" defaultChecked={v ? v.is_active : true} /> Aktif</label>
    </>
  );
}

export default async function VoucherPage() {
  const list = await sql<V[]>`select code, kind, value, min_subtotal, max_discount, max_uses, used_count, is_active,
    to_char(starts_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as starts, to_char(ends_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as ends from vouchers order by code`;
  return (
    <div className="stack-lg narrow">
      <h1 className="t-title2">Voucher</h1>
      <GlassCard variant="strong">
        <details className="ios-details"><summary className="t-headline tint">+ Buat voucher</summary>
          <div className="mt-16"><ActionForm action={saveVoucher} submit="Buat voucher"><Fields /></ActionForm></div>
        </details>
      </GlassCard>
      {list.map((v) => (
        <GlassCard key={v.code} variant="strong">
          <details className="ios-details">
            <summary className="spread">
              <span className="t-headline">{v.code}</span>
              <span className="row">
                <span className="t-sub">{v.kind === "percent" ? `${v.value}%` : rupiah(v.value)}</span>
                <span className="badge">{v.used_count}{v.max_uses ? `/${v.max_uses}` : ""} dipakai</span>
                {!v.is_active && <span className="badge badge--red">Nonaktif</span>}
              </span>
            </summary>
            <div className="mt-16 stack-lg">
              <ActionForm action={saveVoucher} submit="Simpan perubahan"><Fields v={v} /></ActionForm>
              <ActionForm action={deleteVoucher} className="row" submit="Hapus voucher" variant="gray" destructive><input type="hidden" name="code" value={v.code} /></ActionForm>
            </div>
          </details>
        </GlassCard>
      ))}
      {list.length === 0 && <p className="empty">Belum ada voucher.</p>}
    </div>
  );
}
