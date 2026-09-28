import { NavigationBar } from "@/components/ios";
import { getUser } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/orders";
import { OrdersList } from "./orders-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pesanan" };

export default async function OrdersPage() {
  const u = await getUser();
  const mine = u?.role === "customer" ? await listOrdersForUser(u.id) : null;
  return (
    <>
      <NavigationBar large title="Pesanan" />
      <OrdersList mine={mine} />
    </>
  );
}
