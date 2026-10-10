# Modales de publicación (`/social-media/grid`)

Borrador de implementación. Cubre crear, editar, detalle y Archivo. Actualizado: 2026-10-10.

> **Para quien implemente (Codex u otra persona):** este documento dice qué construir; los archivos de [`prototypes/`](./prototypes) dicen cómo se ve. Antes de tocar código lee la sección 8 (reglas de implementación) y respeta lo marcado como **Fuera de alcance**. La base de datos desplegada manda sobre este texto.

Estado de cada fila: **Existe** (ya está en la base o en el código), **Migración** (propuesta aditiva, aún no aplicada), **Pendiente** (requiere decisión o trabajo adicional).

## Acuerdos confirmados

- El formato se conserva global en `publicaciones.formato`. `REEL` se etiqueta **Reel** para Instagram/TikTok y **Short** para YouTube. YouTube se representa con el canal `YOUTUBE`; no se crea `YOUTUBE_SHORTS` ni se alteran sus restricciones actuales en esta etapa.
- Flujo de diseño: Social Media solicita (`SOLICITADO`); Design abre la solicitud y el sistema cambia a `EN_DISENO`; Design entrega y el sistema cambia a `EN_REVISION_CM`; Social Media puede pedir corrección con observación obligatoria (`EN_CORRECCION`); al abrirla Design vuelve a `EN_DISENO`.
- Al terminar revisión, Social Media controla el paso siguiente: `PENDIENTE_APROBACION_GERENCIA` (etiqueta **Por aprobación**, espera una decisión externa), `PROGRAMADO` o `PUBLICADO`. Cuando recibe la decisión externa, Social Media registra `APROBADO`. El código global declara `management`, pero este rol no participa en el flujo de publicaciones ni tiene una pantalla/acción de aprobación en esta etapa.
- Las observaciones son comentarios inmutables ligados a una solicitud de corrección. Social Media puede crearlas; Social Media y Design pueden leerlas. Cada registro conserva autor y fecha.
- `CANCELADO` es terminal: Social Media puede aplicarlo desde cualquier estado distinto de `CANCELADO`, con motivo obligatorio guardado en historial y observaciones.
- `INCOMPLETO` queda fuera del flujo nuevo y no se ofrece en la interfaz. Las filas existentes con ese estado requieren una decisión de migración antes de cambiar su valor.
- Eliminar es lógico. Solo Social Media puede eliminar/restaurar, además de cumplir el alcance de todas las cuentas destino. La publicación queda restaurable durante un mes calendario desde `deleted_at`; al vencer, comienza la purga definitiva de sus registros y carpeta de Drive.
- Si falla la eliminación de Drive, no hay reintento automático. La publicación permanece en **Archivo**, ya vencida y no restaurable, hasta que Social Media elija reintentar la eliminación de Drive o conservar Drive y eliminar definitivamente los registros.
- La revisión y el backfill de categorías quedan fuera de esta implementación. El tema heredado `linea_contenido` se conserva como dato legado sin crear categorías nuevas ni transformarlo.

### Matriz de transiciones acordada

| Estado actual | Actor y evento | Nuevo estado | Requisito |
|---|---|---|---|
| Estados previos al trabajo de diseño | Social Media envía la solicitud | `SOLICITADO` | Permiso de Social Media |
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
| Acciones | `src/app/actions/publicaciones/{create,edit,delete,recalculateSla,shooting,ticket-quick-actions}.ts` |
| RPC (SQL) | `create_publicacion_with_relations`, `update_publicacion_with_relations` (`security invoker`) |
| Archivo (nuevo) | Nueva vista bajo Social Media; restaura registros y permite resolver fallos de purga de Drive |

## 2. Campos, columnas y permisos

Columnas de `publicaciones` salvo que se indique otra tabla.

