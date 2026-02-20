-- Esquema para Almacén Pro - Ejecutar en Supabase SQL Editor

-- Tabla de artículos (inventario)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  description text not null,
  obra text not null,
  quantity integer not null default 0,
  location text,
  image_url text default '',
  created_at bigint not null,
  updated_at bigint not null
);

-- Tabla de movimientos (historial)
-- item_id nullable y ON DELETE SET NULL para conservar movimientos cuando se elimina un ítem (stock 0)
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

-- Row Level Security (RLS)
alter table public.items enable row level security;
alter table public.movements enable row level security;

create policy "Allow all on items"
  on public.items for all
  using (true) with check (true);

create policy "Allow all on movements"
  on public.movements for all
  using (true) with check (true);
