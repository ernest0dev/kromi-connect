# Plan de implementación: inventario compartido del rol Eventos

**Estado (2026-10-13):** implementación en `main` (commits `56cdb4d` y `c34bf3b`). El usuario reportó haber aplicado `202610130001` y `202610130002` en Supabase y actualizó [`supabase-schema-public.md`](../supabase-schema-public.md) y su captura. El esquema actualizado documenta las cinco tablas del inventario y sus políticas RLS de lectura. No hay en el repositorio evidencia de verificación de los cuerpos/grants de RPC ni de pruebas funcionales en remoto con usuarios `events` y otros roles. La migración correctiva requiere aún validación de atributos distintos y traslados concurrentes; el estado de pruebas y compilación registrado corresponde al commit inicial.
**Alcance:** rol `events`, ruta `/events/inventory`, migración, Server Actions y maquetas de [`prototypes/events-inventory/`](./prototypes/events-inventory).
**Documentos relacionados:** [`perfiles-de-usuario.md`](../perfiles-de-usuario.md), [`kromi-connect-srs.md`](../kromi-connect-srs.md) §7, [`supabase-db-migration.md`](../supabase-db-migration.md) §15.

## 1. Resultado esperado

1. Eventos ve el inventario de **siete sedes** en pestañas (Prebo, Mañongo, Trigal Sur, Trigal Norte, Guataparo, Castillito, San Felipe), con conteo por sede.
2. Busca y filtra por categoría, ubicación, condición y tipo de control; ordena y pagina. El estado vive en la URL.
3. Añade y edita artículos, registra **traslados, salidas, retornos y ajustes**, y consulta la **actividad** de cada artículo.
4. Cada movimiento de inventario queda con usuario y fecha; el historial de movimientos no se edita. Los cambios descriptivos del artículo conservan únicamente el último usuario y fecha de modificación, sin historial de valores anteriores. Los errores de cantidad se corrigen con un ajuste con motivo.
5. Dos personas pueden trabajar a la vez sin pisarse (control de versión).

## 2. Modelo de datos

| Tabla | Contenido |
|---|---|
| `inventario_sedes` | Catálogo propio de sedes (no depende de `sede_enum`, que solo conoce Prebo y Mañongo). |
| `inventario_ubicaciones` | Ubicaciones internas por sede; única por (sede, nombre normalizado). |
| `inventario_categorias` | Insumo, Mobiliario, Decoración. |
| `inventario_articulos` | Una fila por (artículo, ubicación). `tipo_control` `LOTE` o `INDIVIDUAL`; una unidad individual tiene `cantidad` 0 o 1 y código único. `condicion`, `version`, metadatos de creación y última modificación, `atributos` jsonb reservado. |
| `inventario_movimientos` | Historial inmutable (trigger que bloquea UPDATE y DELETE). Tipos `CONTEO_INICIAL`, `TRASLADO`, `SALIDA`, `RETORNO`, `AJUSTE`. |

No reutiliza `inventario_premios` (premios de sorteos).

### 2.1 Semántica de movimientos

| Tipo | Efecto |
|---|---|
| `TRASLADO` | Descuenta en el origen y suma en el destino (busca o crea la fila de destino con la misma categoría, nombre normalizado, especificaciones, unidad, condición y atributos). La búsqueda/creación se serializa por identidad para evitar filas duplicadas en traslados concurrentes. Una unidad individual cambia de ubicación sin duplicarse. |
| `SALIDA` | Descuenta; `destino_externo` es texto libre. Una unidad individual pasa a 0 ("Fuera de sede"). |
| `RETORNO` | Suma en la ubicación elegida; una unidad individual pasa de 0 a 1. |
| `AJUSTE` | La cantidad enviada es la **contada**; se guarda la diferencia con signo. Motivo obligatorio. |
| `CONTEO_INICIAL` | Lo escribe el sistema al crear el artículo. |

Invariante: la suma de los `delta` de la actividad de un artículo es igual a su saldo actual.

### 2.2 Concurrencia y duplicados

- `version` aumenta con cada cambio; las funciones fallan con `CONFLICTO_VERSION` si el cliente trabaja sobre una versión vieja. La interfaz muestra las diferencias o refresca el artículo.
- Al recibir un traslado, lotes con distinta unidad o atributos no se consolidan. La búsqueda y creación del lote destino usa un bloqueo transaccional por identidad.
- Crear un lote parecido a uno existente en la misma ubicación puede devolver `POSIBLE_DUPLICADO`; la interfaz ofrece "Crear de todos modos". Esta detección es preventiva y no constituye una restricción única.

## 3. Permisos

| Código | Rol `events` | Uso |
|---|---|---|
| `events.inventory.read` | Sí | Ver `/events/inventory`, filtros y actividad. |
| `events.inventory.create` | Sí | Añadir artículos. |
| `events.inventory.update` | Sí | Editar datos descriptivos. |
| `events.inventory.move` | Sí | Registrar movimientos y ajustes. |
| `events.inventory.locations.create` | Sí | Crear ubicaciones desde la app. |

Los demás roles no reciben concesiones. RLS solo permite SELECT a quien tenga `events.inventory.read`; todo INSERT/UPDATE/DELETE está revocado y se hace con funciones `SECURITY DEFINER` (`search_path=''`) que vuelven a comprobar el permiso. Las Server Actions usan el cliente autenticado del usuario, no la service role.

