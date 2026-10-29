# Plan de implementación: Solicitudes generales de diseño

**Estado:** propuesta funcional y técnica pendiente de implementación.  
**Alcance:** MVP de solicitudes generales independientes de los módulos operativos.  
**Origen propuesto en el contrato común:** `GENERAL`.  
**Última actualización:** 2026-10-28.

> Este documento define el diseño y el plan de trabajo; no afirma que las vistas, las tablas, las migraciones, las políticas RLS o la integración general con Drive ya estén implementadas o desplegadas. Las rutas indicadas son propuestas hasta su contraste final con el código y el menú actuales.

## 1. Objetivo

Incorporar a Kromi Connect un canal directo para que los usuarios de los roles `social-media`, `events` e `internal` soliciten trabajos de diseño sin crear previamente una publicación, tarea interna o evento.

El canal nuevo complementa, pero no reemplaza, los flujos de solicitud existentes en cada módulo de rol. Las solicitudes generales deben integrarse en la cola y el detalle unificados de Diseño; no se construirá una segunda herramienta de gestión para diseñadores.

## 2. Decisiones funcionales confirmadas

| Decisión | Definición del MVP |
|---|---|
| Roles con acceso de solicitante | `social-media`, `events`, `internal` |
| Navegación | Nuevo ítem `Solicitudes` en el layout compartido, visible a los tres roles autorizados |
| Vista principal | Formulario para nueva solicitud general |
| Vista de seguimiento | `Mis solicitudes`, accesible como botón desde el formulario y como subítem de `Solicitudes` |
| Independencia | No requiere registros en publicaciones, pendientes internos ni eventos |
| Solicitante y rol | Derivados del usuario autenticado y de su perfil en el servidor; no confiables desde el cliente |
| Tipo de diseño | Select: `Digital`, `Impreso`, `Digital e Impreso`, `Otro` |
| Tipo «Otro» | Muestra campo de texto limitado por caracteres; obligatorio solo cuando se escoge `Otro` |
| Fecha requerida | Obligatoria para solicitudes generales nuevas y usada para mostrar el plazo de trabajo |
| Categorías | Selección múltiple mediante tags; catálogo inicial por validar con Mercadeo/Diseño |
| Sedes/ámbitos | Selector múltiple opcional: Prebo, Mañongo, Trigal Sur, Trigal Norte, Guataparo, Castillito, San Felipe y Online |
| Departamento | Select con valor predeterminado `Mercadeo`; catálogo por confirmar, con valores propuestos como Operaciones, Capital Humano, Selección y Compras |
| Archivos | Google Drive con carpeta vinculada a cada solicitud; los archivos de referencia son opcionales |
| Prioridad | Definida por el equipo de Diseño; no editable por el solicitante |
| Cancelación | El solicitante puede pedir cancelación durante cualquier estado activo. La petición se registra y requiere resolución según reglas autorizadas; no cancela automáticamente el trabajo |
| Integración | Una cola y ficha compartidas, ampliadas para el origen `GENERAL` |

### 2.1 Distinciones importantes

- **Rol técnico** controla permisos; **departamento** registra el área solicitante. Elegir un departamento no concede permisos.
- **Tipo de diseño** indica Digital/Impreso/ambos/otro; las **categorías** describen producto, área o temática y son independientes del tipo de producción.
- **Sede Online** es un ámbito digital, no una sede física.
- **Fecha requerida** es el plazo solicitado. El tiempo disponible se calcula usando la fecha/hora de creación y la fecha requerida; la prioridad sigue bajo responsabilidad de Diseño.
- El estado principal de la solicitud y el estado de una petición de cancelación son conceptos diferentes.
- Los catálogos iniciales de categorías y departamentos necesitan validación de negocio antes de cerrarse.

## 3. Navegación, rutas y permisos

### 3.1 Propuesta de rutas

- `/requests`: formulario de nueva solicitud; vista predeterminada al abrir `Solicitudes`.
- `/requests/mine`: listado de solicitudes del usuario autenticado.
- `/design/publications`: cola de Diseño existente, ampliada para incluir `GENERAL`.
- `/design/requests/[source]/[id]`: ficha unificada existente, ampliada para el origen `GENERAL`.

Estas rutas nuevas son propuestas. Confirmar las convenciones de rutas, navegación y autorización con el código actual antes de implementarlas.

### 3.2 Acceso

