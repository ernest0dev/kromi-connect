# Plan: solicitud de diseño desde la programación de eventos

**Estado (2026-10-19):** plan, sin código ni migración. El historial remoto de migraciones se concilió manualmente con las 20 migraciones locales; el esquema se revisó contra el snapshot remoto y verificaciones puntuales, aunque no fue posible ejecutar `db diff` desde CLI. El contrato común de solicitud y la cola única de Design quedan definidos en §9. Extiende [`plan-eventos-programacion.md`](./plan-eventos-programacion.md). Las referencias de Social Media ([`modales-publicacion.md`](./modales-publicacion.md), [`plan-rol-design.md`](./plan-rol-design.md)) e Interno ([`plan-rol-interno.md`](./plan-rol-interno.md), [`implementacion-rol-interno.md`](./implementacion-rol-interno.md)) son flujos existentes, no el objetivo de conservar pantallas separadas.

## Estado de implementación (2026-10-20)

**Actualización (2026-10-21): implementado.** Los campos de diseño de Eventos, la cola y el historial unificados, la ficha única y las cargas de brief y entregables a Drive están en el repositorio. Migraciones: `20261020011300_events_design.sql` (columnas `diseno_*`, permisos `events.schedule.design` y `design.requests.*`), `20261020011301_unified_design_requests.sql` (tabla `evento_drive_uploads`, solicitud, retiro, cola, historial, inicio y entrega), `20261020011400_design_request_details.sql` (detalle, línea de tiempo, carga de entregables, permiso `design.requests.upload`) y `20261021030128_event_brief_design_corrections.sql` (correcciones, reapertura y carga del brief opcional; incluye `EN_CORRECCION` en `diseno_estatus` y exige al menos 10 caracteres de instrucciones). El usuario confirmó el historial remoto hasta `20261021030127`; `20261021030128` está pendiente de aplicar.

**Diferencias respecto a este plan:**
- El archivo propuesto `202610180006_events_design_requests.sql` no existe; el trabajo quedó repartido en las migraciones anteriores.
- `request_evento_to_design(p_evento_id)` y `retract_evento_design_request` **no** son exclusivas de `service_role`: se otorgan a `authenticated` y toman el actor de `auth.uid()`, con `events_require('events.schedule.design')`. Solo `sync_evento_drive_brief` y las reservas de carga (`reserve_evento_brief_upload`, `reserve_evento_deliverable_upload`) se restringen a `service_role`.
- El flujo ya incluye corrección y reapertura (`request_event_design_correction`, `design_reopen_event_request`), que este plan no contemplaba.

Las secciones siguientes conservan el plan original como registro de decisiones. Los estados del plan (2026-10-19/20) y la nota de la §5 sobre la RPC exclusiva de servicio no describen el estado actual del código.

**Estado previo (2026-10-20), conservado como referencia:** primera integración local de los campos de diseño y de la cola/historial unificados, con las migraciones `20261020011300` y `20261020011301` sin aplicar; ficha universal y cargas de Drive pendientes. Las funciones remotas `list_events` y `get_event` y sus permisos se verificaron manualmente con el usuario; `db diff` sigue sin estar disponible.

## 1. Resultado esperado

Cada evento del calendario puede marcar **Requiere diseño** y, en ese caso, capturar:

| Campo | Regla |
|---|---|
| Requiere diseño | casilla; apagada por defecto |
| Formatos de salida | Una o ambas opciones: `Digital` y `Impresión` (obligatorio si requiere diseño) |
| Instrucciones | texto libre, obligatorio si requiere diseño, hasta 4000 caracteres (igual que Interno) |
| Fecha en que debe estar listo | fecha (día), obligatoria si requiere diseño; hoy o posterior y no posterior al día del evento |

Desde la ficha del evento el equipo de Eventos puede subir un brief opcional a Drive, **solicita** a Design, puede **retirar** la solicitud mientras nadie la haya tomado y ve los entregables cuando Design entrega. La solicitud requiere instrucciones aunque no tenga archivos de brief. Design ve Eventos en la misma cola, ficha de trabajo e historial que las solicitudes de Social Media e Interno; no se crea una vista independiente por rol de origen.

Fuera de alcance por ahora: cantidad, medidas como campos separados (van en las instrucciones), varias piezas por evento, ciclo de correcciones, aprobación por Gerencia.

## 2. Qué se copia y de dónde

