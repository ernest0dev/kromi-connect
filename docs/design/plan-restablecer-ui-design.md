# Plan: restablecer la UI del prototipo en las vistas del rol Design

**Destinatario:** Codex (o cualquier agente que implemente). **Estado:** propuesto, sin implementar.
**Origen:** comparación entre `docs/design/prototypes/design-role/*.dc.html` y el código del commit `3396a3c`. El análisis completo está resumido en la sección 1.

## 0. Objetivo y regla de oro

Volver a la apariencia y a la jerarquía visual de los prototipos de Design (`Main`, `Historial`, `Ficha`, `FichaCorreccion`, `FichaMovil`) **sin deshacer** las decisiones funcionales posteriores:

- Una sola cola, un solo historial y una sola ficha para Social Media, Interno y Eventos (`DesignRequest` / `DesignRequestDetail`, adaptadores por origen, `capabilities`, `fieldRules`).
- Rutas comunes `/design/requests/[source]/[id]` y `designRequestHref`.
- Etiquetas compartidas (`designLabels.ts`) y fechas en zona `America/Caracas` (`designSla.ts`).
- Carga de entregables en la app (resumible, varios archivos, límites desde `capabilities.upload`), correcciones también en Interno y Eventos, brief opcional en Eventos.
- Seguridad en servidor sin cambios: ninguna tanda de este plan toca permisos, RPC de escritura ni migraciones de transición.

**Si el prototipo y la funcionalidad actual chocan, gana la funcionalidad actual y la UI se adapta**: el prototipo solo cubre Social Media; los otros dos orígenes deben encajar en el mismo diseño, no tener uno propio.

## 1. Diferencias detectadas

### 1.1 Cola (`Main.dc.html` → `UnifiedQueueView.tsx`)

| Elemento del prototipo | Hoy |
|---|---|
| Secciones **Por tomar · N** y **En curso · N** | Lista plana |
| Aviso azul "Al tomar una solicitud queda registrada a tu nombre…" | No existe |
| Chip de estado con color (Solicitada / En diseño / Devuelta con correcciones) | Texto gris |
| Chip de vencimiento con icono y tono (vencida / pronto / normal) | Texto gris (`getDesignDueLabel`) |
| "Tomada por X (tú)" / "Pendiente de asignación" | Solo "Asignada a ti" |
| Fecha de uso (Publica…) y Entrega estimada | Solo Entrega |
| Botón **Ver correcciones** (primario) en devueltas | "Abrir ficha" para todo |
| Filtro Todas / Mías como píldoras `aria-pressed` | `select` + botón sin estilo |
| Sombra y densidad de tarjeta (`QueueView`) | Tarjeta plana |

### 1.2 Historial (`Historial.dc.html` → `UnifiedHistoryView.tsx`)

Prototipo: tabla (Solicitud, Diseñador, Entrega, Plazo, Estado actual), filtros Todas/Entregadas/Canceladas, píldora de SLA ("A tiempo" / "N días de retraso"), motivo de cancelación dentro de la fila, paginación Anterior/Siguiente. Hoy: lista simple sin diseñador, SLA, motivo ni filtros; **la paginación no tiene enlaces**, solo muestra "Página N".

### 1.3 Ficha (`Ficha*.dc.html` → `requests/[source]/[id]/view.tsx`)

1. Entregar siempre activo; el prototipo muestra "Disponible cuando termine la carga".
2. Zona de carga sin arrastrar y soltar, sin "quedan N cupos", sin la nota "Se valida la extensión y el tamaño, no el contenido".
3. Una sola barra de progreso global; el prototipo muestra una fila por archivo con progreso y cancelar. `resume` usa un `AbortController` nuevo y no se puede cancelar.
4. Estado con correcciones: el prototipo explica que la carga está pausada hasta reabrir, marca la "Entrega anterior" y avisa que no cuenta. Hoy, sin permiso de carga, el panel no dice nada.
5. Faltan los subtítulos "Escritas por Social Media" y la nota de que las instrucciones cambian solo vía corrección.
6. "Datos" repite formato y canales de la cabecera; el prototipo muestra Campaña, Temas y Prioridad.
7. El historial no muestra actor ("Abierta por Diseñador A").
8. Barra inferior móvil: el estado va como texto suelto junto al botón; en `FichaMovil` solo hay un botón principal.
9. Rótulos incoherentes: botón "Reabrir para corregir" y estado "Con correcciones" frente a "Devuelta con correcciones".

