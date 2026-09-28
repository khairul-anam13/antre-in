import { GlassCard } from "@/components/ios";
import { btnClass } from "@/lib/ui";
import { rupiah } from "@/lib/format";
import { isDate, report, todayWIB } from "@/lib/reports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laporan" };

const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10);
const W150 = { width: 150 };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = await todayWIB();
  const to = isDate(sp.to) ? sp.to : today;
  const from = isDate(sp.from) && sp.from <= to ? sp.from : shift(to, -6);
  const { totals: t, byDay, byHour, top, vouchers } = await report(from, to);
  const maxDay = Math.max(1, ...byDay.map((d) => d.revenue));
  const maxHour = Math.max(1, ...byHour.map((h) => h.n));
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, n: byHour.find((x) => x.h === h)?.n ?? 0 })).filter((x) => x.h >= 6 && x.h <= 23);

  const preset = (label: string, f: string, tt: string) => <a key={label} className={btnClass(from === f && to === tt ? "filled" : "gray", "small")} href={`/admin?from=${f}&to=${tt}`}>{label}</a>;

  return (
    <div className="stack-lg">
      <div className="spread wrap">
        <h1 className="t-title2">Laporan penjualan</h1>
        <a className={btnClass("tinted", "medium")} href={`/admin/export?from=${from}&to=${to}`}>Unduh CSV</a>
      </div>

      <div className="row wrap">
        {preset("Hari ini", today, today)}{preset("7 hari", shift(today, -6), today)}{preset("30 hari", shift(today, -29), today)}
        <form className="row" style={{ marginLeft: "auto" }}>
          <input className="field" style={W150} type="date" name="from" defaultValue={from} aria-label="Dari" />
          <span className="muted">–</span>
          <input className="field" style={W150} type="date" name="to" defaultValue={to} aria-label="Sampai" />
          <button className={btnClass("filled", "medium")} type="submit">Terapkan</button>
        </form>
      </div>

      <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <GlassCard variant="strong" className="stat" eyebrow="Pendapatan"><div className="stat__n">{rupiah(t.revenue)}</div></GlassCard>
        <GlassCard variant="strong" className="stat" eyebrow="Pesanan"><div className="stat__n">{t.orders}</div><p className="t-foot muted">{t.drinks} minuman</p></GlassCard>
        <GlassCard variant="strong" className="stat" eyebrow="Rata-rata pesanan"><div className="stat__n">{rupiah(t.orders ? t.revenue / t.orders : 0)}</div></GlassCard>
        <GlassCard variant="strong" className="stat" eyebrow="Waktu ke siap"><div className="stat__n">{t.avg_prep ? `${t.avg_prep.toFixed(1)} mnt` : "—"}</div><p className="t-foot muted">pesanan langsung</p></GlassCard>
        <GlassCard variant="strong" className="stat" eyebrow="Potongan voucher"><div className="stat__n">{rupiah(t.discount)}</div><p className="t-foot muted">{t.cancelled} dibatalkan</p></GlassCard>
      </div>

      <div className="grid-auto">
        <GlassCard variant="strong" title="Pendapatan per hari">
          {byDay.length === 0 ? <p className="empty">Belum ada data.</p> : (
            <div className="bars mt-16" role="img" aria-label="Grafik pendapatan per hari">
              {byDay.map((d) => (
                <div key={d.d} title={`${d.d}: ${rupiah(d.revenue)} · ${d.n} pesanan`}>
                  <i style={{ height: `${(d.revenue / maxDay) * 100}%` }} />
                  <span className="t-cap muted">{d.d.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
        <GlassCard variant="strong" title="Jam tersibuk">
          <div className="bars mt-16" role="img" aria-label="Grafik pesanan per jam">
            {hours.map((x) => (
              <div key={x.h} title={`${x.h}:00 · ${x.n} pesanan`}>
                <i style={{ height: `${(x.n / maxHour) * 100}%`, opacity: x.n ? 1 : 0.2 }} />
                <span className="t-cap muted">{x.h}</span>
              </div>
            ))}
          </div>
          <p className="t-foot muted mt-8">Jumlah pesanan per jam bayar (WIB). Gunakan untuk mengatur jumlah barista & kuota slot.</p>
        </GlassCard>
      </div>

      <div className="grid-auto">
        <GlassCard variant="strong" title="Menu terlaris">
          <div className="scroll-x"><table className="table">
            <thead><tr><th>Menu</th><th className="num">Terjual</th><th className="num">Omzet</th></tr></thead>
            <tbody>{top.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{p.qty}</td><td className="num">{rupiah(p.revenue)}</td></tr>)}
              {top.length === 0 && <tr><td colSpan={3} className="muted">Belum ada data.</td></tr>}</tbody>
          </table></div>
        </GlassCard>
        <GlassCard variant="strong" title="Pemakaian voucher">
          <div className="scroll-x"><table className="table">
            <thead><tr><th>Kode</th><th className="num">Dipakai</th><th className="num">Potongan</th></tr></thead>
            <tbody>{vouchers.map((v) => <tr key={v.code}><td>{v.code}</td><td className="num">{v.n}</td><td className="num">{rupiah(v.discount)}</td></tr>)}
              {vouchers.length === 0 && <tr><td colSpan={3} className="muted">Tidak ada.</td></tr>}</tbody>
          </table></div>
        </GlassCard>
      </div>
    </div>
  );
}
