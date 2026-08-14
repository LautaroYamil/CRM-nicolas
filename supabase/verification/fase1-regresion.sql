-- Verificacion de regresion - Fase 1 (hardening)
-- ==================================================
--
-- IMPORTANTE: no tengo acceso a la base de produccion desde esta sesion (sin
-- connection string, sin service_role local), asi que estos bloques estan
-- LISTOS PARA CORRER pero NO fueron ejecutados por mi. Cada bloque es su
-- propia transaccion que termina en ROLLBACK: no persiste nada, es seguro
-- correrlos contra produccion.
--
-- COMO USARLO:
-- 1. Corre esto primero para conseguir IDs reales:
--      select id, full_name, role, active from public.profiles order by role, full_name;
--    Anota el id de dos vendedores activos distintos y el de un admin.
-- 2. Reemplaza los placeholders <SELLER_A_ID>, <SELLER_B_ID>, <ADMIN_ID> y
--    <CLIENTE_PROPIO_ID> (un cliente cualquiera que ya sea de SELLER_A) por
--    esos valores reales antes de correr cada bloque.
-- 3. Pega y corre UN bloque a la vez en el SQL Editor (cada uno ya tiene su
--    propio begin/rollback, no hace falta envolverlos en nada mas).
-- 4. Compara el resultado contra el "Esperado" de cada comentario.

-- ==================================================
-- 1) RLS: vendedor A no ve clientes de vendedor B
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

select count(*) as clientes_visibles_por_seller_a from public.clients;
-- Esperado: igual a la cantidad real de clientes asignados a SELLER_A (no el
-- total de la cartera). Compara contra:
--   select count(*) from public.clients where assigned_user_id = '<SELLER_A_ID>';
-- corrido SIN el set local de arriba (como tu usuario normal en el editor).

-- Reemplaza por el id de un cliente que sepas que es de SELLER_B:
select * from public.clients where id = '<CLIENTE_DE_SELLER_B_ID>';
-- Esperado: 0 filas. No un error -RLS filtra en silencio, como debe ser.
rollback;

-- ==================================================
-- 2) RLS: vendedor A no puede tocar activities ajenas
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

-- Reemplaza por el id de una actividad de un cliente de SELLER_B:
update public.activities set status = 'cancelada' where id = '<ACTIVITY_DE_OTRO_VENDEDOR_ID>';
-- Esperado: UPDATE 0 (0 filas afectadas). Este es el hallazgo de "fallo
-- silencioso" de la auditoria: no tira error, simplemente no cambia nada.
rollback;

-- ==================================================
-- 3) RLS: admin mantiene acceso global
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_ID>', 'role', 'authenticated')::text, true);

select count(*) as total_visible_admin from public.clients;
-- Esperado: igual al total real de la cartera (todos los vendedores), no solo
-- los del admin.
rollback;

-- ==================================================
-- 4) RLS nueva (migracion 202608110010): activities.assigned_user_id atado
--    al vendedor real del cliente
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

-- Reemplaza por un cliente PROPIO de SELLER_A y probá asignar la actividad a SELLER_B:
insert into public.activities (client_id, assigned_user_id, type, status, scheduled_at, created_by)
values ('<CLIENTE_PROPIO_ID>', '<SELLER_B_ID>', 'llamada', 'pendiente', now() + interval '1 day', '<SELLER_A_ID>');
-- Esperado DESPUES de aplicar 202608110010_stage10_fase1_hardening.sql:
--   ERROR: new row violates row-level security policy for table "activities"
-- (Antes de esa migracion esto se insertaba sin problema -era el hallazgo
-- menor de integridad de la Tarea 9.)
rollback;

-- ==================================================
-- 5) Vencidos: definicion unica, consistente entre pantallas
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