### 1.4 Código huérfano

`publications/QueueView.tsx` y `publications/history/HistoryView.tsx` conservan el marcado fiel al prototipo, pero **ningún archivo los importa**. Son la mejor referencia para copiar clases y estructura; **se eliminan al final** (tanda U3) para no dejar dos fuentes de verdad.

## 2. Qué se conserva de la UI actual y por qué

| Decisión actual | Razón | Consecuencia en el plan |
|---|---|---|
| Cola y filtro por origen unificados | Design atiende tres orígenes en una sola bandeja | Se mantiene el filtro de origen; se restyla como píldoras o `select` accesible, no se quita. |
| Chip de origen (Social Media / Interno / Eventos) | Distinguir de dónde viene cada pieza | Se añade al diseño del prototipo, junto al estado. |
| "Tomar y abrir" por origen | Acciones distintas por origen detrás de un solo botón | Misma función `take`; solo cambia el estilo. |
| `designRequestHref` | Rutas únicas | No se tocan. |
| Historial unificado con cancelaciones de los tres orígenes | Misma razón | La tabla del prototipo gana columna **Origen**. |
| Etiqueta de fecha por origen ("Publica", "Evento", "Requerida en tienda") | Cada origen tiene su fecha de uso | La fila "Publica vie 16 oct" del prototipo pasa a usar la etiqueta del origen. |
| Estados con correcciones en Interno y Eventos | Funcionalidad nueva | El chip y el botón "Ver correcciones" aplican a los tres. |
| Etiquetas de historial por origen | Cada origen usa su propio vocabulario | Se conservan; solo se les suma el actor. |
| Eventos con brief opcional | Decisión de producto | Se conserva el texto "el brief es opcional". |
| Carga múltiple, límites desde `capabilities` | Evitar valores fijos | La zona de carga nueva los sigue leyendo. |

## 3. Cambios de datos mínimos

Los chips y filas nuevos necesitan datos que `DesignRequest` aún no expone. Se añaden **campos opcionales** para no romper adaptadores ni tests existentes:

```ts
// src/lib/designRequests.ts, en DesignRequest
designer_name?: string | null;                       // "Tomada por X"
usage_date?: { label: string; value: string | null } | null; // Publica / Evento / Requerida en tienda
cancellation_reason?: string | null;                 // solo historial
```

Fuente de cada dato (**verifica cada RPC antes de usarlo; no asumas**):

- **Nombre del diseñador:** Social Media ya tiene `get_publication_designer_names(p_ids)`; Interno tiene `get_pendiente_designer_names(uuid[])`. Para Eventos comprueba si `get_design_event_queue` y `get_design_event_history` devuelven nombre; si no, pide una migración nueva que lo añada, **sin aplicarla**.
- **Fecha de uso:** SM `fecha_publicacion`; Interno `fecha_requerida`; Eventos `inicio`. Confirma que las RPC de cola/historial devuelven esas columnas.
- **Motivo de cancelación:** la versión anterior del historial lo cargaba (mira `git log -p -- 'src/app/(dashboard)/design/publications/history/page.tsx'` y `src/app/actions/publicaciones/workflow.ts`). Para Interno y Eventos revisa `pendiente_tienda_historial` y `evento_historial` (`motivo` donde `tipo = 'DISENO'`).
- **Entrega real y SLA:** `delivered_at` y `target_date` ya están; usa `getDesignSlaOutcome`.

Si un dato no existe en algún origen, la UI muestra "—" o lo omite; **nunca inventa un valor**.

## 4. Tandas

Cada tanda es un commit independiente y debe dejar la app compilando y los tests en verde.

### U0. Fundamentos de UI compartida (sin cambio visual aún)

