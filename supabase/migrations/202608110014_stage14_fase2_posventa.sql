-- Fase 2, pieza 4: posventa automatica.
--
-- "Automatico" significa CREAR tareas en la agenda, nunca mandar nada solo -
-- mismo criterio que ya rige las plantillas de WhatsApp en todo el sistema.
-- El vendedor sigue controlando la comunicacion: el trigger solo agenda dos
-- seguimientos (satisfaccion a los 7 dias, recompra/venta cruzada a los 75)
-- cada vez que se inserta una fila en client_purchases -sea por el boton
-- "Sumar compra" o por el trigger existente que crea una compra cuando el
-- estado pasa a "Compro".
--
-- Dispara solo hacia adelante: los triggers de Postgres no corren
-- retroactivamente, asi que las compras ya cargadas (incluido el backfill de
-- la migracion stage9) no generan seguimientos nuevos.

create or replace function public.schedule_posventa_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assigned_user_id uuid;
begin
  select assigned_user_id into v_assigned_user_id
  from public.clients
  where id = new.client_id;

  if v_assigned_user_id is null then
    return new;
  end if;

  insert into public.activities (client_id, assigned_user_id, type, status, scheduled_at, objective, created_by)
  values
    (
      new.client_id,
      v_assigned_user_id,
      'llamada',
      'pendiente',
      new.purchased_at + interval '7 days',
      'Seguimiento de satisfaccion (posventa)',
      new.created_by
    ),
    (
      new.client_id,
      v_assigned_user_id,
      'llamada',
      'pendiente',
      new.purchased_at + interval '75 days',
      'Recompra o venta cruzada (posventa)',
      new.created_by
    );

  return new;
end;
$$;

create trigger trg_client_purchases_schedule_posventa
after insert on public.client_purchases
for each row
execute function public.schedule_posventa_followups();
