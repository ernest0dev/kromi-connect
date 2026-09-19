# Seguimiento de desarrollo: auditoría de implementación frente al SRS

> Estado del análisis: auditoría estática y validación técnica del proyecto principal (`main`).
>
> Fecha de corte: 2026-09-17.
>
> Documento de referencia: `docs/kromi-connect-srs.md`.
>
> Alcance: rutas App Router, componentes, Server Actions, tipos, documentación, pruebas y configuración de validación.

---

## 1. Resumen ejecutivo

El proyecto **no cumple todavía con el SRS de forma integral**. Existe una base operativa parcial para planificación, Kanban, creación de tickets, Drive, solicitudes, rodaje básico y campañas, pero varias funciones están incompletas, algunas acciones son incompatibles con el esquema documentado y faltan módulos completos de las fases 2 a 5.

### Cobertura estimada

| Área | Cobertura aproximada | Dictamen |
|---|---:|---|
| Fase 1: parrilla, Kanban y briefing | 45–55% | Base visible implementada, flujos incompletos |
| Fase 2: producción, rodaje y assets | 10–20% | Vista básica y enlace a Drive; sin checklist/PWA/visor real |
| Fase 3: terceros y aprobaciones | 15–25% | Inbox parcial; conversión y QA incompletos |
| Fase 4: inventario y campañas | 5–15% | Campañas básicas; sin inventario ni efemérides |
| Fase 5: analytics y escucha social | 0–5% | No existe el módulo requerido |
| **Total funcional verificable** | **25–40%** | **Falta una parte mayoritaria del SRS** |

La cobertura aparente es mayor si se cuentan los tipos TypeScript y la documentación como implementación. La cobertura operativa real, considerando flujos que pueden completarse de extremo a extremo, se acerca más al 25–30%.

## 2. Metodología y limitaciones

Se revisaron:

- El SRS completo en `docs/kromi-connect-srs.md`.
- Rutas y componentes bajo `src/app/`.
- Server Actions bajo `src/app/actions/`.
- Tipos bajo `src/types/`.
- Integraciones con Supabase y Google Drive.
- Documentación técnica en `docs/`.
- Configuración de build, lint y pruebas.
- Pruebas E2E e integración existentes.

También se ejecutaron:

- `pnpm build`: compilación y TypeScript correctos.
- `pnpm lint`: falló con errores y warnings.
- `pnpm test:e2e`: no pudo iniciar porque falta el navegador Playwright instalado.
- Una consulta de solo lectura contra Supabase: falló con `TypeError: fetch failed`.

La consulta contra Supabase no permitió confirmar en vivo el estado de tablas, columnas, seed data o políticas RLS. Por ello, las afirmaciones de `docs/supabase-db-migration.md` sobre una migración ejecutada y verificada se tratan como documentación declarativa, no como evidencia verificada en esta auditoría.

La imagen `docs/supabase-schema-public.png` no pudo ser inspeccionada por el modelo de esta sesión y no se usó como evidencia adicional.

## 3. Inventario de rutas actuales

El layout operativo está definido en `src/app/(dashboard)/layout.tsx:32-88`. El build genera las siguientes rutas App Router:

| Ruta | Estado frente al SRS | Hallazgo principal |
|---|---|---|
| `/` | Fuera del SRS operativo | Landing estática de presentación |
| `/campaigns` | Parcial | Listado y creación básica de campañas |
| `/grid` | Parcial | Calendario macro, filtros y drag-and-drop |
| `/kanban` | Parcial | Tablero por estatus y drawer de detalle |
| `/shooting` | Parcial | Lista de rodaje básica |
| `/requests` | Parcial | Inbox y aprobación/rechazo básico |
| `/third-parties` | Extra/no alineado | Directorio de terceros no definido en el SRS |
| `/support` | Extra/no alineado | Módulo de incidencias con schema distinto |
| `/test-actions` | Herramienta interna | Página de prueba con escritura directa |
| `/api/test-connections` | Diagnóstico | Endpoint de conexión Supabase/Drive |

No existen rutas ni aliases para:

- `/dashboard`
- `/parrilla`
- `/rodaje`
- `/solicitudes`
- `/reportes`

Tampoco existe `src/app/(dashboard)/page.tsx`, por lo que el layout lateral no tiene una página `/dashboard` propia.

## 4. Hallazgos por módulo

### 4.1 Dashboard operativo

**Estado: no implementado.**

El SRS solicita `/dashboard` con resumen operativo, alertas de SLA vencido/próximo y accesos rápidos (`docs/kromi-connect-srs.md:59-60`).

