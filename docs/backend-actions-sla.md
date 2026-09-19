# Documentación Técnica: Lógica de Negocio y Server Actions

> **Estado:** revisado y corregido para reflejar el código real (2026-09-19), tras la reorganización de estructura en `chore/reorganize-structure`.

## 1. Resumen de Implementación

Se construyó la capa de servidor de Kromi Connect sobre Next.js (App Router), utilizando Server Actions como mecanismo exclusivo de mutación de datos —sin exposición de rutas API REST intermedias—. Esta capa concentra tres responsabilidades funcionales:

1. Gestión del ciclo de vida de publicaciones (`publicaciones`), incluyendo creación, actualización de fechas y transición de estatus.
2. Automatización del cálculo de fechas límite de producción (Regla SLA 3+2), aislada como lógica pura desacoplada del acceso a datos.
3. Integración con Google Drive API para la generación automática de estructuras de carpetas por ticket de contenido, con persistencia de los metadatos resultantes en Supabase.

Toda escritura contra la base de datos se ejecuta a través de un cliente administrativo de Supabase con Service Role Key, restringido al entorno de servidor.

Las Server Actions están organizadas por **entidad de dominio** bajo `src/app/actions/`, no por vista — cada carpeta agrupa las acciones que mutan la misma tabla central, independientemente de qué ruta las invoque. Esto anticipa perfiles futuros (Diseño, Gerencia) que operarán sobre las mismas entidades desde vistas distintas.

---

## 2. Definición y Tipado de Módulos (`src/types/`)

La arquitectura de tipos del sistema se organiza en módulos bajo `src/types/`:

- **`enums.ts`**: dominios controlados equivalentes a los tipos enumerados del esquema (formato, estatus, tipo de campaña, departamento emisor, canal, sede).
- **`database.types.ts`**: tipado estructural generado/mantenido a partir del esquema de Supabase.
- **`index.ts`**: punto de exportación unificado (Barrel Export) — el resto de la aplicación importa tipos vía `@/types`.
- **`modules/`**: interfaces de dominio y payloads por entidad, un archivo por módulo funcional:
  - `posts.ts` — publicaciones y sus relaciones directas
  - `campaigns.ts` — campañas
  - `customerSupport.ts` — atención al cliente / escucha social
  - `thirdParties.ts` — solicitudes de terceros

> Nota: el módulo de publicaciones se llama `modules/posts.ts`, no `publicaciones.ts` — el nombre del módulo de tipos no sigue 1:1 el nombre de la tabla ni el de la carpeta de Server Actions (`actions/publicaciones/`).

---

## 3. Módulo de Utilidades de SLA (`src/utils/sla.ts`)

Se implementó la función `calcularMatrizSLA` como unidad de lógica pura, sin efectos secundarios ni dependencias de acceso a datos.

**Responsabilidades de la función:**

- **Regla 3+2 (cálculo de `fecha_limite_brief`):** a partir de `fecha_publicacion`, se descuentan 5 días calendario para determinar la fecha límite de entrega de brief.
- **Cálculo de `fecha_entrega_diseno_estimada`:** a partir de `fecha_solicitud_diseno`, se suman 2 días calendario para proyectar la fecha estimada de entrega de diseño.

**Criterio de diseño:** la función se mantiene aislada de cualquier llamada a Supabase u otro servicio externo, permitiendo pruebas unitarias determinísticas sin mocks de base de datos.

---

## 4. Server Actions Implementadas (`src/app/actions/`)

### 4.1. `publicaciones/recalculateSla.ts`

- **Export principal:** `recalculateSlaDates`. Existe además un alias `recalcularFechasSLAAction` (misma función, exportado con nombre en español) para compatibilidad entre componentes que fueron escritos en momentos distintos del proyecto — ambos nombres son válidos y equivalentes, no hay diferencia de comportamiento entre ellos.
- **Propósito:** gestionar la actualización de fechas de una publicación existente y soportar la reprogramación en cascada ("Quick Reschedule"), donde el cambio de `fecha_publicacion` recalcula automáticamente las fechas derivadas.
- **Flujo de ejecución:**
  1. Lectura del registro actual de la publicación en Supabase.
  2. Recálculo de fechas derivadas mediante `calcularMatrizSLA`, tomando como entrada la nueva `fecha_publicacion`.
  3. Actualización atómica del registro en la tabla `publicaciones` con las fechas recalculadas.
  4. Invalidación de caché de `/social-media/grid` y `/social-media/kanban` mediante `revalidatePath`, forzando la regeneración de ambas vistas.

