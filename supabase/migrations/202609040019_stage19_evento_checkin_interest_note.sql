-- Etapa 19: descripcion libre del interes real mostrado en el stand.
--
-- event_interest_level ya distingue "paso" de "interesado" (etapa 18). Esto
-- agrega un texto corto opcional para cuando es "interesado": que fue
-- puntualmente lo que la persona dijo que buscaba (ej. "living de 3 cuerpos,
-- color gris"). No reemplaza el campo general clients.notes -es un dato propio
-- del check-in del evento, atado al mismo event_tag que event_interest_level.

alter table public.clients
  add column if not exists event_interest_note text;

comment on column public.clients.event_interest_note is
  'Descripcion libre y opcional de lo que el visitante dijo que buscaba, cargada desde el check-in del evento cuando event_interest_level es "interesado". Nullable.';
