# Plan de implementación: espejo de diseño de Kromi Connect a Google Sheets

**Estado del documento:** plan para ejecución manual  
**Repositorio:** `ernest0dev/kromi-connect`  
**Rama de referencia:** `main`  
**Archivo principal:** `src/lib/googleSheetsMirror.ts`  
**Última revisión documentada:** 2026-10-28

## 1. Objetivo

Documentar lo que ya está implementado en la sincronización unidireccional de información operativa de diseño desde Supabase hacia Google Sheets y especificar las tareas pendientes para agregar nombres y correos de usuarios, conservando los UUID como identificadores técnicos.

Supabase sigue siendo la fuente de verdad. Google Sheets es una vista de consulta; no debe convertirse en una fuente de escritura hacia Kromi Connect.

## 2. Estado actual confirmado

### 2.1 Integración con Google Sheets

En `src/lib/googleSheetsMirror.ts` ya existe:

- Creación de cliente de Google Sheets mediante cuenta de servicio.
- Lectura de variables de entorno `GOOGLE_SERVICE_ACCOUNT_EMAIL` (con alternativa `GOOGLE_CLIENT_EMAIL`) y `GOOGLE_PRIVATE_KEY`.
- Identificador de spreadsheet desde `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Interruptor para habilitar el espejo mediante `GOOGLE_SHEETS_SYNC_ENABLED === 'true'`.
- Uso de `getSupabaseAdmin()` para leer información desde el servidor.
- Creación de pestañas administradas cuando no existen.
- Limpieza y reconstrucción completa de las pestañas administradas en cada sincronización.
- Envío de valores a Google Sheets usando `valueInputOption: 'RAW'` y protección de valores con apariencia de fórmula en `cleanCell()`.
- Sincronización de tres pestañas: `Cola de producción`, `Historial operativo` e `Histórico Excel`.
- Función pública `syncDesignMirrorToGoogleSheets()`, que informa si la sincronización estaba habilitada y cuántas filas se escribieron.

### 2.2 Pestañas y fuente de datos

**Cola de producción**
- Publicaciones: tabla `publicaciones`, filtrada por `deleted_at IS NULL`, `requiere_diseno = true` y estados de trabajo de diseño configurados en el código.
- Solicitudes internas: tabla `pendientes_tienda`, filtrada por archivado, estado de diseño y cancelación.
- Eventos: tabla `eventos`, filtrada por archivado, estado de diseño y cancelación.
- La columna `Diseñador ID` actualmente contiene `disenador_id`.
- El código ya añade los encabezados `Diseñador nombre` y `Diseñador email` a la cola, pero **todavía no los llena**; las filas conservan su estructura anterior. Hay que corregir esta desalineación en la tarea pendiente.
- El encabezado de solicitante aún no está implementado en `main`.

**Historial operativo**
- Une registros de `publicacion_estatus_historial`, `pendiente_tienda_historial` y `evento_historial`.
- Busca títulos asociados en las tablas operativas.
- Actualmente escribe el UUID de `cambiado_por` bajo `Actor ID`.
- Las columnas `Actor nombre` y `Actor email` aún no están implementadas.

**Histórico Excel**
- Lee registros de `design_solicitudes_historicas` y copia campos importados del histórico original.
- Esta pestaña no está incluida en el cambio de contactos de usuarios, porque sus columnas `Diseñador original` y `Solicitante original` representan valores históricos importados, no necesariamente usuarios de Supabase Auth.

### 2.3 Configuración de ejecución

La sincronización está diseñada para ejecutarse desde una ruta de cron de Vercel, con protección mediante `CRON_SECRET`. En la sesión del 28-10-2026 se configuró `CRON_SECRET` en Vercel, se hizo un despliegue y se probó la ruta manualmente mediante `curl`; la prueba devolvió una ejecución correcta. La configuración exacta de `GOOGLE_SHEETS_SYNC_ENABLED` no debe darse por supuesta: verificar su valor en el entorno Production antes de probar.

La documentación del endpoint y el cron deben revisarse en el repositorio si hay que cambiar horarios o variables. No incluir secretos en este documento ni en los registros.

### 2.4 Commit de referencia y cambio provisional ya guardado

El commit confirmado en `main` al preparar este plan es:

- `af91d4f2f9b74b1819f36d4f619ce362dcb99f58` — `chore: retry Google Sheets mirror headers write`.

Ese commit añadió `Diseñador nombre` y `Diseñador email` al encabezado de `Cola de producción`, pero todavía no implementa la consulta ni el mapeo de esos datos. Es un cambio parcial y debe completarse en la tarea 3 antes de considerar finalizada esta funcionalidad.

## 3. Esquema pertinente de Supabase

Según la documentación del repositorio:

- `public.profiles` contiene `user_id` (UUID) y `full_name` (texto nullable).
- El correo se almacena en `auth.users.email`, dentro del esquema Auth, no como una columna documentada de `public.profiles`.
- `publicaciones` contiene `creador_id` y `disenador_id`.
- `pendientes_tienda` contiene `creado_por` y `disenador_id`.
- `eventos` contiene `creado_por` y `disenador_id`.
- Las tres tablas de historial contienen `cambiado_por`, nullable en el esquema documentado.

El cliente `getSupabaseAdmin()` se crea con `SUPABASE_SERVICE_ROLE_KEY` y está marcado como código exclusivo de servidor (`server-only`). La lectura de correos mediante Auth Admin debe permanecer exclusivamente en el servidor.

## 4. Resultado funcional esperado

### Cola de producción

Mantener todos los UUID originales y añadir los datos legibles:

| Campo | Valor de origen |
|---|---|
| `Solicitante ID` | `creador_id` en publicaciones; `creado_por` en solicitudes internas y eventos |
| `Solicitante nombre` | `profiles.full_name`; si falta, metadatos de usuario permitidos como respaldo |
| `Solicitante email` | `auth.users.email` mediante Supabase Auth Admin |
| `Diseñador ID` | `disenador_id` |
| `Diseñador nombre` | `profiles.full_name`; si falta, metadatos de usuario permitidos como respaldo |
| `Diseñador email` | `auth.users.email` mediante Supabase Auth Admin |

### Historial operativo

Mantener `Actor ID` y añadir:

| Campo | Valor de origen |
|---|---|
| `Actor ID` | `cambiado_por` |
| `Actor nombre` | `profiles.full_name`; con respaldo opcional de metadatos de Auth |
| `Actor email` | `auth.users.email` mediante Supabase Auth Admin |

Si un ID es nulo, no corresponde a un usuario recuperable o el perfil no tiene nombre, dejar en blanco solo el valor que no exista. No sustituir ni eliminar los UUID existentes.

## 5. Trabajo pendiente para implementación manual

### Tarea 1 — Revisar el estado actual antes de editar

1. Abrir `src/lib/googleSheetsMirror.ts` en `main`.
2. Confirmar que los encabezados actuales de la cola contienen `Diseñador nombre` y `Diseñador email`.
3. Confirmar que las filas todavía no incluyen los valores descriptivos y que el historial no tiene columnas de nombre/correo de actor.
4. Revisar el tipo inferido por Supabase para las consultas implicadas y comprobar que las columnas indicadas coinciden con el esquema real.
5. Mantener un respaldo o trabajar en un cambio revisable antes de modificar el archivo.

### Tarea 2 — Completar encabezados

En `MANAGED_SHEETS`:

1. En `Cola de producción`, organizar el bloque de solicitante y diseñador conservando sus IDs:
   - `Solicitante ID`, `Solicitante nombre`, `Solicitante email`
   - `Diseñador ID`, `Diseñador nombre`, `Diseñador email`
2. En `Historial operativo`, dejar el bloque:
   - `Actor ID`, `Actor nombre`, `Actor email`, seguido de `Motivo`.
3. Asegurarse de que el número y orden de valores de cada fila coincida exactamente con los encabezados; un error de alineación desplaza los datos entre columnas.

### Tarea 3 — Crear un resolvedor de etiquetas de usuario

Agregar un helper de servidor, por ejemplo `getUserLabels(userIds)`, que:

1. Reciba una lista de UUID opcionalmente nulos.
2. Elimine duplicados y excluya valores nulos/vacíos.
3. Consulte en una única consulta por lote `profiles(user_id, full_name)` para obtener nombres.
4. Use `admin.auth.admin.getUserById(id)` para recuperar el email de cada usuario con el cliente administrativo de Supabase.
5. Limite la concurrencia por lotes para evitar lanzar una petición por cada registro histórico de forma ilimitada.
6. Retorne un `Map<string, { name: string; email: string }>`.
7. Use `full_name` como fuente principal del nombre. Puede utilizar `user_metadata.full_name` o `user_metadata.name` solo como respaldo si resulta apropiado para los datos reales de la aplicación.
8. Si no existe un usuario, conservar la fila y dejar en blanco los datos de contacto ausentes.
9. Tratar errores reales de la API como errores explícitos de sincronización; no ocultar indiscriminadamente fallos de autenticación, límites de petición o errores de red como si el usuario no existiera.

No consultar directamente `auth.users` con PostgREST ni exponer su email en código cliente. No registrar correos ni tokens innecesariamente en logs.

### Tarea 4 — Incluir los identificadores de solicitante en la consulta de la cola

Añadir a las selecciones existentes:

- `publicaciones`: incluir `creador_id`.
- `pendientes_tienda`: incluir `creado_por`.
- `eventos`: incluir `creado_por`.

Mantener `disenador_id` en las tres consultas. No alterar los filtros de estado ni los criterios de inclusión de la cola.

### Tarea 5 — Resolver y mapear contactos en Cola de producción

Después de obtener los tres conjuntos de filas:

1. Construir un conjunto de UUID con los solicitantes y diseñadores de las tres fuentes.
2. Llamar una sola vez al resolvedor de etiquetas para ese conjunto.
3. Al formar cada fila, escribir el ID del solicitante, su nombre, su email, el ID del diseñador, su nombre y su email en el mismo orden definido en los encabezados.
4. Mantener el resto de columnas y los identificadores compuestos `SOCIAL_MEDIA:`, `INTERNAL:` y `EVENTS:` sin cambios.

### Tarea 6 — Resolver y mapear contactos en Historial operativo

Después de cargar los tres historiales:

1. Recopilar los valores únicos no nulos de `cambiado_por`.
2. Resolver las etiquetas de dichos usuarios.
3. Añadir nombre y email a cada fila inmediatamente después de `Actor ID` y antes de `Motivo`.
4. Preservar los campos JSON de `anterior` y `nuevo`, los títulos y las claves únicas de evento ya existentes.

Si se prefiere optimizar las solicitudes, puede reutilizarse un helper común para ambos constructores; cada llamada debe evitar trabajo redundante dentro del mismo conjunto de datos.

### Tarea 7 — Rendimiento y límites

- Evitar una petición Auth individual por cada fila cuando el UUID se repite; deduplicar antes de resolver.
- Limitar concurrencia de Auth Admin en bloques pequeños (por ejemplo, 10 a la vez) o emplear una alternativa compatible con la versión instalada de Supabase.
- Tener en cuenta que el historial puede crecer más que la cola. Para volúmenes grandes, probar duración total del cron y cuotas del proveedor antes de aumentar el lote.
- Si el número de UUID excede límites de consulta `IN` de PostgREST, dividir también la consulta a `profiles` en lotes.
- Confirmar que no se ha introducido una dependencia que sea evaluada en navegador: `googleSheetsMirror.ts` y `getSupabaseAdmin()` deben permanecer server-only.

### Tarea 8 — Verificar el contrato de filas

Añadir pruebas unitarias o validaciones locales para comprobar:

- La longitud de la fila de encabezados y la de cada fila coinciden.
- La fila de publicaciones mapea `creador_id`, solicitante y diseñador a las columnas correctas.
- Solicitudes internas y eventos mapean `creado_por` y `disenador_id).
- Un actor nulo no rompe la fila ni desplaza `Motivo`.
- Un usuario sin nombre conserva su UUID y correo, si existe.
- Un usuario sin email conserva su UUID y nombre, si existe.
- Los datos del histórico Excel mantienen su esquema actual.
- Los valores enviados a Sheets continúan pasando por `cleanCell()`.

