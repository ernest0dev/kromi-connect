# Guía de implementación: perfil Interno

**Estado (2026-10-18):** implementación inicial en revisión visual. La vista de mapa forma parte de la primera entrega con fondo gris liso; solo se posterga la imagen geográfica. La especificación está en [`plan-rol-interno.md`](./plan-rol-interno.md) (gana ante cualquier diferencia) y las maquetas en [`prototypes/internal-map/`](./prototypes/internal-map).

**Ajuste local actual:** opciones nuevas `IMPRESION`, `SONIDO_INTERNO`, `REPARACION`, `OTRO` (se preservan `INSUMO` y `NECESIDAD` como valores históricos); brief de Drive como carga de archivos en lugar de enlace para nuevas solicitudes; SLA derivado de la fecha requerida en tienda (entrega a Design -2 días, límite del brief -5 días, estimación de Design +2 días calendario desde la solicitud); paginación con selector 10/25/50/100; y acción para crear un pendiente nuevo prellenado desde uno entregado o cancelado. La solicitud con diseño sigue requiriendo una tienda. La migración incremental pendiente de aplicar manualmente es `202610180003_internal_task_types.sql`.

## Antes de empezar

1. Las decisiones del flujo se fijan según el plan: solo solicitar desde `PENDIENTE`, retirar antes de inicio vuelve a `PENDIENTE`, y todo pendiente puede tener brief en Drive. No se requiere imagen ni coordenadas para esta entrega.
2. Leer `AGENTS.md` y la guía correspondiente de `node_modules/next/dist/docs/` antes de escribir rutas, acciones o layouts: esta versión de Next.js tiene cambios incompatibles.
3. Crear las migraciones en el repositorio para aplicación manual. No se aplican desde esta tarea. Antes de ejecutarlas en Supabase, contrastarlas con el esquema remoto (por ejemplo, con `supabase db pull`) y resolver diferencias allí.
4. En Git Bash (Windows), los scripts se ejecutan con `bash archivo.sh`.
5. Cada tanda termina con `npm run lint`, `npx tsc --noEmit`, `npm test` y, si toca interfaz, una revisión visual contra la maqueta indicada. Una tanda por rama o commit.
6. **No tocar** el código de publicaciones ni de Design existente: se duplica y adapta (D21). Los helpers de `src/lib/googleDrive.ts` y `src/lib/driveFileRules.ts` se reutilizan tal cual.

## Mapa de tandas

| Tanda | Contenido | Depende de | Maqueta |
|---|---|---|---|
| T0 | Revisar esquema local y preparar migraciones para aplicación manual | — | — |
| T1 | Migración 1: pendientes, historial, permisos Interno, RLS y RPC de tiendas | T0 | — |
| T2 | Tipos y lógica de dominio (`src/lib/internalTasks.ts`) | T1 | — |
| T3 | Acciones de servidor, acceso, rutas y menú | T1, T2 | — |
| T4 | Mapa funcional sobre fondo gris | T3 | `Main`, `Movil`, `Estados` |
| T5 | Listado, Archivo y formularios sin diseño; entrega inicial usable | T3 | `Lista`, `Archivo`, `Formulario` |
| T6 | Migración 2: Drive, solicitud a Design, RPC y permisos de Design | T1 | — |
| T7 | Lado Interno: brief siempre disponible; solicitud condicionada a diseño | T5, T6 | `Formulario`, `CrearBrief`, `Editar`, `Detalle`, `Estados` |
| T8 | Lado Design: cola, ficha, historial, entregables, entrega | T6, T7 | (existentes) |
| T9 | Conciliación al aplicar en remoto, pruebas con cuentas reales y actualización de SRS/esquema | T1 a T8 | — |

T5 entrega una versión usable sin diseño; T7 y T8 añaden el flujo con Design.

## T0. Preparación

- Confirmar los nombres/códigos de las tiendas existentes que consumirá el formulario.
- Revisar el esquema del repositorio y usarlo como base de las migraciones. La conciliación contra remoto se realiza antes de aplicarlas manualmente.
- No se añade imagen, coordenadas ni módulo de mapa en esta entrega.

## T1. Migración 1: pendientes y permisos del Interno

**Archivo:** `supabase/migrations/202610180001_internal_store_tasks.sql`

