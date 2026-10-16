# Perfil Interno: pendientes por tienda sobre un mapa

**Estado (2026-10-15):** especificación en borrador, actualizada con las decisiones del equipo de esa noche. No hay código, migración ni permisos para este perfil. Hoy el rol `internal` existe en autenticación, no tiene permisos de negocio y quien lo recibe termina en `/access-pending`. El equipo decidió **omitir la entrevista** con el rol por tener clara la necesidad.
**Alcance:** rol `internal` ("Interno"), una sola persona usuaria, con una vista principal en forma de **mapa estático de Valencia Norte, Naguanagua y San Diego** donde cada tienda muestra los pendientes de la persona.
**Diseño de UI:** todavía no existe lienzo ni maquetas. §9 describe las vistas propuestas.
**Documentos relacionados:** [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`plan-rol-design.md`](./plan-rol-design.md), [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) y [`plan-inventario-eventos.md`](./plan-inventario-eventos.md) (mismo patrón de acceso, RPC y catálogo de tiendas).

## 1. Resultado esperado

1. La persona con rol Interno ve un **mapa** con las tiendas de Kromi en Valencia. Cada tienda muestra cuántos pendientes tiene y cuál es su urgencia. San Felipe, que está lejos, aparece como un icono al pie del mapa.
2. Al elegir una tienda ve sus pendientes de **impresiones, insumos y necesidades** y los hace avanzar hasta dejarlos entregados.
3. Crea sus propios pendientes para una o varias tiendas. No recibe solicitudes de otros; solo las crea.
4. Las **impresiones se piden a Design**, como lo hace Social Media, pero con formatos y medidas libres, escritos en un campo de instrucciones (§3.1 y §10).
5. Cada cambio de estado guarda quién lo hizo y cuándo; los retrocesos y cancelaciones piden motivo.
6. Existe un **listado** equivalente al mapa, para buscar y filtrar y para usar cuando el mapa no cargue o una tienda no tenga coordenadas.
7. Vive como un perfil más (`internal`), con su propio menú y permisos; no abre `/support` ni `/third-parties`.

## 2. Punto de partida

### 2.1 Pedido y decisiones del equipo

| Tema | Detalle | Fecha |
|---|---|---|
| Responsabilidad | Se encarga sobre todo de **solicitar impresiones** y de tener **asignados pendientes** de impresiones, insumos y necesidades de cada tienda. | 2026-10-15 |
| Interfaz | No es un calendario: es un mapa con las sucursales; cada una muestra **los pendientes del usuario**. | 2026-10-15 |
| Mapa **estático** | **No es dinámico.** Carga Valencia Norte, Naguanagua y San Diego, es minimalista y solo marca las coordenadas de las tiendas Kromi de Valencia. | 2026-10-15 |
| San Felipe | **Queda fuera del mapa** como un icono de interfaz al pie, por estar en una ubicación muy distinta. | 2026-10-15 |
| Quién crea | **El rol los crea y se los asigna a sí mismo**: es un rol de un solo miembro. **Por ahora no recibe solicitudes, solo las crea.** | 2026-10-15 |
| Impresiones | **"Solicitar impresiones" se le asigna a Design**, como hace Social Media, pero con formatos y medidas libres, igual que el campo "Instrucciones". | 2026-10-15 |
| Entrevista | **Omitida por ahora**: la necesidad está clara. | 2026-10-15 |
| Tiendas y direcciones | Las siete tiendas, con dirección y enlace de Google Maps, entregadas por el equipo (§5.2). | 2026-10-15 |

### 2.2 Qué hay hoy en el repositorio (verificado en `main`, commit `2eebfa2`)