| Pieza | Modelo existente | En Eventos |
|---|---|---|
| Solicitud de diseño | Contrato común definido en §9; adaptador de Eventos | Debe usar el mismo contrato y cola que Social Media e Interno; el origen y contexto de Evento se muestran como datos de contexto |
| Formatos | Preferencias propias de cada flujo | Eventos admite Digital, Impresión o ambos; mapear al campo común acordado en §9 |
| Estados de diseño | Diferentes por módulo actualmente | Normalizar a estados comunes en la cola; preservar el flujo editorial de Social Media en su módulo |
| Carga de brief y entregables | `actions/internal/drive.ts`, `design-work.ts`, `TaskBriefPanel.tsx` | adaptar el origen Eventos al contrato y componentes comunes; mantener las reglas propias por fuente y evitar una pantalla paralela |
| Cola, ficha e historial de Design | `design/publications/*` y `design/internal/*` hoy están separados | Incorporar Eventos a una cola/ficha/historial únicos según el contrato común; no crear `design/events/*` como experiencia paralela |
| Permisos de Design | Hoy separados por fuente | Usar el permiso común `design.requests.read` para la cola única y conservar autorización de acciones por origen en los adaptadores; Eventos no requiere `events.schedule.read` |
| Helpers | `src/lib/googleDrive.ts`, `driveFileRules.ts`, `designSla.ts` | se reutilizan tal cual |

## 3. Diferencias con Interno que hay que respetar

1. **El estado del evento no cambia al solicitar.** En Interno, solicitar pasa el pendiente a `EN_PROCESO`. Aquí `eventos.estatus` lo mueve la hora (`sync_event_statuses`) y las acciones del equipo; el diseño tiene su propio `diseno_estatus`.
2. **Sin dueño único.** Hay 3 usuarios de Eventos y el inventario y los eventos son compartidos. Interno exige `creado_por = auth.uid()`; aquí cualquier usuario con el permiso nuevo puede subir brief, solicitar o retirar en cualquier evento.
3. **La fecha de entrega la escribe la persona.** En Interno se deriva de la fecha requerida (−2 días). Aquí se captura; el formulario puede **sugerir** «día del evento − 2» editable, y la estimación de Design (solicitud + 2 días calendario) se calcula igual que hoy. No se puede solicitar hasta que el evento tenga fecha.
4. **Design no ve datos del evento ajenos al trabajo:** presupuesto, patrocinadores, materiales, inscripción ni cierre. Ve los campos del contrato común y el contexto mínimo de Evento: nombre, tiendas, fecha y hora, formatos de salida, instrucciones, fecha de entrega y brief si existe.
5. **Las RPC de lectura cambian de forma.** `list_events` y `get_event` devuelven `returns table(...)`; `create or replace` no puede cambiar columnas, así que hay que `drop function` y recrearlas con sus `revoke/grant`.
6. **El historial tiene un CHECK.** `evento_historial.tipo` solo admite `ESTATUS` y `REPROGRAMACION`; hay que ampliarlo con `DISENO`. `EventDetail` en `ScheduleView.tsx` hoy muestra «Evento reprogramado» para todo lo que no sea `ESTATUS`, así que sin ajustar la vista las filas de diseño se verían mal.

## 4. Modelo de datos (migración 1)

Archivo propuesto: `supabase/migrations/202610180005_events_design.sql`. Solo columnas, reglas y funciones que no dependen de Drive.

**Columnas nuevas en `eventos`**

- `requiere_diseno boolean not null default false`
- `diseno_formatos text[]` (valores permitidos `DIGITAL`, `IMPRESION`; una o ambas opciones cuando `requiere_diseno`)
- `instrucciones_diseno text check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000)`
- `fecha_entrega_diseno date`
- `diseno_estatus text check (diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO','CANCELADO'))`
- `diseno_solicitado_en`, `diseno_iniciado_en`, `diseno_entregado_en` (`timestamptz`)
- `disenador_id uuid references auth.users(id) on delete set null`
- `drive_folder_id`, `drive_folder_url`, `drive_brief_folder_id`, `drive_deliverables_folder_id`, `drive_brief_file_count integer not null default 0`, `drive_brief_checked_at timestamptz`

