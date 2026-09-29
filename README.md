# Antre-in

Pre-order take-away untuk kedai minuman, dibuat untuk memecah antrean panjang di kasir: pelanggan memesan dan membayar dari HP, dapur bekerja dari layar antrean, pelanggan datang saat nomornya **siap diambil**.

- **Pelanggan** — menu & opsi (ukuran, gula, es, topping), keranjang, voucher, ambil *sekarang* (dengan estimasi) atau *terjadwal* per slot berkuota, bayar online (Midtrans), pantau status hidup, notifikasi web push.
- **Staf** — papan antrean (Masuk → Dibuat → Siap → Diserahkan), bunyi pesanan baru, stok menu/topping.
- **Admin** — laporan penjualan (+ CSV), kelola menu/opsi/voucher, pengaturan kapasitas dapur, akun staf.
- **Desain** — [iOS Design System](design/tokens.json) buatan sendiri (glass, Dynamic Type, mode terang/gelap). Token di-generate ke `src/app/tokens.css`; komponen di `src/components/ios.tsx`.

**Stack:** Next.js 16 (App Router) · TypeScript · Postgres (`postgres.js`, tanpa ORM) · Midtrans Snap · Web Push. Tidak ada dependensi UI/CSS tambahan.

## Peran

| Peran | Bisa |
|---|---|
| Pelanggan (tamu / Google) | Memesan, melacak pesanan sendiri |
| Barista | Mulai buat, tandai siap, atur stok |
| Kasir | Serahkan pesanan, batalkan, atur stok |
| Admin | Semua di atas + laporan, menu, voucher, pengaturan, akun staf |

## Jalankan lokal

Butuh Node 24+ dan Postgres.

```bash
npm install
cp .env.example .env.local        # lalu isi DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, VAPID_*
npm run db -- setup               # skema + menu demo + akun admin (aman diulang)
npm run dev                       # http://localhost:3000
```

Database lokal memakai Postgres 17 yang sudah terpasang di komputer ini (service `postgresql-x64-17`, port 5432), dengan role terbatas `antre` (bukan superuser `postgres`) yang hanya punya akses ke database `antre_in`. Ini **permanen** — beda dari Postgres sementara yang pernah dipakai untuk pengujian awal dan mati saat sesi berakhir. Kredensial ada di `.env.local` (tidak masuk git).

Tanpa kunci Midtrans, halaman bayar berupa **simulasi** (hanya di development — otomatis mati di produksi). Login staf di `/masuk`, pelanggan Google butuh `GOOGLE_CLIENT_ID/SECRET`.

Perintah lain: `npm run db -- reset --yes` (hapus semua data lokal), `npm run tokens` (generate ulang token CSS dari `design/tokens.json`), `npm run typecheck`, `npm run build`.

### Tes

```bash
npm test          # logika murni: harga, voucher, slot, estimasi (tanpa DB)
npm run test:db   # jalur uang & antrean di Postgres nyata (kuota slot, voucher, konkurensi, kedaluwarsa)
```

`test:db` memakai database **terpisah** dan menghapus datanya. Buat DB kosong, jalankan `DATABASE_URL=<url tes> npm run db -- setup`, lalu set `TEST_DATABASE_URL` (default: `postgres://antre:antre_dev_local@127.0.0.1:5432/antre_in_test`, database dev lokal — lihat bagian "Jalankan lokal").

## Deploy (Vercel + Supabase/Neon)

> **Perhatian lisensi:** paket **Hobby** Vercel hanya untuk penggunaan non-komersial. Kedai berjualan = komersial, jadi pakai paket Pro (atau host lain, mis. Cloudflare/Netlify/VPS).

1. **Database** — buat proyek Supabase (atau Neon). Ambil connection string **pooler** (transaction mode) dan tambahkan `?sslmode=require`. Jalankan sekali dari komputer Anda:
   ```bash
   DATABASE_URL="<connection string>" ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db -- setup
   ```
