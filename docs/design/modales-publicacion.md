# Modales de publicación (`/social-media/grid`)

Especificación y seguimiento de implementación. Cubre crear, editar, detalle y Archivo. Actualizado: 2026-10-11 (añade la sección Brief; el plan funcional y técnico está en [`plan-validacion-brief-drive.md`](./plan-validacion-brief-drive.md)).

> **Para quien implemente (Codex u otra persona):** este documento dice qué construir; los archivos de [`prototypes/`](./prototypes) dicen cómo se ve. Antes de tocar código lee la sección 8 (reglas de implementación) y respeta lo marcado como **Fuera de alcance**. La base de datos desplegada manda sobre este texto.

Estado de cada fila: **Existe** (en código o esquema confirmado), **Migración aplicada** (incluida en `202610100001_publication_workflow_archive.sql`, cuya ejecución reportó el usuario), **Pendiente** (requiere desarrollo/decisión). No equivale a una verificación remota independiente.

## Acuerdos confirmados

- El formato se conserva global en `publicaciones.formato`. `REEL` se etiqueta **Reel** para Instagram/TikTok y **Short** para YouTube. YouTube se representa con el canal `YOUTUBE`; no se crea `YOUTUBE_SHORTS` ni se alteran sus restricciones actuales en esta etapa.
- Flujo de diseño: Social Media solicita (`SOLICITADO`); Design abre la solicitud y el sistema cambia a `EN_DISENO`; Design entrega y el sistema cambia a `EN_REVISION_CM`; Social Media puede pedir corrección con observación obligatoria (`EN_CORRECCION`); al abrirla Design vuelve a `EN_DISENO`.
- Al terminar revisión, Social Media controla el paso siguiente: `PENDIENTE_APROBACION_GERENCIA` (etiqueta **Por aprobación**, espera una decisión externa), `PROGRAMADO` o `PUBLICADO`. Cuando recibe la decisión externa, Social Media registra `APROBADO`. El código global declara `management`, pero este rol no participa en el flujo de publicaciones ni tiene una pantalla/acción de aprobación en esta etapa.
- Las observaciones son comentarios inmutables ligados a una solicitud de corrección. Social Media puede crearlas; Social Media y Design pueden leerlas. Cada registro conserva autor y fecha.
- `CANCELADO` es terminal: Social Media puede aplicarlo desde cualquier estado distinto de `CANCELADO`, con motivo obligatorio guardado en historial y observaciones.
- `INCOMPLETO` queda fuera del flujo nuevo y no se ofrece en la interfaz. Las filas existentes con ese estado requieren una decisión de migración antes de cambiar su valor.
- Eliminar es lógico. Solo Social Media puede eliminar/restaurar, además de cumplir el alcance de todas las cuentas destino. La publicación queda restaurable durante un mes calendario desde `deleted_at`; al vencer, comienza la purga definitiva de sus registros y carpeta de Drive.
- Si falla la eliminación de Drive, no hay reintento automático. La publicación permanece en **Archivo**, ya vencida y no restaurable, hasta que Social Media elija reintentar la eliminación de Drive o conservar Drive y eliminar definitivamente los registros.
- **Brief con archivos en Drive** (decidido el 2026-10-11, detalle en el plan): cada publicación tiene subcarpetas `Brief` (Social Media) y `Entregables` (Design). Social Media sube a `Brief` desde la app, con carga directa del navegador a Drive; JPG, PNG, WebP, PDF y MP4, hasta 100 MB por archivo y 10 archivos. Solicitar a Design exige al menos un archivo en `Brief`, comprobado en Drive (el conteo sirve 5 minutos). Desde `SOLICITADO` se puede volver a `PENDIENTE_BRIEF` (motivo opcional) mientras Design no abra la solicitud. Los archivos sueltos de carpetas antiguas se ignoran.
- La revisión y el backfill de categorías quedan fuera de esta implementación. El tema heredado `linea_contenido` se conserva como dato legado sin crear categorías nuevas ni transformarlo.

### Matriz de transiciones acordada

