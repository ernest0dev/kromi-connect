# Perfiles de usuario

Este documento separa el perfil funcional de los permisos efectivos. Los perfiles y permisos técnicos se definen en las migraciones Supabase y en §7 del [SRS](kromi-connect-srs.md). Estado revisado contra el repositorio local al 2026-10-12; no implica consulta directa al proyecto remoto.

## Estado de perfiles

| Perfil | Rol de acceso | Estado funcional |
|---|---|---|
| Social Media / Responsable de Redes Sociales | `social-media` | Perfil operativo principal; administra Grid, brief, flujo editorial, archivo, campañas y efemérides según permisos y alcance por cuentas. |
| Diseño / Diseñador | `design` | Cola compartida implementada; queda por definir y construir el perfil completo. |
| Eventos | `events` | Rol existente; perfil funcional pendiente. |
| Interno | `internal` | Rol existente; perfil funcional pendiente. |
| Atención al cliente | `customer-support` | Rol existente; alcance de `/support` y relación con escucha social pendientes. |
| Gerencia | `management` | Rol existente; no tiene vista de aprobación de publicaciones. Social Media registra el resultado externo. |

`pending` y `admin` son roles de acceso, no perfiles operativos. `admin` no adquiere acceso global a publicaciones solo por su nombre de rol.

## Social Media / Responsable de Redes Sociales

**Propósito:** planificar contenido, redactar copy y briefs, coordinar producción y rodaje, revisar entregas y gestionar el paso editorial hasta la publicación.

### Funciones implementadas en Grid

- Crear, ver y editar publicaciones; asignar cuentas sociales permitidas, campaña y categorías; editar copy, hashtags, fechas, hora y campos de producción disponibles.
- Reprogramar publicaciones y ver sus estados, fechas de SLA, historial y observaciones.
- Subir y listar archivos de Brief en Drive desde Crear (después de guardar), Editar y Detalle. La carga es directa del navegador a Drive mediante sesión resumible autorizada en servidor. El MVP permite JPG/JPEG, PNG, WebP, PDF y MP4, hasta 100 MB por archivo y 10 archivos presentes o reservados por publicación. La validación es por extensión/MIME y metadatos; no escanea contenido. No incluye preview dentro de Kromi ni eliminación de archivos.
- Solicitar diseño solo tras comprobación reciente de al menos un archivo en Brief. El retorno a `PENDIENTE_BRIEF` se permite desde `SOLICITADO` antes de que Design inicie; elimina las fechas del ciclo actual, conserva el historial y al volver a solicitar calcula un ciclo nuevo.
- Marcar si se requiere Design. Por defecto sí; el cambio está permitido en `PENDIENTE_BRIEF` o `EN_RODAJE`. Sin Design, el Brief es opcional y se omiten solicitud/entrega y SLA de diseño. Sin rodaje puede avanzar directamente de `PENDIENTE_BRIEF` a `PENDIENTE_APROBACION_GERENCIA`; con rodaje pasa por `EN_RODAJE` primero.
- Revisar una entrega, enviar a corrección con comentario obligatorio, registrar aprobación externa (`APROBADO`), programar, publicar o cancelar desde cualquier estado activo con motivo obligatorio.
- Archivar lógicamente por un mes calendario, restaurar durante el plazo y resolver manualmente fallos de limpieza de Drive desde Archivo.

### Flujo de estados

