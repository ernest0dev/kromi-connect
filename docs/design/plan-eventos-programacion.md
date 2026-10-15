# Perfil Eventos: programación y planificación de eventos

**Estado (2026-10-15):** plan con decisiones del equipo incorporadas; **no hay código ni migración todavía**. Es el segundo módulo del perfil `events`, junto al [inventario](./plan-inventario-eventos.md) ya implementado. Alcance: un **plan y una implementación básica** que escalará con las observaciones de las personas usuarias; lo que no está en la primera entrega queda en §13.
**Alcance:** rol `events`, rutas `/events/calendar`, `/events/list` y `/events/archive`; calendario, listado, ficha, estados, materiales, patrocinio y presupuesto.
**Propuesta de UI:** lienzo de diseño "Eventos · Programación" (ver §9); las pantallas se describen en §9.
**Documentos relacionados:** [`plan-inventario-eventos.md`](./plan-inventario-eventos.md), [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`supabase-db-migration.md`](../supabase-db-migration.md).

## 1. Resultado esperado

1. Eventos planifica cada evento con fecha, hora, duración, **una o varias tiendas**, presupuesto, materiales y demás datos de la §3, y lo hace avanzar por **En planificación → Programado → En curso → Terminado**. Los dos últimos pasos ocurren solos según la hora.
2. Ve todos sus eventos en un **calendario** (mensual y semanal) y en un **listado** filtrable. El calendario es la orientación gráfica; el listado sirve para buscar y ordenar.
3. Cada cambio de estado hecho por una persona y cada reprogramación quedan con usuario, fecha y motivo; los cambios automáticos quedan marcados como "Sistema".
4. Después del evento registra asistencia, gasto real y notas, para que el siguiente se planifique con datos.
5. Los materiales necesarios pueden apuntar a artículos del inventario ya existente, sin descontarlos (§10).
6. Vive dentro del perfil `events`: misma sesión, mismo menú lateral (grupo "Eventos": Calendario, Eventos, Inventario) y mismas reglas de acceso.

## 2. Punto de partida

### 2.1 Pedido y decisiones del equipo

| Tema | Detalle | Fecha |
|---|---|---|
| Datos del evento | Fecha, hora, duración, tienda, presupuesto, material necesario "etc." | 2026-10-14 |
| Clasificación | Con patrocinio o sin él; degustación, impulso u otro; propio de Kromi o de un proveedor; con inscripción o sin ella. | 2026-10-14 |
| Estados | En planificación, Programado, En curso, Terminado. | 2026-10-14 |
| Calendario | Orientación gráfica de los eventos; diseño parecido al de social-media, con diferencias propias del rol. | 2026-10-14 |
| **Varias tiendas** | **Un evento puede ocurrir en varias tiendas a la vez.** | 2026-10-15 |
| **Estados automáticos** | **"En curso" y "Terminado" se marcan solos por la hora.** | 2026-10-15 |
| **Visibilidad** | **Por ahora solo el rol `events` ve y gestiona los eventos.** | 2026-10-15 |
| **Integración** | **Es un aspecto más del perfil `events`, como el inventario: mismo rol, mismo shell y misma documentación de perfil.** | 2026-10-15 |
| **Alcance** | **Plan e implementación básica; escalará según observaciones de usuarios finales.** | 2026-10-15 |

### 2.2 Qué se reutiliza de social-media (verificado en el repo)

