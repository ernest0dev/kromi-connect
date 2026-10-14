-- Carga inicial del Excel "CONTROL DE INVENTARIO MERCADEO.xlsx"
-- Generado desde la hoja CONTROL DE INVENTARIO (253 filas; 250 nombres distintos).
-- Supuestos: cantidades como lotes en unidades, condición DISPONIBLE, sin códigos,
-- ubicaciones exactas por sede; duplicados idénticos se consolidan sumando cantidades.
-- La fila 227 tenía cantidad "NO INDICA"; se asigna 10 provisionalmente por indicación del usuario.
-- El movimiento inicial y los atributos del artículo dejan constancia para que Eventos lo valide.
-- IMPORTACIÓN TRANSACCIONAL: cualquier error o excepción aborta y revierte toda la carga.
-- Ejecutar una sola vez por base. El marcador al final impide repetir la importación.
--
-- Revisión de duplicados consolidados:
--   MAÑONGO / MEZZANINA / INSUMO / CESTA DE MIMBRE: filas 126+127 = 2
--   MAÑONGO / NAVIDAD / DECORACIÓN / RAMAS DE ARBOL...: filas 225+250 = 208
--   MAÑONGO / NAVIDAD / DECORACIÓN / RAMAS VERDES: filas 230+244 = 205
--
-- La categoría "Decoración" y sedes "Prebo"/"Mañongo" deben existir por migración.
-- Este script crea las ubicaciones faltantes en base al par sede + nombre.
-- La inserción es administrativa directa desde SQL Editor y registra CONTEO_INICIAL;
-- no invoca las RPC protegidas por permisos de usuario events.

begin;

create table if not exists public.inventory_import_batches (
  batch_key text primary key,
  source_name text not null,
  imported_at timestamptz not null default now(),
  imported_rows integer not null,
  source_rows integer not null
);
revoke all on public.inventory_import_batches from anon, authenticated;

do $$
begin
  if exists (
    select 1 from public.inventory_import_batches
    where batch_key = 'control-inventario-mercadeo-2026-10'
  ) then
    raise exception 'Esta importación ya está registrada. No vuelvas a ejecutar el script.';
  end if;
end;
$$;

create temp table inventory_import_source (
  source_row integer primary key,
  sede_nombre text not null,
  categoria_nombre text not null,
  articulo_nombre text not null,
  ubicacion_nombre text not null,
  cantidad numeric(12,2)
) on commit drop;

insert into inventory_import_source
  (source_row, sede_nombre, categoria_nombre, articulo_nombre, ubicacion_nombre, cantidad)
