# Documentación de Arquitectura de Base de Datos — Kromi Connect (Supabase)

> **Proyecto:** Kromi Connect — Fase 1 (Perfil Social Media Manager)
> **Motor:** Supabase / PostgreSQL
> **Tipo de documento:** Bitácora de migración y arquitectura de esquema
> **Estado:** Migración ejecutada y verificada

---

## 1. Resumen de la Refactorización DDL

El esquema `public` partía de un estado rudimentario compuesto por 3 tablas (`campanas`, `publicaciones`, `checklist_rodaje`) con las siguientes deficiencias estructurales:

- Llaves primarias secuenciales numéricas (`int8` / `BIGSERIAL`) en lugar de identificadores universales.
- Ausencia de dominios tipados: campos `TEXT` libres utilizados para representar estados, formatos y categorías que debían ser controlados por enumeraciones.
- Cobertura incompleta del modelo de datos frente al alcance funcional definido en el SRS (sin soporte estructural para inbox de terceros, inventario de premios, escucha social ni evaluación de campañas).

**Acción ejecutada:** migración DDL completa mediante reset de esquema (`DROP ... CASCADE`) sobre las 3 tablas preexistentes y sus dependencias (constraints, secuencias), seguida de la reconstrucción íntegra de la arquitectura relacional especificada en el documento SRS de referencia (`kromi-connect-srs_2.md`).

**Resultado de la migración:**
- Todas las llaves primarias migradas a tipo `UUID`, generadas vía `gen_random_uuid()`.
- 6 tipos enumerados nuevos para gobernar los dominios de estado/categoría.
- Expansión de 3 a 8 tablas relacionales, cubriendo la totalidad de los bloques funcionales de la Fase 1 del SRS.
- Automatizaciones de timestamp e índices de rendimiento aplicados sobre las rutas de consulta más frecuentes (Kanban, Calendario, PWA de rodaje).
- Row Level Security habilitado en la totalidad de las tablas del esquema.
- Carga de datos semilla (seed data) ejecutada y verificada contra un escenario operativo real.

---

## 2. Tipos de Datos Personalizados (Enums)

Se definieron 6 tipos enumerados en el esquema `public` para sustituir los campos `TEXT` libres del estado inicial:

| Enum | Valores | Tabla(s) de uso |
|---|---|---|
| `formato_enum` | `CARRUSEL`, `POST`, `REEL`, `STORY` | `publicaciones` |
| `estatus_enum` | `PENDIENTE_BRIEF`, `EN_RODAJE`, `EN_DISENO`, `EN_REVISION_CM`, `RECHAZADO_DISENO`, `PENDIENTE_APROBACION_GERENCIA`, `APROBADO`, `PROGRAMADO`, `PUBLICADO` | `publicaciones` |
| `tipo_campana_enum` | `TEMPORADA`, `EVENTO`, `EFEMERIDE`, `LANZAMIENTO`, `OFERTA_PUNTUAL` | `campanas` |
| `departamento_enum` | `COMPRAS`, `SELECCION`, `PROVEEDOR`, `GERENCIA`, `EVENTOS` | `solicitudes_terceros` |
| `canal_enum` | `INSTAGRAM`, `TIKTOK`, `YOUTUBE`, `FACEBOOK` | `publicacion_canales`, `reporte_atencion_cliente` |
| `sede_enum` | `PREBO`, `MANONGO` | `checklist_rodaje`, `inventario_premios` |

**Nota de diseño:** dos campos que originalmente eran candidatos a enumeración se mantuvieron deliberadamente como `TEXT` libre por la naturaleza no acotable de su dominio:
- `checklist_rodaje.area_tienda` — zonas físicas de piso de tienda (ej. "Barra de Carnicería", "Fruver", "Anaquel Central") que no constituyen un conjunto cerrado y enumerable de antemano.
- `publicacion_canales.estado_publicacion` — estado textual de bajo nivel por canal, independiente del `estatus_enum` que gobierna el ciclo de vida general de la publicación.

---

## 3. Diccionario del Esquema Relacional (8 Tablas & FKs)