| Patrón | Dónde está hoy | Adaptación para Eventos |
|---|---|---|
| Calendario mensual con celdas por día, "hoy" resaltado y alta rápida por día | `social-media/grid/components/GridCalendar.tsx`, `GridCell.tsx`; `utils/date.ts` (`generateCalendarDays`, semana desde lunes) | Reutilizar la generación de días. La celda debe pintar **eventos con hora y que cruzan varios días**, algo que Grid no hace (una publicación ocupa un solo día). |
| Mover por arrastre (cambia la fecha) | `hooks/useDragDrop.ts` | Mover un evento a otro día conserva hora y duración. Si ya está Programado, pide motivo (§5). |
| Detalle en panel/modal con acciones de estado | `TicketDetailCard.tsx`, `StatusSelect.tsx`, `TicketEditModal.tsx` | Ficha del evento en panel lateral, como los paneles del inventario. |
| Estados con una etiqueta y una familia de color | `grid/utils/constants.ts` (`ESTATUS_STYLE`: gris pendiente, azul en proceso, naranja atención, verde terminado) | Misma lógica semántica; los colores concretos se fijan en el diseño. |
| Historial de cambios de estado con motivo | Tabla `publicacion_estatus_historial`, RPC `transition_publicacion_status` | Tabla `evento_historial` y RPC equivalente. |
| Indicador derivado de plazo | `grid/utils/sla.ts` (`calcularSlaState`) | Indicadores derivados de preparación y atraso (§4.3). |
| Capas de contexto en el calendario | Efemérides y campañas en `GridCell` | Fase posterior (§11, fase 5). |
| Archivar en lugar de borrar | Archivo de publicaciones y campañas | `archivado_en` y vista de archivados. |
| Control de versión y conflicto | Inventario (`version`, `CONFLICTO_VERSION`) | Igual en `eventos`. |

### 2.3 Hallazgos del código que condicionan el diseño

- `src/app/(dashboard)/events/layout.tsx` exige `events.inventory.read` para **todo** `/events/*`. Con el nuevo módulo debe aceptar cualquiera de los permisos del rol (inventario o programación), y la navegación (`shell.tsx`) debe mostrar cada entrada solo si hay permiso.
- El rol `events` entra hoy a `/events/inventory` (`auth.ts`, `login/page.tsx`, `access-pending/page.tsx`). La pantalla inicial pasa a ser el calendario (§7).
- `sede_enum` solo conoce Prebo y Mañongo. Las tiendas de Eventos son las **siete** de `inventario_sedes` (catálogo que puede crecer), la misma que usa el inventario.
- Las acciones de efemérides y campañas usan la service role (`getSupabaseAdmin`) y algunas tablas auxiliares (por ejemplo `campana_efemerides`) tienen una política "permitir todo a autenticados". El inventario usa el cliente autenticado con RPC `SECURITY DEFINER`; **este módulo debe seguir el patrón del inventario**, no el de campañas.
- `GridView.tsx` tiene 1358 líneas. No se debe copiar: el calendario de Eventos se arma con componentes pequeños (cabecera, cuadrícula, celda, tarjeta, ficha) como los del inventario.
- Grid calcula fechas en la hora del navegador. Un evento depende de la hora, así que todo se guarda y se muestra en **America/Caracas** (como `formatStamp` en `src/lib/inventory.ts`).
- Ya existe el tipo de campaña `EVENTO` (`tipo_campana_enum`). El evento puede enlazarse a una campaña (§10).

## 3. Datos del evento

Los grupos marcados **(pedido)** salen de §2.1; el resto es propuesta.

### 3.1 Identificación

| Campo | Tipo | Regla |
|---|---|---|
| Nombre | texto, hasta 160 | Obligatorio. |
| Descripción / objetivo | texto largo, hasta 2000 | Opcional. |
| Responsable | usuario (perfil) | Obligatorio para pasar a Programado. Por defecto, quien crea. |

### 3.2 Clasificación (pedido)

| Campo | Valores | Regla |
|---|---|---|
| Tipo | `DEGUSTACION`, `IMPULSO`, `OTRO` | Obligatorio. Si es `OTRO`, se pide `tipo_otro` (texto corto). |
| Origen | `PROPIO` (de Kromi), `PROVEEDOR` | Obligatorio. Si es `PROVEEDOR`, se pide el nombre del proveedor. |
| Patrocinio | Sí / No | Se deriva de la lista de patrocinadores (§3.5); no es un campo suelto. |
| Inscripción | Sí / No | Ver §3.4. |

### 3.3 Cuándo y dónde (pedido)

| Campo | Tipo | Regla |
|---|---|---|
| Tiendas | una o varias de `inventario_sedes` (tabla `evento_sedes`) | Al menos una. Opción "Todas las tiendas" en el formulario. |
| Zona dentro de la tienda | texto corto, **por tienda** | Opcional (ej. "Pasillo central", "Entrada"). Texto libre, no el catálogo de ubicaciones del inventario. |
| Inicio | fecha y hora, America/Caracas | Obligatorio para programar. |
| Duración | minutos (la interfaz permite horas y minutos) | Obligatoria para programar, mayor que 0. |
| Fin | fecha y hora | Se guarda `inicio` y `fin`; la duración se calcula (`fin − inicio`). Si el evento cruza medianoche o dura varios días, `fin` cae en otro día. |