**CHECK de coherencia:** si `diseno_estatus` no es nulo, entonces `requiere_diseno`, al menos un formato válido, `fecha_entrega_diseno` e instrucciones no vacías deben estar presentes. La fecha de entrega no puede ser anterior a hoy ni posterior a la fecha del evento al solicitar. Las columnas `drive_*` y `diseno_*` de ciclo de vida no las escribe `update_event`; solo las funciones de Drive/Design.

**Cambios en funciones existentes**

| Función | Cambio |
|---|---|
| `events_normalize` | acepta y valida los 4 campos de captura (formatos y fecha solo si `requiere_diseno`; los pone en `null`/vacío si no) |
| `create_event` / `update_event` | persisten los 4 campos. En `update_event`, si `diseno_estatus` no es nulo y cambia alguno de los 4 campos, error «Retira la solicitud de diseño para cambiar estos datos» |
| `list_events` | devuelve `requiere_diseno`, formatos, `fecha_entrega_diseno`, `diseno_estatus` (para marcar el calendario) |
| `get_event` | además `instrucciones_diseno`, `drive_brief_file_count`, `diseno_*_en` y `disenador_nombre` |
| `events_flags` | indicadores nuevos `diseno_sin_solicitar` (requiere diseño, sin solicitar y entrega en ≤ 3 días), `diseno_atrasado` (pasó la fecha de entrega sin `ENTREGADO`) y `diseno_posterior_al_evento` |
| `transition_event_status` | cancelar con diseño `SOLICITADO` o `EN_DISENO` sigue exigiendo motivo; cierra la solicitud como `CANCELADO`, escribe historial `DISENO` y la quita de la cola activa. Si Design conserva la ficha abierta, entregar vuelve a validar en servidor y falla con un mensaje de solicitud cancelada |
| `archive_event` | no archiva mientras `diseno_estatus` sea `SOLICITADO` o `EN_DISENO`; una solicitud cerrada como `CANCELADO` no bloquea el archivo del evento |
| `evento_historial` | CHECK `tipo` ampliado con `DISENO` (`anterior`/`nuevo` = `{"estatus": ...}`) |

**Permiso nuevo (solo rol `events`):** `events.schedule.design`, para subir brief, solicitar y retirar. Editar los campos sigue usando `events.schedule.update`; ver entregables usa `events.schedule.read`.

## 5. Migración 2: Drive y lado Design

Archivo propuesto: `supabase/migrations/202610180006_events_design_requests.sql`. Sigue a `202610180002_internal_design_requests.sql` casi línea por línea.

- Tabla `evento_drive_uploads` (modelo `pendiente_drive_uploads`): `RLS` activo, sin grants a `anon`/`authenticated`, todo a `service_role`.
- Design no recibe `events.schedule.read`, así que no puede leer `eventos` por RLS. `design.requests.read` habilita la experiencia global; los adaptadores limitan cada lectura y acción a los campos y permisos de su fuente. No crear permisos de pantalla `design.events.*`.
- Solo `service_role`: `sync_evento_drive_brief`, reservas de brief/entregables y `request_evento_to_design`.
- La carga de brief es opcional. Si se usa, admite hasta 10 archivos de 100 MB cada uno con los formatos actuales de brief. La solicitud no consulta ni exige un conteo de Drive. Las reservas deben contar cargas activas y completadas de forma atómica.
- `request_evento_to_design(p_evento_id, p_actor_id)` verifica: actor con rol `events` y `events.schedule.design`; evento no archivado y en `EN_PLANIFICACION` o `PROGRAMADO`; fecha del evento presente; `requiere_diseno`, uno o ambos formatos válidos, instrucciones no vacías y fecha de entrega válidos (hoy o posterior y no posterior al día del evento); sin solicitud previa. Marca `SOLICITADO`, guarda `diseno_solicitado_en`, sube `version` y escribe historial `DISENO`.
- `retract_evento_design_request(p_evento_id, p_version)`: solo `SOLICITADO`; vuelve a `diseno_estatus = null`, sube `version`, deja historial.
- Lado Design: las RPC/API de Eventos deben integrarse en el contrato común de solicitudes y las consultas únicas de Design definidas en §9. No se añaden permisos, rutas, cola ni ficha independientes para Eventos sin resolver primero esa arquitectura.
- Las acciones de Design **no incrementan `eventos.version`**: solo tocan columnas `diseno_*` que `update_event` no escribe, y así un cambio de Design no provoca `CONFLICTO_VERSION` a quien esté editando el evento. Sí quedan en `evento_historial`.
- La cola activa única excluye solicitudes canceladas/archivadas y conserva las entregadas/canceladas en el historial único.

