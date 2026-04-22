-- Inventario Ignaser: ejecutar en Supabase → SQL → New query
-- 1) Copia y ejecuta todo el script.
-- 2) Authentication → activa "Email" (y desactiva "Confirm email" en desarrollo si quieres probar al instante).
-- 3) Crea usuarios: Authentication → Users → Add user, o vía "Sign up" en la app.
-- 4) Metadatos del usuario: en el usuario → User Metadata (JSON), ejemplo:
--    { "name": "María", "role": "Admin" }
--    role permitidos: "Admin" | "Operario" | "SoloLectura"

-- Tabla de artículos (inventario)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  description text not null,
  obra text not null,
  quantity integer not null default 0,
  is_recurrent boolean not null default false,
  min_stock integer,
  location text,
  image_url text default '',
  created_at bigint not null,
  updated_at bigint not null
);

alter table public.items add column if not exists is_recurrent boolean not null default false;
alter table public.items add column if not exists min_stock integer;

-- Tabla de movimientos (historial)
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  item_concept text not null,
  user_id text not null,
  user_name text not null,
  type text not null check (type in ('IN', 'OUT', 'ADJUST', 'CREATE', 'REMOVE')),
  quantity_change integer not null,
  new_quantity integer not null,
  timestamp bigint not null,
  note text,
  obra_procedencia text,
  obra_destino text
);

create index if not exists idx_movements_item_id on public.movements(item_id);
create index if not exists idx_movements_timestamp on public.movements(timestamp desc);

-- Row Level Security: solo usuarios con sesión (JWT) pueden leer/escribir
alter table public.items enable row level security;
alter table public.movements enable row level security;

drop policy if exists "Allow all on items" on public.items;
drop policy if exists "Allow all on movements" on public.movements;
drop policy if exists "items authenticated all" on public.items;
drop policy if exists "movements authenticated all" on public.movements;

create policy "items authenticated all"
  on public.items
  for all
  to authenticated
  using (true)
  with check (true);

create policy "movements authenticated all"
  on public.movements
  for all
  to authenticated
  using (true)
  with check (true);