### 3.1 `campanas`
Entidad de agrupación para campañas de temporada, eventos o lanzamientos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | `gen_random_uuid()` |
| `nombre` | `TEXT NOT NULL` | |
| `tipo_campana` | `tipo_campana_enum NOT NULL` | |
| `fecha_inicio` / `fecha_fin` | `DATE NOT NULL` | |
| `activo` | `BOOLEAN DEFAULT TRUE` | |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

La vista de campañas amplía esta tabla con `descripcion`, `presupuesto`, `estatus` y `estatus_pre_archivado`. `estatus` admite `PLANIFICADA`, `ACTIVA`, `FINALIZADA` y `ARCHIVADA`; archivar conserva el estado previo en `estatus_pre_archivado` y pone `activo = FALSE`. La acción de restauración devuelve ese estado previo y no elimina las relaciones con publicaciones, inventario ni evaluaciones. Aplicar las migraciones de `supabase/migrations/` en orden para habilitar estos campos.

### 3.2 `publicaciones` (entidad central)
Ticket de contenido con trazabilidad completa de matriz SLA (brief → rodaje → diseño → aprobación → publicación).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `campana_id` | `UUID FK → campanas(id)` | Nullable |
| `titulo` | `TEXT NOT NULL` | |
| `formato` | `formato_enum NOT NULL` | |
| `linea_contenido` | `TEXT` | |
| `fecha_publicacion` | `DATE NOT NULL` | |
| `fecha_limite_brief` | `DATE` | Derivado: `fecha_publicacion - 5` |
| `fecha_solicitud_diseno` | `TIMESTAMPTZ` | |
| `fecha_entrega_diseno_estimada` | `DATE` | Derivado: `fecha_solicitud_diseno + 2` |
| `fecha_entrega_diseno_real` | `TIMESTAMPTZ` | Para cálculo de cumplimiento SLA |
| `fecha_aprobacion_gerencia` | `TIMESTAMPTZ` | |
| `estatus` | `estatus_enum NOT NULL DEFAULT 'PENDIENTE_BRIEF'` | |
| `hook_texto` / `body_texto` / `cta_texto` | `TEXT` | |
| `hashtags` | `TEXT[]` | |
| `version_copy` | `INT DEFAULT 1` | |
| `drive_folder_id` / `drive_folder_url` | `TEXT` | |
| `creador_id` | `UUID FK → auth.users(id)` | |
| `disenador_id` | `UUID FK → auth.users(id)` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ DEFAULT now()` | `updated_at` gestionado por trigger (ver §4) |

### 3.3 `publicacion_canales`
Relación 1:N — canales de distribución por publicación.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `publicacion_id` | `UUID FK → publicaciones(id) ON DELETE CASCADE` | |
| `canal` | `canal_enum NOT NULL` | |
| `estado_publicacion` | `TEXT DEFAULT 'PENDIENTE'` | |
| `url_publicacion` | `TEXT` | |
| — | `UNIQUE (publicacion_id, canal)` | Restricción compuesta: evita duplicidad de canal por publicación |

### 3.4 `checklist_rodaje`
Checklist de tomas requeridas para producción en piso de tienda (consumo vía PWA móvil).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `publicacion_id` | `UUID FK → publicaciones(id) ON DELETE CASCADE` | |
| `toma_requerida` | `TEXT NOT NULL` | |
| `area_tienda` | `TEXT NOT NULL` | Campo libre (ver nota §2) |
| `sucursal` | `sede_enum NOT NULL` | Filtro estructurado por sede |
| `completado` | `BOOLEAN DEFAULT FALSE` | |

### 3.5 `solicitudes_terceros`
Inbox de requerimientos entrantes de departamentos externos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `departamento_emisor` | `departamento_enum NOT NULL` | |
| `tipo_solicitud` | `TEXT NOT NULL` | |
| `descripcion` | `TEXT` | |
| `materiales_adjuntos_url` | `TEXT[]` | Soporta múltiples adjuntos/enlaces de referencia |
| `estatus_solicitud` | `TEXT DEFAULT 'PENDIENTE'` | |
| `publicacion_id` | `UUID FK → publicaciones(id)` | Nullable; se llena al convertir a ticket |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

### 3.6 `inventario_premios`
Control de stock físico de premios por sede para sorteos/concursos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `proveedor_nombre` | `TEXT` | |
| `nombre_premio` | `TEXT NOT NULL` | |
| `cantidad_recibida` / `cantidad_entregada` | `INT DEFAULT 0` | |
| `sucursal_ubicacion` | `sede_enum NOT NULL` | |
| `campana_id` | `UUID FK → campanas(id)` | Nullable |
| `solicitud_id` | `UUID FK → solicitudes_terceros(id)` | Nullable — trazabilidad opcional de origen (Compras/Proveedor) |
| `estado_premio` | `TEXT DEFAULT 'EN_STOCK'` | |

### 3.7 `reporte_atencion_cliente`
Log semanal de escucha social.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `fecha_semana` | `DATE NOT NULL` | |
| `canal` | `canal_enum NOT NULL` | |
| `tipo` | `TEXT NOT NULL` | QUEJA / SUGERENCIA / CONSULTA |
| `categoria` | `TEXT` | |
| `detalle_comentario` | `TEXT` | |
| `accion_tomada` | `TEXT` | |
| `status` | `TEXT DEFAULT 'ABIERTO'` | |

### 3.8 `campana_evaluaciones`
Evaluación post-mortem de campaña.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `campana_id` | `UUID FK NOT NULL → campanas(id)` | |
| `alcance_total` / `interacciones_totales` | `BIGINT` | |
| `presupuesto_ejecutado` | `NUMERIC(12,2)` | |
| `informe_cualitativo` | `TEXT` | |
| `observaciones` | `TEXT` | |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | |

### 3.9 `efemerides`
Catálogo anual independiente de campañas. Se almacena una fila por efeméride y año; los periodos móviles (por ejemplo, Semana Santa) conservan sus fechas concretas para ese año.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | Generado con `gen_random_uuid()` |
| `nombre` | `TEXT NOT NULL` | No admite texto vacío |
| `anio` | `INTEGER NOT NULL` | Año de planificación, entre 1 y 9999 |
| `fecha_inicio` / `fecha_fin` | `DATE NOT NULL` | Ambas fechas deben pertenecer al año; fin no puede preceder al inicio. Para fecha puntual son iguales |
| `descripcion` | `TEXT` | Opcional |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

Índice `idx_efemerides_anio_fecha (anio, fecha_inicio, fecha_fin)` para listar el calendario anual en orden. No tiene FK a `campanas`: una efeméride existe aunque no se planifique una campaña.

### 3.10 `campana_efemerides`
Tabla de unión muchos a muchos. Solo acepta campañas de tipo `EFEMERIDE`; el año de cada efeméride debe estar comprendido entre los años de inicio y fin de la campaña. Las FK impiden borrar una efeméride vinculada y eliminan los vínculos si se elimina una campaña.

| Columna | Tipo | Notas |
|---|---|---|
| `campana_id` | `UUID FK → campanas(id)` | Parte de la PK compuesta; `ON DELETE CASCADE` |
| `efemeride_id` | `UUID FK → efemerides(id)` | Parte de la PK compuesta; `ON DELETE RESTRICT` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

`save_campaign_with_efemerides(...)` guarda los datos de la campaña y reemplaza sus vínculos dentro de una única transacción. Los triggers protegen las reglas también ante cambios directos en las tablas.

### 3.11 Mapa de relaciones (FK)

```
campanas ──┬──< publicaciones
           ├──< inventario_premios
           └──< campana_evaluaciones

