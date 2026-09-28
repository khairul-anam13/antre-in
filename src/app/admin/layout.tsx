import { StaffShell } from "@/components/staff-shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return <StaffShell user={user}>{children}</StaffShell>;
}
