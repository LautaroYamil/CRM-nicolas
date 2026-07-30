# Manual de uso — CRM Mueblería El Gallego

Guía para entender cada parte del sistema, pensada para vendedores y administradores.

## La idea central del CRM

Cada cliente que entra al local o pregunta por WhatsApp vale plata. El CRM existe para que **ningún contacto se pierda**, con una regla simple:

> Después de cada conversación, dejá registro y agendá el próximo paso.

Si esa regla se cumple, el sistema solo te dice cada mañana a quién contactar.

## El estado comercial (la "Situación comercial")

El **estado** responde una sola pregunta: **¿en qué punto de la compra está este cliente?** Es una etiqueta única que va cambiando a medida que avanza (o se enfría) la relación:

| Estado | Qué significa | Cuándo usarlo |
|---|---|---|
| **Nuevo** | Recién cargado, todavía no hubo conversación de venta real | Al crear el cliente, casi siempre |
| **Interesado** | Preguntó por algo concreto (precio, medidas, stock) | Después del primer intercambio con interés real |
| **En seguimiento** | Hay conversación activa: quedaste en pasarle algo, está decidiendo | Cuando hay idas y vueltas |
| **Compró** | Concretó una compra | Al cerrar la venta (¡no lo abandones! viene la posventa) |
| **No interesado** | Dijo que no, o compró en otro lado | Cuando el no es claro |
| **Inactivo** | Se enfrió: no responde, pasó mucho tiempo | Cuando ya no tiene sentido insistir por ahora |

El flujo típico es **Nuevo → Interesado → En seguimiento → Compró**, pero se puede saltar o retroceder (un "Inactivo" puede volver a "Interesado" con una promo).

**¿Para qué sirve mantenerlo al día?**
- El **embudo del dashboard** ("Cartera por estado") te muestra cuántos clientes hay en cada etapa: si tenés 40 nuevos y 2 en seguimiento, se están perdiendo contactos en el medio.
- Los **filtros del directorio** usan el estado: "mostrame todos los interesados" para una promo, todos los "Compró" para posventa.
- El dashboard detecta **"Compraron sin posventa agendada"** gracias al estado Compró.
- Cada cambio de estado queda **registrado en el historial** del cliente automáticamente (quién lo cambió y cuándo).

**Diferencia con otras cosas parecidas:**
- El estado **no** es el interés: el interés es *qué producto* le gusta (sillones, colchones); el estado es *qué tan cerca está de comprar*.
- El estado **no** es el seguimiento: el seguimiento es una *acción concreta con fecha* ("llamarlo el jueves"); el estado es la *foto general*.

## Las pantallas

### Inicio (dashboard)
Lo que necesita atención hoy: seguimientos de hoy, vencidos (rojo), clientes nuevos de la semana, clientes sin contacto hace 14+ días y compradores sin posventa. Cada número es clickeable y te lleva al detalle. Abajo, la lista "Para contactar" con WhatsApp directo.

### Clientes (directorio)
Toda la cartera. Se filtra por chips de estado, búsqueda por nombre/teléfono, y (para el admin) por vendedor. Cada vendedor ve **solo sus clientes**; el admin ve todo — eso lo garantiza la base de datos, no la pantalla.

### Ficha de cliente
La pantalla de trabajo. Antes de contactar: leé el historial. Para contactar: botón WhatsApp (o las **plantillas**, que abren el chat con el texto ya escrito para que lo revises y lo mandes vos). Después de contactar: "Registrar contacto" + programar el próximo. A la derecha, los seguimientos pendientes con Completar / Reprogramar / Cancelar.

### Agenda
La semana de un vistazo (lunes a sábado). Tarjetas azules = por venir; rojas = ya pasaron. A la derecha, "Tareas del día" y "Vencidos" con acciones rápidas: podés completar o reprogramar sin salir de la agenda.

### Nuevo cliente
Cargalo apenas se va del local. Lo mínimo: nombre y teléfono. Lo ideal: intereses (para poder filtrarlo después) y el **primer seguimiento** — si dejás la fecha, el cliente nace agendado y no depende de tu memoria.

### Eliminar un cliente (distinto de "Inactivo")

"Inactivo" es un estado comercial: el cliente sigue en el directorio, solo que se enfrió. **"Eliminar"** es otra cosa: saca al cliente del directorio, la agenda y el dashboard, y cancela sus seguimientos pendientes. Se hace desde el botón rojo al final de su ficha (o el ícono de tacho en el listado), pidiendo confirmación antes de aplicarlo.

No se pierde nada: el cliente va a la **Papelera** (link arriba del directorio), desde donde se puede **restaurar** en cualquier momento. Solo el administrador puede **eliminar definitivamente** (ahí sí, sin vuelta atrás).

### Intereses (solo admin)
El catálogo de rubros que los vendedores pueden marcar (living, colchones, comedor...). Desactivar un interés lo oculta para clientes nuevos sin borrar nada. Cargalos genéricos: "Sillones", no "sillón gris modelo X".

## Los seguimientos (actividades)

Un seguimiento es una acción con cliente, tipo (llamada, WhatsApp, visita...), fecha y objetivo. Vive en uno de estos estados:

- **Pendiente**: está en la agenda, hay que hacerlo. Si la fecha y hora ya pasaron y sigue pendiente, aparece como **vencido** (rojo) en todas las pantallas.
- **Realizada**: se hizo; el resultado que escribiste pasa al historial del cliente.
- **Cancelada**: ya no tiene sentido hacerla.

Al completar un seguimiento siempre te ofrece **agendar el siguiente en el mismo paso** — usalo: es lo que mantiene viva la rueda.

"Último contacto" y "Próximo seguimiento" del cliente se calculan solos a partir de las actividades; no hay que cargarlos a mano.

## Mi perfil

Tocando tu nombre (sidebar en PC, ícono de usuario en celular) cada uno accede a **Mi perfil**, donde puede:
- **Poner su nombre real** — es el que aparece en el saludo del inicio ("Buenos días, Nico") y en el resto del CRM. Importante cuando se crea un usuario nuevo desde Supabase, porque de entrada el sistema le pone el nombre que tenga antes de la arroba del email.
- **Cambiar su contraseña** en cualquier momento, sin depender del administrador.

## Roles

- **Vendedor**: ve y gestiona sus propios clientes, su agenda y sus seguimientos.
- **Administrador**: ve todo, puede filtrar por vendedor, reasignar clientes y administrar el catálogo de intereses.

La restricción es real a nivel base de datos (políticas RLS de Supabase): aunque alguien manipule la aplicación, no puede ver datos de otro vendedor.

## Reglas de oro para el equipo

1. Todo el que pregunta algo, se carga. Nombre y teléfono alcanzan.
2. Ninguna conversación termina sin registrar el resultado y el próximo paso.
3. Los vencidos se atacan primero (están más fríos cada día que pasa).
4. El que compró no se abandona: posventa a los pocos días, novedades cada tanto.
5. El estado se actualiza cuando cambia la realidad, no "cuando haya tiempo".
