# Roadmap técnico: solicitudes de Diseño

**Estado (2026-10-26):** propuesta para revisión; no se autorizó ninguna fase de implementación. Este documento ordena el trabajo, sus dependencias, criterios de entrada y salida, riesgos y pruebas. Etiquetas: [`plan-solicitudes-diseno.md` §0](./plan-solicitudes-diseno.md#0-cómo-leer-este-documento).

Documentos relacionados: [`plan-solicitudes-diseno.md`](./plan-solicitudes-diseno.md) (funcional y registro de decisiones), [`plan-datos-solicitudes-diseno.md`](./plan-datos-solicitudes-diseno.md) (datos y seguridad), [`plan-importacion-solicitudes-diseno.md`](./plan-importacion-solicitudes-diseno.md) (mapeo e importación).

## 1. Orden recomendado y cambios respecto al encargo

Se conserva la secuencia F0–F8 del encargo con estos ajustes `[PROPUESTA]`:

| Cambio | Razón |
|---|---|
| F0 y F1 se ejecutan en paralelo | F0 es verificación técnica y F1 es cierre de decisiones con el usuario; no dependen entre sí. |
| F3 (simulación) ocurre antes de F4 y **no necesita tablas** | La simulación trabaja sobre el archivo y exportaciones locales de perfiles; produce un informe que decide catálogos y reglas de entregables antes de fijar migraciones. |
| La revisión de duplicados e identidades ambiguas se hace sobre el informe de simulación antes de F5 | Evita depender de una interfaz que aún no existe. La revisión posterior a la importación se hace en F6. |
| F7 es **condicional** a D-12 | La recomendación es no integrar con la cola de Diseño en el primer despliegue. |

## 2. Fases

| Fase | Contenido | Entrada | Salida (criterio de aceptación) |
|---|---|---|---|
| **F0** Auditoría y conciliación del esquema remoto | Ejecutar `supabase migration list --linked` y `supabase db pull`; comparar con los 25 archivos de `supabase/migrations/`; revisar los objetos de [`plan-datos-solicitudes-diseno.md` §12](./plan-datos-solicitudes-diseno.md#12-objetos-remotos-que-requieren-comprobación-antes-de-crear-migraciones); aplicar o no `20261021030128` según se decida; regenerar `supabase-schema-public.md` y su captura | Acceso de lectura al proyecto remoto | Informe de diferencias entre `main` y remoto; sin discrepancias sin explicar; D-02 cerrada. **No se ejecuta `db push` a ciegas ni se repara el historial sin comprobar que el esquema existe.** |
| **F1** Cierre de especificación | Resolver D-03 a D-19 con el usuario; congelar estados, permisos iniciales y catálogos iniciales | Este plan revisado | Registro de decisiones sin pendientes bloqueantes (D-07, D-08, D-09, D-10, D-17 como mínimo) |
| **F2** Diseño de migraciones, permisos y datos | Convertir el diseño en migraciones aditivas **sin ejecutarlas**; matriz de permisos aprobada; revisión de RLS/RPC por pares | F0, F1 | Migraciones revisadas, sin tocar objetos existentes; todas las tablas con RLS y `REVOKE` en la misma transacción; pruebas SQL de permisos escritas |
| **F3** Simulación del importador | Lector del archivo, validación de estructura, clasificación, normalización, resolución de identidades, duplicados, informe; sin escritura | Archivo original, D-03, D-09, D-13, D-15, D-16, D-17 | Informe de simulación aprobado; reglas E1–E11 confirmadas con datos reales; conteos del archivo coherentes (import §13) |
| **F4** Modelo y flujo operativo | Aplicar migraciones en entorno de prueba; RPC; Server Actions con `authorizeAction`; tipos regenerados; flujo de solicitudes nuevas | F2 aprobada, F0 cerrada. Antes de escribir código: leer `node_modules/next/dist/docs/` (`AGENTS.md`) | Criterios 1–7 de [`plan-solicitudes-diseno.md` §12](./plan-solicitudes-diseno.md#12-criterios-de-aceptación) y pruebas de seguridad en verde |
| **F5** Importación histórica | Importador real con funciones solo `service_role`; ensayo no productivo; importación autorizada; conciliación | F3, F4, criterios de import §14 | Segunda ejecución sin registros nuevos; conciliación completa; trazabilidad fila→solicitud verificada |
| **F6** Interfaz de gestión y consulta | Una vista con detalle expandible (entregables, historial, datos originales), asignación, referencia manual y revisión de marcadas, según [`plan-solicitudes-diseno.md` §11.1](./plan-solicitudes-diseno.md#111-restricciones-de-ui-e-integración-mínima-propuesta-d-21-d-22). Sin modales ni ficha aparte; **maqueta aún no diseñada** | F4, F5; línea base de capturas de las vistas existentes tomada **antes** de empezar | Flujos funcionales de §7 ejecutados con cuentas reales; accesibilidad y estados de carga/error/vacío; pruebas T-U1 a T-U4 sin diferencias salvo el ítem de menú |
| **F7** Integración con Diseño (condicional) | Adaptador y RPC propios si D-12 lo aprueba | D-12 aprobada, F4, F6 | Cola sin duplicados; solicitudes `HISTORICA` ausentes; pruebas de integración de §7 |
| **F8** Pruebas con usuarios y validación de producción | Pruebas con Diseño y Social Media; verificación remota de grants y RLS; revisión de logs | F4–F6 (y F7 si aplica) | Pruebas positivas y negativas con cuentas reales; matriz de permisos verificada contra el remoto |

```mermaid
flowchart LR
  F0[F0 Conciliar remoto] --> F2
  F1[F1 Cerrar decisiones] --> F2
  F1 --> F3
  F2[F2 Migraciones y permisos] --> F4
  F3[F3 Simulación] --> F5
  F4[F4 Modelo y flujo] --> F5
  F4 --> F6
  F5[F5 Importación] --> F6
  F6[F6 Interfaz] --> F8
  F6 -.opcional.-> F7[F7 Integración Diseño]
  F7 -.-> F8[F8 Validación]
```

## 3. Dependencias externas y bloqueos conocidos

| Dependencia | Afecta | Estado |
|---|---|---|
| Acceso de lectura a Supabase remoto | F0 | No disponible en la auditoría |
| Archivo original de la hoja | F3 | No disponible en la auditoría |
| Entorno de pruebas no productivo (instancia local con Docker o rama de Supabase) | F4, F5 | `[PENDIENTE]` confirmar cuál existe |
| Respuestas del usuario a D-07, D-08, D-09, D-10, D-17, D-20 | F1 | Pendientes |
| Aplicación de `20261021030128` | F0 | Pendiente de aplicar según `[REPORTADO]` |
| Dos lockfiles (`package-lock.json` y `pnpm-lock.yaml`) | F4 | Detectados en la raíz `[REPO]`; confirmar el gestor vigente antes de instalar dependencias |

## 4. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El esquema remoto difiere de `main` (`202610150001` sin `db pull`, `20261021030128` pendiente) | Migraciones que fallan o duplican objetos | F0 obligatoria; no `db push` a ciegas |
| Tablas nuevas expuestas por la API (`auto_expose_new_tables` sin definir) | Fuga de datos | RLS + `REVOKE` en la misma transacción; verificar en remoto (datos §12.9) |
| Datos personales (nombres, correos) en la importación | Exposición | Sin privilegios de tabla para `authenticated`; acceso por RPC con permiso propio; el archivo no se versiona |
| Interpretación errónea de «¿Cuántas piezas?» o formatos | Entregables inventados | Reglas conservadoras E1–E11; cero entregables ante ambigüedad; confirmar con datos reales en F3 |
| Hoja con inconsistencias (bases distintas, estados sin fecha de término) | Conciliación que no cuadra | Recalcular todo sobre el archivo; advertencias sin corrección |
| Zona horaria de la marca temporal incorrecta | Fechas desplazadas | D-15; informe de simulación con ejemplos |
| Permisos demasiado amplios | Acceso indebido | Matriz explícita; `admin` sin herencia; pruebas negativas |
| Cambio de `DesignSource` rompe la cola | Regresión en Diseño | F7 opcional; pruebas de no regresión de `publicaciones`, `pendientes_tienda`, `eventos` |
| La implementación altera la UI ya aplicada (menús, cola, historial, ficha, modales de Grid) | Regresión visual en vistas revisadas | Lista de archivos intocables y archivo único editable (`design/shell.tsx`); línea base de capturas; revisión de `git diff --stat` en cada entrega (plan §11.1) |
| Nombre del ítem de menú choca con «Solicitudes» | Confusión del usuario | Nombre distinto, aprobado en D-21 |
| `publicacion_estatus_historial` sin trigger de inmutabilidad | Precedente débil | No se toma como modelo; trigger propio en el historial nuevo |
| Reintentos de PostgREST por `40001` | Bucles | Conflictos de versión con `PT409` |
| Enlaces de «Imagen referencial» maliciosos o privados | Seguridad y confianza | Solo texto/URL `http(s)`; sin descarga ni previsualización |

## 5. Entregables por fase

F0: informe de conciliación y esquema regenerado. F1: registro de decisiones cerrado. F2: migraciones revisadas (sin ejecutar), matriz de permisos aprobada. F3: herramienta de simulación e informe. F4: migraciones aplicadas en pruebas, RPC, acciones, tipos. F5: importador, informe de conciliación. F6: vistas. F7: adaptador (si aplica). F8: informe de pruebas con usuarios.

## 6. Primera fase técnica recomendada

**F0, junto con F1.** Es la única que no requiere decidir nada nuevo y desbloquea F2. Tareas concretas: (1) `supabase migration list --linked`; (2) `supabase db pull` en una copia y comparar; (3) registrar el valor efectivo de `auto_expose_new_tables`; (4) listar `app_permissions` y `role_permissions` reales; (5) en paralelo, enviar al usuario las decisiones D-07, D-08, D-09, D-10 y D-17.

## 7. Plan de pruebas

Leyenda: **[D]** se puede diseñar ahora; **[I]** solo se puede ejecutar tras implementar. Herramientas existentes en el repositorio `[REPO]`: Jest (`npm test`, `npm run test:integration`) y Playwright (`npm run test:e2e`, `e2e/`); las pruebas SQL de permisos y RLS requieren un entorno de base de datos de pruebas.

### 7.1 Datos e importación

| # | Caso | Resultado esperado | Tipo |
|---|---|---|---|
| T-D1 | Fila completa y válida | `IMPORTADA`; solicitud, entregables `HISTORICO`, un evento `IMPORTACION` | D (unidad) / I |
| T-D2 | Fila con campos sin equivalencia | `IMPORTADA_PARCIAL`; originales intactos; advertencia | D |
| T-D3 | Fila sin título ni marca temporal (huérfana con «Terminado») | `EXCLUIDA_SIN_IDENTIDAD_MINIMA`; no crea solicitud; queda en el registro | D |
| T-D4 | Solo título o solo marca temporal | `PENDIENTE_REVISION` | D |
| T-D5 | Fila vacía | `EXCLUIDA_VACIA` | D |
| T-D6 | Fecha inválida, número serial, texto con formato distinto | Normalizada `NULL` + original + advertencia | D |
| T-D7 | Fecha de entrega anterior a la marca temporal | Se conserva; advertencia | D |
| T-D8 | Solicitante o diseñador sin cuenta | Nombre conservado; sin vínculo; fila válida | D |
| T-D9 | Nombre que coincide con dos perfiles / correo y nombre apuntan a usuarios distintos | `IDENTIDAD_AMBIGUA`; sin vínculo | D |
| T-D10 | «1 diseño para diferentes formatos…», «1 diseño para varias fotos o videos…», «1 diseño para un formato» | Reglas E5, E6, E7 | D |
| T-D11 | Cantidad en texto libre sin número | `cantidad_piezas = NULL`; texto conservado | D |
| T-D12 | Varios formatos inequívocos / ambiguos | Agrupación o cero entregables según E2, E9 | D |
| T-D13 | «Digital e impreso» con y sin tokens en ambas familias | E8 | D |
| T-D14 | Dos filas con el mismo título y solicitante en pocos días | Ambas importadas; `POSIBLE_DUPLICADO` | D |
| T-D15 | Repetir el mismo lote | Cero registros nuevos | D (simulación) / I |
| T-D16 | Cambiar el archivo y reimportar | Filas con `huella` ya importada → `OMITIDA_YA_IMPORTADA` | D / I |
| T-D17 | Fallo forzado a mitad del lote y reanudación | Sin duplicados; lote completa | I |
| T-D18 | Conciliación: suma de resultados = filas de origen; solicitudes = importadas + parciales; trazabilidad fila↔solicitud 1:1 | Todos los controles de import §13 | D / I |
| T-D19 | Distribución de `estado_historico_original` = la del archivo; cero transiciones de estado | Verificado | I |
| T-D20 | Estructura inválida (falta una columna, encabezado distinto) | Falla explícita antes de procesar | D |

### 7.2 Flujo funcional

| # | Caso | Tipo |
|---|---|---|
| T-F1 | Crear solicitud sin publicación ni entregables | I |
| T-F2 | Vincular después a una publicación (acción explícita, con permisos de ambas entidades) | I |
| T-F3 | Solicitud con varios entregables; completar uno y verificar `EN_CURSO` | I |
| T-F4 | Cancelación con motivo; entregables abiertos cancelados y completados intactos | I |
| T-F5 | Reabrir una `HISTORICA` con motivo | I |
| T-F6 | Cambio de responsable: fila `ASIGNACION` con anterior, nuevo, actor y fecha; solicitante intacto | I |
| T-F7 | Consultar historial y datos originales según permisos | I |
| T-F8 | Solicitud histórica no genera ticket activo de Diseño | I |
| T-F9 | Conflicto de versión devuelve HTTP 409 (`PT409`) y no se reintenta | I |

### 7.3 Seguridad

| # | Caso | Tipo |
|---|---|---|
| T-S1 | Usuario con permiso lee y escribe lo previsto | I |
| T-S2 | Usuario autenticado **sin** permiso: sin lectura por tabla ni RPC | I |
| T-S3 | Usuario `admin` sin permisos explícitos: sin acceso | I |
| T-S4 | `UPDATE` o `DELETE` sobre el historial, incluso con `service_role` | I |
| T-S5 | Acceso a lotes y filas de importación sin `import.read`: denegado; con `import.read` sí | I |
| T-S6 | Llamada directa a una RPC de escritura sin permiso: error `42501` | I |
| T-S7 | Intento de `INSERT` directo a las tablas desde el cliente (`authenticated`) | I |
| T-S8 | El correo del solicitante no aparece en listados ni respuestas de cola | I |
| T-S9 | Si hay integración: la RPC de cola exige ambos permisos y no devuelve datos de importación | I (F7) |
| T-S10 | Diseñar las pruebas SQL (roles simulados) y los casos de denegación antes de F4 | D |

### 7.4 Integración

| # | Caso | Tipo |
|---|---|---|
| T-I1 | Crear solicitudes y vínculos no cambia estados ni historial de `publicaciones`, `pendientes_tienda` ni `eventos` | I |
| T-I2 | La cola de Diseño (`/design/publications`) no muestra solicitudes del módulo en v1 | I |
| T-I3 | Con integración: sin duplicados en la cola, cancelación coherente, historial persistente, permisos por origen | I (F7) |
| T-I4 | Regresión de los adaptadores `adaptPublication`, `adaptInternal`, `adaptEvent` (`src/lib/designRequests.ts`) | I |

### 7.5 Interfaz (no regresión)

| # | Caso | Tipo |
|---|---|---|
| T-U1 | Capturas de la cola, el historial y la ficha de Diseño, y del menú de Social Media, antes y después: sin diferencias salvo el ítem de menú nuevo (Playwright está configurado, pero no hay pruebas de capturas hoy; la línea base se crea en F6) | I |
| T-U2 | `git diff --stat` de la rama de F6 solo muestra archivos nuevos y `design/shell.tsx` (más el menú de otro rol si D-08 lo aprueba) | I |
| T-U3 | El módulo no abre modales ni navega a una ficha aparte | I |
| T-U4 | Un rol sin permiso no ve el ítem de menú y la ruta responde como no encontrada (`requirePermission` usa `notFound()` `[REPO]`) | I |

## 8. Verificaciones remotas pendientes

Resumen; la lista completa está en [`plan-datos-solicitudes-diseno.md` §12](./plan-datos-solicitudes-diseno.md#12-objetos-remotos-que-requieren-comprobación-antes-de-crear-migraciones). Ninguna se ha ejecutado.

## 9. Revisión cruzada de la documentación

Revisión del 2026-10-25 contra el commit `22d2fb1` de `main`. Método: un script de comprobación (no versionado) valida enlaces relativos, anclas, rutas y nombres de migraciones citados, y que los identificadores de funciones SQL y de TypeScript mencionados existan en el repositorio; el resto es lectura cruzada manual. El script **solo comprueba referencias**, no la corrección del diseño.

| # | Criterio del encargo | Resultado |
|---|---|---|
| 1 | Arquitectura coherente entre documentos | Cumplido tras corregir una contradicción sobre la reversión de lotes (ahora D-20) |
| 2 | Decisiones confirmadas sin alteraciones | Cumplido; resumidas en el registro §13.1 |
| 3 | Propuestas diferenciadas | Cumplido por etiquetas `[CONFIRMADA]`/`[PROPUESTA]` y registro de decisiones |
| 4 | Compatibilidad con entidades existentes | Cumplido; ninguna entidad existente se modifica en v1 (datos §11) |
| 5 | Permisos y RLS verificables | Propuesta completa (datos §9–§10); falta aprobar D-07, D-08, D-09 |
| 6 | Importación idempotente y auditable | Cumplido a nivel de diseño (import §11, §13) |
| 7 | Datos originales sin pérdida | Cumplido: doble copia (`datos_originales` y pares `*_original`) |
| 8 | Estados históricos sin transiciones ficticias | Cumplido: `HISTORICA`/`HISTORICO`, un solo evento `IMPORTACION` |
| 9 | Fases, dependencias y criterios | Cumplido (§2–§3) |
| 10 | Riesgos y verificaciones remotas identificados | Cumplido (§4, datos §12); ninguna verificación ejecutada |
| 11 | Sin cambios en implementación ni datos | Verificado con `git status`: solo cuatro archivos nuevos y cuatro líneas añadidas al índice `docs/design/README.md` |
| 12 | Referencias internas coherentes | Cumplido según el script (0 problemas) y la comprobación de los D-xx citados contra el registro |
| 13 | Índice actualizado solo si es necesario | Se añadieron cuatro filas a `docs/design/README.md`; no se tocó otra documentación |
| 14 | Otro desarrollador puede empezar sin reconstruir decisiones | **Parcial:** F0 puede empezar ya; F2 en adelante depende de las decisiones pendientes (D-07, D-08, D-09, D-10, D-17, D-20) y de revalidar la hoja real |

**Limitaciones de la auditoría.** No hubo acceso al proyecto remoto de Supabase ni al archivo de la hoja; el repositorio se leyó en una copia superficial de `main`. Las afirmaciones sobre el estado remoto proceden de la documentación del repositorio y no se confirmaron. Las discrepancias detectadas y no resueltas: `inventory_import_batches` no se crea en ninguna migración (solo en `supabase/imports/20261013_control_inventario_mercadeo.sql`); `docs/supabase-db-migration.md` §5 describe la política RLS permisiva «Permitir todo a usuarios autenticados» (el propio documento la marca como etapa anterior; la migración `202610060001_role_permission_policies.sql` la sustituyó por políticas basadas en permisos), por lo que no debe usarse como modelo; `docs/supabase-schema-public.md` está desactualizado; `publicacion_estatus_historial` no tiene trigger de inmutabilidad.
