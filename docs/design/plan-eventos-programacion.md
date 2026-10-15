# Perfil Eventos: programación y planificación de eventos

**Estado (2026-10-15):** especificación previa al diseño de UI. **No hay código ni migración todavía.** Lo que pidió el equipo está en §2.1; todo lo demás es propuesta y está marcado como tal. Las decisiones que cambian el modelo están en §12.
**Alcance:** rol `events`, nuevo módulo de programación junto al [inventario](./plan-inventario-eventos.md): calendario, listado, ficha del evento, estados, materiales, patrocinio y presupuesto.
**Documentos relacionados:** [`plan-inventario-eventos.md`](./plan-inventario-eventos.md), [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`supabase-db-migration.md`](../supabase-db-migration.md).

## 1. Resultado esperado

1. Eventos planifica cada evento con fecha, hora, duración, tienda, presupuesto, materiales y demás datos de la §3, y lo hace avanzar por los estados **En planificación → Programado → En curso → Terminado**.
2. Ve todos sus eventos en un **calendario** (mensual y semanal) y en un **listado** filtrable. El calendario es la orientación gráfica; el listado sirve para buscar y ordenar.
3. Cada cambio de estado y cada reprogramación quedan con usuario, fecha y motivo.
4. Al cerrar un evento registra asistencia, gasto real y notas, para que el siguiente se planifique con datos.
5. Los materiales necesarios pueden apuntar a artículos del inventario ya existente, sin descontarlos (§10).

## 2. Punto de partida

### 2.1 Pedido del equipo (2026-10-14)

| Tema | Detalle |
|---|---|
| Datos del evento | Fecha, hora, duración, tienda, presupuesto, material necesario "etc." |
| Clasificación | Con patrocinio o sin él; degustación, impulso u otro; propio de Kromi o de un proveedor; con inscripción o sin ella. |
| Estados | En planificación, Programado, En curso, Terminado. |
| Calendario | Orientación gráfica de los eventos; diseño parecido al de social-media, con diferencias propias del rol. |
| Orden de trabajo | Primero desarrollar el perfil (este documento); después el diseño de la UI. |

### 2.2 Qué se reutiliza de social-media (verificado en el repo)

| Patrón | Dónde está hoy | Adaptación para Eventos |
|---|---|---|
| Calendario mensual con celdas por día, "hoy" resaltado y alta rápida por día | `social-media/grid/components/GridCalendar.tsx`, `GridCell.tsx`; `utils/date.ts` (`generateCalendarDays`, semana desde lunes) | Reutilizar la generación de días. La celda debe pintar **eventos con hora y que cruzan varios días**, algo que Grid no hace (una publicación ocupa un solo día). |
| Mover por arrastre (cambia la fecha) | `hooks/useDragDrop.ts` | Mover un evento a otro día conserva hora y duración. Si ya está Programado, pide motivo (§5). |
| Detalle en panel/modal con acciones de estado | `TicketDetailCard.tsx`, `StatusSelect.tsx`, `TicketEditModal.tsx` | Ficha del evento en panel lateral, como los paneles del inventario. |
| Estados con una etiqueta y una familia de color | `grid/utils/constants.ts` (`ESTATUS_STYLE`: gris pendiente, azul en proceso, naranja atención, verde terminado) | Misma lógica semántica; los colores concretos se fijan en el diseño. |
| Historial de cambios de estado con motivo | Tabla `publicacion_estatus_historial`, RPC `transition_publicacion_status` | Tabla `evento_historial` y RPC equivalente. |
| Indicador derivado de plazo | `grid/utils/sla.ts` (`calcularSlaState`) | Indicadores derivados de preparación y atraso (§4.3). |
| Capas de contexto en el calendario | Efemérides y campañas en `GridCell` | Opcional para Eventos (§12, D6). |
| Archivar en lugar de borrar | Archivo de publicaciones y campañas | `archivado_en` y vista de archivados. |
| Control de versión y conflicto | Inventario (`version`, `CONFLICTO_VERSION`) | Igual en `eventos`. |

### 2.3 Hallazgos del código que condicionan el diseño

