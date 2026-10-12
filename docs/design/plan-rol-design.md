# Plan de implementación: perfil Design completo

**Estado (2026-10-12):** plan propuesto, sin implementar. Base revisada: rama `main` del repositorio (commit `4b2368e`) y las migraciones locales hasta `202610110002_publication_design_requirement.sql`. El esquema remoto solo se conoce por la evidencia que el equipo compartió; ver [Fase 0](#fase-0--preparación-y-verificaciones).
**Alcance:** rol `design`, rutas `/design/publications*`, Drive (carpeta `Entregables`), campo de instrucciones en los modales de `/social-media/grid` y revisión de entregables por Social Media.
**Documentos relacionados:** [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`plan-validacion-brief-drive.md`](./plan-validacion-brief-drive.md), [`modales-publicacion.md`](./modales-publicacion.md).

## 1. Resultado esperado

Design deja de ser una cola de lectura con carga manual en Drive y pasa a ser un espacio de trabajo completo:

1. Ve **todas** las solicitudes de Design, sin importar quién las trabaja, separadas en **por tomar**, **en curso** e **historial** (entregadas y canceladas).
2. Recibe de Social Media **instrucciones escritas obligatorias** además del copy y los archivos del Brief.
3. **Sube sus entregables desde Kromi Connect** a `Entregables`, con el mismo mecanismo de carga directa a Drive que usa el Brief.
4. Queda registrado **quién tomó** cada solicitud.
5. Social Media **revisa la pieza dentro de su propia interfaz** (ve los archivos de `Entregables` en el modal) y decide: corrección o avance.

## 2. Decisiones

### 2.1 Confirmadas por el equipo (2026-10-12)

| Tema | Decisión |
|---|---|
| Visibilidad | Design ve las solicitudes globales, no solo las propias. Social Media sigue acotado por cuentas asignadas. |
| Vistas | Listado de solicitudes recibidas (por trabajar y en curso) y una vista aparte de historial con completadas y canceladas. |
| Instrucciones | Texto libre escrito por Social Media. **Obligatorias siempre que `requiere_diseno` sea verdadero.** |
| Carga | Design sube la pieza a `Entregables` desde la app, de forma similar a la carga del Brief. |
| Formatos de entrega | Cualquier imagen, video o audio, más `.pptx` (lista concreta en §6). |
| Registro de autoría | Se registra quién tomó cada ticket. |
| Jerarquía de la ficha | Arriba: instrucciones y assets. En medio: bloque de fechas de creación y entrega. Abajo: lo menos relevante (copy y datos de contexto). |

### 2.2 Propuestas por defecto (confirmar antes de la Fase 1)

| # | Propuesta | Motivo |
|---|---|---|
| P1 | **Auto-asignación:** al abrir la solicitud (`SOLICITADO → EN_DISENO`) el sistema guarda `disenador_id = quien abre`. Al reabrir una corrección se conserva el primero. Social Media no asigna en esta versión. | Quien conoce la carga de trabajo es Design. Con dos diseñadores y cola visible para ambos, un paso de asignación manual añade fricción y puede dejar tickets sin tomar. |
| P2 | **Propiedad blanda:** cualquier usuario con `design.posts.deliver` puede entregar, aunque no sea quien tomó el ticket. La ficha muestra "Tomada por X". | Evita tickets bloqueados por ausencia. La reasignación explícita queda para una fase posterior. |
| P3 | Las instrucciones se **exigen al solicitar a Design**, no al crear la publicación. Se pueden editar solo en `PENDIENTE_BRIEF` o `EN_RODAJE`. Después, cualquier cambio entra por el flujo de corrección (comentario obligatorio) o devolviendo a Brief. | Crear un ticket suele ocurrir antes de que el brief esté listo. Bloquear la edición tras solicitar evita que Design trabaje con instrucciones que cambian sin aviso, y resuelve la decisión abierta de "solicitud modificada mientras está en trabajo". |
| P4 | `Entregables`: hasta **500 MB por archivo** y **20 archivos** por publicación. | Un Reel en MP4 supera con facilidad los 100 MB del Brief. Confirmar tamaño y cupo. |
| P5 | **Regla de reentrega:** tras una corrección, Design solo puede entregar si hay en `Entregables` al menos un archivo creado después de reabrir la solicitud. | Hoy `hasPublicacionDeliverable()` solo exige que exista algún archivo; el de la entrega anterior bastaría. |

## 3. Hallazgos del código que condicionan el plan

- `get_design_publication_queue()` devuelve solo `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION` con `requiere_diseno`. Design **no puede leer** `publicaciones` fuera de ella; el historial requiere una RPC nueva.
- La policy `publication_comments_read` limita a Design a comentarios de publicaciones en esos tres estados. Un ticket cancelado a mitad de trabajo deja de mostrar su motivo. Se resuelve con RPC, no ampliando la policy.
- `transition_publicacion_status` **no escribe `disenador_id`**. La columna existe sin ningún consumidor.
- `profiles` solo es legible por su dueño y por administradores de acceso; Social Media y Design no pueden leer el nombre del otro. Hace falta una RPC de solo nombres.
- No existe ningún campo de instrucciones en el esquema ni en `src/`. El patrón del proyecto para columnas aditivas es una RPC `set_publication_*` (`set_publication_hour`, `set_publication_production`, `set_publication_design_requirement`), no ampliar `update_publicacion_with_relations`.
- La carga a Drive está atada al Brief: `drive.ts` valida `social-media.posts.edit`, resuelve la carpeta Brief y `reserve_publication_brief_upload` exige rol `social-media`. En cambio `lib/googleDrive.ts` ya es genérico (`createDriveResumableSession` recibe `folderId`).
- **Dos fallos que aparecen al añadir cargas a `Entregables` si no se corrigen:**
  - `reserve_publication_brief_upload` cuenta **todas** las reservas activas de la publicación al aplicar el tope de 10; las reservas de `Entregables` bloquearían cargas del Brief.
  - `reconcileBriefUploads()` consulta las reservas por publicación sin distinguir carpeta.
- `publicacion_drive_uploads` tiene un `check (file_size <= 104857600)` a nivel de tabla. Subir el tope para `Entregables` obliga a reemplazarlo.
- `listDesignPublicationDriveFilesAction` se ejecuta para **cada** tarjeta de la cola en cada carga y escribe en `publicaciones` con el cliente administrador para guardar IDs de carpeta. El listado nuevo no debe consultar Drive; solo la ficha.
- `fecha_entrega_diseno_real` se sobrescribe en cada entrega (la RPC la fija con `now()` al pasar a `EN_REVISION_CM`). El historial muestra la **última** entrega, no la primera.
- `docs/design/prototypes/` no incluye pantallas de Design (por nombre de archivo). La ficha de Design se diseña con este plan.
- `AGENTS.md` advierte que esta versión de Next.js tiene cambios incompatibles: antes de escribir rutas dinámicas (`[id]`) o cambiar `params`, leer la guía en `node_modules/next/dist/docs/`.

## 4. Fases

### Fase 0 — Preparación y verificaciones

1. Crear los dos usuarios en Supabase Auth y asignar `profiles.role_code = 'design'` (el acceso lo gestiona un administrador de acceso). Probable estado inicial: sin perfil o `pending`; confirmar en `202610050001_auth_roles_permissions.sql` antes de crearlos.
2. Confirmar en el proyecto remoto, sin volver a ejecutar a ciegas, que existen `set_publication_design_requirement` y `guard_publication_design_requirement` con sus grants (pendiente señalado en `supabase-db-migration.md`).
3. Confirmar el nombre real de la restricción `check` de tamaño en `publicacion_drive_uploads` (`select conname from pg_constraint where conrelid = 'public.publicacion_drive_uploads'::regclass;`). El nombre generado esperado es `publicacion_drive_uploads_file_size_check`.
4. Decidir P1–P5 (§2.2) y la lista de formatos (§6).

**Salida:** decisiones cerradas y usuarios listos.

### Fase 1 — Migración `202610120001_design_profile.sql`

Aditiva. **Partir de la versión de `202610110002`** de `request_publication_to_design` y de `transition_publicacion_status`, no de la de `110001` (esa tiene un parámetro mal nombrado que `110002` ya corrigió).

1. `alter table public.publicaciones add column if not exists instrucciones_diseno text;` con `check (instrucciones_diseno is null or length(instrucciones_diseno) <= 4000)`.
2. RPC `set_publication_design_instructions(p_publicacion_id uuid, p_instrucciones text) returns boolean`, `security definer`, siguiendo el patrón de `set_publication_hour`: exige rol `social-media`, permiso `social-media.posts.create` o `social-media.posts.edit`, acceso a todas las cuentas destino (`user_has_all_publication_accounts`) y estado `PENDIENTE_BRIEF` o `EN_RODAJE`.
3. Recrear `request_publication_to_design`: rechazar con un mensaje claro si `requiere_diseno` y `nullif(trim(instrucciones_diseno), '') is null`.
4. Recrear `transition_publicacion_status`: en el destino `EN_DISENO` fijar `disenador_id = coalesce(disenador_id, v_actor)`. Sin otros cambios de comportamiento.
5. `publicacion_drive_uploads`: añadir `carpeta text not null default 'BRIEF' check (carpeta in ('BRIEF','ENTREGABLES'))`; reemplazar la restricción de tamaño por `check (file_size > 0 and file_size <= 524288000)` (el límite de 100 MB del Brief ya se aplica en `reserve_publication_brief_upload`).
6. Recrear `reserve_publication_brief_upload` filtrando `carpeta = 'BRIEF'` en el conteo de reservas activas.
7. Sembrar el permiso `design.posts.upload` ("Subir entregables a Entregables") y asignarlo al rol `design` en `role_permissions`.
8. Crear `reserve_publication_deliverable_upload(p_actor_id uuid, p_publication_id uuid, p_file_name text, p_mime_type text, p_file_size bigint, p_drive_file_count integer) returns uuid`, solo `service_role`:
   - el actor debe tener rol `design` y permiso `design.posts.upload` (consultando `profiles` y `role_permissions`, igual que la RPC del Brief; no usar `auth.uid()` en llamadas de servicio);
   - la publicación debe estar activa, con `requiere_diseno` y en estado `EN_DISENO`;
   - tamaño máximo 500 MB; `p_drive_file_count` + reservas activas de `ENTREGABLES` debe ser menor que 20;
   - la validación de tipo vive en la acción de servidor (única llamadora), no se duplica la lista en SQL.
9. RPC `get_design_publication_history(p_limit integer default 50, p_offset integer default 0) returns setof public.publicaciones`, `security definer`, exige `design.posts.read`, `requiere_diseno`, `deleted_at is null` y estado en (`EN_REVISION_CM`, `PENDIENTE_APROBACION_GERENCIA`, `APROBADO`, `PROGRAMADO`, `PUBLICADO`) **o** `CANCELADO` con alguna entrada de `publicacion_estatus_historial` con `estatus_nuevo = 'SOLICITADO'` (para no mostrar cancelaciones que nunca llegaron a Design). Orden: más reciente primero.
10. RPC `get_design_publication_comments(p_ids uuid[])` (máximo 100 ids): devuelve comentarios de las publicaciones que Design puede ver (cola o historial).
11. RPC `get_publication_designer_names(p_ids uuid[])`: devuelve `publicacion_id`, `disenador_id`, `full_name`. Acceso para `design.posts.read` o para `social-media.posts.read` con alcance de cuentas. Solo el nombre, nunca otras columnas de `profiles`.
12. Cada función: `revoke all ... from public, anon`, grants mínimos, `set search_path = ''` y `notify pgrst, 'reload schema';` al final.
13. Actualizar `src/types/database.types.ts` y `src/types/modules/posts.ts` con `instrucciones_diseno`, la columna `carpeta` y las firmas de las RPC nuevas.

**Verificación posterior (el equipo ejecuta y comparte el resultado):** existencia de las columnas, funciones y grants nuevos; que la RPC genérica siga sin aceptar `SOLICITADO`; y que `reserve_publication_brief_upload` ya no cuente reservas de `ENTREGABLES`.

### Fase 2 — Reglas de archivo compartidas

1. Crear `src/lib/driveFileRules.ts` (sin `'use server'`) con las reglas por carpeta (`BRIEF`, `ENTREGABLES`): extensiones permitidas, tipo MIME canónico por extensión, tamaño máximo y cupo. Lo importan las acciones de servidor y el componente de cliente, para que haya una sola fuente.
2. Los navegadores informan MIME de forma poco fiable para algunas extensiones (`.mov`, `.avi`, `.heic`, a veces vacío). Para `ENTREGABLES` validar por **extensión** y enviar a Drive el MIME canónico del mapa, no el del navegador.
3. Drive puede normalizar el MIME al guardar. En la confirmación de `ENTREGABLES` comparar **tamaño y `appProperties.kromiUploadId`**, no el MIME (el Brief conserva su comprobación actual).

### Fase 3 — Acciones de servidor

1. **Mover los helpers compartidos** (`ensureFolders`, conciliación de reservas) a un módulo sin `'use server'`; un archivo `'use server'` solo puede exportar funciones asíncronas de acción.
2. Corregir `reconcileBriefUploads` para filtrar `carpeta = 'BRIEF'` y crear su equivalente para `ENTREGABLES`.
3. Nuevo `src/app/actions/publicaciones/design-drive.ts`: `startDeliverableUploadAction`, `finishDeliverableUploadAction`, `resumeDeliverableUploadAction`, `cancelDeliverableUploadAction` y `listDesignPublicationDriveFilesAction` por id (para la ficha). Permisos `design.posts.upload` y `design.posts.read`; verificar pertenencia a la cola y estado `EN_DISENO` para subir; resolver la carpeta en el servidor, nunca aceptar `folderId` del navegador.
4. Nuevo `listPublicacionDeliverablesForReviewAction(publicationId)` en `drive.ts` para Social Media: usa `getAuthorizedPublication(..., 'social-media.posts.read')`, **solo lista** (sin crear carpetas ni escribir). Reemplaza el uso previsto de `listPublicacionDeliverablesAction`, que exige permiso de Design y hoy no se usa en ninguna parte.
5. `workflow.ts`, paso a `EN_REVISION_CM`: además de comprobar que haya archivos, exigir (P5) un archivo con `createdTime` posterior al último paso a `EN_DISENO`. Obtener esa marca desde `publicacion_estatus_historial` con una RPC o con el cliente administrador **después** de validar permiso y pertenencia a la cola. Añadir `revalidatePath('/design/publications/history')`.
6. `create.ts` y `edit.ts`: añadir `instrucciones_diseno` a los tipos de entrada y llamar `set_publication_design_instructions` (mismo patrón que la hora; un fallo debe devolver "la publicación se guardó, pero no se pudieron guardar las instrucciones").
7. `requestPublicationToDesignAction`: propagar el error de instrucciones vacías con un mensaje accionable.
8. Nuevas lecturas para la UI de Design: historial (`get_design_publication_history`), comentarios (`get_design_publication_comments`) y nombres (`get_publication_designer_names`).

### Fase 4 — UI de Social Media (Grid)

1. `NewTicketModal` y `TicketEditModal`: textarea "Instrucciones para Diseño", visible cuando `requiere_diseno` es verdadero, marcada como obligatoria para solicitar, con contador de caracteres y deshabilitada fuera de `PENDIENTE_BRIEF`/`EN_RODAJE` (con el aviso: "para cambiarlas, devuelve la solicitud a Brief o pide una corrección").
2. El botón de solicitar a Design depende de **dos** condiciones: archivo en Brief e instrucciones. Mostrar cuál falta.
3. `TicketEditModal` en `EN_REVISION_CM`: mostrar la lista de `Entregables` (enlace para abrir en Drive, miniatura si existe) **encima** de "Pedir corrección", y el nombre de quien tomó el ticket.
4. `TicketDetailCard` y el modal de Kanban: mostrar instrucciones y "Tomada por".
5. Kanban: sin cambios de columnas; ya cubre los 13 estados.

### Fase 5 — UI de Design

Rutas bajo `src/app/(dashboard)/design/publications/`, en el layout existente (`requirePermission('design.posts.read')`). Añadir "Historial" a `navGroups` en `design/shell.tsx`.

| Ruta | Contenido |
|---|---|
| `/design/publications` | Dos secciones: **Por tomar** (`SOLICITADO`) y **En curso** (`EN_DISENO`, `EN_CORRECCION`, de cualquier diseñador, con "Tomada por X"). Tarjetas compactas: título, formato, fecha de publicación, entrega estimada con indicador SLA, marca de "devuelta con correcciones". Sin consultas a Drive. |
| `/design/publications/[id]` | **Ficha de trabajo.** Bloque A: instrucciones (destacadas) y panel de archivos con `Brief` (lectura), `Entregables` y zona de carga. Bloque B: fechas (solicitud, estimada, entrega real) y SLA. Bloque C: hook, body, CTA, hashtags, formato, comentarios de corrección. Acciones: "Tomar y abrir" y "Entregar a revisión" (deshabilitada hasta cumplir P5). |
| `/design/publications/history` | Tabla paginada de entregadas y canceladas: título, diseñador, entrega, SLA, estado actual y el **motivo** de cancelación cuando aplique. |

Pasos concretos:

1. Extraer `uploadResumable` (hoy dentro de `PublicationDriveFiles.tsx`) a un módulo de cliente compartido y generalizar el panel con una prop de carpeta y un objeto de acciones. `PublicationDriveFiles` queda como envoltorio del Brief para no arriesgar regresiones.
2. Dividir `queue.tsx` (hoy muy compacto en pocas líneas) en `RequestCard`, `InstructionsBlock`, `DatesBlock`, `DriveFilesPanel` y `DeliverableUploader`.
3. En la ficha, **no permitir cargar** si el ticket no está en `EN_DISENO`; mostrar la razón.
4. Las miniaturas y enlaces usan `webViewLink` de Drive. Validar que los archivos subidos a `Entregables` hereden el acceso `anyone: reader` de la carpeta (la comprobación sigue pendiente también para el Brief).
5. Estado de cancelación en vivo: si Social Media cancela mientras Design está en la ficha, la siguiente acción devuelve el error de estado y la ficha lo explica en lugar de fallar en silencio.

### Fase 6 — Documentación

1. `perfiles-de-usuario.md`: actualizar la sección Design (qué puede hacer, qué no) y el flujo de estados.
2. `supabase-db-migration.md`: sección de la nueva migración, con su estado de despliegue "pendiente de verificación".
3. `supabase-schema-public.md` y `supabase-schema-public.png`: actualizar la captura tras aplicar la migración.
4. `kromi-connect-srs.md` §7 (permisos) y `modales-publicacion.md` (campo de instrucciones, lista de Entregables).
5. `docs/design/README.md`: añadir este plan a la tabla de contenido.

### Fase 7 — Pruebas

- **Integración (Jest, `tests/integration`):** reglas de `driveFileRules`, validación de instrucciones al solicitar, asignación de `disenador_id` al abrir, filtro de carpeta en reservas, regla de reentrega.
- **Manual en entorno real:**
  1. Subir un MP4 grande y una imagen a `Entregables` desde el dominio desplegado (CORS/preflight y reanudación; ya se advierte como validación pendiente para el Brief).
  2. Dos diseñadores en paralelo sobre tickets distintos.
  3. Cancelar desde Social Media con Design en la ficha.
  4. Ciclo completo: solicitar, tomar, entregar, pedir corrección, reabrir, entregar sin archivo nuevo (debe fallar) y con archivo nuevo (debe pasar).
- **e2e (Playwright):** extender `e2e/production-lifecycle.spec.ts` solo si el equipo mantiene ese flujo en CI.

## 5. Orden de ejecución sugerido con Kilo Code

| Tanda | Contenido | Verificación |
|---|---|---|
| T1 | Migración y tipos (Fase 1) | El equipo la aplica y comparte el resultado de las consultas de verificación. |
| T2 | `driveFileRules`, refactor de helpers y corrección del filtro de carpeta (Fases 2 y 3.1–3.2) | `lint`, build, pruebas existentes. |
| T3 | Instrucciones en create/edit y modales de Grid (Fases 3.6–3.7 y 4.1–4.2) | Crear, editar y solicitar con y sin instrucciones. |
| T4 | Lectura de Entregables para Social Media y nombres (Fases 3.4, 3.8 y 4.3–4.4) | Modal de revisión en `EN_REVISION_CM`. |
| T5 | Acciones de carga de Design (Fase 3.3) | Carga de prueba a `Entregables`. |
| T6 | Listado, ficha e historial de Design (Fase 5) | Recorrido con los dos usuarios reales. |
| T7 | Regla de reentrega y documentación (Fases 3.5 y 6) | Ciclo completo con corrección. |

Cada tanda se aplica en una rama y se revisa antes de la siguiente. Reportar `pnpm lint` y `pnpm build` en cada una.

## 6. Formatos propuestos para `Entregables`

Validación por extensión; el MIME canónico lo fija el mapa de `driveFileRules`.

| Familia | Extensiones |
|---|---|
| Imagen | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.tif`, `.tiff`, `.heic`, `.heif` |
| Video | `.mp4`, `.mov`, `.m4v`, `.mpeg`, `.mpg`, `.webm`, `.avi` |
| Audio | `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac` |
| Documento | `.pptx`, `.pdf` |

Fuera de la lista inicial, a propósito:
- `.svg`: puede contener scripts y las carpetas son públicas por enlace.
- `.psd`, `.ai`, `.zip` y otros contenedores o formatos editables: no se incluyeron porque "etc." es ambiguo. Se añaden cambiando solo el mapa si el equipo los confirma.

Esta validación es operativa (extensión y tamaño); no inspecciona el contenido ni detecta malware, igual que en el Brief.

## 7. Riesgos y preguntas abiertas

- **Almacenamiento:** la cuenta de Drive tiene 100 GB. 20 archivos de hasta 500 MB por publicación pueden consumirlo; conviene definir política de limpieza (hoy el Archivo conserva la carpeta completa durante el plazo de archivado de un mes calendario y después la purga).
- **Privacidad:** las carpetas siguen con `anyone: reader`; cualquiera con el enlace puede ver las piezas de `Entregables`.
- **Propiedad blanda (P2):** si más adelante se necesita exclusividad o reasignación, requerirá una RPC de reasignación y permisos adicionales.
- **SLA:** `fecha_entrega_diseno_real` refleja la última entrega. Si se quiere medir el cumplimiento de la primera, hay que fijar el valor solo una vez o guardar cada entrega.
- **Concurrencia de carpetas:** `ensureChildFolder` localiza por nombre; ya se advirtió que una carga concurrente podría duplicar subcarpetas. Más probable ahora con dos diseñadores abriendo la misma ficha.
- **Solicitud modificada o cancelada en curso:** con P3 las instrucciones no cambian tras solicitar; la cancelación sí puede ocurrir. La ficha debe tratarla explícitamente (Fase 5.5).
- **Métricas y notificaciones:** fuera de alcance de este plan.

## 8. Criterios de aceptación

1. Un usuario con rol `design` ve en `/design/publications` todas las solicitudes activas de ambos diseñadores y distingue "por tomar" de "en curso".
2. Al abrir una solicitud, `disenador_id` queda guardado y Social Media y Design ven "Tomada por <nombre>"; al reabrir una corrección se conserva el primero.
3. No se puede solicitar a Design con instrucciones vacías cuando `requiere_diseno` es verdadero; la RPC lo rechaza aunque se llame fuera de la UI.
4. Las instrucciones no se pueden editar fuera de `PENDIENTE_BRIEF` y `EN_RODAJE`.
5. Design sube archivos permitidos a `Entregables` con progreso, cancelación y reanudación, sin pasar por el servidor de Vercel; un tipo no permitido o un archivo que excede el tamaño se rechaza con un mensaje claro.
6. Las cargas de `Entregables` no consumen el cupo del Brief y viceversa.
7. Design no puede entregar tras una corrección sin un archivo nuevo en `Entregables`.
8. Social Media ve los archivos de `Entregables` en el modal de `EN_REVISION_CM` y puede abrir cada uno en Drive.
9. `/design/publications/history` lista entregadas y canceladas (estas últimas con el motivo) y excluye cancelaciones que nunca llegaron a Design.
10. Un usuario con rol `design` no puede crear, editar ni cancelar publicaciones, ni cambiar estados distintos de `EN_DISENO` y `EN_REVISION_CM`.

## 9. Fuera de alcance

Asignación por Social Media, reasignación entre diseñadores, versionado de entregables, vista previa embebida o descarga por proxy, eliminación de archivos desde Kromi, comentarios de respuesta de Design, métricas de carga de trabajo y notificaciones.
