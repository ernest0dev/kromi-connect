# Plan de implementación: brief con Drive y retorno reversible

**Estado:** propuesta para implementación posterior. No modifica código ni base de datos.
**Alcance:** publicaciones de `/social-media/grid`, acciones de servidor, Google Drive y transición al flujo de Design.
**Base revisada:** el repositorio actual y `202610100001_publication_workflow_archive.sql`.

## 1. Resultado esperado

Social Media puede completar el brief desde Kromi Connect, consultar sus archivos y enviar la solicitud a Design solo cuando exista al menos un archivo de brief. Si todavía no empezó el trabajo de diseño, puede devolver `SOLICITADO` a `PENDIENTE_BRIEF`, completar archivos y volver a solicitar. Design debe comprobar los entregables finales por separado de los assets del brief.

El sistema debe conservar la auditoría de cada ciclo. Los campos de fechas del registro representan el ciclo vigente; `publicacion_estatus_historial` conserva las fechas/actores de las solicitudes anteriores.

## 2. Hallazgos del código actual que condicionan el plan

- `workflow.ts` ya valida en servidor que Design no entregue sin un archivo en Drive. `hasPublicacionDeliverable()` busca cualquier archivo no carpeta en la carpeta raíz.
- `transition_publicacion_status` permite `SOLICITADO` desde `PENDIENTE_BRIEF` y `EN_RODAJE`, pero no valida Drive; la RPC es ejecutable por `authenticated`.
- `StatusSelect.tsx` ofrece `SOLICITADO` desde esos dos estados. No ofrece retorno a `PENDIENTE_BRIEF`.
- La RPC fija `fecha_solicitud_diseno` y la estimación solo si no existían previamente; al re-solicitar no actualiza esos campos para el nuevo ciclo. La fecha límite del brief sí se recalcula.
- La creación genera una carpeta principal de Drive. No hay acciones para subir o listar archivos.
- Los archivos de brief y la pieza entregada compartirían la misma carpeta con el planteamiento inicial. Esto no es seguro funcionalmente: una referencia del brief contaría como pieza final para la validación actual de Design.
- Las carpetas se crean con permiso `reader` para `anyone`. Los archivos que se suban serán accesibles mediante ese permiso; el alcance de las carpetas debe tratarse como una decisión de privacidad.

## 3. Decisiones recomendadas

1. **Separar contenidos en Drive:** cada carpeta de publicación tendrá subcarpetas `Brief` y `Entregables`. Social Media sube/lista archivos en `Brief`; Design entrega y valida archivos en `Entregables`. No contar archivos de una carpeta como contenido de la otra.
2. **No enviar archivos como base64 en Server Actions.** El base64 aumenta el tamaño del payload y dificulta subidas grandes. Usar un Route Handler autenticado con `multipart/form-data` y límites explícitos de tamaño/tipo, o una carga resumible mediada por servidor si se requieren archivos grandes.
3. **La comprobación autoritativa ocurre en servidor.** Antes de transicionar a `SOLICITADO`, una acción autenticada comprueba el contenido real de `Brief` en Drive. El control de cliente solo mejora la UX y no es una medida de seguridad.
4. **La RPC debe tener una condición verificable en base de datos.** Como PostgreSQL no consulta Google Drive, almacenar un estado de brief sincronizado por las operaciones de servidor (por ejemplo `drive_brief_file_count` y `drive_brief_checked_at`) y hacer que la RPC rechace la solicitud si no hay archivos. La acción refresca primero ese estado desde Drive. Las columnas no deben poder escribirse directamente por `authenticated`; se actualizan mediante función restringida a servidor. Si archivos se borran fuera de Kromi, el estado puede quedar obsoleto: la comprobación previa a solicitar y la reconciliación manual/operativa reducen ese riesgo.
5. **Permitir retorno solo desde `SOLICITADO` inicialmente.** No permitir retorno desde `EN_DISENO`: al abrir la solicitud, Design ya empezó a trabajar y el estado debe reflejarlo. `EN_RODAJE` ya puede pasar a `PENDIENTE_BRIEF`, por lo que no necesita transición adicional.
6. **Fechas de ciclo:** al volver a solicitar, `fecha_solicitud_diseno`, `fecha_limite_brief` y `fecha_entrega_diseno_estimada` se actualizan para el nuevo ciclo. Las fechas/actores de solicitudes anteriores permanecen en `publicacion_estatus_historial`. Si el negocio requiere reconstruir también la fecha límite y estimación histórica, se deberá añadir una instantánea SLA al historial; la tabla actual no conserva esos valores por cada transición.
7. **Permisos y contenido:** carga/listado con permisos `social-media.posts.edit` / `social-media.posts.read`, además de verificación de alcance de todas las cuentas destino. Borrado de archivos fuera del MVP para no eliminar por accidente una pieza entregada; puede añadirse con confirmación y auditoría en una fase posterior.

## 4. Arquitectura funcional propuesta

### Drive

