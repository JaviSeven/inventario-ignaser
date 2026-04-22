-- Ejecuta este script en Supabase SQL Editor para habilitar
-- material recurrente + stock minimo en inventario.

alter table public.items add column if not exists is_recurrent boolean not null default false;
alter table public.items add column if not exists min_stock integer;
