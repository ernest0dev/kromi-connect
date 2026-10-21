# Documentación Técnica: Lógica de Negocio y Server Actions

> **Estado:** descripción histórica de acciones auditadas al 2026-09-19. Los anexos 7 y 8 registran los flujos de publicaciones y de los demás módulos añadidos después (Design, Eventos, Interno e Inventario, al 2026-10-21); los apartados anteriores no deben tomarse como inventario actual completo.

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

### 4.4. `campanas/campaigns.ts`

- **Exports:** `getCampaignsAction`, `createCampaignAction`, `updateCampaignAction`, `updateCampaignStatusAction`, `archiveCampaignAction`, `restoreCampaignAction` y `saveCampaignEvaluationAction`.
- **Edición:** `updateCampaignAction` valida y actualiza los campos de la campaña desde el mismo formulario usado para crearla.
- **Archivo reversible:** `archiveCampaignAction` cambia `estatus` a `ARCHIVADA`, conserva el estado anterior en `estatus_pre_archivado` y desactiva la campaña. No elimina filas ni toca las publicaciones, evaluaciones o premios asociados. `restoreCampaignAction` restaura el estado previo.
- **Presentación:** `getCampaignsAction` devuelve campañas activas y archivadas, además de las publicaciones relacionadas y la evaluación post-mortem más reciente. La UI separa las archivadas en una lista plegable y permite restaurarlas.
- **Esquema requerido:** aplicar `202609270001_campaign_management.sql` y `202609270002_campaign_archive.sql` en orden para añadir los campos de gestión y el estado de archivo reversible.
- **Caché:** las mutaciones revalidan `/social-media/campaigns` mediante `revalidatePath`.

## 5. Integración y Seguridad

- **Cliente administrativo (`getSupabaseAdmin`):** las Server Actions que ejecutan operaciones de escritura utilizan un cliente de Supabase inicializado con Service Role Key, instanciado exclusivamente en contexto de servidor, con bypass de RLS.
- **Manejo de tipos opcionales:** se aplica manejo explícito de valores potencialmente indefinidos provenientes de respuestas externas (p. ej. `folderUrl ?? ''`) para prevenir errores de compilación de TypeScript y garantizar consistencia de tipos entre el resultado de la integración con Google Drive API y la estructura esperada por la tabla `publicaciones`.

---

## 6. Pendientes conocidos (no cubiertos en esta revisión)

- `actions/campanas/campaigns.ts`, `actions/support/customerSupport.ts` y `actions/third-parties/thirdParties.ts` no han sido auditadas línea por línea en esta revisión — su documentación en secciones anteriores de este proyecto puede no reflejar el código real de la misma forma en que se corrigió para `publicaciones/` y `solicitudes/`.
- El valor `estatus_solicitud = 'RECHAZADO'` y `'CONVERTIDA'` son convenciones de aplicación (campo `TEXT` libre en el schema, no un enum de base de datos) — no hay constraint a nivel de Supabase que impida un valor distinto o inconsistente si se escribe desde otro punto del código.

## 7. Actualización de publicaciones (2026-10-12)

Los apartados anteriores documentan el diseño inicial de Server Actions; el flujo actual de publicaciones usa cliente autenticado/RPC y validación explícita de permisos, no la afirmación histórica de que toda escritura se haga con Service Role.

- `src/app/actions/publicaciones/drive.ts` autoriza sesiones de carga resumible a Google Drive, confirma/cancela reservas y lista archivos de Brief o Entregables. Los bytes viajan del navegador a Drive; no se envían a Vercel/Supabase.
- `src/app/actions/publicaciones/workflow.ts` comprueba en Drive que haya Brief antes de solicitar a Design y que haya Entregables antes de entregar. `request_publication_to_design` es la RPC interna con `service_role`; `transition_publicacion_status` no permite solicitar por la ruta genérica.
- La vuelta `SOLICITADO → PENDIENTE_BRIEF` está permitida antes de que Design abra la solicitud. La operación limpia fechas del ciclo vigente, preserva el evento en historial y una nueva solicitud calcula fechas nuevas.
- La acción de requisito de diseño cambia `requiere_diseno` mediante la RPC autenticada `set_publication_design_requirement`; puede usarse en `PENDIENTE_BRIEF` y `EN_RODAJE`. La migración local `202610110002_publication_design_requirement.sql` debe confirmarse en el entorno Supabase antes de desplegar/usar esa capacidad.
- La retención/limpieza de Archivo está documentada en la migración `202610100001_publication_workflow_archive.sql` y en §10 de `supabase-db-migration.md`.

Para parámetros, límites operativos y estado reportado de despliegue, consultar [`design/plan-validacion-brief-drive.md`](design/plan-validacion-brief-drive.md) y [`supabase-db-migration.md`](supabase-db-migration.md).

