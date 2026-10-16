# Perfil Eventos: programación y planificación de eventos

**Estado (2026-10-15):** cliente, acciones de servidor y migración están implementados. El usuario reportó haber aplicado `supabase/migrations/202610150001_events_schedule.sql` en Supabase; el repositorio no tiene conexión para verificar el esquema remoto ni sus grants. `pnpm run build` finaliza correctamente. Es el segundo módulo del perfil `events`, junto al [inventario](./plan-inventario-eventos.md). Materiales y patrocinadores son texto libre, la moneda es USD y se usan los umbrales aceptados; el alcance podrá ampliarse con observaciones de las personas usuarias.
**Alcance:** rol `events`, calendario en `/events/calendar` con sub vistas `/events/calendar/list` y `/events/calendar/archive`; inventario se mantiene como módulo separado en `/events/inventory`.
**Diseño de UI:** lienzo de diseño "Eventos · Programación", copiado en [`prototypes/events-schedule/`](./prototypes/events-schedule) (ver §9); implementación local alineada a las pantallas y flujos.
**Documentos relacionados:** [`plan-inventario-eventos.md`](./plan-inventario-eventos.md), [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`supabase-db-migration.md`](../supabase-db-migration.md).

## 1. Resultado esperado

1. Eventos planifica cada evento con fecha, hora, duración, **una o varias tiendas**, presupuesto, materiales y demás datos de la §3, y lo hace avanzar por **En planificación → Programado → En curso → Terminado**. Los dos últimos pasos ocurren solos según la hora.
2. Ve todos sus eventos en un **calendario** (mensual y semanal) y en un **listado** filtrable. El calendario es la orientación gráfica; el listado sirve para buscar y filtrar.
3. Cada cambio de estado hecho por una persona y cada reprogramación guardan usuario, fecha y motivo cuando aplica; los cambios automáticos quedan marcados como "Sistema".
4. Después del evento registra asistencia, gasto real y notas, para que el siguiente se planifique con datos.
5. Materiales y patrocinadores se escriben como texto libre en el formulario del evento; no tienen tablas de listas propias en esta entrega.
6. Vive dentro del perfil `events`: misma sesión y reglas de acceso. El menú lateral muestra Calendario e Inventario según los permisos; listado y archivo son sub vistas enlazadas desde Calendario.

## 2. Punto de partida

### 2.1 Pedido y decisiones del equipo

| Tema | Detalle | Fecha |
|---|---|---|
| Datos del evento | Fecha, hora, duración, tienda, presupuesto, material necesario "etc." | 2026-10-14 |
| Clasificación | Con patrocinio o sin él; degustación, impulso u otro; propio de Kromi o de un proveedor; con inscripción o sin ella. | 2026-10-14 |
| Estados | En planificación, Programado, En curso, Terminado. | 2026-10-14 |
| Calendario | Orientación gráfica de los eventos; diseño parecido al de social-media, con diferencias propias del rol. | 2026-10-14 |
| **Varias tiendas** | **Un evento puede ocurrir en varias tiendas a la vez.** | 2026-10-15 |
| **Estados automáticos** | **"En curso" y "Terminado" se marcan solos por la hora.** | 2026-10-15 |
| **Visibilidad** | **Por ahora solo el rol `events` ve y gestiona los eventos.** | 2026-10-15 |
| **Integración** | **Es un aspecto más del perfil `events`, como el inventario: mismo rol, mismo shell y misma documentación de perfil.** | 2026-10-15 |
| **Alcance** | **Plan e implementación básica; escalará según observaciones de usuarios finales.** | 2026-10-15 |

### 2.2 Qué se reutiliza de social-media (verificado en el repo)