publicaciones ──┬──< publicacion_canales   (ON DELETE CASCADE)
                ├──< checklist_rodaje       (ON DELETE CASCADE)
                └──< solicitudes_terceros   (FK inversa, nullable)

solicitudes_terceros ──< inventario_premios (FK opcional, trazabilidad)

auth.users ──< publicaciones.creador_id
auth.users ──< publicaciones.disenador_id

efemerides ──< campana_efemerides >── campanas (solo campañas tipo EFEMERIDE)
```

---

## 4. Disparadores (Triggers) e Índices de Rendimiento

### 4.1 Trigger de auditoría de timestamp

Se implementó la función `update_updated_at_column()` para automatizar la actualización del campo `updated_at` en cada operación de escritura sobre `publicaciones`:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_publicaciones_updated_at
BEFORE UPDATE ON publicaciones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Alcance:** exclusivo a `publicaciones`, tabla central del modelo con mayor frecuencia de transiciones de estado (`estatus_enum`) y por tanto la de mayor relevancia para auditoría temporal.

### 4.2 Índices estratégicos

| Índice | Tabla | Columnas | Propósito |
|---|---|---|---|
| `idx_publicaciones_fecha_estatus` | `publicaciones` | `(fecha_publicacion, estatus)` | Optimización de consultas de Vista Kanban (agrupación por `estatus`) y Calendario de contenido (rango de fechas) |
| `idx_checklist_publicacion_sucursal` | `checklist_rodaje` | `(publicacion_id, sucursal)` | Optimización de la vista PWA móvil de rodaje, filtrada por sede en piso de tienda |
| `idx_solicitudes_estatus` | `solicitudes_terceros` | `(estatus_solicitud)` | Búsqueda filtrada del inbox por estado de solicitud |
| `idx_publicacion_canales_canal` | `publicacion_canales` | `(canal)` | Búsqueda filtrada por canal de distribución |

---

## 5. Políticas de Seguridad a Nivel de Fila (RLS)

- `ROW LEVEL SECURITY` habilitado explícitamente (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) en la totalidad de las 8 tablas del esquema `public`.
- Política única de acceso unificado por tabla, con nombre estándar `"Permitir todo a usuarios autenticados"`, aplicada al perfil actualmente en operación (`role = 'social_media'`):

```sql
-- Patrón de política aplicado a cada una de las 8 tablas
CREATE POLICY "Permitir todo a usuarios autenticados"
ON <tabla>
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