### Tarea 9 — Despliegue y prueba integrada

1. Ejecutar lint, comprobación de tipos y pruebas disponibles del proyecto.
2. Revisar el diff de `src/lib/googleSheetsMirror.ts`, especialmente la concordancia de encabezados y posiciones de celdas.
3. Guardar el cambio con un commit claro, por ejemplo `feat: add user contact details to Google Sheets mirror`.
4. Confirmar que Vercel desplegó el commit esperado.
5. Verificar las variables de entorno de Production sin publicar sus valores.
6. Ejecutar manualmente el endpoint protegido de cron usando el mecanismo seguro existente; no guardar el secreto en archivos, comentarios ni logs.
7. Comprobar en Google Sheets las tres pestañas, sus encabezados y algunos registros representativos de publicaciones, solicitudes internas, eventos e historial.
8. Confirmar que UUID, nombre y correo de cada persona estén en las columnas correctas.
9. Revisar una fila con usuario sin nombre o con actor nulo y asegurar que la ejecución no falle.
10. Confirmar una ejecución diaria normal del cron. El espejo debe seguir siendo unidireccional: las modificaciones manuales en las pestañas administradas se reemplazan con la próxima sincronización.

## 6. Reglas operativas importantes

- Las pestañas administradas se limpian y reconstruyen en cada ejecución. No añadir columnas manuales ni datos que deban persistir allí.
- Los encabezados se definen en `MANAGED_SHEETS`; cambiar el texto en Google Sheets directamente no es permanente.
- No cambiar el contenido de `Histórico Excel` como parte de este alcance.
- No agregar una migración de base de datos solo para resolver nombres: `profiles.full_name` ya existe en el esquema documentado. Sí puede ser necesario completar nombres en perfiles si actualmente están vacíos, pero eso es una tarea de calidad de datos separada.
- Mantener secretos en las variables de entorno de Vercel, nunca en Git.
- Correo electrónico es un dato personal: solo debe quedar en la hoja de trabajo apropiada y con los permisos de acceso adecuados.

