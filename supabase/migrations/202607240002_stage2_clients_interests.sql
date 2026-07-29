-- Etapa 2: clientes, estados comerciales e intereses

create extension if not exists pgcrypto;

create type public.client_status as enum (
  'nuevo',
  'interesado',
  'en_seguimiento',
  'compro',
  'no_interesado',
  'inactivo'
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_interests_updated_at
before update on public.interests
for each row
execute function public.set_updated_at();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  phone_raw text not null,
  phone_normalized text not null,
  locality text,
  address text,
  status public.client_status not null default 'nuevo',
  assigned_user_id uuid not null references public.profiles (id),
  notes text,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create trigger trg_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

create table public.client_interests (
  client_id uuid not null references public.clients (id) on delete cascade,
  interest_id uuid not null references public.interests (id),
  created_at timestamptz not null default now(),
  primary key (client_id, interest_id)
);

create index idx_clients_assigned_user on public.clients (assigned_user_id);
create index idx_clients_status on public.clients (status);
create index idx_clients_phone_normalized on public.clients (phone_normalized);
create index idx_clients_next_follow_up on public.clients (next_follow_up_at);
create index idx_clients_created_at on public.clients (created_at desc);

create index idx_client_interests_interest_id on public.client_interests (interest_id);

alter table public.interests enable row level security;
alter table public.clients enable row level security;
alter table public.client_interests enable row level security;

create policy "interests_select_active_or_admin"
on public.interests
for select
to authenticated
using (active = true or public.get_my_role() = 'admin');

create policy "interests_admin_insert"
on public.interests
for insert
to authenticated
with check (public.get_my_role() = 'admin');

create policy "interests_admin_update"
on public.interests
for update
to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

create policy "clients_select_owner_or_admin"
on public.clients
for select
to authenticated
using (
  public.get_my_role() = 'admin'
  or assigned_user_id = auth.uid()
);

create policy "clients_insert_owner_or_admin"
on public.clients
for insert
to authenticated
with check (
  public.get_my_role() = 'admin'
  or assigned_user_id = auth.uid()
);

create policy "clients_update_owner_or_admin"
on public.clients
for update
to authenticated
using (
  public.get_my_role() = 'admin'
  or assigned_user_id = auth.uid()
)
with check (
  public.get_my_role() = 'admin'
  or assigned_user_id = auth.uid()
);

create policy "client_interests_select_owner_or_admin"
on public.client_interests
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

create policy "client_interests_insert_owner_or_admin"
on public.client_interests
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

create policy "client_interests_delete_owner_or_admin"
on public.client_interests
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

comment on table public.clients is 'Clientes CRM para seguimiento comercial.';
comment on table public.interests is 'Catalogo de intereses de productos de muebleria.';
comment on table public.client_interests is 'Relacion N:N entre clientes e intereses.';
