# Kromi Connect — Backlog depurado y ruta de desarrollo

**Revisión:** 22 de octubre de 2026  
**Fuente de ideas:** PDF actualizado *Kromi Connect*, fechado el 22/10/2026.  
**Repositorio:** [ernest0dev/kromi-connect · main](https://github.com/ernest0dev/kromi-connect)

> Estado documental, no auditoría en vivo: “Implementado” significa que el SRS/seguimiento describe la función en el código. No demuestra por sí solo que la instancia de producción esté verificada. Revisar el estado de `main` y Supabase antes de iniciar cada tarea.

## Resumen y orden recomendado

1. **P0 — Estabilidad y permisos:** reconciliar Supabase, verificar RLS/RPC/grants/triggers, validar los flujos desplegados y unificar el manejo de errores.
2. **P1 — Completar operación diaria:** SLA/rodaje, modales, filtros, assets, detalle diario, perfiles/equipo e inventarios.
3. **P2 — Métricas:** resultados por publicación e informes por campaña.
4. **P3 — Integraciones:** solicitudes externas de Diseño, notificaciones/email, WhatsApp, Meta Business y catálogo de productos.
5. **P4 — Extensión de Eventos y activaciones:** calendario de solo lectura para otros equipos; después evaluar NFC, Wi-Fi de tienda y SMS Ya+ con un caso de uso y revisión de privacidad.
6. **P5 — Extras:** sorteos, temas visuales, modo oscuro y estrategia de almacenamiento.

No iniciar integraciones de canal antes de definir fuentes, permisos, tratamiento de errores y alcance funcional.

## Fase 0 — Reconciliación, seguridad y estabilidad (P0)

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| Permisos | Parcial / verificar | El modelo de roles existe. Conciliar esquema y migraciones remotas; probar RLS, grants, RPC, triggers y acciones de servidor. Definir permisos aprobados para `management`, `customer-support` e `internal`. | Matriz rol × módulo × acción aprobada y pruebas positivas/negativas con usuarios reales. |
| Control de errores | Pendiente | Definir códigos y mensajes consistentes para autenticación, permisos, Supabase, Drive y futuras integraciones; separar mensajes de usuario y logs técnicos sin secretos. | Catálogo de errores, trazabilidad diagnóstica y política de reintento documentados y probados. |
| Estado de brief | Parcial | Brief Drive y SLA existen; revisar fechas, reprogramación, ruta sin Diseño y reglas de rodaje. Falta fecha límite de rodaje y confirmar algunos objetos remotos. | Reglas acordadas y probadas al crear, editar, reprogramar y devolver a Brief; migraciones remotas verificadas. |
| Papelera | Implementada para publicaciones; alcance global por definir | Publicaciones tienen archivo lógico, restauración durante un mes calendario y purga programada. No asumir papelera universal. | Probar archivo/restauración/purga de publicaciones; decidir por separado otras entidades. |

**Paso técnico obligatorio:** revisar `supabase db pull` y `supabase migration list --linked`; conciliar antes de ejecutar nuevas migraciones. Fuentes: [SRS](https://github.com/ernest0dev/kromi-connect/blob/main/docs/kromi-connect-srs.md), [migraciones](https://github.com/ernest0dev/kromi-connect/blob/main/docs/supabase-db-migration.md), [perfiles](https://github.com/ernest0dev/kromi-connect/blob/main/docs/perfiles-de-usuario.md).

## Fase 1 — Completar la operación diaria (P1)

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| Diseño de modales | Parcial | Crear, Editar y Detalle existen; las pestañas Producción e Historial de Editar siguen inactivas según la documentación. | Todos los campos/acciones acordados funcionan; estados de carga, error y vacío; permisos aplicados. |
| Carga y edición de assets | Parcial | Brief y entregables se cargan a Drive. La app lista metadatos/enlaces, sin preview embebido ni borrado desde Kromi. Precisar si “editar” significa reemplazar, renombrar, borrar, previsualizar o editar el archivo. | Operaciones aprobadas, autorizadas y auditables; no implementar un editor genérico por suposición. |
| Detallado diario | Pendiente | Modal/vista de publicaciones de un día; acordar interacción desde Grid y qué datos/acciones incluye. | Abrir un día y ver publicaciones, destinos, copy, estado y horario; acciones según permisos. |
| Filtros de publicaciones | Parcial | Grid ya filtra. Identificar filtros y ordenamientos faltantes sin rehacer lo existente ni asumir paridad con Kanban. | Lista de criterios aprobada; filtros combinables y ordenamiento funcional en las vistas acordadas. |
| Perfil Eventos | Implementado en lo esencial; validar | Existen rol `events`, inventario y programación. Falta validar despliegue y permisos con usuarios reales. | Pruebas de calendario/inventario y denegación de acceso a módulos no autorizados. |
| Calendario de eventos para todos los equipos | Pendiente | El módulo de programación existe para Eventos. Añadir vista **solo lectura** para otros equipos sin otorgar permisos de edición; definir qué datos pueden ver y si aplica filtro por sede. | Roles autorizados consultan calendario y detalles permitidos; mutaciones bloqueadas en servidor/RPC, no solo ocultas en UI. |
| Inventarios | Parcial respecto a la idea global | Inventario de Eventos existe; la idea también menciona insumos de Social Media. Definir inventario compartido/separado, catálogo, sedes, responsables y movimientos. | Decisión documentada y, si se aprueba, flujo de Social Media sin duplicar conceptos existentes. |
| Registro de solicitudes | Parcial | Inbox, conversión a publicación y rechazo existen. Falta decidir qué solicitudes notifican por email, destinatarios y momento del aviso. | Eventos notificables, destinatarios, plantillas y fallos definidos; envío trazable. |
| Registro de solicitudes (Diseño) | Parcial / decisión pendiente | Solicitud interna y cola de Diseño existen. Decidir si Google Sheets/Forms se migran, se mantienen como entrada o se sustituyen. | Fuente de verdad y canal definidos; captura/adjuntos sin duplicados si se migra. |
| Miembros del equipo | Parcial / por definir | Roles existen; falta concretar vista de equipo. La nota propone cambiar “Sedes” por “Equipo”; revisar primero el contexto de cada módulo. | Header y listado de miembros por rol coherentes, con datos mínimos y acceso autorizado. |
| Perfil de usuario | Parcial | Existe `profiles` y se muestra el usuario/rol en navegación; no está confirmado un CRUD completo. | Vista de perfil con campos editables definidos; el usuario no puede autoasignarse roles. |

Fuentes: [SRS](https://github.com/ernest0dev/kromi-connect/blob/main/docs/kromi-connect-srs.md), [perfiles](https://github.com/ernest0dev/kromi-connect/blob/main/docs/perfiles-de-usuario.md), [modales](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/modales-publicacion.md), [plan de inventario](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/plan-inventario-eventos.md), [programación de Eventos](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/plan-eventos-programacion.md).

## Fase 2 — Datos de resultados y analítica (P2)

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| Datos de resultados | Pendiente | Definir plataformas, métricas, periodo, captura manual/API y relación con cuentas destino. No hay flujo completo documentado por publicación. | Resultados por publicación con fuente y fecha de captura; métricas diferenciadas por plataforma. |
| Informe de resultados | Pendiente | `campana_evaluaciones` existe, pero no tiene consumidor funcional identificado. Depende de métricas y de definir agregación, presupuesto y análisis cualitativo. | Informe por campaña con periodos, fuentes y datos faltantes explícitos. |
| Sorteos | Pendiente | `inventario_premios` existe sin consumidor identificado. Definir plataforma, elegibilidad, exclusiones, duplicados y auditoría. | Sorteo reproducible y auditable desde una fuente autorizada de comentarios. |

## Fase 3 — Integraciones (P3)

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| Solicitud de Diseño externa | Parcial; interfaz nueva pendiente | El flujo interno existe. Decidir entre formulario público y portal autenticado; no exponer cola interna ni enlaces privados. | Entrada externa validada, protegida contra abuso y con trazabilidad. |
| Email | Pendiente / alcance ambiguo | Distinguir notificaciones transaccionales de bandeja completa de entrada/salida. | Caso de uso, proveedor, permisos, revocación y fallos definidos. Si solo hacen falta avisos, evitar construir una bandeja completa. |
| WhatsApp | Pendiente de investigación | Definir fuente compatible/autorizada, historial accesible, identidad del remitente, privacidad y límites de API. Que WhatsApp Business esté en un grupo no garantiza acceso programático a su historial. | Prueba de viabilidad, permisos/consentimiento aprobados, mapeo de remitentes y sincronización documentados. |
| Meta Business | Pendiente | Delimitar plataformas, cuentas, formatos, permisos, tokens y estados de error. | Publicación autorizada de prueba; expiración/revocación de tokens y errores trazables. |
| Base de datos de productos | Pendiente | Definir fuente autorizada de imágenes, SKU, categorías, versiones, derechos de uso y sincronización. | Búsqueda y ficha de producto con imagen autorizada, fuente y vigencia. |
| SMS Ya+ | Idea nueva; por evaluar | La nota propone usar una pasarela local con API REST para SMS en eventos, concursos u otras funciones de marketing. Validar documentación/API, cobertura y coste, remitente, consentimiento, bajas, límites, privacidad y manejo de fallos. Elegir primero un caso de uso concreto. | Prueba de concepto con proveedor autorizado, registro de entregas/fallos, control de consentimiento y límites de envío. |
 
## Fase 4 — Activaciones y tecnologías para Eventos/Marketing (P4)

Estas ideas son exploratorias; no se debe asumir que requieren una integración con la aplicación hasta validar el caso de uso.

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| NFC | Exploratoria / por definir | Proponer escenarios concretos para eventos, concursos o campañas: identificación, acceso a información, registro o interacción. Definir etiquetas, destino, gestión de enlaces, seguridad contra clonación/abuso y alternativa sin NFC. | Caso de uso y piloto de bajo riesgo aprobados; datos personales y permisos revisados antes de producción. |
| Wi-Fi de tienda | Exploratoria / por definir | Definir qué significa “usar la red”: portal cautivo, landing de campaña, dinámica promocional o medición. Requiere coordinación con TI/administrador de red, cobertura, consentimiento, privacidad y seguridad de la red interna. | Prueba aislada de marketing que no exponga la red corporativa; consentimiento y tratamiento de datos documentados. |
| Calendario de eventos para todos los equipos | Registrado en Fase 1 | Tratarlo como extensión de lectura y permisos, no como acceso general a gestión de Eventos. | Vista de solo lectura con autorización por rol. |

## Fase 5 — Experiencia visual y almacenamiento (P5)

| Idea | Estado | Pendiente y dependencias | Criterio de cierre |
|---|---|---|---|
| Modo oscuro | Pendiente | Definir tema, persistencia y contraste. | Vistas principales legibles en ambos temas. |
| Temas | Pendiente / ambiguo | Distinguir tema visual de la aplicación por temporada de plantillas de campaña/contenido. | Caso de uso definido y tokens centralizados. |
| Limpieza de Drive | Por definir; riesgo alto | La nota propone vaciar Drive para guardar en local. Definir objetivo, propiedad de archivos, referencias, copias, retención y recuperación antes de mover/borrar. | Política aprobada, inventario de referencias, backup verificado y migración ensayada; no automatizar borrados de producción antes. |

## Ideas ya implementadas o parcialmente cubiertas — no rehacer desde cero

| Idea | Estado actual documentado |
|---|---|
| Perfil Eventos | Rol, inventario y programación existen; se requiere validar el despliegue. |
| Papelera | Archivo/restauración/purga implementados para publicaciones; no es una papelera universal. |
| Filtros | Grid ya tiene filtros; solo faltan criterios/ordenamientos identificados. |
| Diseño de modales | Crear/Editar/Detalle existen; quedan secciones inactivas. |
| Assets | Carga de Brief y entregables a Drive existe; operaciones adicionales por definir. |
| Estado de Brief | SLA y flujo existen; quedan remates de fechas/reglas y verificación remota. |
| Solicitudes | Inbox, conversión y rechazo existen; notificaciones pendientes. |
| Solicitud de Diseño | Flujo interno existe; queda decidir qué hacer con Google Forms/Sheets y la interfaz externa. |
| Inventarios | Inventario de Eventos existe; el inventario de insumos de Social Media requiere definición. |
| Calendario de Eventos | Calendario y programación existen para rol Eventos; la nueva petición es una vista de solo lectura para otros equipos. |

## Decisiones antes de estimar

1. **Assets:** ¿gestionar archivos de Drive o editar su contenido dentro de Kromi?
2. **Email:** ¿notificaciones o bandeja completa?
3. **Solicitud de Diseño:** ¿formulario público, portal externo o reemplazo integral de Trello?
4. **Inventario:** ¿Social Media necesita inventario propio o compartido?
5. **Miembros del equipo:** ¿qué significa “Equipo” frente a “Sedes”?
6. **Temas:** ¿tema visual de la app o plantillas de campaña?
7. **Limpieza de Drive:** ¿qué problema resuelve mover archivos a local?
8. **NFC/Wi-Fi/SMS:** ¿qué dinámica de marketing concreta se quiere habilitar, qué datos recogería y quién operaría el sistema?

## Roadmap resumido

| Orden | Entrega | Resultado |
|---:|---|---|
| 0 | Reconciliar Supabase y auditar permisos/RPC/RLS | Estado real y riesgos conocidos. |
| 1 | Pruebas de Brief, Diseño, archivo e Inventario/Calendario | Flujos existentes confiables. |
| 2 | SLA/rodaje, modales, filtros y detalle diario | Operación editorial completa. |
| 3 | Vista de calendario de Eventos de solo lectura, perfiles/equipo e inventario de Social Media definido | Colaboración entre equipos sin ampliar permisos de escritura. |
| 4 | Métricas e informes por campaña | Medición de resultados. |
| 5 | Solicitud externa y notificaciones | Entrada y comunicación consistentes. |
| 6 | Viabilidad de WhatsApp, Meta Business, catálogo y SMS Ya+ | Integraciones delimitadas y aprobadas. |
| 7 | Pilotos NFC/Wi-Fi, sorteos, temas, modo oscuro y almacenamiento | Extras y activaciones controladas. |

## Referencias

- [SRS e informe técnico](https://github.com/ernest0dev/kromi-connect/blob/main/docs/kromi-connect-srs.md)
- [Perfiles de usuario](https://github.com/ernest0dev/kromi-connect/blob/main/docs/perfiles-de-usuario.md)
- [Seguimiento de implementación](https://github.com/ernest0dev/kromi-connect/blob/main/docs/seguimiento-implementacion-srs.md)
- [Migraciones Supabase](https://github.com/ernest0dev/kromi-connect/blob/main/docs/supabase-db-migration.md)
- [Esquema público](https://github.com/ernest0dev/kromi-connect/blob/main/docs/supabase-schema-public.md)
- [Plan Brief Drive](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/plan-validacion-brief-drive.md)
- [Plan inventario Eventos](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/plan-inventario-eventos.md)
- [Especificación de modales](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/modales-publicacion.md)
- [Plan programación Eventos](https://github.com/ernest0dev/kromi-connect/blob/main/docs/design/plan-eventos-programacion.md)

**Mantenimiento:** actualizar este backlog cuando cambie el estado de una idea o se verifique una implementación nueva. El backlog organiza prioridades; no sustituye los requisitos técnicos del SRS ni los planes específicos.
