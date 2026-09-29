-- Antre-in — skema database (idempotent, aman dijalankan berulang). Zona waktu bisnis: Asia/Jakarta.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,                       -- selalu huruf kecil
  name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer','cashier','barista','admin')),
  google_sub text unique,
  password_hash text,                      -- hanya staf; pelanggan masuk lewat Google
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,                     -- sha256 dari token di cookie
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user on sessions(user_id);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'Kedai Antre-in',
  is_open boolean not null default true,              -- saklar manual buka/tutup
  open_time time not null default '08:00',
  close_time time not null default '21:00',
  slot_minutes int not null default 15 check (slot_minutes between 5 and 120),
  slot_capacity int not null default 12 check (slot_capacity > 0),   -- maks. minuman per slot terjadwal
  drinks_per_minute numeric(5,2) not null default 2 check (drinks_per_minute > 0), -- kecepatan dapur
  schedule_lead_minutes int not null default 10 check (schedule_lead_minutes >= 0), -- pesanan terjadwal masuk dapur X menit sebelum jam ambil
  min_schedule_minutes int not null default 20 check (min_schedule_minutes >= 0),  -- jeda minimum dari sekarang untuk pesan terjadwal
  max_drinks_per_order int not null default 20 check (max_drinks_per_order > 0),
  payment_expiry_minutes int not null default 30 check (payment_expiry_minutes > 0)
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists categories (
  id serial primary key,
  name text not null,
  sort int not null default 0
);

create table if not exists products (
  id serial primary key,
  category_id int references categories(id) on delete set null,
  name text not null,
  description text not null default '',
  price int not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,   -- stok: barista bisa menandai habis
  is_active boolean not null default true,      -- false = disembunyikan (hapus lunak)
  sort int not null default 0
);

create table if not exists option_groups (
  id serial primary key,
  name text not null,
  kind text not null default 'single' check (kind in ('single','multi')),
  required boolean not null default false,
  sort int not null default 0
);

create table if not exists options (
  id serial primary key,
  group_id int not null references option_groups(id) on delete cascade,
  name text not null,
  price_delta int not null default 0,
  is_default boolean not null default false,
  is_available boolean not null default true,
  sort int not null default 0
);

create table if not exists product_option_groups (
  product_id int not null references products(id) on delete cascade,
  group_id int not null references option_groups(id) on delete cascade,
  primary key (product_id, group_id)
);

create table if not exists vouchers (
  code text primary key,                        -- huruf besar
  kind text not null check (kind in ('percent','amount')),
  value int not null check (value > 0),
  min_subtotal int not null default 0,
  max_discount int,                             -- batas potongan untuk persen
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create table if not exists queue_counters (
  day date primary key,
  last int not null default 0
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  token text not null,                          -- rahasia untuk akses tamu ke halaman pesanan
  user_id uuid references users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  client_ip text,                               -- untuk rate limit pemesanan; null bila header tidak tersedia (mis. lokal)
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','queued','preparing','ready','picked_up','cancelled','expired')),
  queue_no int,                                 -- diberikan saat pembayaran berhasil
  queue_day date,
  subtotal int not null,
  discount int not null default 0,
  total int not null,
  voucher_code text,
  scheduled_for timestamptz,                    -- null = sekarang (ASAP)
  est_ready_at timestamptz,
  note text not null default '',
  pay_ref text unique,                          -- order_id di Midtrans
  pay_url text,
  payment_expires_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  unique (queue_day, queue_no)
);
alter table orders add column if not exists client_ip text; -- migrasi untuk database yang sudah ada sebelum kolom ini
create index if not exists orders_status on orders(status);
create index if not exists orders_created on orders(created_at);
create index if not exists orders_user on orders(user_id);

create table if not exists order_items (
  id serial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id int references products(id) on delete set null,
  name text not null,
  unit_price int not null,                      -- sudah termasuk selisih harga opsi
  qty int not null check (qty > 0),
  options jsonb not null default '[]',          -- [{group, name, price_delta}]
  note text not null default ''
);
create index if not exists order_items_order on order_items(order_id);

create table if not exists push_subs (
  order_id uuid not null references orders(id) on delete cascade,
  endpoint text not null,                       -- satu perangkat bisa berlangganan beberapa pesanan aktif
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (order_id, endpoint)
);