values
  (4, 'Prebo', 'Mobiliario', 'BACKING GIGANTE (175)', 'SALÓN', 2::numeric),
  (5, 'Prebo', 'Mobiliario', 'BACKING NORMAL (145)', 'SALÓN', 1::numeric),
  (6, 'Prebo', 'Mobiliario', 'MESONES (TABLAS)', 'SALÓN', 8::numeric),
  (7, 'Prebo', 'Mobiliario', 'MESONES (ESTRUCTURAS)', 'SALÓN', 16::numeric),
  (8, 'Prebo', 'Mobiliario', 'BOMBONA HELIO', 'SALÓN', 1::numeric),
  (9, 'Prebo', 'Mobiliario', 'TV SÍRAGON', 'SALÓN', 1::numeric),
  (10, 'Prebo', 'Mobiliario', 'TV (SÍRAGON)', 'SALÓN', 1::numeric),
  (11, 'Prebo', 'Mobiliario', 'CICLON C/MOTOR', 'SALÓN', 1::numeric),
  (12, 'Prebo', 'Mobiliario', 'SKY DANCER C/MOTOR', 'SALÓN', 1::numeric),
  (13, 'Prebo', 'Mobiliario', 'IGLOO C/MOTOR', 'SALÓN', 1::numeric),
  (14, 'Prebo', 'Mobiliario', 'TOTEM C/MOTOR', 'SALÓN', 1::numeric),
  (15, 'Prebo', 'Mobiliario', 'BANDEROLAS FARMACIA (TELA)', 'SALÓN', 2::numeric),
  (16, 'Prebo', 'Mobiliario', 'BANDEROLAS CARNICERÍA (TELA)', 'SALÓN', 2::numeric),
  (17, 'Prebo', 'Mobiliario', 'ESTRUCTURA DE BANDEROLAS', 'SALÓN', 2::numeric),
  (18, 'Prebo', 'Mobiliario', 'BANDEROLAS PESCADERÍA (TELA)', 'SALÓN', 2::numeric),
  (19, 'Prebo', 'Mobiliario', 'BANDEROLAS PESCADERÍA (BANNER)', 'SALÓN', 2::numeric),
  (20, 'Prebo', 'Mobiliario', 'MESON DE ACERO', 'SALÓN', 2::numeric),
  (21, 'Prebo', 'Mobiliario', 'CILINDRO XL', 'SALÓN', 1::numeric),
  (22, 'Prebo', 'Mobiliario', 'CILINDRO VERDE MEDIANO', 'SALÓN', 1::numeric),
  (23, 'Prebo', 'Mobiliario', 'CILINDRO DORADO', 'SALÓN', 1::numeric),
  (24, 'Prebo', 'Mobiliario', 'CAVA ROJA', 'SALÓN', 1::numeric),
  (25, 'Prebo', 'Mobiliario', 'CORNETAS GRANDES', 'SALÓN', 2::numeric),
  (26, 'Prebo', 'Mobiliario', 'TORRE DE SONIDO', 'SALÓN', 1::numeric),
  (27, 'Prebo', 'Mobiliario', 'MAQUINA DE COTUFAS', 'SALÓN', 1::numeric),
  (28, 'Prebo', 'Mobiliario', 'SIFONES NUEVOS', 'SALÓN', 1::numeric),
  (29, 'Prebo', 'Mobiliario', 'PODIO NEGRO', 'SALÓN', 1::numeric),
  (30, 'Prebo', 'Mobiliario', 'STAND KROMI', 'SALÓN', 1::numeric),
  (31, 'Prebo', 'Mobiliario', 'MESA REDONDA GRANITO', 'SALÓN', 1::numeric),
  (32, 'Prebo', 'Mobiliario', 'MESA REDONDA PLASTICA', 'SALÓN', 1::numeric),
  (33, 'Prebo', 'Mobiliario', 'PODIOS GRISES ALTOS (FORMICA)', 'SALÓN', 2::numeric),
  (34, 'Prebo', 'Mobiliario', 'CUBO KROMI', 'SALÓN', 1::numeric),
  (35, 'Prebo', 'Mobiliario', 'ROLL UP LINEA PARRILLERA', 'SALÓN', 1::numeric),
  (36, 'Prebo', 'Mobiliario', 'ROLL UP KROMI KIDS', 'SALÓN', 2::numeric),
  (37, 'Prebo', 'Mobiliario', 'ROLL UP JORNADA', 'SALÓN', 1::numeric),
  (38, 'Prebo', 'Mobiliario', 'ROLL UP VIÑAMAR', 'SALÓN', 1::numeric),
  (39, 'Prebo', 'Mobiliario', 'AIR FRYER BREMEN BLANCO', 'SALÓN', 1::numeric),
  (40, 'Prebo', 'Mobiliario', 'AIR FRYER BREMEN NEGRO', 'SALÓN', 1::numeric),
  (41, 'Prebo', 'Mobiliario', 'AIR FRYER BREMEN NEGRO (DOBLE)', 'SALÓN', 1::numeric),
  (42, 'Prebo', 'Mobiliario', 'CESTA DE INSUMOS MÉDICOS', 'SALÓN', 1::numeric),
  (43, 'Prebo', 'Mobiliario', 'PENDON TIPO ARAÑA CON SU ESTRUCTURA', 'SALÓN', 1::numeric),
  (44, 'Prebo', 'Mobiliario', 'TOALLIN MAPLE', 'SALÓN', 1::numeric),
  (45, 'Prebo', 'Mobiliario', 'ARBOL DE NAVIDAD PEQUEÑO', 'SALÓN', 1::numeric),
  (46, 'Prebo', 'Mobiliario', 'BUZON DE ACRILICO', 'SALÓN', 1::numeric),
  (47, 'Prebo', 'Mobiliario', 'CESTAS MIMBRE', 'SALÓN', 8::numeric),
  (48, 'Prebo', 'Mobiliario', 'ACEITE MAZEITE', 'SALÓN', 10::numeric),
  (49, 'Prebo', 'Mobiliario', 'AGUAFIEL', 'SALÓN', 50::numeric),
  (50, 'Prebo', 'Mobiliario', 'ASPIRADORA', 'SALÓN', 1::numeric),
  (51, 'Prebo', 'Mobiliario', 'ALFOMBRA VERDE PEQUE', 'SALÓN', 1::numeric),
  (52, 'Prebo', 'Mobiliario', 'SILLAS PARIS NUEVAS', 'SALÓN', 34::numeric),
  (53, 'Prebo', 'Mobiliario', 'SILLAS PARIS VIEJAS', 'SALÓN', 12::numeric),
  (54, 'Prebo', 'Mobiliario', 'BOLSA CON GLOBOS E INFLADOR', 'SALÓN', 1::numeric),
  (55, 'Prebo', 'Mobiliario', '1 BOLSA CON: 4 GORRAS, 4 FRANELAS, 4 PAÑOLETAS', 'SALÓN', 1::numeric),
  (56, 'Prebo', 'Mobiliario', '1 BOLSA CON: 1 MAZEITE, COTUFAS, TAZAS, SAL, PAÑITOS', 'SALÓN', 1::numeric),
  (57, 'Prebo', 'Mobiliario', 'LIMPIA NEVERA MAYVEN', 'SALÓN', 2::numeric),
  (58, 'Prebo', 'Mobiliario', 'MANTELES NEGROS', 'SALÓN', 8::numeric),
  (59, 'Prebo', 'Mobiliario', 'MANTELES BEIGE', 'SALÓN', 5::numeric),
  (60, 'Prebo', 'Mobiliario', 'TOALLAS DESINFECTANTES VALE', 'SALÓN', 1::numeric),
  (61, 'Prebo', 'Mobiliario', 'TRIANGULAR PRODUCTOS EN LIQUIDACIÓN', 'SALÓN', 1::numeric),
  (62, 'Prebo', 'Mobiliario', 'VELAS BIPA', 'SALÓN', 10::numeric),
  (63, 'Prebo', 'Mobiliario', 'AMBIENTADOR VALE OCEANO', 'SALÓN', 1::numeric),
  (64, 'Prebo', 'Mobiliario', 'CAJA DE BOLSAS GLUP', 'SALÓN', 1::numeric),
  (65, 'Prebo', 'Mobiliario', 'PARAL DE LA CORNETA', 'SALÓN', 1::numeric),
  (66, 'Prebo', 'Mobiliario', 'LICUADORA PRIME HOME', 'CUARTICO', 2::numeric),
  (67, 'Prebo', 'Insumo', 'JUEGO DE OLLAS EPICURE', 'CUARTICO', 1::numeric),
  (68, 'Prebo', 'Insumo', 'CAJA C/HABLADORES PRECIO OPORTUNIDAD (PVC DELGADO)', 'CUARTICO', 1::numeric),
  (69, 'Prebo', 'Insumo', 'MICROONDAS', 'CUARTICO', 1::numeric),
  (70, 'Prebo', 'Insumo', 'HORNITOS PRIME HOME', 'CUARTICO', 2::numeric),
  (71, 'Prebo', 'Insumo', 'CAJA CON BOLSOS POLAR, CAVAS DE MANO SOLERA', 'CUARTICO', 1::numeric),
  (72, 'Prebo', 'Insumo', 'RESMA DE HABLADORES (2500)', 'CUARTICO', 9::numeric),
  (73, 'Prebo', 'Insumo', '1 CONTENEDOR GRIS S/TAPA CON TODOS LOS DELANTALES DENTRO', 'CUARTICO', 1::numeric),
  (74, 'Prebo', 'Insumo', 'PIRAMIDES PROXIMO CLIENTE', 'CUARTICO', 5::numeric),
  (75, 'Prebo', 'Insumo', 'CAJA DE VASOS CACIQUE', 'CUARTICO', 2::numeric),
  (76, 'Prebo', 'Insumo', 'CONTENEDOR #1 (TAPA VERDE): PLATOS ByN, TAPAS DE OLLA.', 'CUARTICO', 1::numeric),
  (77, 'Prebo', 'Insumo', 'CONTENEDOR #2 (TAPA NARANJA):11 OLLAS, SARTENES VINOTINTO, 1 BOWL', 'CUARTICO', 1::numeric),
  (78, 'Prebo', 'Insumo', 'CONTENEDOR #3 (TAPA NARANJA): BOWLS BLANCO, OLLAS, PAELLERA', 'CUARTICO', 1::numeric),
  (79, 'Prebo', 'Insumo', 'CONTENEDOR #4 (TAPA NARANJA): UTENSILIOS DE COCINA VARIOS', 'CUARTICO', 1::numeric),
  (80, 'Prebo', 'Insumo', 'CONTENEDOR #5 (TAPA VERDE): UTENSILIOS DE COCINA, LA GRAN MAYORÍA', 'CUARTICO', 1::numeric),
  (81, 'Prebo', 'Insumo', 'EXHIBIDOR FARMACIA', 'CUARTICO', 1::numeric),
  (82, 'Prebo', 'Insumo', 'HIELERAS ALUMINIO', 'CUARTICO', 3::numeric),
  (83, 'Prebo', 'Insumo', 'MOPERA AZUL KLE', 'CUARTICO', 1::numeric),
  (84, 'Prebo', 'Insumo', 'REFRACTARIA DE VIDRIO OVALADA (EN CONT #4)', 'CUARTICO', 2::numeric),
  (85, 'Prebo', 'Insumo', '1 BOLSA NEGRA CON TELAS Y 1 VASO DE LICUADORA', 'CUARTICO', 1::numeric),
  (86, 'Prebo', 'Insumo', 'CAJA CON 48 COPAS (APROX) DE VINO TINTO', 'CUARTICO', 1::numeric),
  (87, 'Prebo', 'Insumo', 'EXTRACTOR OSTER', 'CUARTICO', 1::numeric),
  (88, 'Prebo', 'Insumo', 'POPOTAMO AMARILLO', 'CUARTICO', 1::numeric),
  (89, 'Prebo', 'Insumo', 'RECIPIENTES CUADRADOS LAW', 'CUARTICO', 12::numeric),
  (90, 'Prebo', 'Insumo', 'COCINILLA VULCAN', 'CUARTICO', 1::numeric),
  (91, 'Prebo', 'Insumo', 'CAJA (ROTULADA CON PROMOCION) CON COPAS DE VINO TINTO', 'CUARTICO', 1::numeric),
  (92, 'Prebo', 'Insumo', '1 CONTENEDOR GRIS C/TAPA CON COPAS DE VINO TINTO (LOGO VIEJO)', 'CUARTICO', 1::numeric),
  (93, 'Prebo', 'Insumo', '1 CONTENEDOR TAPA NARANJA CON COPAS FLAUTA', 'CUARTICO', 1::numeric),
  (94, 'Prebo', 'Insumo', 'JARRA PLASTICA', 'CUARTICO', 1::numeric),
  (95, 'Prebo', 'Insumo', 'PESO ANALÓGICO', 'CUARTICO', 1::numeric),
  (96, 'Prebo', 'Insumo', 'DECANTADORES', 'CUARTICO', 4::numeric),
  (97, 'Prebo', 'Insumo', 'CAJA DE VASOS DE VIDRIO S/LOGO', 'CUARTICO', 1::numeric),
  (98, 'Prebo', 'Insumo', 'BATIDORA RANIA', 'CUARTICO', 2::numeric),
  (99, 'Prebo', 'Insumo', 'BATIDORA DE PEDESTAL KITCHEN AID', 'CUARTICO', 2::numeric),
  (100, 'Prebo', 'Insumo', 'BATIDORA DE MANO KITCHEN AID', 'CUARTICO', 6::numeric),
  (101, 'Prebo', 'Insumo', 'MICROFONO DOBLE INALÁMBRICO', 'CUARTICO', 1::numeric),
  (102, 'Prebo', 'Insumo', 'GRILL PARA COCINA', 'CUARTICO', 2::numeric),
  (103, 'Prebo', 'Insumo', 'PARRILLERA HOLSTEIN', 'CUARTICO', 1::numeric),
  (104, 'Prebo', 'Insumo', 'TABLAS KROMI DE MADERA', 'CUARTICO', 8::numeric),
  (105, 'Prebo', 'Insumo', 'BUBBLE MACHINE', 'CUARTICO', 2::numeric),
  (106, 'Prebo', 'Insumo', 'GALON DE JABON', 'CUARTICO', 1::numeric),
  (107, 'Prebo', 'Insumo', 'INFLADOR MANUAL', 'CUARTICO', 1::numeric),
  (108, 'Prebo', 'Insumo', 'PARRILLERAS PRIME HOME', 'CUARTICO', 2::numeric),
  (109, 'Prebo', 'Insumo', 'MICROONDAS HYUNDAI (DAÑADO)', 'CUARTICO', 1::numeric),
  (110, 'Prebo', 'Insumo', 'WOK', 'CUARTICO', 1::numeric),
  (111, 'Prebo', 'Insumo', 'BOLSO CON AVISOS PVC', 'CUARTICO', 1::numeric),
  (112, 'Prebo', 'Insumo', 'ABRELATAS ELÉCTRICO', 'CUARTICO', 1::numeric),
  (113, 'Prebo', 'Insumo', 'CAJA CON SIFON Y JARRA DE VIDRIO', 'CUARTICO', 1::numeric),
  (114, 'Prebo', 'Insumo', 'BOLSO PURINA CON PALITOS Y COPITAS', 'CUARTICO', 1::numeric),
  (115, 'Prebo', 'Insumo', 'COPAS DE HELADO', 'CUARTICO', 6::numeric),
  (116, 'Prebo', 'Insumo', 'BASE DE TV (EN CAJA AMARILLA)', 'CUARTICO', 1::numeric),
  (117, 'Prebo', 'Insumo', 'BOLSA CON ENVASES T/KRAFT', 'CUARTICO', 1::numeric),
  (118, 'Prebo', 'Insumo', 'BACKING PLEGABLE (NUEVO)', 'CUARTICO', 2::numeric),
  (119, 'Prebo', 'Insumo', 'TELAS DE BACKING PLEGABLE (NUEVO)', 'CUARTICO', 2::numeric),
  (120, 'Prebo', 'Insumo', 'TABLAS DE MADERA GRANDE', 'CUARTICO', 2::numeric),
  (121, 'Mañongo', 'Insumo', 'JARRA', 'MEZZANINA', 1::numeric),
  (122, 'Mañongo', 'Insumo', 'ENVASES PEQUEÑOS RECTANGULARES BLANCOS PARA SALSAS', 'MEZZANINA', 2::numeric),
  (123, 'Mañongo', 'Insumo', 'TABLAS DE PICAR', 'MEZZANINA', 3::numeric),
  (124, 'Mañongo', 'Insumo', 'ENVASES PLASTICOS TRANSPARANTES', 'MEZZANINA', 1::numeric),
  (125, 'Mañongo', 'Insumo', 'CAVA SMIRNOF', 'MEZZANINA', 2::numeric),
  (126, 'Mañongo', 'Insumo', 'CESTA DE MIMBRE', 'MEZZANINA', 1::numeric),
  (127, 'Mañongo', 'Insumo', 'CESTA DE MIMBRE', 'MEZZANINA', 1::numeric),
  (128, 'Mañongo', 'Insumo', 'CALABAZAS PLASTICAS', 'MEZZANINA', 6::numeric),
  (129, 'Mañongo', 'Insumo', 'PAR DE GANCHOS PARA BASE DE LOS TV', 'MEZZANINA', 1::numeric),
  (130, 'Mañongo', 'Insumo', 'GALON DE PEGA BLANCA', 'MEZZANINA', 1::numeric),
  (131, 'Mañongo', 'Insumo', 'ENVASES PARA DEGUSTACION', 'MEZZANINA', 64::numeric),
  (132, 'Mañongo', 'Insumo', 'TAPAS PARA ENVASES  DEGUSTACION', 'MEZZANINA', 62::numeric),
  (133, 'Mañongo', 'Insumo', 'ENVASES PARA DEGUSTACION CON TAPA PEQUEÑOS', 'MEZZANINA', 46::numeric),
  (134, 'Mañongo', 'Insumo', 'TENEDORES DESECHABLES', 'MEZZANINA', 27::numeric),
  (135, 'Mañongo', 'Insumo', 'CUCHARILLAS DESECHABLES GRANDES', 'MEZZANINA', 31::numeric),
  (136, 'Mañongo', 'Insumo', 'PLATO PEQUEÑO HONDO', 'MEZZANINA', 1::numeric),
  (137, 'Mañongo', 'Insumo', 'BANDEJA ROJA', 'MEZZANINA', 1::numeric),
  (138, 'Mañongo', 'Insumo', 'REGULADOR DE BOMBONA', 'MEZZANINA', 1::numeric),
  (139, 'Mañongo', 'Insumo', 'INDIVIDUALES DE BAMBOO', 'MEZZANINA', 5::numeric),
  (140, 'Mañongo', 'Insumo', 'COPAS DE GLOBO', 'MEZZANINA', 337::numeric),
  (141, 'Mañongo', 'Insumo', 'PITILLOS DE GLOBO', 'MEZZANINA', 246::numeric),
  (142, 'Mañongo', 'Insumo', 'PRIDE USADO', 'MEZZANINA', 1::numeric),
  (143, 'Mañongo', 'Insumo', 'BOLSA CON GLOBOS AZUL Y ROSA', 'MEZZANINA', 1::numeric),
  (144, 'Mañongo', 'Insumo', 'BOLSA CON GLOBOS DE EXHIBICION', 'MEZZANINA', 1::numeric),
  (145, 'Mañongo', 'Insumo', 'CONTENEDOR PLASTICO', 'MEZZANINA', 1::numeric),
  (146, 'Mañongo', 'Insumo', 'COCUY COROBORE', 'MEZZANINA', 1::numeric),
  (147, 'Mañongo', 'Insumo', 'GRANADINA', 'MEZZANINA', 1::numeric),
  (148, 'Mañongo', 'Insumo', 'BASE ACRILICAS DE CARTEL CON TORNILLO', 'MEZZANINA', 4::numeric),
  (149, 'Mañongo', 'Insumo', 'PAÑOS DE COCINA', 'MEZZANINA', 1::numeric),
  (150, 'Mañongo', 'Insumo', 'KG AZUCAR MONTALBAN', 'MEZZANINA', 1::numeric),
  (151, 'Mañongo', 'Insumo', 'ARROZ MARY 900G', 'MEZZANINA', 1::numeric),
  (152, 'Mañongo', 'Insumo', 'KETCHUP HEINZ', 'MEZZANINA', 6::numeric),
  (153, 'Mañongo', 'Insumo', 'LECHE CONDENSADA', 'MEZZANINA', 2::numeric),
  (154, 'Mañongo', 'Insumo', 'SAL', 'MEZZANINA', 2::numeric),
  (155, 'Mañongo', 'Insumo', 'PASTA CAPRI', 'MEZZANINA', 1::numeric),
  (156, 'Mañongo', 'Insumo', 'MIEL', 'MEZZANINA', 1::numeric),
  (157, 'Mañongo', 'Insumo', 'PAPRIKA', 'MEZZANINA', 1::numeric),
  (158, 'Mañongo', 'Insumo', 'GUAYABITA', 'MEZZANINA', 1::numeric),
  (159, 'Mañongo', 'Insumo', 'LATA DE MAIZ', 'MEZZANINA', 1::numeric),
  (160, 'Mañongo', 'Insumo', 'SALSA DE SOYA', 'MEZZANINA', 3::numeric),
  (161, 'Mañongo', 'Insumo', 'LATA DE ACEITUNAS NEGRAS', 'MEZZANINA', 1::numeric),
  (162, 'Mañongo', 'Insumo', 'PIMIENTA MOLIDA', 'MEZZANINA', 1::numeric),
  (163, 'Mañongo', 'Insumo', 'MANTEQUILLA', 'MEZZANINA', 1::numeric),
  (164, 'Mañongo', 'Insumo', 'ACEITUNAS NEGRAS EN RODAJAS', 'MEZZANINA', 1::numeric),
  (165, 'Mañongo', 'Insumo', 'MONTAZAS', 'MEZZANINA', 2::numeric),
  (166, 'Mañongo', 'Insumo', 'ACEITE DE OLIVA', 'MEZZANINA', 1::numeric),
  (167, 'Mañongo', 'Insumo', 'ALCAPARRA', 'MEZZANINA', 1::numeric),
  (168, 'Mañongo', 'Insumo', 'SALSA INGLESA', 'MEZZANINA', 2::numeric),
  (169, 'Mañongo', 'Insumo', 'HARINA TODO USO', 'MEZZANINA', 1::numeric),
  (170, 'Mañongo', 'Insumo', 'PAPELON', 'MEZZANINA', 4::numeric),
  (171, 'Mañongo', 'Insumo', 'CAJAS DE CUBITOS DE POLLO', 'MEZZANINA', 10::numeric),
  (172, 'Mañongo', 'Insumo', 'CAJAS DE CUBITOS DE VEGETALES', 'MEZZANINA', 10::numeric),
  (173, 'Mañongo', 'Insumo', 'COMINOS', 'MEZZANINA', 5::numeric),
  (174, 'Mañongo', 'Insumo', 'PIMIENTA NEGRA', 'MEZZANINA', 5::numeric),
  (175, 'Mañongo', 'Insumo', 'OREGANO', 'MEZZANINA', 5::numeric),
  (176, 'Mañongo', 'Insumo', 'ONOTO', 'MEZZANINA', 5::numeric),
  (177, 'Mañongo', 'Insumo', 'PAPEL HIGIENICO', 'MEZZANINA', 1::numeric),
  (178, 'Mañongo', 'Insumo', 'ENVASES MEDIDOR CAMPESTRE', 'MEZZANINA', 5::numeric),
  (179, 'Mañongo', 'Insumo', 'PAQUETES DE SERVILLETAS', 'MEZZANINA', 2::numeric),
  (180, 'Mañongo', 'Insumo', 'TORNILLOS ESTRUCTURA DEL ARBOL', 'MEZZANINA', 19::numeric),
  (181, 'Mañongo', 'Insumo', 'PAPEL DE ALUMINIO', 'MEZZANINA', 1::numeric),
  (182, 'Mañongo', 'Insumo', 'PAPEL ENCERADO', 'MEZZANINA', 25::numeric),
  (183, 'Mañongo', 'Insumo', 'TOALLIN', 'MEZZANINA', 1::numeric),
  (184, 'Mañongo', 'Insumo', 'PAQUETES DE CUCHARILLAS PLASTICAS', 'MEZZANINA', 7::numeric),
  (185, 'Mañongo', 'Mobiliario', 'ARCHIVERO CON BANDEJA 3 NIVELES DE COLORES', 'ALMACEN-RACK', 1::numeric),
  (186, 'Mañongo', 'Mobiliario', 'TOBOGAN', 'ALMACEN-RACK', 1::numeric),
  (187, 'Mañongo', 'Mobiliario', 'SILLAS PEQUEÑAS AZUL', 'ALMACEN-RACK', 22::numeric),
  (188, 'Mañongo', 'Mobiliario', 'SILLAS PEQUEÑAS BLANCAS', 'ALMACEN-RACK', 8::numeric),
  (189, 'Mañongo', 'Mobiliario', 'BANCOS PEQUEÑOS BLANCOS', 'ALMACEN-RACK', 2::numeric),
  (190, 'Mañongo', 'Mobiliario', 'BANCOS GRANDES', 'ALMACEN-RACK', 3::numeric),
  (191, 'Mañongo', 'Mobiliario', 'MESAS PEQUEÑAS PLASTICAS', 'ALMACEN-RACK', 4::numeric),
  (192, 'Mañongo', 'Mobiliario', 'BOMBONA', 'ALMACEN-RACK', 1::numeric),
  (193, 'Mañongo', 'Mobiliario', 'SILLAS GRANDES CON ESPALDAR', 'ALMACEN-RACK', 2::numeric),
  (194, 'Mañongo', 'Mobiliario', 'RETAZOS DE ALFOMBRA TIPO  GRAMA ARTIFICIAL', 'ALMACEN-RACK', 1::numeric),
  (195, 'Mañongo', 'Mobiliario', 'LOGOS DE PEPSI', 'ALMACEN-RACK', 2::numeric),
  (196, 'Mañongo', 'Mobiliario', 'PALMERAS', 'ALMACEN-RACK', 2::numeric),
  (197, 'Mañongo', 'Mobiliario', 'PORTA PENDONES', 'ALMACEN-RACK', 1::numeric),
  (198, 'Mañongo', 'Mobiliario', 'PALETAS CON MATERIAL POP GLUP', 'ALMACEN-RACK', 1::numeric),
  (199, 'Mañongo', 'Mobiliario', 'BASTIDOR PEQ.', 'ALMACEN-RACK', 1::numeric),
  (200, 'Mañongo', 'Mobiliario', 'LONA JORNADA DE SALUD', 'ALMACEN-RACK', 1::numeric),
  (201, 'Mañongo', 'Mobiliario', 'LONA PROMO SEMANA DEL MAR', 'ALMACEN-RACK', 1::numeric),
  (202, 'Mañongo', 'Mobiliario', 'BANDEROLAS SEMANA DEL MAR', 'ALMACEN-RACK', 2::numeric),
  (203, 'Mañongo', 'Mobiliario', 'CAJA DE BOLSOS ECOLOGICO GLUP', 'ALMACEN-RACK', 1::numeric),
  (204, 'Mañongo', 'Mobiliario', 'LONAS HORARIO DE NAVIDAD', 'ALMACEN-RACK', 1::numeric),
  (205, 'Mañongo', 'Mobiliario', 'SILLAS DE FESTEJO', 'ALMACEN-RACK', 5::numeric),
  (206, 'Mañongo', 'Mobiliario', 'ENVASES PLASTICO DEGUSTACION', 'ALMACEN-RACK', 146::numeric),
  (207, 'Mañongo', 'Mobiliario', 'TAPAS PLASTICAS', 'ALMACEN-RACK', 238::numeric),
  (208, 'Mañongo', 'Mobiliario', 'ALFOMBRAS VERDES GRANDES', 'ALMACEN-RACK', 2::numeric),
  (209, 'Mañongo', 'Mobiliario', 'TV SIRAGON CON BASE', 'ALMACEN-RACK', 1::numeric),
  (210, 'Mañongo', 'Mobiliario', 'MODULARES DE COCINA', 'ALMACEN-RACK', 3::numeric),
  (211, 'Mañongo', 'Mobiliario', 'PISCINA', 'ALMACEN-RACK', 1::numeric),
  (212, 'Mañongo', 'Mobiliario', 'SUPER COMBO', 'ALMACEN-RACK', 2::numeric),
  (213, 'Mañongo', 'Mobiliario', 'TRIANGULAR GRANDE DÍA DE LAS MADRES', 'ALMACEN-RACK', 1::numeric),
  (214, 'Mañongo', 'Mobiliario', 'CAJAS DE VELAS', 'ALMACEN-RACK', 3::numeric),
  (215, 'Mañongo', 'Mobiliario', 'ROLL UP', 'ALMACEN-RACK', 2::numeric),
  (216, 'Mañongo', 'Mobiliario', 'CAVA NARANJA/GRIS', 'ALMACEN-RACK', 2::numeric),
  (217, 'Mañongo', 'Mobiliario', 'PESAS PARA BANDELORAS', 'ALMACEN-RACK', 2::numeric),
  (218, 'Mañongo', 'Decoración', 'LUCES DE NAVIDAD', 'NAVIDAD', 39::numeric),
  (219, 'Mañongo', 'Decoración', 'REGLETAS', 'NAVIDAD', 4::numeric),
  (220, 'Mañongo', 'Decoración', 'ESTRELLA DORADA GRANDE', 'NAVIDAD', 17::numeric),
  (221, 'Mañongo', 'Decoración', 'ESTRELLAS VERDES TELA GRANDE', 'NAVIDAD', 16::numeric),
  (222, 'Mañongo', 'Decoración', 'ESTRELLAS VERDES TELA MEDIANA', 'NAVIDAD', 4::numeric),
  (223, 'Mañongo', 'Decoración', 'ESTRELLAS ESCARCHADAS PEQUEÑAS', 'NAVIDAD', 4::numeric),
  (224, 'Mañongo', 'Decoración', 'AVISOS MERRY CHRISTMAS', 'NAVIDAD', 1::numeric),
  (225, 'Mañongo', 'Decoración', 'RAMAS DE ARBOL (20 BOLSAS DE 5 Y 1 BOLSA DE 4)', 'NAVIDAD', 104::numeric),
  (226, 'Mañongo', 'Decoración', 'BANCO PARA SANTA', 'NAVIDAD', 1::numeric),
  (227, 'Mañongo', 'Decoración', 'BOLAS DORADAS GRANDE', 'NAVIDAD', 10::numeric),
  (228, 'Mañongo', 'Decoración', 'BOLAS ANIME VERDE GRANDE', 'NAVIDAD', 110::numeric),
  (229, 'Mañongo', 'Decoración', 'ESTRELLA DORADA', 'NAVIDAD', 1::numeric),
  (230, 'Mañongo', 'Decoración', 'RAMAS VERDES', 'NAVIDAD', 170::numeric),
  (231, 'Mañongo', 'Decoración', 'EXTENCIÓN LED VERDE', 'NAVIDAD', 1::numeric),
  (232, 'Mañongo', 'Decoración', 'EXTENCIÓN LED AMARILLA', 'NAVIDAD', 1::numeric),
  (233, 'Mañongo', 'Decoración', 'ESTRELLAS ANIME DORADA', 'NAVIDAD', 54::numeric),
  (234, 'Mañongo', 'Decoración', 'BOLAS DORADAS MEDIANA', 'NAVIDAD', 190::numeric),
  (235, 'Mañongo', 'Decoración', 'BOLAS DORADAS PEQUEÑAS', 'NAVIDAD', 150::numeric),
  (236, 'Mañongo', 'Decoración', 'BOLAS DORADAS RAPHIA', 'NAVIDAD', 38::numeric),
  (237, 'Mañongo', 'Decoración', 'COPOS DORADOS TELA', 'NAVIDAD', 10::numeric),
  (238, 'Mañongo', 'Decoración', 'BAMBALINAS FELPUDAS', 'NAVIDAD', 4::numeric),
  (239, 'Mañongo', 'Decoración', 'COPOS NIEVE VERDES GRANDE', 'NAVIDAD', 3::numeric),
  (240, 'Mañongo', 'Decoración', 'LAZOS GRANDE DORADOS', 'NAVIDAD', 7::numeric),
  (241, 'Mañongo', 'Decoración', 'ESTRELLAS GRANDES DORADAS', 'NAVIDAD', 17::numeric),
  (242, 'Mañongo', 'Decoración', 'PELUCHE CON GUIRNALDAS', 'NAVIDAD', 13::numeric),
  (243, 'Mañongo', 'Decoración', 'FLORES', 'NAVIDAD', 68::numeric),
  (244, 'Mañongo', 'Decoración', 'RAMAS VERDES', 'NAVIDAD', 35::numeric),
  (245, 'Mañongo', 'Decoración', 'ESTRELLA CARTON AMARILLO', 'NAVIDAD', 8::numeric),
  (246, 'Mañongo', 'Decoración', 'CASCANUECES GRANDES', 'NAVIDAD', 2::numeric),
  (247, 'Mañongo', 'Decoración', 'CASCANUECES PEQUEÑOS', 'NAVIDAD', 7::numeric),
  (248, 'Mañongo', 'Decoración', 'CORONAS DE CEREZA', 'NAVIDAD', 6::numeric),
  (249, 'Mañongo', 'Decoración', 'PORRONES NAVIDEÑOS', 'NAVIDAD', 3::numeric),
  (250, 'Mañongo', 'Decoración', 'RAMAS DE ARBOL (20 BOLSAS DE 5 Y 1 BOLSA DE 4)', 'NAVIDAD', 104::numeric),
  (251, 'Mañongo', 'Decoración', 'INFLABLE SANTA', 'NAVIDAD', 1::numeric),
  (252, 'Mañongo', 'Decoración', 'BAMBALINAS GRANDES', 'NAVIDAD SAN DIEGO', 7::numeric),
  (253, 'Mañongo', 'Decoración', 'BAMBALINAS PEQUEÑAS', 'NAVIDAD SAN DIEGO', 30::numeric),
  (254, 'Mañongo', 'Decoración', 'CORONA CON PELUCHE', 'NAVIDAD SAN DIEGO', 3::numeric),
  (255, 'Mañongo', 'Decoración', 'CASCANUES PEQUEÑO', 'NAVIDAD SAN DIEGO', 1::numeric),
  (256, 'Mañongo', 'Decoración', 'ARBOLITO ALTO PEQUEÑO ROJO', 'NAVIDAD SAN DIEGO', 1::numeric);

