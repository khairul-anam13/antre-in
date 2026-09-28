import { notFound } from "next/navigation";
import { NavigationBar } from "@/components/ios";
import { getUser } from "@/lib/auth";
import { getOrderFor } from "@/lib/orders";
import { vapidPublicKey } from "@/lib/push";
import { Tracker } from "./tracker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status pesanan" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const token = typeof t === "string" ? t : null;
  const order = await getOrderFor(id, token, await getUser());
  if (!order) notFound();
  return (
    <>
      <NavigationBar title="Status pesanan" backLabel="Pesanan" backHref="/pesanan" />
      <Tracker initial={order} token={token} vapidKey={vapidPublicKey} />
    </>
  );
}
