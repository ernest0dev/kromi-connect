# Plan de mapeo e importación histórica de solicitudes de Diseño

**Estado (2026-10-25):** propuesta para revisión. No se ejecutó ninguna lectura, simulación ni escritura sobre datos reales. Etiquetas de evidencia: [`plan-solicitudes-diseno.md` §0](./plan-solicitudes-diseno.md#0-cómo-leer-este-documento). Modelo destino: [`plan-datos-solicitudes-diseno.md`](./plan-datos-solicitudes-diseno.md). Decisiones abiertas: [`plan-solicitudes-diseno.md` §13](./plan-solicitudes-diseno.md#13-registro-de-decisiones).

## 1. Fuente

| Aspecto | Dato | Etiqueta |
|---|---|---|
| Archivo | similar a `Solicitudes para el equipo de diseño gráfico.xlsx` | `[PENDIENTE]` nombre exacto |
| Disponibilidad en la auditoría | **El archivo no estaba disponible.** Todo lo que sigue sobre su contenido viene del análisis previo y debe revalidarse. | `[PENDIENTE]` |
| Hojas | principal (~268 filas, 22 columnas) y `Hoja 1` (vacía) | observación previa |
| Encabezados | 22, incluido `Responsble` (error ortográfico original, **se conserva tal cual** como clave de lectura) | `[CONFIRMADA]` |
| Almacenamiento del archivo | **No se versiona en el repositorio**: contiene datos personales (nombres y correos). Solo se registra su `sha256` en el lote. | `[PROPUESTA]` |

**Observaciones previas, no invariantes** (no se insertan ni se usan como constantes de código): 268 filas totales; 264 candidatas con marca temporal y título; 1 fila huérfana con solo `Estatus = Terminado` y fecha de término; 3 filas en blanco; solicitudes del 7 de julio al 23 de octubre de 2026.

**Inconsistencias en las observaciones previas, a aclarar con el archivo:**

1. 268 = 264 + 1 + 3, pero no se indica si esas 268 incluyen la fila de encabezado `[PENDIENTE]`.
2. Las distribuciones de estado, prioridad, departamento y medio suman 268 (incluyen la fila huérfana y las 3 en blanco, p. ej. «Sin prioridad: 4» = 3 en blanco + 1 huérfana), pero la de **Área suma 264** (128 + 22 + 19 + 11 + 84). Las bases no son homogéneas. La conciliación debe recalcular todo sobre el archivo.
3. «Sin área: 84» es el 32 % de las solicitudes candidatas: el perfil de origen no puede inferirse para un tercio de los casos y no debe rellenarse.
4. 216 «Terminado» frente a 212 fechas de término: hay filas terminadas sin fecha o con fecha sin estado coherente. No se infiere cierre operativo `[CONFIRMADA]`.

Verificaciones obligatorias sobre el archivo antes de fijar el mapeo definitivo (F3):

- Tipo real de cada celda de fecha (texto, fecha o número serial de Excel) y sistema de fechas.
- Separadores y vocabulario de «¿Qué se publica?» y «¿Qué se imprime?» (si es selección múltiple, cómo se separan los valores).
- Significado de las columnas con sufijo `2` (¿pregunta repetida del formulario? hipótesis sin confirmar) y de «¿Cuántos diseños se necesita?» (vacía en el análisis previo).
- Si «Dirección de correo electrónico» es el correo de quien envió el formulario o del solicitante real (puede diferir de `Responsble`).
- Zona horaria con la que se registró la marca temporal (D-15).

## 2. Inventario de columnas

Las 22 columnas originales, en orden: `Marca temporal`, `Fecha de entrega`, `Nombre de arte/flyer`, `¿Qué se quiere lograr con esta pieza?`, `¿Qué se publica?`, `Diseñador`, `Responsble`, `Prioridad`, `Estatus`, `Fecha de termino`, `Departamento`, `Imagen referencial`, `¿Qué se imprime?`, `Área`, `¿Cuántos diseños se necesita?`, `¿A que medio pertenece?`, `Dirección de correo electrónico`, `¿Cuántas piezas?`, `¿Qué se publica? 2`, `¿Qué se imprime? 2`, `En qué material`, `Definir las medidas`.

La lectura se hace **por nombre de encabezado**, no por posición, y falla de forma explícita si falta o sobra una columna (validación de estructura, §13).

## 3. Mapeo columna original → campo destino

Todas las columnas se copian íntegras a `solicitud_diseno_importacion_filas.datos_originales` antes de cualquier transformación. La columna «Tratamiento del valor original» indica qué más se conserva.

| Columna original | Campo destino | Transformación | Validación | Incertidumbre | Tratamiento del valor original |
|---|---|---|---|---|---|
| Marca temporal | `solicitudes_diseno.solicitada_en_original` | Interpretar como fecha-hora en `America/Caracas` y guardar `timestamptz` (§5) | Debe ser fecha válida; si falta junto con el título, la fila se excluye | Zona horaria (D-15); tipo de celda | Siempre en `datos_originales` |
| Fecha de entrega | `solicitudes_diseno.fecha_objetivo` | Solo fecha (sin zona) | Fecha válida; si no, `NULL` + advertencia | Tipo de celda | `fecha_objetivo_original` (texto) |
| Nombre de arte/flyer | `solicitudes_diseno.titulo` | `trim`, colapsar espacios; sin cambiar mayúsculas | No vacío tras `trim` | Títulos genéricos o repetidos | `datos_originales` |
| ¿Qué se quiere lograr con esta pieza? | `solicitudes_diseno.objetivo` | `trim` | Ninguna (texto libre) | Puede incluir instrucciones y no solo objetivo | Texto íntegro; no se trunca |
| ¿Qué se publica? | `…_entregables` (categoría `DIGITAL`): `formato_original` y, si hay equivalencia exacta, `formato_id` | Tokenizar según el vocabulario real (§8) | Cada token se compara por alias exacto | Separadores y vocabulario sin verificar | `datos_originales`; `alcance_texto` |
| Diseñador | `solicitudes_diseno.ejecutor_historico_nombre` y, si es verificable, `ejecutor_historico_usuario_id` | `trim`; resolución de identidad (§7) | — | Nombres sin cuenta | `datos_originales`; no crea `responsable_actual_id` (D-16) |
| Responsble | `solicitudes_diseno.solicitante_nombre_original` y, si es verificable, `solicitante_usuario_id` | `trim`; resolución de identidad (§7) | — | Muchos solicitantes sin cuenta | Nombre original inmutable `[CONFIRMADA]` |
| Prioridad | `solicitudes_diseno.prioridad` | Coincidencia exacta normalizada (§6.1) | Solo `URGENTE`/`IMPORTANTE`/`NORMAL`; otro valor → `NULL` + advertencia | Variantes de escritura | `prioridad_original` |
| Estatus | `solicitudes_diseno.estado_historico_original` | Ninguna; `estado` = `HISTORICA` siempre | — | Estados fuera del vocabulario observado | Texto íntegro; **no se traduce** `[CONFIRMADA]` |
| Fecha de termino | `solicitudes_diseno.fecha_termino_historica` | Solo fecha | Fecha válida; si no, `NULL` + advertencia | Significado operativo sin confirmar | `fecha_termino_original`; solo antecedente `[CONFIRMADA]` |
| Departamento | `solicitudes_diseno.departamento_id` | Alias exacto normalizado (§6.3) | Sin equivalencia → `NULL` + advertencia | 8 valores observados, solo 2 en `departamento_enum` | `departamento_original` |
| Imagen referencial | `solicitudes_diseno.referencias_urls` | Extraer URLs `http(s)` con expresión estricta | Esquema `http` o `https`; nunca se visita | Enlaces privados, rotos o ajenos | `referencias_originales` íntegro; sin descargar ni exponer |
| ¿Qué se imprime? | `…_entregables` (categoría `IMPRESO`): `formato_original`/`formato_id` | Igual que «¿Qué se publica?» | Igual | Igual | `datos_originales`; `alcance_texto` |
| Área | `solicitudes_diseno.area_id` | Alias exacto normalizado (§6.4) | Vacía → `NULL` (no se infiere) | 32 % sin valor | `area_original` |
| ¿Cuántos diseños se necesita? | Ninguno en v1 | Ninguna | Advertencia `COLUMNA_ESPERADA_VACIA` si trae valor | Vacía en el análisis previo; significado desconocido | Solo en `datos_originales` |
| ¿A que medio pertenece? | `…_entregables.medio_id` y `medio_original` | Alias exacto (§6.5) | Sin equivalencia → `NULL` | «Digital e impreso» | `datos_originales` |
| Dirección de correo electrónico | Solo identidad (§7) | Minúsculas y `trim` para comparar | — | Puede ser del emisor del formulario, no del solicitante | Solo en `datos_originales` (D-14); no se copia a la solicitud |
| ¿Cuántas piezas? | `…_entregables.cantidad_piezas`, `…_entregables.cantidad_formatos` (ver §8) y `alcance_texto` | Extracción conservadora (§8) | Entero > 0; si no, `NULL` | Texto libre | `alcance_texto` y `datos_originales`; si no hay entregable, `solicitudes_diseno.alcance_original` |
| ¿Qué se publica? 2 | Como «¿Qué se publica?» | Se fusiona solo si es inequívoco; si difiere de la columna 5, ambas se conservan y la fila se marca | Igual | Semántica del sufijo `2` sin verificar | `datos_originales` |
| ¿Qué se imprime? 2 | Como «¿Qué se imprime?» | Igual | Igual | Igual | `datos_originales` |
| En qué material | `…_entregables.material` | `trim`; se asigna solo a entregables `IMPRESO` | — | Aplica solo a impresos | Si no hay entregable `IMPRESO`, queda en `datos_originales` |
| Definir las medidas | `…_entregables.medidas` | `trim`; igual que material | — | Igual | Igual |

El diccionario de los campos destino está en [`plan-datos-solicitudes-diseno.md` §3](./plan-datos-solicitudes-diseno.md#3-diccionario-de-datos).

## 4. Transformaciones permitidas y valores que solo se conservan como texto

**Permitidas:** `trim`; colapsar espacios; normalizar para comparar (minúsculas, sin tildes) **solo para buscar equivalencias**, nunca para reescribir el valor guardado; interpretar fechas; extraer enteros inequívocos; tokenizar listas con separadores confirmados; extraer URLs.

**Prohibidas:** traducir estados históricos; completar áreas, departamentos o tipos por inferencia; coincidencia difusa de personas o catálogos; crear fechas de solicitud a Diseño, inicio, entrega real o cierre; corregir ortografía; fusionar filas.

**Solo texto original (sin normalizar):** objetivo; `Imagen referencial`; «¿Cuántos diseños se necesita?»; correo; material y medidas cuando no hay entregable; columnas con sufijo `2` cuando difieren de las principales; cualquier valor sin equivalencia.

## 5. Tratamiento de fechas

| Campo | Tipo destino | Zona horaria | Regla |
|---|---|---|---|
| Marca temporal | `timestamptz` | Se interpreta como `America/Caracas` (UTC−04, sin horario de verano), la misma zona que usa `src/lib/designSla.ts` `[REPO]`. Supuesto **no confirmado** (D-15). | Celdas de texto: se parsea con formato verificado en el archivo. Números serie: conversión con el sistema 1900 verificado. |
| Fecha de entrega | `date` | Sin zona: la fecha tal como aparece | Si la celda es fecha-hora, se toma la fecha de calendario sin convertir de zona. |
| Fecha de termino | `date` | Igual | Solo antecedente. |

Valores inválidos o incompletos: la columna normalizada queda `NULL`, el texto original se guarda en `*_original`, la fila recibe advertencia (`FECHA_INVALIDA`) y, si afecta a la identidad mínima, se clasifica según §9. Inconsistencias (fecha de entrega anterior a la marca temporal; fecha de término anterior a la solicitud; término con estado distinto de «Terminado» y viceversa) generan **advertencia sin corrección**.

**No se calculan ni se crean:** `fecha_solicitud_diseno`, `fecha_entrega_diseno_estimada`, `fecha_entrega_diseno_real`, `fecha_limite_brief`, fechas de inicio ni de cierre operativo. La importación no ejecuta `calcularMatrizSLA` ni `recalculateSlaDates`, que pertenecen al ciclo de publicaciones, ni activa ningún SLA como si las solicitudes acabaran de crearse `[CONFIRMADA]`.

## 6. Prioridades, estados, departamentos, áreas y medios

Regla común: alias exacto tras normalizar. Sin equivalencia: columna normalizada `NULL`, original intacto, advertencia `SIN_EQUIVALENCIA:<columna>`, y el valor se acumula en el informe de «valores sin equivalencia» para decidir si se amplía el catálogo.

### 6.1 Prioridad
`Urgente` → `URGENTE`; `Importante` → `IMPORTANTE`; `Normal` → `NORMAL`; vacío → `NULL`. No se asigna `NORMAL` por defecto a los vacíos. No se usa la escala de `publicaciones.prioridad` (1 Alta / 2 Normal / 3 Baja) `[REPO]` (D-05).

### 6.2 Estado histórico
Valores observados: Terminado, Cancelado, Por aprobar, Sin empezar, No a tiempo, Solicitud Incompleta, Atrasado, En curso, vacío. **Ninguno se traduce.** Todo `estado` importado es `HISTORICA` y todo entregable importado es `HISTORICO` (D-13). Los valores distintos se listan en el informe para referencia.

### 6.3 Departamentos
Observados: Mercadeo, Compras, Farmacia, Selección, Capital Humano, Ventas Online, Operaciones Perecederos, Seguridad Laboral, vacío. `departamento_enum` solo contiene `COMPRAS`, `SELECCION`, `PROVEEDOR`, `GERENCIA`, `EVENTOS` `[REPO]`; se usa un catálogo propio (D-03). Los ocho valores observados son la **propuesta de carga inicial** del catálogo, sujeta a aprobación.

### 6.4 Áreas
Observadas: Digital, Eventos, Interno, Gerencia, vacío. «Digital» identifica el perfil de Social Media pero **no** implica publicación `[CONFIRMADA]`; no genera vínculo ni conversión. Vacío → `NULL`.

### 6.5 Medios
Observados: Digital, Impreso, «Digital e impreso», vacío. «Digital e impreso» no es un valor de entregable único: ver §8.

## 7. Reglas de resolución de identidades

Aplican a `Responsble` (solicitante) y a `Diseñador` (ejecutor histórico). Fuentes de comparación: `auth.users` (correo) y `profiles.full_name` `[REPO]`.

| Regla | Descripción |
|---|---|
| I1 | Coincidencia exacta del correo (sin distinguir mayúsculas) con un usuario de `auth.users` → candidato verificable. |
| I2 | Coincidencia exacta del nombre normalizado con **un único** `profiles.full_name` → candidato verificable. |
| I3 | Si I1 e I2 apuntan a usuarios distintos, o el nombre coincide con más de un perfil → **sin resolver**; la fila se marca `IDENTIDAD_AMBIGUA`. |
| I4 | Sin coincidencia → sin resolver; se conserva el nombre original y la solicitud es válida `[CONFIRMADA]`. |
| I5 | Nunca coincidencia difusa ni por similitud. |
| I6 | El correo se compara con el solicitante solo si se confirma qué persona representa (§1); hasta entonces solo sirve como evidencia complementaria, no como prueba. |
| I7 | La resolución se registra en `advertencias` de la fila (regla aplicada, usuario candidato) para poder auditarla. |

Se espera que muchos solicitantes (personal de otras áreas) no tengan cuenta; no es un error. Para el ejecutor, solo `Diseñador` con coincidencia verificable contra un perfil de rol `design` se vincula. La simulación puede resolver identidades contra una exportación local de `profiles` y `auth.users` para no consultar el remoto.

## 8. Interpretación de cantidades y entregables

Principios `[CONFIRMADA]`: cada combinación de pieza y formato puede ser un entregable; varios formatos equivalentes de una misma pieza pueden agruparse solo si es inequívoco; la cantidad es numérica solo si es confiable; el alcance textual se conserva siempre; no se inventan entregables ante ambigüedad; se distinguen cantidad de piezas, cantidad de formatos y texto de alcance.

Reglas `[PROPUESTA]`:

| Regla | Descripción |
|---|---|
| E1 | Formatos candidatos: tokens de «¿Qué se publica?» y su columna `2` (categoría `DIGITAL`), y de «¿Qué se imprime?» y su columna `2` (categoría `IMPRESO`). |
| E2 | Un token es **inequívoco** si coincide exactamente con el alias de un formato del catálogo. Un token sin coincidencia es ambiguo. |
| E3 | `cantidad_piezas`: se extrae un entero solo de patrones exactos (`N diseño(s)`, `N pieza(s)`, número solitario, «un»/«una» = 1). «Varios», «diferentes», rangos o frases abiertas → `NULL`. |
| E4 | `cantidad_formatos`: número de tokens inequívocos agrupados; `NULL` si hay algún token ambiguo. |
| E5 | «1 diseño para diferentes formatos…» → un entregable agrupado, `cantidad_piezas = 1`, `cantidad_formatos` según E4. |
| E6 | «1 diseño para varias fotos o videos…» → un entregable, `cantidad_piezas = 1`, `cantidad_formatos = NULL`. |
| E7 | «1 diseño para un formato» → un entregable, `cantidad_piezas = 1`, `cantidad_formatos = 1`. |
| E8 | «Digital e impreso» → un entregable `DIGITAL` y uno `IMPRESO` solo si hay tokens inequívocos en ambas familias; si no, no se crean y se marca la fila. |
| E9 | Si no hay tokens inequívocos ni cantidad confiable → **cero entregables**; `requiere_revision = true`, motivo `ENTREGABLES_NO_RESUELTOS`; el texto va a `solicitudes_diseno.alcance_original`. |
| E10 | Si las columnas principales y las `2` difieren, se conservan ambas en `datos_adicionales` y se marca la fila. |
| E11 | Cada entregable importado nace `HISTORICO`; `alcance_texto` guarda el texto de «¿Cuántas piezas?». |

Los casos reales de «¿Qué se publica?» y la frecuencia de cada patrón de cantidad deben extraerse del archivo en F3 antes de congelar E1–E11.

## 9. Clasificación de filas y resultados

Cada fila termina en exactamente un resultado (adaptable al diseño técnico):

| Resultado | Condición | Crea solicitud |
|---|---|---|
| `EXCLUIDA_VACIA` | Todas las celdas vacías o con solo espacios | No |
| `EXCLUIDA_SIN_IDENTIDAD_MINIMA` | Sin marca temporal **y** sin título `[CONFIRMADA]` (incluye la fila huérfana de «Terminado») | No; se conserva en el registro |
| `PENDIENTE_REVISION` | Tiene título pero no marca temporal, o al revés (propuesta); o datos contradictorios que impiden normalizar con seguridad | No hasta decisión manual |
| `OMITIDA_YA_IMPORTADA` | Su `huella` coincide con una fila ya importada en un lote completado (§11) | No |
| `RECHAZADA_VALIDACION` | Incumple una restricción dura del destino tras normalizar | No |
| `IMPORTADA_PARCIAL` | Título y marca temporal presentes; algún campo sin normalizar o con advertencia, pero el original está preservado | Sí |
| `IMPORTADA` | Título y marca temporal presentes y todos los campos normalizados sin advertencias | Sí |

Los posibles duplicados **no** cambian el resultado: la fila se importa con `requiere_revision = true`, motivo `POSIBLE_DUPLICADO` y referencia a los candidatos en `advertencias`.

## 10. Detección de duplicados

Señales `[PROPUESTA]` (los umbrales son parámetros por aprobar):

1. Mismo título normalizado y mismo solicitante normalizado dentro de una ventana de pocos días (valor inicial a aprobar).
2. Misma marca temporal exacta y mismo título (doble envío del formulario).
3. Misma `huella` en otra fila del mismo lote.

El título no es clave de identidad ni se usa para fusionar. Todo candidato queda marcado para revisión manual y las filas se conservan.

## 11. Idempotencia

| Mecanismo | Descripción |
|---|---|
| Clave de lote | `archivo_sha256` + nombre de hoja. Un lote con la misma clave no se vuelve a crear. |
| Clave de origen | `unique (lote_id, hoja, fila_origen)`; reintentar el mismo lote inserta con `on conflict do nothing` y reanuda lo pendiente. |
| `huella` | `sha256` de los valores normalizados de marca temporal, título, solicitante y fecha de entrega. Detecta contenido ya importado aunque cambie el archivo. |
| Reejecución del mismo archivo | No crea solicitudes ni entregables nuevos; informa el estado previo. |
| Archivo modificado | Lote nuevo; las filas con `huella` ya importada resultan `OMITIDA_YA_IMPORTADA`; las nuevas se importan. |
| Fallo a mitad | Cada fila es una unidad transaccional (fila de importación + solicitud + entregables + historial). El lote queda `FALLIDO` y se puede reanudar con la misma clave. |

**Límites de la clave** (documentados): los números de fila cambian si se insertan, ordenan o eliminan filas; una edición de celdas cambia la `huella` y podría reimportarse como contenido nuevo (se detecta como duplicado potencial por §10); el `sha256` del archivo cambia con cualquier re-exportación. Por eso se usan las tres claves en conjunto y nunca el título.

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
6. Ensayo completo en un entorno no productivo (instancia local con `supabase start`, que existe en `supabase/config.toml` `[REPO]`, o una rama de Supabase; disponibilidad de un entorno de pruebas `[PENDIENTE]`).
7. Prueba de segunda ejecución: cero registros nuevos.
8. Plan de reversión aprobado (D-20, pendiente). No se asume un borrado físico libre: choca con la regla de no borrar entregables (D-19) y con la inmutabilidad del historial. Propuesta: una función exclusiva de `service_role` que solo revierte lotes cuyas solicitudes no tengan actividad posterior (únicamente el evento `IMPORTACION`), elimina en orden entregables, vínculos y solicitudes (el historial se elimina por cascada porque el trigger lo admite cuando el padre ya no existe) y marca el lote `REVERTIDO` dejando constancia en `resumen`. Una reversión con actividad posterior no es automática.
9. Permisos `design.solicitudes.import.*` concedidos explícitamente a quien ejecute (D-09).

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
