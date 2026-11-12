# Baseline de rutas — F0

Inventario de las entradas de ruta de `src/app/` al 11 de noviembre de 2026. Está hecho a partir de los archivos convencionales `page.tsx` y `route.ts` de Next.js App Router. Los grupos de rutas entre paréntesis no aparecen en la URL y los segmentos dinámicos se conservan como `[param]`.

Los `layout.tsx` se listan por separado porque componen segmentos existentes, pero no crean rutas por sí solos. No se encontraron otros archivos convencionales de entrada (por ejemplo `loading`, `error`, `template` o `default`) en esta revisión.

## Páginas

| Ruta | Tipo | Archivo |
| --- | --- | --- |
| `/` | page | `src/app/page.tsx` |
| `/access-pending` | page | `src/app/(auth)/access-pending/page.tsx` |
| `/design/events/[id]` | page | `src/app/(dashboard)/design/events/[id]/page.tsx` |
| `/design/internal` | page | `src/app/(dashboard)/design/internal/page.tsx` |
| `/design/internal/[id]` | page | `src/app/(dashboard)/design/internal/[id]/page.tsx` |
| `/design/internal/history` | page | `src/app/(dashboard)/design/internal/history/page.tsx` |
| `/design/publications` | page | `src/app/(dashboard)/design/publications/page.tsx` |
| `/design/publications/[id]` | page | `src/app/(dashboard)/design/publications/[id]/page.tsx` |
| `/design/publications/history` | page | `src/app/(dashboard)/design/publications/history/page.tsx` |
| `/design/registro` | page | `src/app/(dashboard)/design/registro/page.tsx` |
| `/design/requests/[source]/[id]` | page | `src/app/(dashboard)/design/requests/[source]/[id]/page.tsx` |
| `/events` | page | `src/app/(dashboard)/events/page.tsx` |
| `/events/archive` | page | `src/app/(dashboard)/events/archive/page.tsx` |
| `/events/calendar` | page | `src/app/(dashboard)/events/calendar/page.tsx` |
| `/events/calendar/archive` | page | `src/app/(dashboard)/events/calendar/archive/page.tsx` |
| `/events/calendar/list` | page | `src/app/(dashboard)/events/calendar/list/page.tsx` |
| `/events/inventory` | page | `src/app/(dashboard)/events/inventory/page.tsx` |
| `/events/list` | page | `src/app/(dashboard)/events/list/page.tsx` |
| `/internal/pendientes` | page | `src/app/(dashboard)/internal/pendientes/page.tsx` |
| `/internal/pendientes/archive` | page | `src/app/(dashboard)/internal/pendientes/archive/page.tsx` |
| `/login` | page | `src/app/(auth)/login/page.tsx` |
| `/requests` | page | `src/app/(dashboard)/requests/page.tsx` |
| `/requests/mine` | page | `src/app/(dashboard)/requests/mine/page.tsx` |
| `/requests/mine/[id]` | page | `src/app/(dashboard)/requests/mine/[id]/page.tsx` |
| `/social-media/campaigns` | page | `src/app/(dashboard)/social-media/campaigns/page.tsx` |
| `/social-media/efemerides` | page | `src/app/(dashboard)/social-media/efemerides/page.tsx` |
| `/social-media/grid` | page | `src/app/(dashboard)/social-media/grid/page.tsx` |
| `/social-media/grid/archive` | page | `src/app/(dashboard)/social-media/grid/archive/page.tsx` |
| `/social-media/kanban` | page | `src/app/(dashboard)/social-media/kanban/page.tsx` |
| `/social-media/requests` | page | `src/app/(dashboard)/social-media/requests/page.tsx` |
| `/social-media/shooting` | page | `src/app/(dashboard)/social-media/shooting/page.tsx` |
| `/staging` | page | `src/app/staging/page.tsx` |
| `/support` | page | `src/app/(dashboard)/support/page.tsx` |
| `/test-actions` | page | `src/app/test-actions/page.tsx` |
| `/third-parties` | page | `src/app/(dashboard)/third-parties/page.tsx` |

## Route handlers

| Ruta | Tipo | Archivo |
| --- | --- | --- |
| `/api/cron/purge-publicaciones` | route handler | `src/app/api/cron/purge-publicaciones/route.ts` |
| `/api/cron/sync-design-google-sheets` | route handler | `src/app/api/cron/sync-design-google-sheets/route.ts` |
| `/api/test-connections` | route handler | `src/app/api/test-connections/route.ts` |

## Layouts

| Segmento que compone | Archivo |
| --- | --- |
| Raíz de la aplicación | `src/app/layout.tsx` |
| Grupo `(dashboard)` (sin segmento URL propio) | `src/app/(dashboard)/layout.tsx` |
| `/design` | `src/app/(dashboard)/design/layout.tsx` |
| `/events` | `src/app/(dashboard)/events/layout.tsx` |
| `/internal` | `src/app/(dashboard)/internal/layout.tsx` |
| `/social-media` | `src/app/(dashboard)/social-media/layout.tsx` |

## Actualización

Para comparar la arquitectura futura, vuelve a enumerar los archivos `page.tsx`, `route.ts` y `layout.tsx` bajo `src/app/`, aplica las reglas de grupos y segmentos dinámicos indicadas arriba y actualiza las tablas. Revisa además las convenciones de rutas de la versión instalada de Next.js antes de incorporar nuevos tipos de entrada.
