# Plan: solicitud de diseño desde la programación de eventos

**Estado (2026-10-18):** plan, sin código ni migración. Extiende [`plan-eventos-programacion.md`](./plan-eventos-programacion.md). Antes de implementar depende de (1) conciliar el esquema real de Supabase con las migraciones locales y (2) definir el contrato común de solicitud y la cola única de Design para Social Media, Interno y Eventos. Ver §8 y §9. Las referencias de Social Media ([`modales-publicacion.md`](./modales-publicacion.md), [`plan-rol-design.md`](./plan-rol-design.md)) e Interno ([`plan-rol-interno.md`](./plan-rol-interno.md), [`implementacion-rol-interno.md`](./implementacion-rol-interno.md)) son flujos existentes, no el objetivo de conservar pantallas separadas.

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
| Solicitud de diseño | Contrato común pendiente de definir (§9) | Debe usar el mismo contrato y cola que Social Media e Interno; el origen y contexto de Evento se muestran como datos de contexto |
| Formatos | Preferencias propias de cada flujo | Eventos admite Digital, Impresión o ambos; mapear al campo común acordado en §9 |
| Estados de diseño | Diferentes por módulo actualmente | Normalizar a estados comunes en la cola; preservar el flujo editorial de Social Media en su módulo |
| Carga de brief y entregables | `actions/internal/drive.ts`, `design-work.ts`, `TaskBriefPanel.tsx` | adaptar el origen Eventos al contrato y componentes comunes; mantener las reglas propias por fuente y evitar una pantalla paralela |
| Cola, ficha e historial de Design | `design/publications/*` y `design/internal/*` hoy están separados | Incorporar Eventos a una cola/ficha/historial únicos según el contrato común; no crear `design/events/*` como experiencia paralela |
| Permisos de Design | Hoy separados por fuente | Definir en P1 el permiso común para la cola y acciones de Design; Eventos no debe requerir `events.schedule.read` |
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
- Design no recibe `events.schedule.read`, así que no puede leer `eventos` por RLS. El permiso común de cola/acciones y los límites de autorización por fuente se definen en P1; no crear permisos de pantalla `design.events.*` sin justificarlo en ese contrato.
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

Antes de las tandas de implementación hay dos puertas: **P0 remoto**, verificar el estado con `supabase migration list --linked` y `supabase db diff --linked --schema public`, revisar/conciliar el diff y actualizar el snapshot; **P1 contrato Design**, acordar el DTO de solicitud y el diseño de cola única descritos en §9. No ejecutar `db push` ni `migration repair` hasta comprobar el resultado. `202610150001` está reportada como aplicada pero el esquema remoto no se ha verificado, y la migración de Eventos recrearía `list_events` y `get_event`. Las migraciones nuevas se preparan localmente y no se aplican al remoto hasta que se indique.

**Pasos P0:** partir de una rama limpia y confirmar el `project-ref`; enlazar el proyecto correcto con `supabase link --project-ref <project-ref>`; consultar `supabase migration list --linked`; después ejecutar `supabase db diff --linked --schema public`. Revisar el SQL resultante, incluidas funciones, firmas, permisos y políticas; `docs/supabase-schema-public.md` y `.png` son referencias visuales/documentales, no sustituyen esta consulta. Si hay drift manual, `supabase db pull` genera una migración local para revisar y puede ofrecer registrar esa versión en el historial remoto; no aceptar sin revisar. Si falta solo un asiento de historial, `migration repair --status applied <version>` únicamente corrige el registro y no ejecuta SQL, así que requiere comprobar que el esquema coincide con esa migración. `db push` queda fuera de P0.

| Tanda | Contenido | Depende de |
|---|---|---|
| P0 | Conciliar historial y esquema Supabase; validar funciones, grants, policies y constraints | — |
| P1 | Definir contrato canónico y cola única de Design para Social Media, Interno y Eventos (§9) | — (puede avanzar en paralelo con P0) |
| T0 | Cerrar el diseño técnico de Eventos sobre el contrato acordado y preparar verificaciones | P0, P1 |
| T1 | Migración 1 (columnas, reglas, funciones, historial `DISENO`, permiso) | T0 |
| T2 | Tipos y lógica pura: `src/lib/eventDesign.ts` + pruebas; ampliar `EventoRow`, `EventoDetalle`, `EventoHistorial` y `validateEventInput` | T1 |
| T3 | Formulario, marca en calendario, sección de diseño en la ficha (sin Drive) e historial `DISENO` | T2 |
| T4 | Migración 2 (Drive, solicitud/retiro, RPC y permisos de Design) | T1 |
| T5 | Lado Eventos con Drive: `actions/events/{drive,design}.ts`, `EventDesignPanel.tsx` | T3, T4 |
| T6 | Integrar Eventos en la cola/ficha/historial únicos de Design; migrar adaptadores existentes según el alcance acordado | T4, T5, P1 |
| T7 | Verificación con cuentas reales y actualización de documentos | T1–T6 |

