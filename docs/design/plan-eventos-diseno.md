# Plan: solicitud de diseño desde la programación de eventos

**Estado (2026-10-18):** plan, sin código ni migración. Extiende [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) y replica lo que ya funciona en Social Media ([`modales-publicacion.md`](./modales-publicacion.md), [`plan-rol-design.md`](./plan-rol-design.md)) e Interno ([`plan-rol-interno.md`](./plan-rol-interno.md), [`implementacion-rol-interno.md`](./implementacion-rol-interno.md)).

## 1. Resultado esperado

Cada evento del calendario puede marcar **Requiere diseño** y, en ese caso, capturar:

| Campo | Regla |
|---|---|
| Requiere diseño | casilla; apagada por defecto |
| Formato | `Digital` o `Impresión` (obligatorio si requiere diseño) |
| Instrucciones | texto libre, obligatorio si requiere diseño, hasta 4000 caracteres (igual que Interno) |
| Fecha en que debe estar listo | fecha (día), obligatoria si requiere diseño; hoy o posterior y no posterior al día del evento |

Desde la ficha del evento el equipo de Eventos sube el brief a Drive, **solicita** a Design, puede **retirar** la solicitud mientras nadie la haya tomado y ve los entregables cuando Design entrega. Design tiene una cola propia de eventos (por tomar y en diseño) y un historial, igual que con Interno y Social Media.

Fuera de alcance por ahora: cantidad, medidas como campos separados (van en las instrucciones), varias piezas por evento, ciclo de correcciones, aprobación por Gerencia.

## 2. Qué se copia y de dónde

| Pieza | Modelo existente | En Eventos |
|---|---|---|
| Columnas de diseño y Drive en la tabla | `pendientes_tienda` (`202610180001/2`) | mismas columnas en `eventos` + `diseno_formato` |
| Estados de diseño | `SOLICITADO → EN_DISENO → ENTREGADO` (Interno) | idénticos; sin ciclo de corrección |
| Carga de brief y entregables | `actions/internal/drive.ts`, `design-work.ts`, `TaskBriefPanel.tsx` | duplicar y adaptar a `eventos`, sin tocar los originales (criterio D21 del plan de Interno) |
| Cola, ficha e historial de Design | `design/internal/*` | `design/events/*` |
| Permisos de Design | `design.internal.{read,start,upload,deliver}` | `design.events.{read,start,upload,deliver}` |
| Helpers | `src/lib/googleDrive.ts`, `driveFileRules.ts`, `designSla.ts` | se reutilizan tal cual |

## 3. Diferencias con Interno que hay que respetar

1. **El estado del evento no cambia al solicitar.** En Interno, solicitar pasa el pendiente a `EN_PROCESO`. Aquí `eventos.estatus` lo mueve la hora (`sync_event_statuses`) y las acciones del equipo; el diseño tiene su propio `diseno_estatus`.
2. **Sin dueño único.** Hay 3 usuarios de Eventos y el inventario y los eventos son compartidos. Interno exige `creado_por = auth.uid()`; aquí cualquier usuario con el permiso nuevo puede subir brief, solicitar o retirar en cualquier evento.
3. **La fecha de entrega la escribe la persona.** En Interno se deriva de la fecha requerida (−2 días). Aquí se captura; el formulario puede **sugerir** «día del evento − 2» editable, y la estimación de Design (solicitud + 2 días calendario) se calcula igual que hoy.
4. **Design no ve datos del evento ajenos al trabajo:** presupuesto, patrocinadores, materiales, inscripción ni cierre (decisiones D6/D7). Ve nombre, tiendas, fecha y hora, formato, instrucciones, fecha de entrega y brief.
5. **Las RPC de lectura cambian de forma.** `list_events` y `get_event` devuelven `returns table(...)`; `create or replace` no puede cambiar columnas, así que hay que `drop function` y recrearlas con sus `revoke/grant`.
6. **El historial tiene un CHECK.** `evento_historial.tipo` solo admite `ESTATUS` y `REPROGRAMACION`; hay que ampliarlo con `DISENO`. `EventDetail` en `ScheduleView.tsx` hoy muestra «Evento reprogramado» para todo lo que no sea `ESTATUS`, así que sin ajustar la vista las filas de diseño se verían mal.

## 4. Modelo de datos (migración 1)

Archivo propuesto: `supabase/migrations/202610180005_events_design.sql`. Solo columnas, reglas y funciones que no dependen de Drive.

**Columnas nuevas en `eventos`**

