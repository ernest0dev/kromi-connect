# Plan: ficha única de solicitud para Design

**Estado (2026-10-19):** implementación local de D0–D6 preparada. El usuario confirmó aplicadas las migraciones `20261020011300_events_design.sql` y `20261020011301_unified_design_requests.sql`. La migración adicional `20261020011400_design_request_details.sql` está preparada localmente y pendiente de aplicación. Las afirmaciones previas del punto de partida describen el estado histórico del commit indicado; no representan el estado actual del código.

## 1. Punto de partida

La cola y el historial de Design ya son únicos. La ficha de detalle no: son tres rutas con tres componentes que no se parecen.

| | Social Media | Interno | Eventos |
|---|---|---|---|
| Ruta | `/design/publications/[id]` | `/design/internal/[id]` | `/design/events/[id]` |
| Componente | `detail.tsx` (303 líneas) | `detail.tsx` (73 líneas) | `view.tsx` (7 líneas) |
| Permiso de lectura | `design.posts.read` | `design.internal.read` | `design.requests.read` |
| Origen de datos | `get_design_publication_queue` + 4 consultas | `get_design_internal_request` | `get_design_event_request` → `adaptEvent` |
| Estado en pantalla | chip traducido | texto crudo (`EN_DISENO`) | texto traducido, sin chip |
| Fechas | `es-VE`, zona Caracas | crudas (`2026-10-28`) | cruda; horario ISO UTC crudo |
| Carga de entregables | resumible, con cancelar y tope de 20 | un archivo a la vez, sin reanudar ni cancelar | no existe |
| Acción final | «Entregar a revisión» | «Entregar a Interno» | ninguna |
| Correcciones | sí | no | no |
| Historial en pantalla | sí | no | no |

Ya existe el contrato `DesignRequest` y sus tres adaptadores en `src/lib/designRequests.ts`, pero está pensado para la lista: campos mínimos. La ficha necesita más.

## 2. Hallazgos que condicionan el plan

1. **Eventos no se puede entregar.** No hay acciones ni UI de Drive para Eventos. `design_deliver_event_request` exige un archivo `ENTREGABLES` en estado `COMPLETE` dentro de `evento_drive_uploads`, y ningún código de `src/` usa esa tabla. Además la tabla no tiene `session_uri`, que sí tienen las de publicaciones e Interno y que necesita la carga resumible.
2. **`DesignRequest` pierde datos de la ficha:** copy (hook, cuerpo, CTA, hashtags), prioridad, nombre del diseñador, historial y correcciones. `brief_files` es sintético (`[{ count }]`, longitud 0 o 1 sin importar cuántos archivos hay), `delivery_files` siempre es `[]` y `source_context` es `Record<string, unknown>`.
3. **`requested_by` es siempre `null` en Social Media.** `adaptPublication` lee `row.created_by`; la tabla `publicaciones` tiene `creador_id`.
4. **«Ver ficha» del historial puede dar 404.** La ficha de Social Media busca en `get_design_publication_queue`, que solo devuelve `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION`; una solicitud entregada no se encuentra. `get_design_internal_request` excluye los pendientes `CANCELADO`, aunque el historial los lista. Solo Eventos admite estados terminales.
5. **«Entrega real» arrastra el ciclo anterior.** `fecha_entrega_diseno_real` se escribe al pasar a `EN_REVISION_CM` y no se borra al reabrir. Una solicitud reabierta muestra la fecha de la entrega previa mientras está «En diseño» (es lo que se ve en Cofasa Cardiólogo; no se confirmó contra los datos).
6. **Instrucciones de 1 carácter pasan.** `validateEventDesign` solo exige texto no vacío, y `request_pendiente_to_design` lo mismo (`nullif(trim(...),'')`). Así llegó «x» en Oktover Fest.
7. **Destinos duplicados:** `destination()` en `UnifiedQueueView.tsx` y `detail()` en `UnifiedHistoryView.tsx` repiten el mismo mapa de rutas.
8. **Presentación:** no hay formateadores compartidos para estado, origen ni salida; cada pantalla improvisa los suyos.

## 3. Decisión de diseño

Se conserva lo definido en §9.3 del plan de Eventos: tablas fuente intactas, adaptadores, sin tabla física `design_requests` por ahora. Se agrega una **capa de detalle** encima.

1. **Una ruta, un componente.** La ficha no sabe de tablas.
2. **Detalle distinto de lista.** `DesignRequestDetail` extiende `DesignRequest`; la cola sigue usando el contrato liviano.
3. **La visibilidad la decide una tabla de reglas** (datos), no `if (source === …)` repartidos por el JSX.
4. **Las acciones salen de `capabilities`,** calculadas en servidor por el adaptador.
5. **«No aplica» no se renderiza. «Aplica y falta» se muestra como «Sin definir».** Un Reel sin hook es una omisión de quien pidió; un Story sin copy es normal.
6. **Los adaptadores siguen siendo el único lugar que conoce las tablas** y los únicos que validan el permiso de su origen.

