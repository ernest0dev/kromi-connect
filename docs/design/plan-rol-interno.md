# Perfil Interno: pendientes por tienda

**Estado (2026-10-18):** implementación inicial en curso. Las migraciones y el flujo funcional de Pendientes están en el workspace y el equipo reportó haber aplicado las migraciones manualmente. Se está ajustando la UI para seguir las maquetas. La entrevista con el rol se omitió por decisión del equipo.
**Alcance inicial:** rol `internal` ("Interno"), una sola persona usuaria. Vista **Pendientes** con Mapa y Listado, más Archivo. El mapa funcional incluye marcadores, urgencias y panel por tienda sobre un fondo gris liso; la imagen o representación geográfica del fondo se incorpora en una fase posterior. Cada pendiente puede llevar un brief en Drive y, opcionalmente, una **solicitud a Design** (impresión o pieza digital).
**Cómo implementarlo:** [`implementacion-rol-interno.md`](./implementacion-rol-interno.md) trae las tandas, los archivos a tocar, los criterios de aceptación y un prompt por tanda.

**Actualización de implementación (2026-10-18):** las opciones nuevas de Tipo son `IMPRESION`, `SONIDO_INTERNO`, `REPARACION` y `OTRO`; las filas históricas `INSUMO` y `NECESIDAD` se conservan como categorías anteriores. El campo de enlace deja de usarse para nuevas solicitudes: los briefs y materiales se cargan en la carpeta de Drive después de crear o guardar el pendiente. Con diseño, el usuario indica la fecha requerida en tienda; el sistema deriva la entrega a Design (dos días calendario antes) y el límite para subir el brief (cinco días calendario antes), siguiendo el SLA de Social Media. La estimación de Design es dos días calendario desde que recibe la solicitud. La solicitud con diseño sigue limitada a una tienda. Listado y Archivo usan selector de filas por página. Desde un pendiente entregado o cancelado se puede crear otro prellenado, con estado nuevo y carpeta de Drive nueva.
**Diseño de UI:** nueve maquetas en [`prototypes/internal-map/`](./prototypes/internal-map) (§9). Si difieren de este documento, gana el documento.
**Documentos relacionados:** [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`plan-rol-design.md`](./plan-rol-design.md), [`modales-publicacion.md`](./modales-publicacion.md), [`plan-validacion-brief-drive.md`](./plan-validacion-brief-drive.md), [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) y [`plan-inventario-eventos.md`](./plan-inventario-eventos.md) (mismo patrón de acceso, RPC y catálogo de tiendas).

## 1. Resultado esperado

1. En la primera entrega, la persona con rol Interno entra a **Pendientes** y ve el Mapa funcional de sus pendientes por tienda. El fondo es gris liso provisional; la imagen geográfica queda para una fase posterior.
2. Al elegir una tienda ve sus pendientes de **impresiones, sonido interno, reparaciones y otros** y los hace avanzar hasta dejarlos entregados.
3. Crea sus propios pendientes y se los asigna a sí misma. Por ahora **no recibe solicitudes de otros roles**, solo las crea.
4. En crear, editar y detalle puede guardar un **brief en Drive** (hasta 10 archivos de 100 MB), requiera o no diseño. Si marca **Requiere diseño**, puede pedir a Design una impresión o pieza digital con instrucciones y fecha de entrega. Solicitar diseño exige que el pendiente esté en `PENDIENTE` y lo pasa a `EN_PROCESO`.
5. Cada cambio de estado guarda quién lo hizo y cuándo; los retrocesos y cancelaciones piden motivo.
6. **Listado** y **Archivo** son las vistas iniciales de Pendientes, con botones de navegación en el encabezado junto a los filtros Tipo y Estado. El mapa se añade después sin cambiar el modelo de datos.
7. Vive como un perfil más (`internal`), con su propio menú de **un solo ítem** y permisos; no abre `/support` ni `/third-parties`.

## 2. Punto de partida

### 2.1 Pedido y decisiones del equipo

| Tema | Detalle | Fecha |
|---|---|---|
| Responsabilidad | Se encarga sobre todo de **solicitar impresiones** y de tener **asignados pendientes** de impresiones, insumos y necesidades de cada tienda. | 2026-10-15 |
| Interfaz | No es un calendario: es un mapa con las sucursales; cada una muestra los pendientes del usuario. | 2026-10-15 |
| Quién crea | El rol los crea y se los asigna a sí mismo (una sola persona). Por ahora no recibe solicitudes, solo las crea. | 2026-10-15 |
| Entrevista | Omitida por ahora. | 2026-10-15 |
| Tiendas y direcciones | Las siete tiendas, con dirección y enlace de Google Maps, entregadas por el equipo (§5.2). | 2026-10-15 |
| **Mapa estático** | **Vista funcional, minimalista y sin integraciones.** Muestra tiendas de Valencia ubicadas según coordenadas provisionales sobre un fondo gris liso; San Felipe va como icono al pie. Tocar un marcador abre el panel. La imagen geográfica del fondo se puede añadir después. | 2026-10-15 y 2026-10-17 |
| **Solicitud en el pendiente** | **Las solicitudes a Design van en crear, editar y detalle del pendiente**, como en las publicaciones de Social Media. | 2026-10-17 |
| **Piezas digitales** | El Interno no solo pide impresiones: también **piezas digitales**. Se mantiene simple: el campo **Instrucciones** de texto libre cubre ambos casos. | 2026-10-17 |
| **Campos de la solicitud** | Casilla **Requiere diseño**; campo **Instrucciones** cuando está marcada; **fecha de entrega de la pieza de diseño**; **brief a Drive** con 10 archivos y 100 MB por archivo como máximo. | 2026-10-17 |
| **Correcciones** | Sin ciclo de corrección por ahora; se define con el equipo en las pruebas. | 2026-10-17 |
| **Navegación** | El menú lateral tiene **un solo ítem, "Pendientes"** (antes "Mapa de tiendas"). Listado y Archivo son sub vistas con botones en el encabezado, junto a los selects Tipo y Estado. | 2026-10-17 |

