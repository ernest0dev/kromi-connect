# Kromi Connect — Informe Técnico y SRS (Fase 1: Perfil Social Media Manager)

> Documento interno de seguimiento operativo de desarrollo. No apto para distribución externa ni comercial.
> Stack objetivo: Next.js (App Router) + Supabase/PostgreSQL + Server Actions.
> **Estado del documento:** actualizado al 2026-10-10. Secciones 1-5: alcance funcional; secciones 6-7: estado auditado del repositorio. El usuario confirma que `202610100001_publication_workflow_archive.sql` se ejecutó en Supabase; esta actualización no consultó la instancia remota.

---

## Estado de implementación actualizado (2026-10-10)

La vista `/social-media/grid` cuenta con modales de Crear, Editar y Detalle rediseñados, y una vista separada de Archivo. Social Media administra el contenido y sus transiciones editoriales; Design tiene una cola inicial en `/design/publications` para tomar solicitudes y entregar piezas. La migración `202610100001_publication_workflow_archive.sql` agrega las tablas, columnas, permisos, políticas y RPC descritas en la sección 4; su ejecución fue confirmada por el usuario, pero este documento no afirma haber verificado la instancia remota.

La funcionalidad de Design es una primera cola compartida y no un sistema de asignación, carga de archivos o versiones. No hay interfaz de Gerencia. Los detalles de alcance y pendientes están en [`design/modales-publicacion.md`](design/modales-publicacion.md) y el perfil futuro en [`perfiles-de-usuario.md`](perfiles-de-usuario.md).

## 1. Perfil de Usuario: Responsable de Redes Sociales

La ficha funcional mantenible de este perfil, junto con el inventario de perfiles futuros, está en [`perfiles-de-usuario.md`](perfiles-de-usuario.md). Esta sección conserva el alcance del SRS y su contraste con la implementación; los roles y permisos técnicos se especifican por separado en §7.

**Perfil funcional unificado (fase inicial):** Estrategia/Especialista en Redes Sociales + Creador de Contenido/Producción. Esta descripción funcional no implica un único permiso técnico ni reemplaza el modelo de roles y permisos de §7.

**Alcance operativo:**
- Planificación de calendario de contenido mensual.
- Redacción de briefs y copys.
- Coordinación de rodaje en sede (Prebo, Mañongo).
- Gestión de solicitudes de terceros (inbox).
- Seguimiento de entregas de diseño (SLA).
- Control de métricas y escucha social.

**Interacciones de alto nivel:**

| Con | Flujo |
|---|---|
| Diseñador Gráfico | Genera brief con assets vinculados de Drive → QA/revisión antes de aprobación |
| Gerencia de Mercadeo | Envía entregables aprobados internamente → reporta métricas, escucha social e inventario |
| Departamentos externos (Compras, HR, Proveedores) | Solicitudes entran por inbox → se convierten en tickets de contenido |

---

## 2. Requisitos Funcionales (por bloque)

Estados usados: **Implementado**, **Parcial**, **Pendiente**, **No verificado**. Se refieren al código inspeccionado en la auditoría de la sección 6 y no implican verificación del entorno Supabase desplegado.

