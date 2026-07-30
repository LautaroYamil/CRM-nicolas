# Informe del sistema — CRM Mueblería El Gallego

Fecha: 30/07/2026 · Versión: MVP completo (Etapas 1–6)

---

## 1. Qué es y qué problema resuelve

Es un **CRM de seguimiento comercial** hecho a medida para la mueblería. El problema que ataca es uno solo y es el que más plata cuesta en un comercio: **los contactos que se pierden**. La persona que entró al local, preguntó por un sillón, dijo "lo pienso" y nunca nadie la volvió a llamar.

El sistema impone una disciplina simple: **todo el que pregunta se carga, toda conversación se registra, y siempre queda un próximo paso agendado**. A cambio, le dice a cada vendedor, todas las mañanas, exactamente a quién tiene que contactar.

Lo que **no** hace (a propósito): no manda mensajes automáticos (el vendedor siempre escribe él mismo), no factura, no maneja stock ni pagos. Es una herramienta de venta y seguimiento, no un sistema de gestión integral.

## 2. Cómo está construido

| Capa | Tecnología | Para qué |
|---|---|---|
| Interfaz | Next.js 16 + React + Tailwind 4 | Las pantallas; diseño "Executive Slate" derivado de Stitch |
| Base de datos | Supabase (PostgreSQL) | Todos los datos, en la nube |
| Autenticación | Supabase Auth | Login con email y contraseña |
| Seguridad | Políticas RLS en la base | Cada vendedor solo puede ver/tocar SUS clientes; el admin ve todo. Se cumple a nivel base de datos: no se puede saltear desde el navegador |
| Repositorio | github.com/LautaroYamil/CRM-nicolas | Código versionado |
| Hosting | Vercel | La app en vivo; cada actualización se publica sola |

Datos clave del modelo:
- **Clientes**: nombre, teléfono (normalizado a formato argentino para WhatsApp), localidad, dirección, estado comercial, vendedor asignado, intereses, notas.
- **Actividades**: cada llamada/WhatsApp/visita, hecha o agendada. Las pendientes forman la agenda; las realizadas forman el historial.
- **Historial de estados**: cada cambio de estado comercial queda registrado automáticamente (quién y cuándo).
- "Último contacto" y "Próximo seguimiento" de cada cliente se **calculan solos** a partir de las actividades.
- Zona horaria: todo se guarda en UTC y se muestra en hora argentina.

## 3. Las secciones, una por una

### 3.1 Login
Puerta de entrada. Cada vendedor tiene su email y contraseña (los crea el administrador desde Supabase; el perfil se genera solo con rol vendedor). No hay registro público: solo entra quien el negocio autoriza.

### 3.2 Inicio (Panel Comercial)
**Para qué sirve: decidir qué hacer hoy en 10 segundos.**

- **5 indicadores**: Quedan hoy (seguimientos que todavía están a tiempo), **Vencidos** (en rojo: la hora pasó y nadie lo hizo — lo primero a atacar), Nuevos de la semana, Inactivos 14+ días (clientes activos que nadie contacta hace dos semanas), Posventa (compraron y no tienen seguimiento agendado). Cada número te lleva al detalle.
- **Estado de Cartera**: la barra muestra cómo se reparte toda la cartera entre las etapas Nuevo → Interesado → Seguimiento → Compró. Su forma diagnostica el negocio: mucho "Nuevo" sin avanzar = contactos que se pierden en el primer escalón.
- **Agenda de Contactos**: la lista concreta de a quién contactar (hoy + vencidos), con canal, hora, objetivo, prioridad y acceso directo a WhatsApp y a la ficha.

### 3.3 Clientes (Directorio)
**Para qué sirve: encontrar y segmentar la cartera.**

- Búsqueda por nombre o teléfono, filtro por vendedor (admin) y **chips por estado** con conteos: un clic y ves "todos los interesados" para una promo, o "todos los que compraron" para posventa.
- Cada fila muestra intereses, último contacto ("hace 2 días"), próximo seguimiento (rojo si venció) y estado. Acciones rápidas: WhatsApp, ver ficha, editar, **eliminar**.
- Paginado de a 25 para cuando la cartera crezca.
- **Papelera** (link arriba del directorio): los clientes eliminados, con opción de restaurarlos.

### 3.4 Ficha de cliente
**Para qué sirve: es el puesto de trabajo del vendedor. El ciclo completo de un contacto pasa acá.**

1. **Antes de contactar**: leés el historial (línea de tiempo con cada llamada, mensaje, visita y cambio de estado) para saber qué se habló.
2. **Contactar**: botón WhatsApp (abre el chat directo), Llamar, o las **plantillas** — 4 mensajes prearmados (primer contacto, seguimiento, posventa, novedades) que se personalizan solos con el nombre del cliente y su interés; abren WhatsApp con el texto listo para que el vendedor lo revise y lo mande él. **Nada se envía automáticamente.**
3. **Después**: "Registrar contacto" (qué se habló) con la opción de **agendar el próximo seguimiento en el mismo paso**.
4. A la derecha, los **seguimientos pendientes** con Completar / Reprogramar / Cancelar.
5. Al final, la **Zona de riesgo**: eliminar al cliente (lo saca del directorio y la agenda, cancela sus seguimientos pendientes, pero no borra el historial — se puede restaurar después desde la Papelera).