- `requiere_diseno boolean not null default false`
- `diseno_formato text check (diseno_formato in ('DIGITAL','IMPRESION'))`
- `instrucciones_diseno text check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000)`
- `fecha_entrega_diseno date`
- `diseno_estatus text check (diseno_estatus in ('SOLICITADO','EN_DISENO','ENTREGADO'))`
- `diseno_solicitado_en`, `diseno_iniciado_en`, `diseno_entregado_en` (`timestamptz`)
- `disenador_id uuid references auth.users(id) on delete set null`
- `drive_folder_id`, `drive_folder_url`, `drive_brief_folder_id`, `drive_deliverables_folder_id`, `drive_brief_file_count integer not null default 0`, `drive_brief_checked_at timestamptz`

**CHECK de coherencia:** si `diseno_estatus` no es nulo, entonces `requiere_diseno`, `diseno_formato`, `fecha_entrega_diseno` e instrucciones no vacías deben estar presentes. Las columnas `drive_*` y `diseno_*` de ciclo de vida no las escribe `update_event`; solo las funciones de Drive/Design.

**Cambios en funciones existentes**

| Función | Cambio |
|---|---|
| `events_normalize` | acepta y valida los 4 campos de captura (formato y fecha solo si `requiere_diseno`; los pone en `null` si no) |
| `create_event` / `update_event` | persisten los 4 campos. En `update_event`, si `diseno_estatus` no es nulo y cambia alguno de los 4 campos, error «Retira la solicitud de diseño para cambiar estos datos» |
| `list_events` | devuelve `requiere_diseno`, `diseno_formato`, `fecha_entrega_diseno`, `diseno_estatus` (para marcar el calendario) |
| `get_event` | además `instrucciones_diseno`, `drive_brief_file_count`, `diseno_*_en` y `disenador_nombre` |
| `events_flags` | indicadores nuevos `diseno_sin_solicitar` (requiere diseño, sin solicitar y entrega en ≤ 3 días), `diseno_atrasado` (pasó la fecha de entrega sin `ENTREGADO`) y `diseno_posterior_al_evento` |
| `transition_event_status` | cancelar con diseño `SOLICITADO` o `EN_DISENO` sigue exigiendo motivo y lo registra en el historial de diseño |
| `archive_event` | no archiva mientras `diseno_estatus` sea `SOLICITADO` o `EN_DISENO` |
| `evento_historial` | CHECK `tipo` ampliado con `DISENO` (`anterior`/`nuevo` = `{"estatus": ...}`) |

**Permiso nuevo (solo rol `events`):** `events.schedule.design`, para subir brief, solicitar y retirar. Editar los campos sigue usando `events.schedule.update`; ver entregables usa `events.schedule.read`.

## 5. Migración 2: Drive y lado Design

Archivo propuesto: `supabase/migrations/202610180006_events_design_requests.sql`. Sigue a `202610180002_internal_design_requests.sql` casi línea por línea.

- Tabla `evento_drive_uploads` (modelo `pendiente_drive_uploads`): `RLS` activo, sin grants a `anon`/`authenticated`, todo a `service_role`.
- Permisos `design.events.{read,start,upload,deliver}` solo para `design`. **Design no recibe `events.schedule.read`**, así que no puede leer `eventos` por RLS.
- Solo `service_role`: `sync_evento_drive_brief`, `reserve_evento_brief_upload`, `reserve_evento_deliverable_upload`, `request_evento_to_design`.
- `request_evento_to_design(p_evento_id, p_actor_id)` verifica: actor con rol `events` y `events.schedule.design`; evento no archivado y en `EN_PLANIFICACION` o `PROGRAMADO`; `requiere_diseno`, formato, instrucciones y fecha de entrega válidos (hoy o posterior y ≤ día del evento si ya tiene fecha); sin solicitud previa; brief con ≥ 1 archivo verificado hace menos de 5 minutos. Marca `SOLICITADO`, guarda `diseno_solicitado_en`, sube `version` y escribe historial `DISENO`.
- `retract_evento_design_request(p_evento_id, p_version)`: solo `SOLICITADO`; vuelve a `diseno_estatus = null`, sube `version`, deja historial.
- Lado Design (devuelven solo los campos del punto 4 de §3): `get_design_event_queue`, `get_design_event_request`, `get_design_event_history`, `design_start_event_request`, `design_deliver_event_request`, `get_event_designer_names`.
- Las acciones de Design **no incrementan `eventos.version`**: solo tocan columnas `diseno_*` que `update_event` no escribe, y así un cambio de Design no provoca `CONFLICTO_VERSION` a quien esté editando el evento. Sí quedan en `evento_historial`.
- La cola de Design excluye eventos cancelados y archivados; el historial incluye entregados y cancelados con diseño previo.