- `internal` está en `APP_ROLES` y `ROLE_LABELS` (`src/lib/auth/permissions.ts`) y en la tabla `app_roles` (`202610050001_auth_roles_permissions.sql`). El tipo `AppPermission` ya admite el prefijo `internal.*`, pero **no existe ningún permiso `internal.*`**.
- El SRS §7.2 y §7.3 dicen que `internal` no recibe concesiones de negocio. `perfiles-de-usuario.md` lo listaba como pendiente de ficha funcional.
- No hay rutas `/internal`. Tras iniciar sesión, `loginAction`, `login/page.tsx` y `access-pending/page.tsx` solo redirigen a `social-media`, `customer-support`, `design` y `events`; un usuario `internal` cae en `/access-pending`.
- **No hay coordenadas de tiendas en ninguna tabla.** El único catálogo con las siete sedes es `inventario_sedes` (`codigo`, `nombre`, `orden`, `activa`). `sede_enum` solo conoce Prebo y Mañongo. Su lectura está limitada por RLS a `events.inventory.read`.
- **Design depende de `publicaciones`.** `get_design_publication_queue()` solo devuelve publicaciones `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION` con `requiere_diseno`; Design no puede leer `publicaciones` fuera de esa RPC; las carpetas `Brief` y `Entregables` de Drive, las reservas de carga y el historial de estados cuelgan de la publicación (`plan-rol-design.md` §3). Un pendiente de la tabla nueva **no aparece en la cola de Design** sin trabajo adicional (§10).
- Con un mapa estático **no hace falta ninguna biblioteca de mapas ni proveedor de teselas**; `package.json` no tiene ninguna y no se añade.
- Patrón a seguir: el de Inventario y Programación de Eventos: lectura por RLS con permiso, escritura solo por RPC `SECURITY DEFINER` con `search_path` vacío, control de versión (`CONFLICTO_VERSION`) y historial inmutable. No el de campañas, que usa la service role.
- `AGENTS.md` advierte que esta versión de Next.js tiene cambios incompatibles: antes de escribir código hay que leer la guía correspondiente en `node_modules/next/dist/docs/`.

## 3. Qué es un pendiente

Unidad de trabajo: **un pendiente pertenece a una tienda**. Los tres tipos salen del pedido; los campos son propuesta.

| Campo | Tipo | Regla |
|---|---|---|
| Tienda | una de `inventario_sedes` | Obligatoria. Un pendiente, una tienda. Desde el formulario se pueden elegir varias y se crea una copia por tienda. |
| Tipo | `IMPRESION`, `INSUMO`, `NECESIDAD` | Obligatorio. |
| Título | texto, hasta 160 | Obligatorio. |
| Detalle | texto largo libre, hasta 2000 | Opcional. Cantidades, notas, proveedor y lo que haga falta, sin formato impuesto. |
| Cantidad | entero ≥ 1 | Opcional. |
| Enlace de referencia | texto (URL) | Opcional. Por ejemplo, una carpeta de Drive con material de apoyo. No se suben archivos. |
| Fecha requerida | fecha (America/Caracas) | Opcional. |
| Asignado a | usuario con rol `internal` | Siempre quien crea. No se reasigna. |

### 3.1 Solicitud a Design (solo `IMPRESION`)

Un pendiente de tipo `IMPRESION` puede **solicitarse a Design**. Se parece a lo que hace Social Media, con una diferencia: no hay formato de publicación ni cuentas; el pedido lleva un campo de **instrucciones de texto libre** (hasta 4000 caracteres, como el de Social Media) donde se escriben formato, medidas, material y cantidades como haga falta. Si un trabajo requiere más de un formato, se describe en las mismas instrucciones.

Cómo viaja esa solicitud hasta Design es la decisión más importante pendiente (D3, §10). La entrega de Design vuelve al Interno, que es quien la recibe y la lleva a la tienda.

Fuera del pendiente por ahora: costos, proveedor como campo propio, adjuntos, prioridad manual y subtareas.

## 4. Estados y reglas

### 4.1 Estados (propuesta)