-- 4 actividades de prueba sobre un cliente propio: futura, vencida, realizada
-- (pasada) y cancelada (pasada). Solo la #2 deberia contar como vencida.
insert into public.activities (client_id, assigned_user_id, type, status, scheduled_at, completed_at, created_by)
values
  ('<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'pendiente', now() + interval '1 day', null, '<SELLER_A_ID>'),
  ('<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'pendiente', now() - interval '1 day', null, '<SELLER_A_ID>'),
  ('<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'realizada', now() - interval '2 day', now() - interval '2 day', '<SELLER_A_ID>'),
  ('<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'cancelada', now() - interval '3 day', null, '<SELLER_A_ID>');

select count(*) as vencidos_reales
from public.activities
where status = 'pendiente' and scheduled_at < now() and assigned_user_id = '<SELLER_A_ID>';
-- Esperado: exactamente 1 (solo la fila #2). countOverdueActivities() -usado
-- ahora por Dashboard, Agenda, Reportes y el badge de la Ficha- calcula
-- exactamente esta misma condicion, asi que las 4 pantallas deben coincidir.
rollback;

-- ==================================================
-- 6) Mas de 30 vencidos: el contador debe mostrar el TOTAL real, no el
--    tope de la lista
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.activities (client_id, assigned_user_id, type, status, scheduled_at, created_by)
select '<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'pendiente', now() - (n || ' hours')::interval, '<SELLER_A_ID>'
from generate_series(1, 45) as n;

select count(*) as vencidos_de_prueba
from public.activities
where status = 'pendiente' and scheduled_at < now() and assigned_user_id = '<SELLER_A_ID>';
-- Esperado: 45 (mas los que ya existieran antes de este vendedor). Verificar
-- en la UI (sin hacer rollback todavia si queres verlo en pantalla, o commit
-- en un ambiente de prueba, nunca en produccion):
--   Dashboard -> tarjeta "Vencidos": debe decir ese numero exacto.
--   Agenda -> el link "N vencidos" arriba y el badge "N totales" del panel
--   lateral deben decir el MISMO numero, aunque la lista solo muestre 30 con
--   el boton "Mostrar mas (N-30 restantes)" al pie.
rollback;

-- ==================================================
-- 7) Conversion de cohorte (metrica corregida de Reportes)
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

-- Caso A: creado DENTRO del periodo (hace 3 dias) y ya esta en Compro
insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, created_at)
values ('Test Cohorte A', '111111', '+54111111', 'compro', '<SELLER_A_ID>', now() - interval '3 days');

-- Caso B: creado ANTES del periodo (hace 60 dias) pero esta en Compro hoy
-- -NO debe contarse en ninguno de los dos numeros de abajo (quedo fuera del
-- periodo por fecha de alta, aunque haya vendido esta semana).
insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, created_at)
values ('Test Cohorte B', '222222', '+54222222', 'compro', '<SELLER_A_ID>', now() - interval '60 days');

-- Caso C: creado DENTRO del periodo, todavia no compro
insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, created_at)
values ('Test Cohorte C', '333333', '+54333333', 'interesado', '<SELLER_A_ID>', now() - interval '2 days');

select
  (select count(*) from public.clients
     where assigned_user_id = '<SELLER_A_ID>' and archived_at is null
       and created_at >= now() - interval '7 days') as clientes_nuevos_periodo,
  (select count(*) from public.clients
     where assigned_user_id = '<SELLER_A_ID>' and archived_at is null
       and created_at >= now() - interval '7 days' and status = 'compro') as convertidos_cohorte;
-- Esperado (asumiendo que no tenias otros clientes nuevos de SELLER_A esta
-- semana): clientes_nuevos_periodo = 2 (A y C), convertidos_cohorte = 1 (A).
-- El Caso B no aparece en ninguno de los dos numeros -asi se corrige el sesgo
-- que encontro la auditoria (antes, la venta de B se contaba igual en el
-- numerador de "Ventas" del periodo, pero B nunca contaba en el denominador).
rollback;

