import { requireRole } from "@/lib/auth";
import { getBoard } from "@/lib/orders";
import { Board } from "./board";

export const dynamic = "force-dynamic";

export default async function StaffBoardPage() {
  const user = await requireRole("barista", "cashier", "admin");
  return <Board initial={await getBoard()} role={user.role} />;
}
