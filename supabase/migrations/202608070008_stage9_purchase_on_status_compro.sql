-- Etapa 9: sincronizar el contador de compras con el estado comercial "compro"

-- Backfill: cada vez que un cliente paso a "compro" en el pasado ya quedo registrado
-- en client_status_changes (trigger de la etapa 3). Se usa ese historial para cargar
-- las compras retroactivas de clientes marcados antes de que existiera esta tabla.
insert into public.client_purchases (client_id, purchased_at, created_by)
select
  csc.client_id,
  csc.created_at,
  coalesce(csc.changed_by, c.assigned_user_id)
from public.client_status_changes csc
join public.clients c on c.id = csc.client_id
where csc.new_status = 'compro';

-- De aca en adelante, marcar a un cliente como "compro" (alta o edicion) registra
-- la compra solo; el boton "Sumar compra" de la ficha sigue disponible para compras
-- adicionales de un cliente que ya esta en estado "compro".
create or replace function public.log_purchase_on_status_compro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'compro' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.client_purchases (client_id, created_by)
    values (new.id, coalesce(auth.uid(), new.assigned_user_id));
  end if;

  return new;
end;
$$;

create trigger trg_clients_log_purchase_on_compro
after insert or update on public.clients
for each row
execute function public.log_purchase_on_status_compro();