## 7. Criterios de aceptación

- [ ] Cola de producción conserva UUID de solicitante y diseñador.
- [ ] Cola de producción muestra el nombre y correo del solicitante.
- [ ] Cola de producción muestra el nombre y correo del diseñador.
- [ ] Historial operativo conserva `Actor ID`.
- [ ] Historial operativo muestra nombre y correo de actor cuando existen.
- [ ] Usuarios sin nombre/email no hacen fallar la sincronización.
- [ ] Ningún email o secreto se expone al cliente o se añade a logs innecesarios.
- [ ] Las filas mantienen el mismo orden que los encabezados.
- [ ] Las tres pestañas se sincronizan correctamente y los datos originales continúan siendo los de Supabase.
- [ ] Pruebas y verificación manual del endpoint completadas.
- [ ] Despliegue de producción comprobado.

## 8. Fuentes internas que conviene consultar al implementar

- `src/lib/googleSheetsMirror.ts`: lógica actual del espejo y encabezados.
- `src/lib/supabaseClient.ts`: inicialización del cliente administrativo y condición server-only.
- `docs/supabase-schema-public.md`: tablas `profiles`, `publicaciones`, `pendientes_tienda`, `eventos` y tablas de historial.
- `docs/supabase-schema-auth.md`: documentación del esquema Auth y del correo de usuario.
- `docs/integraciones/`: documentación existente relacionada con el espejo de Google Sheets y el endpoint de cron.

---

**Nota de estado:** este documento es un plan de trabajo, no evidencia de que la ampliación de nombres/correos haya sido implementada. A la fecha de esta revisión, solo está confirmado el cambio parcial de encabezados de diseñador en `main`; las consultas y el mapeo de contactos siguen pendientes.