### 2.2 Qué hay hoy en el repositorio (verificado en `main`, commit `786727f`)

- `internal` está en `APP_ROLES` y `ROLE_LABELS` (`src/lib/auth/permissions.ts`) y en `app_roles` (`202610050001_auth_roles_permissions.sql`). El tipo `AppPermission` ya admite el prefijo `internal.*`, pero **no existe ningún permiso `internal.*`**.
- El SRS §7.2 y §7.3 dicen que `internal` no recibe concesiones de negocio.
- No hay rutas `/internal`. `loginAction`, `login/page.tsx` y `access-pending/page.tsx` solo redirigen a `social-media`, `customer-support`, `design` y `events`.
- **No hay coordenadas de tiendas en ninguna tabla.** El único catálogo con las siete sedes es `inventario_sedes` (`codigo`, `nombre`, `orden`, `activa`), legible por RLS solo con `events.inventory.read`.
- **La solicitud a Design está acoplada a `publicaciones`** (lo verificado en `plan-rol-design.md` §3 y en las migraciones `110001`, `110002`, `120001`):
  - La cola `get_design_publication_queue()` solo devuelve publicaciones; Design no puede leer `publicaciones` fuera de ella.
  - Las carpetas `Brief` y `Entregables`, las reservas de carga (`publicacion_drive_uploads`, con FK a `publicaciones`), el historial de estados y la RPC `request_publication_to_design` cuelgan de la publicación y comprueban el rol `social-media`.
  - **Reutilizables sin cambios:** los helpers genéricos de `src/lib/googleDrive.ts` (`createPublicacionDriveFolder(nombre)`, `ensurePublicacionDriveFolders(rootId)`, `createDriveResumableSession({folderId, …})`, `findDriveUploadedFile`, `countDriveFolderFiles`, `listDriveFolderFiles`, `revokeDriveResumableSession`) y las reglas de `src/lib/driveFileRules.ts` (`BRIEF`: 10 archivos, 100 MB, JPG/JPEG/PNG/WebP/PDF/MP4; `ENTREGABLES`: 20 archivos, 500 MB).
  - **No reutilizables tal cual** y por eso se duplican para el Interno: `src/app/actions/publicaciones/drive.ts`, `design-drive.ts`, `workflow.ts`, `PublicationDriveFiles.tsx` y el detalle de Design, que llaman a RPC de publicaciones.
- No hay biblioteca de mapas en `package.json`, y con el mapa estático **no se añade ninguna**.
- Patrón a seguir: Inventario y Programación de Eventos: lectura por RLS con permiso, escritura solo por RPC `SECURITY DEFINER` con `search_path` vacío, control de versión (`CONFLICTO_VERSION`) y historial inmutable. Para Drive, el de publicaciones: la carga va directa del navegador a Drive con una sesión resumible autorizada en servidor, y la comprobación de Drive la hace una acción de servidor que luego llama a una RPC solo para `service_role`.
- `AGENTS.md` advierte que esta versión de Next.js tiene cambios incompatibles: antes de escribir código hay que leer la guía correspondiente en `node_modules/next/dist/docs/`.

## 3. Qué es un pendiente

Unidad de trabajo: **un pendiente pertenece a una tienda**.

| Campo | Tipo | Regla |
|---|---|---|
| Tienda | una de `inventario_sedes` | Obligatoria. Sin diseño se pueden elegir varias y se crea un pendiente por tienda. **Con "Requiere diseño" se elige una sola** (D14). |
| Tipo | `IMPRESION`, `SONIDO_INTERNO`, `REPARACION`, `OTRO` | Obligatorio. `INSUMO` y `NECESIDAD` se conservan solo para filas históricas. |
| Título | texto, hasta 160 | Obligatorio. |
| Detalle | texto largo libre, hasta 2000 | Opcional. Notas internas, proveedor, etc. No se comparte con Design. |
| Cantidad | entero ≥ 1 | Opcional. |
| Brief y materiales | Archivos en Drive | Disponibles para cualquier pendiente; se cargan después de guardar. `enlace_referencia` queda solo para lectura de datos históricos. |
| Fecha requerida en tienda | fecha (America/Caracas) | Opcional. Cuándo debe estar en la tienda. |
| Creado por | usuario con rol `internal` | Siempre quien crea. No se reasigna. |

### 3.1 Solicitud a Design (parte del pendiente)

La solicitud **no es una entidad aparte**: son columnas del propio pendiente, como en `publicaciones` (D3, resuelta).