### 4.2. `publicaciones/create.ts`

- **Export:** `createPostWithDriveAction`.
- **Propósito:** ejecutar la creación completa de un ticket de publicación, incluyendo la integración con Google Drive para la organización de assets.
- **Flujo de ejecución:**
  1. Invocación de `createPublicacionDriveFolder` (Google Drive API) para generar una subcarpeta dedicada al ticket, con convención de nombre `[FORMATO] FECHA - TITULO`.
  2. Inserción del registro en Supabase, incluyendo la estructura granular de copy (`hook_texto`, `body_texto`, `cta_texto`, `hashtags`) junto con los metadatos de Drive obtenidos y el estatus inicial `PENDIENTE_BRIEF`.
  3. Invalidación de caché de `/social-media/grid` y `/social-media/kanban`, con manejo defensivo (`try/catch`) para no fallar cuando la acción se invoca desde un runner de test fuera de contexto de request (Jest).

> Corrección de esta revisión: versiones anteriores de esta acción declaraban `hook_texto`, `body_texto`, `cta_texto` y `hashtags` en la interfaz de entrada pero no los incluían en el `insert()` — el copy capturado en el modal se perdía silenciosamente. Corregido para persistir los cuatro campos.

### 4.3. `solicitudes/convert.ts`

- **Exports:** `getRequestsAction` (lista el inbox de `solicitudes_terceros`) y `processRequestAction` (maneja tanto el rechazo como la conversión a ticket — el documento anterior solo documentaba esta última bajo el nombre `convertirSolicitudATicketAction`, que no existe en el código).
- **Propósito:** gestionar el ciclo de vida de una solicitud entrante: rechazarla, o convertirla en un ticket operativo dentro de `publicaciones`.
- **Flujo de ejecución (rechazo, `aprobar: false`):**
  1. Actualiza `solicitudes_terceros.estatus_solicitud = 'RECHAZADO'`.
  2. Invalida `/social-media/requests`.
- **Flujo de ejecución (conversión, `aprobar: true`):**
  1. Calcula la matriz SLA con `calcularMatrizSLA` a partir de la fecha de publicación propuesta.
  2. Inserta el registro en `publicaciones` (`titulo`, `formato`, `fecha_publicacion`, fechas SLA derivadas, `campana_id` opcional, `estatus: 'PENDIENTE_BRIEF'`).
  3. Actualiza la solicitud de origen: `estatus_solicitud = 'CONVERTIDA'` y `publicacion_id` apuntando al ticket recién creado — cerrando la trazabilidad bidireccional entre `solicitudes_terceros` y `publicaciones` que especifica el SRS.
  4. Invalida `/social-media/requests`, `/social-media/kanban` y `/social-media/grid`.

> Corrección de esta revisión: la versión anterior no vinculaba `publicacion_id` al convertir (la trazabilidad quedaba rota pese a que el SRS la especifica como requisito), no aceptaba `campana_id` en el payload, y usaba rutas de `revalidatePath` previas a la reorganización de estructura.

---

## 5. Integración y Seguridad

- **Cliente administrativo (`getSupabaseAdmin`):** las Server Actions que ejecutan operaciones de escritura utilizan un cliente de Supabase inicializado con Service Role Key, instanciado exclusivamente en contexto de servidor, con bypass de RLS.
- **Manejo de tipos opcionales:** se aplica manejo explícito de valores potencialmente indefinidos provenientes de respuestas externas (p. ej. `folderUrl ?? ''`) para prevenir errores de compilación de TypeScript y garantizar consistencia de tipos entre el resultado de la integración con Google Drive API y la estructura esperada por la tabla `publicaciones`.

---

## 6. Pendientes conocidos (no cubiertos en esta revisión)

- `actions/campanas/campaigns.ts`, `actions/support/customerSupport.ts` y `actions/third-parties/thirdParties.ts` no han sido auditadas línea por línea en esta revisión — su documentación en secciones anteriores de este proyecto puede no reflejar el código real de la misma forma en que se corrigió para `publicaciones/` y `solicitudes/`.
- El valor `estatus_solicitud = 'RECHAZADO'` y `'CONVERTIDA'` son convenciones de aplicación (campo `TEXT` libre en el schema, no un enum de base de datos) — no hay constraint a nivel de Supabase que impida un valor distinto o inconsistente si se escribe desde otro punto del código.