El horario es **único para todas las tiendas** del evento. Si una tienda tuviera horario distinto, se crea otro evento (observación a revisar con el uso).

Se guardan `inicio` y `fin` y no una columna generada: sumar un intervalo a un `timestamptz` no es inmutable en PostgreSQL y no se puede usar en una columna generada.

### 3.4 Inscripción

| Campo | Tipo | Regla |
|---|---|---|
| Requiere inscripción | sí/no | Por defecto no. |
| Cupo | entero ≥ 1 | Solo si requiere inscripción; opcional. |
| Fecha límite de inscripción | fecha y hora | Opcional; no puede ser posterior al inicio. |
| Cómo inscribirse | texto (enlace o instrucciones) | Opcional. |

En la primera versión la app **no gestiona inscritos**: solo documenta cómo se inscriben. Registrar personas inscritas queda fuera de la primera entrega (D5, §13).

### 3.5 Patrocinio

Un evento puede tener varios patrocinadores (tabla `evento_patrocinadores`):

| Campo | Regla |
|---|---|
| Nombre del patrocinador | Obligatorio. |
| Tipo de aporte | `DINERO`, `ESPECIE`, `OTRO`. |
| Monto | Opcional; en la misma moneda del evento. |
| Detalle | Texto corto (qué aporta). |

"Con patrocinio" es verdadero si hay al menos una fila.

### 3.6 Presupuesto (pedido)

| Campo | Regla |
|---|---|
| Presupuesto estimado | Decimal ≥ 0, 2 decimales. Opcional al planificar; recomendado antes de Programado. |
| Moneda | Una por evento. `USD` o `VES`, por defecto `USD` (D4, por confirmar). |
| Gasto real | Se captura al cerrar (§4). Opcional. |

El desglose por rubros queda para una fase posterior.

### 3.7 Material necesario (pedido)

Lista de materiales por evento (`evento_materiales`):

| Campo | Regla |
|---|---|
| Material | Texto obligatorio. |
| Cantidad y unidad | Decimal > 0 y texto corto. |
| Artículo del inventario | Opcional: enlaza con `inventario_articulos`. Ver §10. |
| Estado | `PENDIENTE` o `LISTO`. |
| Nota | Opcional. |

### 3.8 Cierre

Como el evento pasa a Terminado solo, el cierre se registra **después**, desde la ficha del evento terminado: asistentes reales (entero ≥ 0), gasto real y notas de cierre (qué funcionó, qué no). Todos opcionales. En un evento terminado esos tres campos son lo único editable. También se puede anotar `asistentes_esperados` al planificar.

### 3.9 Preparación (tareas)

Lista de tareas opcional (`evento_tareas`): texto, responsable, fecha límite, completada. Es el equivalente a `checklist_rodaje` y sirve para el indicador de preparación (§4.3). Se propone para la fase 2 (§11), no para la primera entrega.

## 4. Estados

### 4.1 Valores

| Código | Etiqueta | Cómo se llega |
|---|---|---|
| `EN_PLANIFICACION` | En planificación | Al crear. Borrador de trabajo; puede tener datos incompletos. |
| `PROGRAMADO` | Programado | Una persona lo programa (§4.2). |
| `EN_CURSO` | En curso | **Automático** al llegar `inicio`. |
| `TERMINADO` | Terminado | **Automático** al llegar `fin`. Estado final. |
| `CANCELADO` | Cancelado | Una persona, con motivo. **Propuesta, no figura en el pedido**, pero hace falta para eventos que no ocurren. |

### 4.2 Transiciones