| Campo | Regla |
|---|---|
| **Requiere diseño** | Casilla. Por defecto marcada solo si el tipo es `IMPRESION`; en los demás tipos queda sin marcar. Cualquier tipo puede marcarla: una **pieza digital** se registra con la casilla y las instrucciones (D16). Editable mientras no se haya solicitado. |
| **Instrucciones para Design** | Texto libre, hasta 4000 caracteres. Visible cuando la casilla está marcada. **Obligatorias para solicitar**. Formato, medidas, cantidades, papel o canal digital: lo que haga falta. Editables solo mientras no se haya solicitado. |
| **Fecha de entrega de la pieza** | Se calcula como la fecha requerida en tienda menos dos días calendario. **Obligatoria para solicitar** y no puede ser anterior a hoy. Editable solo antes de solicitar. |
| **Brief** | Archivos en la subcarpeta `Brief` de Drive del pendiente, requiera o no diseño. Hasta **10 archivos de 100 MB**: JPG, JPEG, PNG, WebP, PDF y MP4 (las mismas reglas de Social Media). Se sube **después de guardar** desde Detalle. El límite del brief se calcula cinco días calendario antes de la fecha requerida en tienda. **Solicitar a Design exige al menos un archivo**, comprobado en Drive hace menos de 5 minutos. |
| **Solicitar a Design** | Acción de servidor que comprueba lo anterior y exige que el pendiente esté en `PENDIENTE`. Lo deja en `SOLICITADO` y pasa el pendiente a `EN_PROCESO` en la misma operación. No se puede solicitar desde `EN_PROCESO`, `LISTO`, `ENTREGADO` ni `CANCELADO`. |
| **Retirar solicitud** | Mientras esté `SOLICITADO` (Design no la abrió): vuelve a "por solicitar" y el pendiente siempre vuelve a `PENDIENTE`, porque ese era el único estado permitido al solicitar. Permite editar instrucciones y fecha. Si ya está `EN_DISENO`, no se puede retirar. |

Estados de la solicitud (`diseno_estatus`), sin ciclo de corrección:

| Valor | Etiqueta | Quién | Cómo se llega |
|---|---|---|---|
| (nulo) | Por solicitar / No aplica | — | Casilla marcada pero sin solicitar, o desmarcada. |
| `SOLICITADO` | Solicitado | Interno | Solicitar a Design. |
| `EN_DISENO` | En diseño | Design | Design abre la solicitud; queda registrado quién la tomó (primer diseñador que la abre). |
| `ENTREGADO` | Entregado | Design | Design carga al menos un archivo en `Entregables` y entrega. |

Al entregar Design, el Interno ve los entregables en su detalle y decide cuándo marcar el pendiente como `LISTO`: **el estado del pendiente no cambia solo** (D15). Si la pieza necesita cambios, el equipo definirá cómo en las pruebas; mientras tanto se resuelve fuera de la app o con un pendiente nuevo.

Fuera del pendiente por ahora: costos, proveedor como campo propio, prioridad manual, subtareas y adjuntos que no sean el brief.

## 4. Estados y reglas

### 4.1 Estados del pendiente

| Código | Etiqueta | Significado |
|---|---|---|
| `PENDIENTE` | Pendiente | Registrado, sin empezar. Estado inicial. |
| `EN_PROCESO` | En proceso | Se está gestionando (con Design, en compra, en impresión). |
| `LISTO` | Listo para entregar | Ya está disponible; falta llevarlo a la tienda. Permite preparar la visita a cada tienda. |
| `ENTREGADO` | Entregado | Llegó a la tienda. Estado final. |
| `CANCELADO` | Cancelado | Ya no se necesita. Motivo obligatorio. |

### 4.2 Transiciones

- Avanzar (`PENDIENTE → EN_PROCESO → LISTO → ENTREGADO`) lo hace la persona usuaria; se permite saltar pasos.
- Retroceder o reabrir un `ENTREGADO` exige motivo y queda en el historial.
- Cancelar desde cualquier estado abierto exige motivo. Si Design ya trabaja la pieza, la interfaz lo avisa y la solicitud sale de su cola. `CANCELADO` solo vuelve a `PENDIENTE` con motivo.
- Archivar: solo `ENTREGADO` o `CANCELADO`. Se ocultan del mapa y se ven en Archivo; no se borran ni se borra su carpeta de Drive.

### 4.3 Indicadores derivados (no se guardan)

Se calculan con la fecha de hoy en America/Caracas, solo para pendientes abiertos (`PENDIENTE`, `EN_PROCESO`, `LISTO`):

| Indicador | Condición |
|---|---|
| Vencido | `fecha_requerida` anterior a hoy. |
| Próximo | `fecha_requerida` hoy o dentro de 2 días (D10). |
| Sin fecha | No tiene `fecha_requerida`. |

El color del marcador de cada tienda sigue el peor indicador de sus pendientes abiertos: rojo (vencido), naranja (próximo), azul (sin urgencia) o gris (sin pendientes). Las tiendas con vencidos llevan además un "!" para no depender solo del color.

### 4.4 Reglas

1. **Conflicto de edición:** cada cambio comprueba `version`; si cambió, la interfaz ofrece cargar la versión actual.
2. **Solicitud a Design:** solo se solicita desde `PENDIENTE`; la operación cambia atómicamente el pendiente a `EN_PROCESO`. Retirar una solicitud aún `SOLICITADO` devuelve el pendiente a `PENDIENTE`. Para volver a solicitar tras avanzar el trabajo, la persona debe devolverlo primero a `PENDIENTE` mediante la transición normal, con motivo cuando aplique.
3. **Acceso por persona:** cada usuario `internal` ve y modifica solo lo que creó. Hoy es una sola persona; la regla evita exponer datos si el rol crece.
4. **Un pendiente entregado** solo permite corregir el detalle; no se reprograma.
5. **Zona horaria:** fechas y "hoy" en America/Caracas, igual que en Eventos (`src/lib/events.ts`, `src/lib/inventory.ts`).
6. **Design no lee `pendientes_tienda`.** Solo ve, por RPC, los campos que necesita (§6.4).

