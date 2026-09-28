"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./ios";
import { useCart } from "./cart";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Menu", icon: "cup", match: (p) => p === "/" || p.startsWith("/menu") },
  { href: "/keranjang", label: "Keranjang", icon: "bag", match: (p) => p.startsWith("/keranjang") },
  { href: "/pesanan", label: "Pesanan", icon: "receipt", match: (p) => p.startsWith("/pesanan") || p.startsWith("/bayar") },
  { href: "/akun", label: "Akun", icon: "person", match: (p) => p.startsWith("/akun") || p.startsWith("/masuk") },
];

/** Tab bar kapsul kaca dari DS (.ios-tabbar), item berupa tautan agar navigasi tetap server-rendered. */
export function AppTabBar() {
  const path = usePathname();
  const { count } = useCart();
  return (
    <div className="tabbar-dock">
      <nav className="ios-tabbar" aria-label="Navigasi utama">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="ios-tabbar__item" aria-current={t.match(path) ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
            {t.href === "/keranjang" && count > 0 && <span className="tab-badge" aria-label={`${count} item`}>{count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
