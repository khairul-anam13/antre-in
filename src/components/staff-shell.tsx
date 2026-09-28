import { logout } from "@/app/actions";
import { Button } from "@/components/ios";
import type { User } from "@/lib/auth";
import { NavTabs } from "./nav-tabs";

const STAFF_TABS = [{ href: "/staf", label: "Antrean" }, { href: "/staf/stok", label: "Stok" }];
const ADMIN_TABS = [{ href: "/admin", label: "Laporan" }, { href: "/admin/menu", label: "Menu" }, { href: "/admin/voucher", label: "Voucher" }, { href: "/admin/pengaturan", label: "Pengaturan" }];

/** Kerangka halaman staf & admin: nav bar kaca + tab per peran. */
export function StaffShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <>
      <div className="staff-nav ios-nav">
        <div className="ios-nav__bar" style={{ paddingLeft: 16 }}>
          <div className="ios-nav__side" style={{ color: "var(--label)" }}><b className="t-headline">Antre-in</b><span className="badge">{user.role}</span></div>
          <div className="ios-nav__side ios-nav__side--trailing">
            <span className="t-foot muted" style={{ color: "var(--label)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || user.email}</span>
            <form action={logout}><Button size="small" variant="gray" type="submit">Keluar</Button></form>
          </div>
        </div>
        <NavTabs tabs={user.role === "admin" ? [...STAFF_TABS, ...ADMIN_TABS] : STAFF_TABS} />
      </div>
      <main className="wide pt-16">{children}</main>
    </>
  );
}
