"use client";
/** Bunyi dua nada pendek (WebAudio) — tanpa berkas audio. Bisa diblokir browser sebelum ada interaksi; gagal diam-diam. */
export function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.18;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.17);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* abaikan */ }
}