| Rol | Crear solicitudes generales | Consultar «Mis solicitudes» | Gestionar cola de Diseño |
|---|---:|---:|---:|
| `social-media` | Sí | Sí | No por esta capacidad |
| `events` | Sí | Sí | No por esta capacidad |
| `internal` | Sí | Sí | No por esta capacidad |
| `design` | No como solicitante general por defecto | No por defecto | Según permisos actuales de Diseño |
| Otros roles | No | No | Según permisos existentes, sin ampliación por esta función |

El ítem del menú es una ayuda de navegación, no una barrera de seguridad. Las páginas, acciones del servidor, consultas y políticas RLS deben verificar autorización por separado.

## 4. Prototipos de UI

Los prototipos son wireframes funcionales de referencia, no pantallas implementadas ni capturas de la aplicación. Deben adaptarse al sistema visual y a los componentes reales del repositorio.

### 4.1 Navegación

```text
Kromi Connect
├── Social Media                    (según rol/permisos)
├── Eventos                         (según rol/permisos)
├── Tareas Internas                 (según rol/permisos)
└── Solicitudes                     (social-media, events, internal)
    ├── Nueva solicitud             (/requests)
    └── Mis solicitudes             (/requests/mine)
```

Desde el formulario debe existir un botón visible «Mis solicitudes». Los flujos de solicitar diseño desde las pantallas de publicación, eventos y tareas internas permanecen disponibles y no se redirigen a este formulario.

### 4.2 Formulario `/requests`

```text
Nueva solicitud de diseño                  [Mis solicitudes]

Solicitante: [usuario de sesión]  Rol: [perfil de sesión; solo lectura]

Título de la solicitud *                   [________________________]

Tipo de diseño *
[ Digital v ]      Opciones:
                    - Digital
                    - Impreso
                    - Digital e Impreso
                    - Otro

Si tipo = Otro:
Descripción del tipo *                     [________________________]
                                           (límite de caracteres)

Descripción e instrucciones *
[__________________________________________________________________]
[__________________________________________________________________]

Categorías (selección múltiple mediante tags)
[Carnicería] [Charcutería] [Pescadería] [Víveres] [Panadería] [...]
El catálogo final se valida con Mercadeo/Diseño.

Sedes o ámbitos (opcional; selección múltiple)
[Prebo] [Mañongo] [Trigal Sur] [Trigal Norte]
[Guataparo] [Castillito] [San Felipe] [Online]

Departamento *
[Mercadeo v]
Catálogo por validar: Operaciones, Capital Humano, Selección, Compras, ...

Fecha requerida *
[dd/mm/aaaa]   (obligatoria)

Cantidad / especificaciones adicionales (opcional)
[__________________________________________________________________]

Archivos de referencia (opcional)
[Adjuntar archivos]  Los archivos pertenecen a la carpeta de Drive
asociada a esta solicitud.

[Cancelar]                                  [Enviar solicitud]
```

#### Validaciones

- Título, tipo de diseño, instrucciones, departamento y fecha requerida son obligatorios.
- Si el tipo es `Otro`, el texto explicativo se vuelve obligatorio y se valida contra un límite máximo decidido durante implementación.
- Categorías y sedes son selección múltiple; la lista puede quedar vacía salvo que negocio decida lo contrario.
- La fecha requerida debe tener formato y calendario válidos. Definir la política para fechas pasadas o con plazo insuficiente; no inventar un SLA fijo.
- Solicitante, identificador, rol, estado inicial y fechas de sistema se resuelven en servidor.
- Los límites y tipos permitidos de archivo deben reutilizar los patrones existentes cuando sean compatibles, previa auditoría; no asumir que los límites de publicaciones aplican automáticamente.
- Mostrar estados de envío, error, éxito y recuperación ante fallo parcial de Drive. Evitar solicitudes duplicadas por reintentos.

### 4.3 «Mis solicitudes» `/requests/mine`

```text
Mis solicitudes de diseño                         [+ Nueva solicitud]

[Filtro por estado] [Buscar por título] [Categoría, si aporta valor]

Título                         Tipo               Fecha requerida   Estado
Material promocional           Digital            05/11/2026        En diseño
Material para varias sedes     Digital e impreso  07/11/2026        Solicitada
Pieza especial                 Otro               12/11/2026        En corrección

Cada fila/tarjeta: estado, fecha requerida, última actualización y
[Ver detalle]. Mostrar diseñador asignado cuando exista y el permiso
lo permita. En móvil, usar tarjetas en lugar de una tabla comprimida.
```

La consulta se filtra en servidor por el usuario autenticado. Filtros iniciales: estado y búsqueda por título; evitar sobrecargar el MVP con analítica o filtros complejos.