| Patrón | Dónde está hoy | Adaptación para Eventos |
|---|---|---|
| Calendario mensual con celdas por día, "hoy" resaltado y alta rápida por día | `social-media/grid/components/GridCalendar.tsx`, `GridCell.tsx`; `utils/date.ts` (`generateCalendarDays`, semana desde lunes) | Reutilizar la generación de días. La celda debe pintar **eventos con hora y que cruzan varios días**, algo que Grid no hace (una publicación ocupa un solo día). |
| Mover por arrastre (cambia la fecha) | `hooks/useDragDrop.ts` | Mover un evento a otro día conserva hora y duración. Si ya está Programado, pide motivo (§5). |
| Detalle en panel/modal con acciones de estado | `TicketDetailCard.tsx`, `StatusSelect.tsx`, `TicketEditModal.tsx` | Ficha del evento en panel lateral, como los paneles del inventario. |
| Estados con una etiqueta y una familia de color | `grid/utils/constants.ts` (`ESTATUS_STYLE`: gris pendiente, azul en proceso, naranja atención, verde terminado) | Misma lógica semántica; los colores concretos se fijan en el diseño. |
| Historial de cambios de estado con motivo | Tabla `publicacion_estatus_historial`, RPC `transition_publicacion_status` | Tabla `evento_historial` y RPC equivalente. |
| Indicador derivado de plazo | `grid/utils/sla.ts` (`calcularSlaState`) | Indicadores derivados de cercanía de fecha, datos declarados y atraso (§4.4). |
| Capas de contexto en el calendario | Efemérides y campañas en `GridCell` | Fase posterior (§11, fase 5). |
| Archivar en lugar de borrar | Archivo de publicaciones y campañas | `archivado_en` y vista de archivados. |
| Control de versión y conflicto | Inventario (`version`, `CONFLICTO_VERSION`) | Igual en `eventos`. |

### 2.3 Hallazgos del código y decisiones de implementación

- `src/app/(dashboard)/events/layout.tsx` admite `events.inventory.read` o `events.schedule.read`; cada vista y acción exige además su permiso específico.
- El rol `events` entra a `/events/calendar` si tiene `events.schedule.read`; si solo tiene permisos de inventario, entra a `/events/inventory`. Las rutas antiguas `/events/list` y `/events/archive` redirigen a sus sub vistas nuevas.
- `sede_enum` solo conoce Prebo y Mañongo. Las tiendas de Eventos son las **siete** de `inventario_sedes` (catálogo que puede crecer), la misma que usa el inventario.
- Las acciones de efemérides y campañas usan la service role (`getSupabaseAdmin`) y algunas tablas auxiliares (por ejemplo `campana_efemerides`) tienen una política "permitir todo a autenticados". El inventario usa el cliente autenticado con RPC `SECURITY DEFINER`; **este módulo debe seguir el patrón del inventario**, no el de campañas.
- `GridView.tsx` tiene 1358 líneas. No se debe copiar: el calendario de Eventos se arma con componentes pequeños (cabecera, cuadrícula, celda, tarjeta, ficha) como los del inventario.
- Grid calcula fechas en la hora del navegador. Un evento depende de la hora, así que todo se guarda y se muestra en **America/Caracas** (como `formatStamp` en `src/lib/inventory.ts`).
- Ya existe el tipo de campaña `EVENTO` (`tipo_campana_enum`). El evento puede enlazarse a una campaña (§10).

## 3. Datos del evento

Los grupos marcados **(pedido)** salen de §2.1; el resto es propuesta.

### 3.1 Identificación

| Campo | Tipo | Regla |
|---|---|---|
| Nombre | texto, hasta 160 | Obligatorio. |
| Descripción / objetivo | texto largo, hasta 2000 | Opcional. |
| Responsable | usuario (perfil) | Obligatorio para pasar a Programado. Por defecto, quien crea. |

### 3.2 Clasificación (pedido)

| Campo | Valores | Regla |
|---|---|---|
| Tipo | `DEGUSTACION`, `IMPULSO`, `OTRO` | Obligatorio. Si es `OTRO`, se pide `tipo_otro` (texto corto). |
| Origen | `PROPIO` (de Kromi), `PROVEEDOR` | Obligatorio. Si es `PROVEEDOR`, se pide el nombre del proveedor. |
| Patrocinio | Texto libre opcional | Se ingresa directamente en el formulario del evento (§3.5). |
| Inscripción | Sí / No | Ver §3.4. |

