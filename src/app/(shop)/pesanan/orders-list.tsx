"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GlassCard, Icon, List, ListRow } from "@/components/ios";
import { btnClass } from "@/lib/ui";
import { getOrderRefs } from "@/components/local";
import { STATUS_LABEL, dateTimeWIB, queueLabel, rupiah } from "@/lib/format";
import type { OrderView } from "@/lib/orders";

const ACTIVE = ["awaiting_payment", "queued", "preparing", "ready"];
const TONE: Record<string, string> = { awaiting_payment: "badge--orange", queued: "badge--tint", preparing: "badge--tint", ready: "badge--green", cancelled: "badge--red", expired: "badge--red", picked_up: "" };

/** `mine` = pesanan akun (dari server, disegarkan lewat router.refresh). null = tamu: ambil dari referensi di browser. */
export function OrdersList({ mine }: { mine: OrderView[] | null }) {
  const router = useRouter();
  const [guest, setGuest] = useState<OrderView[] | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const orders = mine ?? guest;
  const anyActive = !!orders?.some((o) => ACTIVE.includes(o.status));

  useEffect(() => {
    const refs = getOrderRefs();
    setTokens(Object.fromEntries(refs.map((r) => [r.id, r.token])));
    const load = async (first = false) => {
      if (document.hidden && !first) return; // polling berhenti saat tab tersembunyi; muat awal selalu jalan
      if (mine) return router.refresh();
      if (!refs.length) return setGuest([]);
      const r = await fetch("/api/orders/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refs }) }).catch(() => null);
      if (r?.ok) setGuest((await r.json()).orders);
    };
    if (!mine) load(true);
    if (mine && !anyActive) return;
    if (!mine && guest && !anyActive) return;
    const iv = setInterval(() => load(), 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine === null, anyActive]);

  if (!orders) return <div className="page"><p className="empty">Memuat…</p></div>;
  if (orders.length === 0)
    return (
      <div className="page">
        <GlassCard variant="strong" className="center" title="Belum ada pesanan">
          <p className="t-sub muted">Pesanan yang Anda buat di perangkat ini akan muncul di sini.</p>
          <div className="mt-16"><Link href="/" className={btnClass("filled", "large")}>Mulai pesan</Link></div>
        </GlassCard>
      </div>
    );

  const row = (o: OrderView) => (
    <ListRow key={o.id} href={`/pesanan/${o.id}${tokens[o.id] ? `?t=${tokens[o.id]}` : ""}`}
      icon={<Icon name={o.status === "ready" ? "bell" : "receipt"} />} iconColor={o.status === "ready" ? "system-green" : ACTIVE.includes(o.status) ? "system-blue" : "system-gray"}
      title={o.queueNo ? `${queueLabel(o.queueNo)} · ${rupiah(o.total)}` : rupiah(o.total)}
      subtitle={`${o.items.reduce((n, i) => n + i.qty, 0)} minuman · ${dateTimeWIB(o.createdAt)}`}
      detail={<span className={`badge ${TONE[o.status] ?? ""}`}>{STATUS_LABEL[o.status]}</span>} accessory="chevron" />
  );
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));

  return (
    <div className="page">
      {active.length > 0 && <List header="Sedang berjalan">{active.map(row)}</List>}
      {past.length > 0 && <List header="Riwayat">{past.map(row)}</List>}
    </div>
  );
}
