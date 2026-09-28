import Link from "next/link";
import { GlassCard, Icon, List, ListRow, NavigationBar } from "@/components/ios";
import { btnClass } from "@/lib/ui";
import { getUser } from "@/lib/auth";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Akun" };

export default async function AccountPage() {
  const u = await getUser();
  const google = !!process.env.GOOGLE_CLIENT_ID;
  return (
    <>
      <NavigationBar large title="Akun" />
      <div className="page stack-lg">
        {u ? (
          <>
            <GlassCard variant="strong" eyebrow={u.role === "customer" ? "Pelanggan" : `Staf · ${u.role}`} title={u.name || u.email || "Akun"}>
              <p className="t-sub muted">{u.email}</p>
            </GlassCard>
            {u.role !== "customer" && (
              <List header="Ruang kerja">
                <ListRow href="/staf" icon={<Icon name="cup" />} iconColor="system-orange" title="Papan antrean" accessory="chevron" />
                {u.role === "admin" && <ListRow href="/admin" icon={<Icon name="chart" />} iconColor="system-indigo" title="Admin & laporan" accessory="chevron" />}
              </List>
            )}
            <form action={logout}><button className={btnClass("gray", "large", false, "full")} type="submit">Keluar</button></form>
          </>
        ) : (
          <>
            <GlassCard variant="strong" title="Pesan tanpa akun">
              <p className="t-sub muted">Anda bisa memesan sebagai tamu — cukup isi nama dan nomor HP. Riwayat pesanan tersimpan di perangkat ini. Masuk dengan Google agar riwayat ikut ke perangkat lain.</p>
            </GlassCard>
            {google ? (
              <a href="/api/auth/google" className={btnClass("filled", "large", false, "full")}>Masuk dengan Google</a>
            ) : (
              <p className="notice notice--warn">Login Google belum dikonfigurasi (isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET).</p>
            )}
            <p className="center t-foot muted">Staf kedai? <Link href="/masuk">Masuk di sini</Link></p>
          </>
        )}
      </div>
    </>
  );
}
