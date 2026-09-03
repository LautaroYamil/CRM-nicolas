-- Etapa 18: datos adicionales del check-in de evento (nivel de interes en el stand).
--
-- Localidad e intereses ya existen como columnas/catalogo (clients.locality,
-- interests + client_interests) y se reutilizan tal cual desde el check-in.
-- El "nivel de cliente habitual/frecuente" NO se agrega como columna nueva:
-- se deriva de client_purchases (misma logica que "vencido"/"prioridad", que
-- nunca se persisten). Lo unico realmente nuevo es esto: si el visitante solo
-- paso por el stand o mostro interes real de compra, dato que no existe en
-- ningun otro lado del sistema.

alter table public.clients
  add column if not exists event_interest_level text
  check (event_interest_level is null or event_interest_level in ('paso', 'interesado'));

comment on column public.clients.event_interest_level is
  'Nivel de interes mostrado en el stand del evento actual (event_tag): "paso" (solo paso a mirar) o "interesado" (interes real de compra). Nullable: solo aplica a clientes con event_tag activo.';