| Desde | Hacia | Quién | Condiciones |
|---|---|---|---|
| (nuevo) | En planificación | Persona | Nombre, tipo, origen y al menos una tienda. La fecha puede quedar vacía. |
| En planificación | Programado | Persona | Inicio y fin en el futuro, al menos una tienda, responsable, tipo y origen completos; proveedor si el origen es proveedor; si hay inscripción, la fecha límite no supera el inicio. Aviso si hay cruce en alguna tienda (§5). |
| Programado | En planificación | Persona | Motivo obligatorio. |
| Programado | En curso | **Sistema** | `ahora ≥ inicio`. |
| En curso | Terminado | **Sistema** | `ahora ≥ fin`. |
| En planificación, Programado, En curso | Cancelado | Persona | Motivo obligatorio. |
| Cancelado | En planificación | Persona | Motivo obligatorio (corregir una cancelación errónea). |
| En curso | Terminado | Persona ("Terminar ahora") | Para eventos que acaban antes de lo previsto; el `fin` no cambia. |
| Terminado | — | — | Final. Solo se editan los datos de cierre. |

Un evento **en planificación nunca avanza solo**, aunque su fecha ya haya pasado: aparece como "Fecha vencida" (§4.3) hasta que alguien lo programe, lo reprograme o lo cancele.

### 4.3 Cómo se aplican los cambios automáticos

El estado automático debe ser correcto aunque no corra ninguna tarea programada. Por eso:

1. `sync_event_statuses()` es una función idempotente que pasa a En curso los Programados con `inicio ≤ now()` y a Terminado los En curso (y los Programados ya vencidos) con `fin ≤ now()`, y escribe una fila en `evento_historial` con actor "Sistema".
2. **Toda lectura** (`list_events`, `get_event`) la ejecuta primero. Así quien abre el calendario siempre ve el estado correcto, sin depender de un cron.
3. Opcional: una ruta `/api/cron/sync-eventos`, protegida con `CRON_SECRET` como `/api/cron/purge-publicaciones`, llama a la misma función para dejar el historial al día aunque nadie abra la app. `vercel.json` hoy solo tiene un cron diario; una frecuencia mayor depende del plan de Vercel y no está verificada. Es opcional porque el punto 2 ya garantiza la corrección.
4. Cada cambio automático incrementa `version`. Si alguien tenía el evento abierto para editarlo, verá el aviso de conflicto y cargará la versión actual.

### 4.4 Indicadores derivados (no se guardan)

| Indicador | Condición |
|---|---|
| Próximo | Programado que empieza en las próximas 48 h. |
| Fecha vencida | En planificación con `inicio` ya pasado. |
| Incompleto | En planificación a menos de 7 días del inicio y sin responsable, presupuesto o materiales. (Umbral por confirmar.) |
| Materiales pendientes | Hay materiales en `PENDIENTE` y el evento empieza en menos de 3 días. (Umbral por confirmar.) |
| Cierre pendiente | Terminado sin asistentes reales, gasto real ni notas. |

## 5. Reglas de negocio

1. **Cruce de eventos:** dos eventos que comparten **al menos una tienda** con horarios solapados disparan el aviso `POSIBLE_CRUCE`, que indica en qué tiendas ocurre. Es una advertencia con "Continuar de todos modos", no un bloqueo (mismo patrón que `POSIBLE_DUPLICADO` en el inventario). Los cancelados y terminados no cuentan.
2. **Reprogramar** un evento Programado o En curso (cambiar inicio, fin o tiendas) exige un motivo y queda en el historial. En planificación se cambia sin motivo. En un evento En curso solo se puede ampliar el `fin`; acortarlo se hace con "Terminar ahora". Un evento terminado no se reprograma.
3. **Cancelar** y **volver a planificación** exigen motivo.
4. **Programar** exige que el evento sea futuro. Para registrar un evento que ya ocurrió y no se planificó, queda como observación a revisar con el uso (§13).
5. **Conflicto de edición:** como en el inventario, cada cambio comprueba `version`; si otra persona (o el sistema) modificó el evento, la interfaz ofrece cargar la versión actual.
6. **Archivar:** solo eventos Terminados o Cancelados. Se ocultan del calendario y se ven en el archivo; no se borran.
7. **Presupuesto y patrocinio** se capturan en la moneda del evento; no hay conversión automática.
8. **Quitar una tienda** de un evento Programado o En curso se trata como reprogramación (motivo obligatorio). El evento no puede quedar sin tiendas.

## 6. Modelo de datos propuesto

Migración propuesta: `202610150001_events_schedule.sql` (nombre provisional). Escritura solo por RPC `SECURITY DEFINER` con `search_path=''`; RLS de solo lectura; sin grants de escritura a `anon` ni `authenticated`, igual que el inventario.