## 5. Mapa de tiendas

El mapa funcional forma parte de la primera entrega. Muestra marcadores, urgencias, resumen y panel de tienda. El fondo inicia como un color gris liso; incorporar una imagen geográfica o una representación visual del territorio queda para una fase posterior. El Listado ofrece la misma información en formato tabular.

Es la diferencia central con los demás perfiles: la dimensión principal es **dónde**, no cuándo.

### 5.1 Comportamiento

- **Fondo inicial:** gris liso, sin imagen geográfica, zoom, teselas, biblioteca cartográfica ni dibujo de calles o límites. Los marcadores y el panel por tienda sí se implementan en esta entrega. La imagen estática se añadirá cuando el equipo la provea.
- **Marcadores:** uno por tienda dentro del encuadre. Muestran el número de pendientes abiertos y el color de urgencia (§4.3). Una tienda sin pendientes se ve atenuada pero visible. Tocar un marcador abre el **panel de la tienda**.
- **Pie del mapa:** las tiendas cuyas coordenadas caen **fuera del encuadre** (hoy, San Felipe) se muestran como un icono con su insignia, en una franja al pie. La regla es geométrica, no un campo de la base de datos. Las tiendas sin coordenadas van a un bloque "Sin ubicación".
- **Resumen superior:** abiertos, vencidos, listos para entregar y tiendas con pendientes.
- **Panel de tienda** (lateral en escritorio, hoja inferior en móvil): nombre, zona y dirección; pendientes agrupados por tipo con estado, indicador y estado de diseño; acciones rápidas de estado y "Nuevo pendiente en esta tienda".
- **Filtros** Tipo y Estado en el encabezado, en la URL como en Inventario y Eventos.
- **Accesibilidad:** cada marcador es un botón con nombre de tienda, cantidad y urgencia; el Listado ofrece lo mismo sin mapa.
- **Interactividad mínima:** tocar un marcador cambia el panel. No hay arrastre ni zoom. Eso es lo que muestran las maquetas y es suficiente para la versión básica.

### 5.2 Tiendas y coordenadas

Direcciones entregadas por el equipo. Las coordenadas se leyeron de la **ubicación marcada en cada enlace de Google Maps** compartido (solo se leyó la dirección a la que redirige cada enlace). Marcan el lugar que muestra Google, no necesariamente la puerta de la tienda.

| Tienda | Zona | Dirección entregada | Latitud | Longitud |
|---|---|---|---|---|
| Prebo | Valencia Norte | Urb. Prebo Av. 137 c/c 114, C.C. V Avenida | 10.2133212 | -68.0279878 |
| Mañongo | Naguanagua | Urb. Ciudad Jardín Mañongo, Parcela 1 y 2 | 10.2415025 | -67.9974483 |
| Trigal Sur | Valencia Norte | C.C. Trigal Sur, Planta Baja | 10.2124862 | -67.9999188 |
| Trigal Norte | Valencia Norte | C.C. Las Clavellinas, antiguo Panda | 10.2251378 | -68.0012985 |
| Guataparo | Valencia Norte | C.C. Guataparo Express, Valencia 2001 | 10.1882288 | -68.0435123 |
| Castillito | San Diego | Urb. Parque Comercio Industrial Castillito, C.C. Tigsa, galpón G-2 | 10.1955375 | -67.9692031 |
| San Felipe | Icono al pie | Av. Intercomunal El Fuerte, Yaracuy | 10.3427758 | -68.7259993 |

**A verificar con el equipo antes de dar el dato por bueno:** los nombres que muestra Google no siempre coinciden con las direcciones entregadas (Castillito aparece como "San Diego", Trigal Norte como "Kromi Market Express - Trigal Norte"). La **zona** es solo una etiqueta del panel; la posición sale de las coordenadas.

### 5.3 Contrato de la imagen y del posicionamiento

El mapa se compone de una imagen y cuatro límites geográficos. Los dos tienen que corresponderse.

| Elemento | Valor |
|---|---|
| Archivo | `public/maps/valencia-tiendas.webp` (o `.png`), aportado por el equipo. |
| Proporción | **1,3 : 1** (ancho : alto), que equivale a unos 10 × 7,7 km. Si la imagen tiene otra proporción, se ajusta `MAP_ASPECT`. |
| Límites **provisionales** | Latitud 10.180 a 10.250; longitud -68.052 a -67.961. Cubren las seis tiendas de Valencia con margen. Son constantes en `src/app/(dashboard)/internal/pendientes/StoreMapView.tsx` (`BOUNDS`). |
| Posición lineal | `x = (lng − lngMin) / (lngMax − lngMin)` e `y = (latMax − lat) / (latMax − latMin)`, en porcentaje. A esta escala la diferencia con una proyección Mercator es despreciable. |
| Pie | Tiendas con coordenadas fuera de `MAP_BOUNDS` se dibujan en el pie. |
| Contenido | Minimalista: sin marcadores propios del proveedor, sin textos de otros comercios y con las etiquetas "Naguanagua", "Valencia Norte" y "San Diego" **dentro de la imagen**, no como código. |

