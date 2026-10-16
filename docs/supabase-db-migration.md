# Documentación de Arquitectura de Base de Datos — Kromi Connect (Supabase)

> **Proyecto:** Kromi Connect — Fase 1 (Perfil Social Media Manager)
> **Motor:** Supabase / PostgreSQL
> **Tipo de documento:** Bitácora de migración y arquitectura de esquema
> **Estado:** bitácora de esquema y migraciones; las últimas migraciones tienen estado de despliegue diferenciado más abajo.

---

> **Vigencia:** los capítulos 1–9 documentan la arquitectura base y migraciones anteriores; no son un volcado completo del esquema desplegado actual. El inventario (`202610130001`/`002`) y programación (`202610150001`) fueron reportados por el usuario como aplicados. La captura y el esquema Markdown todavía deben reconciliarse con la programación mediante `supabase db pull`. Este repositorio no verificó el estado vivo; revisar objetos, grants, policies y funciones antes de generar nuevas migraciones.

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
| `estatus_enum` | `PENDIENTE_BRIEF`, `EN_RODAJE`, `SOLICITADO`, `EN_DISENO`, `EN_REVISION_CM`, `EN_CORRECCION`, `RECHAZADO_DISENO`, `PENDIENTE_APROBACION_GERENCIA`, `APROBADO`, `PROGRAMADO`, `PUBLICADO`, `CANCELADO`, `INCOMPLETO` | `publicaciones` |
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
Relación de destinos concretos por publicación. `social_account_id` identifica una cuenta, no solo una plataforma.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID PK` | |
| `publicacion_id` | `UUID FK references publicaciones(id) ON DELETE CASCADE` | |
| `canal` | `canal_enum NOT NULL` | Plataforma de destino |
| `social_account_id` | `UUID FK references social_accounts(id)` | Cuenta concreta; nullable solo para relaciones históricas sin clasificar |
| `estado_publicacion` | `TEXT DEFAULT 'PENDIENTE'` | |
| `url_publicacion` | `TEXT` | |
| -- | `UNIQUE (publicacion_id, social_account_id)` | Una relación por cuenta destino |

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

### 3.11 Mapa de relaciones (FK) (modelo base; ver tambien anexo 10 para las tablas recientes)

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

> **Nota de vigencia:** esta sección describe el diseño de una etapa anterior, con acceso autenticado unificado. No usarla como especificación del modelo actual de perfiles ni permisos. Para perfiles funcionales, consultar [`perfiles-de-usuario.md`](perfiles-de-usuario.md); para roles, permisos y políticas actuales del repositorio, consultar §7 del [SRS](kromi-connect-srs.md) y las migraciones versionadas en `supabase/migrations/`.

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
- Validación de la restricción `UNIQUE (publicacion_id, social_account_id)` en `publicacion_canales` sin conflictos durante la carga.
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


## 10. Extensión de publicaciones: flujo, Design y Archivo (2026-10-10)

La migración `supabase/migrations/202610100001_publication_workflow_archive.sql` extiende el esquema base descrito arriba. Según confirmación del usuario, fue ejecutada en el proyecto Supabase; no se consultó remotamente para validar el estado actual.

### Cambios estructurales

El modelo de cuentas vigente usa `social_accounts`, `user_social_accounts` y `publicacion_canales.social_account_id`; los permisos por usuario dependen de las cuentas destino asignadas. `publicacion_categorias` enlaza publicaciones con `categorias_contenido`. Esta capa antecede al cambio de flujo y queda reflejada en `docs/publicaciones-por-cuenta-social.md`.

- `publicaciones`: `deleted_at`, `hora_publicacion`, `requiere_rodaje`, `fecha_rodaje`, `sedes sede_enum[]`, `prioridad`; marcas de limpieza Drive (`drive_cleanup_status`, `drive_cleanup_error`, `drive_cleanup_attempted_at`, `drive_deleted_at`, `drive_preserved_at`). Incluye checks de prioridad/limpieza e indice parcial de expiracion de Archivo.
- `publicacion_estatus_historial`: transiciones, estado anterior/nuevo, motivo, actor y fecha; un trigger registra la creacion inicial.
- `publicacion_comentarios`: comentarios inmutables tipados `COMENTARIO`, `CORRECCION` o `MOTIVO_CANCELACION`, con autor y fecha. Correccion y cancelacion desde el flujo actual crean una observacion.
- Policies de lectura por permiso y alcance de publicacion; Design queda limitado a la cola, sin lectura global de publicaciones.

### Permisos y funciones

- `design.posts.read`, `design.posts.start`, `design.posts.deliver`: lectura de cola, inicio y entrega.
- `social-media.posts.archive`, `social-media.posts.restore`, `social-media.posts.purge.resolve`; permisos de rodaje sembrados en la misma migracion.
- `get_design_publication_queue()`: publicaciones activas en `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION`. No asigna por `disenador_id`.
- `transition_publicacion_status(...)`: valida rol, permiso, origen/destino y motivo; fija fechas reales e inserta historial en la transicion.
- `archive_publication(...)` y `restore_archived_publication(...)`: borrado logico/restauracion por Social Media, con plazo de un mes calendario.
- `set_publication_hour(...)` y `set_publication_production(...)`: guardan hora, rodaje, sedes disponibles y prioridad con validacion de permisos.
- `claim_expired_publication_purges()`: RPC reservada a `service_role` para reclamar purgas vencidas.
- Un trigger protege estado, fechas reales, archivo y marcas Drive; se revoca el borrado directo por API para `authenticated`.

### Operación de purga

La llamada a Drive ocurre en `src/app/api/cron/purge-publicaciones/route.ts`, programado desde `vercel.json`; SQL no llama a Drive. El cron diario requiere `CRON_SECRET` y credenciales de servidor. Los fallos quedan en Archivo para resolucion manual. El esquema auth no cambia con esta migracion; `supabase-schema-auth.png` no necesita actualizarse por este cambio.

La migración no crea `YOUTUBE_SHORTS`, no normaliza categorías históricas, no crea versiones de copy ni asigna solicitudes a diseñadores.
## 11. Brief y cargas directas a Google Drive (`202610110001`)

La migración añade a `publicaciones` los IDs de las subcarpetas `drive_brief_folder_id` y `drive_deliverables_folder_id`, además del conteo y fecha de comprobación del Brief (`drive_brief_file_count`, `drive_brief_checked_at`). Crea `publicacion_drive_uploads` para reservas y sesiones de carga. La tabla tiene RLS activado; según la comprobación compartida por el usuario, `service_role` puede acceder y `authenticated` no tiene acceso directo.

Las funciones `reserve_publication_brief_upload`, `sync_publication_drive_brief` y `request_publication_to_design` están restringidas a `service_role`. La RPC genérica `transition_publicacion_status` permanece disponible para `authenticated` y `service_role`, pero rechaza `SOLICITADO`; ese cambio debe pasar por la acción validada que comprueba el contenido de Drive. La migración crea `guard_publication_drive_brief_sync` para proteger los campos sincronizados. El usuario compartió resultados que confirman la existencia de dicho trigger y las concesiones indicadas, además de las funciones. Esta documentación no vuelve a consultar el proyecto remoto.

La aplicación valida JPG/JPEG, PNG, WebP, PDF y MP4, hasta 100 MB por archivo y 10 archivos por Brief contando presentes/reservados. Las comprobaciones usan extensiones, MIME y metadatos; no se inspecciona contenido ni firma. El navegador sube directamente a Drive con sesión resumible, por lo que el binario no atraviesa Vercel/Supabase. El OAuth fue probado con `/api/test-connections`; la subida desde el origen desplegado requiere su propia comprobación de CORS y flujo resumible.

## 12. Publicaciones sin trabajo de Design (`202610110002`)

La migración local añade `publicaciones.requiere_diseno`, `boolean NOT NULL DEFAULT true`, y la RPC `set_publication_design_requirement(uuid, boolean)`. Un trigger impide alterar directamente la columna; la RPC permite a Social Media cambiarla solo con permiso y alcance de cuentas, mientras el estado sea `PENDIENTE_BRIEF` o `EN_RODAJE`.

Actualiza `request_publication_to_design` para rechazar publicaciones sin Design, `get_design_publication_queue` para excluirlas y `transition_publicacion_status` para permitir a Social Media pasar a `PENDIENTE_APROBACION_GERENCIA` desde `PENDIENTE_BRIEF` (sin rodaje) o `EN_RODAJE` cuando `requiere_diseno = false`. El brief y SLA de diseño quedan fuera de ese camino; el flujo externo de aprobación continúa bajo control de Social Media.

**Estado de despliegue:** el usuario reportó haber ejecutado la migración y compartió resultados que muestran `get_design_publication_queue`, `request_publication_to_design`, `transition_publicacion_status` y la columna `requiere_diseno`. No se recibió resultado específico para `set_publication_design_requirement` ni `guard_publication_design_requirement`. Antes de depender del toggle en cliente, verificar esos dos objetos y sus grants; no volver a ejecutar a ciegas.

## 13. Perfil Design completo (`202610120001`)

La migración local agrega `publicaciones.instrucciones_diseno`, protege su edición y bloquea la solicitud a Design si está vacía. Registra al diseñador que abre el ticket, agrega la carpeta `carpeta` a las reservas de Drive y eleva el límite físico a 500 MB; los límites de cada flujo se aplican en sus RPC. El cupo del Brief y el de Entregables se cuentan por separado. También agrega el permiso `design.posts.upload`, la reserva de entregables y las RPC de historial, comentarios y nombres.

La aplicación incluye la cola y ficha de Design, la carga resumible directa a Drive, la regla de archivo nuevo tras corrección, el historial, instrucciones en Social Media y la revisión de entregables.

**Estado de despliegue:** evidencia indirecta de que `202610120001_design_profile.sql` está aplicada: el esquema compartido (`supabase-schema-public.md`, commit `d15b84e`) ya lista `publicaciones.instrucciones_diseno` y `publicacion_drive_uploads.carpeta`, y el equipo probó parcialmente la implementación en el navegador. Aún **no hay comprobación explícita** de las funciones, los grants, el trigger, la restricción de tamaño ni el permiso `design.posts.upload`; ejecutar las consultas de abajo antes de darla por verificada. La captura del esquema no incluye funciones ni grants.

**Cambios de comportamiento que conviene conocer**
- `request_publication_to_design` y `transition_publicacion_status` **no se redefinen** en esta migración. Las reglas nuevas viven en el trigger `guard_publication_design_instructions` (`BEFORE UPDATE`): rechaza cambiar `instrucciones_diseno` fuera de la RPC `set_publication_design_instructions`, rechaza dejar un ticket en `SOLICITADO` sin instrucciones cuando `requiere_diseno` es verdadero y fija `disenador_id = auth.uid()` al pasar a `EN_DISENO` si estaba vacío (la autoría se conserva tras las correcciones).
- La RPC solo permite editar instrucciones en `PENDIENTE_BRIEF` o `EN_RODAJE`, con rol `social-media` y acceso a todas las cuentas destino.
- La regla de reentrega (P5: un archivo creado después del último paso a `EN_DISENO`) se valida **solo en la acción de servidor** `transitionPublicationAction`, no en la base de datos. `transition_publicacion_status` sigue concedida a `authenticated`, por lo que una llamada directa a la RPC la omitiría; ya ocurría con la comprobación anterior de «al menos un archivo».
- `get_design_publication_history` devuelve entregadas (`EN_REVISION_CM` en adelante) y canceladas que llegaron a `SOLICITADO`. `design_can_see_publication` aplica la misma visibilidad a comentarios y nombres. No existe ficha de detalle para esas filas: `/design/publications/[id]` consulta solo `get_design_publication_queue`.
- `reserve_publication_brief_upload` se redefine para contar solo `carpeta = 'BRIEF'`; el límite físico de la columna pasa a 500 MB y el de 100 MB del Brief se aplica en la RPC.

**Riesgo conocido: tickets antiguos en `SOLICITADO`.** El trigger evalúa «`SOLICITADO` sin instrucciones» en *cualquier* `UPDATE`, no solo en la transición. Un ticket que ya estuviera solicitado antes de la migración, sin instrucciones, fallaría en actualizaciones posteriores (por ejemplo la sincronización del brief o cambios de fechas). Comprobar si existen y, si los hay, hacer un backfill de instrucciones o limitar la condición a `old.estatus is distinct from new.estatus` en una migración nueva:

```sql
select id, titulo from public.publicaciones
where deleted_at is null and requiere_diseno and estatus = 'SOLICITADO'
  and nullif(trim(instrucciones_diseno), '') is null;
