# Plan: módulo de solicitudes de Diseño (histórico y operativo)

**Estado (2026-10-26):** especificación implementada localmente en la rama de trabajo; las migraciones, UI y utilidades de importación aún requieren validación y despliegue. La migración base se reportó aplicada manualmente en producción; esta sesión no verificó la base remota ni ejecutó escrituras. Las decisiones confirmadas se marcan `[CONFIRMADA]`; las propuestas arquitectónicas pendientes siguen identificadas por separado.

Documentos relacionados: modelo de datos y seguridad en [`plan-datos-solicitudes-diseno.md`](./plan-datos-solicitudes-diseno.md), mapeo e importación en [`plan-importacion-solicitudes-diseno.md`](./plan-importacion-solicitudes-diseno.md), fases y pruebas en [`roadmap-solicitudes-diseno.md`](./roadmap-solicitudes-diseno.md).

## 0. Cómo leer este documento

Etiquetas de evidencia y de decisión usadas en los cuatro documentos:

| Etiqueta | Significado |
|---|---|
| `[REPO]` | Verificado en el código o en una migración de `main` (commit `22d2fb1` al auditar). |
| `[REPORTADO]` | El usuario indicó que se aplicó en Supabase. No hay consulta directa. |
| `[REMOTO]` | Evidencia directa y actual del proyecto remoto. **Ninguna afirmación de estos documentos tiene esta etiqueta**: la sesión de auditoría no tuvo acceso de lectura a Supabase. |
| `[ARCHIVO]` | Verificado directamente en el archivo Excel fuente presente en `docs/`. |
| `[PENDIENTE]` | No hay evidencia suficiente. |
| `[CONFIRMADA]` | Decisión funcional ya acordada con el usuario (viene del encargo, §7). |
| `[PROPUESTA]` | Diseño nuevo recomendado, no aprobado. |