-- Validación defensiva de cantidades; la fila 227 ya tiene el valor provisional aprobado de 10.
do $$
declare v_bad integer;
begin
  select source_row into v_bad
  from inventory_import_source
  where cantidad is null or cantidad < 0
  order by source_row
  limit 1;
  if v_bad is not null then
    raise exception 'Cantidad nula o negativa en fila Excel %. Corrige el staging antes de importar.', v_bad;
  end if;
end;
$$;

-- Revisión de catálogos y datos antes de escribir.
do $$
declare v_missing text;
begin
  select string_agg(distinct s.sede_nombre, ', ') into v_missing
  from inventory_import_source s
  left join public.inventario_sedes d on lower(trim(d.nombre)) = lower(trim(s.sede_nombre)) and d.activa
  where d.id is null;
  if v_missing is not null then
    raise exception 'Sedes inexistentes/inactivas: %', v_missing;
  end if;

  select string_agg(distinct s.categoria_nombre, ', ') into v_missing
  from inventory_import_source s
  left join public.inventario_categorias c on lower(trim(c.nombre)) = lower(trim(s.categoria_nombre)) and c.activa
  where c.id is null;
  if v_missing is not null then
    raise exception 'Categorías inexistentes/inactivas: %', v_missing;
  end if;

  if exists (select 1 from inventory_import_source where length(trim(articulo_nombre)) not between 1 and 160) then
    raise exception 'Hay nombres de artículo vacíos o demasiado largos.';
  end if;
