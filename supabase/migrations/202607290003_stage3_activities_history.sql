-- Etapa 3/4: actividades (historial + agenda) e historial de estados comerciales

create type public.activity_type as enum (
  'llamada',
  'whatsapp',
  'email',
  'visita',
  'reunion',
  'nota'
);

create type public.activity_status as enum (
  'pendiente',
  'realizada',
  'cancelada'
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  assigned_user_id uuid not null references public.profiles (id),
  type public.activity_type not null,
  status public.activity_status not null default 'pendiente',
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  objective text,
  outcome text,
  rescheduled_count integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_activities_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();

create index idx_activities_client on public.activities (client_id, created_at desc);
create index idx_activities_agenda on public.activities (status, scheduled_at);
create index idx_activities_assigned_user on public.activities (assigned_user_id, status, scheduled_at);

-- Historial de cambios de estado comercial del cliente
create table public.client_status_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  old_status public.client_status,
  new_status public.client_status not null,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_client_status_changes_client on public.client_status_changes (client_id, created_at desc);

-- Sincroniza last_contact_at y next_follow_up_at del cliente a partir de sus actividades.
-- security definer: recalcular campos derivados no debe depender de las policies del invocante.
create or replace function public.sync_client_activity_fields(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients c
  set
    next_follow_up_at = (
      select min(a.scheduled_at)
      from public.activities a
      where a.client_id = target_client_id
        and a.status = 'pendiente'
    ),
    last_contact_at = (
      select max(a.completed_at)
      from public.activities a
      where a.client_id = target_client_id
        and a.status = 'realizada'
    )
  where c.id = target_client_id;
end;
$$;

create or replace function public.handle_activity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_client_activity_fields(old.client_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id then
    perform public.sync_client_activity_fields(old.client_id);
  end if;

  perform public.sync_client_activity_fields(new.client_id);
  return new;
end;
$$;

create trigger trg_activities_sync_client
after insert or update or delete on public.activities
for each row
execute function public.handle_activity_change();

-- Registra en el historial cada cambio de estado comercial (y el alta con su estado inicial)
create or replace function public.log_client_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_status_changes (client_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.client_status_changes (client_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

create trigger trg_clients_log_status
after insert or update on public.clients
for each row
execute function public.log_client_status_change();

-- RLS: mismo patron owner-or-admin que el resto del esquema
alter table public.activities enable row level security;
alter table public.client_status_changes enable row level security;

create policy "activities_select_owner_or_admin"
on public.activities
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

create policy "activities_insert_owner_or_admin"
on public.activities
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

create policy "activities_update_owner_or_admin"
on public.activities
for update
to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (public.get_my_role() = 'admin' or c.assigned_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (public.get_my_role() = 'admin' or c.assigned_user_id = auth.uid())
  )
);

create policy "activities_delete_owner_or_admin"
on public.activities
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

create policy "client_status_changes_select_owner_or_admin"
on public.client_status_changes
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

comment on table public.activities is 'Actividades comerciales: pendientes forman la agenda, realizadas forman el historial.';
comment on table public.client_status_changes is 'Historial de cambios de estado comercial por cliente.';
