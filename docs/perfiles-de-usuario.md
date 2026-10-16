# Perfiles de usuario

Este documento separa el perfil funcional de los permisos efectivos. Los perfiles y permisos técnicos se definen en las migraciones Supabase y en §7 del [SRS](kromi-connect-srs.md). Revisado contra el repositorio al 2026-10-15; los estados de despliegue se registran según reportes del usuario y no implican consulta directa al proyecto remoto. Para las migraciones de Design ver §13 y §14 de [`supabase-db-migration.md`](supabase-db-migration.md).

## Estado de perfiles

| Perfil | Rol de acceso | Estado funcional |
|---|---|---|
| Social Media / Responsable de Redes Sociales | `social-media` | Perfil operativo principal; administra Grid, brief, flujo editorial, archivo, campañas y efemérides según permisos y alcance por cuentas. |
| Diseño / Diseñador | `design` | Perfil operativo: cola global, ficha de trabajo, carga de entregables en la app e historial. Pendiente de verificar en producción. |
| Eventos | `events` | Dos módulos. **Inventario** compartido por sede en `/events/inventory` (implementado; plan en `design/plan-inventario-eventos.md`). **Programación de eventos** en `/events/calendar`, con sub vistas `/events/calendar/list` y `/events/calendar/archive` (calendario mensual/semanal, ficha, alta/edición, estados, cierre y archivo). El usuario reportó aplicada `202610150001_events_schedule.sql`; faltan `db pull` y verificación de permisos/flujos en remoto. Solo este rol ve y gestiona eventos. |
| Interno | `internal` | Rol existente. Perfil en **borrador** (2026-10-15): una persona, pendientes de impresiones, insumos y necesidades por tienda sobre un mapa estático de Valencia. Sin código, migración ni permisos; hoy el rol termina en `/access-pending`. Plan en `design/plan-rol-interno.md`. |
| Atención al cliente | `customer-support` | Rol existente; alcance de `/support` y relación con escucha social pendientes. |
| Gerencia | `management` | Rol existente; no tiene vista de aprobación de publicaciones. Social Media registra el resultado externo. |

`pending` y `admin` son roles de acceso, no perfiles operativos. `admin` no adquiere acceso global a publicaciones solo por su nombre de rol.

## Social Media / Responsable de Redes Sociales

**Propósito:** planificar contenido, redactar copy y briefs, coordinar producción y rodaje, revisar entregas y gestionar el paso editorial hasta la publicación.

### Funciones implementadas en Grid

- Crear, ver y editar publicaciones; asignar cuentas sociales permitidas, campaña y categorías; editar copy, hashtags, fechas, hora y campos de producción disponibles.
- Reprogramar publicaciones y ver sus estados, fechas de SLA, historial y observaciones.
- Subir y listar archivos de Brief en Drive desde Crear (después de guardar), Editar y Detalle. La carga es directa del navegador a Drive mediante sesión resumible autorizada en servidor. El MVP permite JPG/JPEG, PNG, WebP, PDF y MP4, hasta 100 MB por archivo y 10 archivos presentes o reservados por publicación. La validación es por extensión/MIME y metadatos; no escanea contenido. No incluye preview dentro de Kromi ni eliminación de archivos.
- Escribir las **Instrucciones para Diseño** (texto libre, hasta 4000 caracteres) en Crear y Editar. Son obligatorias para solicitar a Design cuando `requiere_diseno` es verdadero y solo se editan en `PENDIENTE_BRIEF` o `EN_RODAJE`; después de solicitar, los cambios van como corrección.
- Solicitar diseño solo tras comprobación reciente de al menos un archivo en Brief. El retorno a `PENDIENTE_BRIEF` se permite desde `SOLICITADO` antes de que Design inicie; elimina las fechas del ciclo actual, conserva el historial y al volver a solicitar calcula un ciclo nuevo.
- Marcar si se requiere Design. Por defecto sí; el cambio está permitido en `PENDIENTE_BRIEF` o `EN_RODAJE`. Sin Design, el Brief es opcional y se omiten solicitud/entrega y SLA de diseño. Sin rodaje puede avanzar directamente de `PENDIENTE_BRIEF` a `PENDIENTE_APROBACION_GERENCIA`; con rodaje pasa por `EN_RODAJE` primero.
- Revisar una entrega en `EN_REVISION_CM`: el modal muestra quién la entregó, si fue a tiempo y la lista de archivos de `Entregables` (miniatura y enlace a Drive). Si Drive falla o la lista llega vacía, muestra un aviso con reintento y las acciones de revisión siguen disponibles: Drive es una vista de apoyo, no una condición de avance.
- Ver el nombre del diseñador que tomó la solicitud.
- Revisar una entrega, enviar a corrección con comentario obligatorio, registrar aprobación externa (`APROBADO`), programar, publicar o cancelar desde cualquier estado activo con motivo obligatorio.
- Archivar lógicamente por un mes calendario, restaurar durante el plazo y resolver manualmente fallos de limpieza de Drive desde Archivo.