- `src/app/(dashboard)/events/layout.tsx` exige `events.inventory.read` para **todo** `/events/*`. Con el nuevo módulo debe aceptar cualquiera de los permisos del rol (inventario o programación), y la navegación (`shell.tsx`) debe mostrar cada entrada solo si hay permiso.
- El rol `events` entra hoy a `/events/inventory` (`auth.ts`, `login/page.tsx`, `access-pending/page.tsx`). La pantalla inicial pasa a ser el calendario (§12, D8).
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
| Tienda | una tienda de `inventario_sedes` | Obligatorio. Ver D1 sobre eventos en varias tiendas. |
| Zona dentro de la tienda | texto corto | Opcional (ej. "Pasillo central", "Entrada"). Texto libre, no el catálogo de ubicaciones del inventario. |
| Inicio | fecha y hora, America/Caracas | Obligatorio. |
| Duración | minutos (la interfaz permite horas y minutos) | Obligatoria, mayor que 0. |
| Fin | fecha y hora | Se guarda `inicio` y `fin`; la duración se calcula (`fin − inicio`). Si el evento cruza medianoche o dura varios días, `fin` cae en otro día. |

Se guardan `inicio` y `fin` y no una columna generada: sumar un intervalo a un `timestamptz` no es inmutable en PostgreSQL y no se puede usar en una columna generada.

### 3.4 Inscripción

| Campo | Tipo | Regla |
|---|---|---|
| Requiere inscripción | sí/no | Por defecto no. |
| Cupo | entero ≥ 1 | Solo si requiere inscripción; opcional. |
| Fecha límite de inscripción | fecha y hora | Opcional; no puede ser posterior al inicio. |
| Cómo inscribirse | texto (enlace o instrucciones) | Opcional. |

En la primera versión la app **no gestiona inscritos**: solo documenta cómo se inscriben. Registrar personas inscritas es otra decisión (D5).

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
| Moneda | Una por evento. Valores y por defecto en D4. |
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

Se registran al pasar a Terminado: asistentes reales (entero ≥ 0), gasto real, notas de cierre (qué funcionó, qué no). Todos opcionales. También se puede anotar `asistentes_esperados` al planificar.

### 3.9 Preparación (tareas)

Lista de tareas opcional (`evento_tareas`): texto, responsable, fecha límite, completada. Es el equivalente a `checklist_rodaje` y sirve para el indicador de preparación (§4.3). Se propone para la fase 2 (§11), no para la primera entrega.

## 4. Estados

### 4.1 Valores

| Código | Etiqueta | Significado |
|---|---|---|
| `EN_PLANIFICACION` | En planificación | Borrador de trabajo. Puede tener datos incompletos. |
| `PROGRAMADO` | Programado | Fecha, lugar y responsable confirmados. |
| `EN_CURSO` | En curso | Está ocurriendo. |
| `TERMINADO` | Terminado | Ocurrió. Solo se editan los datos de cierre. |
| `CANCELADO` | Cancelado | **Propuesta, no figura en el pedido**, pero hace falta para eventos que no ocurren. Exige motivo. |

### 4.2 Transiciones

| Desde | Hacia | Condiciones |
|---|---|---|
| (nuevo) | En planificación | Nombre, tipo, origen y tienda. Fecha y duración pueden quedar vacías mientras sea borrador (D2). |
| En planificación | Programado | Inicio, fin, tienda, responsable, tipo y origen completos; proveedor si el origen es proveedor; si hay inscripción, la fecha límite no supera el inicio. Aviso si hay cruce con otro evento (§5). |
| Programado | En planificación | Motivo obligatorio. |
| Programado | En curso | Cualquier momento; si es antes del inicio, la interfaz pide confirmar. |
| En curso | Terminado | Abre el formulario de cierre (opcional). |
| En planificación, Programado, En curso | Cancelado | Motivo obligatorio. |
| Cancelado | En planificación | Motivo obligatorio (corregir una cancelación errónea). |
| Terminado | — | Estado final. |

Las transiciones son **manuales** en la primera versión; ver D3 para cambios automáticos por hora.

### 4.3 Indicadores derivados (no se guardan)

Como el indicador SLA de Grid, se calculan al leer, con la hora de Caracas:

