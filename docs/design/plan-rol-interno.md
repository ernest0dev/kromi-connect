# Perfil Interno: pendientes por tienda sobre un mapa

**Estado (2026-10-15):** borrador de especificación. No hay código, migración ni permisos para este perfil. Hoy el rol `internal` existe en autenticación, no tiene permisos de negocio y quien lo recibe termina en `/access-pending`. Los datos del perfil salen de un pedido verbal del equipo (§2.1); **no hubo entrevista documentada con la persona que ocupa el rol**, así que lo que no figura en el pedido está marcado como propuesta o como decisión por confirmar (§12).
**Alcance:** rol `internal` ("Interno"), con una vista principal en forma de **mapa de Valencia, Carabobo** donde cada tienda muestra los pendientes de la persona usuaria.
**Diseño de UI:** todavía no existe lienzo ni maquetas. §9 describe las vistas propuestas como punto de partida.
**Documentos relacionados:** [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) y [`plan-inventario-eventos.md`](./plan-inventario-eventos.md) (mismo patrón de acceso, RPC y catálogo de tiendas).

## 1. Resultado esperado

1. La persona con rol Interno ve un **mapa de Valencia** con las tiendas de Kromi. Cada tienda muestra cuántos pendientes tiene la persona y cuál es su urgencia.
2. Al elegir una tienda ve sus pendientes de **impresiones, insumos y necesidades**, y los hace avanzar hasta dejarlos entregados.
3. Puede **registrar una solicitud de impresión** (y de insumo o necesidad) para una o varias tiendas.
4. Cada cambio de estado guarda quién lo hizo y cuándo; los retrocesos y cancelaciones piden motivo.
5. Existe un **listado** equivalente al mapa, para buscar, filtrar y para usar cuando el mapa no cargue o una tienda no tenga coordenadas.
6. Vive como un perfil más (`internal`), con su propio menú y permisos; no abre `/support` ni `/third-parties`.

## 2. Punto de partida

### 2.1 Pedido del equipo

| Tema | Detalle | Fecha |
|---|---|---|
| Responsabilidad | El rol se encarga mayormente de **solicitar impresiones** y de **tener asignados pendientes** de impresiones, insumos y necesidades de cada tienda (sucursal). | 2026-10-15 |
| Interfaz | No es un calendario: es un **mapa de Valencia, Carabobo** donde se ven las sucursales y cada una muestra **los pendientes del usuario**. | 2026-10-15 |
| Motivo | La forma de trabajo del rol es considerablemente distinta a la de los perfiles anteriores. | 2026-10-15 |

### 2.2 Qué hay hoy en el repositorio (verificado en `main`, commit `2eebfa2`)

- `internal` está en `APP_ROLES` y `ROLE_LABELS` (`src/lib/auth/permissions.ts`) y en la tabla `app_roles` (`202610050001_auth_roles_permissions.sql`). El tipo `AppPermission` ya admite el prefijo `internal.*`, pero **no existe ningún permiso `internal.*`**.
- El SRS §7.2 y §7.3 dicen que `internal` no recibe concesiones de negocio. `perfiles-de-usuario.md` lo listaba como "perfil funcional pendiente" y pedía entrevista antes de desarrollar vistas.
- No hay rutas `/internal`. Tras iniciar sesión, `loginAction`, `login/page.tsx` y `access-pending/page.tsx` solo redirigen a `social-media`, `customer-support`, `design` y `events`; un usuario `internal` cae en `/access-pending`.
- **No hay coordenadas de tiendas en ninguna tabla.** El único catálogo de tiendas con las siete sedes (Prebo, Mañongo, Trigal Sur, Trigal Norte, Guataparo, Castillito, San Felipe) es `inventario_sedes` (`codigo`, `nombre`, `orden`, `activa`). `sede_enum` solo conoce Prebo y Mañongo.
- La lectura de `inventario_sedes` está limitada por RLS a quien tenga `events.inventory.read`; un usuario `internal` no podría leerla sin un cambio.
- **No hay biblioteca de mapas** en `package.json` ni variables de entorno para un proveedor de mapas. `next.config.ts` no define cabeceras de seguridad que bloqueen recursos externos.
- Patrón a seguir: el de Inventario y Programación de Eventos: lectura por RLS con permiso, escritura solo por RPC `SECURITY DEFINER` con `search_path` vacío, control de versión (`CONFLICTO_VERSION`) y historial inmutable. No el de campañas, que usa la service role.
- `AGENTS.md` advierte que esta versión de Next.js tiene cambios incompatibles: antes de escribir código hay que leer la guía correspondiente en `node_modules/next/dist/docs/`.