| Estado actual | Actor y evento | Nuevo estado | Requisito |
|---|---|---|---|
| `PENDIENTE_BRIEF` / `EN_RODAJE` | Social Media envía la solicitud | `SOLICITADO` | Permiso de Social Media y al menos un archivo en `Brief` (comprobado en Drive); fija las fechas del ciclo |
| `SOLICITADO` | Social Media retira la solicitud antes de que Design la abra | `PENDIENTE_BRIEF` | Permiso de Social Media; motivo opcional; limpia solicitud y entrega estimada, conserva el límite del brief. No existe desde `EN_DISENO` ni `EN_RODAJE` |
| `SOLICITADO` | Design abre/toma la solicitud | `EN_DISENO` | Permiso de Design; cambio registrado por el sistema |
| `EN_DISENO` | Design carga/entrega la pieza | `EN_REVISION_CM` | Permiso de Design; registrar fecha real de entrega |
| `EN_REVISION_CM` | Social Media pide correcciones | `EN_CORRECCION` | Observación obligatoria; autor/fecha registrados |
| `EN_CORRECCION` | Design abre la solicitud corregida | `EN_DISENO` | Permiso de Design; cambio registrado por el sistema |
| Cualquier estado salvo `CANCELADO` | Social Media cancela la pieza | `CANCELADO` | Motivo obligatorio; transición terminal y auditable |
| `EN_REVISION_CM` | Social Media decide esperar aprobación externa | `PENDIENTE_APROBACION_GERENCIA` | Se muestra **Por aprobación** |
| `EN_REVISION_CM` | Social Media programa/publica directamente | `PROGRAMADO` / `PUBLICADO` | Según el estado real en la plataforma destino |
| `PENDIENTE_APROBACION_GERENCIA` | Social Media registra la aprobación externa recibida | `APROBADO` | No existe acción dentro de la app para Gerencia |
| `APROBADO` | Social Media programa/publica | `PROGRAMADO` / `PUBLICADO` | Según el estado real en la plataforma destino |
| `PROGRAMADO` | Social Media confirma publicación | `PUBLICADO` | Acción manual; no hay integración automática con las plataformas |

`RECHAZADO_DISENO` no se ofrece en nuevas transiciones. `CANCELADO` es terminal, puede aplicarse desde cualquier estado y requiere motivo obligatorio, registrado como observación inmutable. Las filas históricas no se transforman automáticamente. `INCOMPLETO` tampoco se ofrece en nuevas transiciones; conservar su valor histórico hasta definir su tratamiento.

## 1. Código actual

| Modal | Archivo |
|---|---|
| Crear | `src/app/(dashboard)/social-media/components/NewTicketModal.tsx` |
| Editar | `src/app/(dashboard)/social-media/grid/components/TicketEditModal.tsx` |
| Detalle | `src/app/(dashboard)/social-media/grid/GridView.tsx` |
| Archivo | `src/app/(dashboard)/social-media/grid/archive/` |
| Cola Design | `src/app/(dashboard)/design/publications/` |
| Acciones | `src/app/actions/publicaciones/{create,edit,archive,workflow,drive}.ts` |
| RPC (SQL) | `create_publicacion_with_relations`, `update_publicacion_with_relations`, `transition_publicacion_status`, `archive_publication`, `restore_archived_publication` |

## 2. Campos, columnas y permisos

Columnas de `publicaciones` salvo que se indique otra tabla.

