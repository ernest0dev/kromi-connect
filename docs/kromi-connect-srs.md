# Kromi Connect — Informe Técnico y SRS (Fase 1: Perfil Social Media Manager)

> Documento interno de seguimiento operativo de desarrollo. No apto para distribución externa ni comercial.
> Stack objetivo: Next.js (App Router) + Supabase/PostgreSQL + Server Actions.
> **Estado del documento:** las secciones 1–5 expresan el alcance y diseño objetivo; la sección 6 contrasta ese diseño con una auditoría parcial del código. En la sección 2, cada requisito incluye su estado de implementación conocido.

---

## 1. Perfil de Usuario: Responsable de Redes Sociales

**Rol unificado (fase inicial):** Estrategia/Especialista en Redes Sociales + Creador de Contenido/Producción, bajo un único `role` y set de permisos (RLS policy única en esta fase; sin distinción de sub-permisos todavía).

**Alcance operativo:**
- Planificación de grilla mensual.
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
- Planificación de grilla mensual y cálculo automatizado de fechas. **Parcial:** `/social-media/grid` muestra calendario mensual y permite reprogramar; el SLA implementado calcula `fecha_limite_brief = fecha_publicacion - 5 días`. La fecha límite de rodaje (`fecha_publicacion - 3 días`) no está implementada.
- Generación de cronograma de producción y guiones de rodaje para piso de tienda. **Parcial:** existe `/social-media/shooting`, pero muestra publicaciones e idea principal; no usa `checklist_rodaje` ni ofrece guion estructurado por tomas/zonas.
- Creación de solicitudes de diseño (brief técnico: dimensiones, copy versionado, badges). **Parcial:** Kanban muestra hook, body, CTA y hashtags; Grid solo permite editar título y fecha. No se verificó un editor técnico completo de brief.
- Flujo de revisión/corrección/aprobación con estados de retorno explícitos. **Parcial:** hay cambio de estatus, pero Grid permite cualquier transición y el Kanban no tiene interacción de arrastre de estado confirmada.
- Trazabilidad de tiempos: `fecha_solicitud_diseno` vs `fecha_entrega_diseno_real` y SLA cumplido/incumplido. **Parcial:** existen campos de fechas y cálculo condicional de entrega estimada; no se verificó un reporte de cumplimiento real.
- Programación, publicación y **reprogramación inversa**. **Parcial:** Quick Reschedule actualiza fecha de publicación, límite de brief y, si hay fecha de solicitud de diseño, entrega estimada. No recalcula una fecha de rodaje, que no existe en el esquema actual.
- Tabla tipo spreadsheet para operación de publicaciones. **Pendiente:** no se encontró en las rutas auditadas.

### 2.2 Planificación Estratégica de Campañas
- Categorización: Temporada, Evento, Efeméride, Lanzamiento, Oferta puntual. **Pendiente:** el flujo de campañas usa estatus y presupuesto, pero no esta categorización.
- Calendario de efemérides + alianzas con proveedores como capa superpuesta a la grilla. **Pendiente.**
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
- Editor completo de ticket — **Pendiente/parcial:** el formulario de Grid solo edita título y fecha; Kanban expone la ficha de copy, pero no se confirmó edición completa.

### Fase 2 — Producción & Asset Management — parcial / pendiente
- `/social-media/shooting` — lista de publicaciones en preparación/rodaje y acción de envío a Diseño. No usa `checklist_rodaje`; PWA no verificada.
- Guiones/checklist de rodaje estructurados y visor/ingesta de Assets Drive — **Pendiente** según código auditado.

### Fase 3 — Gestión de Terceros & Aprobaciones — parcial
- `/social-media/requests` — inbox y conversión/rechazo de solicitudes implementados.
- QA pre-publicación y envío de paquete a Gerencia — **Pendiente** según código auditado.

### Fase 4 — Inventario & Tipificación de Campañas — pendiente
- Inventario de premios por sede y tipificación de campañas/efemérides — sin consumidores identificados.
- `/social-media/campaigns` existe; su flujo usa estatus `PLANIFICADA`/`ACTIVA`/`FINALIZADA` y presupuesto, y no la categorización `tipo_campana_enum` descrita en el esquema.

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
  'PENDIENTE_BRIEF',
  'EN_RODAJE',
  'EN_DISENO',
  'EN_REVISION_CM',
  'RECHAZADO_DISENO',
  'PENDIENTE_APROBACION_GERENCIA',
  'APROBADO',
  'PROGRAMADO',
  'PUBLICADO'
);

CREATE TYPE tipo_campana_enum AS ENUM (
  'TEMPORADA', 'EVENTO', 'EFEMERIDE', 'LANZAMIENTO', 'OFERTA_PUNTUAL'
);

CREATE TYPE departamento_enum AS ENUM (
  'COMPRAS', 'SELECCION', 'PROVEEDOR', 'GERENCIA', 'EVENTOS'
);

CREATE TYPE canal_enum AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE_SHORTS', 'FACEBOOK');
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
  estado_publicacion TEXT DEFAULT 'PENDIENTE',
  url_publicacion TEXT,
  UNIQUE (publicacion_id, canal)
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

### 4.3 Notas de implementación (Server Actions / lógica)

