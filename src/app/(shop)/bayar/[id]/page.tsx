import { notFound, redirect } from "next/navigation";
import { GlassCard, NavigationBar } from "@/components/ios";
import { getUser } from "@/lib/auth";
import { mockPayments } from "@/lib/midtrans";
import { getOrderFor } from "@/lib/orders";
import { rupiah } from "@/lib/format";
import { MockPay } from "./mock-pay";

export const dynamic = "force-dynamic";

/** Simulasi pembayaran untuk development (tanpa kunci Midtrans). Tidak tersedia di produksi. */
export default async function MockPayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  if (!mockPayments) notFound();
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const order = await getOrderFor(id, t ?? null, await getUser());
  if (!order) notFound();
  if (order.status !== "awaiting_payment") redirect(`/pesanan/${id}${t ? `?t=${t}` : ""}`);
  return (
    <>
      <NavigationBar title="Pembayaran (simulasi)" />
      <div className="page stack-lg pt-16">
        <p className="notice notice--warn">Mode simulasi: kunci Midtrans belum diisi, jadi tidak ada uang yang bergerak. Halaman ini otomatis hilang di produksi.</p>
        <GlassCard variant="strong" className="center" eyebrow="Total pembayaran" title={rupiah(order.total)} />
        <MockPay id={id} token={t ?? ""} />
      </div>
    </>
  );
}