## 6. Interfaz

### 6.1 Equipo de Eventos (`/events/calendar`)

- **Formulario de evento** (`EventForm`): sección **Diseño** al final con la casilla; al activarla aparecen Formato (selector Digital/Impresión), Instrucciones (textarea con contador) y Fecha en que debe estar listo (prellenada con día del evento − 2 si el evento ya tiene fecha). Se desactiva todo si el evento ya tiene solicitud (con el aviso de retirar primero).
- **Calendario mes/semana:** las piezas con `requiere_diseno` llevan un icono pequeño; el tono cambia a ámbar si falta solicitar con entrega cercana y a rojo si está atrasada. Tooltip con el estado de diseño.
- **Ficha** (`EventDetail`): sección **Diseño** con estado, formato, instrucciones, fecha de entrega, diseñador y botones **Subir brief**, **Solicitar a Design** y **Retirar solicitud**. Cuando está `ENTREGADO`, lista los entregables con enlace a Drive. El brief se sube desde la ficha después de guardar el evento, igual que en Interno.
- **Listado:** columna o chip «Diseño» y filtro opcional por estado de diseño (fase final).
- **Historial:** `DISENO` se renderiza como «Diseño solicitado / en diseño / entregado / retirado».

Para no crecer `ScheduleView.tsx` (261 líneas densas), el código nuevo va en archivos propios bajo `src/app/(dashboard)/events/design/` (`EventDesignFields.tsx`, `EventDesignPanel.tsx`) y `ScheduleView.tsx` solo recibe los cambios mínimos de conexión.

### 6.2 Design (`/design/events`)

Copia de `design/internal/*`: `page.tsx` (cola por tomar / en diseño), `[id]/{page,detail}.tsx`, `history/page.tsx`. Ficha con instrucciones y brief arriba, fechas en el medio (evento, solicitud, entrega) y formato visible. Ítem **Eventos** en `design/shell.tsx` con `design.events.read` y la bandera `canReadEvents` en `design/layout.tsx`.

## 7. Reglas de negocio

1. Solo se solicita con el evento en `EN_PLANIFICACION` o `PROGRAMADO`; un evento terminado, cancelado o archivado no se solicita.
2. Con solicitud `SOLICITADO` se puede retirar; con `EN_DISENO` o `ENTREGADO` no.
3. Mientras haya solicitud, instrucciones, formato, fecha y casilla están bloqueados; para cambiarlos se retira primero.
4. Si el evento se reprograma o se arrastra a un día anterior a la fecha de entrega, no se cambia la entrega automáticamente: se enciende `diseno_posterior_al_evento` y el equipo decide.
5. Cancelar el evento saca la solicitud de la cola de Design y la deja en su historial; si ya estaba `EN_DISENO`, el diálogo de cancelación lo advierte.
6. Los entregables aceptan los formatos de `DRIVE_FILE_RULES` (`ENTREGABLES`); el brief admite 10 archivos de 100 MB (JPG, PNG, WebP, PDF, MP4), como Interno.

## 8. Tandas de implementación

Cada tanda termina con `npm run lint`, `npx tsc --noEmit`, `npm test` y, si toca interfaz, revisión visual. Las migraciones se preparan en el repositorio y **no se aplican** hasta que se ordene. Antes de aplicarlas hay que conciliar con el remoto (`supabase db pull`): `202610150001` está reportada como aplicada pero el esquema remoto no está conciliado, y la migración 1 recrea `list_events` y `get_event`.

| Tanda | Contenido | Depende de |
|---|---|---|
| T0 | Conciliar el esquema remoto de eventos; decidir D15–D20 | — |
| T1 | Migración 1 (columnas, reglas, funciones, historial `DISENO`, permiso) | T0 |
| T2 | Tipos y lógica pura: `src/lib/eventDesign.ts` + pruebas; ampliar `EventoRow`, `EventoDetalle`, `EventoHistorial` y `validateEventInput` | T1 |
| T3 | Formulario, marca en calendario, sección de diseño en la ficha (sin Drive) e historial `DISENO` | T2 |
| T4 | Migración 2 (Drive, solicitud/retiro, RPC y permisos de Design) | T1 |
| T5 | Lado Eventos con Drive: `actions/events/{drive,design}.ts`, `EventDesignPanel.tsx` | T3, T4 |
| T6 | Lado Design: `/design/events`, acciones de trabajo, menú | T4, T5 |
| T7 | Verificación con cuentas reales y actualización de documentos | T1–T6 |