| Tabla | Contenido |
|---|---|
| `eventos` | §3.1, §3.2, §3.3 (horario), §3.4, §3.6 y §3.8: `nombre`, `descripcion`, `tipo`, `tipo_otro`, `origen`, `proveedor_nombre`, `inicio`, `fin`, `estatus`, `responsable_id`, `campana_id` (opcional), `presupuesto_estimado`, `moneda`, `gasto_real`, `requiere_inscripcion`, `inscripcion_cupo`, `inscripcion_limite`, `inscripcion_info`, `asistentes_esperados`, `asistentes_reales`, `notas_cierre`, `version`, `creado_en/por`, `modificado_en/por`, `archivado_en`. |
| `evento_sedes` | `evento_id`, `sede_id` (FK a `inventario_sedes`), `zona`. Clave primaria `(evento_id, sede_id)`; al menos una fila por evento, validado en las RPC. |
| `evento_patrocinadores` | §3.5. |
| `evento_materiales` | §3.7, con `articulo_id` opcional. |
| `evento_tareas` | §3.9 (fase posterior). |
| `evento_historial` | Una fila por cambio de estado o reprogramación: `evento_id`, `tipo` (`ESTATUS` o `REPROGRAMACION`), valores anterior y nuevo, `motivo`, `cambiado_por` (nulo = Sistema), `cambiado_en`. Inmutable por trigger, como `inventario_movimientos`. |

Restricciones principales (`CHECK`): `fin > inicio` cuando ambos existen; estados válidos; `tipo_otro` solo con `OTRO`; `proveedor_nombre` obligatorio si `origen = 'PROVEEDOR'`; cupo e inscripción solo con `requiere_inscripcion`; montos ≥ 0. Las reglas de completitud para Programado se validan en la RPC, no en `CHECK`, porque el borrador puede estar incompleto. Si `estatus` es distinto de `EN_PLANIFICACION`, `inicio` y `fin` no pueden ser nulos.

Índices: `(estatus, inicio)`, `(estatus, fin)` para la sincronización, `(responsable_id)` y `evento_sedes (sede_id, evento_id)`. El aviso de cruce compara rangos `tstzrange(inicio, fin)` entre eventos que comparten tienda.

Catálogos: tipo, origen y estado son texto con `CHECK` (no `ENUM` de PostgreSQL) para poder ampliarlos con una migración sin recrear tipos. Se confirma contra la convención del repo en la fase 0.

## 7. Permisos

Nombres propuestos, siguiendo `social-media.campaigns.*` y `events.inventory.*`:

| Código | Rol `events` | Uso |
|---|---|---|
| `events.schedule.read` | Sí | Ver calendario, listado, ficha e historial. |
| `events.schedule.create` | Sí | Crear eventos. |
| `events.schedule.update` | Sí | Editar datos, materiales, patrocinadores, reprogramar y registrar el cierre. |
| `events.schedule.status.update` | Sí | Programar, volver a planificación, cancelar y "Terminar ahora". |
| `events.schedule.archive` | Sí | Archivar y restaurar. |

**Ningún otro rol recibe estos permisos por ahora** (decisión del 2026-10-15). RLS solo permite SELECT a quien tenga `events.schedule.read`; Social Media, Gerencia y los demás no ven eventos. El presupuesto y el gasto se muestran a todo el que tenga `read`.

**Integración con el perfil:** `events/layout.tsx` hoy exige `events.inventory.read`. Debe aceptar **cualquiera** de los permisos del rol y `shell.tsx` debe mostrar cada entrada del menú solo si hay permiso. Cada página sigue comprobando su propio permiso. La pantalla inicial del rol pasa a `/events/calendar` si tiene `events.schedule.read`, y a `/events/inventory` si solo tiene inventario (`auth.ts`, `login/page.tsx`, `access-pending/page.tsx`).

## 8. Funciones (acciones de servidor y RPC)

Todas comprueban el permiso con `authorizeAction`, validan en el servidor, llaman a una RPC y hacen `revalidatePath`. La validación se repite en `src/lib/events.ts` para dar respuesta rápida; la SQL es la autoridad.

