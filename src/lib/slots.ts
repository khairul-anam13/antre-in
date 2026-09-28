// Slot pengambilan & estimasi antrean — logika murni. Indonesia tidak memakai DST, jadi WIB = UTC+7 tetap.
const OFFSET = 7 * 3600_000;
const MIN = 60_000;

/** "08:00" / "08:00:00" → menit sejak tengah malam */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Instan tengah malam WIB pada hari `now` (ms UTC). */
export const midnightWIB = (now: Date) => {
  const w = new Date(now.getTime() + OFFSET);
  return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - OFFSET;
};

export const hhmm = (ms: number) => {
  const w = new Date(ms + OFFSET);
  return `${String(w.getUTCHours()).padStart(2, "0")}:${String(w.getUTCMinutes()).padStart(2, "0")}`;
};

/** Menit dapur yang dibutuhkan: minuman di depan + pesanan ini, dibagi kecepatan dapur. Minimal 1. */
export const estimateMinutes = (ahead: number, qty: number, drinksPerMinute: number) =>
  Math.max(1, Math.ceil((ahead + qty) / drinksPerMinute));

export type Slot = { start: string; label: string; remaining: number; full: boolean };

type SlotCfg = {
  now: Date; open: string; close: string; slotMinutes: number; minLeadMinutes: number; capacity: number;
  /** minuman terpesan per slot, kunci = ISO awal slot */
  used: Record<string, number>;
};

/** Slot hari ini: mulai ≥ now+jeda, selaras grid dari jam buka, selesai ≤ jam tutup. */
export function buildSlots({ now, open, close, slotMinutes, minLeadMinutes, capacity, used }: SlotCfg): Slot[] {
  const day = midnightWIB(now);
  const openMs = day + toMinutes(open) * MIN;
  const closeMs = day + toMinutes(close) * MIN;
  const step = slotMinutes * MIN;
  const earliest = Math.max(openMs, now.getTime() + minLeadMinutes * MIN);
  let start = openMs + Math.ceil((earliest - openMs) / step) * step;
  const out: Slot[] = [];
  for (; start + step <= closeMs; start += step) {
    const iso = new Date(start).toISOString();
    const remaining = Math.max(0, capacity - (used[iso] ?? 0));
    out.push({ start: iso, label: hhmm(start), remaining, full: remaining === 0 });
  }
  return out;
}

/** Boleh pesan "sekarang"? Saklar manual menyala dan jam sekarang di antara buka–tutup. */
export function isOpenNow({ now, open, close, isOpen }: { now: Date; open: string; close: string; isOpen: boolean }) {
  const m = (now.getTime() - midnightWIB(now)) / MIN;
  return isOpen && m >= toMinutes(open) && m < toMinutes(close);
}

/** Validasi slot yang dikirim client: harus salah satu slot yang tersedia. */
export const findSlot = (slots: Slot[], iso: string) => slots.find((s) => s.start === iso);