### 3.3 Cuándo y dónde (pedido)

| Campo | Tipo | Regla |
|---|---|---|
| Tiendas | una o varias de `inventario_sedes` (tabla `evento_sedes`) | Al menos una. Opción "Todas las tiendas" en el formulario. |
| Zona dentro de la tienda | texto corto, **por tienda** | Opcional (ej. "Pasillo central", "Entrada"). Texto libre, no el catálogo de ubicaciones del inventario. |
| Inicio | fecha y hora, America/Caracas | Obligatorio para programar. |
| Duración | minutos (la interfaz permite horas y minutos) | Obligatoria para programar, mayor que 0. |
| Fin | fecha y hora | Se guarda `inicio` y `fin`; la duración se calcula (`fin − inicio`). Si el evento cruza medianoche o dura varios días, `fin` cae en otro día. |

El horario es **único para todas las tiendas** del evento. Si una tienda tuviera horario distinto, se crea otro evento (observación a revisar con el uso).

Se guardan `inicio` y `fin` y no una columna generada: sumar un intervalo a un `timestamptz` no es inmutable en PostgreSQL y no se puede usar en una columna generada.

### 3.4 Inscripción

| Campo | Tipo | Regla |
|---|---|---|
| Requiere inscripción | sí/no | Por defecto no. |
| Cupo | entero ≥ 1 | Solo si requiere inscripción; opcional. |
| Fecha límite de inscripción | fecha y hora | Opcional; no puede ser posterior al inicio. |
| Cómo inscribirse | texto (enlace o instrucciones) | Opcional. |

En la primera versión la app **no gestiona inscritos**: solo documenta cómo se inscriben. Registrar personas inscritas queda fuera de la primera entrega (D5, §13).

### 3.5 Patrocinio

Campo libre multilínea `patrocinadores`, opcional, hasta 2000 caracteres. El equipo puede escribir nombres, aportes y detalles en el formato que necesite. La interfaz puede indicar si el campo está vacío, pero no desglosa ni valida patrocinadores individuales.

### 3.6 Presupuesto (pedido)

| Campo | Regla |
|---|---|
| Presupuesto estimado | Decimal ≥ 0, 2 decimales. Opcional al planificar; recomendado antes de Programado. |
| Moneda | `USD` fija para esta entrega; se muestra como solo lectura en el formulario. |
| Gasto real | Se captura al cerrar (§4). Opcional. |

El desglose por rubros queda para una fase posterior.

### 3.7 Material necesario (pedido)

Campo libre multilínea `materiales`, opcional, hasta 2000 caracteres. Puede incluir nombres, cantidades, unidades y notas sin formato impuesto. No se enlaza con artículos del inventario ni se registra el estado de preparación en esta entrega.

### 3.8 Cierre

Como el evento pasa a Terminado solo, el cierre se registra **después**, desde la ficha del evento terminado: asistentes reales (entero ≥ 0), gasto real y notas de cierre (qué funcionó, qué no). Todos opcionales. En un evento terminado esos tres campos son lo único editable. También se puede anotar `asistentes_esperados` al planificar.

### 3.9 Preparación (tareas)

Lista de tareas opcional (`evento_tareas`): texto, responsable, fecha límite, completada. Es el equivalente a `checklist_rodaje` y serviría para seguimiento de preparación. Se propone para una fase posterior (§11), no para la primera entrega.

## 4. Estados

### 4.1 Valores

| Código | Etiqueta | Cómo se llega |
|---|---|---|
| `EN_PLANIFICACION` | En planificación | Al crear. Borrador de trabajo; puede tener datos incompletos. |
| `PROGRAMADO` | Programado | Una persona lo programa (§4.2). |
| `EN_CURSO` | En curso | **Automático** al llegar `inicio`. |
| `TERMINADO` | Terminado | **Automático** al llegar `fin`. Estado final. |
| `CANCELADO` | Cancelado | Una persona, con motivo. **Propuesta, no figura en el pedido**, pero hace falta para eventos que no ocurren. |

