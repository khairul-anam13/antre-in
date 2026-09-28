import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { hashPassword, verifyPassword } from "./password.ts";

export type Role = "customer" | "cashier" | "barista" | "admin";
export type User = { id: string; email: string | null; name: string; phone: string | null; role: Role };

const COOKIE = "antre_sid";
const DAYS = 30;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const secure = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = COOKIE;
export const sessionCookieOpts = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: DAYS * 86400 };

async function newSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await sql`delete from sessions where expires_at < now()`;
  await sql`insert into sessions (id, user_id, expires_at) values (${sha(token)}, ${userId}, now() + make_interval(days => ${DAYS}::int))`;
  return token;
}

/** Untuk server action: buat sesi dan pasang cookie. */
export async function createSession(userId: string) {
  (await cookies()).set(COOKIE, await newSession(userId), sessionCookieOpts);
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await sql`delete from sessions where id = ${sha(t)}`;
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const [u] = await sql<User[]>`
    select u.id, u.email, u.name, u.phone, u.role from sessions s join users u on u.id = s.user_id
    where s.id = ${sha(t)} and s.expires_at > now()`;
  return u ?? null;
});

export const isStaff = (u: User | null): u is User => !!u && u.role !== "customer";

/** Untuk layout/halaman/aksi yang dibatasi. Belum login → /masuk; peran salah → beranda. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/masuk");
  if (!roles.includes(u.role)) redirect("/");
  return u;
}

const DUMMY = await hashPassword("dummy-untuk-menyamakan-waktu");
const MAX_FAILS = 5;

/** Login staf (email + password). Kunci 15 menit setelah 5 kali gagal. */
export async function loginStaff(email: string, password: string): Promise<{ error?: string; role?: Role }> {
  const [u] = await sql`select id, role, password_hash, failed_logins, locked_until from users where email = ${email.trim().toLowerCase()} and role <> 'customer'`;
  if (u?.locked_until && u.locked_until > new Date()) return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY);
  if (!u || !ok) {
    if (u) await sql`update users set
      locked_until = case when failed_logins + 1 >= ${MAX_FAILS} then now() + interval '15 minutes' else locked_until end,
      failed_logins = case when failed_logins + 1 >= ${MAX_FAILS} then 0 else failed_logins + 1 end
      where id = ${u.id}`;
    return { error: "Email atau password salah." };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  await createSession(u.id);
  return { role: u.role };
}

/** Masuk lewat Google: buat pelanggan baru atau ambil yang sudah ada. Mengembalikan token sesi; pemanggil memasang cookie di response. */
export async function googleSignIn(p: { sub: string; email: string; name: string }): Promise<{ error?: string; token?: string }> {
  const email = p.email.toLowerCase();
  const [byEmail] = await sql`select id, role, google_sub from users where email = ${email}`;
  if (byEmail && byEmail.role !== "customer") return { error: "Email ini terdaftar sebagai staf. Gunakan login staf." };
  const [u] = byEmail
    ? await sql`update users set google_sub = ${p.sub}, name = ${p.name} where id = ${byEmail.id} returning id`
    : await sql`
        insert into users (email, name, google_sub) values (${email}, ${p.name}, ${p.sub})
        on conflict (google_sub) do update set name = excluded.name
        returning id`;
  return { token: await newSession(u.id) };
}