```

Antes de aplicar en un entorno nuevo, revisar el esquema vivo y confirmar la restricción `publicacion_drive_uploads_file_size_check`. Con el proyecto vinculado al ref correcto, los comandos son:

```powershell
supabase link --project-ref <project-ref>
supabase db pull
supabase migration list --linked
supabase db push --dry-run
supabase db push
```

Después, verificar columnas, función y permisos con:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'publicaciones' and column_name = 'instrucciones_diseno')
    or (table_name = 'publicacion_drive_uploads' and column_name = 'carpeta'));

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.publicacion_drive_uploads'::regclass
  and conname = 'publicacion_drive_uploads_file_size_check';

select proname, prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('set_publication_design_instructions', 'reserve_publication_deliverable_upload',
    'get_design_publication_history', 'get_design_publication_comments', 'get_publication_designer_names');

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in ('set_publication_design_instructions', 'reserve_publication_deliverable_upload',
    'get_design_publication_history', 'get_design_publication_comments', 'get_publication_designer_names')
order by routine_name, grantee;

select role_code, permission_code
from public.role_permissions
where (role_code = 'design' and permission_code in ('design.posts.read', 'design.posts.start', 'design.posts.deliver', 'design.posts.upload'));
```

Las pruebas de invocación de RPC con el rol `design` se hacen en una base local/de prueba. En remoto, inspeccionar grants y cuerpos sin llamar funciones mutables. Tras aplicar, ejecutar `supabase db pull` y actualizar `supabase-schema-public.md`/captura con evidencia del esquema real.

