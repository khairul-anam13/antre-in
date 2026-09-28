import { GlassCard } from "@/components/ios";
import { getMenu } from "@/lib/menu";
import { getPickupOptions } from "@/lib/orders";
import { MenuList } from "./menu-list";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ categories, products }, pickup] = await Promise.all([getMenu(), getPickupOptions(1)]);
  return (
    <>
      <header className="hero">
        <p className="hero__status t-foot">
          <span className={`dot ${pickup.open ? "" : "dot--off"}`} />
          <b>{pickup.open ? "Buka sekarang" : "Tutup"}</b>
        </p>
        <h1 className="t-large">{pickup.shopName}</h1>
        <p className="muted">Pesan dari HP, bayar online, ambil tanpa antre.</p>
      </header>

      <div className="page stack mb-8">
        {pickup.asapMinutes != null ? (
          <GlassCard variant="strong" eyebrow="Antrean saat ini" title={`Pesanan baru siap ±${pickup.asapMinutes} menit`}>
            <p className="t-sub muted">Perkiraan dari jumlah minuman yang sedang dibuat. Ingin lebih pasti? Jadwalkan jam ambil di keranjang.</p>
          </GlassCard>
        ) : (
          <GlassCard variant="strong" eyebrow="Kedai tutup" title={pickup.closedNote ?? "Kedai tutup"}>
            <p className="t-sub muted">Anda tetap bisa melihat menu.</p>
          </GlassCard>
        )}
      </div>

      <MenuList categories={categories} products={products} />
    </>
  );
}