| Código | Etiqueta | Significado |
|---|---|---|
| `PENDIENTE` | Pendiente | Registrado, sin empezar. Estado inicial. |
| `EN_PROCESO` | En proceso | Se está gestionando (por ejemplo, con Design o en compra). |
| `LISTO` | Listo para entregar | Ya está disponible y falta llevarlo a la tienda. Permite preparar la visita a cada tienda. |
| `ENTREGADO` | Entregado | Llegó a la tienda. Estado final. |
| `CANCELADO` | Cancelado | Ya no se necesita. Motivo obligatorio. |

Cuando exista la solicitud a Design (fase 3b), el estado de la solicitud de diseño se muestra junto al del pendiente y el pendiente pasa a `EN_PROCESO` al solicitar; el de Design no sustituye al del pendiente.

### 4.2 Transiciones

- Avanzar (`PENDIENTE → EN_PROCESO → LISTO → ENTREGADO`) lo hace la persona usuaria; se permite saltar pasos.
- Retroceder o reabrir un `ENTREGADO` exige motivo y queda en el historial.
- Cancelar desde cualquier estado abierto exige motivo. `CANCELADO` solo vuelve a `PENDIENTE` con motivo.
- Archivar: solo `ENTREGADO` o `CANCELADO`. Se ocultan del mapa y se ven en el archivo; no se borran.

### 4.3 Indicadores derivados (no se guardan)

Se calculan con la fecha de hoy en America/Caracas, solo para pendientes abiertos (`PENDIENTE`, `EN_PROCESO`, `LISTO`):

| Indicador | Condición |
|---|---|
| Vencido | `fecha_requerida` anterior a hoy. |
| Próximo | `fecha_requerida` hoy o dentro de 2 días (umbral propuesto, D10). |
| Sin fecha | No tiene `fecha_requerida`. |

### 4.4 Reglas

1. **Conflicto de edición:** cada cambio comprueba `version`; si cambió, la interfaz ofrece cargar la versión actual.
2. **Acceso por persona:** cada usuario `internal` ve y modifica solo lo que creó. Hoy es una sola persona; la regla evita exponer datos si el rol crece.
3. **Un pendiente entregado** solo permite corregir el detalle; no se reprograma.
4. **Zona horaria:** fechas y "hoy" en America/Caracas, igual que en Eventos (`src/lib/events.ts`, `src/lib/inventory.ts`).

## 5. El mapa estático

Es la diferencia central con los demás perfiles: la dimensión principal es **dónde**, no cuándo.

### 5.1 Comportamiento

- **Mapa fijo**, sin zoom, arrastre ni teselas. Cubre Valencia Norte, Naguanagua y San Diego y es minimalista: solo se marcan las tiendas.
- **Marcadores:** uno por tienda dentro del encuadre. Muestran el número de pendientes abiertos y su color sigue el peor indicador de esa tienda (vencido, próximo, sin urgencia). Una tienda sin pendientes se ve atenuada pero visible.
- **Pie del mapa:** las tiendas cuyas coordenadas caen **fuera del encuadre** (hoy, San Felipe) se dibujan como un icono con su insignia, en una franja al pie. La regla es geométrica, no una marca en la base de datos. Las tiendas sin coordenadas van a un bloque "Sin ubicación".
- **Resumen superior:** total de abiertos, vencidos y listos para entregar.
- **Panel de tienda** (lateral en escritorio, hoja inferior en móvil): nombre y dirección, pendientes agrupados por tipo con estado e indicador, acciones rápidas de estado y "Nuevo pendiente en esta tienda".
- **Filtros:** tipo, estado y "solo vencidos", en la URL como en Inventario y Eventos.
- **Accesibilidad:** cada marcador es un botón con nombre de tienda y conteo; el listado ofrece el mismo contenido sin mapa.

### 5.2 Tiendas y coordenadas