| Indicador | Condición |
|---|---|
| Debió iniciar | Programado y ya pasó `inicio`. |
| Debió terminar | En curso y ya pasó `fin`. |
| Próximo | Programado que empieza en las próximas 48 h. |
| Incompleto | En planificación a menos de 7 días del inicio y sin alguno de: responsable, presupuesto, materiales. (Umbral por confirmar.) |
| Materiales pendientes | Hay materiales en `PENDIENTE` y el evento empieza en menos de 3 días. (Umbral por confirmar.) |

## 5. Reglas de negocio

1. **Cruce de eventos:** dos eventos de la misma tienda con horarios solapados disparan el aviso `POSIBLE_CRUCE` al crear, mover o programar. Es una advertencia con "Continuar de todos modos", no un bloqueo (mismo patrón que `POSIBLE_DUPLICADO` en el inventario). Los cancelados no cuentan.
2. **Reprogramar un evento Programado** (cambiar inicio, fin o tienda) exige un motivo y queda en el historial. En planificación se cambia sin motivo. Un evento en curso o terminado no se reprograma.
3. **Cancelar** y **volver a planificación** exigen motivo.
4. **Fechas pasadas:** se puede crear un evento con inicio pasado solo en estado Terminado o En curso (registro retroactivo); Programado exige inicio futuro.
5. **Conflicto de edición:** como en el inventario, cada cambio comprueba `version`; si otra persona modificó el evento, la interfaz ofrece cargar la versión actual.
6. **Archivar:** solo eventos Terminados o Cancelados. Se ocultan del calendario y se ven en el archivo; no se borran.
7. **Presupuesto y patrocinio** se capturan en la moneda del evento; no hay conversión automática.

## 6. Modelo de datos propuesto

Migración propuesta: `202610150001_events_schedule.sql` (nombre provisional). Escritura solo por RPC `SECURITY DEFINER` con `search_path=''`; RLS de solo lectura; sin grants de escritura a `anon` ni `authenticated`, igual que el inventario.

| Tabla | Contenido |
|---|---|
| `eventos` | Los campos de §3.1 a §3.4, §3.6 y §3.8: `nombre`, `descripcion`, `tipo`, `tipo_otro`, `origen`, `proveedor_nombre`, `sede_id` (FK a `inventario_sedes`), `zona`, `inicio`, `fin`, `estatus`, `responsable_id`, `campana_id` (opcional), `presupuesto_estimado`, `moneda`, `gasto_real`, `requiere_inscripcion`, `inscripcion_cupo`, `inscripcion_limite`, `inscripcion_info`, `asistentes_esperados`, `asistentes_reales`, `notas_cierre`, `version`, `creado_en/por`, `modificado_en/por`, `archivado_en`. |
| `evento_patrocinadores` | §3.5. |
| `evento_materiales` | §3.7, con `articulo_id` opcional. |
| `evento_tareas` | §3.9 (fase 2). |
| `evento_historial` | Una fila por cambio de estado o reprogramación: `evento_id`, `tipo` (`ESTATUS` o `REPROGRAMACION`), valores anterior y nuevo, `motivo`, `cambiado_por`, `cambiado_en`. Inmutable por trigger, como `inventario_movimientos`. |

Restricciones principales (`CHECK`): `fin > inicio` cuando ambos existen; estados válidos; `tipo_otro` solo con `OTRO`; `proveedor_nombre` obligatorio si `origen = 'PROVEEDOR'`; cupo e inscripción solo con `requiere_inscripcion`; montos ≥ 0; las reglas de completitud de Programado se validan en la RPC, no en `CHECK`, porque el borrador puede estar incompleto.

Índices: `(sede_id, inicio)`, `(estatus, inicio)`, `(responsable_id)`; el aviso de cruce usa un rango `tstzrange(inicio, fin)` por tienda.

Catálogos: los valores de tipo, origen y estado son enumeraciones de texto con `CHECK` (no `ENUM` de PostgreSQL) para poder ampliarlos con una migración sin recrear tipos. Qué se prefiera en el repo se confirma en la fase 0.

## 7. Permisos

Nombres propuestos, siguiendo `social-media.campaigns.*` y `events.inventory.*`:

| Código | Rol `events` | Uso |
|---|---|---|
| `events.schedule.read` | Sí | Ver calendario, listado, ficha e historial. |
| `events.schedule.create` | Sí | Crear eventos. |
| `events.schedule.update` | Sí | Editar datos, materiales, patrocinadores y reprogramar. |
| `events.schedule.status.update` | Sí | Cambiar estado y registrar cierre. |
| `events.schedule.archive` | Sí | Archivar y restaurar. |