**Calibración.** Los límites provisionales sirven para las maquetas, no para una imagen real. Al incorporar la imagen: (1) obtener sus cuatro límites geográficos reales (esquina noroeste y sureste), o exportarla con los límites de la tabla; (2) poner esos valores en `MAP_BOUNDS`; (3) comprobar a ojo que Prebo, Mañongo y Castillito (extremos) caen sobre su lugar real; (4) si no, corregir los límites, no mover marcadores. **Verificar los términos de uso y la atribución de la fuente de la imagen** (Google Maps y OpenStreetMap exigen atribución y tienen condiciones sobre capturas); eso lo decide el equipo, no el código.

Si la imagen no carga, los marcadores se dibujan igualmente sobre un lienzo liso y el Listado sigue disponible (Estados, maqueta 9).

## 6. Modelo de datos

Migraciones del módulo, preparadas para aplicación manual: `supabase/migrations/202610180001_internal_store_tasks.sql` y `202610180002_internal_design_requests.sql` (§11). Antes de aplicarlas en Supabase, contrastarlas con el esquema desplegado y resolver cualquier diferencia.

### 6.1 Catálogo de tiendas (mapa)

En la primera entrega no se modifica `inventario_sedes` ni se guardan coordenadas en la base. El formulario y el mapa obtienen el catálogo de tiendas mediante `list_internal_stores()` (`SECURITY DEFINER`, exige `internal.store-tasks.read`) y devuelve `id`, `codigo` y `nombre` de las tiendas activas. La UI del mapa usa temporalmente coordenadas y direcciones estáticas de este documento; una fase posterior puede trasladarlas al catálogo tras verificar los datos, sin abrir la política de `inventario_sedes` a `internal`.

La lectura para el rol `internal` se hace con la RPC `list_internal_stores()` (`SECURITY DEFINER`, exige `internal.store-tasks.read`) que devuelve solo `id`, `codigo`, `nombre`, `direccion`, `latitud`, `longitud` de las tiendas activas, sin abrir la política de `inventario_sedes` a `internal`.

### 6.2 Tablas

**`pendientes_tienda`**

| Grupo | Columnas |
|---|---|
| Identidad | `id uuid pk`, `sede_id uuid not null → inventario_sedes`, `tipo text` (`IMPRESION`, `SONIDO_INTERNO`, `REPARACION`, `OTRO`; admite categorías históricas), `titulo text`, `detalle text`, `cantidad integer`, `enlace_referencia text` legado, `fecha_requerida date` |
| Estado | `estatus text` (`PENDIENTE`, `EN_PROCESO`, `LISTO`, `ENTREGADO`, `CANCELADO`; por defecto `PENDIENTE`), `entregado_en timestamptz`, `archivado_en timestamptz`, `version integer not null default 1`, `creado_por uuid not null → auth.users`, `creado_en`, `modificado_en`, `modificado_por` |
| Diseño | `requiere_diseno boolean not null default false`, `instrucciones_diseno text` (≤ 4000), `fecha_entrega_diseno date`, `diseno_estatus text` (`SOLICITADO`, `EN_DISENO`, `ENTREGADO`), `diseno_solicitado_en`, `diseno_iniciado_en`, `diseno_entregado_en timestamptz`, `disenador_id uuid → auth.users on delete set null` |
| Drive | `drive_folder_id`, `drive_folder_url`, `drive_brief_folder_id`, `drive_deliverables_folder_id text`, `drive_brief_file_count integer not null default 0 check (0..10)`, `drive_brief_checked_at timestamptz` |

Restricciones: catálogos como texto con `CHECK` (no `ENUM`); `diseno_estatus` no nulo implica `requiere_diseno`, instrucciones no vacías y `fecha_entrega_diseno` no nula. Índices: `(creado_por, estatus)`, `(sede_id, estatus)`, `(estatus, fecha_requerida)` y `(diseno_estatus, fecha_entrega_diseno)` parcial para la cola de Design. Un trigger impide que `authenticated` cambie directamente las columnas `drive_*` y `diseno_*` (solo `service_role` o las RPC con una marca de transacción), igual que `guard_publication_drive_brief_sync`.

**`pendiente_tienda_historial`**: `pendiente_id`, `tipo` (`ESTATUS` o `DISENO`), `anterior` y `nuevo` (`jsonb`), `motivo`, `cambiado_por` (nulo = Sistema), `cambiado_en`. Inmutable por trigger, como `evento_historial`.

**`pendiente_drive_uploads`**: la misma forma que `publicacion_drive_uploads` (`id`, `pendiente_id` con `on delete cascade`, `actor_id`, `carpeta` `BRIEF`/`ENTREGABLES`, `file_name`, `mime_type`, `file_size` ≤ 524288000, `session_uri` con el mismo `CHECK` de URL de Drive, `status` `RESERVING`/`UPLOADING`/`COMPLETE`/`CANCEL_PENDING`/`CANCELLED`/`EXPIRED`, `drive_file_id`, `expires_at` por defecto 7 días, `created_at`, `completed_at`). RLS activada, sin grants a `anon` ni `authenticated`, todo para `service_role`.

### 6.3 Seguridad

- RLS de lectura de `pendientes_tienda` con `has_permission('internal.store-tasks.read')` **y** `creado_por = auth.uid()`.
- Sin grants de escritura directa a `anon` ni `authenticated`; toda escritura por RPC `SECURITY DEFINER` con `search_path` vacío, que vuelve a validar permiso, propiedad y versión.
- Las RPC que dependen de comprobar Drive (`request_pendiente_to_design`, `sync_pendiente_drive_brief`, `reserve_pendiente_*_upload`) son **solo para `service_role`** y las llama una acción de servidor, como en publicaciones.
- La interfaz oculta navegación sin permiso, pero servidor y RPC deciden el acceso.