Direcciones entregadas por el equipo. Las coordenadas se leyeron de la **ubicación marcada en cada enlace de Google Maps** que el equipo compartió (no se abrieron las páginas, solo se leyó la dirección a la que redirige cada enlace). Marcan el lugar de Google, no necesariamente la puerta de la tienda.

| Tienda | Zona del mapa | Dirección entregada | Latitud | Longitud |
|---|---|---|---|---|
| Prebo | Valencia Norte | Urb. Prebo Av. 137 c/c 114, C.C. V Avenida | 10.2133212 | -68.0279878 |
| Mañongo | Naguanagua | Urb. Ciudad Jardín Mañongo, Parcela 1 y 2 | 10.2415025 | -67.9974483 |
| Trigal Sur | Valencia Norte | C.C. Trigal Sur, Planta Baja | 10.2124862 | -67.9999188 |
| Trigal Norte | Valencia Norte | C.C. Las Clavellinas, antiguo Panda | 10.2251378 | -68.0012985 |
| Guataparo | Valencia Norte | C.C. Guataparo Express, Valencia 2001 | 10.1882288 | -68.0435123 |
| Castillito | San Diego | Urb. Parque Comercio Industrial Castillito, C.C. Tigsa, galpón G-2 | 10.1955375 | -67.9692031 |
| San Felipe | Icono al pie | Av. Intercomunal El Fuerte, Yaracuy | 10.3427758 | -68.7259993 |

**A verificar con el equipo:** los nombres que muestra Google para cada enlace no coinciden siempre con la dirección entregada (por ejemplo, el de Castillito aparece como "San Diego" y el de Trigal Norte como "Kromi Market Express - Trigal Norte"), y la zona de cada tienda en esta tabla es una asignación provisional por proximidad. Conviene revisar cada marcador sobre el mapa antes de dar el dato por bueno.

### 5.3 Posicionamiento

- Encuadre **provisional**, calculado con las seis tiendas de Valencia más un margen: latitud 10.180 a 10.250 y longitud -68.052 a -67.961 (≈ 8 km × 10 km). Se ajusta al elegir el fondo.
- La posición de cada marcador es **lineal** dentro del encuadre: `x = (lng − lngMin) / (lngMax − lngMin)` e `y = (latMax − lat) / (latMax − latMin)`. A esta escala la diferencia con una proyección Mercator es despreciable.
- El fondo debe respetar exactamente ese encuadre. Cambiar de fondo no exige cambiar código, solo el archivo y los cuatro límites.
- Con estas coordenadas ningún par de tiendas queda a menos de 1 km, por lo que no se esperan marcadores superpuestos.

### 5.4 Fondo del mapa (decisión D5)

El repositorio no tiene un mapa base. Opciones:

| Opción | Detalle |
|---|---|
| Fondo neutro con etiquetas de zona | Sin calles. Etiquetas "Valencia Norte", "Naguanagua" y "San Diego" junto a las tiendas que contienen y marcadores en su posición real. Es honesto, no requiere nada externo y es lo que se propone para la primera entrega. |
| Imagen o SVG exportado de una herramienta de mapas | Con calles. Exige cumplir sus términos y atribución; debe exportarse con los límites exactos de §5.3. |
| SVG derivado de datos de OpenStreetMap | Con calles. Requiere atribución a los colaboradores de OpenStreetMap y trabajo de generación. |

## 6. Modelo de datos propuesto

Migración nueva con nombre tentativo `2026101x000x_internal_store_tasks.sql`; **no existe todavía**. Antes de escribirla, partir de `supabase db pull` para contrastar con el esquema desplegado.

### 6.1 Coordenadas de tiendas

Añadir a `inventario_sedes` columnas opcionales `latitud numeric(10,7)`, `longitud numeric(10,7)` y `direccion text`, con `CHECK` de rango. Así se mantiene **un solo catálogo de tiendas** compartido con Eventos. Son nulas por defecto, así que no alteran Inventario ni Programación. Los valores iniciales son los de §5.2, una vez verificados.