### 4.2 Transiciones

| Desde | Hacia | Quién | Condiciones |
|---|---|---|---|
| (nuevo) | En planificación | Persona | Nombre, tipo, origen y al menos una tienda. La fecha puede quedar vacía. |
| En planificación | Programado | Persona | Inicio y fin en el futuro, al menos una tienda, responsable, tipo y origen completos; proveedor si el origen es proveedor; si hay inscripción, la fecha límite no supera el inicio. Aviso si hay cruce en alguna tienda (§5). |
| Programado | En planificación | Persona | Motivo obligatorio. |
| Programado | En curso | **Sistema** | `ahora ≥ inicio`. |
| En curso | Terminado | **Sistema** | `ahora ≥ fin`. |
| En planificación, Programado, En curso | Cancelado | Persona | Motivo obligatorio. |
| Cancelado | En planificación | Persona | Motivo obligatorio (corregir una cancelación errónea). |
| En curso | Terminado | Persona ("Terminar ahora") | Para eventos que acaban antes de lo previsto; el `fin` no cambia. |
| Terminado | — | — | Final. Solo se editan los datos de cierre. |

Un evento **en planificación nunca avanza solo**, aunque su fecha ya haya pasado: aparece como "Fecha vencida" (§4.3) hasta que alguien lo programe, lo reprograme o lo cancele.

### 4.3 Cómo se aplican los cambios automáticos

El estado automático debe ser correcto aunque no corra ninguna tarea programada. Por eso:

1. `sync_event_statuses()` es una función idempotente que pasa a En curso los Programados con `inicio ≤ now()` y a Terminado los En curso (y los Programados ya vencidos) con `fin ≤ now()`, y escribe una fila en `evento_historial` con actor "Sistema".
2. **Toda lectura** (`list_events`, `get_event`) la ejecuta primero. Así quien abre el calendario siempre ve el estado correcto, sin depender de un cron.
3. Opcional: una ruta `/api/cron/sync-eventos`, protegida con `CRON_SECRET` como `/api/cron/purge-publicaciones`, llama a la misma función para dejar el historial al día aunque nadie abra la app. `vercel.json` hoy solo tiene un cron diario; una frecuencia mayor depende del plan de Vercel y no está verificada. Es opcional porque el punto 2 ya garantiza la corrección.
4. Cada cambio automático incrementa `version`. Si alguien tenía el evento abierto para editarlo, verá el aviso de conflicto y cargará la versión actual.

### 4.4 Indicadores derivados (no se guardan)

| Indicador | Condición |
|---|---|
| Próximo | Programado que empieza en las próximas 48 h. |
| Fecha vencida | En planificación con `inicio` ya pasado. |
| Incompleto | En planificación a menos de 7 días del inicio y sin responsable, presupuesto o texto de materiales. Umbral aceptado: 7 días. |
| Materiales sin declarar | El campo `materiales` está vacío y un evento en planificación o programado empieza en menos de 3 días. El indicador solo detecta falta de texto; no representa estado de preparación. |
| Cierre pendiente | Terminado sin asistentes reales, gasto real ni notas. |

## 5. Reglas de negocio

1. **Cruce de eventos:** dos eventos que comparten **al menos una tienda** con horarios solapados disparan el aviso `POSIBLE_CRUCE`, que indica en qué tiendas ocurre. Es una advertencia con "Continuar de todos modos", no un bloqueo (mismo patrón que `POSIBLE_DUPLICADO` en el inventario). Los cancelados y terminados no cuentan.
2. **Reprogramar** un evento Programado o En curso (cambiar inicio, fin o tiendas) exige un motivo y queda en el historial. En planificación se cambia sin motivo. En un evento En curso solo se puede ampliar el `fin`; acortarlo se hace con "Terminar ahora". Un evento terminado no se reprograma.
3. **Cancelar** y **volver a planificación** exigen motivo.
4. **Programar** exige que el evento sea futuro. Para registrar un evento que ya ocurrió y no se planificó, queda como observación a revisar con el uso (§13).
5. **Conflicto de edición:** como en el inventario, cada cambio comprueba `version`; si otra persona (o el sistema) modificó el evento, la interfaz ofrece cargar la versión actual.
6. **Archivar:** solo eventos Terminados o Cancelados. Se ocultan del calendario y se ven en el archivo; no se borran.
7. **Presupuesto y patrocinio** se capturan en la moneda del evento; no hay conversión automática.
8. **Quitar una tienda** de un evento Programado o En curso se trata como reprogramación (motivo obligatorio). El evento no puede quedar sin tiendas.