### 4.4 Detalle para el solicitante

Reutilizar la ficha unificada cuando sea viable, adaptando las acciones por rol y titularidad. El solicitante puede consultar su información, estado, historial visible, referencias y entregables disponibles. No puede iniciar el trabajo, asignar diseñador ni modificar estados de Diseño.

Acción propuesta: «Solicitar cancelación». Abre un diálogo con motivo obligatorio. La petición queda registrada y pendiente de resolución; no altera por sí sola el estado operativo. Diseño puede resolverla mediante una acción autorizada. El diseño final debe definir qué se permite si ya hay carga de entregables o la solicitud está entregada; no aceptar peticiones para estados terminales.

## 5. Arquitectura y persistencia propuestas

### 5.1 Origen común

Ampliar el contrato de `src/lib/designRequests.ts` con el origen `GENERAL`, y añadir un adaptador que represente los datos generales con los campos que consume la cola y el detalle.

La cola seguirá siendo la existente en `src/app/(dashboard)/design/publications/UnifiedQueueView.tsx`. La ficha compartida seguirá en `src/app/(dashboard)/design/requests/[source]/[id]/view.tsx`. Ambas requieren una rama `GENERAL` que no ejecute acciones específicas de publicaciones, Interno o Eventos.

El identificador común puede seguir el patrón actual `GENERAL:{id}`, después de validar cómo se construyen los href y consultan las fuentes actuales.

### 5.2 Persistencia lógica

Diseñar una tabla/entidad de solicitudes generales con al menos:

- Identificador.
- Título e instrucciones.
- Tipo de diseño y valor explicativo si se elige «Otro».
- Categorías seleccionadas.
- Sedes/ámbitos seleccionados.
- Departamento solicitado.
- Fecha requerida obligatoria.
- Identificador de solicitante derivado de autenticación; rol obtenido del perfil autorizado.
- Estado, diseñador y marcas de tiempo necesarias.
- Identificador de carpeta de Drive y estado de creación/sincronización.
- Campos de control para errores/reintentos de integración de Drive, si la arquitectura los requiere.

Historial y solicitudes de cancelación deben ser auditables. Evaluar si pueden representarse con tablas específicas o un modelo de eventos existente; evitar duplicar estructuras compartidas sin necesidad.

### 5.3 Google Drive

- Crear una carpeta por solicitud y persistir su identificador antes de que el cliente la use.
- La raíz de Drive, el esquema de nombres, permisos y subcarpetas se definen durante la auditoría.
- La referencia y los entregables deben quedar claramente separados, ya sea mediante subcarpetas `Referencias` y `Entregables` o la convención existente equivalente.
- No exponer credenciales privilegiadas en navegador.
- La creación en Supabase y en Drive no es una transacción única. Implementar una operación idempotente y estado recuperable para reintentos; no recrear carpetas cada vez que se reintenta.
- La solicitud no debe quedar duplicada ni quedar silenciosamente sin carpeta. Definir tratamiento visible de estado pendiente/error y proceso seguro de reintento.
- Verificar permisos de acceso de los tres roles solicitantes y del equipo de Diseño.

### 5.4 Estados y SLA

Mapear el flujo del origen general al contrato compartido: solicitada, en diseño, en corrección, entregada y cancelada. Reutilizar valores internos existentes mediante una capa de adaptación si el contrato público usa etiquetas inglesas.

La fecha requerida será obligatoria solo para solicitudes generales nuevas. No convertir de forma global el campo común `target_date` en obligatorio sin analizar los otros tres orígenes, cuyos datos y fechas tienen reglas propias.

Mostrar fecha requerida, fecha de creación y tiempo disponible. La lógica de urgencia/SLA debe explicitar zona horaria, umbrales y manejo de fechas pasadas o insuficientes antes de implementar; la prioridad final sigue siendo interna de Diseño.

### 5.5 Petición de cancelación

Representar la petición por separado del estado de la solicitud. Campos lógicos mínimos: solicitud, solicitante, motivo, fecha de petición, estado de revisión, actor revisor, fecha de resolución y comentario/resolución cuando aplique.

La petición solo puede generarla el propietario autenticado y únicamente mientras el estado principal sea activo. La resolución requiere permiso de Diseño u otro permiso explícito que confirme la auditoría. Las acciones deben validar estado y actor en servidor/base de datos. Registrar todas las transiciones relevantes en historial.

## 6. Seguridad y autorización