## 8. Acciones de Design, Eventos, Interno e Inventario (2026-10-21)

Inventario de las Server Actions añadidas después del diseño inicial, según `src/app/actions/` en `main` (`6d911ac`). Validan sesión y permiso con `authorizeAction` (`design/requests.ts` no lo hace directamente: despacha a la acción de cada origen, que sí lo hace) y delegan la regla de negocio en RPC de Supabase. Las cargas a Drive son siempre **directas del navegador** mediante una sesión resumible que el servidor autoriza y confirma; el contenido de los archivos no pasa por una Server Action ni por Vercel. Algunas RPC (`request_pendiente_to_design`, `sync_*_drive_brief`, `reserve_*_upload`) solo las ejecuta `service_role`; las acciones que las llaman validan antes al actor y su alcance.

| Archivo | Acciones | Propósito |
|---|---|---|
| `design/requests.ts` | `startDesignRequestAction`, `deliverDesignRequestAction`, `reopenDesignRequestAction` | Tomar, entregar y reabrir una solicitud de la cola unificada de Design, despachando por origen (Social Media, Interno, Eventos). |
| `publicaciones/design-drive.ts` | `listDesignPublicationDriveFilesAction`, `start/finish/resume/cancelDeliverableUploadAction`, `listPublicacionDeliverablesForReviewAction`, `getPublicationDesignerNameAction` | Entregables de Design y vista de revisión para Social Media. |
| `publicaciones/drive.ts` | `listPublicacionBriefFilesAction`, `listPublicacionDeliverablesAction`, `start/finish/resume/cancelPublicacionBriefUploadAction`, `requestPublicationToDesignAction`, `retryPublicacionDriveFolderAction` | Brief, solicitud validada contra Drive y reintento de la carpeta (ver §7). |
| `publicaciones/archive.ts` | `archivePublicationAction`, `restorePublicationAction`, `resolveExpiredDrivePurgeAction` | Archivo lógico, restauración y resolución manual de fallos de limpieza de Drive. |
| `events/schedule.ts` | `getEventScheduleDataAction`, `getEventDetailAction`, `checkEventOverlapAction`, `createEventAction`, `updateEventAction`, `rescheduleEventAction`, `transitionEventAction`, `saveEventClosureAction`, `archiveEventAction`, `restoreEventAction` | Programación de eventos: calendario, cruces entre tiendas, estados, cierre y archivo. |
| `events/design.ts` | `requestEventDesignAction`, `retractEventDesignAction`, `requestEventDesignCorrectionAction`, `startEventDesignWorkAction`, `reopenEventDesignWorkAction`, `deliverEventDesignWorkAction` | Solicitud de diseño de un evento, retiro, correcciones y trabajo de Design. |
| `events/drive.ts` | `listEventBriefFilesForRequesterAction`, `start/resume/finish/cancelEventBriefUploadAction`, `listEventDesignFilesAction`, `start/resume/finish/cancelEventDeliverableUploadAction` | Brief opcional y entregables de un evento. |
| `internal/tasks.ts` | `createStoreTasksAction`, `getStoreTaskDetailAction`, `transitionStoreTaskAction`, `updateStoreTaskAction`, `archiveStoreTaskAction` | Pendientes por tienda del rol Interno. |
| `internal/drive.ts` | `listInternalBriefFilesAction`, `startInternalBriefUploadAction`, `finishInternalBriefUploadAction`, `requestInternalDesignAction`, `retractInternalDesignAction` | Brief de un pendiente y solicitud o retiro de diseño. |
| `internal/design-work.ts` | `startInternalDesignWorkAction`, `reopenInternalDesignWorkAction`, `requestInternalDesignCorrectionAction`, `getInternalDesignFilesAction`, `start/finish/resume/cancelInternalDeliverableUploadAction`, `deliverInternalDesignWorkAction` | Trabajo de Design sobre solicitudes de Interno y correcciones. |
| `inventory/inventory.ts` | `createInventoryItemAction`, `updateInventoryItemAction`, `registerInventoryMovementAction`, `createInventoryLocationAction`, `getInventoryItemActivityAction`, `getInventoryItemAction` | Inventario compartido de Eventos e Interno (movimientos inmutables). |
| `efemerides/efemerides.ts` | `getEfemeridesByYearAction`, `getEfemeridesInYearRangeAction`, `createEfemerideAction`, `updateEfemerideAction`, `deleteEfemerideAction` | Catálogo anual de efemérides. |

`publicaciones/workflow.ts` sigue siendo el punto de entrada de las transiciones de publicaciones; `transitionPublicationAction` despacha `SOLICITADO` a `requestPublicationToDesignAction`. Las RPC de Interno y Eventos señalan los conflictos de versión optimista con `PT409` (HTTP 409) para evitar el reintento automático de PostgREST con SQLSTATE `40001` (migración `20261021030127`).
