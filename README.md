# CRM MVP - Muebleria El Gallego

Base inicial del MVP CRM enfocada en seguimiento comercial para que ningun vendedor pierda contactos.

## Stack

- Next.js (App Router) + TypeScript estricto
- Supabase (Auth + PostgreSQL + RLS)

## Etapas implementadas

- Etapa 1: auth con Supabase (login/logout), middleware de proteccion de rutas, perfiles con roles `admin` y `seller`, RLS base
- Etapa 2: clientes, estados comerciales e intereses (catalogo + N:N), listado con filtros, alta/edicion
- Etapa 3: historial de actividad (tabla `activities` + historial de cambios de estado), ficha de cliente con linea de tiempo
- Etapa 4: agenda (vencidos / hoy / proximos), programar, completar, reprogramar y cancelar seguimientos, dashboard accionable

Ver `docs/plan-etapas-3-6.md` para la auditoria, el modelo de datos y el plan de lo que falta.

## Configuracion local

1. Copiar `.env.example` a `.env.local`
2. Completar:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Instalar dependencias:
   - `npm install`
4. Levantar desarrollo:
   - `npm run dev`

## Base de datos

Ejecutar migraciones de `supabase/migrations` en tu proyecto Supabase.

## Proximas etapas

- Etapa 5: plantillas de mensaje para WhatsApp y flujo rapido desde la agenda
- Etapa 6: reportes, filtros avanzados, paginacion, unificacion de estilos y hardening