## 4. Modelo de detalle

```ts
type DesignRequestDetail = DesignRequest & {
  context: SourceContext;                 // reemplaza a source_context: Record<string, unknown>
  designer: { id: string; name: string | null } | null;
  created_at: string | null;
  usage_date: { label: string; value: string | null } | null; // Publicación | Requerida en tienda | Evento
  copy: { hook?: string; body?: string; cta?: string; hashtags?: string[] } | null;
  priority: 'HIGH' | 'NORMAL' | 'LOW' | null;
  correction: { text: string; at: string } | null;
  history: { at: string; label: string; note?: string | null }[];
  capabilities: {
    canStart: boolean; canUpload: boolean; canDeliver: boolean; canReopen: boolean;
    deliverLabel: string;                 // «Entregar a revisión» | «Entregar a Interno» | «Entregar a Eventos»
    deliverHint?: string;
    upload: { maxFiles: number; maxBytes: number; resumable: boolean } | null;
  };
};

type SourceContext =
  | { source: 'SOCIAL_MEDIA'; format: string; channels: string[]; publication_date: string }
  | { source: 'INTERNAL'; task_type: string; store: string; quantity: number | null; needed_by: string | null }
  | { source: 'EVENTS'; event_name: string; stores: string[]; starts_at: string; ends_at: string | null };
```

Los archivos de Brief y Entregables no viajan en el DTO: la ficha los consulta desde el cliente con acciones por origen, como hace hoy Social Media.

## 5. Qué muestra la ficha

Orden confirmado antes por ti: instrucciones y archivos arriba, fechas en el medio, copy y datos secundarios abajo.

| Bloque | Social Media | Interno | Eventos | Regla |
|---|---|---|---|---|
| Cabecera: título, chips (origen, estado, salidas, canales), «Tomada por», enlace «Solicitudes» | ✓ | ✓ | ✓ | Siempre. Un solo enlace de regreso. |
| Aviso de corrección | si hay | — | — | Solo si `correction` existe. |
| Instrucciones | ✓ | ✓ | ✓ | Siempre. Vacía = «No se registraron instrucciones» con tono de aviso. |
| Brief | ✓ | ✓ | ✓ | Siempre. Vacío = aviso en Social Media e Interno (lo exigen); en Eventos es opcional y no avisa. |
| Entregables | ✓ | ✓ | ✓ | Siempre. Zona de carga si `canUpload`; «carga pausada» si el flujo lo requiere; lista de solo lectura en estados terminales. |
| Fechas y plazo | ✓ | ✓ | ✓ | Cada celda aplica según origen; si aplica y no hay valor, «—». |
| Contenido de la publicación | si aplica | — | — | Se muestra si algún campo tiene texto. Si el formato no es `STORY` y está todo vacío, se muestra con «Sin definir». |
| Datos | ✓ | ✓ | ✓ | Solo filas con valor. |
| Historial | ✓ | ✓ | ✓ | Siempre; hoy solo existe en Social Media. |
| Barra de acción (fija en móvil) | ✓ | ✓ | ✓ | Etiqueta y destino salen de `capabilities`. |

**Fechas y plazo.** Celdas: Creada · Solicitada a Diseño · Entrega objetivo (con chip de plazo) · Última entrega · fecha de uso (`Publicación` / `Requerida en tienda` / `Evento`). Todas se formatean con los helpers de `designSla.ts` en zona America/Caracas.

**Datos por origen.** Social Media: Formato, Canales, Prioridad. Interno: Tipo, Tienda, Cantidad. Eventos: Formatos, Tiendas, Horario.

**Reglas declarativas** (ejemplo del formato, en `fieldRules.ts`):

```ts
{ id: 'copy', applies: (d) => d.context.source === 'SOCIAL_MEDIA',
  hasContent: (d) => !!d.copy && Object.values(d.copy).some((v) => (Array.isArray(v) ? v.length : v)),
  missingWhen: (d) => d.context.source === 'SOCIAL_MEDIA' && d.context.format !== 'STORY' }
// aplica + con contenido → se pinta | aplica + vacío + missingWhen → «Sin definir» | no aplica → no se renderiza
```

El bloque se renderiza condicionalmente en React; no se oculta con CSS, así el HTML queda limpio y los lectores de pantalla no leen campos fantasma.

## 6. Acciones y archivos por origen