### 2.1 Generación y Gestión de Contenido
- Planificación de calendario de contenido mensual y cálculo automatizado de fechas. **Parcial:** `/social-media/grid` muestra calendario mensual y permite reprogramar; el SLA implementado calcula `fecha_limite_brief = fecha_publicacion - 5 días`. La fecha límite de rodaje (`fecha_publicacion - 3 días`) no está implementada.
- Generación de cronograma de producción y guiones de rodaje para piso de tienda. **Parcial:** existe `/social-media/shooting`, pero muestra publicaciones e idea principal; no usa `checklist_rodaje` ni ofrece guion estructurado por tomas/zonas.
- Creación y edición de solicitudes de diseño. **Implementado en Grid:** modales de Crear, Editar y Detalle para formato, cuentas, temas, copy/hashtags, programación, estado y SLA. El versionado de copy y la asignación individual de diseñador no están implementados.
- Flujo de revisión/corrección/aprobación externa. **Implementado para el flujo acordado:** la RPC valida actor y transición; Design inicia/entrega y Social Media devuelve, cancela y registra los estados posteriores. No existe aprobación dentro de la app por Gerencia.
- Trazabilidad de tiempos: `fecha_solicitud_diseno` vs `fecha_entrega_diseno_real` y SLA cumplido/incumplido. **Parcial:** existen campos de fechas y cálculo condicional de entrega estimada; no se verificó un reporte de cumplimiento real.
- Programación, publicación y **reprogramación inversa**. **Parcial:** Quick Reschedule actualiza fecha de publicación, límite de brief y, si hay fecha de solicitud de diseño, entrega estimada. No recalcula una fecha de rodaje, que no existe en el esquema actual.
- Tabla tipo spreadsheet para operación de publicaciones. **Pendiente:** no se encontró en las rutas auditadas.

### 2.2 Planificación Estratégica de Campañas
- Categorización de campañas: Temporada, Evento, Efeméride, Lanzamiento, Oferta puntual. **Implementado**; la asociación muchos a muchos con efemérides queda implementada en esta actualización y requiere aplicar la migración `202609280002_campaign_efemerides.sql` en Supabase.
- Catálogo anual independiente de efemérides: **Implementado** en `/social-media/efemerides` (alta, consulta por año, edición y eliminación; requiere aplicar la migración `202609280001_annual_efemerides.sql` en Supabase).
- Capa anual de efemérides y campañas EFEMERIDE vinculadas en Grid: **Implementada** con indicadores y fichas de detalle; depende de las migraciones anuales y de relación. Las campañas finalizadas siguen visibles atenuadas y las archivadas se ocultan. La capa de alianzas con proveedores: **Pendiente.**
- Informes post-mortem por campaña (alcance, interacciones, presupuesto, cualitativo). **Pendiente:** la tabla está tipada, pero no tiene consumidor identificado.

### 2.3 Recepción y Publicación de Solicitudes de Terceros
- Inbox de requerimientos entrantes (Compras, HR/Selección, Gerencia). **Implementado** en `/social-media/requests`.
- Conversión 1-clic de solicitud externa → ticket de contenido (`publicaciones` row pre-poblada desde `solicitudes_terceros`). **Implementado:** se crea la publicación con SLA calculado y se vincula la solicitud como convertida; también se soporta rechazo.
- Módulo de sorteos/concursos + inventario de premios físicos por sede. **Pendiente:** la tabla existe, pero no se halló funcionalidad consumidora.

### 2.4 Informes, Escucha Social y Analítica
- Log semanal de escucha social (quejas, sugerencias, atención en RRSS). **Pendiente** para `reporte_atencion_cliente`; existe además `/support`, con una tabla `atencion_cliente` diferente, cuya relación funcional con este SRS no está confirmada.
- Dashboard de métricas consolidadas: crecimiento, reach, interacciones, top posts. **Pendiente / no verificado:** no se encontró `/reportes` en las rutas exploradas.

---

## 3. Módulos, rutas y roadmap (Next.js App Router)

Las rutas siguientes son las identificadas en el código auditado. Las fases conservan el roadmap objetivo y reflejan el estado observado; no son una afirmación de que la fase esté completa.

### Fase 1 — Core Operativo (Grid, Kanban & Briefing) — parcial
- `/social-media/grid` — calendario mensual con filtro por formato, drag-and-drop de fechas, edición rápida de título/fecha e indicadores SLA.
- `/social-media/kanban` — tablero de publicaciones con detalle de copy y reprogramación. Grid y Kanban son rutas independientes sobre `publicaciones`, con capacidades de edición distintas; no existe la tercera vista spreadsheet.
- `/dashboard` — resumen operativo y alertas SLA. **No verificado:** la ruta no se encontró en el árbol explorado.
- Modales de publicación: **implementados parcialmente**. Crear, Editar y Detalle siguen `docs/design/modales-publicacion.md`; las pestañas Producción e Historial de Editar permanecen inactivas.