Otros roles: ninguno por defecto. Lectura para Social Media y Gerencia es la decisión D6. El presupuesto y el gasto se muestran a todo el que tenga `read` salvo que D7 indique lo contrario.

## 8. Funciones (acciones de servidor y RPC)

Todas comprueban el permiso con `authorizeAction`, validan en el servidor, llaman a una RPC y hacen `revalidatePath`. La validación se repite en `src/lib/events.ts` para dar respuesta rápida; la SQL es la autoridad.

| Función | Acción de servidor | Hace |
|---|---|---|
| `list_events(p_desde, p_hasta, p_sede_id, p_estatus, p_tipo, p_origen, p_responsable_id, p_search, p_archivados, p_limit, p_offset)` | `getEventsAction` | Eventos que **intersectan** el rango (para el calendario) o listado paginado. |
| `get_event(p_evento_id)` | `getEventAction` | Ficha completa con patrocinadores, materiales, tareas e indicadores. |
| `get_event_history(p_evento_id)` | `getEventHistoryAction` | Historial. |
| `create_event(...)` | `createEventAction` | Crea en planificación; devuelve aviso de cruce si aplica. |
| `update_event(p_evento_id, p_expected_version, ...)` | `updateEventAction` | Edita datos; si está Programado y cambia fecha o tienda, exige motivo. |
| `reschedule_event(p_evento_id, p_expected_version, p_inicio, p_fin, p_motivo)` | `rescheduleEventAction` | Mover desde el calendario (arrastre) o desde la ficha. |
| `transition_event_status(p_evento_id, p_expected_version, p_estatus, p_motivo, p_cierre)` | `transitionEventStatusAction` | Valida §4.2 y escribe el historial. |
| `save_event_sponsors(p_evento_id, p_expected_version, p_items)` | `saveEventSponsorsAction` | Reemplaza la lista de patrocinadores. |
| `save_event_materials(p_evento_id, p_expected_version, p_items)` | `saveEventMaterialsAction` | Reemplaza la lista de materiales. |
| `archive_event` / `restore_event` | `archiveEventAction`, `restoreEventAction` | Archivo. |

Errores con código estable para la interfaz: `POSIBLE_CRUCE`, `CONFLICTO_VERSION`, `FALTAN_DATOS` (con la lista de campos que faltan para programar).

## 9. Vistas (qué debe resolver el diseño)

La interfaz se diseña después de esta especificación. Lo que cada vista necesita:

| Vista | Ruta propuesta | Contenido |
|---|---|---|
| Calendario | `/events/calendar` | Mes y semana. Navegación por mes, "Hoy", filtros por tienda, estado, tipo y origen. Evento con hora, tienda, estado e indicador. Eventos de varios días se ven continuos. Crear desde un día o una franja. Mover por arrastre con motivo cuando ya está Programado. |
| Listado | `/events/list` | Tabla/tarjetas con búsqueda, filtros, orden y paginación en la URL, como el inventario. |
| Ficha del evento | Panel lateral desde cualquier vista | Datos, estado con acciones, materiales, patrocinio, presupuesto, historial. |
| Formulario | Panel lateral | Crear y editar, con avisos de cruce y de conflicto. |
| Cierre | Paso al terminar | Asistentes reales, gasto real, notas. |
| Archivo | `/events/archive` | Eventos archivados y restaurar. |

**Diferencias con el calendario de social-media:** la hora y la duración son parte esencial (vista semanal con eje horario, que Grid no tiene); un evento puede abarcar varios días; la tienda es una dimensión principal de filtro y color (siete tiendas); el estado tiene cinco valores propios; no hay cuentas ni formatos; el cruce de horarios por tienda es una regla visible.

## 10. Relación con otros módulos