- La lectura para el rol `internal` se hace con una RPC `SECURITY DEFINER` que devuelva solo `id`, `codigo`, `nombre`, `direccion`, `latitud`, `longitud` y `activa`, sin abrir la política de `inventario_sedes` a `internal`.
- Sin interfaz de edición en la primera entrega: los valores se cargan por migración o SQL.

### 6.2 Tablas nuevas

| Tabla | Contenido |
|---|---|
| `pendientes_tienda` | Los campos de §3, más `estatus`, `creado_por`, `entregado_en`, `version`, `archivado_en`, `created_at`, `updated_at`. FK a `inventario_sedes` y a `auth.users`. |
| `pendiente_tienda_historial` | Una fila por cambio de estado: `pendiente_id`, `anterior`, `nuevo`, `motivo`, `cambiado_por`, `cambiado_en`. Inmutable por trigger, como `evento_historial`. |

La solicitud a Design (§3.1) añade datos propios; su modelo depende de D3 (§10).

Catálogos como texto con `CHECK` (tipo y estatus), no `ENUM`. Índices previstos: `(creado_por, estatus)`, `(sede_id, estatus)` y `(estatus, fecha_requerida)`.

### 6.3 Seguridad

- RLS de lectura con `has_permission('internal.store-tasks.read')` **y** `creado_por = auth.uid()`.
- Sin grants de escritura directa a `anon` ni `authenticated`; toda escritura por RPC `SECURITY DEFINER` con `search_path` vacío, que vuelve a validar permiso, propiedad y versión.
- La interfaz oculta navegación sin permiso, pero servidor y RPC deciden el acceso.

## 7. Permisos

| Código | Rol `internal` | Uso |
|---|---|---|
| `internal.store-tasks.read` | Sí | Ver mapa, listado, ficha e historial propios. |
| `internal.store-tasks.create` | Sí | Crear pendientes. |
| `internal.store-tasks.update` | Sí | Editar datos. |
| `internal.store-tasks.status.update` | Sí | Cambiar estado, cancelar y reabrir. |
| `internal.store-tasks.archive` | Sí | Archivar y restaurar. |

Ningún otro rol los recibe. `admin` no los adquiere por su nombre de rol (SRS §7.2). La solicitud a Design requerirá además un permiso propio y uno nuevo para `design` (D3). El SRS §7.2 y §7.3 deben actualizarse **cuando se implemente**, no antes.

## 8. Funciones propuestas

| Función (tentativa) | Acción de servidor | Hace |
|---|---|---|
| `list_internal_stores()` | cargador de la página | Tiendas activas con coordenadas, para el mapa y el pie. |
| `list_store_tasks(filtros)` | cargador de mapa, listado y archivo | Pendientes propios con filtros e indicadores derivados. |
| `get_store_task(id)` | acción de detalle | Ficha e historial. |
| `create_store_tasks(datos, sedes[])` | acción de alta | Crea uno por tienda elegida. |
| `update_store_task(id, versión, datos)` | acción de edición | Edita con control de versión. |
| `transition_store_task_status(id, versión, estatus, motivo)` | acción de estado | Transiciones de §4.2. |
| `archive_store_task` / `restore_store_task` | acciones de archivo | Archiva y restaura. |
| Solicitud a Design (fase 3b) | por definir | Según D3. |

Errores con código estable, como en Eventos: `CONFLICTO_VERSION`, `MOTIVO_REQUERIDO`, `FALTAN_DATOS`.

### 8.1 Archivos de código que habría que tocar o crear