### Fase 2 — Producción & Asset Management — parcial / pendiente
- `/social-media/shooting` — lista de publicaciones en preparación/rodaje y acción de envío a Diseño. No usa `checklist_rodaje`; PWA no verificada.
- Guiones/checklist de rodaje estructurados y visor/ingesta de Assets Drive — **Pendiente** según código auditado.

### Fase 3 — Gestión de Terceros & Aprobaciones — parcial
- `/social-media/requests` — inbox y conversión/rechazo de solicitudes implementados.
- QA pre-publicación y envío de paquete a Gerencia — **Pendiente** según código auditado.

### Fase 4 — Inventario & Tipificación de Campañas — parcial
- Inventario de premios por sede — sin consumidor identificado. La tipificación, los vínculos campaña-efemérides y su contexto en Grid ya cuentan con flujo; las alianzas con proveedores siguen pendientes.
- `/social-media/campaigns` permite categorizar campañas y vincular múltiples efemérides anuales cuando el tipo es `EFEMERIDE`.

### Fase 5 — Analytics & Social Listening — pendiente / no verificado
- `/reportes`, dashboard mensual, escucha social e informes post-mortem — no se encontraron en las rutas exploradas; verificar en una auditoría posterior.

### Módulos adicionales detectados — clasificación pendiente
- `/support` — gestión de tickets de atención al cliente mediante tabla `atencion_cliente`, distinta de `reporte_atencion_cliente`. No se ha confirmado si complementa o reemplaza el alcance de escucha social.
- `/third-parties` — directorio de contactos externos; es distinto del inbox de solicitudes y no estaba contemplado en el roadmap original.

---

## 4. Esquema de Base de Datos (Supabase/PostgreSQL)

### 4.1 Enums

```sql
CREATE TYPE formato_enum AS ENUM ('CARRUSEL', 'POST', 'REEL', 'STORY');

CREATE TYPE estatus_enum AS ENUM (
  'PENDIENTE_BRIEF', 'EN_RODAJE', 'SOLICITADO', 'EN_DISENO',
  'EN_REVISION_CM', 'EN_CORRECCION', 'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA', 'APROBADO', 'PROGRAMADO',
  'PUBLICADO', 'CANCELADO', 'INCOMPLETO'
);

CREATE TYPE tipo_campana_enum AS ENUM (
  'TEMPORADA', 'EVENTO', 'EFEMERIDE', 'LANZAMIENTO', 'OFERTA_PUNTUAL'
);

CREATE TYPE departamento_enum AS ENUM (
  'COMPRAS', 'SELECCION', 'PROVEEDOR', 'GERENCIA', 'EVENTOS'
);

CREATE TYPE canal_enum AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK');
CREATE TYPE sede_enum AS ENUM ('PREBO', 'MANONGO');
```

### 4.2 Tablas