**Contenido** (plan §6 a §8):
- RPC `list_internal_stores` con acceso controlado, para devolver solo los campos del catálogo que necesita el formulario; no modifica `inventario_sedes`.
- Tablas `pendientes_tienda` (incluidas las columnas de diseño y de Drive), `pendiente_tienda_historial` (inmutable) y sus índices, `CHECK` y triggers (`version`, `updated_at`, bloqueo de columnas `drive_*` y `diseno_*` para `authenticated`).
- Permisos `internal.store-tasks.{read,create,update,status.update,archive}` en `app_permissions` y `role_permissions` solo para `internal`.
- RLS de lectura (`has_permission` y `creado_por = auth.uid()`), sin grants de escritura a `anon` ni `authenticated`.
- RPC `SECURITY DEFINER` con `search_path = ''`: `list_internal_stores`, `list_store_tasks`, `get_store_task`, `create_store_tasks`, `update_store_task`, `transition_store_task_status`, `archive_store_task`, `restore_store_task`.
- Errores `CONFLICTO_VERSION`, `MOTIVO_REQUERIDO`, `FALTAN_DATOS`.

Seguir el estilo de `202610150001_events_schedule.sql`. No aplicar a remoto sin que el usuario lo ordene.

**Aceptación:** la migración es idempotente donde corresponda; solo el rol `internal` obtiene los permisos; `anon` y `authenticated` no escriben directamente; transiciones y motivos según plan §4.

<details><summary>Prompt para Kilo Code</summary>

```
Lee AGENTS.md, docs/design/plan-rol-interno.md (§3, §4, §6, §7, §8) y docs/design/implementacion-rol-interno.md (T1). Toma como modelo supabase/migrations/202610150001_events_schedule.sql.
Crea supabase/migrations/202610180001_internal_store_tasks.sql con: tablas pendientes_tienda y pendiente_tienda_historial, permisos internal.store-tasks.*, RLS, y las RPC de pendientes de §8.1 (sin las de carga/Design), incluyendo list_internal_stores sin modificar inventario_sedes. No toques otros archivos. No apliques la migración. Al terminar, lista las decisiones que tomaste y qué no pudiste verificar.
```
</details>

## T2. Tipos, lógica pura y pruebas

**Archivos:** `src/lib/internalTasks.ts`, `src/lib/internalTasks.test.ts` (jest + ts-jest, como `events.test.ts` e `inventory.test.ts`).

**Contenido:** constantes y tipos (tipos, estados, estados de diseño, etiquetas), indicadores derivados con la fecha de hoy en America/Caracas (§4.3), transiciones permitidas (§4.2), validación del formulario (incluye reglas de solicitud, §3.1) y reglas de archivos (reutiliza `DRIVE_FILE_RULES`). La proyección geográfica se implementará con el mapa.

**Aceptación:** indicadores en los bordes (hoy, +2 días, ayer), transiciones válidas e inválidas, solicitud solo desde `PENDIENTE`, y validación del brief y del formulario.

<details><summary>Prompt para Kilo Code</summary>

```
Lee AGENTS.md y docs/design/plan-rol-interno.md (§3, §4, §5). Mira src/lib/events.ts y src/lib/inventory.ts para el estilo.
Crea src/lib/internalTasks.ts y su prueba con: tipos y etiquetas, indicadores derivados (America/Caracas), urgencia, transiciones y validación del formulario y de la solicitud a Design (solo desde PENDIENTE). Solo lógica pura, sin React ni Supabase. Ejecuta npm test y tsc.
```
</details>

## T3. Acciones, acceso, rutas y menú

**Archivos nuevos:** `src/app/actions/internal/tasks.ts` (acciones que llaman a las RPC); `src/app/(dashboard)/internal/layout.tsx` y `shell.tsx` (modelo: `events/layout.tsx` y `shell.tsx`); `internal/pendientes/page.tsx` y `archive/page.tsx` con cargadores que leen filtros de la URL.
**Archivos a modificar:** `src/lib/auth/permissions.ts` (permisos nuevos en el tipo si hace falta), `src/lib/auth/dal.ts` (guardia `requireInternalAccess` o equivalente), `src/app/actions/auth.ts`, `src/app/(auth)/login/page.tsx` y `access-pending/page.tsx` (redirigir a `/internal/pendientes` con `internal.store-tasks.read`).

**Menú:** un solo ítem **Pendientes**. Sin acceso a `/support` ni `/third-parties`.

**Aceptación:** un usuario `internal` con permisos aterriza en `/internal/pendientes` (Mapa); sin permisos no entra; un usuario de otro rol no entra.

<details><summary>Prompt para Kilo Code</summary>