### Flujo de estados

| Estado/acción | Quién actúa | Resultado |
|---|---|---|
| `PENDIENTE_BRIEF` / `EN_RODAJE` | Social Media | Prepara brief y producción; solicita a Design cuando corresponde y el Brief contiene archivo validado. |
| `SOLICITADO` | Design | Abrir la solicitud cambia a `EN_DISENO`. Social Media puede devolverla a `PENDIENTE_BRIEF` antes del inicio. |
| `EN_DISENO` | Design | Carga el archivo final a `Entregables` desde Kromi y lo entrega; el servidor exige al menos un archivo creado después del último paso a `EN_DISENO` y cambia a `EN_REVISION_CM`. |
| `EN_REVISION_CM` | Social Media | Envía a `EN_CORRECCION` con observación, o continúa a `PENDIENTE_APROBACION_GERENCIA`, `PROGRAMADO` o `PUBLICADO`, según el caso. |
| `EN_CORRECCION` | Design | Al reabrir, vuelve a `EN_DISENO` conservando al diseñador que tomó el ticket; para entregar de nuevo debe cargar un archivo nuevo. |
| `PENDIENTE_APROBACION_GERENCIA` | Social Media | Registra la respuesta externa pasando a `APROBADO`; no existe interfaz de Gerencia. |
| `APROBADO` | Social Media | Programa o marca como publicado. |
| `PROGRAMADO` | Social Media | Confirma `PUBLICADO` cuando la publicación ya está en plataforma. |
| Cualquier estado activo | Social Media | Puede cancelar a `CANCELADO`, con motivo obligatorio; es terminal. |

`RECHAZADO_DISENO` no se usa como transición nueva; la cancelación expresa que la pieza dejó de ser necesaria. `INCOMPLETO` y estados históricos no se normalizan automáticamente.

### Límites de acceso

Las acciones requieren el permiso correspondiente y alcance sobre las cuentas destino. Leer requiere al menos una cuenta asignada; editar o archivar requiere todas las cuentas de la publicación. No asumir que todas las rutas existentes están habilitadas para el rol: Kanban, solicitudes, rodaje, soporte y terceros dependen de sus concesiones vigentes. Consultar §7 del SRS y las migraciones.

## Design / Diseñador de publicaciones

**Estado:** perfil operativo implementado en el repositorio. Las migraciones `202610120001` y `202610120002` están pendientes de verificar en el proyecto remoto.

### Puede hacer

- Abrir `/design/publications` con `design.posts.read` y ver la cola **global**: solicitudes por tomar (`SOLICITADO`) y en curso (`EN_DISENO`, `EN_CORRECCION`) de cualquier diseñador, con quién la tomó. Solo se excluyen las publicaciones con `requiere_diseno = false`.
- Abrir la ficha de trabajo (`/design/publications/[id]`): instrucciones de Social Media arriba, archivos de `Brief` (lectura) y `Entregables`, bloque de fechas y SLA, contenido de la publicación, comentarios de corrección e historial de la solicitud.
- **Tomar y abrir** una solicitud o corrección (`design.posts.start`): pasa a `EN_DISENO` y, si no tenía diseñador, queda registrado quién la tomó. Ese registro se conserva tras las correcciones.
- **Cargar entregables** desde Kromi (`design.posts.upload`) directamente a Drive `Entregables`, solo en `EN_DISENO`. Hasta 20 archivos de 500 MB cada uno. Formatos: imagen (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.tif`, `.tiff`, `.heic`, `.heif`), video (`.mp4`, `.mov`, `.m4v`, `.mpeg`, `.mpg`, `.webm`, `.avi`), audio (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac`) y documento (`.pptx`, `.pdf`). La validación es por extensión y tamaño, no por contenido.
- **Entregar a revisión** (`design.posts.deliver`): el servidor exige al menos un archivo en `Entregables` creado después del último paso a `EN_DISENO`; en una corrección, un archivo posterior a la reapertura.
- Ver el **historial** (`/design/publications/history`): publicaciones entregadas (de `EN_REVISION_CM` en adelante) y canceladas que llegaron a `SOLICITADO`, con diseñador, resultado de SLA y motivo de cancelación.