1. Crear `src/lib/design/designTones.ts` o componentes en `src/app/(dashboard)/design/components/`:
   - `DesignStatusBadge({ status })`: colores del prototipo (Solicitada `#E6F0FB/#002F80`, En diseño `#E0F4FD/#05526F`, Devuelta con correcciones `#FDEBD0/#7A3E00`, Entregada `#E3F5EC/#0B6B3F`, Cancelada `#EFEDE8/#3C4663`).
   - `DueBadge({ estimate, today })`: mover desde `QueueView.tsx` (iconos `AlertCircle`/`Clock3`/`CircleHelp`, tonos de `getDesignDueTone`).
   - `OriginChip({ source })`.
   - `SlaPill({ estimate, delivered, cancelled })`: mover desde `HistoryView.tsx`.
2. En `designLabels.ts`: `REQUESTED: 'Solicitada'`, `NEEDS_CHANGES: 'Devuelta con correcciones'`. Revisa que ningún test ni vista dependa de "Por tomar" o "Con correcciones"; "Por tomar" queda solo como nombre de sección.
3. Añadir los campos opcionales de la sección 3 y rellenarlos en `adaptPublication`, `adaptInternal`, `adaptEvent` cuando el dato exista.

Criterios: tests de adaptadores actualizados y pasando; sin cambios visibles todavía salvo las etiquetas.

### U1. Cola (`UnifiedQueueView.tsx`, `publications/page.tsx`)

1. Estructura del prototipo `Main`: aviso azul, filtros, sección **Por tomar · N** (`REQUESTED`; se oculta con "Mías", como en `QueueView`) y sección **En curso · N** (`IN_PROGRESS` y `NEEDS_CHANGES`), cada una con su estado vacío.
2. Tarjeta con la rejilla de `QueueView` (`sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.72fr)_minmax(175px,0.58fr)_auto]`), título + origen + formatos/canales; columna con "Tomada por {designer_name} (tú)" o "Pendiente de asignación", fecha de uso con su etiqueta, entrega estimada; columna de `DesignStatusBadge` + `DueBadge`; acción a la derecha.
3. Acciones: `REQUESTED` → "Tomar y abrir" (misma función `take`); `NEEDS_CHANGES` → "Ver correcciones" (estilo primario); resto → "Abrir ficha".
4. Filtros: píldoras `aria-pressed` para Todas/Mías y un control de origen (píldoras o `select` con el mismo alto `min-h-11`). Mantener ambos filtros.
5. Cargar `designer_name` en `publications/page.tsx` con las RPC de la sección 3, en paralelo con las demás consultas.
6. Subtítulo de la página: "Una cola para Social Media, Interno y Eventos…" se conserva.

Criterios: con mezcla de orígenes y estados, el resultado coincide con `Main.dc.html` (secciones, chips, botones); en móvil, la tarjeta se apila en una columna sin desbordar.

### U2. Historial (`UnifiedHistoryView.tsx`, `history/page.tsx`)

1. Tabla del prototipo `Historial` con columnas **Solicitud** (título, origen + formatos, fecha de uso, motivo de cancelación si aplica), **Diseñador**, **Entrega**, **Plazo** (`SlaPill`), **Estado actual**. Mantener `min-w-[820px]` con scroll horizontal.
2. Filtros Todas / Entregadas / Canceladas.
3. **Paginación real:** enlaces Anterior/Siguiente a `/design/publications/history?page=N`. Con tres RPC, "Siguiente" se habilita si **cualquiera** devolvió 100 filas (documenta la limitación: el orden combinado es por página de cada origen).
4. "Estado actual": hoy la página fuerza `DELIVERED` o `CANCELLED`; conserva ese criterio y muestra el estado de origen cuando exista (En revisión, Programado, Publicado para Social Media; Entregada para Interno/Eventos).
5. Nota al pie del prototipo sobre cancelaciones y fecha de última entrega.

Criterios: página 2 alcanzable; las canceladas muestran su motivo; la píldora de SLA coincide con `getDesignSlaOutcome`.

### U3. Ficha (`requests/[source]/[id]/view.tsx`) y limpieza

