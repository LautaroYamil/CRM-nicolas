-- Fase 2 (inteligencia comercial) - primera pieza: resultado estructurado del
-- contacto + catalogo de objetivos para el proximo seguimiento.
--
-- Decisiones de diseno (acordadas en el chat):
-- - "Resultado" queda FIJO en el codigo (enum), porque de el van a depender
--   calculos futuros (tasa de respuesta, priorizacion) y cambiarlo despues
--   tiene mas impacto. La nota libre existente (activities.outcome) se
--   mantiene en paralelo, no se reemplaza.
-- - "Objetivo" es administrable desde /admin (mismo patron que "interests"),
--   para que el catalogo se pueda ajustar sin tocar codigo. No se agrega una
--   columna nueva para guardar el objetivo elegido: se sigue usando la
--   columna de texto libre "objective" que ya existe en activities, cargada
--   con el nombre del catalogo elegido (o el texto libre si se elige "Otro").
--   Esto evita tener que tocar cada lugar de la app que hoy muestra
--   activities.objective con un join nuevo.

create type public.contact_outcome as enum (
  'respondio_sigue_interesado',
  'respondio_quiere_pensarlo',
  'pidio_contacto_despues',
  'no_respondio',
  'no_interesado',
  'venta_concretada'
);

alter table public.activities
  add column if not exists outcome_type public.contact_outcome;

comment on column public.activities.outcome_type is
  'Resultado estructurado del contacto (opcional, nullable para no romper historial viejo). La nota libre en "outcome" sigue existiendo en paralelo.';

create table public.contact_objectives (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.contact_objectives enable row level security;

create policy "contact_objectives_select_active_or_admin"
on public.contact_objectives
for select
to authenticated
using (active = true or public.get_my_role() = 'admin');

create policy "contact_objectives_admin_insert"
on public.contact_objectives
for insert
to authenticated
with check (public.get_my_role() = 'admin');

create policy "contact_objectives_admin_update"
on public.contact_objectives
for update
to authenticated
using (public.get_my_role() = 'admin')
with check (public.get_my_role() = 'admin');

insert into public.contact_objectives (name) values
  ('Pasar precio / presupuesto'),
  ('Confirmar si visito el local'),
  ('Consultar si ya decidio'),
  ('Mostrar alternativas / novedades'),
  ('Coordinar entrega o visita');