| Función | Acción de servidor | Hace |
|---|---|---|
| `sync_event_statuses()` | (interna) | Aplica los cambios automáticos de §4.3. No es ejecutable por `authenticated`; la llaman las RPC de lectura y la ruta de cron. |
| `list_events(p_desde, p_hasta, p_sede_id, p_estatus, p_tipo, p_origen, p_responsable_id, p_search, p_archivados, p_limit, p_offset)` | `getEventsAction` | Eventos que **intersectan** el rango (calendario) o listado paginado. `p_sede_id` coincide con cualquiera de las tiendas del evento. |
| `get_event(p_evento_id)` | `getEventAction` | Ficha completa con tiendas, patrocinadores, materiales e indicadores. |
| `get_event_history(p_evento_id)` | `getEventHistoryAction` | Historial. |
| `create_event(...)` | `createEventAction` | Crea en planificación; devuelve aviso de cruce si aplica. |
| `update_event(p_evento_id, p_expected_version, ...)` | `updateEventAction` | Edita datos y tiendas; si está Programado o En curso y cambia fecha o tiendas, exige motivo. |
| `reschedule_event(p_evento_id, p_expected_version, p_inicio, p_fin, p_motivo)` | `rescheduleEventAction` | Mover desde el calendario (arrastre) o desde la ficha. |
| `transition_event_status(p_evento_id, p_expected_version, p_estatus, p_motivo)` | `transitionEventStatusAction` | Transiciones manuales de §4.2. |
| `save_event_closure(p_evento_id, p_expected_version, ...)` | `saveEventClosureAction` | Asistentes reales, gasto real y notas de un evento terminado. |
| `save_event_sponsors(...)`, `save_event_materials(...)` | `saveEventSponsorsAction`, `saveEventMaterialsAction` | Reemplazan la lista, con comprobación de versión. |
| `archive_event` / `restore_event` | `archiveEventAction`, `restoreEventAction` | Archivo. |

Errores con código estable para la interfaz: `POSIBLE_CRUCE`, `CONFLICTO_VERSION`, `FALTAN_DATOS` (con la lista de campos que faltan para programar).

## 9. Vistas cliente (propuesta de UI)

La propuesta visual está en el lienzo de diseño "Eventos · Programación". Hereda el lenguaje de social-media (paleta de marca, calendario por celdas, paneles laterales) y del inventario (paneles, filtros en la URL, estados vacío/error/carga/conflicto).

| Vista | Ruta | Contenido |
|---|---|---|
| Calendario mensual | `/events/calendar` | Cuadrícula por semanas desde el lunes. Cada evento es una barra con hora, nombre y estado; los de varios días se ven continuos. Filtros por tienda, estado, tipo y origen; "Hoy"; alta rápida desde un día; arrastre para mover (con motivo si ya está Programado). Los cambios automáticos de estado se reflejan al abrir. |
| Calendario semanal | `/events/calendar?vista=semana` | Eje horario de 7 días; la altura del bloque es la duración. Es la diferencia clave con Grid. |
| Listado | `/events/list` | Tabla y tarjetas móviles con búsqueda, filtros, orden y paginación en la URL. |
| Ficha del evento | Panel lateral | Estado y acciones, horario y tiendas, clasificación, presupuesto, materiales, patrocinio, inscripción, historial y cierre. |
| Formulario | Panel lateral | Crear y editar; selector múltiple de tiendas con "Todas"; avisos de cruce y de conflicto. |
| Archivo | `/events/archive` | Eventos archivados; restaurar. |
| Estados de la interfaz | Todas | Vacío, sin resultados, error con reintento, carga, conflicto y móvil. |

**Diferencias con el calendario de social-media:** la hora y la duración son esenciales (vista semanal con eje horario, que Grid no tiene); un evento abarca varios días y varias tiendas; la tienda es una dimensión principal de filtro; el estado tiene cinco valores y cambia solo con la hora; no hay cuentas ni formatos; el cruce de horarios por tienda es una regla visible.

## 10. Relación con otros módulos