- **Diseño de cara a segregación futura:** la política actual otorga acceso total sin distinción de sub-rol, dado que la Fase 1 opera bajo un único perfil unificado (Estrategia + Producción de Contenido). La infraestructura de RLS queda preparada estructuralmente para incorporar, en fases posteriores, políticas diferenciadas por `role = 'diseno'` y `role = 'gerencia'` sin requerir cambios al esquema de tablas subyacente.

La tabla `efemerides` usa la misma política permisiva para `authenticated`, habilitada en su migración. Las Server Actions usan el cliente administrativo del servidor; RLS por sí sola no sustituye autorización de aplicación para operaciones con ese cliente.

`campana_efemerides` aplica la misma política RLS y grants para `authenticated` y `service_role`.

---

## 6. Verificación e Integridad de Datos (Seed Data Executed)

Se ejecutó un bloque anónimo PL/pgSQL (`DO $$ ... $$`) para poblar el esquema con datos de prueba representativos de un escenario operativo real de la cadena, verificando la integridad referencial completa del modelo.

**Escenario simulado:**
- **Sedes:** Prebo y Mañongo (`sede_enum`), reflejadas en `checklist_rodaje.sucursal` e `inventario_premios.sucursal_ubicacion`.
- **Campañas (`campanas`):** "Festival de Carnes Premium 2026" (tipo `OFERTA_PUNTUAL` / `EVENTO`) y "Aniversario Mañongo" (tipo `EVENTO`), con `fecha_inicio`/`fecha_fin` válidas y `activo = TRUE`.
- **Publicaciones (`publicaciones`):** tickets de contenido asociados a las campañas anteriores mediante `campana_id`, con `estatus` distribuido a través de distintos puntos del flujo (`PENDIENTE_BRIEF`, `EN_DISENO`, `PROGRAMADO`) para validar la Vista Kanban.
- **Solicitudes de terceros (`solicitudes_terceros`):** registros de origen `COMPRAS` y `SELECCION`, incluyendo casos con `materiales_adjuntos_url` poblado como arreglo multivalor.
- **Log de atención (`reporte_atencion_cliente`):** entradas de tipo `QUEJA` y `SUGERENCIA` distribuidas por `canal_enum`, con `status` inicial `ABIERTO`.

**Verificaciones de integridad realizadas:**
- Confirmación de resolución correcta de las FKs `publicaciones.campana_id`, `checklist_rodaje.publicacion_id` y `solicitudes_terceros.publicacion_id` contra los registros semilla insertados.
- Validación de la restricción `UNIQUE (publicacion_id, canal)` en `publicacion_canales` sin conflictos durante la carga.
- Confirmación de que los enums (`sede_enum`, `estatus_enum`, `canal_enum`, `departamento_enum`) aceptaron únicamente valores dentro de su dominio declarado, rechazando cualquier valor fuera de rango.
- Verificación de disparo correcto del trigger `trg_publicaciones_updated_at` ante actualizaciones de `estatus` sobre las filas semilla.

