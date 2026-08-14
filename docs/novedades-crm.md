# Novedades del CRM — para Nico

Esto es todo lo que se sumó al sistema en esta ronda. Una parte son arreglos que no se ven pero hacen que los números sean confiables, y el resto son funciones nuevas para el día a día. Te cuento cada una.

## Lo que arreglamos (no se ve, pero importa)

Antes de sumar cosas nuevas, arreglamos varias cositas de fondo:

- Los números de "vencidos" ahora coinciden siempre entre el Inicio, la Agenda y los Reportes. Antes podían mostrar cantidades distintas.
- Los reportes ahora calculan bien, sin riesgo de que un número salga mal si la cartera crece mucho.
- La "conversión" del reporte ahora mide lo que dice medir (antes podía dar números raros).
- Si eliminás un cliente por error y lo restaurás desde la Papelera, ahora sí recupera los seguimientos que tenía pendientes (antes se perdían).
- Las plantillas de WhatsApp firman con el nombre del vendedor dueño del cliente, no con el tuyo si entrás a mirar la ficha de otro.

Nada de esto necesita que hagas nada distinto — el sistema es más confiable, así de simple.

## Lo nuevo que vas a usar

### 1. Resultado del contacto

Cuando registrás un contacto o completás un seguimiento, aparece un desplegable **"Resultado"** (opcional) con opciones como "Respondió - sigue interesado", "No respondió", "Venta concretada", etc. No es obligatorio, pero cuanto más lo uses, mejor va a funcionar todo lo demás (prioridades, jornada).

### 2. Objetivo del próximo contacto

Ya no es un cuadro de texto en blanco. Es un desplegable con objetivos típicos ("Pasar precio", "Confirmar si visitó el local", etc.) más la opción **"Otro"** para algo puntual. Los objetivos del desplegable los administrás vos desde **Objetivos** en el menú.

### 3. Compras con producto

"Sumar compra" ahora te deja anotar **qué compró** el cliente (ej: "Juego de living 3 cuerpos") y el rubro relacionado. Sin montos ni facturación — solo para saber qué le vendiste a cada uno.

### 4. Motivo de pérdida

Al marcar un cliente como **"No interesado"**, el sistema te pide elegir un motivo (Precio, Compró en otro lado, No había el producto, etc.). Con el tiempo vas a poder ver por qué se pierden ventas, no solo cuántas. Los motivos los administrás en **Motivos de pérdida** del menú.

*(Ojo: "Dejó de responder" no está en esa lista a propósito — para eso ya existe el estado "Inactivo".)*

### 5. Posventa automática

Cada vez que se registra una compra, el sistema **agenda solo** dos seguimientos: uno a los 7 días (cómo le fue) y otro a los 75 días (ofrecer algo más). No manda ningún mensaje — solo te lo deja anotado en la agenda para que vos decidas cuándo y qué escribir.

### 6. Aviso de teléfono repetido

Si cargás un cliente con un teléfono que ya existe, después de guardarlo te avisa. Si es tuyo, te muestra quién es con link a la ficha. Si es de otro vendedor, solo te avisa que existe, sin mostrarte sus datos. Nunca bloquea la carga.

### 7. Reasignar cartera

En **Equipo** (solo admin), cada vendedor muestra cuántos clientes activos tiene, con un botón para reasignar toda su cartera a otro de una sola vez.

### 8. Prioridad en la Agenda

Los seguimientos vencidos de un cliente que sigue "Interesado" o "En seguimiento" ahora se marcan con un cartel rojo de **"Prioridad Alta"** — son los que se están enfriando de verdad, para que sepas por dónde arrancar.

### 9. Empezar jornada

Es un botón en el **Inicio** que arma automáticamente la cola de todo lo que hay para hacer hoy (vencidos primero, después lo de hoy) y va mostrando **un cliente a la vez**: nombre, teléfono, objetivo, botones de WhatsApp/Llamar/Ver ficha, y un cuadro para registrar el resultado y pasar al siguiente con un solo click. También se puede "Posponer" para saltear uno sin registrar nada. Sirve para no tener que pensar "¿a quién llamo ahora?" — el sistema ya lo ordena.

### 10. Reportes más completos

En **Reportes** ahora también hay:
- **Cartera por estado**: cuántos clientes tenés en cada etapa (Nuevo, Interesado, En seguimiento, Compró, No interesado, Inactivo), foto de hoy.
- **Pérdidas por motivo**: por qué se te fueron los clientes que marcaste "No interesado".
- **Conversión por vendedor**: ahora la tabla ordena por quién convierte mejor su propia cartera, no por quién vendió más en números crudos (así no queda mal el que tiene menos clientes asignados).
- **Tiempo hasta la venta**: cuántos días en promedio pasan desde que se carga un cliente hasta que compra.

### 11. Auditoría administrativa

Pantalla nueva (**Auditoría**, solo admin) que registra 3 cosas: cuándo se reasigna una cartera, cuándo se cambia el rol de alguien, y cuándo se activa/desactiva un vendedor — con quién lo hizo y cuándo. Para no depender de la memoria si en unos meses te preguntás "¿por qué este cliente pasó a ser de otro vendedor?".

## Dónde encontrar cada cosa nueva

| Novedad | Dónde está |
|---|---|
| Resultado del contacto | Ficha del cliente → Registrar contacto / Completar seguimiento |
| Objetivo del próximo contacto | Ficha del cliente → al programar un seguimiento |
| Administrar objetivos | Menú → Objetivos |
| Compras con producto | Ficha del cliente → sección Compras |
| Motivo de pérdida | Ficha del cliente → al cambiar el estado a "No interesado" |
| Administrar motivos | Menú → Motivos de pérdida |
| Posventa automática | Aparece solo en la Agenda, no hay que hacer nada |
| Aviso de teléfono repetido | Aparece solo al cargar un cliente nuevo |
| Reasignar cartera | Menú → Equipo |
| Prioridad Alta | Agenda → panel de Vencidos |
| Empezar jornada | Botón en el Inicio (cuando hay vencidos o pendientes de hoy) |
| Reportes nuevos | Menú → Reportes (scrolleá hacia abajo) |
| Auditoría | Menú → Auditoría |

## Lo que queda pendiente (sin apuro)

Hay una lista corta de mejoras chicas que quedaron anotadas para más adelante, sin ninguna urgencia:
- Recuperar contraseña sin depender del admin
- Un aviso visual (badge) de cuántos vencidos hay, sin tener que entrar a mirar
- Agrupar los vencidos por antigüedad (hoy / 1-2 días / 3-7 días / +7 días)
- Un par de detalles de prolijidad visual en la ficha del cliente (nada funcional)

Nada de esto es necesario para usar el sistema hoy — son ajustes finos para cuando haya tiempo.
