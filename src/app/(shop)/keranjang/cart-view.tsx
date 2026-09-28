"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, GlassCard, Icon, List, SegmentedControl } from "@/components/ios";
import { btnClass } from "@/lib/ui";
import { useCart } from "@/components/cart";
import { getProfile, saveOrderRef, saveProfile } from "@/components/local";
import { rupiah } from "@/lib/format";
import { placeOrder, quoteAction } from "@/app/actions";

type Quoted = Awaited<ReturnType<typeof quoteAction>>;

export function CartView({ user }: { user: { name: string; phone: string } | null }) {
  const cart = useCart();
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState("");
  const [quoted, setQuoted] = useState<Quoted | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"asap" | "slot">("asap");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = getProfile();
    setName(user?.name || p.name);
    setPhone(user?.phone || p.phone);
  }, [user]);

  // Harga terverifikasi server; dihitung ulang setiap isi keranjang / voucher berubah.
  const sig = useMemo(() => JSON.stringify(cart.items.map((i) => [i.productId, i.qty, i.optionIds, i.note])) + "|" + voucher, [cart.items, voucher]);
  useEffect(() => {
    if (!cart.ready || cart.items.length === 0) return;
    let stale = false;
    const t = setTimeout(async () => {
      const r = await quoteAction(cart.items.map(({ productId, qty, optionIds, note }) => ({ productId, qty, optionIds, note })), voucher);
      if (!stale) setQuoted(r);
    }, 250);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, cart.ready]);

  const applied = !!voucher && voucherInput.trim() === voucher;
  const q = quoted?.q ?? null;
  const pickup = quoted?.pickup;
  const asapOk = !!pickup?.asap;
  const effMode = asapOk ? mode : "slot";
  const drinks = q?.drinks ?? 0;
  const chosen = pickup?.slots.find((s) => s.start === slot);
  const slotOk = !!chosen && chosen.remaining >= drinks;
  const canPay = !!q && !quoted?.error && !busy && name.trim().length > 0 && phone.trim().length >= 8 && (effMode === "asap" ? asapOk : slotOk);

  const pay = async () => {
    setBusy(true); setErr(null);
    const r = await placeOrder({
      items: cart.items.map(({ productId, qty, optionIds, note }) => ({ productId, qty, optionIds, note })),
      voucher: quoted?.voucherError ? "" : voucher, name, phone, note, slot: effMode === "slot" ? slot : null,
    });
    if (!r.ok) { setErr(r.error); setBusy(false); return; }
    saveProfile({ name, phone });
    saveOrderRef({ id: r.id, token: r.token });
    cart.clear();
    window.location.assign(r.url); // halaman bayar Midtrans (atau simulasi di dev)
  };

  if (cart.ready && cart.items.length === 0) {
    return (
      <div className="page">
        <GlassCard variant="strong" className="center" title="Keranjang masih kosong">
          <p className="t-sub muted">Pilih minuman favoritmu dulu, lalu kembali ke sini untuk membayar.</p>
          <div className="mt-16"><Link href="/" className={btnClass("filled", "large")}>Lihat menu</Link></div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="page stack-lg">
      <List header="Pesanan Anda">
        {cart.items.map((it, idx) => {
          const line = q?.lines[idx];
          const unit = line?.unit_price ?? it.unit;
          return (
            <div key={it.key} className="product" style={{ cursor: "default" }}>
              <div className="tile" style={{ ["--c" as string]: `var(${it.color})`, width: 48, height: 48 }}><Icon name="cup" /></div>
              <div className="product__body">
                <div className="t-headline">{it.name}</div>
                {it.optionLabels.length > 0 && <div className="t-foot muted">{it.optionLabels.join(" · ")}</div>}
                {it.note && <div className="t-foot muted">“{it.note}”</div>}
                <div className="row mt-8">
                  <div className="stepper">
                    <button type="button" aria-label="Kurangi" onClick={() => (it.qty <= 1 ? cart.remove(it.key) : cart.setQty(it.key, it.qty - 1))}><Icon name={it.qty <= 1 ? "trash" : "minus"} /></button>
                    <span>{it.qty}</span>
                    <button type="button" aria-label="Tambah" disabled={it.qty >= 20} onClick={() => cart.setQty(it.key, it.qty + 1)}><Icon name="plus" /></button>
                  </div>
                </div>
              </div>
              <div className="t-headline t-num">{rupiah(unit * it.qty)}</div>
            </div>
          );
        })}
      </List>
      {quoted?.error && <p className="notice notice--err" role="alert">{quoted.error}. Hapus atau ganti item tersebut untuk melanjutkan.</p>}

      <section>
        <div className="eyebrow">Pengambilan</div>
        <div className="stack">
          {asapOk && <SegmentedControl<"asap" | "slot"> aria-label="Waktu ambil" value={effMode} onChange={setMode} options={[{ value: "asap", label: "Sekarang" }, { value: "slot", label: "Jadwalkan" }]} />}
          {!asapOk && pickup && <p className="notice notice--warn">{pickup.closedNote}</p>}
          {effMode === "asap" && asapOk && (
            <GlassCard variant="subtle">
              <div className="row"><Icon name="clock" size={22} /><span className="t-sub">Siap sekitar <b>{pickup?.asapMinutes ?? "…"} menit</b> setelah dibayar. Nomor antrean diberikan setelah pembayaran.</span></div>
            </GlassCard>
          )}
          {effMode === "slot" && (
            pickup && pickup.slots.length > 0 ? (
              <>
                <div className="slots" role="radiogroup" aria-label="Jam pengambilan">
                  {pickup.slots.map((s) => (
                    <Button key={s.start} size="medium" variant={slot === s.start ? "filled" : "gray"} role="radio" aria-checked={slot === s.start}
                      disabled={s.full || s.remaining < drinks} onClick={() => setSlot(s.start)} title={s.full ? "Penuh" : `Sisa ${s.remaining} minuman`}>{s.label}</Button>
                  ))}
                </div>
                <p className="t-foot muted center">{chosen ? `Diambil pukul ${chosen.label} · sisa kuota ${chosen.remaining} minuman` : "Pilih jam. Slot abu-abu sudah penuh atau tidak cukup untuk jumlah minumanmu."}</p>
              </>
            ) : <p className="notice notice--warn">Tidak ada slot tersedia hari ini.</p>
          )}
        </div>
      </section>

      <section>
        <div className="eyebrow">Voucher</div>
        <div className="row">
          <input className="field grow" placeholder="Kode voucher" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} autoCapitalize="characters" aria-label="Kode voucher" />
          <Button variant="tinted" size="large" style={{ minWidth: 0, height: 44 }} disabled={!applied && !voucherInput.trim()}
            onClick={() => (applied ? (setVoucher(""), setVoucherInput("")) : setVoucher(voucherInput.trim()))}>{applied ? "Hapus" : "Pakai"}</Button>
        </div>
        {quoted?.voucherError && <p className="err mt-8">{quoted.voucherError}</p>}
        {q?.voucher && !quoted?.voucherError && <p className="ok mt-8">Voucher {q.voucher} dipakai · hemat {rupiah(q.discount)}</p>}
      </section>

      <section className="stack">
        <div className="eyebrow" style={{ paddingBottom: 0 }}>Data pemesan</div>
        <div><label className="label" htmlFor="nm">Nama</label><input id="nm" className="field" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama untuk dipanggil" /></div>
        <div><label className="label" htmlFor="hp">No. HP</label><input id="hp" className="field" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" /></div>
        <div><label className="label" htmlFor="nt">Catatan untuk kedai (opsional)</label><input id="nt" className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </section>

      <div className="checkout-bar">
        <GlassCard variant="strong" style={{ padding: 14 }}>
          <div className="stack" style={{ gap: 4, marginBottom: 12 }}>
            <div className="spread t-sub"><span className="muted">Subtotal</span><span className="t-num">{q ? rupiah(q.subtotal) : "…"}</span></div>
            {q && q.discount > 0 && <div className="spread t-sub"><span className="muted">Diskon</span><span className="t-num">−{rupiah(q.discount)}</span></div>}
            <div className="spread t-headline"><span>Total</span><span className="t-num">{q ? rupiah(q.total) : "…"}</span></div>
          </div>
          {err && <p className="err mb-8" role="alert">{err}</p>}
          <Button size="large" className="full" disabled={!canPay} onClick={pay}>{busy ? "Memproses…" : q ? `Bayar · ${rupiah(q.total)}` : "Memuat harga…"}</Button>
        </GlassCard>
      </div>
    </div>
  );
}
