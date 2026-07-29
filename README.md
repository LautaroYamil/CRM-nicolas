# CRM MVP - Muebleria El Gallego

Base inicial del MVP CRM enfocada en seguimiento comercial para que ningun vendedor pierda contactos.

## Stack

- Next.js (App Router) + TypeScript estricto
- Supabase (Auth + PostgreSQL + RLS)

## Etapas implementadas

- Etapa 1: auth con Supabase (login/logout), middleware de proteccion de rutas, perfiles con roles `admin` y `seller`, RLS base
- Etapa 2: clientes, estados comerciales e intereses (catalogo + N:N), listado con filtros, alta/edicion
- Etapa 3: historial de actividad (tabla `activities` + historial de cambios de estado), ficha de cliente con linea de tiempo
- Etapa 4: agenda semanal, programar, completar, reprogramar y cancelar seguimientos, dashboard accionable
- Etapa 5: plantillas de WhatsApp (abren el chat con texto precargado, nunca envian solas) y acciones rapidas desde la agenda
- Rediseno visual completo con Tailwind 4 a partir de disenos de Stitch (`docs/designs/`)

Documentacion:
- `docs/manual-uso.md`: manual de uso para vendedores y admin
- `docs/plan-etapas-3-6.md`: auditoria, modelo de datos y plan

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

- Etapa 6: reportes, trigger automatico de perfiles, sanitizado de busqueda y hardening general