En el código actual:

- No existe la ruta `/dashboard`.
- No hay dashboard, KPIs, alertas ni accesos rápidos operativos.
- El layout muestra un perfil “Social Media Manager”, sedes y la etiqueta SLA como contenido estático: `src/app/(dashboard)/layout.tsx:92-127`.
- No hay autenticación ni selección real de rol.

### 4.2 Parrilla, calendario, Kanban y spreadsheet

**Estado: parcial.**

Implementado:

- Calendario mensual en `/grid`.
- Navegación entre meses.
- Filtro por formato.
- Drag-and-drop para mover una publicación a otra fecha.
- Tarjetas de detalle con fecha límite de brief y enlace a Drive.
- Kanban separado en `/kanban`.

Evidencia:

- `src/app/(dashboard)/grid/GridClientView.tsx:30-102`
- `src/app/(dashboard)/grid/GridClientView.tsx:122-235`
- `src/app/(dashboard)/grid/GridClientView.tsx:239-315`
- `src/app/(dashboard)/kanban/KanbanClientView.tsx:12-50`

Faltantes o desviaciones:

- No existe una ruta `/parrilla`.
- No hay vista tipo spreadsheet.
- Calendario y Kanban son rutas separadas, no tres vistas sobre el mismo componente/dataset como plantea el SRS.
- No hay edición completa del ticket desde la parrilla.
- No hay alertas de SLA vencido/próximo.
- No hay una capa visual de efemérides.
- No hay persistencia o sincronización de vistas tipo tabla.

### 4.3 Editor de ticket / briefing

**Estado: parcial.**

El modal global captura:

- Título.
- Formato.
- Línea comercial.
- Fecha de publicación.
- Hook.
- Body.
- CTA.
- Hashtags.

Evidencia: `src/app/(dashboard)/components/NewTicketModal.tsx:102-212`.

Desviaciones:

- Es un formulario único, no un editor multi-tab.
- No existen pestañas para Brief a Diseño, Guion de Rodaje e Historial de Revisiones.
- No hay versionado visible de copy.
- No hay historial de revisiones ni retornos explícitos.
- No hay campos para diseñador, campaña, canales, sede o checklist.
- La acción que recibe el formulario no persiste hook, body, CTA ni hashtags, como se detalla en la sección 5.2.

### 4.4 Quick Reschedule y SLA 3+2

**Estado: parcialmente implementado.**

Existe lógica pura para:

- `fecha_limite_brief = fecha_publicacion - 5 días`.
- `fecha_entrega_diseno_estimada = fecha_solicitud_diseno + 2 días`, cuando existe la solicitud.

Evidencia: `src/utils/sla.ts:16-39`.

Existe una Server Action que:

- Lee la publicación.
- Recalcula fechas.
- Actualiza `fecha_publicacion`, `fecha_limite_brief` y `fecha_entrega_diseno_estimada`.
- Revalida `/grid` y `/kanban`.

Evidencia: `src/app/actions/recalculateSlaDates.ts:24-82`.

Limitaciones:

- La creación normal de publicaciones no calcula las fechas SLA.
- No hay una fecha explícita de límite de rodaje en el schema actual.
- No se registra ni calcula cumplimiento de SLA con `fecha_entrega_diseno_real`.
- No hay alertas de vencimiento.
- No hay pruebas unitarias de la función SLA.
- El cambio de fecha no gestiona de forma integral estados, rodaje, diseño, revisión o aprobaciones.

### 4.5 Kanban

**Estado: parcial.**

Implementado:

- Columnas por estatus.
- Tarjetas con formato, fecha y límite de brief.
- Drawer con fechas, copy y enlace a Drive.
- Cambio de fecha desde el drawer.

Evidencia: `src/app/(dashboard)/kanban/KanbanClientView.tsx:29-50` y `:112-230`.

Faltantes:

- El tablero define 7 columnas, mientras el enum del SRS tiene 9 estados.
- Faltan columnas explícitas para `RECHAZADO_DISENO` y `PENDIENTE_APROBACION_GERENCIA`.
- No hay drag-and-drop entre columnas.
- No hay transiciones controladas de estado.
- No hay asignación de diseñador.
- No hay historial de cambios.
- No hay flujo de revisión/corrección/aprobación.
- El drawer es principalmente de lectura, salvo la fecha de publicación.

### 4.6 Google Drive y assets

**Estado: parcial.**

Implementado:

- Cliente de Google Drive con service account.
- Creación de carpeta por publicación.
- Persistencia de `drive_folder_url`.
- Enlaces externos a la carpeta desde grid, Kanban y rodaje.