T3 entrega una versión usable sin Drive: Eventos ya puede registrar qué necesita; T5 y T6 habilitan el envío.

<details><summary>Prompt T1 para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-eventos-diseno.md (§3, §4, §9). No empieces T1 hasta completar P0/P1 y documentar el resultado del diff remoto y el contrato canónico. Toma como modelo supabase/migrations/202610180001_internal_store_tasks.sql y 202610150001_events_schedule.sql.
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

## 9. Contrato común y cola única de Design (puerta P1)

### 9.1 Objetivo

Design debe trabajar desde una única cola, una ficha con la misma jerarquía y un único historial para solicitudes de Social Media, Interno y Eventos. No debe navegar a una pantalla distinta según el rol que originó el pedido. La interfaz presenta siempre los datos comunes en el mismo lugar y distingue el origen con una etiqueta; los datos propios de cada módulo aparecen en un bloque contextual compacto.

### 9.2 Contrato de solicitud propuesto

Antes de T1, inventariar los campos y transiciones actuales de Social Media e Interno y acordar un DTO canónico. Propuesta mínima:

| Campo común | Uso |
|---|---|
| `request_id`, `source`, `source_record_id` | Identidad de la solicitud, origen (`SOCIAL_MEDIA`, `INTERNAL`, `EVENTS`) y registro de origen |
| `title`, `requested_by`, `requested_at` | Identificación y trazabilidad de quien solicitó |
| `instructions` | Brief textual obligatorio en toda solicitud |
| `due_date` | Fecha límite común para ordenar y mostrar urgencia |
| `deliverable_spec` | Lista de formatos/salidas solicitadas; cada origen puede aportar valores propios sin perder el mismo tipo de estructura |
| `brief_files` | Lista uniforme de referencias/archivos; puede estar vacía. La obligatoriedad de archivos se mantiene según la regla confirmada para cada flujo hasta decidir una política global |
| `design_status`, `designer_id`, `started_at`, `delivered_at` | Estado y trazabilidad del trabajo de Design, normalizados para la cola; incluye cancelación |
| `deliverables` | Entregables de Design con nombre, tipo, tamaño y enlace |
| `source_context` | Datos adicionales mínimos para el trabajo: copy/canales, tipo/tienda de Interno o tiendas/horario de Evento |

Los campos comunes mantienen nombre, tipo y ubicación visual iguales. `deliverable_spec` y `source_context` permiten diferencias reales entre los encargos sin crear tres fichas distintas. En Eventos, `deliverable_spec` contiene Digital, Impresión o ambas; sus instrucciones son obligatorias y `brief_files` es opcional.

### 9.3 Estrategia recomendada: fachada canónica y adaptadores

Para la primera entrega, conservar las tablas y flujos fuente existentes y crear adaptadores de lectura/acción que produzcan el DTO común. Una RPC o capa de servidor de Design reúne las tres fuentes en la misma cola; una ficha común despacha iniciar, subir y entregar al adaptador del origen, que conserva sus validaciones y permisos. El estado editorial propio de Social Media no se reemplaza: se mapea al estado de Design que corresponda. Se evita migrar de golpe publicaciones y pendientes a una tabla nueva.

Antes de desarrollar, completar estas acciones en P1:

1. Comparar campos, permisos, transiciones, cancelación, correcciones y reglas de entrega de Social Media e Interno.
2. Confirmar el DTO, especialmente la semántica común de fecha límite, `design_status`, archivos de brief y formatos.
3. Acordar cómo se autorizan acciones en la cola global sin ampliar la lectura de tablas fuente ni filtrar datos del evento.
4. Diseñar una sola cola con filtros por origen/estado, una sola ficha y un historial global; conservar bloques contextuales y acciones permitidas por origen.
5. Añadir pruebas de contrato para que cada adaptador devuelva los mismos campos comunes y para que iniciar/entregar mantenga las reglas específicas del origen.

La opción de migrar en una fase posterior a una tabla física `design_requests` común queda abierta. Solo conviene hacerlo si se decide que una fachada con adaptadores no basta para administrar estados y auditoría. Sería una migración transversal de Social Media e Interno y no es requisito para que Design reciba todos los pedidos en una experiencia unificada.

### 9.4 Decisiones de Eventos confirmadas

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