end;
$$;

-- Crear ubicaciones inexistentes. La llave lógica es sede + nombre normalizado.
insert into public.inventario_ubicaciones (sede_id, nombre, activa)
select distinct s.id, src.ubicacion_nombre, true
from inventory_import_source src
join public.inventario_sedes s on lower(trim(s.nombre)) = lower(trim(src.sede_nombre))
where not exists (
  select 1 from public.inventario_ubicaciones u
  where u.sede_id = s.id and lower(trim(u.nombre)) = lower(trim(src.ubicacion_nombre))
);

-- Resolver duplicados con una clave natural temporal:
-- categoría + ubicación + nombre normalizado + especificaciones nulas.
create temp table inventory_import_items on commit drop as
select
  row_number() over (
    order by s.codigo, u.nombre, c.nombre, lower(trim(src.articulo_nombre))
  )::integer as import_id,
  min(src.source_row) as first_source_row,
  array_agg(src.source_row order by src.source_row) as source_rows,
  s.id as sede_id,
  u.id as ubicacion_id,
  c.id as categoria_id,
  min(trim(src.articulo_nombre)) as nombre,
  sum(src.cantidad)::numeric(12,2) as cantidad
from inventory_import_source src
join public.inventario_sedes s on lower(trim(s.nombre)) = lower(trim(src.sede_nombre))
join public.inventario_categorias c on lower(trim(c.nombre)) = lower(trim(src.categoria_nombre))
join public.inventario_ubicaciones u
  on u.sede_id = s.id and lower(trim(u.nombre)) = lower(trim(src.ubicacion_nombre))