**Propiedad blanda:** cualquier usuario con `design.posts.deliver` puede entregar un ticket tomado por otro diseñador. La carga y la reanudación de una subida sí quedan limitadas a quien la inició.

### No puede hacer

- Crear o editar publicaciones, Brief, instrucciones, copy, cuentas destino o campañas.
- Eliminar archivos de Drive, administrar versiones o ver vista previa embebida.
- Aprobar publicaciones, cambiar estados editoriales de Social Media, cancelar, archivar o restaurar.
- Reasignar solicitudes entre diseñadores ni responder comentarios.
- Abrir la ficha de una solicitud ya entregada o cancelada: el historial es una tabla sin detalle.

### Decisiones tomadas (2026-10-12)

| Tema | Decisión |
|---|---|
| Autoría | Se registra quién toma cada ticket al abrirlo y se conserva (P1). |
| Entrega | Propiedad blanda: cualquier diseñador con permiso puede entregar (P2). |
| Instrucciones | Obligatorias al solicitar; editables solo en `PENDIENTE_BRIEF` o `EN_RODAJE` (P3). |
| Límites | 500 MB por archivo y 20 archivos en `Entregables` (P4). |
| Reentrega | Al menos un archivo creado tras el inicio del ciclo vigente (P5). |
| Formatos | Imagen, video, audio, `.pptx` y `.pdf`. |

Detalle y fases en [`design/plan-rol-design.md`](design/plan-rol-design.md).

### Pendiente o abierto

- Reasignación entre diseñadores, versionado de entregables, vista previa embebida, métricas de carga y notificaciones: fuera del alcance actual.
- Qué ocurre si Social Media cancela mientras Design trabaja: hoy la siguiente acción devuelve el error de estado y no hay aviso en vivo.
- La regla de reentrega se valida solo en la acción de servidor, no en la base de datos.
- Verificar en remoto las migraciones `202610120001` y `202610120002`, y revisar los tickets antiguos en `SOLICITADO` sin instrucciones (riesgo descrito en la §13 de `supabase-db-migration.md`).

## Interno (borrador)

**Estado:** especificación en borrador, sin implementar. Parte de pedidos y decisiones del equipo del 2026-10-15; la entrevista con el rol se omitió por decisión del equipo. Detalle, modelo de datos y decisiones en [`design/plan-rol-interno.md`](design/plan-rol-interno.md).

### Qué se decidió

- Lo usa **una sola persona**. Crea sus pendientes de impresiones, insumos y necesidades por tienda y se los asigna; por ahora no recibe solicitudes de otros.
- Su interfaz principal es un **mapa estático** de Valencia Norte, Naguanagua y San Diego, minimalista, con las tiendas de Valencia y sus pendientes. San Felipe va como icono al pie. No usa calendario.
- Las **impresiones se solicitan a Design**, como hace Social Media, con formatos y medidas libres en un campo de instrucciones.

### Propuesta (por confirmar)

- Un pendiente pertenece a una tienda y tiene tipo (`IMPRESION`, `INSUMO`, `NECESIDAD`), estado (`PENDIENTE`, `EN_PROCESO`, `LISTO`, `ENTREGADO`, `CANCELADO`) y fecha requerida opcional.
- Vistas: mapa con panel por tienda, listado, archivo. Permisos `internal.store-tasks.*`, solo para el rol `internal`.
- La entrega se divide en dos: primero el mapa y los pendientes (fase 3a) y después el envío de impresiones a Design (fase 3b), porque la cola de Design hoy solo lee `publicaciones`.

### Pendiente

- Cómo llega la solicitud de impresión a Design (reutilizar `publicaciones`, solicitud propia o solo texto y enlace).
- Verificar las coordenadas de las siete tiendas, tomadas de los enlaces de Google Maps del equipo, y elegir el fondo del mapa.

## Perfiles por definir

Atención al cliente y Gerencia requieren entrevistas y una ficha funcional antes de desarrollar vistas específicas. Los nombres de rol disponibles no sustituyen la definición de tareas, límites y permisos.
