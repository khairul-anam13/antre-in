import postgres from "postgres";

// Satu koneksi per proses (aman untuk hot-reload dev & serverless). prepare:false → kompatibel dengan pooler Supabase/Neon.
const g = globalThis as unknown as { __antreSql?: postgres.Sql };
export const sql = (g.__antreSql ??= postgres(process.env.DATABASE_URL ?? "", {
  prepare: false, max: 5, idle_timeout: 20, onnotice: () => {},
}));
export type Sql = postgres.Sql;
