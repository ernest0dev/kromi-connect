# Plan de mapeo e importación histórica de solicitudes de Diseño

**Estado (2026-10-26):** lector, simulador sin escritura e importador CLI implementados localmente; la simulación del archivo privado se ejecutó sin escritura en esta sesión. El usuario reporta ambas migraciones aplicadas en Supabase; esta sesión no lo verificó ni ejecutó la importación real. La fuente permanece fuera del repositorio; para importar, el operador debe indicar una copia privada. Las decisiones están en [`plan-solicitudes-diseno.md` §13](./plan-solicitudes-diseno.md#13-registro-de-decisiones). Modelo destino: [`plan-datos-solicitudes-diseno.md`](./plan-datos-solicitudes-diseno.md).

## 1. Fuente

| Aspecto | Dato | Etiqueta |
|---|---|---|
| Archivo | Excel original proporcionado por el usuario; se mantiene fuera del repositorio | `[ARCHIVO]` |
| Hojas | `Solicitudes de diseño` (hoja fuente) y `Hoja 1` (sin datos) | `[ARCHIVO]` |
| Filas | 268 filas de datos no vacías; 267 tienen tanto marca temporal como título y una fila no tiene ninguno de esos campos. Hay filas vacías con formato hasta la fila física 369; no cuentan como registros. | `[ARCHIVO]` |
| Encabezados | 22 exactos, incluido `Responsble` (se conserva como clave de lectura) | `[ARCHIVO]` |
| Fechas | 267 marcas temporales, 267 fechas de entrega y 212 fechas de término; celdas numéricas con formato de fecha/hora y sistema de fechas 1900 de Excel (`date1904=false`). | `[ARCHIVO]` |
| Almacenamiento | El archivo contiene datos personales y fue retirado del repositorio y de la rama local. Para repetir la simulación o importar, el operador debe indicar una copia privada fuera del repositorio. Los informes generales no reproducen correos ni nombres. | `[ARCHIVO]` / `[PROPUESTA]` |

**Conteos agregados verificados** (incluyen la fila no identificable cuando corresponda):

- `Estatus`: 268 celdas; 216 «Terminado», 28 «Cancelado», 10 «Por aprobar», 7 «Sin empezar», 2 «No a tiempo», 2 «Solicitud Incompleta», 2 «Atrasado» y 1 «En curso».
- `Prioridad`: 267 celdas: 243 «Normal», 20 «Importante» y 4 «Urgente».
- `Departamento`: 267 celdas y ocho valores distintos. `Área`: 183 celdas y cuatro valores distintos; no se infiere el área faltante.
- «¿A que medio pertenece?»: 267 celdas; Digital 240, Impreso 20 y Digital e impreso 7.
- «¿Qué se publica?»: 247 celdas y 45 respuestas distintas; al separar por coma y recortar espacios: 493 tokens y 22 valores distintos. «¿Qué se imprime?»: 20 respuestas/tokens y 8 valores distintos. Cada columna con sufijo `2` tiene 4 celdas con valor (4 tokens en publicación adicional y 4 en impresión adicional). «¿Cuántos diseños se necesita?» está vacía; «¿Cuántas piezas?» tiene 250 celdas y 24 expresiones distintas, muchas en texto libre.

Verificaciones restantes antes de fijar el mapeo definitivo (F3):

- `Marca temporal` se interpreta en `America/Caracas`, según confirmación del usuario (D-15); probar la conversión serial Excel 1900 → hora local → `timestamptz` en F3.
- La separación por coma produce los conteos anteriores; revisar en el informe de simulación las excepciones y aprobar el catálogo exacto de tokens antes de importar.
- Las columnas con sufijo `2` son campos adicionales según el usuario: procesarlas por separado, sin reemplazar ni fusionar automáticamente con las principales. «¿Cuántos diseños se necesita?» está verificada vacía en este archivo.
- «Dirección de correo electrónico» corresponde a quien envió el formulario, no necesariamente a `Responsble`; no se usa para vincular la identidad del solicitante (D-14).

## 2. Inventario de columnas

Las 22 columnas originales, en orden: `Marca temporal`, `Fecha de entrega`, `Nombre de arte/flyer`, `¿Qué se quiere lograr con esta pieza?`, `¿Qué se publica?`, `Diseñador`, `Responsble`, `Prioridad`, `Estatus`, `Fecha de termino`, `Departamento`, `Imagen referencial`, `¿Qué se imprime?`, `Área`, `¿Cuántos diseños se necesita?`, `¿A que medio pertenece?`, `Dirección de correo electrónico`, `¿Cuántas piezas?`, `¿Qué se publica? 2`, `¿Qué se imprime? 2`, `En qué material`, `Definir las medidas`.

La lectura se hace **por nombre de encabezado**, no por posición, y falla de forma explícita si falta o sobra una columna (validación de estructura, §13).

## 3. Mapeo columna original → campo destino

Todas las columnas se copian íntegras a `solicitud_diseno_importacion_filas.datos_originales` antes de cualquier transformación. La columna «Tratamiento del valor original» indica qué más se conserva.

| Columna original | Campo destino | Transformación | Validación | Incertidumbre | Tratamiento del valor original |
|---|---|---|---|---|---|
| Marca temporal | `solicitudes_diseno.solicitada_en_original` | Convertir el serial Excel con sistema 1900 e interpretarlo en `America/Caracas` (§5); preservar además el serial original en `datos_originales`. | Si falta junto con el título, se excluye; serial inválido → `NULL` + advertencia. | Probar conversión serial a instante en F3 | Siempre en `datos_originales` |
| Fecha de entrega | `solicitudes_diseno.fecha_objetivo` | Solo fecha (sin zona) | Fecha válida; si no, `NULL` + advertencia | Tipo de celda | `fecha_objetivo_original` (texto) |
| Nombre de arte/flyer | `solicitudes_diseno.titulo` | `trim`, colapsar espacios; sin cambiar mayúsculas | No vacío tras `trim` | Títulos genéricos o repetidos | `datos_originales` |
| ¿Qué se quiere lograr con esta pieza? | `solicitudes_diseno.objetivo` | `trim` | Ninguna (texto libre) | Puede incluir instrucciones y no solo objetivo | Texto íntegro; no se trunca |
| ¿Qué se publica? | `…_entregables` (categoría `DIGITAL`): `formato_original`, `formato_id` si hay equivalencia exacta y `campo_origen = 'PUBLICACION_PRINCIPAL'` | Separar por comas y recortar espacios; procesar como grupo propio (§8) | Cada token se compara por alias exacto | Revisar excepciones y aprobar vocabulario en F3 | `datos_originales`; `alcance_texto` |
| Diseñador | `solicitudes_diseno.ejecutor_historico_nombre` y, si es verificable, `ejecutor_historico_usuario_id` | `trim`; resolución de identidad (§7) | — | Nombres sin cuenta | `datos_originales`; no crea `responsable_actual_id` (D-16) |
| Responsble | `solicitudes_diseno.solicitante_nombre_original` y, si es verificable, `solicitante_usuario_id` | `trim`; resolución de identidad (§7) | — | Muchos solicitantes sin cuenta | Nombre original inmutable `[CONFIRMADA]` |
| Prioridad | `solicitudes_diseno.prioridad` | Coincidencia exacta normalizada (§6.1) | Solo `URGENTE`/`IMPORTANTE`/`NORMAL`; otro valor → `NULL` + advertencia | Variantes de escritura | `prioridad_original` |
| Estatus | `solicitudes_diseno.estado_historico_original` | Ninguna; `estado` = `HISTORICA` siempre | — | Estados fuera del vocabulario observado | Texto íntegro; **no se traduce** `[CONFIRMADA]` |
| Fecha de termino | `solicitudes_diseno.fecha_termino_historica` | Solo fecha | Fecha válida; si no, `NULL` + advertencia | Significado operativo sin confirmar | `fecha_termino_original`; solo antecedente `[CONFIRMADA]` |
| Departamento | `solicitudes_diseno.departamento_id` | Alias exacto normalizado (§6.3) | Sin equivalencia → `NULL` + advertencia y revisión manual | Catálogo propio sembrado con los ocho valores observados; alias por confirmar durante F3 | `departamento_original` |
| Imagen referencial | `solicitudes_diseno.referencias_urls` | Extraer URLs `http(s)` con expresión estricta | Esquema `http` o `https`; nunca se visita | Enlaces privados, rotos o ajenos | `referencias_originales` íntegro; sin descargar ni exponer |
| ¿Qué se imprime? | `…_entregables` (categoría `IMPRESO`): `formato_original`, `formato_id` si hay equivalencia exacta y `campo_origen = 'IMPRESION_PRINCIPAL'` | Separar por comas y recortar espacios; procesar como grupo propio | Cada token se compara por alias exacto | Revisar excepciones y aprobar vocabulario en F3 | `datos_originales`; `alcance_texto` |
| Área | `solicitudes_diseno.area_id` | Alias exacto normalizado (§6.4) | Vacía → `NULL` (no se infiere) | 32 % sin valor | `area_original` |
| ¿Cuántos diseños se necesita? | Ninguno en v1 | Ninguna | Advertencia `COLUMNA_ESPERADA_VACIA` si trae valor | Vacía en el análisis previo; significado desconocido | Solo en `datos_originales` |
| ¿A que medio pertenece? | `…_entregables.medio_id` y `medio_original` | Alias exacto (§6.5) | Sin equivalencia → `NULL` | «Digital e impreso» | `datos_originales` |
| Dirección de correo electrónico | Ningún campo de identidad de solicitud | Se conserva sin cambio solo en `datos_originales`; no se compara para vincular al solicitante porque representa al remitente del formulario | — | El remitente puede no ser `Responsble` | Solo en `datos_originales`, visible a todos los usuarios autenticados por decisión expresa (D-14); no se copia a la solicitud |
| ¿Cuántas piezas? | `…_entregables.cantidad_piezas`, `…_entregables.cantidad_formatos` (ver §8) y `alcance_texto` | Extracción conservadora (§8) | Entero > 0; si no, `NULL` | Texto libre | `alcance_texto` y `datos_originales`; si no hay entregable, `solicitudes_diseno.alcance_original` |
| ¿Qué se publica? 2 | Formatos digitales adicionales en entregables separados | Separar por comas y recortar espacios; generar entregables distintos de los de «¿Qué se publica?» y guardar `campo_origen = 'PUBLICACION_ADICIONAL'` | Alias exacto; desconocidos se conservan y marcan revisión manual | Campo adicional confirmado; aprobar catálogo en F3 | `datos_originales` y `formato_original` |
| ¿Qué se imprime? 2 | Formatos impresos adicionales en entregables separados | Separar por comas y recortar espacios; generar entregables distintos de los de «¿Qué se imprime?» y guardar `campo_origen = 'IMPRESION_ADICIONAL'` | Alias exacto; desconocidos se conservan y marcan revisión manual | Campo adicional confirmado; aprobar catálogo en F3 | `datos_originales` y `formato_original` |
| En qué material | `…_entregables.material` | `trim`; se asigna solo a entregables `IMPRESO` | — | Aplica solo a impresos | Si no hay entregable `IMPRESO`, queda en `datos_originales` |
| Definir las medidas | `…_entregables.medidas` | `trim`; igual que material | — | Igual | Igual |

El diccionario de los campos destino está en [`plan-datos-solicitudes-diseno.md` §3](./plan-datos-solicitudes-diseno.md#3-diccionario-de-datos).

## 4. Transformaciones permitidas y valores que solo se conservan como texto

**Permitidas:** `trim`; colapsar espacios; normalizar para comparar (minúsculas, sin tildes) **solo para buscar equivalencias**, nunca para reescribir el valor guardado; interpretar fechas; extraer enteros inequívocos; tokenizar listas con separadores confirmados; extraer URLs.

**Prohibidas:** traducir estados históricos; completar áreas, departamentos o tipos por inferencia; coincidencia difusa de personas o catálogos; crear fechas de solicitud a Diseño, inicio, entrega real o cierre; corregir ortografía; fusionar filas.

**Solo texto original (sin normalizar):** objetivo; `Imagen referencial`; «¿Cuántos diseños se necesita?»; correo; material y medidas cuando no hay entregable; cualquier valor sin equivalencia. Las columnas con sufijo `2` se procesan como grupos de formatos separados, aunque coincidan con las principales; nunca se fusionan automáticamente.

## 5. Tratamiento de fechas

| Campo | Tipo destino | Zona horaria | Regla |
|---|---|---|---|
| Marca temporal | `timestamptz` | `America/Caracas` (UTC−04, sin horario de verano), confirmada por el usuario (D-15). | Celdas numéricas con estilos de fecha/hora; sistema 1900 verificado (`date1904=false`). Convertir el serial a fecha/hora local y luego a `timestamptz`, conservando el valor fuente en `datos_originales`. |
| Fecha de entrega | `date` | Sin zona: la fecha tal como aparece | Si la celda es fecha-hora, se toma la fecha de calendario sin convertir de zona. |
| Fecha de termino | `date` | Igual | Solo antecedente. |

Valores inválidos o incompletos: la columna normalizada queda `NULL`, el texto original se guarda en `*_original`, la fila recibe advertencia (`FECHA_INVALIDA`) y, si afecta a la identidad mínima, se clasifica según §9. Inconsistencias (fecha de entrega anterior a la marca temporal; fecha de término anterior a la solicitud; término con estado distinto de «Terminado» y viceversa) generan **advertencia sin corrección**.

**No se calculan ni se crean:** `fecha_solicitud_diseno`, `fecha_entrega_diseno_estimada`, `fecha_entrega_diseno_real`, `fecha_limite_brief`, fechas de inicio ni de cierre operativo. La importación no ejecuta `calcularMatrizSLA` ni `recalculateSlaDates`, que pertenecen al ciclo de publicaciones, ni activa ningún SLA como si las solicitudes acabaran de crearse `[CONFIRMADA]`.

## 6. Prioridades, estados, departamentos, áreas y medios

Regla común: alias exacto tras normalizar. Sin equivalencia: columna normalizada `NULL`, original intacto, advertencia `SIN_EQUIVALENCIA:<columna>`, y el valor se acumula en el informe de «valores sin equivalencia» para decidir si se amplía el catálogo.

### 6.1 Prioridad
`Urgente` → `URGENTE`; `Importante` → `IMPORTANTE`; `Normal` → `NORMAL`; vacío → `NULL`. No se asigna `NORMAL` por defecto a los vacíos. No se usa la escala de `publicaciones.prioridad` (1 Alta / 2 Normal / 3 Baja) `[REPO]` (D-05).

### 6.2 Estado histórico
Valores observados en 268 celdas: Terminado (216), Cancelado (28), Por aprobar (10), Sin empezar (7), No a tiempo (2), Solicitud Incompleta (2), Atrasado (2), En curso (1). **Ninguno se traduce.** Todo `estado` importado es `HISTORICA` y todo entregable importado es `HISTORICO` (D-13). Los valores distintos se listan en el informe para referencia.

### 6.3 Departamentos
Observados en 267 celdas: Mercadeo (180), Compras (44), Farmacia (27), Selección (8), Capital Humano (5), Ventas Online (1), Operaciones Perecederos (1), Seguridad Laboral (1). `departamento_enum` solo contiene `COMPRAS`, `SELECCION`, `PROVEEDOR`, `GERENCIA`, `EVENTOS` `[REPO]`; se usa el catálogo propio aprobado (D-03), sembrado con esos ocho valores. Los alias se validan por coincidencia exacta; los desconocidos quedan para revisión manual, sin inferir equivalencias.

### 6.4 Áreas
Observadas en 183 celdas: Digital (129), Eventos (24), Interno (19), Gerencia (11). El área queda vacía en las demás filas; «Digital» identifica el perfil de Social Media pero **no** implica publicación `[CONFIRMADA]`; no genera vínculo ni conversión. Vacío → `NULL`.

### 6.5 Medios
Observados en 267 celdas: Digital (240), Impreso (20), «Digital e impreso» (7). «Digital e impreso» no es un valor de entregable único: ver §8.

## 7. Reglas de resolución de identidades

Aplican a `Responsble` (solicitante) y a `Diseñador` (ejecutor histórico). Fuente de comparación: `profiles.full_name` `[REPO]`. El correo de la hoja es del remitente y no se usa para resolver la identidad del solicitante.

| Regla | Descripción |
|---|---|
| I1 | Coincidencia exacta del nombre normalizado con **un único** `profiles.full_name` → candidato verificable. |
| I2 | Si el nombre coincide con más de un perfil → **sin resolver**; la fila se marca `IDENTIDAD_AMBIGUA`. |
| I3 | Sin coincidencia → sin resolver; se conserva el nombre original y la solicitud es válida `[CONFIRMADA]`. |
| I4 | Nunca coincidencia difusa ni por similitud. |
| I5 | El correo se conserva en `datos_originales`, visible a todos los usuarios autenticados por D-14; no se usa para asignar `solicitante_usuario_id` ni `ejecutor_historico_usuario_id`. |
| I6 | La resolución por nombre se registra en `advertencias` de la fila (regla aplicada, usuario candidato) para poder auditarla. |

Se espera que muchos solicitantes (personal de otras áreas) no tengan cuenta; no es un error. Para el ejecutor, solo `Diseñador` con coincidencia verificable contra un perfil de rol `design` se vincula. La simulación puede resolver identidades contra una exportación local de perfiles para no consultar el remoto. El correo del remitente no se emplea como atajo para asignar la identidad del solicitante.

## 8. Interpretación de cantidades y entregables

Principios `[CONFIRMADA]`: cada combinación de pieza y formato puede ser un entregable; varios formatos equivalentes de una misma pieza pueden agruparse solo si es inequívoco; la cantidad es numérica solo si es confiable; el alcance textual se conserva siempre; no se inventan entregables ante ambigüedad; se distinguen cantidad de piezas, cantidad de formatos y texto de alcance.

Reglas `[PROPUESTA]`:

| Regla | Descripción |
|---|---|
| E1 | Fuentes de formato: cada encabezado se procesa como grupo independiente: «¿Qué se publica?» (`DIGITAL`), «¿Qué se publica? 2» (`DIGITAL` adicional), «¿Qué se imprime?» (`IMPRESO`) y «¿Qué se imprime? 2» (`IMPRESO` adicional). Se guarda el `campo_origen` correspondiente en cada entregable. |
| E2 | Un token es **inequívoco** si coincide exactamente con el alias de un formato del catálogo. Un token sin coincidencia es ambiguo. |
| E3 | `cantidad_piezas`: se extrae un entero solo de patrones exactos (`N diseño(s)`, `N pieza(s)`, número solitario, «un»/«una» = 1). «Varios», «diferentes», rangos o frases abiertas → `NULL`. |
| E4 | `cantidad_formatos`: número de tokens inequívocos agrupados dentro del mismo campo de origen; `NULL` si hay algún token ambiguo. |
| E5 | «1 diseño para diferentes formatos…» → un entregable agrupado dentro del mismo campo de origen, `cantidad_piezas = 1`, `cantidad_formatos` según E4. Nunca agrupar formatos provenientes de campos distintos. |
| E6 | «1 diseño para varias fotos o videos…» → un entregable, `cantidad_piezas = 1`, `cantidad_formatos = NULL`. |
| E7 | «1 diseño para un formato» → un entregable, `cantidad_piezas = 1`, `cantidad_formatos = 1`. |
| E8 | «Digital e impreso» → un entregable `DIGITAL` y uno `IMPRESO` solo si hay tokens inequívocos en ambas familias; si no, no se crean y se marca la fila. |
| E9 | Si no hay tokens inequívocos ni cantidad confiable → **cero entregables**; `requiere_revision = true`, motivo `ENTREGABLES_NO_RESUELTOS`; el texto va a `solicitudes_diseno.alcance_original`. |
| E10 | Las columnas principales y las `2` siempre se conservan y procesan por separado, coincidan o no; no se sobrescriben ni fusionan. Los valores no reconocidos se conservan y marcan revisión manual. |
| E11 | Cada entregable importado nace `HISTORICO`; `alcance_texto` guarda el texto de «¿Cuántas piezas?». |

La inspección de solo lectura confirmó la separación por comas y los conteos del §1. Los casos límite de tokenización, alias exactos y frecuencia de cada patrón de cantidad deben revisarse en el informe de simulación F3 antes de congelar E1–E11.

## 9. Clasificación de filas y resultados

Cada fila termina en exactamente un resultado (adaptable al diseño técnico):

| Resultado | Condición | Crea solicitud |
|---|---|---|
| `EXCLUIDA_VACIA` | Todas las celdas vacías o con solo espacios | No |
| `EXCLUIDA_SIN_IDENTIDAD_MINIMA` | Sin marca temporal **y** sin título `[CONFIRMADA]` (incluye la fila huérfana de «Terminado») | No; se conserva en el registro |
| `PENDIENTE_REVISION` | Tiene título pero no marca temporal, o al revés (propuesta); o datos contradictorios que impiden normalizar con seguridad | No hasta decisión manual |
| `OMITIDA_YA_IMPORTADA` | Su `huella` coincide con una fila importada que no haya sido revertida en un lote completado (§11) | No |
| `RECHAZADA_VALIDACION` | Incumple una restricción dura del destino tras normalizar | No |
| `IMPORTADA_PARCIAL` | Título y marca temporal presentes; algún campo sin normalizar o con advertencia, pero el original está preservado | Sí |
| `IMPORTADA` | Título y marca temporal presentes y todos los campos normalizados sin advertencias | Sí |

Los posibles duplicados **no** cambian el resultado: la fila se importa con `requiere_revision = true`, motivo `POSIBLE_DUPLICADO` y referencia a los candidatos en `advertencias`.

`REVERTIDA` no es un resultado de clasificación de entrada: es un estado terminal que se asigna solo a las filas que crearon solicitudes retiradas mediante la reversión atómica de D-20. Se conserva el valor previo en `resultado_previo_reversion`; los resultados de filas excluidas, pendientes u omitidas no cambian.

## 10. Detección de duplicados

Señales `[PROPUESTA]` (los umbrales son parámetros por aprobar):

1. Mismo título normalizado y mismo solicitante normalizado dentro de una ventana de pocos días (valor inicial a aprobar).
2. Misma marca temporal exacta y mismo título (doble envío del formulario).
3. Misma `huella` en otra fila del mismo lote.

El título no es clave de identidad ni se usa para fusionar. Todo candidato queda marcado para revisión manual y las filas se conservan.

## 11. Idempotencia

| Mecanismo | Descripción |
|---|---|
| Clave de lote | `archivo_sha256` + nombre de hoja + número de intento. El mismo archivo y hoja reanudan o muestran el lote existente; un lote revertido es terminal y solo se repite mediante un nuevo intento explícito. |
| Clave de origen | `unique (lote_id, hoja, fila_origen)`; reintentar el mismo lote inserta con `on conflict do nothing` y reanuda lo pendiente. |
| `huella` | `sha256` de una serialización canónica de las **22 celdas** de la fila, identificadas por encabezado. Se conservan los valores fuente; solo se canonicaliza su representación técnica (por ejemplo, fechas verificadas a ISO y celdas vacías a `null`). No se usa el resultado normalizado ni se eliminan espacios del original al calcularla. Detecta cualquier cambio de contenido en la fila aunque cambie el archivo. |
| Reejecución del mismo archivo | No crea solicitudes ni entregables nuevos; informa el estado previo. |
| Archivo modificado | Lote nuevo; filas con huella idéntica a una fila importada se marcan `OMITIDA_YA_IMPORTADA`; las filas con cambios tienen una huella nueva y pasan por detección de duplicados/revisión. Nunca se actualiza la solicitud previa ni se sobrescribe una solicitud manual. |
| Fallo a mitad | Cada fila es una unidad transaccional (fila de importación + solicitud + entregables + historial). El lote queda `FALLIDO` y se puede reanudar con la misma clave. |

**Límites de la clave** (documentados): los números de fila cambian si se insertan, ordenan o eliminan filas; una edición de cualquier celda crea una huella nueva y puede representar una versión corregida o una solicitud distinta. No se puede inferir cuál de las dos es: se trata como posible duplicado y se revisa, sin modificar el registro previo. La comparación de duplicados considera tanto solicitudes importadas como manuales. El `sha256` del archivo cambia con cualquier re-exportación. Por eso se usan las tres claves en conjunto y nunca el título como identificador único.

Una reversión deja el lote como terminal: volver a ejecutar exactamente ese lote no lo recrea. Si se decide reimportar después de una reversión, debe iniciarse expresamente un nuevo intento autorizado con otra `clave_lote` (siguiente valor de `intento`); las filas `REVERTIDA` no cuentan como importaciones activas para la comparación por huella.

**Aislamiento del flujo manual.** La importación solo crea solicitudes con `origen = 'IMPORTACION'`; el alta manual siempre fija `origen = 'KROMI'`. Nunca hace `UPDATE`/upsert sobre solicitudes existentes. La detección de similitud con solicitudes manuales puede producir advertencias para revisión, pero no las bloquea, cambia ni reemplaza. Cada fila importada se procesa en su propia transacción, sin bloquear el alta manual de otras solicitudes.

## 12. Registro de errores y advertencias

Cada fila guarda `advertencias` y `errores` como `jsonb` con código, columna, valor original y regla aplicada. Códigos mínimos: `FECHA_INVALIDA`, `SIN_EQUIVALENCIA:<columna>`, `IDENTIDAD_AMBIGUA`, `ENTREGABLES_NO_RESUELTOS`, `COLUMNA_ESPERADA_VACIA`, `POSIBLE_DUPLICADO`, `OBJETIVO_ANTERIOR_A_SOLICITUD`, `ESTADO_Y_TERMINO_INCONSISTENTES`. El resumen del lote (`resumen jsonb`) agrega conteos por código y resultado.

## 13. Conciliación y pruebas

Conteos verificables:

| Conteo | Control |
|---|---|
| Filas de origen | Igual a la suma de todos los resultados de §9 |
| Vacías, excluidas, pendientes, omitidas, rechazadas | Cada una = número de filas con ese resultado |
| Filas importadas (completas + parciales) | = solicitudes creadas con `origen = 'IMPORTACION'` |
| Solicitudes creadas | Cada una tiene exactamente una fila de origen y una sola |
| Entregables creados | = suma de entregables por solicitud importada; ninguno con estado distinto de `HISTORICO` |
| Filas con advertencias / errores | Por código |
| Identidades sin resolver | Por columna (`Responsble`, `Diseñador`) |
| Valores sin equivalencia | Por columna, con valores distintos y frecuencia |
| Duplicados potenciales | Pares marcados |
| Estados originales | Distribución de `estado_historico_original` igual a la del archivo |
| Trazabilidad | Cualquier solicitud o entregable llega a su fila y a su celda original por consulta |
| Historial | Cero filas de transición de estado para solicitudes importadas; exactamente un evento `IMPORTACION` por solicitud |

Validación de estructura previa: encabezados exactos (incluido `Responsble`), 22 columnas, hoja principal identificada, `Hoja 1` vacía.

Las pruebas de datos y de repetición del lote están en [`roadmap-solicitudes-diseno.md` §7](./roadmap-solicitudes-diseno.md#7-plan-de-pruebas).

## 14. Criterios para autorizar la importación definitiva

1. Esquema remoto conciliado con `main` (D-02) y migraciones del módulo aplicadas y revisadas.
2. Simulación sin escritura ejecutada sobre el archivo real, con informe revisado y aprobado por el usuario.
3. Conteos de conciliación coherentes con el archivo y diferencias explicadas.
4. Revisión manual de filas `PENDIENTE_REVISION`, duplicados potenciales e identidades ambiguas.
5. Catálogos iniciales aprobados (departamentos, áreas, medios, formatos).
6. Ensayo completo en Supabase local no productivo con `supabase start` (configuración presente en `supabase/config.toml` `[REPO]`). Docker/daemon están disponibles; antes de esta fase hay que instalar/verificar Supabase CLI y confirmar que el stack local inicia correctamente.
7. Prueba de segunda ejecución: cero registros nuevos.
8. Reversión aprobada técnicamente y probada en entorno no productivo (D-20): una función exclusiva de `service_role` deshace **todo el lote o nada**. Primero comprueba que todas las solicitudes creadas por el lote siguen sin actividad posterior al evento `IMPORTACION` (sin ediciones, asignaciones ni cambios en entregables). Si alguna tiene actividad, la función falla sin modificar el lote y devuelve un error explícito. Si todas pasan, en una transacción guarda en cada fila afectada el resultado previo y el UUID de la solicitud, pone la FK `solicitud_id` en `NULL`, elimina los entregables y solicitudes creados por el lote (el historial desaparece por cascada al borrarse el padre), marca esas filas `REVERTIDA` y marca el lote `REVERTIDO`. Los demás resultados de fila no cambian. Lote, filas y `datos_originales` se conservan como constancia de auditoría. No se permite revertir solicitudes manuales ni solicitudes importadas con actividad posterior.
9. El operador técnico autorizado ejecuta el script de servidor/CLI; el acceso `service_role` queda limitado al proceso protegido, no se expone en navegador ni se versionan sus credenciales (D-09).

## 15. Fases de ejecución

1. Lectura del archivo original en modo solo lectura y cálculo de `sha256`.
2. Validación de estructura.
3. Identificación estable de filas (hoja, fila, `huella`).
4. Clasificación (§9).
5. Normalización (§3–§8).
6. Resolución de identidades y catálogos.
7. Detección de duplicados.
8. Validación contra las restricciones del destino.
9. **Simulación sin escritura**: informe JSON y Markdown con resultados, conteos y diferencias.
10. Revisión del informe.
11. Importación autorizada (con las condiciones de §14).
12. Conciliación posterior y reporte final.

Los pasos 1–9 no escriben en Supabase ni en servicios externos; el archivo nunca se modifica.