| | Social Media | Interno | Eventos |
|---|---|---|---|
| Tomar | `transitionPublicationAction` → `EN_DISENO` | `startInternalDesignWorkAction` | `startEventDesignWorkAction` |
| Cargar | resumible: start, finish, resume, cancel; tope 20 | start y finish; sin reanudar ni cancelar; tope 20 solo en la RPC | **no existe** |
| Condición de entrega | archivo posterior a `cycleStart`, comprobado en cliente (`hasCurrentCycleFile`) | servidor exige archivo posterior a `diseno_iniciado_en` | la RPC exige cualquier carga `COMPLETE` |
| Entregar | `transitionPublicationAction` → `EN_REVISION_CM` | `deliverInternalDesignWorkAction` | `design_deliver_event_request` |
| Reabrir | sí (`EN_CORRECCION` → `EN_DISENO`) | no | no |

No se reescriben las RPC. Se agrega una capa fina en `src/app/actions/design/requests.ts`:

- `startDesignRequestAction`, `deliverDesignRequestAction`, `reopenDesignRequestAction`: reciben `{ source, id }` y despachan a las acciones existentes.
- `DesignFilesAdapter` con `list`, `startUpload`, `finishUpload`, `resumeUpload`, `cancelUpload`. Social Media ya lo cumple; Interno lo completa; Eventos lo estrena.
- El cargador resumible (hoy en `design/publications/[id]/detail.tsx`, líneas 23–78) pasa a `src/lib/driveResumableUpload.ts` **sin cambiar su lógica**. El `sendFile` de Interno no reconcilia offsets ni se puede abortar.
- Regla común de entrega a verificar en servidor: «al menos un entregable cargado después de que Design tomó la solicitud». En Social Media falta comprobar si la RPC de transición la repite.

## 7. Cambios en base de datos (todos aditivos)

1. **Eventos y Drive:** `evento_drive_uploads.session_uri` con el mismo check de seguridad que `publicacion_drive_uploads`; RPC `reserve_evento_deliverable_upload`, `reserve_evento_brief_upload` y `sync_evento_drive_brief` (solo `service_role`), siguiendo `pendiente_*`. Ya están descritas en `plan-eventos-diseno.md` §5; aquí se prioriza **entregables primero** y brief opcional después.
2. **Lecturas de ficha:** `get_design_event_request` suma `disenador_nombre` (ya hay un patrón en `get_event_design_data`); `get_design_internal_request` suma `creado_en` y `fecha_requerida`, y el nombre vía `get_pendiente_designer_names`.
3. **Estados terminales sin 404:** `get_design_internal_request` incluye `CANCELADO` cuando hay historial `DISENO` (mismo criterio que el historial); nueva `get_design_publication_request(p_id)` para Social Media, apoyada en `design_can_see_publication`, que devuelve la fila activa o terminal.
4. **Historial de Interno y Eventos:** `get_design_internal_timeline(uuid)` y `get_design_event_timeline(uuid)`, sobre `pendiente_tienda_historial` y `evento_historial` con `tipo = 'DISENO'`.
5. Las migraciones se preparan en local y no se aplican hasta que lo indiques. El usuario confirmó aplicadas `20261020011300` y `20261020011301`; la nueva migración de detalle/carga es `20261020011400` y está pendiente.

## 8. Tandas

| Tanda | Contenido | Depende de | Criterio de aceptación |
|---|---|---|---|
| D0 | Tipos de detalle y `SourceContext`; adaptadores de detalle (sin UI); corregir `requested_by` (`creador_id`); pruebas Jest por origen | — | Cada adaptador produce todos los campos comunes y ningún dato de otro origen |
| D1 | `designLabels.ts` (estado, origen, salida); fechas y horarios con `designSla.ts` | D0 | No queda estado crudo ni ISO en pantalla |
| D2 | Ficha única de solo lectura en `/design/requests/[source]/[id]`; componentes y `fieldRules.ts`; rutas antiguas redirigen; una sola `designRequestHref()` para cola e historial; migraciones §7.2–7.4 | D0, D1 | Las tres solicitudes de las capturas muestran la misma estructura; las terminadas abren sin 404 |
| D3 | Tomar, entregar y reabrir por `capabilities`; barra de acción común | D2 | Social Media e Interno entregan desde la ficha nueva con el flujo actual |
| D4 | `driveResumableUpload.ts` y `FilesPanel` comunes; Interno gana reanudar, cancelar y tope visible | D3 | Misma zona de carga en los tres orígenes (Eventos aún deshabilitada) |
| D5 | Eventos con Drive: migración §7.1, acciones, carga y entrega | D4 | Design entrega un evento de punta a punta |
| D6 | Borrar las tres fichas antiguas; e2e Playwright por origen; actualizar `docs/design/README.md` y `UI_IMPLEMENTATION.md` | D2–D5 | Sin rutas ni componentes duplicados |