Evidencia:

- `src/lib/googleDrive.ts:5-30`
- `src/lib/googleDrive.ts:41-75`
- `src/app/actions/createPostWithDrive.ts:22-43`

Faltantes o riesgos:

- No hay visor de thumbnails.
- No hay ingesta de assets desde Drive.
- No hay paquete QA pre-publicación.
- La acción guarda URL, pero no guarda de forma consistente `drive_folder_id`.
- Los errores de creación de carpeta se convierten en `null` y la publicación puede crearse igualmente: `src/lib/googleDrive.ts:72-75`.
- La carpeta recibe permiso de lectura pública (`type: anyone`), lo cual debe revisarse frente a la política de seguridad deseada.
- No hay validación de permisos, subida, descarga, versión de assets o trazabilidad de archivos.

### 4.7 Rodaje

**Estado: parcial y con inconsistencias técnicas.**

La vista `/shooting` muestra publicaciones y permite enviarlas a diseño:

- `src/app/(dashboard)/shooting/ShootingClientView.tsx:11-30`
- `src/app/actions/shooting.ts:12-32`
- `src/app/actions/shooting.ts:38-56`

Desviaciones:

- No consume `checklist_rodaje`.
- No muestra tomas requeridas, áreas de tienda ni estado por checklist.
- El filtro por sede se hace sobre `linea_contenido`, no sobre un campo estructurado de sede.
- La acción consulta `.eq("sede", ...)` sobre `publicaciones`, pero `sede` no existe en `src/types/database.types.ts` ni en el schema SRS.
- La actualización escribe `updated_at` directamente sobre `publicaciones`, campo que tampoco está definido en el schema SRS/tipos actuales.
- No hay manifiesto PWA, service worker, modo offline ni experiencia móvil específica.

### 4.8 Solicitudes de terceros

**Estado: parcial e incompatible con el flujo especificado.**

La UI muestra solicitudes y botones aprobar/rechazar:

- `src/app/(dashboard)/requests/RequestsClientView.tsx:54-120`
- `src/app/actions/requests.ts:7-20`

La conversión actual:

- Crea una publicación con título derivado de los primeros 50 caracteres de la descripción.
- Usa formato `POST` por defecto.
- Usa la fecha sugerida o la fecha actual.
- Calcula fechas SLA.
- Marca la solicitud como `APROBADO`.

Evidencia: `src/app/actions/requests.ts:22-80`.

No cumple el SRS porque:

- No copia `descripcion` a `body_texto`.
- No copia `materiales_adjuntos_url` a una referencia de Drive.
- No asigna `solicitudes_terceros.publicacion_id`.
- No usa el estado `CONVERTIDA`.
- No crea carpeta Drive para la solicitud convertida.
- No es transaccional: puede quedar la publicación creada y la solicitud sin actualizar si falla un paso posterior.
- No permite completar el brief antes de convertir.
- No existe el Modal C de QA pre-publicación.

### 4.9 Campañas

**Estado: básico y parcialmente incompatible.**

Existe listado y formulario de creación:

- `src/app/(dashboard)/campaigns/CampaignsClientView.tsx:10-218`
- `src/app/actions/campaigns.ts:17-55`

Faltantes:

- No hay selección de tipo de campaña según el enum del SRS.
- No hay asociación de publicaciones a campañas desde la UI.
- No hay calendario de efemérides o capa superpuesta.
- No hay informe post-mortem.
- No hay métricas, presupuesto ejecutado ni ROI.
- La acción inserta `descripcion`, `presupuesto` y `estatus`, campos que no están en `campanas` según `src/types/database.types.ts:21-49` ni en el schema SRS. Si la base real sigue el schema documentado, esta acción fallará.

### 4.10 Inventario de premios

**Estado: no implementado en UI ni acciones.**

El tipo TypeScript existe:

- `src/types/modules/thirdParties.ts:9-20`
- `src/types/database.types.ts:244-295`

No existen:

- Ruta.
- Listado.
- Altas/bajas.
- Control de cantidad recibida/entregada.
- Filtro por sede.
- Trazabilidad desde solicitudes.
- Flujo de sorteos/concursos.

### 4.11 Analytics, escucha social y post-mortem

**Estado: no implementado según el SRS.**

Los tipos existen para:

- `reporte_atencion_cliente`
- `campana_evaluaciones`

Evidencia:

- `src/types/modules/customerSupport.ts:3-12`
- `src/types/modules/campaigns.ts:3-7`
- `src/types/database.types.ts:296-370`

Pero no existen:

- `/reportes`.
- Dashboard mensual.
- Log semanal de quejas/sugerencias.
- Métricas consolidadas de crecimiento, reach, interacciones o top posts.
- Informes post-mortem.
- Acciones de lectura/escritura para evaluaciones.
- Integración con fuentes de métricas sociales.

La ruta `/support` es un módulo adicional de incidencias, pero no equivale al módulo de escucha social y reportes del SRS.

## 5. Hallazgos de backend y schema

### 5.1 Tipos y migración

`src/types/database.types.ts` representa las 8 tablas y 6 enums del SRS:

- `campanas`
- `publicaciones`
- `publicacion_canales`
- `checklist_rodaje`
- `solicitudes_terceros`
- `inventario_premios`
- `reporte_atencion_cliente`
- `campana_evaluaciones`

Evidencia: `src/types/database.types.ts:18-391`.

Sin embargo:

- No hay un archivo SQL de migración en el repositorio que permita reproducir o auditar el schema.
- La documentación afirma que la migración fue ejecutada y verificada, pero no se pudo comprobar contra Supabase.
- Varias acciones usan tablas o columnas que no están en los tipos ni en el SRS:
  - `terceros`
  - `atencion_cliente`
  - `publicaciones.sede`
  - `publicaciones.updated_at`
  - `campanas.descripcion`
  - `campanas.presupuesto`
  - `campanas.estatus`

Esto indica una deriva entre documentación, tipos y código, o bien un schema remoto no representado en el repositorio.

### 5.2 Creación de publicaciones

`createPostWithDriveAction` recibe hook, body, CTA y hashtags, pero solo persiste:

- `titulo`
- `formato`
- `fecha_publicacion`
- `campana_id`
- `linea_contenido`
- `estatus`
- `drive_folder_url`

Evidencia: `src/app/actions/createPostWithDrive.ts:10-43`.

Consecuencias:

- Se pierden campos capturados por el modal.
- No se calcula `fecha_limite_brief`.
- No se inicializa `fecha_solicitud_diseno`.
- No se guarda `drive_folder_id`.
- No se crean canales ni checklist.
- No se registra creador/disñador.
- No se versiona el copy.

### 5.3 Conversión de solicitudes

La acción `processRequestAction` no cumple la especificación de conversión 1-clic del SRS. Detalles en la sección 4.8.

### 5.4 Rodaje

La acción `getShootingPostsAction` tiene una consulta incompatible con el schema tipado:

```ts
query.eq("sede", input.sede)
```

`publicaciones` no tiene `sede` en `src/types/database.types.ts:51-76`. Además, el schema SRS ubica la sede en `checklist_rodaje.sucursal`, no en `publicaciones`.

### 5.5 Autenticación y RLS

No se encontró:

- Integración con Supabase Auth.
- Lectura de sesión o usuario.
- Roles.
- Protección de rutas.
- Policies específicas para `social_media`, `diseno` o `gerencia`.

El cliente administrativo usa `SUPABASE_SERVICE_ROLE_KEY` en Server Actions: `src/lib/supabaseClient.ts:20-25`. Esto permite escribir con bypass de RLS. La documentación afirma que las políticas existen (`docs/supabase-db-migration.md:220-235`), pero no se verificó en vivo y la aplicación no demuestra su uso.

## 6. Documentación desactualizada o sobredimensionada

### `docs/UI_IMPLEMENTATION.md`

El documento afirma:

- Visualización dinámica y filtros.
- Integración automatizada con Drive.
- Flujo Kanban completo.
- Planificación de rodaje.
- Grid sincronizado.

Varias afirmaciones exceden la implementación actual. En particular, no existe spreadsheet, PWA, checklist real, QA, inventario ni reportes.

### `docs/backend-actions-sla.md`

El documento afirma que:

- `crearPublicacionConDriveAction` persiste copy granular y calcula SLA.
- `convertirSolicitudATicketAction` convierte solicitudes según el SRS.
- Las rutas `/parrilla` se revalidan.

El código actual no cumple esas afirmaciones:

- La acción real se llama `createPostWithDriveAction` y no persiste copy granular ni calcula SLA.
- La conversión real se llama `processRequestAction` y no enlaza la solicitud con la publicación.
- Las rutas revalidadas son `/grid` y `/kanban`, no `/parrilla`.

### `docs/supabase-db-migration.md`

El documento afirma que el schema fue migrado, seed data verificado y RLS habilitado. No hay SQL local reproducible y la consulta de auditoría contra Supabase falló por conectividad. El estado real debe verificarse antes de considerar estos puntos cerrados.

## 7. Validación técnica

### Build