## 4. Archivos

| Capa | Archivos |
|---|---|
| Migraciones | `supabase/migrations/202610130001_events_inventory.sql`, `202610130002_events_inventory_transfer_identity.sql` |
| Tipos | `src/types/modules/inventory.ts`, `src/types/database.types.ts` |
| Lógica pura | `src/lib/inventory.ts` (consulta en URL, formato, validadores); pruebas en `tests/inventory.test.ts` |
| Acciones | `src/app/actions/inventory/inventory.ts` |
| Rutas | `src/app/(dashboard)/events/{layout,shell,page}.tsx`, `events/inventory/{page,InventoryView}.tsx` |
| Componentes | `events/inventory/components/{InventoryTable,InventoryFilters,ArticleForm,MovementForm,ActivityPanel,ui}.tsx` |
| Redirección por rol | `src/app/actions/auth.ts`, `login/page.tsx`, `access-pending/page.tsx` (`events` → `/events/inventory`) |

## 5. Mapa de maquetas

| Maqueta | Implementada en |
|---|---|
| `Main.dc.html` | `InventoryView`, `InventoryTable`, `InventoryFilters` |
| `Formulario.dc.html` | `ArticleForm` |
| `Actividad.dc.html` | `ActivityPanel` |
| `Estados.dc.html` | Estados vacío, sin resultados, error, carga y conflicto en `InventoryView`, `ArticleForm`, `MovementForm` |
| `Movil.dc.html` | Tarjetas bajo el breakpoint `md` en `InventoryTable` |
| `Modelo.dc.html`, `Decisiones.dc.html` | Referencia de modelo y decisiones (§2 y §7) |

Las maquetas son referencia visual; si difieren de este documento, gana el documento. El marco de layout del lienzo es ilustrativo.

## 6. Fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Verificar en remoto: roles y permisos existentes, que no haya tablas `inventario_*` distintas de `inventario_premios`, y `has_permission`. | Aplicación reportada; confirmar permisos/RPC y pruebas de acceso por rol. |
| 1 | Aplicar ambas migraciones en un entorno de prueba y repetir las pruebas SQL con usuarios reales de `events` y `social-media`, incluyendo atributos distintos y traslados simultáneos al mismo destino. | Migraciones aplicadas según reporte; pruebas funcionales/RPC, atributos distintos y concurrencia pendientes. |
| 2 | Vistas, acciones y pruebas unitarias. | Hecho (local) |
| 3 | Revisión con el equipo de Eventos: lista de unidades, formato de código, ubicaciones por sede. | **Pendiente** |
| 4 | Importación del Excel actual (§8). | **Pendiente** |
| 5 | Aplicar en producción, `supabase db pull`, actualizar `supabase-schema-public.md` y su captura. | Aplicación y actualización del esquema reportadas; conciliar con `supabase db pull` y confirmar estado productivo. |

### Verificación SQL sugerida tras aplicar

```sql
select codigo, nombre from public.inventario_sedes order by orden;
select p.code from public.role_permissions rp join public.app_permissions p on p.code = rp.permission_code
where rp.role_code = 'events' and p.code like 'events.inventory.%' order by 1;
select tgname from pg_trigger where tgrelid = 'public.inventario_movimientos'::regclass and not tgisinternal;
```

## 7. Decisiones pendientes y supuestos

| Tema | Supuesto actual | Falta confirmar |
|---|---|---|
| Ubicaciones | **No se siembran**: el Excel lista nombres pero no confirma a qué sede pertenece cada uno. Se crean desde la app. | Lista por sede. |
| Categoría "Equipos" | No existe; solo hay Insumo, Mobiliario y Decoración (las del Excel). | Si se añade. |
| Unidad de medida | Texto libre con sugerencias (`UNIDADES_SUGERIDAS`). | Lista definitiva. |
| Códigos individuales | Texto libre único (sin distinguir mayúsculas). | Formato o prefijo. |
| Quién más puede ver | Solo `events`. | Si Social Media, Interno o Gerencia necesitan lectura. |
| Baja de artículos | Se usa la condición `DADO_DE_BAJA`; no hay borrado. | Política de depuración. |
| Reversión de movimientos | Se corrige con un ajuste; `corrige_movimiento_id` queda disponible. | Si hace falta una acción "corregir". |

## 8. Importación del Excel (fase 4)

El Excel actual tiene 253 filas y 250 nombres distintos. Plan:

1. Normalizar nombres (espacios, mayúsculas, tildes) y detectar duplicados reales frente a variantes de especificación.
2. Mapear cada fila a sede, ubicación y categoría; las ubicaciones nuevas se crean primero.
3. Decidir lote o individual: individual solo si hay código o etiqueta propia.
4. Cargar con una función SQL de importación o `INSERT` revisado que escriba también el `CONTEO_INICIAL`, de modo que se cumpla el invariante saldo = suma de deltas.
5. Revisión del equipo sobre un informe de filas ambiguas antes de cargar.

No hay script de importación en esta rama.

## 9. Fuera de alcance

Reservas de artículos para eventos, calendario de eventos, fotos y adjuntos, códigos QR, alertas de stock mínimo, reportes y exportación, y reasignación o reversión de movimientos.