## 6. Modelo de datos propuesto

Migración: [`supabase/migrations/202610150001_events_schedule.sql`](../../supabase/migrations/202610150001_events_schedule.sql) (el usuario reportó que la aplicó en remoto; falta verificar mediante introspección/`supabase db pull`). Escritura solo por RPC `SECURITY DEFINER` con `search_path=''`; RLS de lectura y sin grants de escritura directa a `anon` ni `authenticated`, igual que el inventario.

| Tabla | Contenido |
|---|---|
| `eventos` | §3.1–3.8: incluye `materiales` y `patrocinadores` como texto libre opcional (máximo 2000 caracteres cada uno), además de nombre, clasificación, horario, responsable, presupuesto USD, inscripción, cierre, versionado y archivo. |
| `evento_sedes` | `evento_id`, `sede_id` (FK a `inventario_sedes`), `zona`. Clave primaria `(evento_id, sede_id)`; al menos una fila por evento, validado en las RPC. |
| `evento_historial` | Una fila por cambio de estado o reprogramación: `evento_id`, `tipo` (`ESTATUS` o `REPROGRAMACION`), valores anterior y nuevo, `motivo`, `cambiado_por` (nulo = Sistema), `cambiado_en`. Inmutable por trigger, como `inventario_movimientos`. |

`evento_tareas` no existe en esta migración; las tareas de preparación siguen fuera de alcance de la primera entrega.

Restricciones principales (`CHECK`): `fin > inicio` cuando ambos existen; estados válidos; `tipo_otro` solo con `OTRO`; `proveedor_nombre` obligatorio si `origen = 'PROVEEDOR'`; cupo e inscripción solo con `requiere_inscripcion`; montos ≥ 0. Las reglas de completitud para Programado se validan en la RPC, no en `CHECK`, porque el borrador puede estar incompleto. Si `estatus` es distinto de `EN_PLANIFICACION`, `inicio` y `fin` no pueden ser nulos.

Índices: `(estatus, inicio)`, `(estatus, fin)` para la sincronización, `(responsable_id)` y `evento_sedes (sede_id, evento_id)`. El aviso de cruce compara rangos `tstzrange(inicio, fin)` entre eventos que comparten tienda.

Catálogos: tipo, origen y estado son texto con `CHECK` (no `ENUM` de PostgreSQL) para poder ampliarlos con una migración sin recrear tipos. La moneda tiene `CHECK (moneda = 'USD')` en esta entrega, decisión confirmada por el equipo.

## 7. Permisos

Permisos implementados en `202610150001_events_schedule.sql`, siguiendo `social-media.campaigns.*` y `events.inventory.*`:

| Código | Rol `events` | Uso |
|---|---|---|
| `events.schedule.read` | Sí | Ver calendario, listado, ficha e historial. |
| `events.schedule.create` | Sí | Crear eventos. |
| `events.schedule.update` | Sí | Editar datos (incluidos los textos libres de materiales y patrocinadores), reprogramar y registrar el cierre. |
| `events.schedule.status.update` | Sí | Programar, volver a planificación, cancelar y "Terminar ahora". |
| `events.schedule.archive` | Sí | Archivar y restaurar. |

**Ningún otro rol recibe estos permisos por ahora** (decisión del 2026-10-15). RLS solo permite SELECT a quien tenga `events.schedule.read`; Social Media, Gerencia y los demás no ven eventos. El presupuesto y el gasto se muestran a todo el que tenga `read`.