La hoja histórica está disponible y fue inspeccionada en modo de solo lectura. Los conteos y metadatos verificados están en [`plan-importacion-solicitudes-diseno.md` §1](./plan-importacion-solicitudes-diseno.md#1-fuente); la interpretación funcional de formatos, identidad y zona horaria aún se valida en F3.

## 1. Problema y objetivos

Diseño recibe solicitudes de varias áreas y, hasta ahora, parte del registro vive en una hoja de cálculo (267 filas con título y marca temporal, según el archivo inspeccionado). Esa información no es consultable, no distingue entregables y mezcla campos categóricos con texto libre.

Objetivos:

1. Conservar el registro histórico con trazabilidad por fila y sin perder los valores originales.
2. Permitir gestionar solicitudes nuevas con varios entregables, responsable actual e historial auditable.
3. No obligar a que cada solicitud sea una publicación, un pendiente de tienda o un evento.
4. Integrarse con Diseño solo cuando haya una decisión funcional que lo justifique.

## 2. Alcance y exclusiones

**Incluido** `[CONFIRMADA]`: gestión estructurada de solicitudes; creación y mantenimiento manual desde la interfaz; importación histórica controlada que agrega registros y no reemplaza ni modifica solicitudes creadas manualmente; normalización con preservación del original; múltiples entregables; estados independientes (solicitud y entregable); historial; solicitante histórico y usuario vinculado opcional; responsable actual con auditoría de asignaciones; prioridad controlada; fechas históricas y objetivo; catálogos ampliables; detección de duplicados para revisión manual; registro de filas importadas, excluidas y rechazadas; referencia manual a publicaciones u otras entidades. El vínculo formal y la integración con la cola unificada de Diseño quedan fuera de la v1.

**Fuera de alcance inicial** `[CONFIRMADA]`: aprobaciones formales; conversión automática a publicaciones; WhatsApp; notificaciones y recordatorios; automatizaciones de seguimiento; cambios al flujo editorial de Social Media; reemplazo de las tablas de Interno o Eventos; reescritura de adaptadores de Diseño no necesaria; cambios en la hoja original; importación directa a producción sin validación previa.

**Riesgos fuera de alcance, para fases futuras** `[PROPUESTA]`: notificar por email al recibir solicitudes nuevas (hoy es una idea abierta en [`backlog-roadmap.md`](../backlog-roadmap.md), «Registro de solicitudes»); recibir solicitudes de otras áreas por un formulario propio en lugar de Google Forms (decisión «fuente de verdad» abierta en el mismo backlog, filas «Registro de solicitudes (Diseño)»).

## 3. Arquitectura recomendada (resumen)

**Entidad independiente + relaciones explícitas.** Una solicitud (`solicitudes_diseno`) con entregables 1:N, historial inmutable, catálogos funcionales y un registro de importación por lote y fila. Sin tabla física que sustituya a `publicaciones`, `pendientes_tienda` o `eventos`. La vinculación con esas entidades es una acción explícita mediante una tabla de vínculos. La integración con la cola de Diseño **no entra en el primer despliegue**.

Alternativas evaluadas (detalle en §13, D-01):

| Alternativa | Veredicto |
|---|---|
| Cargar todo en `publicaciones` | Descartada `[CONFIRMADA]`: su ciclo editorial, cuentas sociales y SLA no aplican; `estatus_enum` es editorial `[REPO]`. |
| Cargar todo en `pendientes_tienda` | Descartada `[CONFIRMADA]`: exige `sede_id` y `creado_por` `[REPO]`; el histórico no siempre tiene tienda. |
| Crear eventos artificiales | Descartada `[CONFIRMADA]`. |
| Reutilizar `solicitudes_terceros` | Descartada `[PROPUESTA]`: es el inbox de terceros que se convierte en publicación; `departamento_emisor` es `departamento_enum` de 5 valores `[REPO]` y su `estatus_solicitud` es texto libre con valores de convención (`RECHAZADO`, `CONVERTIDA`). Mezclar ciclos de vida rompería `processRequestAction`. |
| Una sola tabla de solicitud sin entregables | Descartada: no soporta finalización parcial ni formatos por pieza `[CONFIRMADA]`. |
| **Solicitud + entregables + historial + importación (elegida)** | Recomendada `[PROPUESTA]`: integridad referencial, auditoría compatible con el patrón existente, coste de mantenimiento moderado. |

```mermaid
flowchart LR
  XLS[(Hoja histórica)] -->|importador| IMP[Registro de importación<br/>lote + filas]
  IMP --> SOL[Solicitud]
  SOL --> ENT[Entregables 1:N]
  SOL --> HIS[Historial inmutable]
  SOL -.vínculo explícito.-> PUB[publicaciones]
  SOL -.vínculo explícito.-> EVT[eventos]
  SOL -.vínculo explícito.-> PEN[pendientes_tienda]
  SOL -. fase posterior, opcional .-> COLA[Cola unificada de Diseño]
  CAT[Catálogos funcionales] --> SOL
  CAT --> ENT
```

## 4. Actores y permisos funcionales

Los permisos concretos y la matriz completa están en [`plan-datos-solicitudes-diseno.md` §9](./plan-datos-solicitudes-diseno.md#9-matriz-de-permisos). A nivel funcional:

| Actor | Rol de acceso `[REPO]` | Necesidad funcional `[PROPUESTA]` |
|---|---|---|
| Diseño | `design` | Puede consultar, crear y gestionar solicitudes, entregables e historial; solo este rol asigna/reasigna responsables. |
| Usuarios autenticados | Otros roles vigentes de la aplicación | Lectura del registro y de los originales, incluido el correo del remitente; no adquieren permisos de escritura por ese acceso de lectura (D-08/D-14 confirmadas). |
| Gerencia, Atención al cliente | `management`, `customer-support` | Sin acceso; no tienen permisos de negocio definidos `[REPO]`. |
| Administrador | `admin` | **No** hereda acceso: el rol `admin` solo administra perfiles (`can_manage_access`) y no tiene permisos de negocio sembrados en las migraciones `[REPO]`. La importación la ejecuta un operador técnico designado mediante el proceso de servidor/CLI (D-09), no por el acceso general de `admin` en la UI. |

## 5. Entidades y relaciones conceptuales

| Concepto | Entidad propuesta | Notas |
|---|---|---|
| Solicitud | `solicitudes_diseno` | Requerimiento original; fecha objetivo general; estado operativo; responsable actual. |
| Entregable | `solicitud_diseno_entregables` | 1:N; estado y fecha objetivo propios; formato y medio; cantidades separadas del texto de alcance. |
| Historial | `solicitud_diseno_historial` | Mismo patrón que `evento_historial` y `pendiente_tienda_historial` (`tipo`, `anterior`, `nuevo`, `motivo`, actor, fecha). Incluye asignaciones. |
| Vínculo | `solicitud_diseno_vinculos` (diferida, D-21) | A `publicaciones`, `eventos` o `pendientes_tienda`; exactamente un destino por fila. En la v1 solo existe `referencia_manual` en la solicitud. |
| Catálogos | tablas `catalogo_*` | Tipos de solicitud, departamentos, áreas, medios y formatos. Estados y prioridad: texto con `CHECK` (D-04, D-05). |
| Importación | `solicitud_diseno_importaciones` y `…_importacion_filas` | Lote y fila con dato original y resultado. |

Cardinalidades, claves y restricciones en el documento de datos §3–§6. Nombres de tablas y columnas son propuestas; ninguno existe en el repositorio.

## 6. Campos y catálogos

El diccionario completo está en [`plan-datos-solicitudes-diseno.md` §3](./plan-datos-solicitudes-diseno.md#3-diccionario-de-datos). Reglas funcionales:

1. Toda columna categórica normalizada tiene su par `*_original` de texto que conserva lo que dijo la hoja `[CONFIRMADA]`.
2. Un valor sin equivalencia en el catálogo deja la columna normalizada en `NULL` y el original intacto; nunca se fuerza `OTRO`.
3. Descripciones, objetivo, material y medidas son texto `[CONFIRMADA]`.
4. No se amplía `departamento_enum` ni `estatus_enum` `[CONFIRMADA]`. El análisis de compatibilidad está en D-03.
5. Una nueva solicitud creada en Kromi Connect usa los mismos catálogos; el catálogo crece con una acción administrativa, sin migración.

## 7. Gestión de solicitudes y entregables

**Solicitud.** Se crea con título, objetivo, solicitante (usuario o nombre), departamento, área, prioridad y fecha objetivo general. Tiene un responsable actual cuando la operación lo requiere. Puede existir sin publicación y sin Diseño `[CONFIRMADA]`.

**Entregables.** Una solicitud tiene cero o más. Cada combinación de pieza y formato es un entregable; varios formatos equivalentes de la misma pieza pueden agruparse solo cuando la interpretación sea inequívoca `[CONFIRMADA]`. Cada entregable guarda: pieza, categoría, formato original y normalizado, medio original y normalizado, `cantidad_piezas`, `cantidad_formatos`, `alcance_texto`, material, medidas, fecha objetivo propia y estado propio. Se separan cantidad de piezas, cantidad de formatos y texto de alcance porque no son equivalentes `[CONFIRMADA]`.

**Prioridad.** `URGENTE`, `IMPORTANTE`, `NORMAL` `[CONFIRMADA]`; pertenece a la solicitud. Prioridad por entregable: no se incluye en la primera versión (D-05). No se reutiliza la escala de `publicaciones.prioridad` (ver §13, D-05).

**Fechas.** Distinguir fecha original de la hoja, fecha objetivo y fechas operativas de Kromi Connect `[CONFIRMADA]`. El detalle y la zona horaria están en el documento de importación §5.

## 8. Estados y transiciones

Cuatro conceptos distintos `[CONFIRMADA]`, no mezclar:

| Concepto | Dónde vive | Notas |
|---|---|---|
| Estado histórico importado | `estado_historico_original` (texto) | Antecedente. Nunca se traduce automáticamente. |
| Estado operativo de la solicitud | `estado` | Propuesta de valores abajo. |
| Estado del trabajo de Diseño | **no existe en esta entidad** en v1 | Solo aparecería si se aprueba la integración (§11). |
| Estado del entregable | `estado` del entregable | Propuesta abajo. |

**Valores acordados** `[CONFIRMADA]` (D-04/D-10):

- Solicitud: `HISTORICA`, `ABIERTA`, `EN_CURSO`, `COMPLETADA`, `CANCELADA`.
- Entregable: `HISTORICO`, `PENDIENTE`, `EN_CURSO`, `COMPLETADO`, `CANCELADO`.

`HISTORICA`/`HISTORICO` significa «proviene de la hoja y no tiene ciclo operativo en Kromi Connect». Evita traducir «Terminado» a `COMPLETADA` y evita simular que hubo transiciones. Una solicitud histórica puede reabrirse explícitamente (ver reglas).

```mermaid
stateDiagram-v2
  [*] --> ABIERTA: crear en Kromi
  [*] --> HISTORICA: importar
  ABIERTA --> EN_CURSO: algún entregable inicia
  EN_CURSO --> COMPLETADA: todos los entregables no cancelados completados
  ABIERTA --> CANCELADA: cancelar con motivo
  EN_CURSO --> CANCELADA: cancelar con motivo
  COMPLETADA --> ABIERTA: reabrir con motivo
  CANCELADA --> ABIERTA: reabrir con motivo
  HISTORICA --> ABIERTA: reabrir con motivo
```

**Reglas de consistencia** `[PROPUESTA]`:

1. R1. El estado de la solicitud se almacena (no se calcula en la lectura), pero lo actualiza una función de servidor que lo valida contra los entregables en la misma transacción.
2. R2. `EN_CURSO` si hay al menos un entregable `EN_CURSO` o `COMPLETADO` y alguno `PENDIENTE` o `EN_CURSO`. La finalización parcial queda visible por los entregables; no hay estado `PARCIAL`.
3. R3. `COMPLETADA` solo si todos los entregables no cancelados están `COMPLETADO` y existe al menos uno. Una solicitud sin entregables no pasa a `COMPLETADA` automáticamente; se completa manualmente con motivo (D-10).
4. R4. Cancelar la solicitud exige motivo; los entregables abiertos pasan a `CANCELADO` en la misma transacción y los completados se conservan.
5. R5. Reabrir exige motivo, deja la solicitud en `ABIERTA` y no modifica entregables `COMPLETADO` ni `CANCELADO` salvo acción explícita sobre cada uno.
6. R6. Cancelar o completar un entregable no cambia por sí solo la solicitud a `CANCELADA`; solo R2/R3 la mueven.
7. R7. Las transiciones «reabrir» y «cancelar» son propuestas nuevas, no acordadas; los criterios de cierre quedan pendientes de aprobación (D-10).

Matriz completa de transiciones del entregable en el documento de datos §7.

## 9. Historial y auditoría

- Toda transición de estado, cambio relevante de campo y asignación genera una fila en `solicitud_diseno_historial` `[CONFIRMADA]`.
- La importación **no** genera filas de transición; registra un único evento `IMPORTACION` con referencia al lote y fila `[CONFIRMADA]`.
- Reasignación: `tipo = 'ASIGNACION'`, con responsable anterior y nuevo, actor y fecha `[CONFIRMADA]`.
- El historial es inmutable para usuarios ordinarios: sin privilegios de escritura directa y con un trigger que rechaza `UPDATE` y `DELETE`, igual que `evento_historial` y `pendiente_tienda_historial` `[REPO]`.
- Hallazgo `[REPO]`: `publicacion_estatus_historial` se protege solo retirando privilegios de escritura; las migraciones no definen un trigger equivalente. No se debe tomar como modelo.

## 10. Vinculación futura con publicaciones

- Acción explícita y autorizada `[CONFIRMADA]`; nunca automática por departamento, área o medio.
- Vínculo formal opcional en `solicitud_diseno_vinculos` (una fila por destino), **diferido** según D-21: la v1 usa solo `referencia_manual`. La primera importación puede dejar solo una referencia manual en texto `[CONFIRMADA]`; no se crean vínculos formales al importar.
- Crear una publicación **a partir de** una solicitud (conversión) es una acción distinta y posterior; debe reutilizar `createPostWithDriveAction` y respetar los permisos y el alcance por cuentas de `publicaciones`. No se diseña en esta fase (D-11).
- El vínculo no copia estados ni fechas entre entidades.

## 11. Integración con Diseño

Contrato actual `[REPO]`: `DesignSource = 'SOCIAL_MEDIA' | 'INTERNAL' | 'EVENTS'`; `DesignRequest` con `requested_outputs`, `design_status` (`REQUESTED`, `IN_PROGRESS`, `NEEDS_CHANGES`, `DELIVERED`, `CANCELLED`) y adaptadores `adaptPublication`, `adaptInternal`, `adaptEvent` en `src/lib/designRequests.ts`. Las acciones de Design se despachan por origen en `src/app/actions/design/requests.ts` y cada RPC valida `design.requests.*` o su permiso de origen.

**Recomendación** `[PROPUESTA]` (D-12): **no integrar en el primer despliegue.** Razones:

1. Las solicitudes históricas están terminadas o canceladas en su gran mayoría; no deben generar tickets activos.
2. Un cuarto origen obliga a tocar `DesignSource`, `VALID_SOURCES`, `sourceState`, las rutas `/design/requests/[source]/[id]`, `fieldRules.ts` y las vistas de cola e historial.
3. La vía de menor impacto ya existe: **vincular** la solicitud a una publicación, evento o pendiente que sí aparece en la cola. Diseño ve el trabajo por su origen habitual y la solicitud sigue siendo el registro de negocio.

Si más adelante se aprueba un origen propio, condiciones mínimas:

| Pregunta | Propuesta |
|---|---|
| Elegibilidad | Solo solicitudes con estado `ABIERTA` o `EN_CURSO`, con al menos un entregable `PENDIENTE` que requiera Diseño y con acción explícita «Enviar a Diseño». Nunca `HISTORICA`. |
| Campos comunes | `title`, `requested_by`, `requested_at`, `instructions` (objetivo), `target_date`, `requested_outputs` (derivado de entregables), `usage_date`. |
| Estado de Diseño | Columna propia en la solicitud o en el entregable, separada de `estado`. Valores alineados con `DesignStatus`. |
| Historial de Diseño | El mismo `solicitud_diseno_historial`, con `tipo = 'DISENO'`. |
| Permisos | Un adaptador y RPC propios que validen `design.requests.read` más un permiso de la nueva entidad; la RPC no devuelve datos de importación ni identidades históricas. |
| Duplicados | Índice único parcial: una sola solicitud de Diseño activa por entregable. |
| Cancelación | Cancelar la solicitud cancela el trabajo de Diseño abierto y registra motivo (alineado con `guard_event_design_archive`). |
| Entregas | Los archivos entregados se asocian al entregable por `drive_file_id`; no se copian a la solicitud. |

### 11.1 Restricciones de UI e integración mínima `[PROPUESTA]` (D-21, D-22)

**Principio:** integración sencilla. No se añaden pasos, modales ni vistas que no sean necesarios, y el diseño ya aplicado en las vistas existentes no cambia.

**Punto de partida verificado en el repositorio `[REPO]`:**

- El menú de Diseño se define en `src/app/(dashboard)/design/shell.tsx`: un grupo «Diseño» con un único ítem, **Solicitudes** (`/design/publications`), que ya es la cola unificada. `DesignWorkspaceNav.tsx` muestra las pestañas Solicitudes e Historial.
- El menú de Social Media se define en `src/app/(dashboard)/social-media/SocialMediaLayoutClient.tsx` (Efemérides, Campañas, Calendario de contenido y otros). Los menús por rol se inyectan con `useRegisterShellSlots` (`src/app/(dashboard)/components/ShellSlot.tsx`).
- «Solicitudes» ya nombra dos cosas: la cola de Diseño y el inbox de terceros de Social Media (`/social-media/requests`). El módulo nuevo necesita otro nombre.
- `DesignStatusBadge` y `OriginChip` (`design/components/DesignBadges.tsx`) están tipados con `DesignStatus` y `DesignSource` de `src/lib/designRequests.ts`.

**Alcance de UI propuesto para la v1:**

| Elemento | Propuesta |
|---|---|
| Entrada | **Un solo ítem nuevo**, «Registro», en el menú de Diseño, en la ruta `/design/registro`. La ruta admite a todos los usuarios autenticados con permiso de lectura. |
| Vistas | **Una sola vista nueva**: listado con los filtros mínimos y paginación como las vistas de Diseño. Sin página de ficha aparte. |
| Detalle | **Dentro de la misma vista**, expandiendo la fila: entregables, historial y, para las importadas, las respuestas originales del formulario, incluido el correo. Sin modales. |
| Acciones | En la fila expandida: estado del entregable, responsable y referencia manual. Sin formularios en modal. |
| Vínculo con publicaciones | Solo **referencia manual en texto** en la v1. El selector y la tabla de vínculos formales se difieren; así se evita un modal y cualquier control nuevo en Grid. |
| Crear solicitudes desde la interfaz | Incluido: formulario de creación integrado en la vista del módulo, sin modal ni ficha aparte. La creación manual y la importación son vías independientes; importar nunca actualiza ni sobrescribe solicitudes manuales ni importadas previamente. |

**Lo que no se toca `[PROPUESTA]`** (se verifica en cada revisión de código con `git diff --stat`):

- `design/publications/UnifiedQueueView.tsx`, `design/publications/history/UnifiedHistoryView.tsx`, `design/publications/DesignWorkspaceNav.tsx`.
- La ficha única: `design/requests/[source]/[id]/*` y `src/lib/design/fieldRules.ts`.
- `src/lib/designRequests.ts` (no ampliar `DesignSource` ni `DesignStatus`), `src/lib/designSla.ts` y `design/components/DesignBadges.tsx`. Para los estados nuevos se usa un chip propio con el mismo estilo; no se pasan valores nuevos a `DesignStatusBadge`.
- Los modales de Grid y Kanban, y las vistas de Interno y Eventos.

**Único archivo existente que se edita:** `design/shell.tsx`, para añadir el ítem de menú.

**Cómo construirlo sin alterar el diseño:**

1. Ruta nueva `/design/registro`, en `design/registro/`, que hereda el layout actual.
2. Reutilizar sin modificar: `useRegisterShellSlots`, los tokens de color y la fuente documentados en [`README.md`](./README.md#cómo-leer-los-prototipos), y `formatDesignDate`/`getCaracasToday` de `designSla.ts` (formato `es-VE`, zona `America/Caracas`).
3. Leer la guía de `node_modules/next/dist/docs/` antes de escribir código, como exige `AGENTS.md`.
4. **Verificación visual:** capturar la cola, el historial y la ficha de Diseño y el menú de Social Media **antes** de empezar y compararlos al terminar; la única diferencia admitida es el ítem de menú nuevo. Playwright está configurado (`playwright.config.ts`, `e2e/`), pero el repositorio no tiene pruebas de capturas hoy `[REPO]`; hay que crear la línea base.

La vista única admite creación y edición manual, además de consulta y gestión. El formulario de creación se integra en esa vista sin modal ni página de ficha separada. La importación se ejecuta por un proceso separado y solo agrega filas históricas; no cambia el flujo manual.

## 12. Criterios de aceptación

Funcionales (verificables tras implementar):

1. Una solicitud sin publicación, sin entregables y sin Diseño se crea, consulta y cancela.
2. Una solicitud con tres entregables completa uno y las demás siguen abiertas; la solicitud queda `EN_CURSO`.
3. Cambiar de responsable crea una fila `ASIGNACION` con anterior, nuevo, actor y fecha, y no altera `solicitante_*`.
4. Intentar `UPDATE` o `DELETE` sobre el historial falla incluso con `service_role`.
5. Ninguna solicitud `HISTORICA` aparece en la cola de Diseño.
6. Un usuario sin permiso no lee solicitudes, historial ni datos de importación, por vía de tabla ni de RPC.
7. Los estados históricos se leen tal cual en `estado_historico_original` y no existen filas de historial con transiciones anteriores a la importación.
8. La UI permite crear una solicitud manual con entregables; la importación no modifica esas solicitudes ni su flujo.
9. (UI) Ninguna vista existente de Diseño, Social Media, Interno ni Eventos cambia respecto de la línea base de capturas, salvo el ítem de menú nuevo; el módulo no usa modales ni páginas de ficha aparte.

De documentación: los 14 criterios del encargo se comprobaron en la revisión cruzada de [`roadmap-solicitudes-diseno.md` §9](./roadmap-solicitudes-diseno.md#9-revisión-cruzada-de-la-documentación).

## 13. Registro de decisiones

### 13.1 Confirmadas (resumen)

Las decisiones funcionales del encargo (§7) y las arquitectónicas (§4.1) se conservan. El usuario confirmó para la v1: acceso y asignación solo por Diseño; importación mediante script servidor/CLI con simulación previa; reglas R1–R7; correo conservado en originales y visible por todos los usuarios autenticados, sin vincular identidades; columnas con sufijo `2` como campos adicionales separados; zona horaria `America/Caracas`; no inferir tipos; reversión atómica solo si no hay actividad posterior; huella de las 22 celdas con revisión manual ante cambios; creación manual además de importación; entorno de pruebas Supabase local. También se conserva: solicitud ≠ publicación; referencia manual en v1; catálogo propio de departamentos con los ocho valores observados; alias exactos y desconocidos a revisión; sin borrado físico operativo; no ampliar `departamento_enum` ni `estatus_enum`; estados históricos preservados sin traducir; importación sin transiciones simuladas ni SLA automático; `Responsble` = solicitante; `Fecha de entrega` = fecha objetivo general; `Fecha de termino` solo antecedente; `admin` sin acceso automático.

### 13.2 Propuestas y pendientes

| ID | Decisión | Estado | Contexto | Alternativas | Recomendación | Consecuencias | Evidencia para cerrar |
|---|---|---|---|---|---|---|---|
| D-01 | Entidad independiente con entregables | Confirmada por el usuario | Ver §3. | — | Entidad independiente + entregables 1:N + historial + importación por lotes; vínculos formales diferidos | Nuevas tablas y RPC; más superficie de RLS | Respuesta del usuario, 2026-10-26 |
| D-02 | Conciliar esquema remoto antes de migrar | Resuelta `[REPORTADO]` | El usuario confirma que la conciliación con Supabase se hizo antes de redactar este plan y que el historial de migraciones y esquemas público/auth actualizados están en el repositorio. | Repetir toda la conciliación | Usar los artefactos conciliados como línea base; verificar únicamente cambios remotos posteriores y objetos que afecte la nueva migración | No bloquea F2; comprobar estado de aplicación de migraciones solo si es relevante para el despliegue | Confirmación del usuario, 2026-10-26 |
| D-03 | Catálogo propio de departamentos en vez de `departamento_enum` | Confirmada por el usuario | La hoja contiene ocho valores de departamento y solo dos coinciden con el enum técnico de cinco valores. | — | Tabla `catalogo_departamentos_solicitud`, preservando el valor original y sembrando los ocho valores observados | Sin migraciones de enum al crecer | Respuesta del usuario, 2026-10-26; validar el seed contra F3 |
| D-04 | Estados como texto con `CHECK`, valores de §8 | Confirmada por aceptación de R1–R7 | Eventos y pendientes usan texto con `CHECK` `[REPO]`; el enum de publicaciones es editorial. | — | Texto + `CHECK` | Cambiar valores requiere migración | Respuesta del usuario, 2026-10-26 |
| D-05 | Prioridad `URGENTE/IMPORTANTE/NORMAL` como texto; no reutilizar `publicaciones.prioridad` | Propuesta | Esa escala es `smallint` 1 Alta, 2 Normal, 3 Baja (default 2) `[REPO]`; «Urgente» no tiene equivalente y «Importante» tampoco; el contrato de Diseño usa `HIGH/NORMAL/LOW`. | Reutilizar y mapear | Texto propio; mapeo a `HIGH/NORMAL/LOW` solo si se integra | Sin reinterpretar datos | Decidir mapeo si hay integración |
| D-06 | Historial único con `tipo` (incluye asignaciones) | Propuesta | Patrón existente en eventos y pendientes. | Tabla de asignaciones aparte | Una tabla | Menos objetos | Aprobación |
| D-07 | Quién asigna y reasigna responsables | Confirmada por el usuario | El encargo no lo definía. | — | Solo rol `design`, mediante permiso propio | Define la matriz | Respuesta del usuario, 2026-10-26 |
| D-08 | Qué roles leen solicitudes y con qué alcance | Confirmada por el usuario | Todos los usuarios autenticados de la aplicación pueden consultar el registro y sus originales, incluido el correo del remitente. | — | Lectura global para todos los roles autenticados; escrituras operativas conservan permisos por rol | Define RLS | Respuesta del usuario, 2026-10-26 |
| D-09 | Cómo se ejecuta la importación y con qué permiso | Confirmada por el usuario | La importación es una utilidad operativa para la carga inicial, no una acción de navegador. | UI administrativa; ejecución manual por operador | Script de servidor/CLI, simulación primero y ejecución explícita; `service_role` solo en el proceso servidor/local protegido, con operador autorizado | Define F3/F5 | Respuesta del usuario, 2026-10-26 |
| D-10 | Criterios de cierre, reapertura y cancelación | Confirmada por el usuario | El encargo pide definirlos; R1–R7 son la propuesta de reglas. | — | R1–R7 de §8 | Define transiciones | Respuesta del usuario, 2026-10-26 |
| D-11 | Conversión solicitud → publicación | Pendiente (fase futura) | Acordada como acción explícita; diseño no definido. | Solo vínculo manual | Diferir a una fase posterior | Fuera de v1 | Decisión de fase |
| D-12 | Integración con la cola de Diseño | Propuesta: diferir | Ver §11. | Integrar en v1 | Diferir; vincular a entidades existentes | Diseño no ve solicitudes históricas | Aprobación |
| D-13 | Estado operativo de una solicitud importada | Confirmada por aceptación de R1–R7 | No traducir estados históricos. | — | `HISTORICA` | Reabrir requiere acción explícita | Respuesta del usuario, 2026-10-26 |
| D-14 | Visibilidad y uso del correo de la hoja | Confirmada por el usuario | El correo corresponde a quien envió el formulario, no necesariamente al solicitante (`Responsble`). | — | Conservarlo en los datos originales y permitir su lectura a todos los usuarios autenticados; no usarlo para vincular `solicitante_usuario_id` | Evita asignar al solicitante la identidad del remitente | Respuesta del usuario, 2026-10-26 |
| D-15 | Zona horaria de la marca temporal importada | Confirmada por el usuario | El Excel almacena seriales numéricos sin zona; el usuario confirma que representan `America/Caracas`. | — | Convertir el serial Excel a fecha/hora local y asignar `America/Caracas` al crear `timestamptz`; preservar también el valor fuente | Conversión reproducible a UTC sin perder el dato original | Respuesta del usuario, 2026-10-26 |
| D-16 | «Diseñador» de la hoja es identidad histórica del ejecutor; no crea responsable actual ni evento `ASIGNACION` al importar | Propuesta | Se busca no simular asignaciones que no ocurrieron en Kromi Connect. | Crear responsable actual desde la hoja | Guardar `ejecutor_historico_*` y dejar `responsable_actual_id` nulo | Reabrir exige asignar | Aprobación |
| D-17 | Valores iniciales del catálogo de tipos de solicitud y su derivación | Confirmada por el usuario | La hoja no tiene una columna de tipo fiable; `Área`, medio y campos de publicación/impresión no bastan para inferirlo. | — | No inferir tipo en importaciones; campo opcional y sin catálogo obligatorio para altas manuales en v1 | Evita clasificar por intuición | Respuesta del usuario, 2026-10-26 |
| D-18 | Archivado lógico de solicitudes | Propuesta: no incluir en v1 | Las solicitudes canceladas o terminadas siguen consultables `[CONFIRMADA]`. | Añadir `archivado_en` | Diferir | Sin papelera para esta entidad | Decisión de alcance |
| D-19 | Los entregables no se borran físicamente en la operación normal | Confirmada por el usuario | Preserva historial y trazabilidad. | Borrado físico general | Cancelar en lugar de borrar; FK `RESTRICT`. La reversión privilegiada de importación queda limitada por D-20 | Corrección de errores de captura vía cancelación | Respuesta del usuario, 2026-10-26 |
| D-20 | Reversión de un lote importado | Confirmada por el usuario | «Deshacer» significa retirar los registros que creó la importación sin borrar el registro de auditoría del lote. | — | Función exclusiva de `service_role`, atómica y todo-o-nada: solo si ninguna solicitud importada tuvo actividad posterior; conserva lote y filas, guarda el UUID revertido, desvincula la FK y elimina los datos creados por ese lote en orden | Si existe actividad posterior, la operación se rechaza sin cambios y explica el motivo | Respuesta del usuario, 2026-10-26; probar en entorno no productivo |
| D-21 | Alcance mínimo de UI de la v1 (§11.1) | Resuelto en el plan | Mantener una sola vista del módulo sin alterar el diseño existente de Diseño, Social Media, Interno ni Eventos. | Listado + ficha + formularios propios; integrar dentro de la cola de Diseño | Ítem «Registro» en `/design/registro`, una vista con detalle expandible y creación manual integrada, sin modales ni cambios a vistas existentes | Incluye creación manual; una ficha propia queda como mejora posterior | Propuesta UX que se implementará y validará visualmente |
| D-22 | Crear solicitudes nuevas desde la interfaz en la v1 | **Confirmada** | El usuario confirma que la v1 permite crear solicitudes manualmente y que la importación acelera la carga inicial sin afectar ese flujo. | — | Incluir creación manual y mantener la importación como proceso independiente, aditivo y no destructivo | La UI debe soportar ambos orígenes y distinguir solicitudes manuales de importadas | Resuelto por el usuario el 2026-10-26 |

Rechazadas: ninguna hasta ahora.