## 3. Qué es un pendiente

Unidad de trabajo: **un pendiente pertenece a una tienda**. Los tres tipos salen del pedido; los campos son propuesta.

| Campo | Tipo | Regla |
|---|---|---|
| Tienda | una de `inventario_sedes` | Obligatoria. Un pendiente, una tienda. Desde el formulario se pueden elegir varias y se crea una copia por tienda (D11). |
| Tipo | `IMPRESION`, `INSUMO`, `NECESIDAD` | Obligatorio. |
| Título | texto, hasta 160 | Obligatorio. |
| Detalle | texto largo libre, hasta 2000 | Opcional. Para impresiones: qué se imprime, medidas, papel, cantidades y proveedor, sin formato impuesto (igual que `materiales` en Eventos). |
| Cantidad | entero ≥ 1 | Opcional. |
| Pedido por | texto corto libre, hasta 80 | Opcional. Quién lo pidió (tienda, departamento, persona). No es un usuario de la app (D1). |
| Enlace de referencia | texto (URL) | Opcional. Por ejemplo, la carpeta de Drive con el arte a imprimir. No se suben archivos (D12). |
| Fecha requerida | fecha (America/Caracas) | Opcional. |
| Asignado a | usuario con rol `internal` | Por defecto, quien crea (D1, D2). |

Fuera del pendiente por ahora: costos, proveedor como campo propio, adjuntos, prioridad manual y subtareas.

## 4. Estados y reglas

### 4.1 Estados (propuesta)

| Código | Etiqueta | Significado |
|---|---|---|
| `PENDIENTE` | Pendiente | Registrado, sin empezar. Estado inicial. |
| `EN_PROCESO` | En proceso | Se está gestionando (por ejemplo, enviado a imprimir o comprado). |
| `LISTO` | Listo para entregar | Ya está disponible y falta llevarlo a la tienda. Es la base para saber qué llevar en cada visita (D4). |
| `ENTREGADO` | Entregado | Llegó a la tienda. Estado final. |
| `CANCELADO` | Cancelado | Ya no se necesita. Motivo obligatorio. |

### 4.2 Transiciones

- Avanzar (`PENDIENTE → EN_PROCESO → LISTO → ENTREGADO`) lo hace la persona asignada; se permite saltar pasos (por ejemplo, de `PENDIENTE` a `ENTREGADO`).
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
2. **Acceso por persona:** cada usuario `internal` ve y modifica solo los pendientes que tiene asignados (D2).
3. **Un pendiente entregado** solo permite corregir el detalle; no se reprograma.
4. **Zona horaria:** fechas y "hoy" en America/Caracas, igual que en Eventos (`src/lib/events.ts`, `src/lib/inventory.ts`).

## 5. El mapa

Es la diferencia central con los demás perfiles: la dimensión principal es **dónde**, no cuándo.

