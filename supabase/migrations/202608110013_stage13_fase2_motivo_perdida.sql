-- Fase 2, pieza 3: motivo de oportunidad perdida.
--
-- Decisiones de diseno:
-- - Catalogo fijo y administrable desde /admin (mismo patron que interests y
--   contact_objectives), no texto libre puro -si no, el reporte de perdidas
--   del futuro seria texto suelto imposible de agrupar.
-- - "Dejo de responder" NO esta en el catalogo a proposito: eso es lo que ya
--   representa el estado "Inactivo" (se enfrio sin un no explicito). Mezclar
--   ghosting con rechazo explicito en el mismo catalogo contaminaria las
--   metricas de "por que se pierden ventas" que este catalogo existe para
--   responder.
-- - Se guarda en clients.loss_reason_id (el motivo VIGENTE), no en una tabla
--   de historial nueva -mas simple, no requiere tocar el trigger existente
--   de client_status_changes. Si el cliente vuelve y se pierde de nuevo con
--   otro motivo, el motivo anterior se reemplaza (se pierde el historico
--   detallado de motivos, se conserva igual el historico de CUANDO cambio de
--   estado en client_status_changes).
-- - Se limpia a null automaticamente si el estado deja de ser 'no_interesado'
--   (evita mostrar un motivo viejo de una perdida que ya no es tal).

create table public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.loss_reasons enable row level security;

create policy "loss_reasons_select_active_or_admin"
on public.loss_reasons
for select
to authenticated
using (active = true or public.get_my_role() = 'admin');

create policy "loss_reasons_admin_insert"
on public.loss_reasons
for insert
to authenticated
with check (public.get_my_role() = 'admin');

create policy "loss_reasons_admin_update"
on public.loss_reasons
for update
to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

alter table public.clients
  add column if not exists loss_reason_id uuid references public.loss_reasons (id);

insert into public.loss_reasons (name) values
  ('Precio'),
  ('Compro en otro lugar'),
  ('No habia el producto/modelo que buscaba'),
  ('Problema de financiacion'),
  ('Solo estaba averiguando'),
  ('Otro');