### 3.5 Agenda
**Para qué sirve: organizar la semana y que nada se pase.**

- **Calendario semanal** (lunes a sábado) con cada seguimiento como tarjeta: azul lo que viene, rojo lo vencido. Navegación por semanas.
- **Tareas del día**: lo que queda por hacer hoy, con WhatsApp directo y completar/reprogramar sin salir de la agenda.
- **Vencidos**: los seguimientos cuya hora pasó, con "hace cuánto" y botón "Contactar ahora". Es la lista de incendios.
- El admin puede filtrar la agenda por vendedor.

### 3.6 Reportes
**Para qué sirve: que el dueño sepa cómo viene el equipo, con números y no sensaciones.**

- Período elegible (7 / 30 / 90 días).
- KPIs: clientes nuevos, contactos realizados, **ventas** (clientes que pasaron a "Compró" en el período) y **conversión** nuevo→venta.
- **Por vendedor** (solo admin): clientes nuevos, contactos, ventas, pendientes y vencidos de cada uno. De un vistazo se ve quién trabaja su cartera y quién la deja enfriar.
- **Clientes por interés**: qué busca la cartera (sirve para decidir promos y reposición). Cada vendedor que entra ve solo sus números; el admin ve todo.

### 3.7 Intereses (solo admin)
**Para qué sirve: mantener el catálogo de rubros** que los vendedores marcan en cada cliente (sillones, colchones, comedor...). Muestra cuántos clientes tiene cada interés. Desactivar oculta el interés para clientes nuevos sin borrar el historial. Este catálogo es lo que hace posible filtrar "todos los interesados en X" y el reporte por interés.

### 3.8 Formulario de cliente (alta / edición)
**Para qué sirve: capturar el contacto antes de que se enfríe.** Mínimo indispensable: nombre y teléfono. Ideal: intereses (chips de un toque) y el **primer seguimiento opcional en la misma pantalla** — si dejás fecha, el cliente nace agendado y no depende de la memoria de nadie. Al guardar te lleva directo a la ficha.

### 3.9 Mi perfil
**Para qué sirve: que cada uno maneje sus propios datos de acceso, sin depender del administrador.** Se entra tocando el propio nombre (sidebar en PC, ícono de usuario en celular). Ahí cada usuario pone su **nombre real** (el que aparece en el saludo del inicio y en todo el sistema) y puede **cambiar su contraseña** cuando quiera.

## 4. Conceptos clave (glosario)

- **Estado comercial**: en qué punto de la compra está el cliente. Nuevo → Interesado → En seguimiento → Compró (más No interesado / Inactivo). Es la "foto" de la relación; alimenta el embudo, los filtros y los reportes.
- **Interés**: qué producto le gusta (independiente del estado). Un cliente puede tener varios.
- **Seguimiento / actividad**: una acción concreta con fecha ("llamarlo el jueves a las 10 para pasarle precio"). Estados: pendiente → realizada (o cancelada).
- **Vencido**: seguimiento pendiente cuya fecha y hora ya pasaron. Mismo criterio en todo el sistema.
- **Cartera**: el conjunto de todos los clientes del negocio (o de un vendedor).
- **Posventa**: seguimiento después de la compra (satisfacción, recompra, venta cruzada). Los que compraron no se abandonan.
- **Eliminar vs. Inactivo**: no es lo mismo. "Inactivo" es un estado comercial — el cliente sigue en el directorio, solo que se enfrió. "Eliminar" lo saca del directorio, la agenda y el dashboard por completo, aunque queda recuperable en la Papelera.

## 5. Roles y permisos

| | Vendedor | Administrador |
|---|---|---|
| Ver/editar clientes | Solo los suyos | Todos |
| Agenda y reportes | Los propios | Globales + filtro por vendedor |
| Reasignar clientes | No | Sí |
| Eliminar / restaurar clientes | Los suyos | Todos |
| Borrado definitivo (Papelera) | No | Sí |
| Catálogo de intereses | Usa | Administra |
| Su propio nombre y contraseña | Sí (Mi perfil) | Sí (Mi perfil) |
| Crear usuarios | No | Sí (desde Supabase) |

La restricción es real a nivel base de datos (RLS), no un ocultamiento visual.

## 6. Estado del proyecto y posibles mejoras

**Terminado**: las 6 etapas del MVP (auth y roles → clientes e intereses → historial → agenda → contacto manual por WhatsApp → reportes y hardening) + rediseño visual completo + eliminar/restaurar clientes + perfil de usuario. **La app ya está publicada** (Vercel) y se puede usar desde el celular en el local.

**Pendiente de decisión** (no bloquea el uso):
- Recupero de contraseña por email (si alguien se olvida la contraseña *antes* de poder entrar, todavía depende del administrador).
- Registro de compras con monto (para reportes de facturación).
- Vista mensual de la agenda.
- Pantalla de administración de vendedores (hoy se hace desde Supabase).

## 7. Las 5 reglas de oro para el equipo

1. Todo el que pregunta algo, se carga. Nombre y teléfono alcanzan.
2. Ninguna conversación termina sin registrar el resultado y el próximo paso.
3. Los vencidos se atacan primero: cada día que pasa están más fríos.
4. El que compró no se abandona: posventa a los pocos días.
5. El estado se actualiza cuando cambia la realidad, no "cuando haya tiempo".