| Campo en pantalla | Columna / tabla | Crear | Editar | Detalle | Escritura | Estado |
|---|---|---|---|---|---|---|
| Título | `titulo` | sí | sí | sí | RLS: `has_permission` + todas las cuentas asignadas | Existe |
| Formato | `formato` (`formato_enum`) | sí | sí | sí | igual | Existe |
| Campaña | `campana_id` | sí | sí | sí | igual | Existe |
| Fecha de publicación | `fecha_publicacion` | sí | sí | sí | igual | Existe |
| Hora de publicación | `hora_publicacion` | sí | sí | sí | igual | Migración aplicada |
| Temas | `publicacion_categorias` ⨝ `categorias_contenido` | sí | sí | sí | RPC | Existe |
| Tema heredado (`linea_contenido`) | texto legado | no | solo lectura | solo lectura | — | Existe; sin backfill en esta etapa |
| Cuentas de destino | `publicacion_canales` ⨝ `social_accounts` | sí | sí | sí | RPC; solo cuentas del usuario en `user_social_accounts` | Existe |
| Hook / Cuerpo / CTA | `hook_texto`, `body_texto`, `cta_texto` | sí | sí | sí | RPC; **nulos para STORY** | Existe |
| Hashtags | `hashtags` | sí | sí | sí | RPC | Existe (limpieza pendiente) |
| Estado (etiqueta contextual para `EN_REVISION_CM` y `PENDIENTE_APROBACION_GERENCIA`) | `estatus` (`estatus_enum`) | fijo | solo vía flujo | lectura | RPC de transición; Social Media gestiona los estados editoriales, Design dispara eventos de trabajo | Existe / Migración aplicada |
| Historial de estado | `publicacion_estatus_historial` | — | lectura | lectura | trigger/RPC transaccional | Migración aplicada |
| Observaciones de revisión/cancelación | `publicacion_comentarios` | — | lectura | lectura | Social Media crea al pedir corrección o cancelar; inmutables, con tipo y autor | Migración aplicada |
| Límite del brief | `fecha_limite_brief` | calculado | calculado | lectura | app (`src/utils/sla.ts`) | Existe |
| Solicitud / entrega real de diseño | fechas reales de flujo | — | no editable | lectura | RPC de transición las fija; trigger impide escritura directa | Migración aplicada |
| Diseñador | `disenador_id` | — | no editable en esta etapa | nombre pendiente | sin asignación individual ni lectura segura de nombre | Pendiente de perfil futuro |
| Creador | `creador_id` | automático | lectura | nombre pendiente | UUID guardado; nombre requiere acceso seguro a `profiles` | Pendiente de perfil futuro |
| Carpeta de Drive | `drive_folder_url` | automático | lectura | enlace | acción de servidor | Existe |
| Subcarpetas `Brief` y `Entregables` | IDs en `publicaciones` o tabla de metadatos Drive (a definir en la migración del plan) | automático | lectura | lectura | acción de servidor, idempotente | Pendiente |
| Archivos de Brief | Drive (subcarpeta `Brief`); no se guardan en la base | subir | subir | lista con enlace a Drive | carga directa del navegador iniciada y confirmada por el servidor | Pendiente |
| Estado sincronizado del Brief | conteo y fecha de última comprobación | — | — | chip y texto de comprobación | solo `service_role`; ventana de 5 minutos | Pendiente |
| Estado de sincronización/limpieza con Drive | columnas de estado/error de Drive | — | — | lectura | acción de servidor y purga programada | Migración aplicada |
| Archivo | `deleted_at` + estado de limpieza Drive | — | restaurar dentro de un mes / resolución manual de errores | lectura | solo rol Social Media | Migración aplicada |
| Comprobación de alcance de cuentas | función `user_has_all_publication_accounts` | — | valida el guardado | — | RPC booleana; todas las cuentas para editar o archivar | Existe |
| Requiere rodaje | `requiere_rodaje` | sí | **fuera de alcance** | — | RPC | Migración aplicada |
| Sedes de rodaje | `publicaciones.sedes` (`sede_enum[]`) | sí | fuera de alcance | lectura | RPC de producción | Migración aplicada; solo PREBO/MANONGO en el enum actual |
| Fecha de rodaje | `fecha_rodaje` | calculada (sugerida) | **fuera de alcance** | — | — | Migración aplicada |

### 2.1 Tiendas donde se graba

La propuesta de interfaz enumera **Prebo, Mañongo, Trigal Sur, Trigal Norte, Guataparo, Castillito y San Felipe**. No es el catálogo disponible hoy: la migración solo permite `PREBO` y `MANONGO` porque `publicaciones.sedes` usa el `sede_enum` existente.

`sede_enum` solo tiene `PREBO` y `MANONGO` y lo usan `checklist_rodaje.sucursal` e `inventario_premios.sucursal_ubicacion`. Como evolución futura se propone un catálogo `sedes` (`id`, `codigo`, `nombre`, `activa`, `orden`) y una tabla `publicacion_sedes (publicacion_id, sede_id)` para habilitar las siete tiendas sin ampliar el enum. Sigue pendiente decidir si `checklist_rodaje` e `inventario_premios` también migrarían a ese catálogo.

### 2.2 Alcance por cuenta y edición de solo lectura