| Estado/acción | Quién actúa | Resultado |
|---|---|---|
| `PENDIENTE_BRIEF` / `EN_RODAJE` | Social Media | Prepara brief y producción; solicita a Design cuando corresponde y el Brief contiene archivo validado. |
| `SOLICITADO` | Design | Abrir la solicitud cambia a `EN_DISENO`. Social Media puede devolverla a `PENDIENTE_BRIEF` antes del inicio. |
| `EN_DISENO` | Design | Entrega el archivo final en Drive `Entregables`; el servidor comprueba su presencia y cambia a `EN_REVISION_CM`. |
| `EN_REVISION_CM` | Social Media | Envía a `EN_CORRECCION` con observación, o continúa a `PENDIENTE_APROBACION_GERENCIA`, `PROGRAMADO` o `PUBLICADO`, según el caso. |
| `EN_CORRECCION` | Design | Al abrir la corrección, vuelve a `EN_DISENO`. |
| `PENDIENTE_APROBACION_GERENCIA` | Social Media | Registra la respuesta externa pasando a `APROBADO`; no existe interfaz de Gerencia. |
| `APROBADO` | Social Media | Programa o marca como publicado. |
| `PROGRAMADO` | Social Media | Confirma `PUBLICADO` cuando la publicación ya está en plataforma. |
| Cualquier estado activo | Social Media | Puede cancelar a `CANCELADO`, con motivo obligatorio; es terminal. |

`RECHAZADO_DISENO` no se usa como transición nueva; la cancelación expresa que la pieza dejó de ser necesaria. `INCOMPLETO` y estados históricos no se normalizan automáticamente.

### Límites de acceso

Las acciones requieren el permiso correspondiente y alcance sobre las cuentas destino. Leer requiere al menos una cuenta asignada; editar o archivar requiere todas las cuentas de la publicación. No asumir que todas las rutas existentes están habilitadas para el rol: Kanban, solicitudes, rodaje, soporte y terceros dependen de sus concesiones vigentes. Consultar §7 del SRS y las migraciones.

## Design / Diseñador de publicaciones

**Estado:** flujo operativo inicial implementado; este registro orienta desarrollo futuro y no afirma que exista un perfil completo.

### Puede hacer hoy

- Abrir `/design/publications` si cuenta con `design.posts.read` y ver la cola compartida de publicaciones activas que requieren diseño en `SOLICITADO`, `EN_DISENO` o `EN_CORRECCION`.
- Consultar los metadatos del brief y listas de archivos de las carpetas `Brief` y `Entregables`, con enlace a Drive.
- Abrir una solicitud o corrección; el estado pasa a `EN_DISENO`.
- Subir manualmente el entregable final a `Entregables` desde Drive y entregarlo en Kromi. El servidor verifica que haya al menos un archivo antes de cambiar a `EN_REVISION_CM`.

Las acciones de inicio y entrega requieren `design.posts.start` y `design.posts.deliver`. La cola es compartida: no asigna, reclama ni filtra por `disenador_id`. La decisión `requiere_diseno = false` excluye la publicación de la cola.

### No puede hacer hoy

- Crear o editar publicaciones, Brief, copy, cuentas destino o campañas.
- Subir archivos dentro de Kromi Connect, administrar versiones o eliminar archivos de Drive.
- Aprobar publicaciones, cambiar estados editoriales de Social Media, cancelar, archivar o restaurar.
- Asignar solicitudes a sí mismo u otras personas, ni gestionar comentarios de respuesta.

### Decisiones para el futuro perfil

- Cola compartida frente a asignación individual; reglas de prioridad, carga y reasignación.
- Convenciones de entrega: tipos, cantidades, nombres, revisiones y ubicación en Drive.
- Si se requiere carga, vista previa, versionado o respuesta a correcciones dentro de Kromi.
- Visibilidad segura de nombres de autor/diseñador y de datos de `profiles` entre roles.
- Tratamiento de una solicitud modificada o cancelada mientras está en trabajo.
- Métricas de trabajo y notificaciones.

Resolver estas decisiones antes de ampliar la UI; pueden requerir permisos, RPC/policies y cambios de datos.

## Perfiles por definir

Eventos, Interno, Atención al cliente y Gerencia requieren entrevistas y una ficha funcional antes de desarrollar vistas específicas. Los nombres de rol disponibles no sustituyen la definición de tareas, límites y permisos.