- Nuevo: `src/app/(dashboard)/internal/` con `layout.tsx` (exige `internal.store-tasks.read`), `shell.tsx` (menú), `page.tsx` (redirección a `/internal/map`), `map/`, `map/list/`, `map/archive/`.
- Nuevo: componente `StoresStaticMap` (recibe tiendas con coordenadas y conteos; contiene la regla de encuadre y pie) y el fondo del mapa en `public/`.
- Nuevo: `src/app/actions/internal/storeTasks.ts`, `src/types/modules/internal.ts` y `src/lib/internalTasks.ts` (validadores y fechas).
- Editar: `src/app/actions/auth.ts`, `src/app/(auth)/login/page.tsx` y `src/app/(auth)/access-pending/page.tsx` para enviar a `internal` a `/internal`.
- Reutilizar `useRegisterShellSlots` y el patrón de `events/shell.tsx` para el menú; no copiar componentes grandes de Grid.

## 9. Vistas propuestas

| Vista | Ruta | Contenido |
|---|---|---|
| Mapa | `/internal/map` | Mapa estático con marcadores, pie de San Felipe, resumen, filtros y panel de tienda (§5). |
| Listado | `/internal/map/list` | Tabla con búsqueda y filtros por tienda, tipo, estado e indicador; paginación en la URL. |
| Ficha | Panel lateral | Datos, estado y acciones, historial; en impresiones, instrucciones y estado de la solicitud a Design. |
| Formulario | Panel lateral | Crear y editar; una o varias tiendas; tipo; fecha requerida; en `IMPRESION`, campo de instrucciones y acción "Solicitar a Design". |
| Archivo | `/internal/map/archive` | Entregados y cancelados archivados, con restauración. |
| Estados de la interfaz | Todas | Vacío, sin resultados, error con reintento, carga, conflicto, mapa sin fondo y móvil. |

La paleta y el lenguaje visual son los de la marca ya aplicados en `globals.css`. Falta definir el diseño; el siguiente paso natural es un lienzo de maquetas como los de Eventos.

## 10. Relación con otros módulos

### 10.1 Solicitud a Design (decisión D3, la más importante)

El equipo quiere que "solicitar impresiones" funcione como lo hace Social Media, pero con formatos y medidas libres. Hoy Design solo ve `publicaciones` (§2.2). Tres caminos:

| Opción | Cómo funciona | Pros y contras |
|---|---|---|
| **A. Reutilizar `publicaciones`** | La impresión se crea como una publicación especial. | Reaprovecha cola, ficha, carga a Drive e historial de Design. Pero `publicaciones` exige formato (`CARRUSEL`, `POST`, `REEL`, `STORY`), fecha de publicación, cuentas sociales y campaña, y mezclaría tickets de impresión con el contenido de Social Media. |
| **B. Solicitud de Design propia (recomendada)** | Tabla nueva de solicitudes de impresión enlazada al pendiente, con sus instrucciones libres y su propia carpeta de Drive. La cola de Design muestra también estas solicitudes (nueva pestaña o filtro). | Separa los dominios y admite formatos libres. Cuesta más: RPC y permisos nuevos en Design, y generalizar la carga a Drive hoy atada a `publicaciones` (`plan-rol-design.md` §3). |
| **C. Solo texto y enlace** | El pendiente lleva instrucciones y enlace de Drive; el contacto con Design es fuera de la app. | Casi sin cambios en Design, pero sin estado ni entrega dentro de Kromi. No cumple lo pedido. |

**Preguntas que dependen de la opción:** quién revisa la entrega de Design (propuesta: el Interno, que la recibe), si hay SLA como en publicaciones, y qué ven los diseñadores (propuesta: instrucciones, enlace y entrega, sin datos de tienda).

**Propuesta de fases:** el mapa, los insumos, las necesidades y el registro de impresiones **se entregan primero sin el envío a Design** (fase 3a); la opción B va como fase 3b, para no retrasar el mapa por cambios en el perfil de Design.

### 10.2 Otros módulos