La función actual es `user_has_all_publication_accounts(publicacion_id)`, que devuelve un booleano. Las policies limitan la lectura a publicaciones asociadas con cuentas asignadas; las Server Actions de edición, archivo y restauración comprueban el acceso a todas las cuentas destino. No existe la función `publicacion_acceso_cuentas` ni está implementado un modal que detalle “+N cuentas sin acceso”. Si el usuario no tiene alcance completo, la acción de edición devuelve un error.

El prototipo `EditarSoloLectura` y la opción “Duplicar con mis cuentas” son una propuesta futura; no describen la interfaz actual. Los administradores tampoco tienen acceso global automático a publicaciones (ver `publicaciones-por-cuenta-social.md`).

### Reglas de permiso

- **Leer**: al menos una cuenta asignada (`publicacion_canales` ⨝ `user_social_accounts`).
- **Escribir**: todas las cuentas de la publicación asignadas (`user_has_all_publication_accounts`) **y** el permiso funcional correspondiente (`has_permission(code)`).
- Si el usuario tiene al menos una cuenta asignada puede leer; si no tiene todas, las acciones de edición/archivo/restauración devuelven un error de acceso. No existe actualmente el modo de solo lectura ni el indicador “+N cuentas sin acceso”.
- La etiqueta depende de la plataforma destino: `REEL` se muestra como **Reel** en Instagram/TikTok y **Short** en YouTube. El esquema desplegado tiene una cuenta `YOUTUBE`, dos relaciones `publicacion_canales` con ese canal, y restricciones que excluyen `YOUTUBE_SHORTS` tanto de `social_accounts.platform` como de `publicacion_canales.canal`. Mantener esta representación; no añadir `YOUTUBE_SHORTS` ni cambiar esos checks en esta etapa. Reconciliar tipos locales con `supabase db pull` antes de tocar la base.

## 3. Estados y avisos

| Pantalla (artboard) | Qué muestra |
|---|---|
| `Main` | Crear con Reel: formato, campaña, fecha/hora, SLA, temas, cuentas, copy. |
| `CrearStory` | Sin copy; YouTube deshabilitado (“No admite Stories”). |
| `CrearAvisos` | Título vacío, fecha pasada, brief vencido, campaña finalizada, sin cuentas, hashtag con espacios, caption para TikTok, botón deshabilitado. |
| `Editar` | Pestaña Contenido. |
| `EditarFlujo` | Estado actual, “Pedir corrección” con motivo, tarjetas de SLA, fechas de flujo en solo lectura, creador y diseñador. |
| `EditarSoloLectura` | Faltan cuentas por asignar. |
| `Detalle` | Caption como se publicará, línea de tiempo del SLA, historial. |
| `DetalleVacio` | Sin copy (Story), sin observaciones, sin temas, sin historial; error al crear carpeta de Drive. |
| `Dialogos` | Descartar cambios, enviar corrección (motivo obligatorio) y eliminar lógicamente con fecha límite de restauración. |
| `CrearMovil`, `DetalleMovil` | 390 px: una columna, objetivos táctiles de 44 px, acciones apiladas al pie. |
| `CrearBrief` | Paso posterior a guardar: confirmación, resumen, sección Brief con subida en curso y atajo “Solicitar a Design” deshabilitado hasta terminar. |
| `DetalleBrief` | Detalle en `PENDIENTE_BRIEF` con la tarjeta Brief (lista, comprobación, agregar, solicitar). |
| `EditarBrief` | Flujo y SLA en `SOLICITADO`: “Volver a Brief”, tarjeta Brief, tarjeta de diseño con entrega estimada. |
| `BriefEstados` | Seis estados de la sección: vacío, subiendo, con errores, listo, límite alcanzado y sin carpeta de Drive. |
| `BriefDialogos` | Selector de estado (sin archivos, con archivos, ya solicitado) y diálogos: solicitar, brief vacío al comprobar, volver a Brief, comprobando, Drive sin respuesta, Design ya abrió y cerrar con subidas en curso. |
| `BriefMovil`, `BriefMovilVacio` | 390 px: tarjeta Brief subiendo y vacía; acción “Solicitar a Design” fija al pie. |
| `Archivo` | Publicaciones con borrado lógico, acción de restaurar dentro del mes y resolución manual cuando falla la eliminación de Drive. |