- Obtener el usuario mediante la función de autenticación del servidor existente y resolver rol/perfil desde la fuente de autorización vigente.
- No aceptar `requested_by`, rol, diseñador o estado inicial como valores autorizados enviados por el navegador.
- Aplicar permisos de página, acciones y consultas; el menú no es suficiente.
- En «Mis solicitudes», filtrar por propietario en servidor y reforzar el aislamiento con RLS cuando corresponda.
- Validar que las IDs de solicitud y de Drive pertenecen a la solicitud consultada; no aceptar IDs arbitrarios desde cliente.
- Mantener privilegios mínimos para RPC y Service Role. Si una acción usa privilegios elevados que omiten RLS, verificar actor, permiso, titularidad y estado dentro de la acción/RPC.
- Proteger archivos y enlaces de Drive; aplicar solo el nivel de acceso necesario.
- Probar intentos de suplantar solicitante, leer solicitudes ajenas, modificar departamento/estado/prioridad y cancelar en estados no permitidos.

## 7. Plan de implementación por fases

### Fase 0 — Auditoría y decisiones pendientes
**Trabajo:** revisar menú, páginas y permisos, el contrato común, consultas de la cola, ficha, historial, archivos Drive, tablas/RPC/RLS y rutas existentes.  
**Decisiones a cerrar:** catálogo definitivo de categorías/departamentos; longitud máxima del texto «Otro»; reglas para fecha pasada y plazo insuficiente; política de cancelación cuando la entrega está avanzada; raíz y permisos de Drive; reglas de conservación/historial.  
**Aceptación:** todos los puntos anteriores quedan documentados a partir del código y esquema real, y se distingue lo local de lo desplegado.

### Fase 1 — Esquema, migración y autorización
**Trabajo:** diseñar solicitud general, índices, relaciones, campos de Drive, historial y petición de cancelación; preparar migración y policies.  
**Aceptación:** migración reversible o con procedimiento seguro, RLS y operaciones validadas, sin cambios de restricciones que rompan los tres orígenes existentes.

### Fase 2 — Servicio y contrato compartido
**Trabajo:** extender `DesignSource`, contexto, etiquetas y adaptador; implementar acciones para crear, listar, obtener detalle, iniciar/entregar, cargar archivos según el patrón aprobado y gestionar cancelación.  
**Aceptación:** origen `GENERAL` funciona en pruebas de unidad/contrato; no se invocan acciones de otro origen y la regresión de adaptadores existentes pasa.

### Fase 3 — Integración de Drive
**Trabajo:** crear carpeta por solicitud, adjuntar referencias y entregables, mapear errores/reintentos de forma idempotente y restringir acceso.  
**Aceptación:** la carpeta se crea una sola vez por solicitud, el reintento recupera operaciones incompletas y los archivos quedan vinculados a la solicitud correcta.

### Fase 4 — Formulario y «Mis solicitudes»
**Trabajo:** implementar `/requests` y `/requests/mine` conforme a los wireframes, validaciones condicionales, selección múltiple, fecha obligatoria y confirmación.  
**Aceptación:** formulario accesible y responsive; datos automáticos no editables; la consulta personal está filtrada por servidor y tiene estados vacío/error/carga.

### Fase 5 — Navegación, detalle y cola
**Trabajo:** incorporar `Solicitudes` al menú compartido solo para los tres roles, mantener las rutas de solicitud existentes y adaptar cola/detalle común a `GENERAL`. Añadir panel de petición de cancelación y resolución para quien tenga permisos.  
**Aceptación:** las solicitudes generales se ven y gestionan en el circuito común de Diseño, sin alterar los flujos de Social Media, Interno y Eventos.

### Fase 6 — Pruebas integrales y despliegue
**Trabajo:** probar los tres roles, la identidad automática, RLS, estados, SLA/fecha, Drive, cancelación, accesibilidad, móvil y regresión; reconciliar las migraciones con Supabase remoto y desplegar siguiendo el procedimiento del proyecto.  
**Aceptación:** todos los casos de prueba aprobados; estado remoto verificado explícitamente; no se declara producción validada solo porque compila localmente.

## 8. Matriz de pruebas

