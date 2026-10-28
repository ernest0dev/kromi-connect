# Plan de implementación: espejo automático de Kromi Connect en Google Sheets

**Estado:** Plan propuesto; todavía no implementado.
**Destino:** `main` — `docs/integraciones/plan-google-sheets-espejo.md`
**Objetivo:** mantener una hoja de Google Sheets actualizada automáticamente desde Kromi Connect para consulta, filtros e informes. Kromi Connect/Supabase sigue siendo la única fuente de verdad.

## 1. Decisión de arquitectura

Implementar sincronización **unidireccional Supabase → Google Sheets**, ejecutada en el servidor. La hoja no debe escribir ni modificar el estado operativo de Kromi Connect.

- **Fuente de verdad:** tablas y RPC de Kromi Connect en Supabase.
- **Destino:** un Google Spreadsheet compartido con la cuenta de servicio autorizada.
- **Autenticación:** Google Sheets API desde código de servidor; nunca desde componentes cliente.
- **Entrega:** cola/outbox persistente en Supabase más un worker HTTP protegido, ejecutado mediante el cron ya disponible en el proyecto o una tarea programada de Vercel.
- **Consistencia:** sincronización eventual; un fallo de Google no debe bloquear la creación o transición de solicitudes en Kromi Connect.
- **Reintentos:** persistir errores, reintentar con backoff y permitir reprocesamiento manual.
- **Idempotencia:** cada fila se identifica por un ID estable de Kromi Connect, no por el número de fila ni por el título de la solicitud.

No se recomienda escribir en Sheets directamente desde el navegador, usar una URL de Apps Script pública como mecanismo principal ni hacer que Google Sheets sea una segunda base de datos operativa.

## 2. Alcance inicial y estructura del Spreadsheet

Crear un Spreadsheet con estas pestañas administradas por la integración:

### 2.1 `Cola de producción`

Una fila por publicación/solicitud de producción vigente, sincronizada como una **proyección del estado actual**. Incluir los estados activos que corresponden a la cola y los campos útiles para operación, por ejemplo:

- ID estable de la publicación en Kromi Connect.
- Nombre/título o idea principal.
- Tipo/formato y cuentas destino, cuando existan.
- Estado actual.
- Fecha de publicación, fecha de solicitud a Design, fecha estimada y fecha real de entrega, cuando existan.
- Diseñador asignado, si corresponde.
- Fecha de última actualización en Kromi Connect.
- Enlace a la solicitud dentro de Kromi Connect, si se puede construir de forma estable.

La selección exacta de estados y columnas se debe mapear a los estados reales del esquema y a la definición vigente de la cola. No incluir credenciales, tokens, contenido privado innecesario ni datos personales que no sean necesarios para el trabajo.

### 2.2 `Historial operativo`

Una fila por transición/entrada del historial operativo. Debe conservar los eventos anteriores incluso cuando la publicación cambie de estado. Usar el ID de la entrada de historial como clave idempotente; si la tabla no dispone de una clave estable adecuada, resolverlo en la migración de sincronización sin cambiar el significado del historial existente.

Columnas sugeridas: ID del evento, ID de publicación, fecha/hora, estado anterior, estado nuevo, actor si está disponible y autorizado, motivo/comentario si corresponde y enlace a la publicación.

### 2.3 `Histórico Excel`

Reflejo de solo lectura de `public.design_solicitudes_historicas`, incluyendo el ID de origen y los campos aprobados para consulta. Mantener separada esta pestaña del historial operativo: los registros importados desde Excel no deben convertirse en solicitudes activas ni mezclarse como si fueran eventos operativos nuevos.

### 2.4 Reglas para la hoja

- La integración administra el contenido de las tres pestañas. Los usuarios pueden filtrar y consultar, pero no deben insertar, borrar, reordenar ni editar filas de datos directamente.
- Preferir vistas de filtro y formato visual sobre ordenar físicamente el rango. Si se necesita edición libre o anotaciones del equipo, crear una pestaña aparte no sincronizada.
- No usar el número de fila como identificador permanente.
- Documentar el nombre de las pestañas y los encabezados como contrato de integración; evitar cambios manuales en esos encabezados.
- Si el Spreadsheet se recrea, ejecutar una resincronización inicial completa.

