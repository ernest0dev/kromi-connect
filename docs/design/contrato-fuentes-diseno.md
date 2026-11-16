# Contrato neutral de fuentes de solicitudes de Diseño

Estado: F5.1.1. Este documento describe el contrato de dominio; no integra adaptadores ni cambia los flujos existentes.

## Ubicación y límites

El contrato vive en `src/lib/design-contract/index.ts`, bajo `lib` y fuera de `app` y de cualquier módulo de origen. Design y los módulos de origen pueden depender de esta capa neutral sin que el contrato importe rutas, acciones, módulos de negocio, Supabase, Google Drive o clientes administrativos. La regla de dependencias sigue siendo `app -> modules -> lib`.

El `index.ts` solo expone tipos de dominio y la constante client-safe `DESIGN_SOURCES`. No existe `server.ts`: F5.1.1 no contiene implementaciones server-only. Tampoco hay `actions.ts`, porque el contrato no declara Server Actions. Los adaptadores posteriores serán responsables de sus dependencias server-only y su autorización.

`src/lib/designRequests.ts` reutiliza `DesignSource` y `DesignRequestStatus` del contrato para evitar dos catálogos. Conserva sus adaptadores y su DTO existente sin migrarlos; el contrato nuevo no es una capa de conversión ni traslada lógica de negocio.

## Modelos y extensibilidad

`DesignRequestModel<S>` es un modelo de dominio, con campos comunes normalizados y `sourceData` tipado por discriminante. La unión cubre SOCIAL_MEDIA, EVENTS, INTERNAL y GENERAL, con los datos específicos útiles para Design. EVENTS separa `eventStatus` del estado normalizado de Design porque el ciclo de vida del evento puede bloquear operaciones. SOCIAL_MEDIA conserva formato, canales y, si están disponibles, campaña y temas; el copy pertenece al detalle. INTERNAL conserva tipo de tarea, tienda, cantidad y fecha requerida. `sourceStatus` mantiene un estado original cuando el adaptador lo necesita; no representa necesariamente todos los estados de la entidad de origen. El DTO no replica todas las columnas.

Las capacidades pueden calcularse con el DTO de lectura, pero no son una autorización duradera. Antes de cualquier mutación, el adaptador debe volver a cargar el estado actual relevante y comprobarlo en servidor/RPC junto con el permiso. Esto es especialmente necesario para EVENTS, donde el estado vigente del evento puede cambiar entre lectura y operación. No se debe confiar en el DTO enviado por un cliente como prueba de estado actual.

Los filtros comunes son opcionales y `sourceSpecific` es un parámetro genérico para filtros particulares sin introducir filas o diccionarios crudos. Los adaptadores pueden definir ese tipo al implementarse. Los inputs de iniciar, entregar, reabrir, reservar y finalizar también son parámetros genéricos; una fuente puede exigir datos propios, como motivo o versión esperada, sin imponérselos a las demás.

## Operaciones y disponibilidad

`DesignRequestSource<S>` exige `source`, `list`, `getDetail` y `capabilities`. `list` y `getDetail` reciben `DesignActor` explícitamente para hacer visible y comprobable el contexto de lectura. El actor debe construirse en servidor desde la sesión autenticada; nunca se debe confiar en un actor ni en grants serializados por el cliente. `DesignActor` es contexto de ejecución, no prueba de autorización. Cada adaptador debe autorizar lecturas y volver a autorizar cada operación sensible en servidor.

Las capacidades describen el comportamiento permitido para la solicitud y el actor actuales. `fileAccess` distingue, por cada tipo, lectura de archivos completados y consulta de metadatos de cargas pendientes. `uploads` separa además reservar, finalizar, reanudar y cancelar. Así, permitir entregar no implica permitir leer entregables; GENERAL puede representar `deliver: true` con `DELIVERABLE.readCompletedFiles: false`. La carga tampoco implica necesariamente permiso para entregar.

`start`, `deliver`, `reopen`, `deliverEligibility` y `uploads` son opcionales en la interfaz. Una fuente que no admite reapertura omite `reopen` y devuelve `capabilities.reopen: false`; GENERAL es ese caso. Cuando una capacidad no aplica, no se crea una operación simulada para aparentar uniformidad.