- **Marcadores:** uno por tienda activa con coordenadas. Muestran el número de pendientes abiertos de la persona. El color del marcador sigue el peor indicador de esa tienda: vencido, próximo, o sin urgencia. Una tienda sin pendientes se ve atenuada pero sigue visible.
- **Resumen superior:** total de abiertos, vencidos y listos para entregar.
- **Panel de tienda** (lateral en escritorio, hoja inferior en móvil): nombre y dirección, pendientes agrupados por tipo con estado e indicador, acciones rápidas de estado y "Nuevo pendiente en esta tienda".
- **Filtros:** tipo, estado y "solo vencidos". Los filtros viajan en la URL, como en Inventario y Eventos.
- **Tiendas sin coordenadas** o mapa que no carga: se listan en un bloque "Sin ubicación" para que ningún pendiente quede oculto.
- **Centro y zoom iniciales:** ajustados para que quepan las siete tiendas. El centro se calculará a partir de las coordenadas reales (§6.1), no se fija a mano.

### 5.1 Tecnología del mapa (decisión D5)

| Opción | A favor | En contra |
|---|---|---|
| Leaflet con teselas de OpenStreetMap | Sin clave ni cuenta; mapa real con calles. | La política de uso de teselas de OSM no está pensada para tráfico alto (suficiente para una herramienta interna pequeña, no garantizado); requiere carga solo en cliente; hay que verificar compatibilidad con React 19 y la versión de Next del repo. |
| Proveedor con clave (Google Maps, Mapbox, MapTiler u otro) | Estilo y soporte comerciales. | Cuenta, clave y posible costo; Google Cloud ya se usa para Drive, pero Maps es una API distinta y no se verificó que esté habilitada. |
| Mapa esquemático en SVG propio | Sin dependencias ni red; control total de marca. | No es un mapa real: no muestra calles; los puntos se ubican a mano. |

**Por defecto:** Leaflet con OpenStreetMap, detrás de un único componente `StoresMap` que reciba tiendas con coordenadas y pendientes, para poder cambiar de proveedor sin tocar el resto. Antes de adoptarlo hay que comprobar la compatibilidad real con las versiones del repo y la atribución requerida.

## 6. Modelo de datos propuesto

Migración nueva con nombre tentativo `2026101x000x_internal_store_tasks.sql`; **no existe todavía**. Antes de escribirla, partir de `supabase db pull` para contrastar con el esquema desplegado.

### 6.1 Coordenadas de tiendas

Añadir a `inventario_sedes` columnas opcionales `latitud numeric(9,6)`, `longitud numeric(9,6)` y `direccion text`, con `CHECK` de rango. Así se mantiene **un solo catálogo de tiendas** compartido con Eventos y se evita un tercero. Las columnas son nulas, por lo que no alteran Inventario ni Programación.

- Los valores **no se inventan**: deben aportarlos el equipo (por ejemplo, copiando las coordenadas desde la ubicación de cada tienda en un mapa). Es dato bloqueante para la vista (D6).
- La lectura para el rol `internal` se hace con una RPC `SECURITY DEFINER` que devuelva solo `id`, `codigo`, `nombre`, `direccion`, `latitud`, `longitud` y `activa`, sin abrir la política de `inventario_sedes` a `internal`.
- Sin interfaz de edición en la primera entrega: se cargan por migración o por SQL.

### 6.2 Tablas nuevas

| Tabla | Contenido |
|---|---|
| `pendientes_tienda` | Los campos de §3, más `estatus`, `asignado_a`, `creado_por`, `entregado_en`, `version`, `archivado_en`, `created_at`, `updated_at`. FK a `inventario_sedes` y a `auth.users`. |
| `pendiente_tienda_historial` | Una fila por cambio de estado: `pendiente_id`, `anterior`, `nuevo`, `motivo`, `cambiado_por`, `cambiado_en`. Inmutable por trigger, como `evento_historial`. |

Catálogos como texto con `CHECK` (tipo y estatus), no `ENUM`, para ampliarlos sin recrear tipos. Índices previstos: `(asignado_a, estatus)`, `(sede_id, estatus)` y `(estatus, fecha_requerida)`.

### 6.3 Seguridad

- RLS de lectura con `has_permission('internal.store-tasks.read')` **y** `asignado_a = auth.uid()` (D2).
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

Ningún otro rol los recibe. `admin` no los adquiere por su nombre de rol (SRS §7.2). El SRS §7.2 y §7.3 deben actualizarse **cuando se implemente**, no antes.