### 6.4 Lo que ve Design

Design **no** recibe el pendiente completo. Las RPC de Design devuelven solo: `id`, título, tipo, nombre de la tienda, cantidad, instrucciones, `fecha_entrega_diseno`, `diseno_estatus`, diseñador (id y nombre), fechas de solicitud/inicio/entrega, y los identificadores de Drive. **No** devuelven `detalle`, `enlace_referencia`, `fecha_requerida` ni el estado del pendiente más allá de si está cancelado o archivado (esos salen de la cola).

## 7. Permisos

| Código | Rol | Uso |
|---|---|---|
| `internal.store-tasks.read` | `internal` | Ver mapa, listado, detalle e historial propios. |
| `internal.store-tasks.create` | `internal` | Crear pendientes. |
| `internal.store-tasks.update` | `internal` | Editar datos y **subir archivos al brief**. |
| `internal.store-tasks.status.update` | `internal` | Cambiar estado, cancelar, reabrir, **solicitar y retirar la solicitud a Design**. |
| `internal.store-tasks.archive` | `internal` | Archivar y restaurar. |
| `design.internal.read` | `design` | Ver la cola, el historial y la ficha de las solicitudes del Interno. |
| `design.internal.start` | `design` | Abrir una solicitud (`SOLICITADO → EN_DISENO`). |
| `design.internal.upload` | `design` | Cargar archivos a `Entregables`. |
| `design.internal.deliver` | `design` | Entregar (`EN_DISENO → ENTREGADO`). |

Ningún otro rol los recibe; `admin` no los adquiere por su nombre de rol (SRS §7.2). El criterio de subir al brief con `update` y solicitar con `status.update` replica el de Social Media (`posts.edit` y `posts.status.update`). Se usan permisos propios para Design en lugar de `design.posts.*` para poder revocar cada flujo por separado. El SRS §7.2 y §7.3 se actualizan **cuando se implemente**, no antes.

## 8. Funciones

### 8.1 RPC

| Función | Quién la llama | Hace |
|---|---|---|
| `list_internal_stores()` | cargador de formulario y páginas | Tiendas activas (`id`, `codigo`, `nombre`, `activa`); sin coordenadas en esta entrega. |
| `list_store_tasks(filtros)` | cargador de listado y archivo | Pendientes propios con filtros e indicadores derivados. |
| `get_store_task(id)` | acción de detalle | Ficha e historial. |
| `create_store_tasks(datos jsonb, sedes uuid[])` | acción de alta | Crea uno por tienda; con `requiere_diseno`, exige una sola tienda. |
| `update_store_task(id, versión, datos jsonb)` | acción de edición | Edita con control de versión. Instrucciones, fecha de entrega y la casilla solo cambian antes de solicitar. |
| `transition_store_task_status(id, versión, estatus, motivo)` | acción de estado | Transiciones de §4.2. |
| `archive_store_task` / `restore_store_task` | acciones de archivo | Archiva y restaura. |
| `sync_pendiente_drive_brief(id, brief, entregables, n)` | servidor (`service_role`) | Guarda carpetas y conteo comprobado en Drive. |
| `reserve_pendiente_brief_upload(...)` | servidor (`service_role`) | Reserva una carga al brief (máx. 10 archivos o reservas, 100 MB, tipos permitidos, dueño del pendiente). |
| `request_pendiente_to_design(id, actor)` | servidor (`service_role`) | Valida dueño, casilla, instrucciones, fecha y brief verificado hace menos de 5 min; pasa a `SOLICITADO` y registra historial. |
| `retract_pendiente_design_request(id, versión)` | acción de retiro | Solo en `SOLICITADO`. |
| `get_design_internal_queue()` | Design | Solicitudes por tomar y en curso (§6.4). |
| `get_design_internal_history(limite, desplazamiento)` | Design | Entregadas y canceladas que llegaron a `SOLICITADO`. |
| `get_design_internal_request(id)` | Design | Ficha de una solicitud visible. |
| `design_start_internal_request(id)` | Design | `SOLICITADO → EN_DISENO`; guarda `disenador_id` si estaba vacío. |
| `design_deliver_internal_request(id)` | Design, tras comprobar Drive | `EN_DISENO → ENTREGADO`. |
| `reserve_pendiente_deliverable_upload(...)` | servidor (`service_role`) | Reserva una carga a `Entregables` (máx. 20 archivos, 500 MB, solo en `EN_DISENO`). |
| `get_pendiente_designer_names(ids uuid[])` | Interno y Design | Nombre del diseñador, sin abrir `profiles`. |

Errores con código estable, como en Eventos: `CONFLICTO_VERSION`, `MOTIVO_REQUERIDO`, `FALTAN_DATOS`.

### 8.2 Reglas de entrega de Design

Igual que en publicaciones: la acción de servidor comprueba en Drive que hay al menos un archivo en `Entregables` **creado después** del inicio de la solicitud (`diseno_iniciado_en`) y luego llama a `design_deliver_internal_request`. La regla se valida en la acción de servidor, no en la base de datos (limitación ya conocida de `plan-rol-design.md`).

### 8.3 Drive

