// Format tampilan — aman dipakai di server maupun client.
export const WIB = "Asia/Jakarta";

export const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

/** Nomor antrean tampil: A012 */
export const queueLabel = (n: number | null | undefined) => (n == null ? "—" : "A" + String(n).padStart(3, "0"));

const hm = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WIB });
export const timeWIB = (d: Date | string | number) => hm.format(new Date(d)).replace(".", ":");

const dt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WIB });
export const dateTimeWIB = (d: Date | string | number) => dt.format(new Date(d)).replace(".", ":");

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Menunggu pembayaran",
  queued: "Dalam antrean",
  preparing: "Sedang dibuat",
  ready: "Siap diambil",
  picked_up: "Sudah diambil",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};
