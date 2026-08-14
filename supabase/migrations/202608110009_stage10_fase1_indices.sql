-- Fase 1 (hardening): indices faltantes detectados en la auditoria.
-- clients.archived_at: filtro mas usado de toda la app (directorio, papelera,
--   dashboard, reportes) y no tenia indice.
-- client_status_changes.new_status: usado por el reporte de ventas
--   (`new_status = 'compro'`) y no tenia indice.
-- clients.last_contact_at: usado por el KPI "Inactivos 14d+" del dashboard.
--
-- IMPORTANTE - COMO EJECUTAR ESTO:
-- CREATE INDEX CONCURRENTLY no puede correr dentro de un bloque de transaccion.
-- El SQL Editor de Supabase envia todo el texto pegado como un solo mensaje, y
-- Postgres trata multiples sentencias pegadas juntas como una transaccion
-- implicita -> si pegas las 3 sentencias de una vez, esto falla.
--
-- Ejecuta cada CREATE INDEX de a UNO por vez (pegar una sola sentencia, correr,
-- recien ahi pegar la siguiente). Cada una toma su propio lock de forma
-- concurrente y no bloquea lecturas/escrituras de la tabla mientras se crea.

create index concurrently if not exists idx_clients_archived_at
  on public.clients (archived_at);

create index concurrently if not exists idx_client_status_changes_new_status
  on public.client_status_changes (new_status, created_at);

create index concurrently if not exists idx_clients_last_contact_at
  on public.clients (last_contact_at);
