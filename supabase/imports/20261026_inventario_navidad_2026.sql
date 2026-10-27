-- Importa la pestaña Normalizado de inventario_navidad_2026_normalizado.xlsx.
-- No ejecuta migraciones de esquema ni usa datos de CONTROL DE INVENTARIO MERCADEO.
-- Solo entran filas con sede, ubicación y cantidad resueltas.
-- Excluidas: 25 filas de NAVIDAD 2026 (sede/ubicación pendientes) y Trigal Sur fila Excel 19 (cantidad vacía).
-- San Diego está mapeado a Castillito. Guataparo/TERRAZA fue inferido desde OBSERVACION.
-- Supuestos del normalizado: Decoración, LOTE, unidades y DISPONIBLE.
-- Filas con nombres repetidos se mantienen separadas. El origen se conserva en atributos y en CONTEO_INICIAL.
-- Ejecutar en Supabase SQL Editor. La transacción aborta completa ante error y tiene marcador anti-repetición.

begin;

create table if not exists public.inventory_import_batches (
  batch_key text primary key,
  source_name text not null,
  imported_at timestamptz not null default now(),
  imported_rows integer not null,
  source_rows integer not null
);
alter table public.inventory_import_batches enable row level security;
revoke all on public.inventory_import_batches from anon, authenticated;

do $$
begin
  if exists (select 1 from public.inventory_import_batches where batch_key = 'inventario-navidad-2026-normalizado-v1') then
    raise exception 'Esta importación ya fue registrada; no vuelvas a ejecutarla.';
  end if;
end;
$$;

create temp table navidad_2026_source (
  source_id text primary key,
  source_sheet text not null,
  source_row integer not null,
  sede_nombre text not null,
  ubicacion_nombre text not null,
  nombre_original text not null,
  nombre_normalizado text not null,
  cantidad numeric(12,2) not null check (cantidad >= 0),
  unidad_medida text not null,
  categoria_nombre text not null,
  observacion_original text,
  grupo_duplicado text
) on commit drop;

