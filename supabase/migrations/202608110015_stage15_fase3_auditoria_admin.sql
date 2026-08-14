-- Fase 3, pieza final: auditoria administrativa.
--
-- Solo 3 eventos, a proposito -no es un log generico de cada campo editado
-- (eso seria deriva hacia ERP/compliance). Lo que vale la pena registrar son
-- las 3 acciones administrativas con consecuencia real: reasignar cartera,
-- cambiar rol, activar/desactivar un vendedor.
--
-- "detail" es texto ya armado en el momento de escribir (con nombres, no
-- solo ids), asi la pantalla de lectura no necesita resolver joins -es un log
-- de bajo volumen, no hace falta mas que eso.

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  action text not null,
  target_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

create index idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_select_admin_only"
on public.admin_audit_log
for select
to authenticated
using (public.get_my_role() = 'admin');

create policy "admin_audit_log_insert_admin_only"
on public.admin_audit_log
for insert
to authenticated
with check (public.get_my_role() = 'admin' and actor_id = auth.uid());