| Módulo | Relación propuesta |
|---|---|
| Eventos | Comparte el catálogo de tiendas (`inventario_sedes`). No comparte pendientes. |
| Inventario (Eventos) | Existe la categoría **Insumo** en el inventario de Eventos. Los "insumos" del Interno no se enlazan hasta confirmar si son lo mismo (D9). |
| Social Media | Sin relación. |
| Terceros | Si las impresiones o los insumos se piden a un proveedor del directorio `/third-parties`, se podría enlazar después. Hoy va en el detalle libre. |

## 11. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Verificar coordenadas y zonas (§5.2) y elegir el fondo del mapa (§5.4). Confirmar D3. | Equipo |
| 1 | Migración: columnas de coordenadas, tablas, permisos `internal.store-tasks.*`, RLS, RPC e historial. | Fase 0 |
| 2 | Tipos, validadores, Server Actions, conexión del rol en `auth.ts`, login y acceso pendiente. | Fase 1 |
| 3a | Mapa estático, panel de tienda, listado, formulario, ficha y archivo, con impresiones registradas pero sin envío a Design. | Fase 2 y diseño de UI |
| 3b | Solicitud a Design (opción B de §10.1): modelo, permisos, cola de Design, carga y entrega. | D3, fase 3a y `plan-rol-design.md` |
| 4 | Verificación en remoto (`supabase db pull`, grants, RLS, RPC) y prueba con la cuenta `internal` real. | Fases 1 a 3 |
| 5 | Posteriores según uso: recibir solicitudes de otros roles, vínculos con eventos y terceros, ruta de entregas, notificaciones. | Uso real |

## 12. Decisiones

### 12.1 Confirmadas por el equipo (2026-10-15)

| # | Decisión |
|---|---|
| C1 | La vista principal es un mapa, no un calendario, con los pendientes del usuario por tienda. |
| C2 | Los pendientes son de impresiones, insumos y necesidades. |
| C3 | El mapa es estático (Valencia Norte, Naguanagua y San Diego), minimalista, solo con las tiendas de Valencia. San Felipe va como icono al pie. |
| C4 | El rol lo usa una sola persona, que crea sus pendientes y se los asigna. Por ahora no recibe solicitudes. |
| C5 | Las impresiones se solicitan a Design, con formatos y medidas libres en un campo de instrucciones. |
| C6 | La entrevista con el rol se omite por ahora. |

### 12.2 Por confirmar

| # | Pregunta | Valor propuesto |
|---|---|---|
| D3 | Cómo llega la solicitud de impresión a Design (§10.1). | Opción B, en fase 3b. |
| D5 | Fondo del mapa (§5.4). | Fondo neutro con etiquetas de zona en la primera entrega. |
| D6 | Verificar los marcadores de §5.2 y la zona de cada tienda. | Revisión visual por el equipo antes de la migración. |
| D4 | ¿Hace falta el estado `LISTO`? | Sí, para preparar la visita a cada tienda. |
| D8 | Nombre visible del rol: "Interno" o "Pasante". | Se mantiene el código `internal`; solo cambia la etiqueta si se decide. |
| D9 | ¿Los insumos se solapan con la categoría Insumo del inventario de Eventos? | No se enlazan. |
| D10 | Umbral de "Próximo". | 2 días. |
| D11 | ¿Un mismo pedido para varias tiendas? | Una fila por tienda, creadas desde un solo formulario. |
| D13 | Uso principal: móvil o escritorio. | Ambos; el mapa y el panel deben funcionar en pantalla de teléfono. |

Resueltas con las respuestas del equipo: quién crea y asigna (C4), tecnología del mapa (C3), coordenadas (§5.2) y las mismas siete tiendas que Eventos (se usa el catálogo existente).

## 13. Fuera de alcance

Mapa dinámico (zoom, arrastre, teselas), costos y presupuesto de impresión, rutas optimizadas o navegación, ubicación en vivo de la persona, notificaciones y recordatorios, carga de archivos en el pendiente, inventario de insumos, aprobaciones, vistas de supervisión, trabajo sin conexión, recibir solicitudes de otros roles o de las tiendas, y reportes comparativos.