- Mantener la carpeta raíz existente por publicación.
- Añadir y persistir IDs de las subcarpetas `Brief` y `Entregables` (campos en `publicaciones` o tabla de metadatos Drive). La creación debe ser idempotente para cubrir publicaciones existentes y fallos parciales.
- Acciones servidor: asegurar estructura; listar archivos de Brief; subir a Brief; listar archivos de Entregables para Design; comprobar que Entregables tenga al menos un archivo.
- Subida validada por usuario/permisos, UUID de publicación, destino interno de la carpeta, MIME permitido y tamaño máximo. No aceptar un `folderId` arbitrario enviado por el navegador.
- El viewer muestra nombre, tipo, tamaño, fecha, thumbnail si está disponible y enlace de Drive. Descarga/preview se puede abrir con el enlace de Drive de acuerdo con el permiso público actual; no se exponen credenciales de Service Account.
- MVP no implementa eliminación de archivos. La posibilidad de eliminar manualmente en Drive y su impacto se comunica; la acción de entrega siempre vuelve a consultar Drive.

### Flujo de estados

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE_BRIEF
    PENDIENTE_BRIEF --> SOLICITADO: Social Media / brief con archivo
    EN_RODAJE --> SOLICITADO: Social Media / brief con archivo
    SOLICITADO --> PENDIENTE_BRIEF: Social Media / antes de iniciar Design
    SOLICITADO --> EN_DISENO: Design abre
    EN_CORRECCION --> EN_DISENO: Design abre
    EN_DISENO --> EN_REVISION_CM: Design entrega archivo final
