import { NavigationBar } from "@/components/ios";
import { getUser } from "@/lib/auth";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Keranjang" };

export default async function CartPage() {
  const u = await getUser();
  return (
    <>
      <NavigationBar large title="Keranjang" />
      <CartView user={u?.role === "customer" ? { name: u.name, phone: u.phone ?? "" } : null} />
    </>
  );
}