## 6. Interfaz

### 6.1 Equipo de Eventos (`/events/calendar`)

- **Formulario de evento** (`EventForm`): sección **Diseño** al final con la casilla; al activarla aparecen Formatos (selector múltiple Digital/Impresión), Instrucciones obligatorias (textarea con contador) y Fecha en que debe estar listo (prellenada con día del evento − 2 si el evento ya tiene fecha). No permite solicitar hasta que el evento tenga fecha. Se desactiva todo si el evento ya tiene solicitud (con el aviso de retirar primero).
- **Calendario mes/semana:** las piezas con `requiere_diseno` llevan un icono pequeño; el tono cambia a ámbar si falta solicitar con entrega cercana y a rojo si está atrasada. Tooltip con el estado de diseño.
- **Ficha** (`EventDetail`): sección **Diseño** con estado, formatos, instrucciones, fecha de entrega, diseñador y botones **Subir brief** (opcional), **Solicitar a Design** y **Retirar solicitud**. Cuando está `ENTREGADO`, lista los entregables con enlace a Drive. El brief se sube desde la ficha después de guardar el evento.
- **Listado:** columna o chip «Diseño» y filtro opcional por estado de diseño (fase final).
- **Historial:** `DISENO` se renderiza como «Diseño solicitado / en diseño / entregado / retirado».

Para no crecer `ScheduleView.tsx` (261 líneas densas), el código nuevo va en archivos propios bajo `src/app/(dashboard)/events/design/` (`EventDesignFields.tsx`, `EventDesignPanel.tsx`) y `ScheduleView.tsx` solo recibe los cambios mínimos de conexión.

### 6.2 Design: una sola cola y ficha

No crear `/design/events` ni una entrada separada **Eventos** en el menú. Eventos debe aparecer en la vista única de solicitudes junto a Social Media e Interno, con los mismos estados, jerarquía visual, acciones y campos comunes. La ficha muestra el origen y un bloque compacto de contexto específico: tiendas y horario del evento; oculta presupuesto, patrocinadores, materiales, inscripción y cierre. El contrato técnico y la estrategia de adaptación de las fuentes quedan como puerta previa en §9.

## 7. Reglas de negocio

1. Solo se solicita con el evento fechado en `EN_PLANIFICACION` o `PROGRAMADO`; un evento terminado, cancelado o archivado no se solicita.
2. Con solicitud `SOLICITADO` se puede retirar; con `EN_DISENO` o `ENTREGADO` no.
3. Mientras haya solicitud, instrucciones, formato, fecha y casilla están bloqueados; para cambiarlos se retira primero.
4. Reprogramar el evento no modifica automáticamente la solicitud de Design ni su fecha de entrega. Si la fecha de entrega queda después del evento, se muestra una alerta a Eventos y se enciende `diseno_posterior_al_evento` para que el equipo decida.
5. Cancelar el evento cambia su solicitud de diseño activa a `CANCELADO`, la saca de la cola y la deja en historial; si ya estaba `EN_DISENO`, el diálogo de cancelación lo advierte. Si la ficha sigue abierta, la acción de entrega rechaza la solicitud cancelada con un error claro y no cambia su estado de diseño.
6. El brief es opcional y, cuando se carga, admite 10 archivos de hasta 100 MB cada uno (JPG, PNG, WebP, PDF, MP4). Los entregables aceptan los formatos/límites de `DRIVE_FILE_RULES` (`ENTREGABLES`); sus límites se mostrarán explícitamente en la UI.

## 8. Tandas de implementación

**P0 remoto** quedó conciliado manualmente: el historial remoto ahora contiene las 20 versiones locales; las tablas/columnas se contrastaron con el snapshot y se verificaron puntualmente la función corregida de inventario y los permisos de Eventos/Interno. La CLI no pudo ejecutar `db diff`; por eso, antes de T1 hay que verificar manualmente las firmas y permisos de `list_events` y `get_event`, que la migración nueva recreará. No ejecutar `db push` ni volver a reparar el historial por esta conciliación. **P1 contrato Design** queda definido en §9. Las migraciones nuevas se preparan localmente y no se aplican al remoto hasta que se indique.

