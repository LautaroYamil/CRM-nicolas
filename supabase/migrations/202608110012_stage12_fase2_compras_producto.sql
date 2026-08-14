-- Fase 2, pieza 2: registrar QUE compro el cliente, no cuanto pago.
-- Decidido en el chat: sin monto/facturacion (el cliente no lo necesita).
-- Se reusa el catalogo de "interests" ya existente para el rubro, en vez de
-- crear un catalogo de productos nuevo (nada de ERP).

alter table public.client_purchases
  add column if not exists description text,
  add column if not exists interest_id uuid references public.interests (id);

comment on column public.client_purchases.description is
  'Que compro, texto libre (ej: "Juego de living 3 cuerpos"). Opcional para no bloquear el alta rapida.';
comment on column public.client_purchases.interest_id is
  'Rubro relacionado, del mismo catalogo de intereses que ya usan los clientes. Opcional.';
