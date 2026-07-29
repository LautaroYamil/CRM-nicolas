-- Etapa 1: autenticacion, perfiles y roles base para CRM Muebleria El Gallego

create type public.app_role as enum ('admin', 'seller');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'seller',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_role() to authenticated;

alter table public.profiles enable row level security;

create policy "profiles_self_or_admin_select"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.get_my_role() = 'admin'
);

create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.get_my_role() = 'admin');

create policy "profiles_admin_delete"
on public.profiles
for delete
to authenticated
using (public.get_my_role() = 'admin');

comment on table public.profiles is 'Perfiles CRM: rol y estado de usuarios autenticados.';