**Integración con el perfil:** implementada en `events/layout.tsx`; el layout acepta el permiso de inventario o programación y `shell.tsx` muestra las entradas disponibles. Cada página y acción valida su permiso. La pantalla inicial del rol pasa a `/events/calendar` si tiene `events.schedule.read`, y a `/events/inventory` si solo tiene inventario (`auth.ts`, `login/page.tsx`, `access-pending/page.tsx`).

## 8. Funciones (acciones de servidor y RPC)

El cargador de páginas valida acceso con `requirePermission`; las Server Actions validan el permiso con `authorizeAction`, validan entradas cuando corresponde, llaman a RPC y revalidan `/events`. La validación de formulario se repite en `src/lib/events.ts`; la SQL sigue siendo la autoridad.

| Función | Acción de servidor | Hace |
|---|---|---|
| `sync_event_statuses()` | (interna) | Aplica los cambios automáticos de §4.3. No es ejecutable por `authenticated`; la llaman las RPC de lectura y mutación. No hay ruta de cron en el código actual. |
| `list_events(...)` | `loadSchedule` (calendario/listado/archivo) y `getEventScheduleDataAction` | Lista calendario intersectando rango o página del listado; admite filtros y ocultación de archivados. |
| `list_event_responsables()` / `list_event_campaigns()` | `loadSchedule` | Catálogos de responsables del rol `events` y campañas activas elegibles. |
| `get_event(p_evento_id)` / `get_event_history(...)` | `getEventDetailAction` | Ficha y hasta 30 movimientos recientes del historial. |
| `check_event_overlap(...)` | `checkEventOverlapAction` | Consulta cruces por horario y tiendas. |
| `create_event(p_datos, p_confirmar_cruce)` | `createEventAction` | Crea en planificación; informa cruces y requiere confirmación explícita para continuar. |
| `update_event(p_evento_id, p_expected_version, p_datos, p_motivo, p_confirmar_cruce)` | `updateEventAction` | Edita datos y tiendas con control de versión; motivo si reprograma un evento programado o en curso. |
| `reschedule_event(...)` | `rescheduleEventAction` | Cambia fecha desde la ficha o calendario; la acción existe para movimientos explícitos. |
| `transition_event_status(...)` | `transitionEventAction` | Transiciones manuales de §4.2. |
| `save_event_closure(...)` | `saveEventClosureAction` | Asistentes reales, gasto real y notas de cierre. |
| `archive_event(...)` / `restore_event(...)` | `archiveEventAction` / `restoreEventAction` | Archivar/restaurar con control de versión. |

Errores con código estable para la interfaz: `POSIBLE_CRUCE` (la lista de cruces va en `detail`), `CONFLICTO_VERSION`, `MOTIVO_REQUERIDO` y `FALTAN_DATOS` (con la lista de campos que faltan para programar, en `detail`).

**Contrato implementado en la migración** (§6 y §8 describen sus decisiones):

- `create_event(p_datos jsonb, p_confirmar_cruce)` y `update_event(p_evento_id, p_expected_version, p_datos jsonb, p_motivo, p_confirmar_cruce)` reciben los datos del formulario en un solo `jsonb` (incluidos `materiales`, `patrocinadores` como texto y `sedes: [{sede_id, zona}]`); `events_normalize` valida y normaliza. `reschedule_event`, `transition_event_status` y `save_event_closure` reciben parámetros sueltos.
- Se añade `check_event_overlap(...)`, que el formulario usa para avisar del cruce antes de guardar.
- `evento_historial.anterior` y `nuevo` son `jsonb` (`{"estatus": ...}` o `{"inicio", "fin", "sedes": [nombres]}`).
- `CANCELADO` puede no tener fechas; los demás estados distintos de planificación sí.
- `evento_tareas` no está en la migración (fase posterior). Los indicadores de §4.4 salen de `list_events` y `get_event` (`indicadores`), con los umbrales aceptados de 7 y 3 días en `events_flags`; con materiales en texto libre solo se detecta si no se declaró texto.
- Materiales y patrocinadores son columnas de texto en `eventos`; no hay tablas hijas, CRUD de listas ni enlace al inventario en esta entrega.
- `sync_event_statuses()` no es ejecutable por `authenticated`; la llaman las RPC de lectura y mutación. No hay ruta de cron en la implementación actual.
- El usuario reportó que aplicó la migración en Supabase. No se ha hecho `db pull` ni una inspección remota de tablas, grants, policies y RPC en esta revisión. La compilación local valida TypeScript y generación de rutas, no ejecuta el SQL ni reemplaza pruebas funcionales con usuarios reales.