insert into navidad_2026_source (
  source_id, source_sheet, source_row, sede_nombre, ubicacion_nombre,
  nombre_original, nombre_normalizado, cantidad, unidad_medida, categoria_nombre,
  observacion_original, grupo_duplicado
) values  ('NAV26-001', 'NAVIDAD PREBO', 9, 'Prebo', 'TERRAZA', 'BOLAS GRANDES ROJAS', 'BOLAS GRANDES ROJAS', 28::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-002', 'NAVIDAD PREBO', 10, 'Prebo', 'TERRAZA', 'BOLAS MEDIANAS ROJAS', 'BOLAS MEDIANAS ROJAS', 37::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-003', 'NAVIDAD PREBO', 11, 'Prebo', 'TERRAZA', 'PIES DE SANTA', 'PIES DE SANTA', 27::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-004', 'NAVIDAD PREBO', 12, 'Prebo', 'TERRAZA', 'BOTAS DE FIELTRO', 'BOTAS DE FIELTRO', 16::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-005', 'NAVIDAD PREBO', 13, 'Prebo', 'TERRAZA', 'BOLAS PEQUEÑAS ROJAS BRILLANTES', 'BOLAS PEQUEÑAS ROJAS BRILLANTES', 71::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-006', 'NAVIDAD PREBO', 14, 'Prebo', 'TERRAZA', 'LUCES DE MANGUERA', 'LUCES DE MANGUERA', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-007', 'NAVIDAD PREBO', 15, 'Prebo', 'TERRAZA', 'BAMBALINAS BLANCAS', 'BAMBALINAS BLANCAS', 150::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-bambalinas-blancas'),
  ('NAV26-008', 'NAVIDAD PREBO', 16, 'Prebo', 'TERRAZA', 'BAMBALINAS ROJAS PEQUEÑAS', 'BAMBALINAS ROJAS PEQUEÑAS', 51::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-009', 'NAVIDAD PREBO', 17, 'Prebo', 'TERRAZA', 'ESPIGAS ROJAS', 'ESPIGAS ROJAS', 21::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-010', 'NAVIDAD PREBO', 18, 'Prebo', 'TERRAZA', 'ESTRELAS ROJAS', 'ESTRELAS ROJAS', 13::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-011', 'NAVIDAD PREBO', 19, 'Prebo', 'TERRAZA', 'ESTELLAS MEDIANA', 'ESTELLAS MEDIANA', 9::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-012', 'NAVIDAD PREBO', 20, 'Prebo', 'TERRAZA', 'ESTRELAS PEQUEÑAS', 'ESTRELAS PEQUEÑAS', 4::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-013', 'NAVIDAD PREBO', 21, 'Prebo', 'TERRAZA', 'REGLETA BLANCA', 'REGLETA BLANCA', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-014', 'NAVIDAD PREBO', 22, 'Prebo', 'TERRAZA', 'CASCABELES BLANCOS', 'CASCABELES BLANCOS', 17::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-015', 'NAVIDAD PREBO', 23, 'Prebo', 'TERRAZA', 'ROSCAS PARA LINEA DE CAJA', 'ROSCAS PARA LINEA DE CAJA', 21::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-016', 'NAVIDAD PREBO', 24, 'Prebo', 'TERRAZA', 'BAMBALINAS FORRADAS PLATEADAS', 'BAMBALINAS FORRADAS PLATEADAS', 46::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-017', 'NAVIDAD PREBO', 25, 'Prebo', 'TERRAZA', 'ESTRELLAS DORADAS PLANAS ESCARCHADAS', 'ESTRELLAS DORADAS PLANAS ESCARCHADAS', 9::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-018', 'NAVIDAD PREBO', 26, 'Prebo', 'TERRAZA', 'FLORES ROJAS', 'FLORES ROJAS', 27::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-019', 'NAVIDAD PREBO', 27, 'Prebo', 'TERRAZA', 'CARAMELOS DE NAVIDAD', 'CARAMELOS DE NAVIDAD', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-020', 'NAVIDAD PREBO', 28, 'Prebo', 'TERRAZA', 'GURRUFIOS', 'GURRUFIOS', 45::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-021', 'NAVIDAD PREBO', 29, 'Prebo', 'TERRAZA', 'BAMBALINAS DE FIELTRO', 'BAMBALINAS DE FIELTRO', 4::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-bambalinas-de-fieltro'),
  ('NAV26-022', 'NAVIDAD PREBO', 30, 'Prebo', 'TERRAZA', 'RAMAS PLATEADAS', 'RAMAS PLATEADAS', 18::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-023', 'NAVIDAD PREBO', 31, 'Prebo', 'TERRAZA', 'RAMAS ROJAS', 'RAMAS ROJAS', 5::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-ramas-rojas'),
  ('NAV26-024', 'NAVIDAD PREBO', 32, 'Prebo', 'TERRAZA', 'COPOS NIEVE ROJOS', 'COPOS NIEVE ROJOS', 3::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-025', 'NAVIDAD PREBO', 33, 'Prebo', 'TERRAZA', 'COPOS DE NIEVE BLANCOS', 'COPOS DE NIEVE BLANCOS', 9::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-026', 'NAVIDAD PREBO', 34, 'Prebo', 'TERRAZA', 'RAMAS ROJAS', 'RAMAS ROJAS', 25::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-ramas-rojas'),
  ('NAV26-027', 'NAVIDAD PREBO', 35, 'Prebo', 'TERRAZA', 'LUCES DE NAVIDAD', 'LUCES DE NAVIDAD', 46::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-028', 'NAVIDAD PREBO', 36, 'Prebo', 'TERRAZA', 'COPOS DE ANIME', 'COPOS DE ANIME', 45::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-029', 'NAVIDAD PREBO', 37, 'Prebo', 'TERRAZA', 'ESTRELLA GRANDE DORADA PUNTA DEL ARBOL', 'ESTRELLA GRANDE DORADA PUNTA DEL ARBOL', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-030', 'NAVIDAD PREBO', 38, 'Prebo', 'TERRAZA', 'BOLSAS DE RAMAS DE NAVIDAD 5 C/U', 'BOLSAS DE RAMAS DE NAVIDAD 5 C/U', 18::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-031', 'NAVIDAD PREBO', 39, 'Prebo', 'TERRAZA', 'PELUCHES', 'PELUCHES', 17::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-032', 'NAVIDAD PREBO', 40, 'Prebo', 'TERRAZA', 'COPA DE ARBOL', 'COPA DE ARBOL', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-033', 'NAVIDAD PREBO', 41, 'Prebo', 'TERRAZA', 'CAJAS DE ANIME DE 15 C/U', 'CAJAS DE ANIME DE 15 C/U', 3::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-034', 'NAVIDAD PREBO', 42, 'Prebo', 'TERRAZA', 'CASCANUECES GRANDES', 'CASCANUECES GRANDES', 4::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-035', 'NAVIDAD PREBO', 43, 'Prebo', 'TERRAZA', 'BAMBALINAS MARCAS POLAR', 'BAMBALINAS MARCAS POLAR', 30::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-036', 'NAVIDAD PREBO', 44, 'Prebo', 'TERRAZA', 'BAMBALINAS DE FIELTRO', 'BAMBALINAS DE FIELTRO', 55::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-bambalinas-de-fieltro'),
  ('NAV26-037', 'NAVIDAD PREBO', 45, 'Prebo', 'TERRAZA', 'TAMBORES', 'TAMBORES', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-038', 'NAVIDAD PREBO', 46, 'Prebo', 'TERRAZA', 'ADORNOS NAVIDEÑOS', 'ADORNOS NAVIDEÑOS', 15::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-039', 'NAVIDAD PREBO', 47, 'Prebo', 'TERRAZA', 'DUENDES DE PELUCHE', 'DUENDES DE PELUCHE', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-040', 'NAVIDAD PREBO', 48, 'Prebo', 'TERRAZA', 'BANQUITO', 'BANQUITO', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-041', 'NAVIDAD PREBO', 49, 'Prebo', 'TERRAZA', 'BAMBALINAS BLANCAS', 'BAMBALINAS BLANCAS', 24::numeric, 'unidades', 'Decoración', null, 'DUP-prebo-bambalinas-blancas'),
  ('NAV26-042', 'NAVIDAD PREBO', 50, 'Prebo', 'TERRAZA', 'BAMBALINAS DORADAS', 'BAMBALINAS DORADAS', 24::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-043', 'NAVIDAD PREBO', 51, 'Prebo', 'TERRAZA', 'BAMBALINAS VERDES', 'BAMBALINAS VERDES', 24::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-044', 'NAVIDAD PREBO', 52, 'Prebo', 'TERRAZA', 'GUIRNALDA VERDE', 'GUIRNALDA VERDE', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-045', 'NAVIDAD PREBO', 53, 'Prebo', 'TERRAZA', 'BAMBALINAS ESCALERA', 'BAMBALINAS ESCALERA', 90::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-046', 'NAVIDAD PREBO', 54, 'Prebo', 'TERRAZA', 'ROSCA GRANDE PUERTA DE ENTRADA', 'ROSCA GRANDE PUERTA DE ENTRADA', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-047', 'NAVIDAD PREBO', 55, 'Prebo', 'TERRAZA', 'INFLABLE', 'INFLABLE', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-048', 'NAVIDAD PREBO', 56, 'Prebo', 'TERRAZA', 'CILINDROS', 'CILINDROS', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-049', 'NAVIDAD MAÑONGO', 9, 'Mañongo', 'ALMACEN SUPERIOR', 'LUCES DE NAVIDAD', 'LUCES DE NAVIDAD', 39::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-050', 'NAVIDAD MAÑONGO', 10, 'Mañongo', 'ALMACEN SUPERIOR', 'REGLETAS', 'REGLETAS', 4::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-051', 'NAVIDAD MAÑONGO', 11, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLA DORADA GRANDE', 'ESTRELLA DORADA GRANDE', 17::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-052', 'NAVIDAD MAÑONGO', 12, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLAS VERDES TELA GRANDE', 'ESTRELLAS VERDES TELA GRANDE', 16::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-053', 'NAVIDAD MAÑONGO', 13, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLAS VERDES TELA MEDIANA', 'ESTRELLAS VERDES TELA MEDIANA', 4::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-054', 'NAVIDAD MAÑONGO', 14, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLAS ESCARCHADAS PEQUEÑAS', 'ESTRELLAS ESCARCHADAS PEQUEÑAS', 4::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-055', 'NAVIDAD MAÑONGO', 15, 'Mañongo', 'ALMACEN SUPERIOR', 'BOLAS ANIME VERDE GRANDE', 'BOLAS ANIME VERDE GRANDE', 110::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-056', 'NAVIDAD MAÑONGO', 16, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLA DORADA', 'ESTRELLA DORADA', 1::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-057', 'NAVIDAD MAÑONGO', 17, 'Mañongo', 'ALMACEN SUPERIOR', 'RAMAS VERDES', 'RAMAS VERDES', 170::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', 'DUP-manongo-ramas-verdes'),
  ('NAV26-058', 'NAVIDAD MAÑONGO', 18, 'Mañongo', 'ALMACEN SUPERIOR', 'EXTENCIÓN LED VERDE', 'EXTENCIÓN LED VERDE', 1::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-059', 'NAVIDAD MAÑONGO', 19, 'Mañongo', 'ALMACEN SUPERIOR', 'EXTENCIÓN LED AMARILLA', 'EXTENCIÓN LED AMARILLA', 1::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-060', 'NAVIDAD MAÑONGO', 20, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLAS ANIME DORADA', 'ESTRELLAS ANIME DORADA', 54::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-061', 'NAVIDAD MAÑONGO', 21, 'Mañongo', 'ALMACEN SUPERIOR', 'BOLAS DORADAS MEDIANA', 'BOLAS DORADAS MEDIANA', 190::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-062', 'NAVIDAD MAÑONGO', 22, 'Mañongo', 'ALMACEN SUPERIOR', 'BOLAS DORADAS PEQUEÑAS', 'BOLAS DORADAS PEQUEÑAS', 150::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-063', 'NAVIDAD MAÑONGO', 23, 'Mañongo', 'ALMACEN SUPERIOR', 'BOLAS DORADAS RAPHIA', 'BOLAS DORADAS RAPHIA', 38::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-064', 'NAVIDAD MAÑONGO', 24, 'Mañongo', 'ALMACEN SUPERIOR', 'COPOS DORADOS TELA', 'COPOS DORADOS TELA', 10::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-065', 'NAVIDAD MAÑONGO', 25, 'Mañongo', 'ALMACEN SUPERIOR', 'BAMBALINAS FELPUDAS', 'BAMBALINAS FELPUDAS', 4::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-066', 'NAVIDAD MAÑONGO', 26, 'Mañongo', 'ALMACEN SUPERIOR', 'COPOS NIEVE VERDES GRANDE', 'COPOS NIEVE VERDES GRANDE', 3::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-067', 'NAVIDAD MAÑONGO', 27, 'Mañongo', 'ALMACEN SUPERIOR', 'LAZOS GRANDE DORADOS', 'LAZOS GRANDE DORADOS', 7::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-068', 'NAVIDAD MAÑONGO', 28, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLAS GRANDES DORADAS', 'ESTRELLAS GRANDES DORADAS', 17::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-069', 'NAVIDAD MAÑONGO', 29, 'Mañongo', 'ALMACEN SUPERIOR', 'PELUCXHE CON GUIRNALDAS', 'PELUCXHE CON GUIRNALDAS', 13::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-070', 'NAVIDAD MAÑONGO', 30, 'Mañongo', 'ALMACEN SUPERIOR', 'FLORES', 'FLORES', 68::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-071', 'NAVIDAD MAÑONGO', 31, 'Mañongo', 'ALMACEN SUPERIOR', 'RAMAS VERDES', 'RAMAS VERDES', 35::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', 'DUP-manongo-ramas-verdes'),
  ('NAV26-072', 'NAVIDAD MAÑONGO', 32, 'Mañongo', 'ALMACEN SUPERIOR', 'ESTRELLA CARTON AMARILLO', 'ESTRELLA CARTON AMARILLO', 8::numeric, 'unidades', 'Decoración', 'DEC.ARBOL', null),
  ('NAV26-073', 'NAVIDAD MAÑONGO', 33, 'Mañongo', 'ALMACEN SUPERIOR', 'CASCANUECES GRANDES', 'CASCANUECES GRANDES', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-074', 'NAVIDAD MAÑONGO', 34, 'Mañongo', 'ALMACEN SUPERIOR', 'CASCANUECES PEQUEÑOS', 'CASCANUECES PEQUEÑOS', 7::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-075', 'NAVIDAD MAÑONGO', 35, 'Mañongo', 'ALMACEN SUPERIOR', 'CORONAS DE CEREZA', 'CORONAS DE CEREZA', 6::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-076', 'NAVIDAD MAÑONGO', 36, 'Mañongo', 'ALMACEN SUPERIOR', 'PORRONES NAVIDEÑOS', 'PORRONES NAVIDEÑOS', 3::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-077', 'GUATAPARO', 9, 'Guataparo', 'TERRAZA', 'BAMBALINAS GRANDES', 'BAMBALINAS GRANDES', 8::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-078', 'GUATAPARO', 10, 'Guataparo', 'TERRAZA', 'ESTRELLAS GRANDES PLATEADAS', 'ESTRELLAS GRANDES PLATEADAS', 4::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-079', 'GUATAPARO', 11, 'Guataparo', 'TERRAZA', 'BAMBALINAS PEQUEÑAS', 'BAMBALINAS PEQUEÑAS', 94::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-080', 'GUATAPARO', 12, 'Guataparo', 'TERRAZA', 'ESTRELLAS PEQUEÑAS PLATEDAS', 'ESTRELLAS PEQUEÑAS PLATEDAS', 5::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-081', 'GUATAPARO', 13, 'Guataparo', 'TERRAZA', 'BAMBALINAS DE MADERA', 'BAMBALINAS DE MADERA', 4::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-082', 'GUATAPARO', 14, 'Guataparo', 'TERRAZA', 'PINITOS BASE ROJA', 'PINITOS BASE ROJA', 2::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-083', 'GUATAPARO', 15, 'Guataparo', 'TERRAZA', 'CASCANUECES PEQUEÑOS', 'CASCANUECES PEQUEÑOS', 2::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-084', 'GUATAPARO', 16, 'Guataparo', 'TERRAZA', 'CORONAS DE CEREZO', 'CORONAS DE CEREZO', 2::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-085', 'GUATAPARO', 17, 'Guataparo', 'TERRAZA', 'LUCES NAVIDEÑAS', 'LUCES NAVIDEÑAS', 3::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-086', 'GUATAPARO', 18, 'Guataparo', 'TERRAZA', 'EXTENCION NARANJA', 'EXTENCION NARANJA', 1::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-087', 'GUATAPARO', 19, 'Guataparo', 'TERRAZA', 'BOLSAS DE GUIRNALDAS', 'BOLSAS DE GUIRNALDAS', 3::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-088', 'GUATAPARO', 20, 'Guataparo', 'TERRAZA', 'LAZOS ROJOS', 'LAZOS ROJOS', 2::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-089', 'GUATAPARO', 21, 'Guataparo', 'TERRAZA', 'CINTAS DE CUADROS NEGROS', 'CINTAS DE CUADROS NEGROS', 4::numeric, 'unidades', 'Decoración', 'TERRAZA', null),
  ('NAV26-090', 'NAVIDAD TRIGAL NORTE', 9, 'Trigal Norte', 'ALMACEN DE BODEGON', 'FLORES AZULES', 'FLORES AZULES', 31::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-091', 'NAVIDAD TRIGAL NORTE', 10, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ESPIGAS AZULES', 'ESPIGAS AZULES', 15::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-092', 'NAVIDAD TRIGAL NORTE', 11, 'Trigal Norte', 'ALMACEN DE BODEGON', 'HOJAS AZULES', 'HOJAS AZULES', 23::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-093', 'NAVIDAD TRIGAL NORTE', 12, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ESPIGAS PLATEDAS', 'ESPIGAS PLATEDAS', 18::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-094', 'NAVIDAD TRIGAL NORTE', 13, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ESPIGAS PLATEADAS PEQUEÑAS', 'ESPIGAS PLATEADAS PEQUEÑAS', 38::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-095', 'NAVIDAD TRIGAL NORTE', 14, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ESPIGAS PLATEADAS GRANDES', 'ESPIGAS PLATEADAS GRANDES', 8::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-096', 'NAVIDAD TRIGAL NORTE', 15, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ESTRELLAS PAPEL PLATEADAS', 'ESTRELLAS PAPEL PLATEADAS', 8::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-097', 'NAVIDAD TRIGAL NORTE', 16, 'Trigal Norte', 'ALMACEN DE BODEGON', 'COPOS DE NIEVE PLATEADOS', 'COPOS DE NIEVE PLATEADOS', 3::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-098', 'NAVIDAD TRIGAL NORTE', 17, 'Trigal Norte', 'ALMACEN DE BODEGON', 'COPOS DE NIEVE TIPO CADENETA', 'COPOS DE NIEVE TIPO CADENETA', 11::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-099', 'NAVIDAD TRIGAL NORTE', 18, 'Trigal Norte', 'ALMACEN DE BODEGON', 'LUCES DE MANGUERA', 'LUCES DE MANGUERA', 2::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-100', 'NAVIDAD TRIGAL NORTE', 19, 'Trigal Norte', 'ALMACEN DE BODEGON', 'REGLETA', 'REGLETA', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-101', 'NAVIDAD TRIGAL NORTE', 20, 'Trigal Norte', 'ALMACEN DE BODEGON', 'EXTENCION', 'EXTENCION', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-102', 'NAVIDAD TRIGAL NORTE', 21, 'Trigal Norte', 'ALMACEN DE BODEGON', 'LUCES DE NAVIDAD', 'LUCES DE NAVIDAD', 17::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-103', 'NAVIDAD TRIGAL NORTE', 22, 'Trigal Norte', 'ALMACEN DE BODEGON', 'MUÑECOS DE NIEVE', 'MUÑECOS DE NIEVE', 4::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-104', 'NAVIDAD TRIGAL NORTE', 23, 'Trigal Norte', 'ALMACEN DE BODEGON', 'HOJAS DORADAS', 'HOJAS DORADAS', 5::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-105', 'NAVIDAD TRIGAL NORTE', 24, 'Trigal Norte', 'ALMACEN DE BODEGON', 'COPOS AZULES', 'COPOS AZULES', 5::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-106', 'NAVIDAD TRIGAL NORTE', 25, 'Trigal Norte', 'ALMACEN DE BODEGON', 'PELUCHES', 'PELUCHES', 4::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-107', 'NAVIDAD TRIGAL NORTE', 26, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ROSCAS DE NAVIDAD', 'ROSCAS DE NAVIDAD', 4::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-108', 'NAVIDAD TRIGAL NORTE', 27, 'Trigal Norte', 'ALMACEN DE BODEGON', 'BAMBALINAS', 'BAMBALINAS', 130::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-109', 'NAVIDAD TRIGAL NORTE', 28, 'Trigal Norte', 'ALMACEN DE BODEGON', 'ARBOLES DE NAVIDAD', 'ARBOLES DE NAVIDAD', 3::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-110', 'NAVIDAD TRIGAL NORTE', 29, 'Trigal Norte', 'ALMACEN DE BODEGON', 'MUÑECO INFLABLE', 'MUÑECO INFLABLE', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-111', 'NAVIDAD TRIGAL SUR', 9, 'Trigal Sur', 'ALMACEN COSMETICO', 'MUÑECO INFLABLE', 'MUÑECO INFLABLE', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-112', 'NAVIDAD TRIGAL SUR', 10, 'Trigal Sur', 'ALMACEN COSMETICO', 'EXTENSION NARANJA', 'EXTENSION NARANJA', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-113', 'NAVIDAD TRIGAL SUR', 11, 'Trigal Sur', 'ALMACEN COSMETICO', 'MATEROS DE NAVIDAD', 'MATEROS DE NAVIDAD', 6::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-114', 'NAVIDAD TRIGAL SUR', 12, 'Trigal Sur', 'ALMACEN COSMETICO', 'ROSCA GRANDE', 'ROSCA GRANDE', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-115', 'NAVIDAD TRIGAL SUR', 13, 'Trigal Sur', 'ALMACEN COSMETICO', 'RAMAS DE CEREZO', 'RAMAS DE CEREZO', 9::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-116', 'NAVIDAD TRIGAL SUR', 14, 'Trigal Sur', 'ALMACEN COSMETICO', 'BAMBALINAS CON MARCAS POLAR', 'BAMBALINAS CON MARCAS POLAR', 12::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-117', 'NAVIDAD TRIGAL SUR', 15, 'Trigal Sur', 'ALMACEN COSMETICO', 'GUIRNALDA MODULO DE CAJA', 'GUIRNALDA MODULO DE CAJA', 1::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-118', 'NAVIDAD TRIGAL SUR', 16, 'Trigal Sur', 'ALMACEN COSMETICO', 'ROSCAS VERDES CON BOTAS', 'ROSCAS VERDES CON BOTAS', 7::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-119', 'NAVIDAD TRIGAL SUR', 17, 'Trigal Sur', 'ALMACEN COSMETICO', 'LUCES DE NAVIDAD', 'LUCES DE NAVIDAD', 8::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-120', 'NAVIDAD TRIGAL SUR', 18, 'Trigal Sur', 'ALMACEN COSMETICO', 'RAMAS VERDES', 'RAMAS VERDES', 5::numeric, 'unidades', 'Decoración', null, null),
  ('NAV26-122', 'NAVIDAD SAN DIEGO', 9, 'Castillito', 'ALMACEN MAÑONGO', 'BAMBALINAS GRANDES', 'BAMBALINAS GRANDES', 7::numeric, 'unidades', 'Decoración', 'DEC. TIENDA', null),
  ('NAV26-123', 'NAVIDAD SAN DIEGO', 10, 'Castillito', 'ALMACEN MAÑONGO', 'BAMBALINAS PEQUEÑAS', 'BAMBALINAS PEQUEÑAS', 30::numeric, 'unidades', 'Decoración', 'DEC. TIENDA', null),
  ('NAV26-124', 'NAVIDAD SAN DIEGO', 11, 'Castillito', 'ALMACEN MAÑONGO', 'CORONA CON PELUCHE', 'CORONA CON PELUCHE', 3::numeric, 'unidades', 'Decoración', 'DEC. TIENDA', null),
  ('NAV26-125', 'NAVIDAD SAN DIEGO', 12, 'Castillito', 'ALMACEN MAÑONGO', 'CASCANUES PEQUEÑO', 'CASCANUES PEQUEÑO', 1::numeric, 'unidades', 'Decoración', 'DEC. TIENDA', null),
  ('NAV26-126', 'NAVIDAD SAN DIEGO', 13, 'Castillito', 'ALMACEN MAÑONGO', 'ARBOLITO ALTO PEQUEÑO ROJO', 'ARBOLITO ALTO PEQUEÑO ROJO', 1::numeric, 'unidades', 'Decoración', 'DEC. TIENDA', null);


do $$
declare
  v_missing text;
begin
  select string_agg(distinct src.sede_nombre, ', ') into v_missing
  from navidad_2026_source src
  left join public.inventario_sedes s on lower(trim(s.nombre)) = lower(trim(src.sede_nombre)) and s.activa
  where s.id is null;
  if v_missing is not null then raise exception 'Sedes inexistentes/inactivas: %', v_missing; end if;

  select string_agg(distinct src.categoria_nombre, ', ') into v_missing
  from navidad_2026_source src
  left join public.inventario_categorias c on lower(trim(c.nombre)) = lower(trim(src.categoria_nombre)) and c.activa
  where c.id is null;
  if v_missing is not null then raise exception 'Categorías inexistentes/inactivas: %', v_missing; end if;
end;
$$;

insert into public.inventario_ubicaciones (sede_id, nombre, activa)
select distinct s.id, src.ubicacion_nombre, true
from navidad_2026_source src
join public.inventario_sedes s on lower(trim(s.nombre)) = lower(trim(src.sede_nombre)) and s.activa
where not exists (
  select 1 from public.inventario_ubicaciones u
  where u.sede_id = s.id and lower(trim(u.nombre)) = lower(trim(src.ubicacion_nombre))
);

create temp table navidad_2026_resolved on commit drop as
select src.*, s.id as sede_id, u.id as ubicacion_id, c.id as categoria_id
from navidad_2026_source src
join public.inventario_sedes s on lower(trim(s.nombre)) = lower(trim(src.sede_nombre)) and s.activa
join public.inventario_ubicaciones u on u.sede_id = s.id and lower(trim(u.nombre)) = lower(trim(src.ubicacion_nombre)) and u.activa
join public.inventario_categorias c on lower(trim(c.nombre)) = lower(trim(src.categoria_nombre)) and c.activa;

do $$
begin
  if (select count(*) from navidad_2026_resolved) <> 125 then
    raise exception 'Se esperaban 125 filas resueltas; se encontraron %.', (select count(*) from navidad_2026_resolved);
  end if;
end;
$$;

insert into public.inventario_articulos (
  categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
  unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
)
select
  r.categoria_id, r.nombre_original, null,
  jsonb_build_object(
    'importacion', jsonb_build_object(
      'lote', 'inventario-navidad-2026-normalizado-v1',
      'id_fila_origen', r.source_id,
      'hoja_origen', r.source_sheet,
      'fila_excel', r.source_row,
      'nombre_normalizado', r.nombre_normalizado,
      'observacion_excel', r.observacion_original,
      'grupo_duplicado', r.grupo_duplicado
    )
  ),
  'LOTE', null, r.cantidad, r.unidad_medida, r.sede_id, r.ubicacion_id,
  'DISPONIBLE', null, null
from navidad_2026_resolved r
order by r.source_id;

insert into public.inventario_movimientos (
  articulo_id, tipo, cantidad, destino_sede_id, destino_ubicacion_id,
  registrado_por, observacion, saldo_resultante
)
select
  a.id, 'CONTEO_INICIAL', r.cantidad, r.sede_id, r.ubicacion_id, null,
  left(
    'Importación inventario Navidad 2026; ' || r.source_sheet || ' fila ' || r.source_row ||
    case when r.observacion_original is not null and r.observacion_original <> '' then ' Nota Excel: ' || r.observacion_original else '' end,
    500
  ),
  r.cantidad
from navidad_2026_resolved r
join public.inventario_articulos a
  on a.atributos #>> '{importacion,lote}' = 'inventario-navidad-2026-normalizado-v1'
 and a.atributos #>> '{importacion,id_fila_origen}' = r.source_id;

insert into public.inventory_import_batches (batch_key, source_name, imported_rows, source_rows)
values ('inventario-navidad-2026-normalizado-v1', 'inventario_navidad_2026_normalizado.xlsx / pestaña Normalizado', 125, 151);

-- Verificación: 125 artículos, 125 conteos iniciales y 2608 unidades.
select s.nombre as sede, count(a.id) as articulos, sum(a.cantidad) as unidades
from public.inventario_articulos a
join public.inventario_sedes s on s.id = a.sede_id
where a.atributos #>> '{importacion,lote}' = 'inventario-navidad-2026-normalizado-v1'
group by s.nombre
order by s.nombre;

select count(*) as conteos_iniciales, sum(m.cantidad) as unidades_registradas
from public.inventario_movimientos m
join public.inventario_articulos a on a.id = m.articulo_id
where a.atributos #>> '{importacion,lote}' = 'inventario-navidad-2026-normalizado-v1'
  and m.tipo = 'CONTEO_INICIAL';

do $$
declare
  v_items integer;
  v_movements integer;
  v_total numeric;
begin
  select count(*), coalesce(sum(cantidad), 0) into v_items, v_total
  from public.inventario_articulos
  where atributos #>> '{importacion,lote}' = 'inventario-navidad-2026-normalizado-v1';

  select count(*) into v_movements
  from public.inventario_movimientos m
  join public.inventario_articulos a on a.id = m.articulo_id
  where a.atributos #>> '{importacion,lote}' = 'inventario-navidad-2026-normalizado-v1'
    and m.tipo = 'CONTEO_INICIAL';

  if v_items <> 125 or v_movements <> 125 or v_total <> 2608 then
    raise exception 'Verificación fallida: artículos %, conteos %, unidades %.', v_items, v_movements, v_total;
  end if;
end;
$$;
commit;