## 14. Nombre visible del diseñador (`202610120002`)

La migración local hace dos cosas:

1. **Backfill de `disenador_id`.** Para publicaciones con `requiere_diseno` en `EN_DISENO` o `EN_CORRECCION` y `disenador_id` vacío, asigna a quien hizo el último cambio a `EN_DISENO` según `publicacion_estatus_historial`. No toca publicaciones ya asignadas ni otros estados.
2. **Reescribe `get_publication_designer_names(uuid[])`.** El nombre pasa a `coalesce(nullif(trim(profiles.full_name), ''), nullif(trim(auth.users.email), ''))`, con `left join` para que un diseñador sin `full_name` o sin fila en `profiles` se muestre por su email. Solo devuelve filas con `disenador_id` y mantiene la visibilidad previa: Design con `design_can_see_publication`, Social Media con acceso a todas las cuentas destino. Los grants no cambian (`authenticated`, sin `public` ni `anon`).

La función es `security definer` y expone el email de un diseñador a Social Media cuando el perfil no tiene nombre; es una exposición deliberada, limitada a publicaciones visibles para quien consulta.

**Estado de despliegue:** sin evidencia de que esté aplicada; la captura del esquema no muestra cuerpos de funciones. Verificar con:

```sql
select pg_get_functiondef('public.get_publication_designer_names(uuid[])'::regprocedure);

select count(*) from public.publicaciones
where requiere_diseno and disenador_id is null and estatus in ('EN_DISENO', 'EN_CORRECCION');
```