## 8. Funciones propuestas

| Función (tentativa) | Acción de servidor | Hace |
|---|---|---|
| `list_internal_stores()` | cargador de la página | Tiendas activas con coordenadas, para el mapa. |
| `list_store_tasks(filtros)` | cargador de mapa, listado y archivo | Pendientes propios con filtros e indicadores derivados. |
| `get_store_task(id)` | acción de detalle | Ficha e historial. |
| `create_store_tasks(datos, sedes[])` | acción de alta | Crea uno por tienda elegida. |
| `update_store_task(id, versión, datos)` | acción de edición | Edita con control de versión. |
| `transition_store_task_status(id, versión, estatus, motivo)` | acción de estado | Transiciones de §4.2. |
| `archive_store_task` / `restore_store_task` | acciones de archivo | Archiva y restaura. |

Errores con código estable, como en Eventos: `CONFLICTO_VERSION`, `MOTIVO_REQUERIDO`, `FALTAN_DATOS`.

### 8.1 Archivos de código que habría que tocar o crear

- Nuevo: `src/app/(dashboard)/internal/` con `layout.tsx` (exige `internal.store-tasks.read`), `shell.tsx` (menú), `page.tsx` (redirección a `/internal/map`), `map/`, `map/list/`, `map/archive/`.
- Nuevo: `src/app/actions/internal/storeTasks.ts`, `src/types/modules/internal.ts` y `src/lib/internalTasks.ts` (validadores y fechas).
- Editar: `src/app/actions/auth.ts`, `src/app/(auth)/login/page.tsx` y `src/app/(auth)/access-pending/page.tsx` para enviar a `internal` a `/internal`.
- Reutilizar `useRegisterShellSlots` y el patrón de `events/shell.tsx` para el menú; no copiar componentes grandes de Grid.

## 9. Vistas propuestas

| Vista | Ruta | Contenido |
|---|---|---|
| Mapa | `/internal/map` | Mapa con marcadores, resumen, filtros y panel de tienda (§5). |
| Listado | `/internal/map/list` | Tabla con búsqueda y filtros por tienda, tipo, estado e indicador; paginación en la URL. |
| Ficha | Panel lateral | Datos, estado y acciones, historial. |
| Formulario | Panel lateral | Crear y editar; selección de una o varias tiendas; tipo; fecha requerida; enlace de referencia. |
| Archivo | `/internal/map/archive` | Entregados y cancelados archivados, con restauración. |
| Estados de la interfaz | Todas | Vacío, sin resultados, error con reintento, carga, conflicto, mapa no disponible y móvil. |

La paleta y el lenguaje visual son los de la marca ya aplicados en `globals.css`. Falta definir el diseño; el siguiente paso natural es un lienzo de maquetas como los de Eventos.

## 10. Relación con otros módulos

| Módulo | Relación propuesta |
|---|---|
| Eventos | Comparte el catálogo de tiendas (`inventario_sedes`). No comparte pendientes: un evento que requiera impresiones o insumos podría generar pendientes en el futuro; hoy no. |
| Inventario (Eventos) | Existe la categoría **Insumo** en el inventario de Eventos. Los "insumos" del rol Interno pueden o no ser lo mismo; no se enlazan hasta confirmarlo (D9). |
| Social Media / Diseño | Una impresión puede salir de una pieza entregada por Diseño. Hoy solo se admite un enlace de referencia; un vínculo con `publicaciones` queda para después. |
| Terceros | Si las impresiones se piden a un proveedor del directorio `/third-parties`, se podría enlazar después. Hoy el proveedor va en el detalle libre. |

