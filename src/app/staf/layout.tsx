import { StaffShell } from "@/components/staff-shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staf" };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("barista", "cashier", "admin");
  return <StaffShell user={user}>{children}</StaffShell>;
}