group by s.id, u.id, c.id, lower(trim(src.articulo_nombre));

-- Si la clave natural ya existe, abortar en vez de duplicar o sumar a saldo vigente.
do $$
declare v_duplicates integer;
begin
  select count(*) into v_duplicates
  from inventory_import_items i
  join public.inventario_articulos a
    on a.tipo_control = 'LOTE'
   and a.ubicacion_id = i.ubicacion_id
   and a.categoria_id = i.categoria_id
   and lower(trim(a.nombre)) = lower(trim(i.nombre))
   and coalesce(trim(a.especificaciones), '') = '';
  if v_duplicates > 0 then
    raise exception '% artículos ya existen en ubicaciones de destino. Revisa antes de importar.', v_duplicates;
  end if;
end;
$$;

-- Captura el usuario SQL que ejecuta la carga cuando aplica; puede quedar NULL
-- en Editor SQL si no existe un usuario auth asociado, lo que permite el FK.
insert into public.inventario_articulos (
  categoria_id, nombre, especificaciones, atributos, tipo_control, codigo, cantidad,
  unidad_medida, sede_id, ubicacion_id, condicion, creado_por, modificado_por
)
select categoria_id, nombre, null,
       case
         when 227 = any(source_rows) then
           jsonb_build_object(
             'cantidad_provisional', true,
             'nota_importacion', 'Cantidad 10 asignada provisionalmente; validar con el equipo de Eventos.'
           )
         else '{}'::jsonb
       end,
       'LOTE', null, cantidad, 'unidades', sede_id, ubicacion_id,
       'DISPONIBLE', null, null