La primera consulta debe mostrar el `coalesce` con `auth.users`; la segunda debe devolver 0 tras el backfill salvo tickets sin fila `EN_DISENO` en el historial.

## 15. Inventario de Eventos (`202610130001`)

La migración local `202610130001_events_inventory.sql` crea `inventario_sedes`, `inventario_ubicaciones`, `inventario_categorias`, `inventario_articulos` e `inventario_movimientos` (inmutable por trigger), los permisos `events.inventory.read|create|update|move|locations.create` asignados al rol `events`, políticas RLS solo de lectura y las funciones `SECURITY DEFINER` `list_inventory_items`, `get_inventory_sede_counts`, `get_inventory_item_activity`, `create_inventory_location`, `create_inventory_item`, `update_inventory_item` y `register_inventory_movement`. Termina con `notify pgrst, 'reload schema'`. Siembra siete sedes y tres categorías; **no** siembra ubicaciones. No toca `inventario_premios`.

La migración correctiva `202610130002_events_inventory_transfer_identity.sql` sustituye `inventory_add_to_stock_row`: solo consolida lotes que coinciden también en `atributos` y serializa la búsqueda/creación por identidad con un bloqueo transaccional. Debe aplicarse después de `202610130001`.

**Prueba registrada para `202610130001`:** PostgreSQL 16 local con esquema `auth` y roles simulados: movimientos de lote e individuales, ajustes, conflicto de versión, duplicados, inmutabilidad del historial y grants (anon no ejecuta; las funciones internas no son ejecutables por `authenticated`). El usuario reportó que ambas migraciones se aplicaron en Supabase y actualizó `supabase-schema-public.md` y la captura; el esquema documenta las cinco tablas y políticas RLS de lectura. No consta verificación remota de los cuerpos/grants de RPC ni pruebas con usuarios reales. La migración correctiva todavía requiere validación, en especial atributos distintos y traslados concurrentes.