T3 entrega una versión usable sin Drive: Eventos ya puede registrar qué necesita; T5 y T6 habilitan el envío.

<details><summary>Prompt T1 para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-eventos-diseno.md (§3, §4). Toma como modelo supabase/migrations/202610180001_internal_store_tasks.sql y 202610150001_events_schedule.sql.
Crea supabase/migrations/202610180005_events_design.sql con las columnas, CHECK, permiso events.schedule.design y los cambios a events_normalize, create_event, update_event, list_events, get_event, events_flags, transition_event_status, archive_event y al CHECK de evento_historial.tipo. list_events y get_event cambian su returns table: usa drop function y vuelve a crear con revoke/grant. No apliques la migración ni toques otros archivos. Al terminar, lista decisiones y lo que no pudiste verificar.
```
</details>

<details><summary>Prompt T2–T3 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§1, §6.1, §7) y src/lib/events.ts, src/lib/internalTasks.ts.
Crea src/lib/eventDesign.ts con constantes y etiquetas (formato, estados de diseño), validación (instrucciones, formato, fecha ≤ día del evento) y fechas derivadas (sugerida = evento − 2, estimada = solicitud + 2), con su prueba. Amplía los tipos de src/types/modules/events.ts. Luego añade la sección Diseño al formulario y a la ficha de ScheduleView.tsx mediante archivos nuevos en src/app/(dashboard)/events/design/, el marcador en las vistas mes y semana, y el renderizado del historial DISENO. No toques publicaciones, Interno ni Design.
```
</details>

<details><summary>Prompt T4 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§3, §5) y supabase/migrations/202610180002_internal_design_requests.sql como modelo.
Crea supabase/migrations/202610180006_events_design_requests.sql con evento_drive_uploads, los permisos design.events.*, las RPC solo service_role de Drive y solicitud, retract_evento_design_request y las RPC del lado Design, sin cambiar eventos.version en las acciones de Design. No apliques la migración.
```
</details>

<details><summary>Prompt T5–T6 para Kilo Code</summary>

```
Lee docs/design/plan-eventos-diseno.md (§6, §7), src/app/actions/internal/{drive,design-work}.ts, src/app/(dashboard)/internal/pendientes/TaskBriefPanel.tsx y src/app/(dashboard)/design/internal/*.
Duplica y adapta, sin modificar los originales: acciones events/drive.ts y events/design.ts, EventDesignPanel.tsx (brief, solicitar, retirar, entregables) y las rutas /design/events (cola, ficha, historial) con su ítem de menú design.events.read. Design no debe ver presupuesto, patrocinadores ni materiales.
```
</details>

## 9. Decisiones pendientes

| # | Pregunta | Propuesta |
|---|---|---|
| D15 | ¿Un evento puede necesitar pieza **digital e impresa**? | Una sola solicitud con un formato por evento; si hace falta ambas, se amplía a `AMBOS` o se admiten varias solicitudes en una fase posterior |
| D16 | ¿El brief es obligatorio para solicitar? | Sí, como en Interno y Social Media (≥ 1 archivo verificado hace < 5 min) |
| D17 | ¿Las acciones de Design suben `eventos.version`? | No (evita conflictos de edición); quedan en el historial |
| D18 | ¿Design ve la descripción del evento? | No; las instrucciones son el brief. Se reconsidera con feedback |
| D19 | ¿Quién ve el estado de diseño? | Solo `events` y `design`; Gerencia no, igual que el resto de la programación (D6/D7) |
| D20 | Umbral del indicador «Diseño sin solicitar» | 3 días antes de la fecha de entrega (como el umbral de materiales, D13) |

## 10. Riesgos

- **Esquema remoto sin conciliar:** recrear `list_events` y `get_event` sobre un remoto distinto del repositorio puede romper el calendario; por eso T0 va primero.
- **`ScheduleView.tsx` concentrado:** cualquier cambio directo en ese archivo es difícil de revisar; el plan lo evita con componentes nuevos.
- **Estados automáticos:** un evento que pasa a `TERMINADO` con diseño sin entregar debe seguir visible para Design hasta que lo entregue o se cancele; conviene probarlo.
- **Cuentas:** hace falta una cuenta `events` y una `design` reales para la verificación de T7.