from inventory_import_items
order by import_id;

-- Vincular movimiento inicial con su artículo por la clave natural creada arriba.
insert into public.inventario_movimientos (
  articulo_id, tipo, cantidad, destino_sede_id, destino_ubicacion_id,
  registrado_por, observacion, saldo_resultante
)
select a.id, 'CONTEO_INICIAL', i.cantidad, i.sede_id, i.ubicacion_id,
       null,
       'Importación Excel CONTROL DE INVENTARIO MERCADEO; filas '
         || array_to_string(i.source_rows, ',')
         || case when 227 = any(i.source_rows)
              then '. CANTIDAD PROVISIONAL: 10; validar con el equipo de Eventos.'
              else ''
            end,
       i.cantidad
from inventory_import_items i
join public.inventario_articulos a
  on a.categoria_id = i.categoria_id
 and a.ubicacion_id = i.ubicacion_id
 and a.tipo_control = 'LOTE'
 and lower(trim(a.nombre)) = lower(trim(i.nombre))
 and coalesce(trim(a.especificaciones), '') = ''
 and a.creado_por is null
 and a.creado_en >= transaction_timestamp();

insert into public.inventory_import_batches
  (batch_key, source_name, imported_rows, source_rows)
select 'control-inventario-mercadeo-2026-10',
       'CONTROL DE INVENTARIO MERCADEO.xlsx',
       (select count(*) from inventory_import_items),
       (select count(*) from inventory_import_source);

-- Informe previo al commit: debe revisarse en resultados del Editor SQL.
select
  i.first_source_row,
  i.source_rows,
  s.nombre as sede,
  u.nombre as ubicacion,
  c.nombre as categoria,
  i.nombre as articulo,
  i.cantidad
from inventory_import_items i
join public.inventario_sedes s on s.id = i.sede_id
join public.inventario_ubicaciones u on u.id = i.ubicacion_id
join public.inventario_categorias c on c.id = i.categoria_id
order by s.orden, u.nombre, c.nombre, i.nombre;

-- Se recomienda ejecutar primero en una copia/restauración de prueba.
-- El resultado esperado es 250 artículos de lote
-- (253 filas del Excel consolidadas por 3 grupos de duplicados) más 250 conteos iniciales.
commit;