**Estado de despliegue:** el usuario reportó la aplicación de `202610130001` y luego `202610130002`; también actualizó `supabase-schema-public.md` y su captura. El esquema reflejado muestra las cinco tablas del inventario y sus políticas de lectura. Falta conciliar mediante `supabase db pull` y verificar en remoto las funciones, grants y permisos por rol, además de probar traslados con atributos distintos y concurrentes. Plan de implementación en [`design/plan-inventario-eventos.md`](./design/plan-inventario-eventos.md).

## 16. Programación de Eventos (`202610150001`)

La migración [`202610150001_events_schedule.sql`](../supabase/migrations/202610150001_events_schedule.sql) implementa la programación del rol `events`. Depende de `profiles`, `has_permission`, `app_permissions`, `role_permissions`, `inventario_sedes` y `campanas`; se aplica después del esquema de autenticación y del inventario. El usuario reportó que la ejecutó desde Supabase SQL Editor. No se recibió una salida de introspección ni `supabase db pull` posterior, por lo que el estado remoto queda **reportado, no verificado independientemente**.

### Objetos y seguridad

- Tablas: `eventos` (datos, inscripción, presupuesto USD, cierre, versionado y archivo), `evento_sedes` (tiendas y zona libre por tienda) y `evento_historial` (estado/reprogramación, inmutable por trigger). No crea `evento_tareas`, lista de patrocinadores/materiales ni tabla de inscritos.
- Permisos asignados a `events`: `events.schedule.read`, `events.schedule.create`, `events.schedule.update`, `events.schedule.status.update`, `events.schedule.archive`.
- RLS habilitada en las tres tablas; policy de `SELECT` requiere `events.schedule.read`. No hay escritura directa concedida a `anon` ni `authenticated`; mutaciones usan RPC `SECURITY DEFINER` con `search_path = ''`.
- Fechas como `timestamptz`, capturadas/presentadas por la UI en `America/Caracas`; `moneda` tiene default y constraint para `USD` únicamente en esta entrega. Materiales y patrocinadores son campos libres `text` con límite de 2000 caracteres.
- `sync_event_statuses()` se ejecuta en las RPC de listado, ficha/historial y mutación; los catálogos y la consulta de cruces no sincronizan estados. No existe cron de Eventos en el repositorio. El historial usa `cambiado_por = NULL` para transiciones automáticas.

### Funciones expuestas

`list_event_responsables()`, `list_event_campaigns()`, `list_events(...)`, `get_event(uuid)`, `get_event_history(uuid, integer, integer)`, `check_event_overlap(uuid, timestamptz, timestamptz, uuid[])`, `create_event(jsonb, boolean)`, `update_event(uuid, integer, jsonb, text, boolean)`, `reschedule_event(uuid, integer, timestamptz, timestamptz, text, boolean)`, `transition_event_status(uuid, integer, text, text, boolean)`, `save_event_closure(uuid, integer, integer, numeric, text)`, `archive_event(uuid, integer)` y `restore_event(uuid, integer)`. Las funciones internas de validación, sincronización y autorización no se conceden directamente a usuarios autenticados.

### Comprobaciones pendientes para cerrar despliegue

1. Ejecutar `supabase db pull` y comparar tablas/columnas, índices, policies, grants y funciones con esta migración.
2. Confirmar que el rol `events` tiene los cinco permisos y probar lectura/creación/edición/estados/cierre/archivo con una cuenta real; confirmar denegación para otros roles.
3. Probar sincronización por hora, cruces entre tiendas y conflictos de versión en Supabase remoto.
4. Regenerar `supabase-schema-public.md` y `supabase-schema-public.png` a partir de la instancia reconciliada.