### 3.1 Sección Brief

Una sola tarjeta reutilizable, con el mismo contenido en Crear (tras guardar), Editar (Flujo y SLA) y Detalle. Encabezado “Brief” y una etiqueta de estado con icono y texto (nunca solo color).

| Estado | Etiqueta | Contenido |
|---|---|---|
| Vacío | Faltan archivos | Zona de arrastre con “Elegir archivos”, límites y aviso ámbar: “Para solicitar a Design necesitas subir al menos uno”. |
| Subiendo | “N de M subidos” | Filas con barra de progreso (`role="progressbar"`), “Cancelar” por archivo y “En cola”. Solo cuentan los archivos confirmados. |
| Con errores | “N archivos con error” | Cada fila falla por separado, con su causa: tipo no permitido, más de 100 MB o conexión cortada. “Quitar” saca la fila; “Reintentar” reanuda la subida. |
| Listo | Brief listo · N archivos | Lista con nombre, tipo, tamaño, fecha y “Abrir” (Drive). Línea “Comprobado en Drive hace N min · Volver a comprobar”. |
| Límite alcanzado | Brief listo · 10 archivos | “Agregar archivos” deshabilitado. Kromi Connect no elimina archivos todavía; se borran desde Drive. |
| Sin carpeta de Drive | Sin carpeta de Drive | Aviso de error con “Reintentar carpeta”; la subida queda deshabilitada hasta crearla. |

**Reglas de comportamiento**

- Los archivos se validan al elegirlos (extensión/MIME y tamaño) y otra vez al confirmarlos en Drive. Un archivo rechazado o incompleto no cuenta para el brief.
- No hay vista previa embebida ni eliminación en esta etapa; “Abrir” lleva a Drive.
- Cerrar el modal con subidas en curso pide confirmación (“¿Cerrar y cancelar las subidas?”). La reanudación tras cerrar no se ofrece.
- “Solicitar a Design” siempre vuelve a consultar Drive: si el conteo guardado tiene más de 5 minutos o Drive no muestra archivos, la acción lo indica con el diálogo correspondiente y la publicación no cambia de estado.
- En Crear, el botón “Solicitar a Design” del pie es un atajo que ejecuta la misma acción de servidor; permanece deshabilitado mientras haya subidas en curso o falten archivos.
- La subida sigue disponible mientras la publicación esté activa; el retorno a `PENDIENTE_BRIEF` solo se ofrece en `SOLICITADO` (en el selector de la tarjeta y en Editar › Flujo y SLA).
- El selector de estado conserva el `select` nativo: la opción “Solicitado a diseño” se muestra deshabilitada con el texto “Faltan archivos del brief” y “Volver a Brief” aparece solo en `SOLICITADO`. Sustituye el `window.prompt` de “En corrección” por el diálogo de “Pedir corrección” ya diseñado.

**Accesibilidad**: cada enlace “Abrir” lleva `aria-label` con el nombre del archivo; las barras de progreso exponen valor; los botones deshabilitados usan `aria-disabled`; los errores se anuncian con `role="alert"`.

Reglas de texto: errores bajo el campo con su causa; avisos que no bloquean en ámbar; no usar solo el color para indicar estado.

## 4. Migración y estado de despliegue

El usuario confirma la ejecución de `202610100001_publication_workflow_archive.sql`. Incluye `deleted_at`, estados de limpieza Drive, historial, comentarios, permisos de Design/Social Media, policies y RPC de flujo/Archivo/producción. Esta nota no verifica en vivo el proyecto. No cambia el canal de YouTube ni incorpora `YOUTUBE_SHORTS`.

El rol `design` tiene sembrados `design.posts.read`, `design.posts.start` y `design.posts.deliver`. La ruta `/design/publications` presenta una cola compartida y los cambios se validan en `get_design_publication_queue()` y `transition_publicacion_status(...)`; no se amplía la lectura general de `publicaciones`. Aún no hay asignación por `disenador_id`, carga de archivo en app ni versionado.

La purga distingue al menos los estados pendiente, error, Drive eliminado y Drive conservado. La acción programada procesa una publicación vencida una sola vez. Si la carpeta se elimina correctamente, purga los registros; si falla, guarda el error y excluye el registro de ejecuciones automáticas posteriores. En Archivo, Social Media puede reintentar manualmente o conservar la carpeta y purgar los registros.