- Todo pendiente puede tener documentación en Drive, independientemente de "Requiere diseño". La carpeta raíz y `Brief` se crean al guardar el pendiente; si falla, el pendiente queda guardado y la interfaz muestra "Sin carpeta de Drive" con "Reintentar carpeta".
- `ensurePublicacionDriveFolders` asegura `Brief` y `Entregables` al primer acceso a Drive, incluso si todavía no se requiere diseño. Ambas carpetas y sus archivos se conservan si se desmarca "Requiere diseño". La interacción exacta de la casilla y la carpeta en ediciones posteriores queda pendiente para una decisión futura; en esta entrega no se ejecutan borrados de Drive.
- **Archivar un pendiente no borra su carpeta de Drive** y no hay purga programada para pendientes en esta entrega.

## 9. Vistas

| Vista | Ruta | Contenido | Maqueta |
|---|---|---|---|
| Pendientes · Mapa | `/internal/pendientes` | Vista inicial con resumen, fondo gris provisional, marcadores con cantidad y urgencia, San Felipe al pie y panel de la tienda seleccionada; filtros Tipo y Estado. | `Main`, `Movil`, `Estados` |
| Pendientes · Listado | `/internal/pendientes` | Botones **Mapa / Listado / Archivo**; búsqueda, filtros Tipo, Estado, tienda y diseño; tabla con indicador de urgencia y estado de diseño; paginación en la URL. | `Lista` |
| Mapa (posterior) | `/internal/pendientes/map` (por definir al implementar esa fase) | Mapa estático con pie y panel de tienda. | `Main`, `Movil` |
| Archivo | `/internal/pendientes/archive` | Misma cabecera; entregados y cancelados, con "Restaurar". | `Archivo` |
| Crear | Panel lateral | Tipo, tienda, título, cantidad, fecha requerida, detalle; brief en Drive se carga después de guardar; casilla **Requiere diseño**, instrucciones y fechas calculadas. | `Formulario` |
| Paso posterior a crear | Panel lateral | Confirmación y brief con subida en curso; "Solicitar a Design" deshabilitado hasta tener un archivo y cumplir los demás requisitos. | `CrearBrief` |
| Editar | Panel lateral | Igual que crear, con el brief activo, el aviso ámbar de fechas y la tarjeta de solicitud. | `Editar` |
| Detalle | Panel lateral | Estados, fechas, solicitud a Design con su línea de estados, instrucciones, brief, entregables e historial. | `Detalle` |
| Estados de la interfaz | Todas | Sin pendientes, fondo no disponible, error, conflicto, sin carpeta de Drive, archivos con error, "Diseño ya abrió", cancelar con diseño en curso y tiendas sin ubicación. | `Estados` |
| Design · cola | `/design/internal` | Solicitudes por tomar y en curso del Interno. Mismo diseño que `/design/publications`; **sin maqueta nueva**: se copia la estructura existente cambiando la fuente de datos. | (existente) |
| Design · ficha | `/design/internal/[id]` | Instrucciones y brief arriba, fechas en medio, carga de entregables y entrega, como la ficha de publicaciones. | (existente) |
| Design · historial | `/design/internal/history` | Entregadas y canceladas. | (existente) |

**Menú:** el Interno tiene un solo ítem, **Pendientes**. Design suma un ítem **Pendientes del Interno** a su menú actual, visible con `design.internal.read`.

Las maquetas (`docs/design/prototypes/internal-map/`) son **autónomas**: se abren directo en el navegador, no usan `support.js` ni `<x-dc>`. `Main` y `Movil` guían el mapa funcional con fondo gris; `Lista`, `Archivo`, `Formulario`, `CrearBrief`, `Editar`, `Detalle` y `Estados` guían sus respectivos flujos. Los datos son de ejemplo. La maqueta de Design no existe porque reutiliza la cola y la ficha ya implementadas.

Lo que las maquetas fijan:

- El punto del marcador es la coordenada exacta de la tienda; el nombre flota al lado, a la izquierda o a la derecha según la tienda, para no tapar a las vecinas. Con las coordenadas actuales ningún marcador se superpone, tampoco en móvil.
- Los marcadores móviles miden 40 px, algo menos que los 44 px recomendados, para no tapar a las tiendas más cercanas.
- La tarjeta de solicitud lista los requisitos (instrucciones, fecha y brief) con una marca de cumplido y deshabilita el botón mientras falte alguno.

## 10. Relación con otros módulos

| Módulo | Relación |
|---|---|
| Design | Recibe las solicitudes del Interno en `/design/internal`, separadas de las publicaciones. **No se modifica el código de publicaciones**: la implementación duplica y adapta lo necesario (§11) y deja el refactor a un helper compartido para después. |
| Eventos | Comparte el catálogo de tiendas (`inventario_sedes`). No comparte pendientes. |
| Inventario (Eventos) | Existe la categoría **Insumo** en el inventario de Eventos. Los "insumos" del Interno no se enlazan hasta confirmar si son lo mismo (D9). |
| Social Media | Sin relación. |
| Terceros | Si las impresiones o los insumos se piden a un proveedor del directorio `/third-parties`, se podría enlazar después. Hoy va en el detalle libre. |

## 11. Fases