```

El resto de transiciones editoriales existentes no cambia. La ida a `PENDIENTE_BRIEF` registra una transición normal en historial, sin motivo obligatorio. Una nueva solicitud crea otra entrada `SOLICITADO` y renueva los campos del ciclo actual.

## 5. Plan por fases

### Fase 0 — Privacidad, inventario y contrato de archivos

- Confirmar que briefs, referencias y piezas pueden estar bajo el permiso `anyone: reader` actual. Si no, definir acceso restringido y su impacto en preview/descarga.
- Inventariar carpetas existentes y archivos en raíz. Definir cómo clasificar/mover archivos actuales a `Brief` o `Entregables`; no asumir que el contenido existente es uno u otro.
- Acordar límites iniciales de tamaño, tipos permitidos y cantidad máxima por solicitud.
- Decidir si la vista de detalle requiere viewer embebido en MVP o basta lista y apertura de Drive.

**Salida:** política de acceso y plan de clasificación sin mover/borrar archivos accidentalmente.

### Fase 1 — Esquema y servicios Drive

- Crear migración aditiva para IDs/estado sincronizado de Brief y para cualquier metadato operativo necesario.
- Crear/asegurar subcarpetas idempotentemente para publicaciones nuevas y existentes.
- Implementar listar y subir archivos desde servidor, autorizando sesión, permiso y acceso a cuentas.
- Persistir el resultado del chequeo de Brief en una función no ejecutable directamente por usuarios autenticados; añadir índice/estado si se necesita.
- Mantener separada la verificación de entregables de Design, apuntándola a `Entregables` y definiendo tratamiento transitorio de archivos ya presentes en la raíz.

**Salida:** API de servidor segura y modelo de Drive compatible con publicaciones existentes.

### Fase 2 — UI de Brief y archivos

- Crear sección reusable de Brief con selección múltiple/drag and drop, progreso, cancelación antes de completar y errores recuperables.
- Añadir lista de archivos de Brief (nombre, tipo, tamaño, fecha, enlace/preview disponible).
- Integrarla en Crear después de crear la publicación/carpeta y en Editar/Detalle cuando exista publicación.
- Mostrar estado accesible “Faltan archivos” / “Brief listo” y cantidad/última comprobación. No permitir que el estado dependa únicamente de un hook local sin actualizar el servidor.
- No habilitar borrar en el MVP.

**Salida:** Social Media puede subir y revisar archivos sin salir de la aplicación, con mensajes de progreso y error claros.

### Fase 3 — Guardas del flujo y ciclo reversible

- En la acción servidor de transición a `SOLICITADO`: verificar autorización y alcance, consultar Drive, actualizar el estado de Brief y llamar a la transición SQL; propagar errores claros y distinguir fallo de Drive de brief vacío.
- En SQL: rechazar `SOLICITADO` cuando el estado sincronizado indique cero archivos; proteger las columnas de sincronización contra escrituras del cliente. La RPC debe seguir verificando rol, estado y cuentas.
- Añadir `SOLICITADO → PENDIENTE_BRIEF` en RPC y selector, solo para Social Media y sin motivo.
- En el retorno no borrar fechas ni historial. Al volver a `SOLICITADO`, fijar fechas del nuevo ciclo y dejar que el historial preserve las solicitudes anteriores.
- Design entrega solo cuando la subcarpeta `Entregables` contenga al menos un archivo; los archivos de `Brief` no cuentan.

**Salida:** tanto la UI como las entradas de servidor autorizadas respetan las reglas del flujo.

### Fase 4 — Operación y reconciliación

- Proveer una forma administrativa/operativa de volver a consultar Drive para reparar estado sincronizado si un archivo se elimina fuera de la aplicación.
- Registrar errores de subida/listado y mantener acciones reintentables sin duplicar publicación ni carpeta.
- Documentar variables/configuración, despliegue y límites de Drive.

**Salida:** errores recuperables sin depender de borrar/recrear publicaciones.

## 6. Matriz de permisos

| Acción | Rol/permiso | Chequeos adicionales |
|---|---|---|
| Subir/listar Brief | Social Media; `social-media.posts.edit` / `social-media.posts.read` | Publicación activa, todas las cuentas destino asignadas, carpeta resuelta en servidor |
| Solicitar a Design | Social Media; `social-media.posts.status.update` | Estado permitido, Brief verificado en Drive y conteo sincronizado positivo |
| Volver a Brief | Social Media; `social-media.posts.status.update` | Estado actual `SOLICITADO`; registrar historial |
| Listar/entregar pieza | Design; permisos existentes `design.posts.read` / `design.posts.deliver` | Solo cola Design; archivo en `Entregables` antes de entrega |
| Eliminar archivo | Fuera de alcance del MVP | Definir auditoría y evitar borrar entregable activo antes de habilitar |

Las acciones servidor deben validar el ID y no confiar en `folderId`, conteos ni nombres de carpeta enviados por el cliente. Si la RPC mantiene ejecución directa para `authenticated`, la garantía de Drive depende del estado sincronizado protegido por RLS/permisos y no de una validación de Google ejecutada dentro de PostgreSQL.

## 7. Criterios de aceptación

1. Social Media puede subir varios archivos permitidos a Brief con progreso y errores claros; la operación no revela credenciales ni acepta carpetas arbitrarias.
2. La lista muestra metadatos disponibles y abre/preview el archivo según permisos actuales.
3. La tarjeta y los modales reflejan si hay archivos de Brief, respaldado por una consulta/sincronización de servidor.
4. Sin archivos, la UI explica por qué `SOLICITADO` no está disponible y la RPC rechaza la transición aunque se invoque fuera del selector.
5. Con archivos de Brief, Social Media puede solicitar; las fechas del SLA corresponden a ese ciclo.
6. Desde `SOLICITADO`, Social Media puede volver a `PENDIENTE_BRIEF` sin motivo. Desde `EN_DISENO` no puede hacerlo.
7. Al re-solicitar, las fechas actuales se renuevan y las transiciones anteriores siguen visibles en el historial.
8. Un archivo en Brief no satisface el requisito de entrega de Design; se requiere un archivo en Entregables.
9. Ninguna operación de fallo parcial duplica una publicación o crea subcarpetas duplicadas.

## 8. Migraciones de Supabase previstas

Sí, se requiere una nueva migración. Como mínimo debe:

- Añadir referencias/IDs de las subcarpetas y estado sincronizado de Brief (o tablas equivalentes).
- Restringir escritura directa de los metadatos de sincronización; añadir RPC/funciones con grants mínimos para actualizar el resultado consultado por el servidor.
- Actualizar `transition_publicacion_status` para exigir Brief registrado antes de `SOLICITADO`, permitir retorno `SOLICITADO → PENDIENTE_BRIEF` y recalcular fechas por ciclo.
- Actualizar checks/policies/grants únicamente si las nuevas columnas o RPC lo requieren.
- No añadir estado al enum; ambos estados ya existen.

La migración no debe ejecutar llamadas HTTP a Google desde PostgreSQL. La acción de servidor realiza la lectura de Drive y Supabase aplica la condición sobre el estado sincronizado.

## 9. Fuera de alcance inicial

- Versionado de copy o assets, comentarios nuevos, asignación individual a Design.
- Borrado de archivos desde Kromi, salvo que se apruebe después con auditoría.
- Cambiar el permiso público de Drive sin decisión específica; mantenerlo requiere reconocer que cualquier persona con acceso al enlace puede leer los assets.
- Descarga proxy/streaming desde Kromi, edición online, carga de archivos grandes/resumible y sincronización bidireccional completa.

## 10. Decisiones que bloquean iniciar la implementación

1. ¿Se acepta que Brief y Entregables sean legibles por cualquiera que tenga el enlace, dado el permiso `reader` público actual, o se debe restringir Drive?
2. ¿Qué límite de tamaño y tipos de archivo se habilitan en la primera versión?
3. ¿Se confirma que solo `SOLICITADO` puede volver a `PENDIENTE_BRIEF`, y que no se habilita retorno después de que Design abra la solicitud?
4. ¿Se deben clasificar/mover los archivos que ya estén en carpetas existentes antes de activar la nueva validación?

El resto del alcance puede implementarse con los acuerdos y recomendaciones anteriores.
