# Revisión de la ficha única de Design (commit `811ba33`)

Revisión del código implementado a partir de [`plan-ficha-unica-design.md`](./plan-ficha-unica-design.md), con propuestas para la UI de Design y para las UIs de quienes solicitan diseño (Social Media, Interno, Eventos).

**Límites de la revisión.** Se leyó el código; no se vio la ficha renderizada. Los tests de `detailAdapters.test.ts` no se pudieron ejecutar en el entorno de revisión (sin `node_modules`). La migración `20261020011400_design_request_details.sql` se revisó solo como SQL.

## Lo que está bien

- Contrato común `DesignRequestDetail` con adaptadores por origen, `capabilities` y `fieldRules`; la vista no ramifica por origen.
- Las rutas anteriores (`/design/publications/[id]`, `/design/internal/[id]`, `/design/events/[id]`) redirigen a `/design/requests/[source]/[id]`.
- En Social Media el servidor exige un entregable nuevo en Drive antes de `EN_REVISION_CM`; en Eventos lo exige `design_deliver_event_request`. No hay hueco de seguridad en la entrega.

## 1. Bugs y regresiones (Design)

| # | Hallazgo | Dónde | Arreglo |
|---|---|---|---|
| 1.1 | La prioridad nunca se muestra: se compara con `['HIGH','NORMAL','LOW']` pero `prioridad` es numérica (1/2/3). | `src/lib/design/detailAdapters.ts` | Mapear 1/2/3 a un valor del contrato. |
| 1.2 | Etiquetas de historial erróneas: el mapeo manda a `DELIVERED` todo lo no reconocido (`EN_REVISION_CM`, `RECHAZADO_DISENO` se leerían "Entregado"). Interno y Eventos traen `nuevo->>'estatus'` o "Solicitud actualizada". | `view.tsx` | Mapa de etiquetas por origen; fallback al texto crudo. |
| 1.3 | Chips duplicados en Social Media: `adaptPublication` mete los canales en `requested_outputs` y la cabecera además pinta los canales de `source_context`. | `designRequests.ts`, `view.tsx` | Mostrar cada canal una sola vez. |
| 1.4 | Los Stories pierden el copy: `copy: null` si `format === 'STORY'`. | `detailAdapters.ts` | Ocultar solo si está vacío (`hasContent`). |
| 1.5 | El botón Entregar siempre está activo; el servidor rechaza sin explicar. | `view.tsx` (`ActionBar`) | Deshabilitar según `capabilities` y mostrar `deliverHint`. |
| 1.6 | Uploader: `AbortController` nuevo por subida (no se puede cancelar en curso), un archivo por vez, tope 20 escrito a mano, MIME de Eventos tomado del cliente. | `view.tsx` (`FilesPanel`), `actions/events/drive.ts` | Cancelación real, varios archivos, tope desde `capabilities.upload`, MIME derivado en servidor. |

## 2. Mejoras de diseño y practicidad (Design)

- Botón "Siguiente solicitud" tras entregar.
- Cola con urgencia visible (vencida / hoy / próxima), origen, diseñador, filtros por origen y "mías / sin tomar".
- Historial con actor en cada evento.
- Fechas con hora, no solo día.
- Miniaturas del brief y de los entregables, reutilizando el componente del solicitante.
- Aviso al diseñador cuando las instrucciones están vacías o son muy cortas.

## 3. Coherencia en las UIs de los solicitantes

Estado actual:

- **Social Media** (`TicketEditModal`): envío a Design por `StatusSelect`, no por botón junto a las instrucciones; tiene correcciones y `DeliverablesReview` con miniaturas.
- **Interno** (`TaskDrawer`, `TaskBriefPanel`): botones de solicitar y retirar dentro del panel de brief, colapsado por defecto; estado crudo (`SOLICITADO`, `EN_DISENO`); entregables como enlaces simples; uploader propio.
- **Eventos** (`ScheduleView`): "El brief se puede adjuntar después", pero no existe acción para subir brief; el detalle muestra `diseno_estatus` crudo y no lista entregables.