El orden de construcción y los prompts están en [`implementacion-rol-interno.md`](./implementacion-rol-interno.md). Resumen:

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Fijar decisiones de flujo, revisar el esquema local y preparar migraciones para aplicación manual. Mapa y coordenadas se aplazan. | — |
| 1 | Migración `202610180001`: `pendientes_tienda` con sus columnas de diseño y Drive, historial, permisos del Interno, RLS y RPC de pendientes y catálogo de tiendas. | Fase 0 |
| 2 | Migración `202610180002`: cargas a Drive, solicitud a Design, RPC y permisos de Design. | Fase 1 |
| 3a | Tipos, lógica y pruebas; acciones de servidor; rutas, menú, mapa sobre fondo gris, listado, archivo y formularios **sin** diseño. Entrega usable sin imagen geográfica. | Fase 1 |
| 3b | Lado Interno de la solicitud: casilla, instrucciones, fecha, brief a Drive, solicitar y retirar. | Fases 2 y 3a |
| 3c | Lado Design: cola, ficha, historial, carga de entregables y entrega. | Fase 2 y 3b |
| 4 | Verificación después de la aplicación manual (`supabase db pull`, grants, RLS, RPC) y prueba con cuentas `internal` y `design` reales; actualizar SRS y esquema. | Fases 1 a 3 |
| 5 | Mapa estático (imagen/representación, coordenadas y marcadores); otras mejoras según uso: ciclo de corrección, recibir solicitudes de otros roles, vínculos con eventos y terceros, ruta de entregas y notificaciones. | Equipo / uso real |

## 12. Decisiones

### 12.1 Confirmadas por el equipo

| # | Decisión | Fecha |
|---|---|---|
| C1 | La vista principal es un mapa, no un calendario, con los pendientes del usuario por tienda. | 2026-10-15 |
| C2 | Los pendientes son de impresiones, insumos y necesidades. | 2026-10-15 |
| C3 | Mapa estático (Valencia Norte, Naguanagua y San Diego), minimalista, solo con las tiendas de Valencia. San Felipe, icono al pie. Sin integraciones ni dibujo en HTML; interactivo (tocar un marcador) basta para la versión básica. | 2026-10-15 y 2026-10-17 |
| C4 | Una sola persona crea sus pendientes y se los asigna. Por ahora no recibe solicitudes. | 2026-10-15 |
| C5 | Las solicitudes a Design van en crear, editar y detalle del pendiente, con casilla "Requiere diseño", instrucciones, fecha de entrega de la pieza y brief a Drive de 10 archivos y 100 MB. | 2026-10-17 |
| C6 | Se piden impresiones y también piezas digitales; se mantiene simple con instrucciones de texto libre. | 2026-10-17 |
| C7 | Correcciones: se definen con el equipo en las pruebas. | 2026-10-17 |
| C8 | La entrevista con el rol se omite por ahora. | 2026-10-15 |
| C9 | Menú con un solo ítem "Pendientes"; Listado y Archivo son sub vistas con botones en el encabezado junto a Tipo y Estado. | 2026-10-17 |

### 12.2 Adoptadas para dejar la especificación cerrada (revisables en las pruebas)

Salen de aplicar C5 a C7 con el criterio de mantenerlo simple. **Hay que confirmarlas**; si alguna no es lo que se quiere, se cambia antes de la fase 1.

| # | Tema | Valor adoptado |
|---|---|---|
| D3 | Dónde vive la solicitud | **Dentro del pendiente** (columnas), no como entidad aparte ni como publicación. Resuelta por C5. |
| D14 | Varias tiendas con diseño | Con "Requiere diseño" se elige **una sola tienda**, porque cada pieza lleva su propia carpeta y brief. Sin diseño se mantienen varias, una fila por tienda. |
| D15 | Ciclo de la solicitud | `SOLICITADO → EN_DISENO → ENTREGADO`, sin corrección ni aprobación; el Interno marca `LISTO` cuando quiera. |
| D16 | Piezas digitales | Misma casilla y mismo flujo en cualquier tipo; no se añade un tipo nuevo. |
| D17 | Casilla por defecto | Marcada solo en `IMPRESION`. |
| D18 | Retirar solicitud | Permitido mientras esté `SOLICITADO`, como "Volver a Brief" en Social Media. |
| D19 | Reglas de archivos | Las mismas del brief de Social Media (10, 100 MB, JPG/JPEG/PNG/WebP/PDF/MP4) y de `Entregables` (20, 500 MB). Si el Interno necesita otros formatos (por ejemplo `.ai`, `.psd` o `.docx`), se amplía después. |
| D20 | Permisos de Design | Propios (`design.internal.*`), separados de `design.posts.*`. |
| D21 | Código de Design | Se duplica y adapta, sin refactorizar publicaciones. |

### 12.3 Por confirmar con el equipo

| # | Pregunta | Por defecto |
|---|---|---|
| D5 | Imagen del mapa: fuente, límites reales, términos de uso (§5.3). | La provee el equipo. |
| D6 | Verificar marcadores y zona de cada tienda (§5.2). | Revisión visual antes de la migración. |
| D8 | Nombre visible del rol: "Interno" o "Pasante". | Se mantiene el código `internal`. |
| D9 | ¿Los insumos se solapan con la categoría Insumo del inventario de Eventos? | No se enlazan. |
| D10 | Umbral de "Próximo". | 2 días. |
| D13 | Uso principal: móvil o escritorio. | Ambos. |

## 13. Fuera de alcance

Mapa dinámico (zoom, arrastre, teselas, integraciones), dibujo del mapa en código, ciclo de corrección o aprobación de la pieza, recibir solicitudes de otros roles o de las tiendas, purga de carpetas de Drive de pendientes archivados, eliminar o reemplazar archivos del brief desde la app, vista previa embebida, costos y presupuesto de impresión, rutas optimizadas o navegación, ubicación en vivo de la persona, notificaciones y recordatorios, inventario de insumos, aprobaciones, vistas de supervisión, trabajo sin conexión y reportes comparativos.