| Módulo | Relación propuesta |
|---|---|
| Inventario | `evento_materiales.articulo_id` apunta a un artículo existente para que Eventos vea qué hay y dónde. **No reserva ni descuenta stock** en esta fase; las salidas siguen registrándose como movimientos del inventario. Reservas y movimiento automático al iniciar o terminar el evento son una fase posterior (D9). |
| Campañas | `campana_id` opcional hacia una campaña (por ejemplo de tipo `EVENTO`). Social Media ya ve campañas en su calendario; el enlace permite mostrar el evento ahí si se decide (D6). |
| Social Media | Hoy no hay relación. Opciones: capa de solo lectura de eventos en el Grid, o pedir publicaciones promocionales desde un evento. Fuera de la primera entrega (D6). |
| Terceros | Proveedor y patrocinador son texto libre en la primera versión; enlazar con el directorio `terceros` es una mejora posterior. |

## 11. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| 0 | Verificar en remoto: `inventario_sedes` con las siete tiendas, permisos y RPC del inventario, convención de enums/CHECK. Resolver D1–D4 y D8. | Respuestas del equipo |
| 1 | Migración: tablas, restricciones, permisos `events.schedule.*`, RLS de lectura, RPC e historial inmutable. Pruebas SQL locales con PostgreSQL. | Fase 0 |
| 2 | Tipos, `src/lib/events.ts` (validadores, formato en America/Caracas, consulta en URL), acciones de servidor y pruebas unitarias. | Fase 1 |
| 3 | Diseño de UI (siguiente entregable) y luego vistas: calendario, listado, ficha, formulario y cierre. Ajuste de `layout.tsx`, `shell.tsx` y redirección por rol. | Fase 2 y diseño |
| 4 | Materiales con enlace a inventario, patrocinadores, tareas de preparación e indicadores. | Fase 3 |
| 5 | Archivo, capas opcionales (campañas/efemérides), capa para Social Media si se aprueba. | Decisiones D6 |
| 6 | Documentación (SRS §7, perfiles, esquema), aplicar en remoto y `supabase db pull`. | Todas |

Hasta que las migraciones se apliquen y verifiquen en Supabase remoto, el módulo no se considera disponible.

## 12. Decisiones pendientes

Cada una tiene un valor por defecto con el que se puede avanzar; cambiarlo después de la fase 1 cuesta una migración.

| # | Pregunta | Por defecto propuesto |
|---|---|---|
| D1 | ¿Un evento puede ocurrir en **varias tiendas** a la vez (por ejemplo un aniversario de cadena)? | Una tienda por evento. Si hace falta, se usa una tabla `evento_sedes` desde el inicio; es más barato decidirlo ahora que migrar después. |
| D2 | ¿Se puede guardar un borrador **sin fecha**? | Sí en planificación; la fecha es obligatoria para Programado. Los borradores sin fecha no salen en el calendario, solo en el listado. |
| D3 | ¿"En curso" y "Terminado" cambian solos por la hora o los marca una persona? | Manual con avisos ("Debió iniciar"). El cambio automático requeriría una tarea programada en Supabase que hoy no está verificada. |
| D4 | Moneda del presupuesto: ¿USD, VES o ambas? | Una moneda por evento, elegible entre `USD` y `VES`; por defecto `USD`. Confirmar con el equipo. |
| D5 | ¿La app registra **personas inscritas** o solo describe cómo inscribirse? | Solo describir (enlace o instrucciones, cupo y fecha límite). |
| D6 | ¿Quién más ve los eventos: Social Media (para promoción), Gerencia? ¿Eventos ve efemérides y campañas en su calendario? | Solo Eventos ve eventos. Efemérides y campañas como capa opcional de solo lectura, después de la primera entrega. |
| D7 | ¿El presupuesto y el gasto son visibles para todos los usuarios de Eventos o solo para algunos? | Visibles para todo `events` con `read`. |
| D8 | ¿Cuál es la pantalla inicial del rol: calendario o inventario? | Calendario. |
| D9 | ¿Los materiales deben **reservar** o mover inventario? | No en esta fase; solo enlace informativo. |
| D10 | ¿Se necesitan tareas de preparación con responsable y fecha, o basta la lista de materiales? | Tareas en fase 4, no en la primera entrega. |
| D11 | ¿Se confirma `CANCELADO` como quinto estado? | Sí. |

## 13. Fuera de alcance

Gestión de inscritos y asistencia por persona, desglose del presupuesto por rubros, aprobaciones de presupuesto por Gerencia, reservas de inventario, notificaciones y recordatorios, eventos recurrentes, exportación a calendarios externos (Google, iCal), fotos y adjuntos, y reportes comparativos entre eventos.