```
Lee AGENTS.md y la guía de Next en node_modules/next/dist/docs/ para layouts, rutas y server actions. Lee docs/design/implementacion-rol-interno.md (T3) y mira src/app/(dashboard)/events/{layout,shell}.tsx, src/lib/auth/dal.ts y src/app/actions/auth.ts.
Crea la sección /internal con layout, shell de un solo ítem "Pendientes", las rutas pendientes y pendientes/archive (páginas mínimas por ahora), las acciones de servidor que llaman a las RPC de T1, y la redirección de login/access-pending para el rol internal. No toques publicaciones ni Design.
```
</details>

## T4. Mapa funcional con fondo gris

La vista de mapa forma parte de la primera entrega. Presenta resumen, marcadores por tienda posicionados con las coordenadas provisionales del plan, colores por urgencia, tiendas fuera del encuadre en una franja inferior y panel contextual al seleccionar una tienda. El fondo inicial es gris liso y no dibuja calles ni límites geográficos. La imagen geográfica se posterga hasta que el equipo la provea y valide sus límites.

**Referencia:** `Main.dc.html`, `Movil.dc.html` y `Estados.dc.html`.

**Aceptación:** el mapa es la vista inicial, cada marcador es accesible y abre su tienda, San Felipe aparece fuera del encuadre, y el panel muestra pendientes agrupados por tipo y permite iniciar uno nuevo para esa tienda. Los filtros Tipo y Estado actualizan marcadores, resumen y panel.

## T5. Listado, Archivo y formularios sin diseño

**Archivos:** `internal/pendientes/TaskListView.tsx`, `StoreMapView.tsx`, `TaskDrawer.tsx` (crear, editar y detalle), Archivo.

**Referencia:** `Lista`, `Archivo`, `Formulario`, `Editar` y `Detalle` (sin la parte de diseño todavía). Listado tabular paginado y formularios/detalle en panel lateral. Crear permite varias tiendas sin diseño; cambio de estado con motivo donde corresponda; conflicto de versión (`Estados`).

**Aceptación:** Listado es la ruta `/internal/pendientes`; se crea, edita, avanza, cancela con motivo, archiva y restaura; el historial muestra quién y cuándo; el conflicto de versión ofrece recargar.

<details><summary>Prompt para Kilo Code</summary>

```
Lee docs/design/plan-rol-interno.md §3, §4 y §9 y abre las maquetas Lista, Archivo, Formulario, Editar y Detalle de docs/design/prototypes/internal-map/. Implementa el listado, el archivo y los paneles de crear, editar y detalle SIN la sección de diseño (se añade en T7). Usa las acciones de T3. Cubre conflicto de versión y motivos obligatorios.
```
</details>

## T6. Migración 2: Drive y solicitud a Design

**Archivo:** `supabase/migrations/202610180002_internal_design_requests.sql`.

**Contenido** (plan §6.2, §6.4, §7, §8): tabla `pendiente_drive_uploads` (modelo: `publicacion_drive_uploads`), RPC `sync_pendiente_drive_brief`, `reserve_pendiente_brief_upload`, `reserve_pendiente_deliverable_upload`, `request_pendiente_to_design`, `retract_pendiente_design_request`, `get_design_internal_queue`, `get_design_internal_history`, `get_design_internal_request`, `design_start_internal_request`, `design_deliver_internal_request`, `get_pendiente_designer_names`, y permisos `design.internal.*` solo para `design`.

Las RPC que dependen de Drive son solo para `service_role`. Las de Design devuelven únicamente los campos de §6.4. Modelo: migraciones `202610110001`, `110002`, `120001`, `130001`.

**Aceptación:** Design no puede leer `pendientes_tienda` directamente; `request_pendiente_to_design` exige dueño, casilla, instrucciones, fecha y brief verificado hace menos de 5 minutos; un diseñador sin permiso no abre ni entrega.

<details><summary>Prompt para Kilo Code</summary>

```
Lee docs/design/plan-rol-interno.md §3.1, §6, §7 y §8 y las migraciones supabase/migrations/202610110001, 202610110002, 202610120001 y 202610130001 como modelo (cargas a Drive, solicitud a Design, cola de Design).
Crea supabase/migrations/202610180002_internal_design_requests.sql con las tablas y RPC de §8.1 para cargas a Drive, solicitud y lado Design, y los permisos design.internal.*. Reutiliza el patrón service_role-only para lo que depende de Drive. No apliques la migración y no modifiques las de publicaciones.
```
</details>

## T7. Lado Interno de la solicitud