| Campo en pantalla | Columna / tabla | Crear | Editar | Detalle | Escritura | Estado |
|---|---|---|---|---|---|---|
| Título | `titulo` | sí | sí | sí | RLS: `has_permission` + todas las cuentas asignadas | Existe |
| Formato | `formato` (`formato_enum`) | sí | sí | sí | igual | Existe |
| Campaña | `campana_id` | sí | sí | sí | igual | Existe |
| Fecha de publicación | `fecha_publicacion` | sí | sí | sí | igual | Existe |
| Hora de publicación | `hora_publicacion` | sí | sí | sí | igual | Migración |
| Temas | `publicacion_categorias` ⨝ `categorias_contenido` | sí | sí | sí | RPC | Existe |
| Tema heredado (`linea_contenido`) | texto legado | no | solo lectura | solo lectura | — | Existe; sin backfill en esta etapa |
| Cuentas de destino | `publicacion_canales` ⨝ `social_accounts` | sí | sí | sí | RPC; solo cuentas del usuario en `user_social_accounts` | Existe |
| Hook / Cuerpo / CTA | `hook_texto`, `body_texto`, `cta_texto` | sí | sí | sí | RPC; **nulos para STORY** | Existe |
| Hashtags | `hashtags` | sí | sí | sí | RPC | Existe (limpieza pendiente) |
| Estado (etiqueta contextual para `EN_REVISION_CM` y `PENDIENTE_APROBACION_GERENCIA`) | `estatus` (`estatus_enum`) | fijo | solo vía flujo | lectura | RPC de transición; Social Media gestiona los estados editoriales, Design dispara eventos de trabajo | Existe / Migración |
| Historial de estado | `publicacion_estatus_historial` | — | lectura | lectura | trigger/RPC transaccional | Migración |
| Observaciones de revisión/cancelación | `publicacion_comentarios` | — | lectura | lectura | Social Media crea al pedir corrección o cancelar; inmutables, con tipo y autor | Migración |
| Límite del brief | `fecha_limite_brief` | calculado | calculado | lectura | app (`src/utils/sla.ts`) | Existe |
| Solicitud / entrega real de diseño | fechas reales de flujo | — | lectura | lectura | hoy el RPC de edición las acepta sin validar transición | Pendiente |
| Diseñador | columna de diseñador | — | sí | lectura | permiso de diseño | Existe (revisar visibilidad de `profiles`) |
| Creador | columna de creador | automático | lectura | lectura | — | Existe (datos antiguos: “sin registrar”) |
| Carpeta de Drive | `drive_folder_url` | automático | lectura | enlace | acción de servidor | Existe |
| Estado de sincronización/limpieza con Drive | columnas de estado/error de Drive | — | — | lectura | acción de servidor y purga programada | Migración |
| Archivo | `deleted_at` + estado de limpieza Drive | — | restaurar dentro de un mes / resolución manual de errores | lectura | solo rol Social Media | Migración |
| Acceso a cuentas (total / asignadas / puede editar) | función `publicacion_acceso_cuentas` | — | define solo lectura | — | `security definer`, devuelve solo conteos | Migración |
| Requiere rodaje | `requiere_rodaje` | sí | **fuera de alcance** | — | RPC | Migración |
| Tiendas donde se graba | tabla `sedes` + `publicacion_sedes` (ver 2.1) | sí (varias) | **fuera de alcance** | — | RPC | Migración / Pendiente |
| Fecha de rodaje | `fecha_rodaje` | calculada (sugerida) | **fuera de alcance** | — | — | Migración |

### 2.1 Tiendas donde se graba

Opciones, en este orden: **Prebo, Mañongo, Trigal Sur, Trigal Norte, Guataparo, Castillito, San Felipe**. Se pueden elegir varias.

`sede_enum` solo tiene `PREBO` y `MANONGO` y lo usan `checklist_rodaje.sucursal` e `inventario_premios.sucursal_ubicacion`. Recomendación: no ampliar el enum; crear un catálogo `sedes` (`id`, `codigo`, `nombre`, `activa`, `orden`) con las siete tiendas y una tabla `publicacion_sedes (publicacion_id, sede_id)`. Así agregar una tienda es un `INSERT`, no una migración de tipo. **Pendiente de decisión:** si `checklist_rodaje` e `inventario_premios` migran después al catálogo.