**Pasos P0:** partir de una rama limpia y confirmar el `project-ref`; enlazar el proyecto correcto con `supabase link --project-ref <project-ref>`; consultar `supabase migration list --linked`; después ejecutar `supabase db diff --linked --schema public`. Revisar el SQL resultante, incluidas funciones, firmas, permisos y políticas; `docs/supabase-schema-public.md` y `.png` son referencias visuales/documentales, no sustituyen esta consulta. Si hay drift manual, `supabase db pull` genera una migración local para revisar y puede ofrecer registrar esa versión en el historial remoto; no aceptar sin revisar. Si falta solo un asiento de historial, `migration repair --status applied <version>` únicamente corrige el registro y no ejecuta SQL, así que requiere comprobar que el esquema coincide con esa migración. `db push` queda fuera de P0.

| Tanda | Contenido | Depende de |
|---|---|---|
| P0 | Historial conciliado manualmente; revisión del snapshot y verificaciones puntuales. Antes de T1, comprobar firmas y permisos de las RPC que se recrean | — |
| P1 | Contrato canónico, carga contextual y experiencia única de Design definidos (§9) | Completo |
| T0 | Cerrar mapeos y permisos de adaptadores; comprobar las firmas remotas afectadas y preparar verificaciones | P0, P1 |
| T1 | Migración 1 (columnas, reglas, funciones, historial `DISENO`, permiso) | T0 |
| T2 | Tipos y lógica pura: `src/lib/eventDesign.ts` + pruebas; ampliar `EventoRow`, `EventoDetalle`, `EventoHistorial` y `validateEventInput` | T1 |
| T3 | Formulario, marca en calendario, sección de diseño en la ficha (sin Drive) e historial `DISENO` | T2 |
| T4 | Migración 2 (Drive, solicitud/retiro, RPC y permisos de Design) | T1 |
| T5 | Lado Eventos con Drive: `actions/events/{drive,design}.ts`, `EventDesignPanel.tsx` | T3, T4 |
| T6 | Integrar Eventos en la cola/ficha/historial únicos de Design; migrar adaptadores existentes según el contrato de §9 | T4, T5, T0 |
| T7 | Verificación con cuentas reales y actualización de documentos | T1–T6 |

T3 entrega una versión usable sin Drive: Eventos ya puede registrar qué necesita; T5 y T6 habilitan el envío.

<details><summary>Prompt T1 para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-eventos-diseno.md (§3, §4, §8, §9). No empieces T1 hasta verificar manualmente que las firmas y permisos remotos de list_events y get_event coinciden con las definiciones existentes que se van a recrear. El historial ya se concilió manualmente y el contrato canónico está definido. Toma como modelo supabase/migrations/202610180001_internal_store_tasks.sql y 202610150001_events_schedule.sql.
Crea supabase/migrations/202610180005_events_design.sql con las columnas, CHECK, permiso events.schedule.design y los cambios a events_normalize, create_event, update_event, list_events, get_event, events_flags, transition_event_status, archive_event y al CHECK de evento_historial.tipo. list_events y get_event cambian su returns table: usa drop function y vuelve a crear con revoke/grant. No apliques la migración ni toques otros archivos. Al terminar, lista decisiones y lo que no pudiste verificar.
```
</details>

<details><summary>Prompt T2–T3 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§1, §6.1, §7, §9) y src/lib/events.ts, src/lib/internalTasks.ts.
Crea src/lib/eventDesign.ts con constantes y etiquetas (formatos múltiples, estados de diseño), validación (instrucciones obligatorias, al menos un formato, fecha ≤ día del evento, evento fechado) y fechas derivadas (sugerida = evento − 2, estimada = solicitud + 2), con su prueba. Amplía los tipos de src/types/modules/events.ts. Luego añade la sección Diseño al formulario y ficha de ScheduleView.tsx mediante archivos nuevos en src/app/(dashboard)/events/design/, el marcador en las vistas mes y semana, y el renderizado del historial DISENO. El brief es opcional. No crees pantallas separadas para Design ni alteres el contrato común acordado en P1. Toca los adaptadores/rutas comunes de Design solo según el alcance aprobado en P1.
```
</details>