2. **Vercel** — import repo, lalu isi Environment Variables:

   | Variabel | Isi |
   |---|---|
   | `DATABASE_URL` | connection string di atas |
   | `APP_URL` | URL publik, mis. `https://antre-in.vercel.app` (tanpa `/` di akhir) |
   | `MIDTRANS_SERVER_KEY` | Server Key dari dashboard Midtrans |
   | `MIDTRANS_IS_PRODUCTION` | `false` untuk Sandbox, `true` untuk live |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | dari Google Cloud Console |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`, subject `mailto:email-anda` |

3. **Midtrans** — Dashboard › Settings › Payment › **Payment Notification URL** = `https://<APP_URL>/api/midtrans/notify`. Tanda tangan webhook diverifikasi; status juga dicek langsung ke Midtrans saat pelanggan membuka halaman pesanan, jadi pesanan tidak tersangkut bila webhook terlambat. **Selama kunci kosong di produksi, pemesanan ditolak** (tidak ada pesanan gratis).
4. **Google OAuth** — Authorized redirect URI = `https://<APP_URL>/api/auth/google/callback`.
5. Masuk `/masuk` sebagai admin → **Pengaturan**: isi nama kedai, jam buka, kecepatan dapur, kuota slot; **Menu**: ganti menu demo dengan menu asli; buat akun barista & kasir.

## Cara kerja antrean

- **Nomor antrean** (`A001`, reset tiap hari WIB) diberikan **saat pembayaran berhasil**, bukan saat memesan, sehingga pesanan tak terbayar tidak memakan nomor.
- **Estimasi "sekarang"** = `ceil((minuman di depan + minuman Anda) / kecepatan dapur)`. Atur *kecepatan dapur* (minuman/menit) di Pengaturan; ukur dengan kartu "Waktu ke siap" di Laporan.
- **Jadwalkan** memakai slot berkuota (mis. 15 menit, maks. 12 minuman). Kuota inilah yang meratakan lonjakan. Pesanan terjadwal baru tampil di layar barista N menit sebelum jam ambil (`schedule_lead_minutes`).
- Pesanan belum dibayar kedaluwarsa otomatis (default 30 menit); kuota voucher & slot dikembalikan. Pembayaran yang telat masuk tetap diterima.
- Pembuatan pesanan diserialkan dengan advisory lock Postgres → tak bisa kelebihan kuota walau banyak orang memesan bersamaan (dibuktikan di `test:db`).
- **Anti-spam:** maksimal 3 percobaan pesan per 10 menit per nomor HP *atau* per alamat IP (mana pun tercapai dulu) — dihitung dari tabel `orders` sendiri, jadi konsisten walau aplikasi jalan di banyak instance serverless. Batas ini ada di kode (`ORDER_RATE_WINDOW_MIN`/`ORDER_RATE_MAX` di `src/lib/orders.ts`), bukan di halaman Pengaturan.

## Batasan yang perlu diketahui

- **Status hidup memakai polling** (pelanggan 5 dtk, layar staf 4 dtk; berhenti saat tab tersembunyi/pesanan selesai). Cukup untuk satu kedai; bila ramai, pindah ke Supabase Realtime.
- **Refund manual** — membatalkan pesanan berbayar menandainya batal dan memberi tahu pelanggan; pengembalian dana dilakukan lewat dashboard Midtrans.
- **Push di iPhone** hanya bekerja bila situs dipasang ke Layar Utama (iOS 16.4+). Halaman pelacakan tetap jalan tanpa push.
- Gambar menu berupa **URL** (tanpa upload). Bila perlu upload, tambahkan Supabase Storage.
- Rate-limit: kunci login staf (5 gagal → 15 menit) dan anti-spam pemesanan (3 percobaan/10 menit per nomor HP atau IP, lihat "Cara kerja antrean"). Tidak ada rate-limit di rute lain (mis. pencarian menu).
- Semua rute dinamis (`ƒ`) — tidak ada halaman yang dirender saat build, jadi build tidak butuh database.

## Struktur

```
db/            schema.sql (idempoten), seed.sql (menu demo)
design/        tokens.json (sumber token iOS Design System)
scripts/       db.mjs (setup/reset/admin), gen-tokens.mjs
src/lib/       pricing, slots, format (murni) · orders, auth, menu, midtrans, push, reports (server)
src/components ios.tsx (komponen DS), cart, tab-bar, staff-shell, action-form
src/app/(shop) halaman pelanggan · staf/ · admin/ · api/
test/          logic.test.ts · db/orders.int.ts
```
