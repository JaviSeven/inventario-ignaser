-- Flujo AXIS -> aprobación IGNASER
-- Ejecutar una vez en Supabase SQL Editor antes de desplegar la interfaz.

create table if not exists public.inventory_requests (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  description text not null,
  obra text not null,
  quantity integer not null check (quantity > 0),
  is_recurrent boolean not null default false,
  min_stock integer,
  location text not null,
  image_url text default '',
  requested_by uuid not null,
  requested_by_name text not null,
  requested_at bigint not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at bigint,
  created_item_id uuid references public.items(id) on delete set null
);

create index if not exists idx_inventory_requests_status
  on public.inventory_requests(status, requested_at desc);
create index if not exists idx_inventory_requests_requested_by
  on public.inventory_requests(requested_by, requested_at desc);

alter table public.inventory_requests enable row level security;

drop policy if exists "inventory requests select" on public.inventory_requests;
drop policy if exists "inventory requests insert own" on public.inventory_requests;
drop policy if exists "inventory requests staff update" on public.inventory_requests;

create policy "inventory requests select"
  on public.inventory_requests
  for select
  to authenticated
  using (
    requested_by = auth.uid()
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('Admin', 'Operario')
  );

create policy "inventory requests insert own"
  on public.inventory_requests
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_item_id is null
  );

create policy "inventory requests staff update"
  on public.inventory_requests
  for update
  to authenticated
  using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('Admin', 'Operario'))
  with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('Admin', 'Operario'));

create or replace function public.approve_inventory_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.inventory_requests%rowtype;
  v_item_id uuid := gen_random_uuid();
  v_movement_id uuid := gen_random_uuid();
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_reviewer_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', auth.jwt() ->> 'email', 'IGNASER');
begin
  if coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') not in ('Admin', 'Operario') then
    raise exception 'No tienes permiso para aprobar solicitudes';
  end if;

  select * into v_request
  from public.inventory_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'La solicitud ya ha sido revisada';
  end if;

  insert into public.items (
    id, concept, description, obra, quantity, is_recurrent, min_stock,
    location, image_url, created_at, updated_at
  ) values (
    v_item_id, v_request.concept, v_request.description, v_request.obra,
    v_request.quantity, v_request.is_recurrent, v_request.min_stock,
    v_request.location, coalesce(v_request.image_url, ''), v_now, v_now
  );

  insert into public.movements (
    id, item_id, item_concept, user_id, user_name, type, quantity_change,
    new_quantity, timestamp, note, obra_procedencia, obra_destino
  ) values (
    v_movement_id, v_item_id, v_request.concept, auth.uid()::text,
    v_reviewer_name, 'IN', v_request.quantity, v_request.quantity, v_now,
    'Entrada propuesta por AXIS y aprobada como recibida en almacén',
    v_request.obra, 'Almacén'
  );

  update public.inventory_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_by_name = v_reviewer_name,
      reviewed_at = v_now,
      created_item_id = v_item_id
  where id = p_request_id;

  return v_item_id;
end;
$$;

revoke all on function public.approve_inventory_request(uuid) from public;
grant execute on function public.approve_inventory_request(uuid) to authenticated;

-- Conserva compatibilidad con el usuario AXIS existente aunque aún tenga
-- role "SoloLectura" en sus metadatos. La interfaz lo reconocerá por nombre.
-- Recomendado: cambia su User Metadata a {"name":"AXIS","role":"Axis"}.