| Módulo | Relación propuesta |
|---|---|
| Inventario | `evento_materiales.articulo_id` apunta a un artículo existente para que Eventos vea qué hay y dónde. **No reserva ni descuenta stock** en esta fase; las salidas siguen registrándose como movimientos del inventario. Reservas y movimiento automático al iniciar o terminar el evento son una fase posterior (D9). |
| Campañas | `campana_id` opcional hacia una campaña (por ejemplo de tipo `EVENTO`). Social Media ya ve campañas en su calendario; hoy los eventos no se muestran en social-media (D6): solo el rol `events` los ve. |
| Social Media | Hoy no hay relación. Por decisión (D6) Social Media no ve eventos. Una capa de solo lectura en Grid o pedir publicaciones promocionales desde un evento serían mejoras futuras, según observaciones. |
| Terceros | Proveedor y patrocinador son texto libre en la primera versión; enlazar con el directorio `terceros` es una mejora posterior. |

## 11. Fases

La primera entrega es la **implementación básica**: fases 0 a 3. Las fases 4 y 5 se priorizan con las observaciones de las personas usuarias.

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Verificar en remoto: `inventario_sedes` con las siete tiendas, permisos y RPC del inventario, convención de enums/CHECK. Confirmar la moneda (D4). | Respuestas del equipo |
| 1 | Migración: tablas, restricciones, permisos `events.schedule.*`, RLS de lectura, RPC, sincronización de estados e historial inmutable. Pruebas SQL locales con PostgreSQL, incluida la sincronización por hora y el cruce entre tiendas. | Fase 0 |
| 2 | Tipos, `src/lib/events.ts` (validadores, formato en America/Caracas, consulta en URL), acciones de servidor y pruebas unitarias. | Fase 1 |
| 3 | Vistas: calendario mensual y semanal, listado, ficha, formulario con varias tiendas y cierre. Ajuste de `layout.tsx`, `shell.tsx` y redirección por rol. | Fase 2 y propuesta de UI |
| 4 | Materiales con enlace a inventario, patrocinadores, indicadores y archivo. | Fase 3 |
| 5 | Ruta de cron opcional, tareas de preparación, capas de campañas/efemérides en el calendario y lo que surja de las observaciones. | Uso real |
| 6 | Documentación (SRS §7, perfiles, esquema), aplicar en remoto y `supabase db pull`. | Todas |

Hasta que las migraciones se apliquen y verifiquen en Supabase remoto, el módulo no se considera disponible.

## 12. Decisiones

### 12.1 Confirmadas (2026-10-15)

| # | Decisión |
|---|---|
| D1 | Un evento puede ocurrir en **varias tiendas** a la vez (`evento_sedes`). |
| D3 | "En curso" y "Terminado" **cambian solos por la hora** (§4.3). |
| D6/D7 | Solo el rol `events` ve y gestiona eventos, incluido el presupuesto. |
| D12 | El módulo es parte del perfil `events`; implementación básica que escala con las observaciones. |

### 12.2 Adoptadas por defecto (revisables con el uso)

| # | Tema | Valor adoptado |
|---|---|---|
| D2 | Borrador sin fecha | Permitido en planificación; no aparece en el calendario, sí en el listado. |
| D5 | Inscritos | La app solo describe cómo inscribirse (enlace o instrucciones, cupo, fecha límite); no registra personas. |
| D8 | Pantalla inicial del rol | Calendario. |
| D9 | Materiales | Enlace informativo al inventario; sin reserva ni descuento. |
| D10 | Tareas de preparación | Fase posterior. |
| D11 | Estado `CANCELADO` | Se incluye. |

### 12.3 Por confirmar

| # | Pregunta | Por defecto |
|---|---|---|
| D4 | Moneda del presupuesto: ¿USD, VES o ambas? | Una moneda por evento, `USD` o `VES`; por defecto `USD`. |
| D13 | Umbrales de los indicadores "Incompleto" (7 días) y "Materiales pendientes" (3 días). | Los indicados en §4.4. |
| D14 | ¿Frecuencia del cron opcional, según el plan de Vercel? | Sin cron en la primera entrega. |

## 13. Fuera de alcance

Registrar un evento ya ocurrido que no se planificó, horarios distintos por tienda dentro de un mismo evento, gestión de inscritos y asistencia por persona, desglose del presupuesto por rubros, aprobaciones de presupuesto por Gerencia, reservas de inventario, notificaciones y recordatorios, eventos recurrentes, exportación a calendarios externos (Google, iCal), fotos y adjuntos, y reportes comparativos entre eventos.
