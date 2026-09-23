-- Flujo AXIS -> aprobación IGNASER
-- Aplicar en el proyecto Supabase utilizado por inventario-ignaser.
-- Los roles de autorización deben vivir en auth.users.raw_app_meta_data:
--   {"role":"Admin"}, {"role":"Operario"}, {"role":"Axis"} o {"role":"SoloLectura"}.

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
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_by_name text not null,
  requested_at bigint not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_by_name text,
  reviewed_at bigint,
  created_item_id uuid references public.items(id) on delete set null,
  constraint inventory_requests_min_stock_check check (
    (not is_recurrent and min_stock is null)
    or (is_recurrent and min_stock is not null and min_stock > 0)
  )
);

create index if not exists idx_inventory_requests_requested_by
  on public.inventory_requests(requested_by, requested_at desc);
create index if not exists idx_inventory_requests_pending
  on public.inventory_requests(requested_at desc)
  where status = 'pending';

alter table public.inventory_requests enable row level security;

revoke all on public.inventory_requests from anon;
revoke all on public.inventory_requests from authenticated;
grant select, insert on public.inventory_requests to authenticated;

drop policy if exists "inventory requests select" on public.inventory_requests;
drop policy if exists "inventory requests insert own" on public.inventory_requests;
drop policy if exists "inventory requests staff update" on public.inventory_requests;

create policy "inventory requests select"
  on public.inventory_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = requested_by
    or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('Admin', 'Operario')
  );

create policy "inventory requests insert own"
  on public.inventory_requests
  for insert
  to authenticated
  with check (
    (select auth.uid()) = requested_by
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'Axis'
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and created_item_id is null
  );

-- Sustituye las políticas permisivas antiguas. Todos los usuarios autenticados
-- pueden consultar inventario e historial, pero solo IGNASER puede modificarlos.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('items', 'movements')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$$;

revoke all on public.items from anon;
revoke all on public.movements from anon;
revoke all on public.items from authenticated;
revoke all on public.movements from authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.movements to authenticated;

create policy "items authenticated select"
  on public.items for select to authenticated
  using (true);

create policy "items staff insert"
  on public.items for insert to authenticated
  with check (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('Admin', 'Operario')
  );

create policy "items staff update"
  on public.items for update to authenticated
  using (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('Admin', 'Operario')
  )
  with check (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('Admin', 'Operario')
  );

create policy "items admin delete"
  on public.items for delete to authenticated
  using (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'Admin'
  );

create policy "movements authenticated select"
  on public.movements for select to authenticated
  using (true);

create policy "movements staff insert"
  on public.movements for insert to authenticated
  with check (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('Admin', 'Operario')
  );

create policy "movements admin delete"
  on public.movements for delete to authenticated
  using (
    coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'Admin'
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.review_inventory_request(
  p_request_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.inventory_requests%rowtype;
  v_item_id uuid;
  v_movement_id uuid;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_reviewer_name text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'name',
    auth.jwt() ->> 'email',
    'IGNASER'
  );
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('Admin', 'Operario') then
    raise exception 'No tienes permiso para revisar solicitudes';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión no válida';
  end if;

  select *
  into v_request
  from public.inventory_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'La solicitud ya ha sido revisada';
  end if;

  if p_decision = 'rejected' then
    update public.inventory_requests
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = v_now
    where id = p_request_id;

    return null;
  end if;

  v_item_id := gen_random_uuid();
  v_movement_id := gen_random_uuid();

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

revoke all on function private.review_inventory_request(uuid, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.review_inventory_request(uuid, text) to authenticated;

create or replace function public.review_inventory_request(
  p_request_id uuid,
  p_decision text
)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.review_inventory_request(p_request_id, p_decision);
$$;

revoke all on function public.review_inventory_request(uuid, text) from public, anon;
grant execute on function public.review_inventory_request(uuid, text) to authenticated;
