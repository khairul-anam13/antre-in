import "server-only";
import { headers } from "next/headers";

/** URL publik aplikasi: APP_URL bila diisi, jika tidak diturunkan dari header (cocok untuk preview deploy Vercel). */
export async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** IP klien dari header proxy (diisi Vercel di produksi); null secara lokal atau tanpa proxy. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