### 2.2 Cuándo aparece “+N cuentas sin acceso”

El indicador solo se muestra en el modal de edición en solo lectura. Se calcula con `publicacion_acceso_cuentas` (devuelve total, asignadas y `puede_editar`; nunca nombres ni identificadores de las otras cuentas).

Aparece cuando se cumplen las dos condiciones: la publicación tiene **más de una cuenta de destino** y el usuario tiene asignada **al menos una pero no todas**. Leer exige una; editar o eliminar exige todas.

| Situación | ¿Se muestra? |
|---|---|
| Publicación con una sola cuenta (todos los datos actuales) | No |
| Usuario con todas las cuentas de la publicación | No; edita normalmente |
| Alguien con Instagram y TikTok crea la publicación en ambas y la abre quien solo tiene Instagram | Sí: “+1 cuenta sin acceso” |
| A un usuario le quitan una cuenta después de crear publicaciones con varias | Sí, en esas publicaciones |
| Se agrega una cuenta nueva a una publicación existente | Sí, para quien no tenga la nueva cuenta |
| Usuario sin ninguna de las cuentas | No ve la publicación; no se abre el modal |
| Administrador sin asignaciones de cuenta | No ve la publicación: el acceso no es global (ver `publicaciones-por-cuenta-social.md`) |

El aviso debe explicar por qué (texto del prototipo `EditarSoloLectura`) y ofrecer “Duplicar con mis cuentas”. Hoy todas las publicaciones tienen una sola cuenta, así que esta pantalla es una prevención y no se verá hasta que existan publicaciones con varias cuentas.

### Reglas de permiso

- **Leer**: al menos una cuenta asignada (`publicacion_canales` ⨝ `user_social_accounts`).
- **Escribir**: todas las cuentas de la publicación asignadas (`user_has_all_publication_accounts`) **y** el permiso funcional correspondiente (`has_permission(code)`).
- Si el usuario puede leer pero no escribir, el modal de edición abre en **solo lectura** y muestra “+N cuentas sin acceso” sin nombres.
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
| `Archivo` | Publicaciones con borrado lógico, acción de restaurar dentro del mes y resolución manual cuando falla la eliminación de Drive. |

Reglas de texto: errores bajo el campo con su causa; avisos que no bloquean en ámbar; no usar solo el color para indicar estado.

## 4. Migraciones propuestas (aún no aplicadas)

**Migraciones para esta implementación, después del pull y auditoría de metadatos**: `deleted_at` y estado/error de Drive para purga; tabla `publicacion_estatus_historial`; tabla `publicacion_comentarios`; permisos de estado, comentarios, archivo/restauración; funciones de transición y acceso seguro al Archivo. La migración `202610100001_publication_workflow_archive.sql` implementa el flujo, el Archivo y campos de producción. No cambia el enum/canal de YouTube ni incorpora `YOUTUBE_SHORTS`.

El rol `design` está declarado en `app_roles`, pero hoy no tiene permisos de publicaciones sembrados. Se deben añadir permisos específicos de lectura de solicitudes, inicio de trabajo y entrega. La cola de Design expone `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION` y los campos necesarios; no se debe ampliar la política general de lectura ligada a `user_social_accounts` para dar acceso global a todas las publicaciones.

La purga distingue al menos los estados pendiente, error, Drive eliminado y Drive conservado. La acción programada procesa una publicación vencida una sola vez. Si la carpeta se elimina correctamente, purga los registros; si falla, guarda el error y excluye el registro de ejecuciones automáticas posteriores. En Archivo, Social Media puede reintentar manualmente o conservar la carpeta y purgar los registros.

La purga de Drive requiere un worker/endpoint de servidor programado; SQL no puede llamar directamente a Google Drive. Una ejecución vencida intenta purgar una vez; los fallos se registran y quedan para resolución manual, sin reintentos programados. La retención vence al cumplirse un mes calendario desde `deleted_at`.

Antes de todo: `supabase db pull` para fijar la línea base.

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