## 9. Vistas cliente

La propuesta visual está en el lienzo de diseño "Eventos · Programación" y guía la implementación. Hereda el lenguaje de social-media (paleta de marca, calendario por celdas, paneles laterales) y del inventario (paneles, filtros en la URL, estados vacío/error/carga/conflicto).

| Vista | Ruta | Contenido |
|---|---|---|
| Calendario mensual | `/events/calendar` | Cuadrícula por semanas desde el lunes. Cada evento es una barra con hora, nombre y estado; los de varios días se ven continuos. Filtros por tienda, estado, tipo y origen; "Hoy"; alta rápida desde un día; arrastre para mover (con motivo si ya está Programado). Los cambios automáticos de estado se reflejan al abrir. |
| Calendario semanal | `/events/calendar?vista=semana` | Eje horario de 7 días; la altura del bloque es la duración. Es la diferencia clave con Grid. |
| Listado | `/events/calendar/list` | Sub vista de Programación; tabla con búsqueda y filtros por tienda, estado, tipo y origen; paginación en la URL. |
| Ficha del evento | Panel lateral | Estado y acciones, horario y tiendas, clasificación, presupuesto, materiales y patrocinadores como texto libre, inscripción, historial y cierre. |
| Formulario | Panel lateral | Crear y editar; selector múltiple de tiendas con "Todas"; campos multilínea libres para materiales y patrocinadores; USD fijo; avisos de cruce y conflicto. |
| Archivo | `/events/calendar/archive` | Sub vista de Programación; eventos archivados y restauración. La tabla se desplaza horizontalmente en pantallas estrechas. |
| Estados de la interfaz | Todas | Vacío, sin resultados, error con reintento, carga, conflicto y móvil. |

**Mapa de maquetas** (`docs/design/prototypes/events-schedule/`, ocho pantallas, un archivo cada una, y `canvas.json` con su posición):

| Maqueta | Vista |
|---|---|
| `Main.dc.html` | Calendario mensual |
| `Movil.dc.html` | Agenda móvil |
| `Semana.dc.html` | Calendario semanal con eje horario |
| `Lista.dc.html` | Listado |
| `Ficha.dc.html` | Ficha del evento |
| `Formulario.dc.html` | Crear y editar con varias tiendas |
| `Estados.dc.html` | Estados automáticos y estados de la interfaz |
| `Decisiones.dc.html` | Decisiones de diseño y pendientes |

Las maquetas son referencia visual; si difieren de este documento, gana el documento. Los datos son de ejemplo.

**Diferencias con el calendario de social-media:** la hora y la duración son esenciales (vista semanal con eje horario, que Grid no tiene); un evento abarca varios días y varias tiendas; la tienda es una dimensión principal de filtro; el estado tiene cinco valores y cambia solo con la hora; no hay cuentas ni formatos; el cruce de horarios por tienda es una regla visible.

## 10. Relación con otros módulos

| Módulo | Relación propuesta |
|---|---|
| Inventario | No hay enlace entre materiales del evento e inventario en esta entrega. La lista libre es informativa; reservas y movimientos automáticos siguen fuera de alcance. |
| Campañas | `campana_id` opcional hacia una campaña (por ejemplo de tipo `EVENTO`). Social Media ya ve campañas en su calendario; hoy los eventos no se muestran en social-media (D6): solo el rol `events` los ve. |
| Social Media | Hoy no hay relación. Por decisión (D6) Social Media no ve eventos. Una capa de solo lectura en Grid o pedir publicaciones promocionales desde un evento serían mejoras futuras, según observaciones. |
| Terceros | Proveedor y patrocinador son texto libre en la primera versión; enlazar con el directorio `terceros` es una mejora posterior. |

