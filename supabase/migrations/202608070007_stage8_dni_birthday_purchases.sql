-- Etapa 8: DNI, fecha de nacimiento y registro de compras por cliente

alter table public.clients
  add column dni text,
  add column birth_date date;

-- Unico entre los cargados (ignora NULL), para detectar clientes duplicados por DNI
create unique index idx_clients_dni_unique
  on public.clients (dni)
  where dni is not null;

create table public.client_purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  purchased_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_client_purchases_client_id on public.client_purchases (client_id);

alter table public.client_purchases enable row level security;

create policy "client_purchases_select_owner_or_admin"
on public.client_purchases
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (public.get_my_role() = 'admin' or c.assigned_user_id = auth.uid())
  )
);

create policy "client_purchases_insert_owner_or_admin"
on public.client_purchases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (public.get_my_role() = 'admin' or c.assigned_user_id = auth.uid())
  )
);

create policy "client_purchases_delete_owner_or_admin"
on public.client_purchases
for delete
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (public.get_my_role() = 'admin' or c.assigned_user_id = auth.uid())
  )
);

comment on table public.client_purchases is 'Registro de compras de un cliente, una fila por compra realizada.';
comment on column public.clients.dni is 'Documento del cliente, opcional. Unico entre los cargados.';
comment on column public.clients.birth_date is 'Fecha de nacimiento del cliente, opcional.';