`pnpm build` terminó correctamente con Next.js 16.3.4 y TypeScript.

Rutas generadas:

- `/`
- `/_not-found`
- `/api/test-connections`
- `/campaigns`
- `/grid`
- `/kanban`
- `/requests`
- `/shooting`
- `/support`
- `/test-actions`
- `/third-parties`

El build correcto solo confirma compilación; no confirma que las acciones funcionen contra la base real.

### Lint

`pnpm lint` falló con 50 errores y 24 warnings.

Problemas relevantes del proyecto principal:

- `useEffect` con `setState` sincrónico en `src/app/(dashboard)/grid/GridClientView.tsx:40` y `:44`.
- Uso de `any` en acciones y formularios, por ejemplo `src/app/(dashboard)/support/SupportClientView.tsx:219` y `:241`.
- Imports `require()` en `jest.config.js:1-2`.
- Errores similares en varias Server Actions.
- Imports y variables sin usar.

Además, ESLint está escaneando `.kilo/worktrees/crystal-cilantro`, por lo que el reporte incluye problemas de un worktree secundario. El config está en `eslint.config.mjs:5-16`.

### Pruebas E2E

`pnpm test:e2e` no ejecutó la aplicación porque falta el navegador:

```text
Executable doesn't exist at ... ms-playwright/chromium_headless_shell-1243/...
```

El test existente solo navega `/requests`, `/kanban`, `/shooting` y `/grid`; no prueba interacciones ni persistencia: `e2e/production-lifecycle.spec.ts:4-20`.

### Pruebas de integración

`tests/integration/googleDriveAction.test.ts:3-22` ejecuta una Server Action contra servicios reales. No usa mocks y puede crear una carpeta y una publicación reales. No hay pruebas unitarias aisladas para SLA, conversiones, estados, RLS o validación de schema.

## 8. Riesgos principales

1. **Falsos positivos de documentación:** los documentos describen capacidades que el código no ejecuta.
2. **Deriva de schema:** acciones que consultan o escriben columnas/tablas no tipadas pueden fallar en producción.
3. **Pérdida de datos:** el modal captura copy que la acción no persiste.
4. **Trazabilidad incompleta:** solicitudes, publicaciones, Drive, checklist y campañas no quedan vinculadas de extremo a extremo.
5. **SLA incompleto:** no hay registro de solicitud real, entrega real, cumplimiento ni alertas.
6. **Seguridad:** uso de Service Role en Server Actions sin evidencia de autenticación/autorización de aplicación; Drive crea permisos públicos.
7. **Calidad:** lint fallido y pruebas E2E no ejecutadas.
8. **Mantenibilidad:** existen acciones legacy como `posts.ts` y `tickets.ts` con payloads y rutas obsoletas.

## 9. Recomendación de prioridad

### Prioridad 1: cerrar la base operativa

1. Definir una fuente única de verdad para el schema y eliminar acciones legacy.
2. Corregir las acciones de campañas, rodaje, terceros y soporte para que usen tablas/columnas reales.
3. Hacer transaccional la conversión de solicitudes.
4. Persistir todos los campos del modal y calcular SLA en creación y reprogramación.
5. Verificar en vivo tablas, FKs, enums, seed data y RLS.

### Prioridad 2: completar Fase 1

1. Crear `/dashboard` con alertas y accesos rápidos.
2. Unificar calendario, Kanban y spreadsheet bajo `/parrilla` o mantener rutas compatibles con aliases.
3. Implementar editor multi-tab y historial de revisiones.
4. Completar transiciones de estado y aprobación.

### Prioridad 3: completar Fases 2 a 5

1. Implementar `checklist_rodaje`, sede/área y PWA.
2. Implementar visor/ingesta de assets Drive.
3. Implementar QA pre-publicación.
4. Implementar inventario de premios y efemérides.
5. Implementar `/reportes`, escucha social y post-mortem.

### Prioridad 4: calidad y seguridad

1. Corregir lint.
2. Añadir pruebas unitarias de SLA y acciones.
3. Mockear Supabase/Drive en pruebas de integración.
4. Añadir pruebas E2E de flujos completos.
5. Implementar autenticación, roles y políticas de acceso verificables.

## 10. Dictamen final

El proyecto puede considerarse **un prototipo operativo parcial**, no una implementación completa del SRS. Las vistas visibles y varias Server Actions existen, pero hay una brecha importante entre lo documentado y lo ejecutable. Antes de declarar cerrada la Fase 1 conviene corregir la deriva de schema, completar los flujos de creación/conversión/SLA y añadir autenticación y pruebas de extremo a extremo.