```sql
-- Campañas
CREATE TABLE campanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo_campana tipo_campana_enum NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Publicaciones (entidad central)
CREATE TABLE publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id UUID REFERENCES campanas(id),
  titulo TEXT NOT NULL,
  formato formato_enum NOT NULL,
  linea_contenido TEXT,
  fecha_publicacion DATE NOT NULL,
  fecha_limite_brief DATE,               -- calculado: fecha_publicacion - 5
  fecha_solicitud_diseno TIMESTAMPTZ,
  fecha_entrega_diseno_estimada DATE,    -- calculado: fecha_solicitud_diseno + 2
  fecha_entrega_diseno_real TIMESTAMPTZ,
  fecha_aprobacion_gerencia TIMESTAMPTZ,
  estatus estatus_enum NOT NULL DEFAULT 'PENDIENTE_BRIEF',
  hook_texto TEXT,
  body_texto TEXT,
  cta_texto TEXT,
  hashtags TEXT[],
  version_copy INT DEFAULT 1,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  creador_id UUID REFERENCES auth.users(id),
  disenador_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Canales de publicación (1:N)
CREATE TABLE publicacion_canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id UUID NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  canal canal_enum NOT NULL,
  social_account_id UUID REFERENCES social_accounts(id),
  estado_publicacion TEXT DEFAULT 'PENDIENTE',
  url_publicacion TEXT,
  UNIQUE (publicacion_id, social_account_id)
);

-- Checklist de rodaje (1:N)
CREATE TABLE checklist_rodaje (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id UUID NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  toma_requerida TEXT NOT NULL,
  area_tienda TEXT NOT NULL,           -- zona física específica (ej. "Barra de Carnicería", "Fruver", "Anaquel Central")
  sucursal sede_enum NOT NULL,         -- sede: PREBO / MANONGO
  completado BOOLEAN DEFAULT FALSE
);

-- Solicitudes de terceros (inbox)
CREATE TABLE solicitudes_terceros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_emisor departamento_enum NOT NULL,
  tipo_solicitud TEXT NOT NULL,
  descripcion TEXT,
  materiales_adjuntos_url TEXT[],      -- múltiples enlaces/archivos de referencia
  estatus_solicitud TEXT DEFAULT 'PENDIENTE',
  publicacion_id UUID REFERENCES publicaciones(id), -- se llena al convertir a ticket
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventario de premios (sorteos/concursos)
CREATE TABLE inventario_premios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_nombre TEXT,
  nombre_premio TEXT NOT NULL,
  cantidad_recibida INT DEFAULT 0,
  cantidad_entregada INT DEFAULT 0,
  sucursal_ubicacion sede_enum NOT NULL,
  campana_id UUID REFERENCES campanas(id),
  solicitud_id UUID REFERENCES solicitudes_terceros(id), -- trazabilidad opcional: origen del premio (acuerdo/proveedor)
  estado_premio TEXT DEFAULT 'EN_STOCK'
);

-- Log de escucha social / atención al cliente
CREATE TABLE reporte_atencion_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_semana DATE NOT NULL,
  canal canal_enum NOT NULL,
  tipo TEXT NOT NULL,          -- QUEJA / SUGERENCIA / CONSULTA
  categoria TEXT,
  detalle_comentario TEXT,
  accion_tomada TEXT,
  status TEXT DEFAULT 'ABIERTO'
);

-- Evaluación post-mortem de campaña
CREATE TABLE campana_evaluaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id UUID NOT NULL REFERENCES campanas(id),
  alcance_total BIGINT,
  interacciones_totales BIGINT,
  presupuesto_ejecutado NUMERIC(12,2),
  informe_cualitativo TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 Extensión actual del esquema de publicaciones

El modelo de destinos usa `social_accounts` y `user_social_accounts`; `publicacion_canales.social_account_id` identifica la cuenta concreta y la unicidad es por publicación/cuenta. `publicacion_categorias` relaciona publicaciones con `categorias_contenido`. El acceso respeta las cuentas asignadas; para editar o archivar se exige alcance sobre todas las cuentas destino.

La migración `202610100001_publication_workflow_archive.sql` agrega columnas de hora, rodaje, sedes (`sede_enum[]`), prioridad, archivo y limpieza de Drive; crea `publicacion_estatus_historial` y `publicacion_comentarios`; y añade las RPC, permisos y policies del flujo. El detalle está en [`supabase-db-migration.md`](supabase-db-migration.md). No se implementa asignación individual a Design.

### 4.4 Notas de implementación (Server Actions / lógica)

- **Cálculo de fechas SLA:** debe vivir como lógica de aplicación (Server Action `recalcularFechasSLA(publicacionId, nuevaFechaPublicacion)`), no como trigger de DB en esta fase — facilita ajustar la regla 3+2 sin migraciones.
- **Quick Reschedule:** una sola Server Action que actualiza `fecha_publicacion` y dispara el recálculo en cascada de `fecha_limite_brief` y `fecha_entrega_diseno_estimada`.
- **Autorización/RLS:** roles, permisos y policies se definen por migraciones versionadas. El usuario confirma que ejecutó `202610100001_publication_workflow_archive.sql`; comprobar el estado remoto y hacer `supabase db pull` antes de ampliar el esquema.
- **Conversión de solicitud a ticket:** Server Action que crea row en `publicaciones` copiando `descripcion` → `body_texto` y `materiales_adjuntos_url[]` → referencia inicial de Drive, y actualiza `solicitudes_terceros.publicacion_id` + `estatus_solicitud = 'CONVERTIDA'`.
- **Trazabilidad de premios:** `inventario_premios.solicitud_id` es opcional — se llena solo cuando el premio proviene de un acuerdo/oferta canalizado vía `solicitudes_terceros` (ej. Compras o Proveedor); premios gestionados directamente por Mercadeo pueden dejarlo en `NULL`.
- **Checklist de rodaje:** `area_tienda` pasó a `TEXT` libre para admitir zonas específicas no enumerables de antemano; `sucursal` (enum) queda como el filtro estructurado por sede para reportes y vistas.

---

## 5. Resumen, estado y escalabilidad

**Resultado esperado (fin de Fase 5):** 100% de la operación del perfil Social Media centralizada en Kromi Connect, eliminando dependencia de hojas de cálculo dispersas, con trazabilidad de SLA de diseño y automatización de subida de assets a Drive.

**Preparación para escalar:** el modelo de datos y las vistas actuales no requieren refactor estructural para habilitar en fases futuras:
- Panel de **Diseño Gráfico** (Kanban centrado en `disenador_id` y estados de renderizado/assets).
- Panel de **Gerencia de Mercadeo** (dashboard ejecutivo de aprobación 1-clic + ROI de campañas, consumiendo `campana_evaluaciones` y `publicaciones.fecha_aprobacion_gerencia`).

**Lectura del estado actual:** Grid, Kanban, Rodaje, Solicitudes y Campanas tienen rutas con cobertura desigual. El editor de publicaciones y el flujo inicial de Design se actualizaron en octubre de 2026; las brechas que siguen vigentes incluyen checklist estructurado, asignacion individual de diseno, QA de Gerencia dentro de la app, inventario y analitica. Ver la actualizacion y limites en las secciones 6 y 7.

---

## 6. Auditoría de Implementación contra Código Real (parcial)

> Auditoría del repositorio `ernest0dev/kromi-connect`, rama `main`, según el informe adjunto. Las capacidades se consideran implementadas solo cuando el informe describe el flujo de datos/código observado. No se verificaron módulos completos, configuración desplegada de Supabase ni ramas distintas de `main`.

### 6.0 Nomenclatura de Grid y Kanban

El diseño inicial describía `/calendario` como tres vistas del mismo dataset. El código separa Grid y Kanban en rutas independientes, cada una con su propio estado y capacidades:

- `/social-media/grid`: calendario macro mensual.
- `/social-media/kanban`: tablero por estatus.
- No se encontró vista spreadsheet en las rutas auditadas.

Son proyecciones de `publicaciones`, pero no interfaces equivalentes: Grid permite edición rápida de título/fecha y Kanban muestra el copy completo.

### 6.1 Grid (`/social-media/grid`)

**Implementado en el cliente:** calendario mensual, filtros, reprogramación, tarjetas y modales Crear/Editar/Detalle. Crear admite prefill de fecha, formato, campaña, cuenta(s), temas, copy y hashtags normalizados, hora opcional y datos de producción disponibles en el esquema; muestra SLA de brief y puede crear/reintentar la carpeta de Drive. Editar separa Contenido y Flujo y SLA; los controles de Producción e Historial están inactivos. Detalle incluye destinos, copy copiable, temas, producción, SLA, historial y observaciones.

**Transiciones del flujo:** Social Media envía a `SOLICITADO` desde las etapas previas permitidas; desde `EN_REVISION_CM` puede solicitar `EN_CORRECCION` (motivo obligatorio), dejar `PENDIENTE_APROBACION_GERENCIA`, pasar a `PROGRAMADO` o `PUBLICADO`; registra `APROBADO` cuando recibe aprobación externa y confirma `PUBLICADO` desde `PROGRAMADO`. Puede cancelar desde cualquier estado no terminal con motivo obligatorio. Las transiciones se validan en `transition_publicacion_status`, con historial y fechas reales registradas por el sistema.

**Archivo:** acción separada de borrado lógico, restauración durante un mes calendario y resolución manual de fallos de Drive. La purga automática diaria de publicaciones vencidas se ejecuta desde un endpoint programado de servidor; SQL por sí solo no elimina carpetas de Drive.

**Fuera de alcance:** duplicar/repetir, versionado del copy, edición de datos de Producción desde la pestaña de Editar, vista spreadsheet y aprobación propia de Gerencia.

### 6.2 Kanban (`/social-media/kanban`)

**Implementado y confirmado:** tablero con siete columnas (`PENDIENTE_BRIEF`, `EN_RODAJE`, `EN_DISENO`, `EN_REVISION_CM`, `APROBADO`, `PROGRAMADO`, `PUBLICADO`); modal/drawer con reprogramación, ficha de copy completa y enlace a Drive.

**Brechas:** no hay columna para `RECHAZADO_DISENO` ni `PENDIENTE_APROBACION_GERENCIA`; los tickets con esos valores quedan fuera de las columnas definidas. No se confirmó interacción drag-and-drop para cambiar estatus.

### 6.3 SLA y Quick Reschedule

Según `src/utils/sla.ts` y `src/app/actions/publicaciones/recalculateSla.ts`:

- Se calcula `fecha_limite_brief = fecha_publicacion - 5 días`.
- `fecha_entrega_diseno_estimada = fecha_solicitud_diseno + 2 días` solo se calcula si existe `fecha_solicitud_diseno`.
- No existe campo ni cálculo de fecha límite de rodaje (`fecha_publicacion - 3 días`).
- La acción de reprogramación actualiza `fecha_publicacion`, `fecha_limite_brief` y la entrega estimada cuando corresponde; Grid y Kanban la consumen y ambas rutas se revalidan.

Esto deja incompleta la regla de 3+2 días del requisito original: solo está materializado el límite de brief y, condicionalmente, la entrega estimada desde la solicitud de diseño.

### 6.4 Rodaje (`/social-media/shooting`)

El módulo lista publicaciones con estatus `PENDIENTE_BRIEF` o `EN_RODAJE`, permite enviarlas a Diseño y presenta `hook_texto` como idea principal y `linea_contenido` como referencia.

No consulta `checklist_rodaje`; no hay guion/checklist de tomas por zona. El filtro de sede del servidor intenta filtrar por `publicaciones.sede`, columna que no figura en los tipos de base de datos auditados. El filtro visible aplica una búsqueda textual de la sede dentro de `linea_contenido`, en lugar de un campo estructurado. La existencia de manifest/service worker PWA no se verificó.

### 6.5 Solicitudes, campañas y tablas sin consumidor

**Solicitudes (`/social-media/requests`):** el inbox consulta `solicitudes_terceros`; `processRequestAction` crea una publicación con SLA, marca la solicitud como `CONVERTIDA` y enlaza el ID. También permite rechazar solicitudes.

**Campañas (`/social-media/campaigns`):** permite categorizar con `tipo_campana_enum` y vincular varias efemérides anuales a campañas de tipo `EFEMERIDE`. Grid muestra las efemérides estáticas y las campañas vinculadas en sus periodos, con detalle de ambos rangos.

**Tablas tipadas sin consumidor en `src/app` según la búsqueda auditada:** `checklist_rodaje`, `inventario_premios`, `reporte_atencion_cliente`, `campana_evaluaciones` y `publicacion_canales`.

**Rutas adicionales detectadas:** `/support` usa la tabla `atencion_cliente`, distinta de `reporte_atencion_cliente`; `/third-parties` gestiona un directorio de contactos y es diferente del inbox de solicitudes. Su clasificación dentro del alcance del SRS está pendiente.

### 6.6 Pendiente de confirmar

La auditoría adjunta no confirmó lo siguiente; no se debe asumir que esté implementado o ausente:

- Flujos completos de `/support` y `/third-parties` (se confirmó su existencia y forma general, no todas sus mutaciones).
- Ubicación alternativa de `/dashboard` y `/reportes` fuera de los árboles explorados.
- Policies RLS efectivamente configuradas en Supabase. El repositorio ahora contiene migraciones y comprobaciones de permisos para páginas y Server Actions. Algunas acciones de negocio usan el cliente Service Role, que omite RLS; por eso sus comprobaciones de permiso en servidor son esenciales. El código preparado no demuestra que las migraciones ya se hayan aplicado al proyecto desplegado.
- Interacción de cambio de estatus por drag-and-drop en algún componente auxiliar de Kanban.
- Configuración PWA de `/social-media/shooting`.
- Trabajo en progreso en ramas distintas de `main`.

La auditoría describe revisión de código, no validación del despliegue ni de las policies en el proyecto vivo.

---

## 6.7 Cola del rol Design

Existe `/design/publications`, implementado en `src/app/(dashboard)/design/publications/`. Presenta una cola compartida de publicaciones activas en `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION`; no filtra ni asigna por `disenador_id`. Design puede abrir una solicitud (`EN_DISENO`) y entregar una pieza (`EN_REVISION_CM`); antes de entregar, el servidor requiere una carpeta de Drive con al menos un archivo. Al abrir una devolución, `EN_CORRECCION` vuelve a `EN_DISENO`. La cola muestra el brief y las observaciones de corrección. No incluye carga de archivos en la app, versionado ni aprobación/publicación.

La acción `src/app/actions/publicaciones/workflow.ts` y las RPC `get_design_publication_queue()` y `transition_publicacion_status(...)` validan los permisos y el estado de las operaciones.

## 7. Autenticación, roles y permisos (implementados en repositorio; despliegue sujeto a verificación)

Esta sección define roles de acceso y permisos técnicos. No es un catálogo completo de perfiles funcionales; para responsabilidades, tareas y necesidades de producto, consultar [`perfiles-de-usuario.md`](perfiles-de-usuario.md).

### 7.1 Estado y alcance

Se añadió una base de login/logout con Supabase Auth y sesiones SSR mediante `@supabase/ssr` (`^0.12.7`). El registro público no forma parte del flujo: las cuentas se crean en Supabase Auth y el trigger genera su perfil con rol inicial `pending`. Los usuarios autenticados sin perfil habilitado o con rol `pending` reciben acceso pendiente. Este trabajo está en el repositorio; todavía no confirma que las migraciones se hayan ejecutado en el proyecto Supabase.

### 7.2 Roles definidos

Los códigos persistidos son estables y usan inglés; los nombres visibles están en español:

| Código | Etiqueta | Acceso actual |
|---|---|---|
| `pending` | Acceso pendiente | Sin vistas de negocio |
| `social-media` | Social Media | Grid, campañas y efemérides según permisos concedidos |
| `events` | Eventos | Sin permisos de negocio asignados |
| `design` | Diseño | Cola de publicaciones y transiciones de inicio/entrega |
| `internal` | Interno | Sin permisos de negocio asignados |
| `customer-support` | Atención al cliente | Sin permisos de negocio asignados |
| `management` | Gerencia | Sin permisos de negocio asignados |
| `admin` | Administrador | Puede gestionar roles/perfiles; no recibe permisos de negocio automáticamente |

El rol `admin` se limita al control de acceso (`can_manage_access()`); no equivale a acceso completo a publicaciones, campañas o tickets. El módulo `/support` queda sin acceso habilitado hasta que se definan permisos para ese rol. Los futuros módulos requieren definir nuevos permisos y asignarlos explícitamente. La interfaz puede ocultar navegación sin permiso, pero la decisión de acceso se vuelve a comprobar en servidor.

### 7.3 Catálogo de permisos actualmente aprobado

- `social-media.grid.read` para abrir Grid.
- `social-media.posts.{read,create,edit,reschedule,status.update}` para publicaciones. El borrado es lógico mediante `archive`/`restore`; la purga definitiva queda en acciones protegidas del servidor.
- `social-media.posts.{archive,restore,purge.resolve}` y permisos de consulta/actualización de rodaje se agregan en `202610100001_publication_workflow_archive.sql`.
- `design.posts.{read,start,deliver}` para la cola acotada y los eventos de inicio y entrega.
- `social-media.campaigns.{read,create,update,status.update,archive,evaluation.create}` para campañas.
- `social-media.efemerides.{read,create,update,delete}` para efemérides.

`customer-support`, `events` e `internal` no reciben concesiones de negocio en esta implementación. `design` sí tiene los permisos enumerados arriba; `management` no interviene en aprobaciones dentro de la app. La interfaz puede ocultar navegación sin permiso, pero servidor y RPC vuelven a validar el acceso.

El catálogo puede conservar el código histórico `social-media.posts.delete` de migraciones previas, pero el flujo actual usa Archivo: se revocó el borrado directo para `authenticated`; las acciones de purga se ejecutan en servidor con comprobaciones de permiso.

### 7.4 Componentes del repositorio

| Ubicación | Responsabilidad |
|---|---|
| `src/lib/supabase/browser.ts` | Cliente Supabase para componentes cliente que lo necesiten. |
| `src/lib/supabase/server.ts` | Cliente SSR del servidor, lectura/escritura de cookies. |
| `src/proxy.ts` | Actualización de sesión/cookies SSR por petición; no sustituye autorización. |
| `src/lib/auth/permissions.ts` | Tipos de roles, etiquetas y permisos. |
| `src/lib/auth/dal.ts` | Verificación de usuario, perfil y permisos; guardas de páginas y acciones. |
| `src/app/actions/auth.ts` | Acciones de login con contraseña y logout. |
| `src/app/(auth)/login/` | Vista y formulario de inicio de sesión. |
| `src/app/(auth)/access-pending/` | Vista para usuario sin rol habilitado. |
| `src/app/(dashboard)/layout.tsx` y `components/DashboardShell.tsx` | Protección del área autenticada y datos de usuario/rol en la navegación. |
| `supabase/migrations/202610050001_auth_roles_permissions.sql` | Tablas de roles/permisos/perfiles, funciones auxiliares, trigger y concesiones actuales. |
| `supabase/migrations/202610060001_role_permission_policies.sql` | RLS y policies de las tablas de negocio incluidas en la migración. |

Las páginas y Server Actions existentes se guardan según sus permisos. Algunas operaciones aún acceden a datos mediante el cliente administrativo Service Role, que omite RLS: en esos flujos la autorización depende de la comprobación explícita en la Server Action. No se debe exponer ese cliente ni su secreto al navegador.

### 7.5 Despliegue y verificación de Supabase

El usuario confirma que ejecutó `supabase/migrations/202610100001_publication_workflow_archive.sql` en Supabase. Esta documentación no se conectó a la instancia para verificarlo. Antes de futuras modificaciones, comparar la línea base desplegada con `supabase db pull` y auditar objetos, grants, RLS, triggers y funciones.

La migración incorpora tablas de historial/comentarios, columnas de Archivo/Drive/producción, permisos de Social Media y Design, policies y RPC. El detalle se registra en [`supabase-db-migration.md`](supabase-db-migration.md) y en `docs/design/modales-publicacion.md`. La captura `docs/supabase-schema-public.png` fue actualizada por el usuario; la migración no altera el esquema `auth`, por lo que `supabase-schema-auth.png` no requiere cambio por este flujo.

La ejecución de una migración no sustituye pruebas con usuarios reales por rol ni verifica la configuración de `CRON_SECRET`, credenciales de Drive y cron del despliegue. La purga programada vive en `/api/cron/purge-publicaciones` y requiere `CRON_SECRET`.