`DesignRequestSourceRegistry<TOptions>` es mapeado por `DesignSource`: cada clave conserva su fuente, modelo, filtros e inputs de operaciones. El despacho debe estrechar el discriminante antes de invocar la operación; no se debe convertir el registro a una interfaz amplia ni usar casts para ocultar incompatibilidades. La prueba de compilación cubre implementaciones especializadas de los cuatro orígenes y la ausencia de reapertura de GENERAL.

La elegibilidad se modela aparte de la entrega y puede devolver un motivo normalizado. La comprobación sigue siendo responsabilidad de cada origen: no se reemplaza por una regla genérica que ignore el ciclo o estado particular.

## Resultados y errores

`Result<T>` usa `{ ok: true, value }` o `{ ok: false, error }`. Los errores ofrecen códigos de dominio estables y `sourceCode` opcional para preservar un código RPC/origen sin obligar a Design a conocerlo. La interfaz no incorpora respuestas crudas de Supabase.

`DesignActor` contiene identidad y, opcionalmente, código de rol como contexto. No incluye grants confiables ni sustituye `authorizeAction`; el adaptador resuelve y verifica permisos con las reglas existentes.

## Uploads

La capacidad `uploads` puede faltar por completo. Cuando existe, declara los tipos soportados y las operaciones de reservar/finalizar; reanudar, cancelar, listar archivos completados y listar metadatos de cargas pendientes son operaciones opcionales porque los orígenes no tienen el mismo ciclo. `listPendingUploads` devuelve metadatos de reserva/sesión sin exponer la URI de transferencia. Los tipos comunes son BRIEF, DELIVERABLE y REFERENCE, pero cada fuente declara solo los que usa.

La reserva recibe nombre, tamaño y MIME opcional como pista; el origen valida el archivo y deriva MIME según sus reglas. Devuelve una reserva tipada con URL/URI de sesión temporal y metadatos necesarios para la transferencia. En los flujos actuales Drive usa una URI de sesión resumible; el contrato la transporta como URL opaca y no pretende unificar su persistencia. Debe tratarse como capacidad bearer de corta vida: nunca registrarla en logs ni exponer credenciales de servicio. El resultado de finalización son metadatos de dominio, no una fila de tabla.

Al integrar adaptadores hay que comprobar por separado reserva, reanudación, expiración, cancelación, finalización condicional y validación de actor/propiedad de la carga. La finalización debe comprobar el estado actual de la carga y de la solicitud, y los metadatos confirmados por Drive; un resultado anterior de `capabilities` no autoriza finalizar.

## Diferencias que los adaptadores deben conservar

- SOCIAL_MEDIA: tiene flujo propio de publicación, reapertura mediante transición y elegibilidad relacionada con la subida del ciclo de trabajo.
- EVENTS: inicia, entrega y reabre mediante sus RPC; `eventStatus` y el estado de Diseño son distintos, y las operaciones deben volver a leer ambos estados vigentes según sus reglas.
- INTERNAL: opera sobre tareas internas y RPC propias; conserva tipo, tienda, cantidad y fecha requerida cuando sean necesarios; la entrega verifica un archivo posterior al inicio del trabajo.
- GENERAL: usa permisos específicos C1, soporta referencias y entregables, y no admite reapertura; la entrega requiere un entregable completo posterior a `started_at`.

Estos puntos son restricciones para adaptadores futuros, no comportamiento ejecutado por este contrato.

## Integración posterior y fuera de F5.1.1

En una fase posterior, los adaptadores server-side pueden implementar `DesignRequestSource` desde módulos o infraestructura neutral. Design resolverá la fuente y coordinará resultados/capacidades. El registro `sources.ts`, los adaptadores, cambios de Server Actions, cola, historial, páginas, rutas, permisos y base de datos quedan fuera de F5.1.1.

Las pruebas `src/lib/design-contract/index.test.ts` validan datos/filtros por origen, lectura de archivos y consulta separada de metadatos pendientes por categoría, entrega sin lectura, el registro heterogéneo, despacho por discriminante, ausencia de reapertura en GENERAL, resultados/errores y ausencia de imports/dependencias server-only en el contrato público. No simulan autorización: esas pruebas pertenecen a la integración de cada adaptador. El lint protege el límite que impide dependencias desde `lib` hacia `app` o `modules`.