- **Cálculo de fechas SLA:** debe vivir como lógica de aplicación (Server Action `recalcularFechasSLA(publicacionId, nuevaFechaPublicacion)`), no como trigger de DB en esta fase — facilita ajustar la regla 3+2 sin migraciones.
- **Quick Reschedule:** una sola Server Action que actualiza `fecha_publicacion` y dispara el recálculo en cascada de `fecha_limite_brief` y `fecha_entrega_diseno_estimada`.
- **RLS:** en fase 1, policy única por `role = 'social_media'` con acceso total a las 8 tablas. Diseñar las policies ya pensando en roles futuros (`role = 'diseno'`, `role = 'gerencia'`) aunque no se implementen aún.
- **Conversión de solicitud a ticket:** Server Action que crea row en `publicaciones` copiando `descripcion` → `body_texto` y `materiales_adjuntos_url[]` → referencia inicial de Drive, y actualiza `solicitudes_terceros.publicacion_id` + `estatus_solicitud = 'CONVERTIDA'`.
- **Trazabilidad de premios:** `inventario_premios.solicitud_id` es opcional — se llena solo cuando el premio proviene de un acuerdo/oferta canalizado vía `solicitudes_terceros` (ej. Compras o Proveedor); premios gestionados directamente por Mercadeo pueden dejarlo en `NULL`.
- **Checklist de rodaje:** `area_tienda` pasó a `TEXT` libre para admitir zonas específicas no enumerables de antemano; `sucursal` (enum) queda como el filtro estructurado por sede para reportes y vistas.

---

## 5. Resumen, estado y escalabilidad

**Resultado esperado (fin de Fase 5):** 100% de la operación del perfil Social Media centralizada en Kromi Connect, eliminando dependencia de hojas de cálculo dispersas, con trazabilidad de SLA de diseño y automatización de subida de assets a Drive.

**Preparación para escalar:** el modelo de datos y las vistas actuales no requieren refactor estructural para habilitar en fases futuras:
- Panel de **Diseño Gráfico** (Kanban centrado en `disenador_id` y estados de renderizado/assets).
- Panel de **Gerencia de Mercadeo** (dashboard ejecutivo de aprobación 1-clic + ROI de campañas, consumiendo `campana_evaluaciones` y `publicaciones.fecha_aprobacion_gerencia`).

**Lectura del estado actual:** Grid, Kanban, Rodaje, Solicitudes y Campañas tienen rutas identificadas con cobertura desigual. La conversión de solicitudes está implementada; varias tablas del esquema siguen sin consumidor. Las brechas funcionales prioritarias que refleja esta especificación son el editor completo, la fecha límite de rodaje y checklist estructurado, la cobertura de estados en Kanban, QA/aprobación, inventario y analítica. La auditoría es parcial (ver §6.6).

---

## 6. Auditoría de Implementación contra Código Real (parcial)

> Auditoría del repositorio `ernest0dev/kromi-connect`, rama `main`, según el informe adjunto. Las capacidades se consideran implementadas solo cuando el informe describe el flujo de datos/código observado. No se verificaron módulos completos, configuración desplegada de Supabase ni ramas distintas de `main`.

### 6.0 Nomenclatura de Grid y Kanban

El diseño inicial describía `/parrilla` como tres vistas del mismo dataset. El código separa Grid y Kanban en rutas independientes, cada una con su propio estado y capacidades:

- `/social-media/grid`: calendario macro mensual.
- `/social-media/kanban`: tablero por estatus.
- No se encontró vista spreadsheet en las rutas auditadas.

Son proyecciones de `publicaciones`, pero no interfaces equivalentes: Grid permite edición rápida de título/fecha y Kanban muestra el copy completo.

### 6.1 Grid (`/social-media/grid`)

**Implementado y confirmado:** calendario mensual con navegación de meses; filtro solo por formato; reprogramación por arrastrar y soltar; cambio de estatus desde selector sin restricciones de transición; edición rápida de título y fecha; señal visual de SLA derivada solo de `fecha_limite_brief`; enlace a Drive si hay URL; actualización optimista con rollback ante error.

**No implementado en Grid:** tabla spreadsheet; editor completo de brief/guion/historial; capa de campañas o efemérides; fecha límite de rodaje. Los campos `hook_texto`, `body_texto`, `cta_texto` y `hashtags` no tienen inputs en Grid.

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

**Campañas (`/social-media/campaigns`):** el flujo usa estatus `PLANIFICADA`/`ACTIVA`/`FINALIZADA` y presupuesto. No usa `tipo_campana_enum` ni el campo `activo` del diseño SQL descrito. No se encontró categorización ni capa visual de efemérides.

**Tablas tipadas sin consumidor en `src/app` según la búsqueda auditada:** `checklist_rodaje`, `inventario_premios`, `reporte_atencion_cliente`, `campana_evaluaciones` y `publicacion_canales`.

**Rutas adicionales detectadas:** `/support` usa la tabla `atencion_cliente`, distinta de `reporte_atencion_cliente`; `/third-parties` gestiona un directorio de contactos y es diferente del inbox de solicitudes. Su clasificación dentro del alcance del SRS está pendiente.

### 6.6 Pendiente de confirmar

La auditoría adjunta no confirmó lo siguiente; no se debe asumir que esté implementado o ausente:

- Flujos completos de `/support` y `/third-parties` (se confirmó su existencia y forma general, no todas sus mutaciones).
- Ubicación alternativa de `/dashboard` y `/reportes` fuera de los árboles explorados.
- Policies RLS efectivamente configuradas en Supabase. Las server actions revisadas usan `getSupabaseAdmin()` (Service Role), por lo que RLS no parece ser el control de acceso aplicado por esos flujos.
- Interacción de cambio de estatus por drag-and-drop en algún componente auxiliar de Kanban.
- Configuración PWA de `/social-media/shooting`.
- Trabajo en progreso en ramas distintas de `main`.

La auditoría describe revisión de código, no validación del despliegue ni de las policies en el proyecto vivo.
