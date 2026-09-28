// Setup database: npm run db -- setup | schema | seed | admin | reset
import postgres from "postgres";
import { hashPassword } from "../src/lib/password.ts";

try { process.loadEnvFile(".env.local"); } catch { /* produksi: env dari platform */ }
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi");
const sql = postgres(url, { prepare: false, onnotice: () => {} });

const cmds = {
  schema: () => sql.file("db/schema.sql"),
  async seed() {
    const [{ n }] = await sql`select count(*)::int n from categories`;
    if (n > 0) return console.log("seed dilewati: menu sudah ada");
    await sql.file("db/seed.sql");
    console.log("seed menu demo selesai");
  },
  async admin() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const pw = process.env.ADMIN_PASSWORD;
    if (!email || !pw || pw.length < 8) throw new Error("Isi ADMIN_EMAIL dan ADMIN_PASSWORD (min. 8 karakter)");
    const hash = await hashPassword(pw);
    await sql`insert into users (email, name, role, password_hash) values (${email}, 'Admin', 'admin', ${hash})
              on conflict (email) do update set role = 'admin', password_hash = ${hash}, failed_logins = 0, locked_until = null`;
    console.log(`admin siap: ${email}`);
  },
  async reset() {
    if (!process.argv.includes("--yes")) throw new Error("reset menghapus SEMUA data. Tambahkan --yes untuk melanjutkan");
    await sql`drop schema public cascade`;
    await sql`create schema public`;
    await run(["schema", "seed", "admin"]);
  },
  setup: () => run(["schema", "seed", "admin"]),
};

async function run(names) {
  for (const n of names) { await cmds[n](); if (n === "schema") console.log("skema siap"); }
}

const cmd = process.argv[2] ?? "setup";
if (!cmds[cmd]) throw new Error(`Perintah tidak dikenal: ${cmd} (setup|schema|seed|admin|reset)`);
try { await cmds[cmd](); } finally { await sql.end(); }