**Archivos nuevos:** `src/app/actions/internal/{drive,design}.ts` (duplican y adaptan `actions/publicaciones/drive.ts` y `workflow.ts`; llaman a las RPC de T6), `internal/pendientes/PendienteDriveFiles.tsx` (adapta `PublicationDriveFiles.tsx`), `DesignRequestSection.tsx`.
**Archivos a ampliar:** `TaskFormPanel.tsx`, `TaskDetailPanel.tsx`.

**Referencia:** `Formulario`, `CrearBrief`, `Editar` (aviso ámbar de fechas, tarjeta con requisitos), `Detalle` y `Estados` (sin carpeta de Drive, archivos con error, diseño ya abrió, cancelar con diseño en curso).

**Reglas:** el brief está disponible en todos los pendientes y admite 10 archivos de 100 MB; se sube desde el detalle después de guardar; la casilla de diseño viene marcada solo en `IMPRESION`; con diseño se elige una sola tienda; instrucciones hasta 4000; fecha de entrega a Design = fecha requerida en tienda menos dos días calendario, límite del brief = fecha requerida menos cinco días, estimación de Design = dos días calendario desde la solicitud; solicitar exige estar en `PENDIENTE` y un archivo verificado hace menos de 5 minutos; solicitar cambia a `EN_PROCESO`; retirar solo en `SOLICITADO` devuelve a `PENDIENTE`. Desde entregado o cancelado se crea un pendiente nuevo prellenado, con carpeta nueva. Editar la casilla no borra la carpeta ni los archivos; su sincronización detallada con Drive queda fuera de esta entrega.

**Aceptación:** el flujo crear → guardar → subir brief sin diseño funciona; con diseño: crear → guardar → subir brief → solicitar desde `PENDIENTE` → retirar devuelve a `PENDIENTE`; la carga va directa del navegador a Drive; los avisos y estados de error corresponden a las reglas del plan.

<details><summary>Prompt para Kilo Code</summary>

```
Lee docs/design/plan-rol-interno.md §3.1, §8.3 y §9, y abre las maquetas Formulario, CrearBrief, Editar, Detalle y Estados de docs/design/prototypes/internal-map/. Mira src/app/actions/publicaciones/{drive,workflow}.ts, src/app/(dashboard)/social-media/grid/components/PublicationDriveFiles.tsx, src/lib/googleDrive.ts y src/lib/driveFileRules.ts.
Duplica y adapta (sin modificar los originales) las acciones y el componente de brief para pendientes, usando las RPC de T6, y añade la sección "Requiere diseño" a crear, editar y detalle. Cumple las reglas del plan y los estados de las maquetas.
```
</details>

## T8. Lado Design

**Archivos nuevos:** `src/app/(dashboard)/design/internal/{page,QueueView}.tsx`, `[id]/{page,detail}.tsx`, `history/page.tsx`, `src/app/actions/internal/design-work.ts`.
**Archivos a modificar:** `design/DesignWorkspaceNav.tsx` y el layout/shell de Design para añadir el ítem **Pendientes del Interno** con `design.internal.read`.

**Referencia:** se copia la estructura de `design/publications/*` cambiando la fuente de datos; no hay maqueta nueva. La ficha muestra instrucciones y brief, fechas, tienda y cantidad; **no** muestra `detalle` ni `enlace_referencia`.

**Aceptación:** Design ve la cola, abre la solicitud (queda registrado quién), sube entregables solo en `EN_DISENO`, entrega con al menos un archivo posterior al inicio, y el Interno ve los entregables en su detalle sin que el pendiente cambie de estado.

<details><summary>Prompt para Kilo Code</summary>

```
Lee docs/design/plan-rol-interno.md §6.4, §8 y §9. Copia y adapta, sin modificar los originales, src/app/(dashboard)/design/publications/* y las acciones de Design de publicaciones para las solicitudes del Interno (/design/internal), usando las RPC de T6, y añade el ítem de menú. Design no debe ver detalle ni enlace de referencia del pendiente.
```
</details>

## T9. Verificación y cierre

1. `supabase db pull` y comparar tablas, grants, RLS, triggers y RPC con las migraciones.
2. Probar con una cuenta `internal` y una `design` reales: crear, subir brief, solicitar, tomar, cargar entregables, entregar, marcar `LISTO` y `ENTREGADO`, archivar; confirmar que `social-media` no ve nada de esto.
3. Actualizar el SRS §7.2 y §7.3, `docs/supabase-db-migration.md`, `docs/perfiles-de-usuario.md` (estado) y el README de diseño con el estado real.
4. Recoger las correcciones del equipo (C7) y decidir si hace falta un ciclo de corrección (fase 5).
5. Guardar capturas en `docs/design/screenshots/` para comparar con las maquetas.