La purga de Drive requiere un worker/endpoint de servidor programado; SQL no puede llamar directamente a Google Drive. Una ejecución vencida intenta purgar una vez; los fallos se registran y quedan para resolución manual, sin reintentos programados. La retención vence al cumplirse un mes calendario desde `deleted_at`.

Antes de futuras modificaciones: `supabase db pull` para comparar con la línea base desplegada; la migración aplicada fue reportada por el usuario y no se validó remotamente en esta sesión.

## 5. Hallazgos que conviene resolver

1. Resuelto: el guardado de contenido no modifica estado ni fechas reales; `transition_publicacion_status` valida actor, destino, motivo y registra historial. `CANCELADO` puede aplicarse desde cualquier estado activo.
2. Resuelto: los permisos de Rodaje y de la cola de Design se siembran en la migración.
3. `checklist_rodaje`, `solicitudes_terceros`, `inventario_premios` y `reporte_atencion_cliente` están revocadas para `authenticated` y no tienen políticas; no se habilitan como parte de este alcance.
4. `profiles` solo es legible por su dueño o administradores, por lo que mostrar el nombre del diseñador a otros roles requiere una vista o función.
5. Hashtags: hacer primero un reporte de valores con espacios o sin `#` y normalizar al guardar.

## 6. Pendiente o fuera de esta etapa

- Tratamiento de datos históricos en `INCOMPLETO` y `RECHAZADO_DISENO` (no ofrecerlos en nuevas transiciones ni mapearlos automáticamente a `CANCELADO`).
- Reglas de “Duplicar” y “Repetir” (qué se copia, qué cuentas).
- Límite de caracteres de caption por plataforma (Instagram sin verificar).
- SLA: 5/3/2 días viven en `src/utils/sla.ts`; `fecha_limite_brief` es el valor actual y se recalcula al reprogramar.

- Design no tiene hoy una vista de los archivos de `Brief` dentro de la app: usa la carpeta de Drive (enlace público). Decidir si la cola de Design muestra la lista de Brief.
- Eliminar o reemplazar archivos del Brief desde Kromi Connect y reanudar subidas después de cerrar el modal.

## 7. Fuera de alcance por ahora

- **Interfaz de Gerencia**: aunque existe el código global `management`, no hay flujo ni pantalla de aprobación de publicaciones para ese rol. Social Media registra en la app el resultado de la aprobación externa usando `APROBADO`.
- **Control de versiones del copy**: se quitó del diseño (etiqueta “Copy v1”, “Ver versiones”, “versión del copy” en el detalle). Si se retoma, la tabla `publicacion_copy_versiones` y su trigger estaban propuestos en una migración anterior; no se crea ahora.
- **Asignación de diseñadores**: selector puede permanecer deshabilitado hasta que se resuelva la visibilidad de `profiles`.
- **Creador y diseñador por nombre**: se mantienen en el diseño; requieren lectura segura de nombres de `profiles` para usuarios que comparten la publicación.

Los campos de producción (rodaje, sedes, prioridad y hora) están disponibles en Crear/Editar; el detalle incluye la línea de tiempo e historial.

## 8. Reglas de implementación

1. Etiquetas de estado: usar el texto de la interfaz, no el valor del enum. `EN_REVISION_CM` se muestra como **En revisión**; no se renombra el valor en la base.
2. Colores y tipografía: tokens de `tailwind.config.ts` y la fuente Inter. Los hex de los prototipos son equivalentes a esos tokens; usar las clases de Tailwind.
3. Los prototipos son referencia visual: no copiar sus estilos en línea.
4. Cada artboard tiene un tamaño fijo; el modal real debe tener altura máxima con scroll interno. Los modales de crear y detalle a 390 px pasan a una columna con acciones apiladas al pie y objetivos táctiles de 44 px.
5. No añadir funciones que figuren en la sección 7.
6. Antes de cambiar la base, correr `supabase db pull` y auditar constraints, triggers, funciones, políticas y extensiones del proyecto; cada migración nueva va en `supabase/migrations/` y se documenta aquí.
7. Los errores se muestran bajo el campo con la causa; los avisos que no bloquean, en ámbar; nunca solo con color.
