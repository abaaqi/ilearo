-- Ile Aro shop schema. Works on Supabase, Neon or any Postgres 13+.
-- Safe to run more than once: every statement checks before creating.

-- People who have signed in with Google.
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  google_sub     text not null unique,          -- Google's stable account id
  email          text not null,
  email_verified boolean not null default false,
  name           text,
  avatar_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_login_at  timestamptz
);
create index if not exists users_email_idx on users (lower(email));

-- Signed-in browser sessions. The cookie holds a random token; only its
-- SHA-256 hash is stored here, so a database leak can't be replayed.
create table if not exists sessions (
  id         text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- The catalog. Prices are whole kobo (₦1 = 100 kobo) to avoid rounding.
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  summary     text not null,
  description text not null,
  category    text not null check (category in ('cloth', 'scarves', 'bags', 'home', 'wear')),
  technique   text not null check (technique in ('oniko', 'alabere', 'eleko')),
  price_kobo  integer not null check (price_kobo >= 0),
  stock       integer not null default 0 check (stock >= 0),
  details     jsonb not null default '[]'::jsonb,  -- [["Fabric", "Cotton"], ...]
  art         jsonb not null default '{}'::jsonb,  -- settings for the generated pattern
  image_url   text,                                -- optional photo; replaces the pattern
  featured    boolean not null default false,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists products_listing_idx on products (active, sort_order, name);

-- Carts. A guest cart has no user; it is found through a cookie and merged
-- into the shopper's own cart when they sign in.
create table if not exists carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  cart_id    uuid not null references carts (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  quantity   integer not null check (quantity between 1 and 99),
  added_at   timestamptz not null default now(),
  primary key (cart_id, product_id)
);

-- Orders keep a copy of the delivery details and prices at the time of
-- purchase, so later catalog changes never rewrite history.
create table if not exists orders (
  id                         uuid primary key default gen_random_uuid(),
  reference                  text not null unique,
  user_id                    uuid references users (id) on delete set null,
  email                      text not null,
  customer_name              text not null,
  phone                      text not null,
  address_line1              text not null,
  address_line2              text,
  city                       text not null,
  state                      text not null,
  delivery_notes             text,
  payment_method             text not null check (payment_method in ('pay_on_delivery', 'bank_transfer')),
  payment_status             text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  status                     text not null default 'placed' check (status in ('placed', 'processing', 'shipped', 'delivered', 'cancelled')),
  currency                   text not null default 'NGN',
  subtotal_kobo              integer not null check (subtotal_kobo >= 0),
  delivery_kobo              integer not null check (delivery_kobo >= 0),
  total_kobo                 integer not null,
  confirmation_email_sent_at timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint orders_total_check check (total_kobo = subtotal_kobo + delivery_kobo)
);
create index if not exists orders_user_created_idx on orders (user_id, created_at desc);

create table if not exists order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  product_id      uuid references products (id) on delete set null,
  product_slug    text not null,
  product_name    text not null,
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  quantity        integer not null check (quantity > 0),
  line_total_kobo integer not null,
  constraint order_items_line_total_check check (line_total_kobo = unit_price_kobo * quantity)
);
create index if not exists order_items_order_id_idx on order_items (order_id);

-- Every email the shop tries to send, with Mailgun's message id or the error.
create table if not exists email_log (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references orders (id) on delete set null,
  kind                text not null,
  to_email            text not null,
  subject             text not null,
  status              text not null check (status in ('sent', 'failed', 'skipped')),
  provider            text not null default 'mailgun',
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now()
);
create index if not exists email_log_order_id_idx on email_log (order_id);

-- Supabase publishes tables in the public schema through its REST API. The
-- app talks to Postgres directly and never uses that API, so turn on row
-- level security with no policies: the API sees nothing, while the app's own
-- connection (the table owner) is unaffected. Harmless on Neon.
alter table users       enable row level security;
alter table sessions    enable row level security;
alter table products    enable row level security;
alter table carts       enable row level security;
alter table cart_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table email_log   enable row level security;