Propuestas:

1. Componente compartido **"Solicitud a Design"**: instrucciones, fecha, formatos, archivos del brief, estado legible (`DESIGN_STATUS_LABELS`) y botón solicitar/retirar.
2. `DeliverablesReview` generalizado a los tres orígenes.
3. Eventos: añadir subida de brief o retirar el texto que la promete.
4. Interno: CTA "Solicitar a Design" visible sin abrir el panel.
5. Longitud mínima de instrucciones al solicitar, en los tres orígenes.
6. Correcciones (`EN_CORRECCION`/reabrir) también en Interno y Eventos; requiere estado, RPC y UI.
7. Reutilizar `src/lib/driveResumableUpload.ts` y eliminar el uploader propio de Interno.

## 4. Tandas

| Tanda | Contenido | Migración |
|---|---|---|
| A | 1.1–1.5 | No |
| B | 1.6 y MIME en servidor | No |
| C | 3.1, 3.2, 3.4, 3.5, 3.7 y mejoras de la sección 2 | No |
| D | 3.3 (brief de Eventos) y 3.6 (correcciones fuera de Social Media) | Sí |

Antes de la tanda A: instalar dependencias y ejecutar `npm test`.

## 5. Prompts para Kilo

Antes de cada prompt: leer `AGENTS.md` y la guía relevante en `node_modules/next/dist/docs/`.

### Tanda A

> Lee `docs/design/revision-ficha-unica.md` (secciones 1.1–1.5) y `docs/design/plan-ficha-unica-design.md`. En `src/lib/design/detailAdapters.ts`: mapea `prioridad` numérica (1/2/3) al valor del contrato; no anules `copy` por ser `STORY`, ocúltalo solo si está vacío. En `designRequests.ts`/`view.tsx`: muestra cada canal una vez. En `view.tsx`: reemplaza el mapeo de historial por un mapa de etiquetas por origen con fallback al texto crudo; deshabilita Entregar según `capabilities` y muestra `deliverHint`. Actualiza `detailAdapters.test.ts` con casos para prioridad, Story con copy y canales sin duplicar. Ejecuta `npm test`, `npm run lint` y el type-check. No toques migraciones.

### Tanda B

> Lee la sección 1.6 de `docs/design/revision-ficha-unica.md`. En `FilesPanel` (`view.tsx`): usa un `AbortController` por subida guardado en estado para poder cancelar; permite seleccionar varios archivos con subida secuencial; toma el tope y el tamaño máximo de `capabilities.upload`. En `src/app/actions/events/drive.ts`: deriva el MIME en el servidor y no compares `input.mimeType` del cliente. Reutiliza `src/lib/driveResumableUpload.ts`. Sin migraciones.

### Tanda C

> Lee las secciones 2 y 3 de `docs/design/revision-ficha-unica.md`. Crea un componente compartido "Solicitud a Design" y úsalo en `TicketEditModal`, `TaskDrawer` y `ScheduleView`; generaliza `DeliverablesReview` a los tres orígenes (sin cambiar el comportamiento de Social Media); saca el CTA de Interno del panel colapsado; exige longitud mínima de instrucciones al solicitar; sustituye el uploader propio de Interno por `driveResumableUpload.ts`. En Design: botón "Siguiente solicitud", urgencia y filtros en la cola, actor y hora en el historial. Sin migraciones.

### Tanda D

> Lee 3.3 y 3.6 de `docs/design/revision-ficha-unica.md`. Prepara una migración nueva (sin aplicarla) y las acciones/UI para subir el brief de Eventos y pedir/reabrir correcciones para Interno y Eventos. Si la CLI no puede conciliar el remoto, usa el historial y las definiciones de `supabase/migrations/` como base confirmada por el usuario; no vuelvas a aplicar migraciones existentes.

**Estado posterior:** el usuario confirmó que el historial remoto llega hasta `20261021030127`. La implementación de D está preparada en `20261021030128_event_brief_design_corrections.sql`; falta aplicarla en Supabase.