## 3. Diseño técnico propuesto

### Fase 0 — Confirmar contratos y accesos

1. Revisar el esquema y las consultas/RPC que alimentan la cola de Design y su historial unificado.
2. Confirmar las columnas de la tabla operativa de publicaciones, la tabla de historial de estados y `public.design_solicitudes_historicas`.
3. Definir una lista permitida de columnas para cada pestaña, respetando permisos y minimización de datos.
4. Confirmar si el proyecto desplegado utiliza Google OAuth o una cuenta de servicio para Drive. No asumir que las credenciales de Drive actuales pueden acceder a Sheets sin una prueba específica.
5. Confirmar que el cron/worker existente puede invocar un endpoint autenticado en el entorno desplegado.

**Salida:** mapeo fuente → columnas y contrato de pestañas aprobado antes de escribir código.

### Fase 1 — Configuración de Google

1. En Google Cloud Console, seleccionar o crear un proyecto dedicado a la integración.
2. Habilitar **Google Sheets API**.
3. Crear una cuenta de servicio para Kromi Connect (o reutilizar una existente solo después de validar que la política de seguridad lo permite).
4. Guardar la clave JSON de la cuenta de servicio de forma segura. No subir el JSON al repositorio ni incluirlo en logs.
5. Crear el Spreadsheet desde la cuenta organizativa responsable y compartirlo con el correo de la cuenta de servicio con permiso **Editor**.
6. Copiar el ID del Spreadsheet desde su URL y configurar las variables del entorno de servidor.
7. Si la organización usa Google Workspace, confirmar que las políticas de compartir documentos permiten compartirlo con esa cuenta de servicio.

### Fase 2 — Configuración de entorno

Variables propuestas (los nombres definitivos deben quedar consistentes entre el código, `.env.example` y el despliegue):

- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID del Spreadsheet de destino.
- `GOOGLE_SHEETS_SYNC_ENABLED`: interruptor para activar/desactivar la integración (`false` por defecto hasta completar pruebas).
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`: correo de la cuenta de servicio.
- `GOOGLE_SHEETS_PRIVATE_KEY`: clave privada de la cuenta de servicio, almacenada como secreto. Si el proveedor requiere escapar saltos de línea, normalizarlos al inicializar el cliente.

No usar prefijo `NEXT_PUBLIC_` para estas variables. No guardar la clave privada en el código, en archivos de configuración versionados, en el Spreadsheet ni en registros. Si se decide reutilizar las variables existentes de la cuenta de servicio de Drive, documentar explícitamente esa decisión y probar los permisos de Sheets antes de eliminar variables duplicadas.

Configurar los mismos secretos en local y en el proveedor de despliegue (por ejemplo, Vercel → Project → Settings → Environment Variables), seleccionando los entornos necesarios. Reiniciar o redesplegar para que las funciones servidor reciban las variables nuevas.

### Fase 3 — Persistencia de sincronización

Añadir una migración Supabase para una tabla outbox de eventos de sincronización, con al menos:

- ID del evento.
- Tipo de entidad y operación (publicación, transición de historial o registro histórico).
- ID estable del registro fuente.
- Fecha de creación, intentos, próxima fecha de reintento, fecha de procesamiento y último error.
- Estado de procesamiento.

Añadir restricciones/índices para evitar encolar el mismo cambio más de una vez cuando corresponda. Los triggers deben ser pequeños: registrar el evento y terminar; no llamar a Google desde PostgreSQL.

Evaluar también una tabla de correspondencia de filas solo si el diseño final requiere conservar rangos de fila. La alternativa preferida es localizar/actualizar por clave estable o reconstruir una pestaña completa en una resincronización controlada; nunca depender solo del índice de fila. Definir y probar el manejo de concurrencia para evitar que dos workers procesen el mismo evento a la vez.

La outbox debe respetar RLS/grants: solo el backend autorizado puede leer, reclamar, actualizar y reintentar trabajos. No conceder acceso a la outbox a usuarios normales.

### Fase 4 — Adaptador de Google Sheets

Crear un módulo de servidor aislado que:

1. Inicialice el cliente Google con credenciales de entorno.
2. Compruebe que la sincronización está habilitada y que el Spreadsheet y pestañas esperadas existen.
3. Convierta datos de Supabase a filas explícitas y normalizadas, con fechas ISO legibles y valores nulos consistentes.
4. Actualice la fila existente por clave estable o inserte la fila si aún no existe.
5. Mantenga los eventos del historial como entradas independientes e idempotentes.
6. Use rangos/operaciones por lotes cuando sea posible y respete los límites de cuota de Google.
7. Escape/formatee los valores como texto cuando proceda para evitar que contenido controlado por usuarios sea interpretado como fórmula en Sheets.
8. No registre secretos ni payloads completos con datos innecesarios.

La implementación debe confirmar el comportamiento real de la API de Sheets y la estrategia de upsert antes de elegir la librería o añadir dependencias.

### Fase 5 — Worker y recuperación

- Crear un Route Handler de servidor protegido por un secreto de cron o por el mecanismo de autorización de cron que ya use el proyecto.
- Procesar un lote acotado por ejecución, reclamar trabajos de forma atómica y marcar éxito solo después de confirmar la escritura en Sheets.
- Aplicar backoff exponencial y límite de intentos; los trabajos agotados deben quedar visibles para diagnóstico y reproceso.
- Exponer en logs solo IDs de evento, estado, duración y errores sanitizados.
- Añadir una operación administrativa segura para resincronización inicial y reprocesamiento; no exponerla a usuarios sin permiso.
- Programar el worker usando la infraestructura cron ya adoptada por el proyecto. No crear una segunda programación hasta revisar la existente.

### Fase 6 — Carga inicial y reconciliación

1. Crear/validar las tres pestañas y encabezados.
2. Cargar la cola actual desde la fuente operativa.
3. Cargar el historial operativo existente, preservando la identidad de cada evento.
4. Cargar el histórico importado desde `design_solicitudes_historicas` sin alterar su payload original.
5. Ejecutar una reconciliación que compare conteos y claves fuente/destino y reporte diferencias.
6. Activar sincronización incremental solo después de aprobar la carga inicial.

La carga inicial debe ser repetible sin duplicar filas. Debe existir un procedimiento para reconstruir las pestañas desde Supabase si la hoja se borra o se daña.

## 4. Seguridad y permisos

- La cuenta de servicio solo recibe acceso de Editor al Spreadsheet dedicado; no compartirle toda la unidad ni documentos que no necesite.
- Las credenciales se guardan únicamente como secretos de servidor.
- El endpoint de sincronización no debe ser público sin autenticación fuerte; validar el secreto con comparación segura y no incluirlo en URLs.
- Mantener la autorización de lectura del histórico conforme a los permisos actuales. La integración de backend debe tener acceso mínimo y explícito a las tablas/RPC necesarias.
- La hoja puede ampliar la audiencia de los datos: confirmar quién debe verla y qué columnas pueden compartirse antes de sincronizar.
- No permitir que una edición en Sheets actualice Supabase en este MVP.
- Rotar la clave de la cuenta de servicio si se expone y revocar claves antiguas.
- No afirmar que el despliegue está conectado hasta que las pruebas se completen en el entorno real.

## 5. Pruebas y criterios de aceptación

### Funcionales
- Una nueva publicación aparece en la cola de Sheets una sola vez.
- Un cambio de estado/fecha/diseñador actualiza la fila de la cola sin duplicarla.
- Una transición crea una entrada en el historial operativo y no se pierde al cambiar el estado actual.
- Los registros históricos importados aparecen en su pestaña sin entrar en la cola.
- Los estados terminales salen de la cola activa según la definición acordada, pero se mantienen en historial cuando corresponda.
- Una resincronización completa es idempotente.

### Fallos y recuperación
- Si Google Sheets no está disponible, Kromi Connect sigue permitiendo el flujo operativo y el evento queda pendiente.
- Tras restaurarse la conexión, el worker reintenta y la hoja converge al estado fuente.
- Dos workers simultáneos no duplican eventos ni corrompen filas.
- Una clave inválida, permisos insuficientes o ID de Spreadsheet incorrecto producen errores diagnósticos sin filtrar secretos.
- El endpoint rechaza llamadas no autorizadas.
- Se verifica el tratamiento de texto que comienza con `=`, `+`, `-` o `@` para prevenir interpretación como fórmula.

### Operación
- Documentar procedimiento de alta, rotación de credenciales, pausa de sincronización, resincronización y revisión de errores.
- Registrar fecha de última sincronización correcta y número de trabajos pendientes/fallidos en una forma visible solo para administradores.

## 6. Orden de trabajo recomendado

1. **Auditoría de esquema y credenciales** (sin cambios de producción).
2. **Crear Spreadsheet y permisos** manualmente.
3. **Migración outbox + módulo de sincronización**.
4. **Endpoint/worker protegido y cron**.
5. **Carga inicial idempotente**.
6. **Pruebas de fallo, concurrencia, permisos y reconciliación**.
7. **Activación gradual** con `GOOGLE_SHEETS_SYNC_ENABLED=false` hasta aprobar pruebas.
8. **Actualizar `.env.example`, documentación y seguimiento del proyecto** con los nombres definitivos y resultados verificados.

## 7. Pasos manuales de conexión (resumen)

1. Abrir Google Cloud Console y crear/seleccionar proyecto.
2. Habilitar Google Sheets API.
3. Crear una cuenta de servicio; generar y descargar su clave JSON solo en un equipo autorizado.
4. Crear el Spreadsheet y compartirlo con el correo de la cuenta de servicio como Editor.
5. Copiar el ID del Spreadsheet.
6. Añadir `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_SYNC_ENABLED=false`, `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SHEETS_PRIVATE_KEY` a las variables del entorno de despliegue y local.
7. Configurar los mismos secretos en Vercel para los entornos que se probarán. Mantener `GOOGLE_SHEETS_SYNC_ENABLED=false` hasta que la implementación y pruebas estén listas.
8. Tras desplegar el código, ejecutar una prueba controlada de lectura/escritura y verificar que solo se modifica el Spreadsheet compartido.
9. Activar la sincronización y comprobar que una solicitud de prueba se actualiza en la cola y deja el evento correcto en el historial.

## 8. Referencias oficiales

- Google Sheets API: [guía de lectura y escritura de valores](https://developers.google.com/workspace/sheets/api/guides/values).
- Google Sheets API: [append values](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values.append).
- Google Cloud: [crear y administrar cuentas de servicio](https://cloud.google.com/iam/docs/service-accounts-create).
- Google Apps Script Web Apps: [documentación oficial](https://developers.google.com/apps-script/guides/web) (alternativa considerada, no opción principal).

## 9. Decisiones pendientes antes de implementar

- Confirmar el Spreadsheet y la cuenta Google organizativa propietaria.
- Confirmar si la cuenta de servicio existente puede acceder a Sheets y si conviene reutilizarla o separar credenciales.
- Aprobar las columnas exactas y la lista de estados que forman la cola activa.
- Confirmar si el histórico importado requiere todas las columnas originales o una vista normalizada más un campo de payload.
- Revisar las rutas/cron actuales y las restricciones de Supabase para integrar la outbox sin duplicar mecanismos.
- Validar el modelo de permisos y el nivel de sensibilidad de cada columna.

**Importante:** este documento es un plan de trabajo, no una declaración de que la integración esté implementada ni desplegada.
