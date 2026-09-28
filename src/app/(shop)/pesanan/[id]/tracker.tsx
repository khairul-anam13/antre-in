"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, GlassCard, Icon, List, ListRow } from "@/components/ios";
import { btnClass } from "@/lib/ui";
import { saveOrderRef } from "@/components/local";
import { chime } from "@/components/sound";
import { STATUS_LABEL, queueLabel, rupiah, timeWIB } from "@/lib/format";
import type { OrderView } from "@/lib/orders";

const FINAL = ["picked_up", "cancelled", "expired"];
const STEPS = ["Pembayaran diterima", "Menunggu giliran", "Sedang dibuat", "Siap diambil"];
const CUR: Record<string, number> = { queued: 1, preparing: 2, ready: 4, picked_up: 4 }; // 4 = semua langkah selesai

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export function Tracker({ initial, token, vapidKey }: { initial: OrderView; token: string | null; vapidKey: string | null }) {
  const [o, setO] = useState(initial);
  const [push, setPush] = useState<"na" | "ask" | "on" | "denied">("na");
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef(initial.status);

  useEffect(() => { if (token) saveOrderRef({ id: o.id, token }); }, [o.id, token]);

  // Polling: berhenti saat pesanan selesai, jeda saat tab tersembunyi, segarkan saat tab kembali aktif.
  useEffect(() => {
    if (FINAL.includes(o.status)) return;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      const r = await fetch(`/api/orders/${o.id}${token ? `?t=${token}` : ""}`, { cache: "no-store" }).catch(() => null);
      if (r?.ok && !stop) setO(await r.json());
    };
    const iv = setInterval(tick, push === "on" && o.status !== "awaiting_payment" ? 15000 : 5000);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [o.id, o.status, token, push]);

  // Hitung mundur / estimasi hidup.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Siap diambil → getar + bunyi.
  useEffect(() => {
    if (prev.current !== "ready" && o.status === "ready") { navigator.vibrate?.([220, 120, 220, 120, 400]); chime(); }
    prev.current = o.status;
  }, [o.status]);

  const subscribe = useCallback(async (interactive: boolean) => {
    if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (interactive && Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return setPush("denied");
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey) }));
    const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: o.id, token, subscription: sub.toJSON() }) });
    if (r.ok) setPush("on");
  }, [vapidKey, o.id, token]);

  // Sudah pernah mengizinkan → langganan otomatis untuk pesanan ini. Belum → tawarkan.
  useEffect(() => {
    if (!vapidKey || typeof Notification === "undefined" || !("PushManager" in window) || FINAL.includes(initial.status)) return;
    if (Notification.permission === "granted") subscribe(false).catch(() => {});
    else if (Notification.permission === "default") setPush("ask");
    else setPush("denied");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = o.status;
  const cur = CUR[s] ?? -1;
  const eta = o.etaAt ? new Date(o.etaAt).getTime() : null;
  const etaMin = eta ? Math.max(1, Math.ceil((eta - now) / 60000)) : null;
  const payLeft = o.paymentExpiresAt ? Math.max(0, Math.floor((new Date(o.paymentExpiresAt).getTime() - now) / 1000)) : 0;

  return (
    <div className="page stack-lg pt-16">
      {s === "awaiting_payment" && (
        <GlassCard variant="strong" className="center" eyebrow="Menunggu pembayaran" title={rupiah(o.total)}>
          <p className="t-sub muted mt-8">{payLeft > 0 ? `Selesaikan dalam ${Math.floor(payLeft / 60)}:${String(payLeft % 60).padStart(2, "0")}` : "Batas waktu hampir habis"}</p>
          {o.payUrl && <div className="mt-16"><a href={o.payUrl} className={btnClass("filled", "large")}>Bayar sekarang</a></div>}
        </GlassCard>
      )}

      {(s === "queued" || s === "preparing") && (
        <GlassCard variant="strong" className="queue-card" eyebrow="Nomor antrean Anda">
          <div className="queue-no">{queueLabel(o.queueNo)}</div>
          <p className="t-headline mt-8">{STATUS_LABEL[s]}</p>
          {o.scheduledFor ? (
            <p className="t-sub muted mt-8">Dijadwalkan diambil pukul <b>{timeWIB(o.scheduledFor)}</b></p>
          ) : (
            <p className="t-sub muted mt-8">
              {o.ahead > 0 ? `${o.ahead} pesanan di depan Anda · ` : "Giliran Anda berikutnya · "}
              siap sekitar <b>{etaMin} menit</b> ({eta ? timeWIB(eta) : "—"})
            </p>
          )}
        </GlassCard>
      )}

      {s === "ready" && (
        <GlassCard variant="strong" className="queue-card ready-glow" eyebrow="Pesanan siap diambil!">
          <div className="queue-no">{queueLabel(o.queueNo)}</div>
          <p className="t-headline mt-8">Tunjukkan nomor ini ke kasir</p>
        </GlassCard>
      )}

      {s === "picked_up" && (
        <GlassCard variant="strong" className="center" eyebrow={`Nomor ${queueLabel(o.queueNo)}`} title="Selamat menikmati!">
          <p className="t-sub muted">Pesanan sudah diambil. Terima kasih sudah memesan lewat Antre-in.</p>
        </GlassCard>
      )}

      {(s === "cancelled" || s === "expired") && (
        <Alert title={s === "expired" ? "Pembayaran kedaluwarsa" : "Pesanan dibatalkan"}
          message={s === "expired" ? "Waktu pembayaran habis dan pesanan tidak diproses. Silakan pesan ulang." : o.paidAt ? "Kedai membatalkan pesanan ini. Hubungi kasir untuk pengembalian dana." : "Pesanan ini tidak jadi diproses."}
          actions={[{ label: "Pesan lagi", style: "cancel", onPress: () => (location.href = "/") }]} className="" />
      )}

      {cur >= 0 && (
        <List header="Progres">
          <div className="timeline">
            {STEPS.map((label, i) => (
              <div key={label} className={`tl ${i < cur ? "tl--done" : i === cur ? "tl--now" : ""}`}>
                <span className="tl__dot">{i < cur ? <Icon name="check" /> : null}</span>
                <div>
                  <div className="t-headline">{label}</div>
                  {i === 1 && o.paidAt && cur === 1 && <div className="t-foot muted">Dibayar {timeWIB(o.paidAt)}</div>}
                  {i === 3 && o.readyAt && cur >= 3 && <div className="t-foot muted">Siap sejak {timeWIB(o.readyAt)}</div>}
                </div>
              </div>
            ))}
          </div>
        </List>
      )}

      {push === "ask" && !FINAL.includes(s) && s !== "ready" && (
        <List>
          <ListRow icon={<Icon name="bell" />} iconColor="system-orange" title="Beritahu saya saat siap" subtitle="Notifikasi muncul meski layar terkunci" onClick={() => subscribe(true)} accessory="chevron" />
        </List>
      )}
      {push === "on" && !FINAL.includes(s) && s !== "ready" && <p className="t-foot muted center">Notifikasi aktif — kami kabari saat pesanan siap.</p>}
      {push === "denied" && !FINAL.includes(s) && <p className="t-foot muted center">Notifikasi diblokir di browser. Biarkan halaman ini terbuka untuk memantau.</p>}

      <List header="Rincian pesanan" footer={`Atas nama ${o.customerName}${o.note ? ` · “${o.note}”` : ""}`}>
        {o.items.map((it, i) => (
          <ListRow key={i} title={`${it.qty}× ${it.name}`} subtitle={[...it.options.map((x) => x.name), it.note && `“${it.note}”`].filter(Boolean).join(" · ") || undefined} detail={rupiah(it.unit_price * it.qty)} />
        ))}
        {o.discount > 0 && <ListRow title={`Voucher ${o.voucher ?? ""}`} detail={`−${rupiah(o.discount)}`} />}
        <ListRow title={<b>Total</b>} detail={<b>{rupiah(o.total)}</b>} />
      </List>

      {o.scheduledFor && s !== "picked_up" && <p className="t-foot muted center">Jam pengambilan terjadwal: {timeWIB(o.scheduledFor)}</p>}
    </div>
  );
}