**Estado local:** D0–D5 implementados en código; D6 incluye la redirección de rutas antiguas, la eliminación de fichas duplicadas y la actualización de este documento y el README. Se añadieron pruebas unitarias de adaptadores. Falta añadir/ejecutar Playwright por origen. La migración `20261020011400_design_request_details.sql` debe aplicarse antes de usar la ruta nueva. No existe un archivo `UI_IMPLEMENTATION.md` en este repositorio. La verificación end-to-end con cuentas reales y Drive queda pendiente de ejecutar con el entorno conectado.

<details><summary>Prompt D0–D1 para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-ficha-unica-design.md (§2, §3, §4, §5). Trabaja sobre src/lib/designRequests.ts.
Define DesignRequestDetail y SourceContext (unión discriminada por source) sin romper DesignRequest, que la cola sigue usando. Crea adaptadores de detalle para SOCIAL_MEDIA, INTERNAL y EVENTS en src/lib/design/. Corrige requested_by en adaptPublication (usa creador_id). Crea src/lib/design/designLabels.ts con etiquetas de estado, origen y salida, y usa formatDesignDate/getCaracasToday de src/lib/designSla.ts para todo horario. Añade pruebas Jest por origen: campos comunes presentes, ningún bloque contextual de otro origen, STORY sin copy, Eventos sin copy. No toques UI ni migraciones.
```
</details>

<details><summary>Prompt D2–D3 para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-ficha-unica-design.md completo. Antes de escribir código de Next.js, lee la guía correspondiente en node_modules/next/dist/docs/.
Crea la ruta src/app/(dashboard)/design/requests/[source]/[id]/ con page.tsx (servidor, requirePermission('design.requests.read')) y componentes en components/: RequestHeader, InstructionsCard, FilesPanel, DatesCard, CopyCard, DataCard, HistoryCard, ActionBar. La visibilidad sale de fieldRules.ts, no de if por origen en el JSX. Las rutas /design/publications/[id], /design/internal/[id] y /design/events/[id] pasan a redirigir. Reemplaza destination() y detail() por una sola designRequestHref(). Primero solo lectura (D2); luego acciones por capabilities (D3) despachando a las acciones existentes; no reescribas las RPC. Prepara las migraciones de §7.2–7.4 sin aplicarlas.
```
</details>

<details><summary>Prompt D4–D5 para Kilo Code</summary>

```
Lee docs/design/plan-ficha-unica-design.md (§6, §7) y plan-eventos-diseno.md (§5, §7).
Mueve el cargador resumible de design/publications/[id]/detail.tsx (líneas 23–78) a src/lib/driveResumableUpload.ts sin cambiar su lógica y úsalo desde un FilesPanel común. Completa Interno con reanudar y cancelar. Para Eventos crea actions/events/drive.ts y la migración con session_uri y las RPC de reserva, tomando como modelo supabase/migrations/202610180002_internal_design_requests.sql. La entrega valida en servidor que el evento no esté cancelado. No apliques migraciones.
```
</details>

## 9. Decisiones pendientes

1. **Ruta:** nueva `/design/requests/[source]/[id]` con redirecciones (recomendado) o mantener las tres URLs apuntando al mismo componente.
2. **Vocabulario de fecha:** hoy conviven «Entrega estimada», «Entrega solicitada» y «Entrega objetivo». Se propone **«Entrega objetivo»** para los tres.
3. **«Entrega real» tras reabrir:** se propone llamarla «Última entrega» y mostrarla solo si existe.
4. **Eventos con copy:** la ficha ya soporta el bloque, pero hoy Eventos no captura hook, cuerpo ni CTA. Si lo quieres, hay que añadir columnas y campos al formulario del evento; queda fuera de este plan.
5. **Largo mínimo de instrucciones** en Interno y Eventos (por ejemplo 10 caracteres) para evitar «x».
6. **Etiqueta del botón de Eventos:** se propone «Entregar a Eventos».
7. **Correcciones:** siguen siendo solo de Social Media; Interno y Eventos no tienen ciclo de corrección.

## 10. Riesgos

- **Cargas resumibles:** mover el cargador puede romper la subida de archivos grandes. Mover primero sin cambiar lógica y probar con archivos mayores de 8 MB (tamaño del fragmento).
- **Permisos:** la ficha lee con `design.requests.read`, pero cada acción debe seguir validando el permiso de su origen (§9.3 del plan de Eventos). Social Media hoy usa `getSupabaseAdmin()` para historial y canales, lo que salta RLS; al migrarlo, pasar esas lecturas a RPC con `design_can_see_publication`.
- **Migración adicional sin aplicar:** la ruta única necesita aplicar `20261020011400_design_request_details.sql` para las lecturas terminales, cronologías, el permiso de carga de Eventos y las sesiones resumibles.
- **Sin verificación remota:** nada de §7 se contrastó con el proyecto vivo; antes de D2 conviene un `db diff` o consulta manual de las firmas de las RPC que se modifican.
