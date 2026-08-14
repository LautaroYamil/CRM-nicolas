-- Verificacion liviana - Fase 2, pieza 1 (resultado + objetivo estructurado)
-- ==================================================
-- Mismo mecanismo que fase1-regresion.sql: bloques transaccionales con
-- ROLLBACK, no persisten nada. Reemplaza <SELLER_A_ID> por un id real de
-- vendedor (o el de Nico, admin) y <CLIENTE_PROPIO_ID> por un cliente suyo.

-- ==================================================
-- 1) Un vendedor NO puede crear un objetivo de catalogo (solo admin)
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.contact_objectives (name) values ('Objetivo de prueba no autorizado');
-- Esperado: ERROR new row violates row-level security policy (si <SELLER_A_ID>
-- es un vendedor, no admin). Si usaste el id de un admin, esto SI va a
-- insertar -es correcto, los admins pueden.
rollback;

-- ==================================================
-- 2) Cualquier usuario autenticado puede LEER el catalogo activo
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

select name from public.contact_objectives where active = true order by name;
-- Esperado: las 5 opciones sembradas por la migracion (Pasar precio /
-- presupuesto, Confirmar si visito el local, etc.), visibles para cualquier
-- usuario logueado, no solo admin.
rollback;

-- ==================================================
-- 3) outcome_type se guarda y se lee bien en una actividad
-- ==================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<SELLER_A_ID>', 'role', 'authenticated')::text, true);

insert into public.activities (client_id, assigned_user_id, type, status, scheduled_at, completed_at, outcome, outcome_type, created_by)
values ('<CLIENTE_PROPIO_ID>', '<SELLER_A_ID>', 'llamada', 'realizada', now(), now(), 'Dijo que lo iba a pensar', 'respondio_quiere_pensarlo', '<SELLER_A_ID>');

select outcome, outcome_type from public.activities
where client_id = '<CLIENTE_PROPIO_ID>' and outcome = 'Dijo que lo iba a pensar';
-- Esperado: outcome_type = 'respondio_quiere_pensarlo'. Confirma que el enum
-- nuevo funciona y que una actividad vieja (sin este campo) sigue sin romper
-- nada -es nullable, no se toco ningun historial existente.
rollback;