1. **Entregar:** deshabilitar cuando `!capabilities.canDeliver`, o cuando no hay entregables nuevos desde que se tomó/reabrió la solicitud (usa `createdTime` de Drive contra `started_at`; si no puedes determinarlo, deja el botón activo y conserva el rechazo del servidor). Mostrar `deliverHint` ("Disponible cuando termine la carga") bajo el botón. **El servidor sigue siendo la barrera.**
2. **Zona de carga:** arrastrar y soltar además del selector; texto "quedan N cupos" (`maxFiles - files.length`), tipos y tamaño desde `capabilities.upload`, y la nota "Se valida la extensión y el tamaño, no el contenido". Conservar `multiple`.
3. **Progreso por archivo:** estado de lista de subidas (`{ name, progress, controller }[]`) con barra, "64 % · 2,1 de 3,3 MB" y botón Cancelar por archivo. Corregir `resume` para usar un controlador cancelable.
4. **Estado devuelto con correcciones:** si `design_status === 'NEEDS_CHANGES'` y no se puede cargar, mostrar "La carga está pausada. Reabre la solicitud para subir los archivos corregidos."; etiquetar los archivos existentes como **Entrega anterior** y mostrar "Para entregar de nuevo necesitas al menos un archivo nuevo. La entrega anterior no cuenta."
5. **Subtítulos:** "Escritas por {origen}" bajo Instrucciones y la nota "Las instrucciones no cambian después de la solicitud: cualquier ajuste llega como corrección."
6. **Datos:** quitar lo que ya está en la cabecera (formato/canales); para Social Media mostrar Campaña, Temas y Prioridad si existen datos (verifica `get_design_publication_request`); mantener filas propias de Interno y Eventos.
7. **Historial:** mostrar el actor cuando la RPC lo devuelva; si hace falta, ampliar `get_design_*_timeline` en una migración nueva (sin aplicar) para devolver `actor_name`.
8. **Barra móvil:** solo el botón principal (estado ya está en la cabecera).
9. Rótulos coherentes con U0 ("Devuelta con correcciones", botón "Reabrir para corregir").
10. **Limpieza:** borrar `publications/QueueView.tsx` y `publications/history/HistoryView.tsx` una vez U1 y U2 estén aprobadas; confirmar con `grep` que nada los importa.

Criterios: la ficha de cada origen sigue mostrando solo los bloques que le aplican (`fieldRules`); sin regresiones en subida/reanudación; la limpieza no deja imports rotos.

## 5. Reglas para Codex

1. Antes de escribir código lee `AGENTS.md` y la guía correspondiente de `node_modules/next/dist/docs/`: esta versión de Next.js puede diferir de lo que conoces.
2. Lee este plan, `README.md` de esta carpeta, `plan-ficha-unica-design.md` y `revision-ficha-unica.md`.
3. Usa los tokens existentes (`#0066D2`, `#002F80`, `#10233F`, `#FAF8F4`, `#E7E4DC`, Inter). Los prototipos usan estilos en línea; **no copies los estilos en línea**: tradúcelos a clases Tailwind del repo.
4. No añadas botones, filtros ni columnas fuera de este plan. No cambies permisos ni RPC de escritura.
5. Migraciones: solo si la sección 3 lo exige, con nombre nuevo, **sin aplicar a la base remota**. Antes parte de `supabase db pull` y revisa constraints, funciones y políticas desplegadas.
6. Por tanda: `npm run lint`, type-check y `npm test`. Añade tests de unidad para los campos nuevos de los adaptadores y para las etiquetas.
7. Revisa en 360 px y en escritorio, sin desbordes horizontales fuera de la tabla del historial.
8. Al terminar cada tanda actualiza la sección "Estado" de este documento.

## 6. Decisiones abiertas

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| P1 | ¿Filtro de origen como píldoras o `select`? | `select` en móvil, píldoras desde `sm`. |
| P2 | ¿Mostrar el chip de origen también en la ficha? | Sí, ya existe. |
| P3 | ¿Deshabilitar Entregar usando fechas de Drive en el cliente? | Sí cuando el dato exista; el servidor sigue validando. |
| P4 | ¿Actor en el historial exige migración? | Solo si las RPC actuales no lo traen. |

## 7. Estado

| Tanda | Estado |
|---|---|
| U0 | Pendiente |
| U1 | Pendiente |
| U2 | Pendiente |
| U3 | Pendiente |