<details><summary>Prompt T4 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§3, §5, §9) y supabase/migrations/202610180002_internal_design_requests.sql como modelo.
Crea supabase/migrations/202610180006_events_design_requests.sql con evento_drive_uploads, permiso de Eventos para solicitar/subir, las RPC solo service_role de Drive y solicitud, retract_evento_design_request y la integración con las RPC/adaptadores unificados de Design acordados en P1. La solicitud requiere evento fechado e instrucciones, pero no brief. Aplica límites atómicos de carga. No cambies eventos.version en acciones de Design. No crees design.events.* ni una cola de Eventos independiente si P1 define una autorización común. No apliques la migración.
```
</details>

<details><summary>Prompt T5–T6 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§6, §7, §9), src/app/actions/internal/{drive,design-work}.ts, src/app/(dashboard)/internal/pendientes/TaskBriefPanel.tsx y las vistas actuales de Design.
Adapta las acciones de Eventos para brief opcional, solicitud, retiro y entregables; integra Eventos en la cola/ficha/historial únicos de Design según P1. No dupliques pantallas/rutas para Eventos. La ficha usa campos comunes y un bloque de contexto de Evento; no expone presupuesto, patrocinadores, materiales, inscripción ni cierre. La entrega debe validar en servidor que el evento no esté cancelado y presentar un error claro si la ficha quedó abierta.
```
</details>

## 9. Contrato común y cola única de Design (P1 definido)

### 9.1 Objetivo

Design debe trabajar desde una única cola, una ficha con la misma jerarquía y un único historial para solicitudes de Social Media, Interno y Eventos. No debe navegar a una pantalla distinta según el rol que originó el pedido. La interfaz presenta siempre los datos comunes en el mismo lugar y distingue el origen con una etiqueta; los datos propios de cada módulo aparecen en un bloque contextual compacto.

### 9.2 Contrato canónico de solicitud

Design consumirá un solo DTO con campos comunes y una carga útil tipada por origen. La estructura es amplia, pero no una fila plana con decenas de columnas opcionales: los datos comunes siempre mantienen los mismos nombres y posición; los datos específicos se agrupan en secciones discriminadas por `source`. La UI de Design muestra u omite cada sección según el origen de la solicitud.

| Campo común | Tipo y regla |
|---|---|
| `request_id`, `source`, `source_record_id` | Identidad de la solicitud; `source` es `SOCIAL_MEDIA`, `INTERNAL` o `EVENTS` |
| `title`, `requested_by`, `requested_at` | Título y trazabilidad de origen |
| `instructions` | Texto obligatorio en toda solicitud enviada a Design |
| `target_date` | Fecha objetivo de entrega de Design para ordenar y mostrar urgencia; cada adaptador la deriva o captura según el flujo fuente |
| `requested_outputs[]` | Una o varias salidas solicitadas; cada elemento conserva un `category`, el formato específico del origen y una especificación opcional |
| `brief_files[]` | Lista uniforme de archivos/referencias; puede estar vacía en el DTO |
| `design_status`, `designer_id`, `started_at`, `delivered_at` | Estado normalizado (`REQUESTED`, `IN_PROGRESS`, `NEEDS_CHANGES`, `DELIVERED`, `CANCELLED`) y trazabilidad de Design |
| `delivery_files[]` | Archivos entregados por Design: nombre, MIME/tipo, tamaño y enlace autorizado |
| `source_context` | Unión discriminada con datos mínimos y pertinentes del origen |

`requested_outputs` debe preservar vocabularios distintos sin colisiones: Social Media expresa `POST`, `REEL`, `CAROUSEL` o `STORY`; Interno expresa sus salidas aplicables, como `PRINT`, `DIGITAL` o `OTHER`; Eventos expresa `DIGITAL`, `PRINT` o ambos en elementos separados. Cada elemento conserva `source_format_code` y una etiqueta legible; el adaptador no obliga a un origen a adoptar el catálogo de otro.

El estado común describe únicamente el ciclo de trabajo de Design, no el ciclo completo del registro fuente. Por ejemplo, la revisión y aprobación editorial posterior de Social Media no hace que la solicitud vuelva a `IN_PROGRESS`; se mantiene `DELIVERED`. Cada adaptador mapea sus estados propios y declara qué acciones se permiten en cada estado común.

`source_context` contiene únicamente los campos necesarios para producir la pieza. Social Media puede incluir formato/plataforma, copy y datos editoriales pertinentes; Interno, tipo de pendiente, tienda y cantidad; Eventos, nombre del evento, tiendas, fecha y horario. No incluye datos del evento que Design no necesita, como presupuesto, patrocinadores, materiales, inscripción o cierre.

