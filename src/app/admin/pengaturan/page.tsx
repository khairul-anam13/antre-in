import { ActionForm } from "@/components/action-form";
import { GlassCard } from "@/components/ios";
import { requireRole } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/menu";
import { createStaff, deleteStaff, resetStaffPassword, saveSettings } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pengaturan" };

const Num = ({ label, name, value, hint, step }: { label: string; name: string; value: number; hint: string; step?: string }) => (
  <div><label className="label" htmlFor={name}>{label}</label><input id={name} className="field" name={name} type="number" step={step ?? "1"} defaultValue={value} required /><p className="t-foot muted mt-8">{hint}</p></div>
);

export default async function SettingsPage() {
  const me = await requireRole("admin");
  const [s, staff] = await Promise.all([
    getSettings(),
    sql`select id, name, email, role from users where role <> 'customer' order by role, name`,
  ]);
  return (
    <div className="stack-lg narrow">
      <h1 className="t-title2">Pengaturan kedai</h1>

      <GlassCard variant="strong" title="Operasional & antrean">
        <div className="mt-16"><ActionForm action={saveSettings} submit="Simpan pengaturan">
          <div><label className="label" htmlFor="shop_name">Nama kedai</label><input id="shop_name" className="field" name="shop_name" defaultValue={s.shop_name} maxLength={60} /></div>
          <label className="check"><input type="checkbox" name="is_open" defaultChecked={s.is_open} /> Kedai buka (matikan untuk menutup pemesanan seketika)</label>
          <div className="grid-2">
            <div><label className="label" htmlFor="open_time">Jam buka</label><input id="open_time" className="field" name="open_time" type="time" defaultValue={s.open_time.slice(0, 5)} required /></div>
            <div><label className="label" htmlFor="close_time">Jam tutup</label><input id="close_time" className="field" name="close_time" type="time" defaultValue={s.close_time.slice(0, 5)} required /></div>
          </div>
          <Num label="Kecepatan dapur (minuman / menit)" name="drinks_per_minute" value={s.drinks_per_minute} step="0.1" hint="Dipakai menghitung estimasi tunggu. Naikkan bila barista ditambah; ukur dari laporan 'Waktu ke siap'." />
          <div className="grid-2">
            <Num label="Panjang slot (menit)" name="slot_minutes" value={s.slot_minutes} hint="Rentang jam ambil terjadwal." />
            <Num label="Kuota per slot (minuman)" name="slot_capacity" value={s.slot_capacity} hint="Batas minuman terjadwal di satu slot — inilah yang meratakan antrean." />
          </div>
          <div className="grid-2">
            <Num label="Jeda minimum pesan terjadwal (menit)" name="min_schedule_minutes" value={s.min_schedule_minutes} hint="Slot terdekat = sekarang + jeda ini." />
            <Num label="Masuk dapur sebelum jam ambil (menit)" name="schedule_lead_minutes" value={s.schedule_lead_minutes} hint="Pesanan terjadwal tampil di layar barista sebanyak ini menit sebelum jam ambil." />
          </div>
          <div className="grid-2">
            <Num label="Maks. minuman per pesanan" name="max_drinks_per_order" value={s.max_drinks_per_order} hint="Mencegah satu pesanan memborong dapur." />
            <Num label="Batas waktu bayar (menit)" name="payment_expiry_minutes" value={s.payment_expiry_minutes} hint="Setelah ini pesanan belum bayar dibatalkan otomatis." />
          </div>
        </ActionForm></div>
      </GlassCard>

      <section className="stack">
        <h2 className="t-headline">Akun staf</h2>
        {staff.map((u) => (
          <GlassCard key={u.id} variant="strong">
            <details className="ios-details">
              <summary className="spread"><span><b className="t-headline">{u.name}</b> <span className="t-foot muted">{u.email}</span></span><span className="badge">{u.role}</span></summary>
              <div className="mt-16 stack">
                <ActionForm action={resetStaffPassword} className="row" submit="Ganti password" variant="tinted">
                  <input type="hidden" name="id" value={u.id} />
                  <input className="field grow" name="password" type="password" minLength={8} placeholder="Password baru (min. 8)" autoComplete="new-password" required />
                </ActionForm>
                {u.id !== me.id && <ActionForm action={deleteStaff} className="row" submit="Hapus akun" variant="gray" destructive><input type="hidden" name="id" value={u.id} /></ActionForm>}
              </div>
            </details>
          </GlassCard>
        ))}
        <GlassCard variant="strong" title="Tambah staf">
          <div className="mt-16"><ActionForm action={createStaff} submit="Buat akun">
            <div className="grid-2">
              <div><label className="label" htmlFor="sn">Nama</label><input id="sn" className="field" name="name" required maxLength={60} /></div>
              <div><label className="label" htmlFor="sr">Peran</label><select id="sr" className="field" name="role" defaultValue="barista"><option value="barista">Barista (membuat pesanan)</option><option value="cashier">Kasir (menyerahkan pesanan)</option><option value="admin">Admin</option></select></div>
            </div>
            <div className="grid-2">
              <div><label className="label" htmlFor="se">Email</label><input id="se" className="field" name="email" type="email" required autoComplete="off" /></div>
              <div><label className="label" htmlFor="sp">Password</label><input id="sp" className="field" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
            </div>
          </ActionForm></div>
        </GlassCard>
      </section>
    </div>
  );
}
