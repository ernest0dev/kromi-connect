# Kromi Connect — Informe Técnico y SRS (Fase 1: Perfil Social Media Manager)

> Documento interno de seguimiento operativo de desarrollo. No apto para distribución externa ni comercial.
> Stack objetivo: Next.js (App Router) + Supabase/PostgreSQL + Server Actions.

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

### 2.1 Generación y Gestión de Contenido
- Planificación de grilla mensual con cálculo automatizado de fechas.
  - **Regla SLA:** `fecha_publicacion - 3 días` = fecha límite rodaje; `fecha_publicacion - 5 días` = fecha límite brief (3 días rodaje + 2 días diseño, contados hacia atrás desde publicación).
- Generación de cronograma de producción y guiones de rodaje para piso de tienda.
- Creación de solicitudes de diseño (brief técnico: dimensiones, copy versionado, badges).
- Flujo de revisión/corrección/aprobación con estados de retorno explícitos.
- Trazabilidad de tiempos: `fecha_solicitud_diseno` vs `fecha_entrega_diseno_real` (deriva SLA cumplido/incumplido).
- Programación, publicación y **reprogramación inversa** (Quick Reschedule: mover fecha de publicación recalcula automáticamente brief/rodaje hacia atrás).

### 2.2 Planificación Estratégica de Campañas
- Categorización: Temporada, Evento, Efeméride, Lanzamiento, Oferta puntual.
- Calendario de efemérides + alianzas con proveedores como capa superpuesta a la grilla.
- Informes post-mortem por campaña (alcance, interacciones, presupuesto, cualitativo).

### 2.3 Recepción y Publicación de Solicitudes de Terceros
- Inbox de requerimientos entrantes (Compras, HR/Selección, Gerencia).
- Conversión 1-clic de solicitud externa → ticket de contenido (`publicaciones` row pre-poblada desde `solicitudes_terceros`).
- Módulo de sorteos/concursos + inventario de premios físicos por sede.

### 2.4 Informes, Escucha Social y Analítica
- Log semanal de escucha social (quejas, sugerencias, atención en RRSS).
- Dashboard de métricas consolidadas: crecimiento, reach, interacciones, top posts.

---

## 3. Roadmap de UI (Next.js App Router)

### Fase 1 — Core Operativo (Parrilla, Kanban & Briefing)
- `/dashboard` — resumen operativo, alertas de SLA vencido/próximo, accesos rápidos.
- `/parrilla` — 3 vistas sobre el mismo dataset: Calendario macro, Kanban por `estatus`, Tabla spreadsheet.
- **Modal A — Editor de Ticket:** formulario multi-tab (Brief a Diseño / Guion de Rodaje / Historial de Revisiones).

### Fase 2 — Producción & Asset Management
- `/rodaje` — vista responsive/PWA optimizada para móvil, uso en piso por área de tienda.
- **Modal B — Visor de Assets Drive:** explorador de thumbnails + ingesta vía Google Drive API.

### Fase 3 — Gestión de Terceros & Aprobaciones
- `/solicitudes` — inbox de peticiones externas + conversión a ticket.
- **Modal C — QA Pre-Publicación:** visualizador de paquete para envío a Gerencia.

### Fase 4 — Inventario & Tipificación de Campañas
- Submódulo en `/solicitudes`: control de sorteos y stock de premios por sede.
- Extensión en `/parrilla`: capa visual de efemérides.

### Fase 5 — Analytics & Social Listening
- `/reportes` — dashboard mensual, log de quejas/sugerencias, informes post-mortem.

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

## 5. Resumen y Escalabilidad

**Resultado esperado (fin de Fase 5):** 100% de la operación del perfil Social Media centralizada en Kromi Connect, eliminando dependencia de hojas de cálculo dispersas, con trazabilidad de SLA de diseño y automatización de subida de assets a Drive.

**Preparación para escalar:** el modelo de datos y las vistas actuales no requieren refactor estructural para habilitar en fases futuras:
- Panel de **Diseño Gráfico** (Kanban centrado en `disenador_id` y estados de renderizado/assets).
- Panel de **Gerencia de Mercadeo** (dashboard ejecutivo de aprobación 1-clic + ROI de campañas, consumiendo `campana_evaluaciones` y `publicaciones.fecha_aprobacion_gerencia`).