## 11. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Entrevista con la persona del rol (§12.3) y coordenadas/direcciones de las tiendas. Decidir tecnología del mapa. | Equipo |
| 1 | Migración: columnas de coordenadas, tablas, permisos `internal.store-tasks.*`, RLS, RPC e historial. | Fase 0 |
| 2 | Tipos, validadores, Server Actions, conexión del rol en `auth.ts`, login y acceso pendiente. | Fase 1 |
| 3 | Mapa, panel de tienda, listado, formulario, ficha y archivo. | Fase 2 y diseño de UI |
| 4 | Verificación en remoto (`supabase db pull`, grants, RLS, RPC) y prueba con cuentas `internal` reales. | Fases 1 a 3 |
| 5 | Posteriores según uso: asignación desde otros roles, vínculos con publicaciones, eventos y terceros, ruta de entregas, notificaciones. | Uso real |

## 12. Decisiones

### 12.1 Del pedido (2026-10-15)

| # | Decisión |
|---|---|
| P-1 | La vista principal es un mapa de Valencia con las sucursales; no un calendario. |
| P-2 | Los pendientes son de impresiones, insumos y necesidades, y se muestran por tienda. |
| P-3 | Cada tienda muestra los pendientes **del usuario**. |

### 12.2 Por confirmar (con valor propuesto)

| # | Pregunta | Valor propuesto |
|---|---|---|
| D1 | ¿Quién crea los pendientes y quién los asigna? ¿Otros roles o las tiendas hacen pedidos dentro de la app? | El propio rol los crea y se los asigna; `pedido_por` es texto libre. Sin creación desde otros roles. |
| D2 | ¿Cuántas personas usan el rol y se ven entre sí? ¿Hay un supervisor que vea todo? | Cada persona ve solo lo suyo; nadie ve todo. |
| D3 | "Solicitar impresiones": ¿es pedir a una imprenta o proveedor externo, a Diseño, o recibir pedidos de las tiendas? | Se registra como pendiente `IMPRESION` con el proveedor en el detalle libre; sin integración. |
| D4 | ¿Hace falta el estado `LISTO` (impreso o comprado, falta llevarlo)? | Sí, porque permite preparar la visita a cada tienda. |
| D5 | Tecnología del mapa. | Leaflet con OpenStreetMap detrás de `StoresMap` (§5.1). |
| D6 | Coordenadas y direcciones de las tiendas. | **Las aporta el equipo; bloquea la fase 3.** |
| D7 | ¿Son las mismas siete tiendas de Eventos? ¿Hay otros puntos (oficina, almacén, imprenta) que deban aparecer? | Las siete de `inventario_sedes`. |
| D8 | Nombre visible del rol: "Interno" o "Pasante". | Se mantiene el código `internal`; solo cambia la etiqueta si se decide. |
| D9 | ¿Los insumos se solapan con la categoría Insumo del inventario de Eventos? | No se enlazan. |
| D10 | Umbral de "Próximo". | 2 días. |
| D11 | ¿Un mismo pedido para varias tiendas? | Una fila por tienda, creadas desde un solo formulario. |
| D12 | Adjuntos. | Solo enlace de texto; sin carga de archivos. |
| D13 | Uso principal: móvil o escritorio. | Ambos; el mapa debe funcionar en pantalla de teléfono. |

### 12.3 Guion para la entrevista con el rol

1. ¿Qué pides, a quién y cómo lo pides hoy (impresiones, insumos, necesidades)?
2. ¿Quién te asigna pendientes y por qué medio llegan?
3. ¿Qué datos necesitas de cada pedido? Ejemplo reciente de cada tipo.
4. ¿Llevas tú los pedidos a las tiendas? ¿Cada cuánto y cómo organizas el recorrido?
5. ¿Qué consultas primero al empezar el día?
6. ¿Trabajas desde teléfono, computadora o ambos?
7. ¿Cuántas personas hacen este trabajo y se cubren entre sí?
8. ¿Qué parte del seguimiento hoy se te pierde?

## 13. Fuera de alcance

Costos y presupuesto de impresión, rutas optimizadas o navegación, ubicación en vivo de la persona, notificaciones y recordatorios, carga de archivos, inventario de insumos, aprobaciones, vistas de supervisión, trabajo sin conexión, creación de pedidos desde otros roles o por las tiendas, y reportes comparativos.
