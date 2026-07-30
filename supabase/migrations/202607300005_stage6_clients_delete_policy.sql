-- Etapa 6: borrado definitivo de clientes (solo administradores)
--
-- El borrado normal desde la app es "archivar" (marcar archived_at), reversible
-- y ya cubierto por la politica de UPDATE existente (owner o admin). Esta politica
-- habilita el DELETE real desde la Papelera: permanente e irreversible (borra en
-- cascada actividades, intereses e historial de estados del cliente), por eso
-- queda restringido a administradores.

create policy "clients_delete_admin_only"
on public.clients
for delete
to authenticated
using (public.get_my_role() = 'admin');
