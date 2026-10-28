# Plan de implementación: espejo automático de Kromi Connect en Google Sheets

**Estado:** Primera implementación preparada en rama `feat/google-sheets-design-mirror`; pendiente de build y validación en Preview antes de integrar en `main`.
**Destino:** `main` — `docs/integraciones/plan-google-sheets-espejo.md`
**Objetivo:** mantener una hoja de Google Sheets actualizada automáticamente desde Kromi Connect para consulta, filtros e informes. Kromi Connect/Supabase sigue siendo la única fuente de verdad.

## 1. Decisión de arquitectura

Implementar sincronización **unidireccional Supabase → Google Sheets**, ejecutada en el servidor. La hoja no debe escribir ni modificar el estado operativo de Kromi Connect.

- **Fuente de verdad:** tablas y RPC de Kromi Connect en Supabase.
- **Destino:** un Google Spreadsheet compartido con la cuenta de servicio autorizada.
- **Autenticación:** Google Sheets API desde código de servidor; nunca desde componentes cliente.
- **Entrega de la primera versión:** reconciliación periódica en servidor mediante un Route Handler protegido por `CRON_SECRET`; usa `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` ya existentes.
- **Consistencia:** sincronización eventual y unidireccional. El worker reconstruye las tres pestañas administradas desde Supabase; no se llama a Google desde triggers ni desde el navegador.
- **Idempotencia:** la sincronización reemplaza el contenido administrado de las pestañas en lugar de insertar filas por cada ejecución. Esto evita duplicados por repetición, pero implica que los usuarios no deben editar esas pestañas.
- **Límite conocido de la primera versión:** no incluye outbox, reintentos persistidos, panel de errores ni reconciliación incremental. Un fallo devuelve HTTP 500 y queda en los logs de Vercel; la siguiente ejecución vuelve a intentarlo.

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
- El cliente de Sheets reutiliza `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`, ya configuradas para Google Drive. No se añaden variables de credenciales duplicadas.

No usar prefijo `NEXT_PUBLIC_` para estas variables. No guardar la clave privada en el código, en archivos de configuración versionados, en el Spreadsheet ni en registros.

Configurar los mismos secretos en local y en el proveedor de despliegue (por ejemplo, Vercel → Project → Settings → Environment Variables), seleccionando los entornos necesarios. Reiniciar o redesplegar para que las funciones servidor reciban las variables nuevas.

### Fase 3 — Persistencia de sincronización

**No se añade outbox en la primera versión.** El worker reconstruye el espejo desde las tablas fuente en cada ejecución. Esta estrategia es más simple de repetir y no necesita mapear números de fila, pero escala peor a medida que crecen los historiales y no conserva un registro de reintentos por fila. La outbox con backoff y reprocesamiento queda como siguiente mejora si el volumen o la necesidad de observabilidad lo justifican.

### Fase 4 — Adaptador de Google Sheets

El módulo `src/lib/googleSheetsMirror.ts`:

1. Inicializa Google Sheets API con la cuenta de servicio ya configurada para Drive, usando el scope de Sheets.
2. No hace nada si `GOOGLE_SHEETS_SYNC_ENABLED` no es exactamente `true`.
3. Crea las tres pestañas si faltan y escribe encabezados definidos en código.
4. Lee la cola activa de las tres fuentes que usa Design: `publicaciones`, `pendientes_tienda` y `eventos`.
5. Refleja las tablas de historial operativo `publicacion_estatus_historial`, `pendiente_tienda_historial` y `evento_historial`, y el registro `design_solicitudes_historicas`.
6. Limpia y reconstruye los rangos administrados con `valueInputOption: RAW`; los valores con prefijos que podrían activar fórmulas se neutralizan.
7. No registra claves privadas ni payloads completos.

Las pestañas administradas se consideran de solo lectura para los usuarios. La operación de clear + update puede dejar una pestaña temporalmente vacía si falla entre llamadas; el siguiente cron la reconstruirá. Debe validarse el volumen máximo de filas frente a los límites de Supabase/Sheets.

### Fase 5 — Worker y programación

- `src/app/api/cron/sync-design-google-sheets/route.ts` valida `Authorization: Bearer $CRON_SECRET`.
- La respuesta indica si la sincronización está desactivada o informa los conteos sincronizados. Los errores devuelven HTTP 500 y se registran en logs de servidor.
- `vercel.json` programa el espejo a las 06:15 todos los días, separado de la purga de las 06:00.
- El proyecto Vercel conectado está en plan Hobby; por eso se usa una ejecución diaria compatible con esa limitación. Una frecuencia mayor requeriría un plan/servicio de cron compatible.
- No existe aún un endpoint administrativo de reprocesamiento ni una outbox persistente.

### Fase 6 — Carga inicial y reconciliación

1. Crear/validar las tres pestañas y encabezados.
2. Cargar la cola actual desde la fuente operativa.
3. Cargar el historial operativo existente, preservando la identidad de cada evento.
4. Cargar el histórico importado desde `design_solicitudes_historicas` sin alterar su payload original.
5. Ejecutar una reconciliación que compare conteos y claves fuente/destino y reporte diferencias.
6. Activar sincronización incremental solo después de aprobar la carga inicial.

La carga inicial se ejecuta al activar el cron: el worker crea las pestañas que falten y reconstruye su contenido desde Supabase. Puede repetirse sin duplicar filas. Si la hoja se borra o se daña, la siguiente ejecución vuelve a crear las pestañas administradas.

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
- Si Google Sheets no está disponible, Kromi Connect sigue permitiendo el flujo operativo; el worker devuelve HTTP 500 y la siguiente ejecución diaria vuelve a reconstruir el espejo.
- Una ejecución completa repetida no añade duplicados, ya que las pestañas administradas se reemplazan.
- La ejecución simultánea no tiene un bloqueo distribuido en esta versión; la programación diaria evita ejecuciones ordinarias frecuentes, pero este caso requiere prueba/mejora antes de aumentar la frecuencia.
- Una clave inválida, permisos insuficientes o ID de Spreadsheet incorrecto producen errores diagnósticos sin filtrar secretos.
- El endpoint rechaza llamadas no autorizadas.
- Se verifica el tratamiento de texto que comienza con `=`, `+`, `-` o `@` para prevenir interpretación como fórmula.

### Operación
- Documentar procedimiento de alta, rotación de credenciales, pausa de sincronización, resincronización y revisión de errores.
- Registrar fecha de última sincronización correcta y número de trabajos pendientes/fallidos en una forma visible solo para administradores.

## 6. Orden de trabajo recomendado

1. **Auditoría de esquema y credenciales** (sin cambios de producción).
2. **Crear Spreadsheet y permisos** manualmente.
3. **Módulo servidor + worker protegido + programación diaria** (incluido en la rama de implementación).
4. **Validar build y desplegar Preview**; no se ha podido confirmar build desde el entorno de trabajo actual.
5. **Crear/compartir Spreadsheet y configurar variables de entorno**.
6. **Probar una ejecución manual del worker con la sincronización habilitada**.
7. **Activar gradualmente** `GOOGLE_SHEETS_SYNC_ENABLED=true` solo después de confirmar permisos y contenido.

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

**Estado de validación:** código preparado en rama `feat/google-sheets-design-mirror`; todavía no se ha confirmado un build exitoso ni un despliegue funcional. Mantener `GOOGLE_SHEETS_SYNC_ENABLED=false` hasta validar Google Cloud, el Spreadsheet y la ejecución del worker.
