-- Check-in de eventos + sorteo. Etiqueta de evento en el cliente, texto libre
-- a proposito (no catalogo administrable): la urgencia es cargar gente rapido
-- en el momento del evento, y en la practica son pocos eventos en el tiempo,
-- no algo que necesite mantenimiento de catalogo.

alter table public.clients
  add column if not exists event_tag text;

comment on column public.clients.event_tag is
  'Evento/stand donde se cargo o se reconocio al cliente (texto libre, ej: "Fiesta del Agricultor 2026"). Nullable: la mayoria de los clientes no vienen de un evento puntual.';

-- Tabla chica todavia (no CONCURRENTLY a proposito: este archivo se pega y
-- corre entero de una vez, sin pasos separados).
create index if not exists idx_clients_event_tag
  on public.clients (event_tag)
  where event_tag is not null;