Los archivos de brief pueden estar ausentes en el contrato común. Eso no elimina las reglas de cada origen: Social Media e Interno conservan sus validaciones actuales mientras no se cambien explícitamente; para Eventos el brief es opcional. Las instrucciones sí son obligatorias antes de enviar cualquier solicitud a Design.

### 9.3 Experiencia única y estrategia de integración

Design tendrá una sola cola activa, una sola ficha, un solo historial, filtros compartidos por origen/estado y un indicador visible del origen. La jerarquía y ubicación de los campos comunes no cambian según el origen. La ficha incluye secciones contextuales condicionales y solo habilita acciones válidas para esa fuente y estado.

La unificación es de contrato y experiencia. En la primera entrega se conservan las tablas y estados de negocio existentes y se introducen adaptadores de lectura/acción que transforman cada modelo fuente al DTO canónico. La capa de servidor reúne las fuentes y despacha iniciar, subir, entregar, cancelar o solicitar correcciones al adaptador correspondiente; cada adaptador mantiene sus permisos, validaciones, reglas de brief, historial y transiciones. El estado editorial de Social Media no se reemplaza: solo se proyecta a `design_status` para el trabajo de Design.

La cola global usa `design.requests.read`. Los adaptadores verifican en el servidor cada acción contra el permiso y las reglas vigentes de su origen; el DTO combinado no concede lectura directa de las tablas fuente ni expone campos no autorizados. El adaptador de Eventos no requiere `events.schedule.read` para Design. La entrega de Eventos vuelve a comprobar que el evento no esté cancelado, aunque la ficha siga abierta.

La opción de migrar más adelante a una tabla física `design_requests` común permanece abierta, pero no es requisito de esta entrega. Primero se integran los adaptadores sobre las fuentes actuales para evitar migrar simultáneamente los ciclos editoriales de Social Media e Interno.

### 9.4 Trabajo de implementación derivado de P1

1. Inventariar y mapear los campos actuales de Social Media e Interno, incluyendo permisos, estados, correcciones, cancelaciones, briefs y condiciones de entrega.
2. Definir tipos discriminados y adaptadores para `SOCIAL_MEDIA`, `INTERNAL` y `EVENTS`; comprobar que cada adaptador produce todos los campos comunes y no rellena campos contextuales irrelevantes.
3. Reunir las tres fuentes en una cola e historial únicos y reemplazar las rutas/vistas paralelas de Design por una ficha común.
4. Añadir pruebas de contrato y permisos para cada origen, incluidos estados terminales, solicitud cancelada mientras la ficha está abierta y formatos múltiples.

La definición del contrato cierra la decisión de producto P1. Los detalles de mapeo y autorización se concretan en T0 al implementar los adaptadores; no deben reabrir la decisión de que Design tenga una experiencia única.

### 9.5 Decisiones de Eventos confirmadas

| Tema | Decisión |
|---|---|
| Formatos | Un evento admite Digital, Impresión o ambos en una misma solicitud |
| Instrucciones | Obligatorias cuando el evento requiere diseño |
| Brief | Opcional para Eventos; si se carga, hasta 10 archivos de 100 MB cada uno |
| Fecha | El evento debe tener fecha para solicitar; entrega hoy o posterior y no después del día del evento |
| Reprogramación | No altera la solicitud ni su fecha de entrega automáticamente; alerta si la entrega queda después del evento |
| Cancelación con ficha abierta | La solicitud sale de la cola activa; al intentar entregar, el servidor rechaza con mensaje de cancelación |
| Visibilidad | Estado visible para Eventos y Design; Design solo recibe campos de trabajo y contexto mínimo |
| Versión | Acciones de Design no incrementan `eventos.version`; cambios quedan en historial |
| Indicador | «Diseño sin solicitar» se activa dentro de los 3 días previos a la fecha de entrega |

## 10. Riesgos

- **Esquema remoto sin conciliar:** recrear `list_events` y `get_event` sobre un remoto distinto del repositorio puede romper el calendario; por eso T0 va primero.
- **`ScheduleView.tsx` concentrado:** cualquier cambio directo en ese archivo es difícil de revisar; el plan lo evita con componentes nuevos.
- **Estados automáticos:** un evento que pasa a `TERMINADO` con diseño sin entregar debe seguir visible para Design hasta que lo entregue o se cancele; conviene probarlo.
- **Cuentas:** hace falta una cuenta `events` y una `design` reales para la verificación de T7.