## 11. Fases

La primera entrega es la **implementación básica**: fases 0 a 3, incluidos los campos libres de materiales/patrocinadores, los indicadores y el archivo. Las fases posteriores se priorizan con observaciones de las personas usuarias.

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | **Completada en código:** reutiliza `inventario_sedes` y las funciones de permisos existentes; USD y umbrales 7/3 aceptados. El estado remoto requiere reconciliación, no una nueva definición funcional. | Inventario y auth |
| 1 | **Implementada localmente; aplicación reportada por el usuario:** migración, tablas, restricciones, permisos `events.schedule.*`, RLS de lectura, RPC, sincronización de estados e historial inmutable. Falta introspección remota/pruebas SQL independientes. | Fase 0 |
| 2 | **Implementada y validada con `pnpm run build`:** tipos, validadores, fechas America/Caracas, Server Actions autorizadas y control de versión. El build no verifica el SQL remoto. | Fase 1 |
| 3 | **Implementada localmente:** calendario mensual/semanal con arrastre, listado, ficha, formulario multi tienda, campos libres, indicadores, archivo y cierre; navegación y rutas anidadas. Falta revisión funcional en Supabase con usuarios del rol. | Fase 2 y prototipos |
| 4 | Ruta de cron opcional, tareas de preparación y capas de campañas/efemérides en el calendario. | Uso real |
| 5 | **Documentación actualizada en el repositorio.** Pendiente `supabase db pull`, actualizar el esquema/captura a partir del remoto y probar permisos y flujos en Supabase. | Fases 0 a 3 |

La implementación local de las fases 1 a 3 se encuentra en el repositorio y el usuario reportó la migración aplicada. El módulo no se considera verificado en el entorno desplegado hasta contrastar el esquema vivo y probar permisos y flujos con cuentas `events`.

## 12. Decisiones

### 12.1 Confirmadas (2026-10-15)

| # | Decisión |
|---|---|
| D1 | Un evento puede ocurrir en **varias tiendas** a la vez (`evento_sedes`). |
| D3 | "En curso" y "Terminado" **cambian solos por la hora** (§4.3). |
| D6/D7 | Solo el rol `events` ve y gestiona eventos, incluido el presupuesto. |
| D12 | El módulo es parte del perfil `events`; implementación básica que escala con las observaciones. |
| D4 | Moneda fija `USD` para esta entrega. |
| D13 | Umbrales aceptados: 7 días para "Incompleto" y 3 días para "Materiales sin declarar". |

### 12.2 Adoptadas por defecto (revisables con el uso)

| # | Tema | Valor adoptado |
|---|---|---|
| D2 | Borrador sin fecha | Permitido en planificación; no aparece en el calendario, sí en el listado. |
| D5 | Inscritos | La app solo describe cómo inscribirse (enlace o instrucciones, cupo, fecha límite); no registra personas. |
| D8 | Pantalla inicial del rol | Calendario. |
| D9 | Materiales | Texto libre en el evento; sin tabla propia ni enlace, reserva o descuento de inventario. |
| D10 | Tareas de preparación | Fase posterior. |
| D11 | Estado `CANCELADO` | Se incluye. |

### 12.3 Por confirmar

| # | Pregunta | Por defecto |
|---|---|---|
| D14 | Frecuencia del cron opcional, según el plan de Vercel | Sin cron en la primera entrega. |

## 13. Fuera de alcance

Registrar un evento ya ocurrido que no se planificó, horarios distintos por tienda dentro de un mismo evento, gestión de inscritos y asistencia por persona, desglose del presupuesto por rubros, aprobaciones de presupuesto por Gerencia, reservas de inventario, notificaciones y recordatorios, eventos recurrentes, exportación a calendarios externos (Google, iCal), fotos y adjuntos, y reportes comparativos entre eventos.
