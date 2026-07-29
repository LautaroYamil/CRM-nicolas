# CRM Mueblería El Gallego — Auditoría y plan Etapas 3–6

Fecha: 2026-07-29

## 1. Auditoría del estado actual

### Lo que existe y funciona (Etapas 1 y 2)

- **Auth**: login/logout con Supabase Auth (`src/app/login/`), protección de rutas en `src/proxy.ts`, contexto de usuario en `src/lib/auth/current-user.ts`.
- **Roles**: `admin` y `seller` en `public.profiles`, función SQL `get_my_role()`, patrón RLS "owner or admin" aplicado en todas las tablas.
- **Clientes**: tabla `clients` con estado comercial (enum), teléfono normalizado a formato AR (`+54...`), vendedor asignado, `last_contact_at` y `next_follow_up_at` (columnas que existían pero nada las escribía hasta la Etapa 3). Listado con filtros, alta y edición.
- **Intereses**: catálogo `interests` + N:N `client_interests`, ABM admin en `/admin/interests`.
- **Convenciones**: server actions para mutaciones, Zod para validar, trigger SQL `set_updated_at()`, migraciones en `supabase/migrations/` (se ejecutan a mano en el SQL Editor; la base ya está aplicada en producción, no editar migraciones viejas).

### Problemas detectados

1. **No existía ficha de cliente** (solo formulario de edición): no había dónde ver historial ni contexto antes de contactar. → Resuelto en Etapa 3.
2. **`last_contact_at` / `next_follow_up_at` eran columnas muertas**: ninguna pantalla ni lógica las actualizaba. → Ahora las mantienen triggers a partir de las actividades (una sola fuente de verdad).
3. **Tailwind 4 está instalado pero no se usa**: todo el estilo es inline con variables CSS. Pendiente de unificar en Etapa 6 (por ahora se mantiene el estilo inline para no mezclar refactor visual con features).
4. **Sin trigger de perfiles**: cada usuario nuevo de Auth necesita su fila en `profiles` a mano. Pendiente para el hardening de Etapa 6 (o pantalla admin de vendedores).
5. **Dashboard placeholder**: no mostraba nada accionable. → Primera versión útil en Etapa 4; métricas completas en Etapa 6.
6. El filtro de búsqueda de clientes interpola el texto en `.or(...)` de PostgREST; revisar sanitización en Etapa 6.

## 2. Modelo de datos (Etapas 3 y 4)

Decisión central: **una sola tabla `activities` sirve tanto de historial como de agenda**. Una actividad `pendiente` es un seguimiento agendado; al completarse (`realizada`) pasa a ser historial. "Vencida" no es un estado guardado: se deriva de `status = 'pendiente' AND scheduled_at < hoy` (evita jobs que marquen vencidos).

- `activities`: cliente, vendedor asignado, tipo (`llamada | whatsapp | email | visita | reunion | nota`), estado (`pendiente | realizada | cancelada`), `scheduled_at`, `completed_at`, objetivo, resultado, contador de reprogramaciones, quién la creó.
- `client_status_changes`: historial de cambios de estado comercial, poblado por trigger sobre `clients` (incluye el alta). Alimenta la línea de tiempo.
- Triggers: al insertar/actualizar/borrar actividades se recalculan `clients.next_follow_up_at` (mínimo `scheduled_at` pendiente) y `clients.last_contact_at` (máximo `completed_at` realizado).
- RLS: mismo patrón existente — el vendedor dueño del cliente o el admin. Las tablas nuevas nacen con RLS en la misma migración.

### Sin pipeline de oportunidades separado (decisión)

Para una mueblería con ticket único y ciclo corto, el enum de estados del cliente + seguimientos cumple el rol del pipeline. Un módulo de oportunidades duplicaría datos y pasos de carga para los vendedores. Si el negocio después necesita cotizaciones con valor estimado, se agrega como tabla `opportunities` sin romper este modelo.

## 3. Plan por etapas

- **Etapa 3 — Historial de actividad** (esta entrega): migración `202607290003`, ficha de cliente `/clients/[id]` con línea de tiempo (actividades + cambios de estado), registrar contacto realizado, programar seguimiento.
- **Etapa 4 — Agenda** (esta entrega): `/agenda` con vencidas / hoy / próximas, filtro por vendedor para admin, acceso directo a la ficha. Completar, reprogramar y cancelar desde la ficha.
- **Etapa 5 — Contacto manual**: botón WhatsApp (`wa.me` con `phone_normalized`) y llamada (`tel:`) ya quedan en la ficha; falta: plantillas de mensaje copiables, flujo "completar y programar siguiente" en un paso desde la agenda.
- **Etapa 6 — Dashboard final y hardening**: métricas navegables (conversión, actividad por vendedor, tiempo sin contacto), reportes, paginación real del listado, unificación de estilos (decidir Tailwind vs. inline), trigger de perfiles + ABM de vendedores, sanitizar búsqueda, registro posventa de compras.

## 4. Zona horaria

El negocio opera en `America/Argentina/Buenos_Aires` (UTC-3, sin DST). Todo se guarda `timestamptz` (UTC) y se formatea/interpreta con helpers de `src/lib/crm/dates.ts`. "Hoy" y "vencido" se calculan sobre el día calendario argentino.