-- ==================================================
-- 8) Archivar / Restaurar: reactiva SOLO lo cancelado por el archivado
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.clients (id, first_name, phone_raw, phone_normalized, status, assigned_user_id)
values ('00000000-0000-4000-8000-0000000000aa', 'Test Archive', '444444', '+54444444', 'interesado', '<SELLER_A_ID>');

insert into public.activities (id, client_id, assigned_user_id, type, status, scheduled_at, created_by) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000aa', '<SELLER_A_ID>', 'llamada', 'pendiente', now() + interval '1 day', '<SELLER_A_ID>'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000aa', '<SELLER_A_ID>', 'llamada', 'cancelada', now() + interval '2 day', '<SELLER_A_ID>'); -- cancelada A MANO antes de archivar, no debe reactivarse

-- Simula archiveClientAction():
update public.clients set archived_at = now() where id = '00000000-0000-4000-8000-0000000000aa';
update public.activities set status = 'cancelada', cancelled_via_archive = true
  where client_id = '00000000-0000-4000-8000-0000000000aa' and status = 'pendiente';

select id, status, cancelled_via_archive from public.activities
  where client_id = '00000000-0000-4000-8000-0000000000aa' order by id;
-- Esperado aca: a1 -> cancelada / cancelled_via_archive=true (la archivo el sistema)
--               a2 -> cancelada / cancelled_via_archive=false (sin tocar, ya estaba cancelada a mano)

-- Simula restoreClientAction():
update public.clients set archived_at = null where id = '00000000-0000-4000-8000-0000000000aa';
update public.activities set status = 'pendiente', cancelled_via_archive = false
  where client_id = '00000000-0000-4000-8000-0000000000aa' and status = 'cancelada' and cancelled_via_archive = true;

select id, status, cancelled_via_archive, scheduled_at < now() as vencido_ahora
from public.activities where client_id = '00000000-0000-4000-8000-0000000000aa' order by id;
-- Caso 1 (a1): debe volver a status='pendiente', cancelled_via_archive=false.
-- Caso 2 (a2): debe seguir status='cancelada' -no se toca.
-- Caso 3 (fecha vencida al restaurar): repeti este bloque completo cambiando
-- el scheduled_at de a1 a "now() - interval '1 hour'" en vez de "+1 day" -al
-- restaurar deberia quedar pendiente Y vencido, sin que ningun update haya
-- tocado scheduled_at.
rollback;

-- ==================================================
-- 9) DNI duplicado: activo y archivado
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, dni)
values ('Test DNI Activo', '555555', '+54555555', 'nuevo', '<SELLER_A_ID>', '99999901');

insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, dni)
values ('Test DNI Activo Duplicado', '556556', '+54556556', 'nuevo', '<SELLER_A_ID>', '99999901');
-- Esperado: ERROR duplicate key value violates unique constraint
-- "idx_clients_dni_unique". Este bloque prueba la restriccion de base; en la
-- app, createClientAction/updateClientAction ahora frenan esto ANTES con un
-- mensaje claro ("Ya existe un cliente con ese DNI: Test DNI Activo").
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, dni, archived_at)
values ('Test DNI Archivado', '557557', '+54557557', 'nuevo', '<SELLER_A_ID>', '99999902', now());

insert into public.clients (first_name, phone_raw, phone_normalized, status, assigned_user_id, dni)
values ('Test DNI Nuevo', '558558', '+54558558', 'nuevo', '<SELLER_A_ID>', '99999902');
-- Esperado: mismo error de indice unico -el DNI de un cliente archivado sigue
-- bloqueando. La diferencia con el bug original esta en la APP: ahora
-- assertDniAvailable() ya detecta este caso antes del insert (no solo el
-- caso "activo") y avisa "...en la Papelera: Test DNI Archivado. Restauralo
-- desde ahi en vez de crear uno nuevo." en lugar de dejar pasar y romper con
-- el error crudo de Postgres.
rollback;