| Caso | Resultado esperado |
|---|---|
| Roles social-media, events e internal acceden a `/requests` | Acceso autorizado |
| Otro rol intenta abrir ruta o acción | Denegado, aunque manipule URL |
| Usuario altera el solicitante o el rol en el payload | El servidor usa sesión/perfil real |
| Falta título, instrucciones, departamento, tipo o fecha | Validación impide crear |
| Tipo `Otro` sin descripción complementaria | Validación impide crear |
| Tipo `Otro` supera longitud máxima | Validación impide crear |
| Varias categorías/sedes seleccionadas | Se conservan como valores estructurados y validados |
| Fecha inválida o incumple política de plazos | Error comprensible y sin registro inválido |
| Archivos omitidos | Se puede crear solicitud |
| Fallo de Drive después de crear la solicitud | Estado recuperable, sin duplicados y reintento seguro |
| «Mis solicitudes» recibe ID de usuario manipulado | No puede leer registros ajenos |
| Solicitud general en cola de Diseño | Se ve con origen identificable y detalle correcto |
| Solicitud GENERAL intenta ejecutar acción de Social Media/Internal/Events | No se ejecuta; acción explícita del origen general |
| Petición de cancelación en estado activo | Se registra, no cancela automáticamente |
| Petición duplicada o para estado terminal | Se rechaza o se trata de forma idempotente según regla |
| Usuario no autorizado intenta resolver cancelación | Denegado |
| Cancelación aprobada/rechazada | Estado y auditoría coherentes |
| Solicitudes antiguas de Social Media, Interno y Eventos | Sin regresión de lista, ficha, carga o entrega |
| RLS/seguridad sin controles de frontend | Continúa impidiendo acceso indebido |

## 9. Archivos probablemente afectados

Confirmar rutas exactas durante la Fase 0. La inspección inicial señala estos componentes como puntos de integración:

- `src/lib/designRequests.ts`: origen, contexto y adaptador.
- `src/lib/design/designLabels.ts`: etiqueta visual y etiquetas del nuevo origen.
- `src/app/(dashboard)/design/publications/UnifiedQueueView.tsx`: cola unificada.
- `src/app/(dashboard)/design/requests/[source]/[id]/view.tsx`: ficha compartida.
- `src/app/(dashboard)/components/DashboardShell.tsx` o la fuente de menú que realmente utilice: navegación por rol.
- `src/app/(dashboard)/requests/page.tsx`: formulario general propuesto.
- `src/app/(dashboard)/requests/mine/page.tsx`: listado propio propuesto.
- Nuevas acciones/consultas en `src/app/actions/` según convenciones reales.
- Nueva migración SQL para tablas, relaciones, funciones y RLS.
- Adaptación del flujo de Google Drive existente o módulo específico de Drive general.
- Pruebas unitarias, integración, autorización y regresión.

## 10. Fuera del MVP

- Sustituir los formularios y flujos de los roles existentes.
- Convertir solicitudes generales en publicaciones, pendientes o eventos.
- Prioridad editable por el solicitante.
- Catálogo de tipos completamente administrable.
- Automatización avanzada de prioridades o escalamiento.
- Reemplazar la cola y ficha de Diseño.
- Notificaciones avanzadas, salvo que se detecte una dependencia funcional obligatoria.

## 11. Riesgos y decisiones pendientes

1. Confirmar el catálogo de categorías (incluyendo si «Otros» es categoría válida) y departamentos.
2. Definir límite de caracteres de «Otro».
3. Definir la política cuando la fecha requerida sea pasada, el mismo día o demasiado cercana; no asumir un SLA sin aprobación.
4. Confirmar quién resuelve peticiones de cancelación y qué ocurre si hay entregables cargados o la solicitud está entregada.
5. Verificar raíz, permisos, estructura y límites de Google Drive para las carpetas generales.
6. Confirmar qué mecanismos de historial, entregables y RPC se pueden reutilizar con seguridad.
7. Reconciliar esquema y permisos remotos con las migraciones locales antes de desplegar.

## 12. Referencias del repositorio

- `docs/UI_IMPLEMENTATION.md`: implementación actual de UI y capacidades.
- `docs/design/plan-ficha-unica-design.md`: contrato, cola y ficha de Design.
- `docs/design/plan-eventos-diseno.md`: integración existente de Diseño para Eventos.
- `docs/perfiles-de-usuario.md`: perfiles y permisos funcionales.
- `src/lib/designRequests.ts`: contrato compartido de solicitud.
- `src/app/(dashboard)/design/publications/UnifiedQueueView.tsx`: cola unificada existente.
- `src/app/(dashboard)/design/requests/[source]/[id]/view.tsx`: ficha unificada existente.

---

**Estado final de este documento:** propuesta lista para revisión. La aprobación de este plan no constituye autorización para desplegar cambios en producción ni confirma que una migración remota haya sido aplicada.