**Resultado:** carga ejecutada sin errores de integridad referencial ni de dominio; esquema verificado como consistente con la especificación del SRS de Fase 1.

---

## 7. Efemérides anuales: migración para Supabase SQL Editor

La migración versionada es `supabase/migrations/202609280001_annual_efemerides.sql`. Para aplicarla, abre Supabase **SQL Editor**, pega y ejecuta el bloque completo siguiente. Es idempotente y no modifica filas de `campanas` ni `publicaciones`.

```sql
CREATE TABLE IF NOT EXISTS public.efemerides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  anio integer NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT efemerides_nombre_not_blank CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT efemerides_anio_valid CHECK (anio BETWEEN 1 AND 9999),
  CONSTRAINT efemerides_dates_ordered CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT efemerides_dates_match_year CHECK (
    extract(year FROM fecha_inicio)::integer = anio
    AND extract(year FROM fecha_fin)::integer = anio
  )
);

CREATE INDEX IF NOT EXISTS idx_efemerides_anio_fecha
  ON public.efemerides (anio, fecha_inicio, fecha_fin);
ALTER TABLE public.efemerides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.efemerides TO authenticated, service_role;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.efemerides;
CREATE POLICY "Permitir todo a usuarios autenticados"
  ON public.efemerides FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Verifica desde SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'efemerides'
ORDER BY ordinal_position;

SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'efemerides';

SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'efemerides';
```

La UI `/social-media/efemerides` permite consultar por año, crear, editar y eliminar ocurrencias. No se insertan registros de ejemplo automáticamente. La visualización en Grid queda fuera de este bloque.

---

## 8. Vínculos entre campañas y efemérides

La migración `supabase/migrations/202609280002_campaign_efemerides.sql` agrega la tabla de unión, RLS, triggers de integridad y la función transaccional `save_campaign_with_efemerides`. Para aplicarla en Supabase, abre **SQL Editor**, pega el contenido completo de ese archivo y ejecútalo después de la migración anual de efemérides (§7). No ejecutes solo la creación de la tabla: la función y los triggers forman parte de las validaciones. El archivo solicita recargar el caché de esquema de PostgREST al terminar.

Verifica la instalación desde SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('efemerides', 'campana_efemerides')
ORDER BY table_name;

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_validate_campaign_efemeride_link',
    'trg_validate_campaign_efemeride_change',
    'trg_validate_efemeride_year_change'
  )
ORDER BY trigger_name;

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'save_campaign_with_efemerides';
```

La acción de guardar campaña llama esa función para guardar datos y vínculos atómicamente. En la UI, el selector aparece solo para campañas `EFEMERIDE` y muestra ocurrencias de los años entre el inicio y fin de la campaña, ambos inclusive. Cambiar la categoría de una campaña con vínculos requiere confirmación; eliminar una efeméride vinculada se bloquea y se informa qué campañas deben desvincularse primero.

---

## 9. Consumo de efemérides en Grid

Grid consume `public.efemerides` por año; esta capa no necesita otra tabla ni una migración adicional. Las efemérides puntuales aparecen en su fecha. Los periodos aparecen como un solo indicador en su primer día de cada mes que abarcan (o como “En curso” al inicio del mes si comenzaron antes); al abrirlo se muestran las fechas completas y la descripción. El filtro de formato solo afecta publicaciones.

Grid también consulta campañas `EFEMERIDE` con al menos un vínculo y cuyo periodo se solape con el mes visible. Cada campaña se muestra una sola vez por mes en la fecha de inicio o al inicio del mes si ya estaba en curso. La ficha detalla por separado el periodo propio de la campaña y las fechas de sus efemérides vinculadas. Las campañas `FINALIZADA` permanecen visibles con estilo atenuado; `ARCHIVADA` queda excluida. No hay cambios DDL adicionales para esta capa; sí se requiere aplicar la migración de asociaciones descrita en §8.
