-- Fase 1 (hardening): restaurar cliente sin perder seguimientos + cierre de
-- hallazgo menor de integridad en activities.assigned_user_id.

-- 1) Distinguir "cancelada por el archivado del cliente" de "cancelada
-- manualmente por el vendedor", para que restaurar un cliente pueda reactivar
-- solo lo primero. Default false: los clientes ya archivados hoy no se tocan
-- (no hay forma de saber retroactivamente cual cancelacion fue por que motivo,
-- asi que el comportamiento nuevo aplica solo hacia adelante).
alter table public.activities
  add column if not exists cancelled_via_archive boolean not null default false;

comment on column public.activities.cancelled_via_archive is
  'true si esta actividad paso a cancelada porque se archivo el cliente (no cancelacion manual). Se usa para saber cuales reactivar al restaurar.';

-- 2) activities.assigned_user_id no estaba atado por RLS al assigned_user_id
-- real del cliente (solo se validaba que el client_id perteneciera al usuario).
-- Ninguna accion de la app permite hoy elegir un assigned_user_id distinto al
-- del cliente (createClientAction, logContactAction, scheduleFollowUpAction y
-- completeActivityAction siempre lo derivan de client.assigned_user_id), asi
-- que este cambio es un cierre de hueco sin impacto funcional: no rompe ningun
-- flujo existente, solo bloquea a nivel DB una request directa que intentara
-- asignar la actividad a otro usuario.
drop policy if exists "activities_insert_owner_or_admin" on public.activities;
create policy "activities_insert_owner_or_admin"
on public.activities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_id
      and (
        public.get_my_role() = 'admin'
        or (c.assigned_user_id = auth.uid() and assigned_user_id = c.assigned_user_id)
      )
  )
);

drop policy if exists "activities_update_owner_or_admin" on public.activities;
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
      and (
        public.get_my_role() = 'admin'
        or (c.assigned_user_id = auth.uid() and assigned_user_id = c.assigned_user_id)
      )
  )
);
