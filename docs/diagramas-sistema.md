# Diagramas del sistema — CRM Mueblería El Gallego

Complemento visual de [informe-sistema.md](informe-sistema.md). GitHub renderiza estos diagramas automáticamente.

---

## 1. El día del vendedor (flujo de trabajo principal)

Este es el circuito que el sistema le propone a cada vendedor todos los días. La regla central: ninguna conversación termina sin registro y sin próximo paso.

```mermaid
flowchart TD
    A[Vendedor entra al CRM] --> B{Hay vencidos?}
    B -- Si --> C[Atacar vencidos primero:<br/>estan mas frios cada dia]
    B -- No --> D[Tareas de hoy<br/>en la Agenda]
    C --> E[Abrir ficha del cliente]
    D --> E
    E --> F[Leer historial:<br/>que se hablo antes]
    F --> G[Contactar: WhatsApp con plantilla,<br/>llamada o visita]
    G --> H[Registrar resultado<br/>del contacto]
    H --> I{Se concreto la venta?}
    I -- Si --> J[Estado: Compro<br/>+ agendar posventa]
    I -- No --> K[Agendar proximo<br/>seguimiento]
    J --> L[Siguiente tarea de la agenda]
    K --> L
    L --> E
```

## 2. Ciclo de vida del cliente (estados comerciales)

El estado es la "foto" de la relación. Cambia cuando cambia la realidad, y cada cambio queda registrado automáticamente en el historial.

```mermaid
stateDiagram-v2
    [*] --> Nuevo: alta del cliente
    Nuevo --> Interesado: pregunta por algo concreto
    Interesado --> EnSeguimiento: conversacion activa
    EnSeguimiento --> Compro: cierra la venta
    Interesado --> NoInteresado: dice que no
    EnSeguimiento --> NoInteresado: dice que no
    Nuevo --> Inactivo: se enfria
    Interesado --> Inactivo: se enfria
    EnSeguimiento --> Inactivo: se enfria
    Inactivo --> Interesado: una promo o novedad lo reactiva
    Compro --> Interesado: nueva necesidad / recompra

    note right of Compro
        No es un estado final:
        arranca la posventa
    end note
```

## 3. Ciclo de un seguimiento (actividad)

Una sola tabla alimenta la agenda y el historial: la actividad pendiente ES la agenda; al completarse pasa a ser historial.

```mermaid
stateDiagram-v2
    [*] --> Pendiente: se agenda con fecha, tipo y objetivo
    Pendiente --> Pendiente: Reprogramar - nueva fecha
    Pendiente --> Realizada: Completar - se registra el resultado
    Pendiente --> Cancelada: Cancelar - ya no tiene sentido
    Realizada --> [*]: queda en el historial del cliente
    Cancelada --> [*]: queda en el historial del cliente

    note right of Pendiente
        VENCIDO no es un estado guardado:
        es pendiente + fecha/hora pasada.
        Se muestra en rojo en todo el sistema.
    end note

    note left of Realizada
        Al completar, el sistema ofrece
        agendar el siguiente en el mismo paso
    end note
```

## 4. Modelo de datos (qué se relaciona con qué)

```mermaid
erDiagram
    PROFILES ||--o{ CLIENTS : "es vendedor asignado de"
    CLIENTS ||--o{ ACTIVITIES : "tiene"
    PROFILES ||--o{ ACTIVITIES : "es responsable de"
    CLIENTS ||--o{ CLIENT_INTERESTS : "marca"
    INTERESTS ||--o{ CLIENT_INTERESTS : "aparece en"
    CLIENTS ||--o{ CLIENT_STATUS_CHANGES : "registra cambios en"

    PROFILES {
        uuid id PK
        text full_name
        enum role "admin o seller"
        boolean active
    }
    CLIENTS {
        uuid id PK
        text nombre_y_apellido
        text telefono_normalizado "+54..."
        enum status "nuevo a inactivo"
        timestamptz last_contact_at "calculado por trigger"
        timestamptz next_follow_up_at "calculado por trigger"
        text notas
    }
    ACTIVITIES {
        uuid id PK
        enum type "llamada, whatsapp, visita..."
        enum status "pendiente, realizada, cancelada"
        timestamptz scheduled_at
        timestamptz completed_at
        text objective
        text outcome
    }
    INTERESTS {
        uuid id PK
        text name
        boolean active
    }
    CLIENT_STATUS_CHANGES {
        uuid id PK
        enum old_status
        enum new_status
        uuid changed_by
        timestamptz created_at
    }
```

Detalles que no se ven en el gráfico:
- **Triggers automáticos**: al crear/completar/cancelar una actividad se recalculan `last_contact_at` y `next_follow_up_at` del cliente; al cambiar el estado de un cliente se inserta la fila en `client_status_changes`; al crearse un usuario en Auth se crea su perfil.
- **RLS (seguridad)**: todas las tablas exigen que el que consulta sea el vendedor dueño del cliente o admin. Se cumple en la base, no en la pantalla.

## 5. Arquitectura (cómo viaja un pedido)

```mermaid
flowchart LR
    subgraph Celular_o_PC["Celular o PC del vendedor"]
        B["Navegador"]
    end

    subgraph NextJS["Aplicacion Next.js"]
        MW["Middleware<br/>verifica sesion en cada pagina"]
        P["Paginas<br/>dashboard, ficha, agenda..."]
        SA["Server Actions<br/>crear cliente, completar seguimiento..."]
    end

    subgraph Supabase["Supabase (nube)"]
        AUTH["Auth<br/>login y sesiones"]
        DB[("PostgreSQL + RLS<br/>los datos, protegidos por rol")]
        TR["Triggers<br/>campos calculados e historial"]
    end

    B --> MW
    MW --> AUTH
    MW --> P
    B -->|formularios| SA
    P -->|lectura filtrada por RLS| DB
    SA -->|escritura validada con Zod| DB
    DB --> TR

    W["WhatsApp"]
    B -.->|abre el chat con texto precargado - el envio es manual| W
```

---

**Cómo verlos**: en GitHub se renderizan solos al abrir este archivo. En VS Code, instalá la extensión "Markdown Preview Mermaid Support" y usá la vista previa (Ctrl+Shift+V).
