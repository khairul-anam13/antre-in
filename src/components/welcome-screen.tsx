"use client";
import { useEffect, useState } from "react";
import { Button, GlassCard, Icon } from "./ios";
import { cx } from "@/lib/ui";

const KEY = "antre.welcomed";
const CLOSE_MS = 260; // cocok dengan durasi animasi keluar di app.css (.welcome-*--closing)

// Posisi gelembung tetap (bukan Math.random) supaya render server & klien sama persis — tema kedai: soda/boba naik pelan di balik kaca.
const BUBBLES = [
  { left: "8%", size: 14, dur: 7, delay: 0 },
  { left: "22%", size: 8, dur: 5.5, delay: 1.2 },
  { left: "38%", size: 18, dur: 8.5, delay: 2.4 },
  { left: "58%", size: 10, dur: 6, delay: 0.6 },
  { left: "74%", size: 16, dur: 7.5, delay: 3 },
  { left: "88%", size: 9, dur: 5, delay: 1.8 },
];

/**
 * Layar sambutan sebelum masuk ke aplikasi inti. Tampil sekali per sesi tab (sessionStorage).
 * Animasi & gelembung ada di luar iOS Design System dasar (ekstensi lokal bertema kedai minuman,
 * lihat blok "Welcome screen" di app.css); kartu sendiri tetap kaca DS (GlassCard strong).
 * skip: penguncian scroll latar belakang, add jika pengguna melaporkan halaman ikut tergulir di baliknya.
 */
export function WelcomeScreen({ shopName, isOpen, openTime, closeTime }: { shopName: string; isOpen: boolean; openTime: string; closeTime: string }) {
  // Sama di server & render pertama client (hindari mismatch hidrasi); dikoreksi sesaat setelah mount.
  const [show, setShow] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem(KEY)) setShow(false); } catch { /* storage diblokir: tampilkan saja */ }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setClosing(true);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* abaikan */ }
    setTimeout(() => setShow(false), CLOSE_MS);
  };

  return (
    <div className={cx("scrim", "welcome-scrim", closing && "welcome-scrim--closing")} role="dialog" aria-modal="true" aria-label={`Selamat datang di ${shopName}`}>
      {BUBBLES.map((b, i) => (
        <span key={i} className="welcome-bubble" aria-hidden
          style={{ left: b.left, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
      ))}
      <GlassCard variant="strong" className={cx("center", "welcome", "welcome-card", closing && "welcome-card--closing")}>
        <div className="welcome-tile tile tile--lg" style={{ margin: "0 auto", ["--c" as string]: "var(--system-blue)" }}><Icon name="cup" /></div>
        <h1 className="t-large mt-16">{shopName}</h1>
        <p className="row mt-8" style={{ justifyContent: "center" }}>
          <span className={cx("dot", "welcome-dot", !isOpen && "dot--off")} />
          <b>{isOpen ? "Buka sekarang" : "Tutup"}</b>
          <span className="muted">· {openTime}–{closeTime}</span>
        </p>
        <p className="t-sub muted mt-8">Pesan dari HP, bayar online, ambil tanpa antre.</p>
        <div className="mt-24"><Button size="large" style={{ width: "100%" }} onClick={dismiss} disabled={closing}>Mulai Pesan</Button></div>
      </GlassCard>
    </div>
  );
}
