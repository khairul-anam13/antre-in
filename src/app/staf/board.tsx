"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, GlassCard, SearchField, Switch } from "@/components/ios";
import { chime } from "@/components/sound";
import { queueLabel, rupiah, timeWIB } from "@/lib/format";
import type { BoardOrder } from "@/lib/orders";
import type { Role } from "@/lib/auth";
import { advance } from "./actions";

type Data = { orders: BoardOrder[]; drinksInQueue: number; now: string };
const LATE_MIN = 10;

export function Board({ initial, role }: { initial: Data; role: Role }) {
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancel, setCancel] = useState<BoardOrder | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set(initial.orders.map((o) => o.id)));
  const fresh = useRef(new Set<string>());
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const canBrew = role === "barista" || role === "admin";
  const canHand = role === "cashier" || role === "admin";

  const load = useCallback(async () => {
    const r = await fetch("/api/staf/orders", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d: Data = await r.json();
    const added = d.orders.filter((o) => !seen.current.has(o.id));
    added.forEach((o) => { seen.current.add(o.id); fresh.current.add(o.id); });
    if (added.some((o) => o.status === "queued") && soundRef.current) chime();
    setData(d);
  }, []);

  useEffect(() => {
    try { setSound(localStorage.getItem("antre.sound") !== "0"); } catch { /* abaikan */ }
    const iv = setInterval(() => { if (!document.hidden) load(); }, 4000);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); clearInterval(tick); document.removeEventListener("visibilitychange", vis); };
  }, [load]);

  const act = async (id: string, next: string) => {
    setBusy(id);
    const r = await advance(id, next);
    if (!r.ok && r.error) { setMsg(r.error); setTimeout(() => setMsg(null), 3000); }
    await load();
    setBusy(null);
  };

  const needle = q.trim().toLowerCase();
  const match = (o: BoardOrder) => !needle || queueLabel(o.queueNo).toLowerCase().includes(needle) || o.name.toLowerCase().includes(needle);
  const list = data.orders.filter(match);
  const cols = [
    { key: "queued", title: "Masuk", items: list.filter((o) => o.status === "queued" && o.due) },
    { key: "preparing", title: "Dibuat", items: list.filter((o) => o.status === "preparing") },
    { key: "ready", title: "Siap diambil", items: list.filter((o) => o.status === "ready") },
  ];
  const scheduled = list.filter((o) => o.status === "queued" && !o.due);

  const ticket = (o: BoardOrder) => {
    const since = Math.floor((now - new Date(o.scheduledFor && o.due ? o.scheduledFor : o.paidAt).getTime()) / 60000);
    const late = (o.status === "queued" || o.status === "preparing") && since >= LATE_MIN;
    return (
      <GlassCard key={o.id} variant="strong" className={`ticket ${late ? "ticket--late" : ""} ${fresh.current.has(o.id) ? "ticket--new" : ""}`}>
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="ticket__no">{queueLabel(o.queueNo)}</div>
            <div className="t-headline">{o.name}</div>
            <div className="t-foot muted">{o.phone}</div>
          </div>
          <div className="stack right">
            {o.scheduledFor && <span className="badge badge--tint">Ambil {timeWIB(o.scheduledFor)}</span>}
            {late && <span className="badge badge--orange">{since} mnt</span>}
            {!late && o.status !== "ready" && since >= 0 && <span className="badge">{since} mnt</span>}
          </div>
        </div>
        <ul>
          {o.items.map((it, i) => (
            <li key={i}>
              <b className="t-num">{it.qty}×</b>
              <span>{it.name}{it.options.length > 0 && <span className="muted t-sub"> · {it.options.map((x) => x.name).join(", ")}</span>}{it.note && <span className="t-sub"> — “{it.note}”</span>}</span>
            </li>
          ))}
        </ul>
        {o.note && <p className="notice notice--warn mt-8 t-sub">Catatan: {o.note}</p>}
        <div className="row mt-16 wrap">
          {o.status === "queued" && canBrew && <Button disabled={busy === o.id} onClick={() => act(o.id, "preparing")}>Mulai buat</Button>}
          {o.status === "queued" && canBrew && <Button variant="tinted" disabled={busy === o.id} onClick={() => act(o.id, "ready")}>Langsung siap</Button>}
          {o.status === "preparing" && canBrew && <Button disabled={busy === o.id} onClick={() => act(o.id, "ready")}>Siap diambil</Button>}
          {o.status === "ready" && canHand && <Button disabled={busy === o.id} onClick={() => act(o.id, "picked_up")}>Serahkan</Button>}
          {canHand && <Button variant="plain" destructive disabled={busy === o.id} onClick={() => setCancel(o)}>Batalkan</Button>}
          <span className="grow" />
          <span className="t-foot muted t-num">{rupiah(o.total)}</span>
        </div>
      </GlassCard>
    );
  };

  return (
    <div className="stack-lg">
      <div className="spread wrap">
        <div>
          <h1 className="t-title2">Antrean</h1>
          <p className="t-sub muted">{data.drinksInQueue} minuman menunggu · {data.orders.filter((o) => o.status === "ready").length} siap diambil</p>
        </div>
        <div className="row wrap">
          <div style={{ width: 220 }}><SearchField placeholder="Nomor / nama" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pesanan" /></div>
          <label className="row t-sub">Bunyi <Switch checked={sound} aria-label="Bunyi pesanan baru" onChange={(v) => { setSound(v); try { localStorage.setItem("antre.sound", v ? "1" : "0"); } catch { /* abaikan */ } if (v) chime(); }} /></label>
        </div>
      </div>
      {msg && <p className="notice notice--warn" role="status">{msg}</p>}

      <div className="board">
        {cols.map((c) => (
          <section key={c.key} className="col" aria-label={c.title}>
            <div className="col__head"><h2 className="t-headline">{c.title}</h2><span className="badge">{c.items.length}</span></div>
            {c.items.length === 0 ? <p className="empty">Kosong</p> : c.items.map(ticket)}
          </section>
        ))}
      </div>

      {scheduled.length > 0 && (
        <section className="col" aria-label="Terjadwal">
          <div className="col__head"><h2 className="t-headline">Terjadwal (belum masuk dapur)</h2><span className="badge">{scheduled.length}</span></div>
          <div className="board">{scheduled.map(ticket)}</div>
        </section>
      )}

      {cancel && (
        <div className="scrim" role="presentation">
          <Alert title={`Batalkan ${queueLabel(cancel.queueNo)}?`} message={`Pesanan ${cancel.name} sudah dibayar (${rupiah(cancel.total)}). Pelanggan diberi tahu; pengembalian dana dilakukan manual lewat dashboard Midtrans.`}
            actions={[{ label: "Kembali", style: "cancel", onPress: () => setCancel(null) }, { label: "Batalkan pesanan", style: "destructive", onPress: () => { const id = cancel.id; setCancel(null); act(id, "cancelled"); } }]} />
        </div>
      )}
    </div>
  );
}
