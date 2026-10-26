# Diseño de interfaz

Esta carpeta guarda las decisiones de diseño que no caben en el código: qué muestra cada pantalla, de dónde sale cada dato y qué falta por construir.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| [`modales-publicacion.md`](./modales-publicacion.md) | Especificación de Crear, Editar, Detalle, Archivo y la sección Brief: campos, permisos, flujo confirmado, migraciones y alcance. |
| [`plan-validacion-brief-drive.md`](./plan-validacion-brief-drive.md) | Decisiones, arquitectura y estado de implementación del brief con Drive y retorno `SOLICITADO → PENDIENTE_BRIEF`. |
| [`plan-rol-design.md`](./plan-rol-design.md) | Plan por fases del perfil Design completo: instrucciones obligatorias, auto-asignación, carga de entregables en la app, historial y revisión por Social Media. |
| [`prototypes/`](./prototypes) | Maquetas HTML + CSS de cada artboard (un archivo `.dc.html` por pantalla) y `canvas.json` con su posición en el lienzo. |
| [`plan-inventario-eventos.md`](./plan-inventario-eventos.md) | Plan del inventario compartido del rol Eventos: modelo, migración `202610130001`, permisos, fases, decisiones pendientes e importación del Excel. |
| [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) | Plan y estado del módulo de programación de eventos del perfil Eventos: varias tiendas, estados automáticos por hora, campos libres, modelo, permisos, RPC y vistas. La migración `supabase/migrations/202610150001_events_schedule.sql` fue reportada como aplicada; falta conciliar el esquema remoto. |
| [`plan-eventos-diseno.md`](./plan-eventos-diseno.md) | Plan para que cada evento del calendario solicite diseño a Design (casilla, formato digital/impresión, instrucciones, fecha de entrega, brief en Drive, cola de Design). Replica el flujo de Interno y Social Media. Implementado en `20261020011300_events_design.sql`, `20261020011301_unified_design_requests.sql` y `src/app/actions/events/design.ts`; las correcciones y la carga del brief opcional están en `20261021030128` (pendiente de aplicar). |
| [`plan-ficha-unica-design.md`](./plan-ficha-unica-design.md) | Implementación de la ficha única de Design y su plan D0–D6: adaptadores, reglas de visibilidad, acciones y archivos por origen, migraciones aditivas y estado de despliegue. |
| [`revision-ficha-unica.md`](./revision-ficha-unica.md) | Revisión de la ficha única implementada (`811ba33`): bugs, mejoras de Design y de las UIs de Social Media, Interno y Eventos, tandas A–D y prompts para Kilo. |
| [`plan-restablecer-ui-design.md`](./plan-restablecer-ui-design.md) | Plan para restablecer la UI del prototipo en la cola, el historial y la ficha de Design sin perder la funcionalidad unificada: diferencias, qué se conserva, datos, tandas U0–U3 y reglas para Codex. |
| [`plan-rol-interno.md`](./plan-rol-interno.md) | Especificación del perfil Interno: mapa funcional con fondo gris, Listado, Archivo, briefs en Drive y solicitudes opcionales a Design. La imagen geográfica se pospone. |
| [`implementacion-rol-interno.md`](./implementacion-rol-interno.md) | Guía de implementación del perfil Interno: fases, archivos y criterios de aceptación. Las migraciones se preparan para aplicación manual; el ajuste local agrega tipos, SLA del brief/diseño, paginación y creación de nuevos pendientes desde los archivados. |
| [`prototypes/internal-map/`](./prototypes/internal-map) | Nueve maquetas del mapa funcional, Listado, Archivo, formularios, detalle y estados. El mapa inicia con fondo gris; solo se pospone la imagen geográfica. Son autónomas y usan datos de ejemplo. |
| [`prototypes/events-inventory/`](./prototypes/events-inventory) | Siete maquetas del inventario de Eventos (tabla, formulario, actividad, estados, móvil, modelo y decisiones). Mapeadas en [`plan-inventario-eventos.md` §5](./plan-inventario-eventos.md#5-mapa-de-maquetas). Mismo aviso sobre `support.js` que las demás. |
| [`prototypes/events-schedule/`](./prototypes/events-schedule) | Ocho maquetas de la programación de eventos (calendario mensual y semanal, agenda móvil, listado, ficha, formulario con varias tiendas, estados y decisiones). Mapeadas en [`plan-eventos-programacion.md` §9](./plan-eventos-programacion.md#9-vistas-cliente-propuesta-de-ui). Mismo aviso sobre `support.js`. |
| [`prototypes/design-role/`](./prototypes/design-role) | Ocho maquetas del perfil Design y de los cambios en Social Media (cola, historial, ficha, instrucciones, revisión). Mapeadas a fases en [`plan-rol-design.md` §8.1](./plan-rol-design.md#81-maquetas-de-referencia). El marco de layout es ilustrativo y no coincide con los colores implementados. |
| [`plan-solicitudes-diseno.md`](./plan-solicitudes-diseno.md) | Especificación funcional del módulo de solicitudes de Diseño (histórico y operativo): alcance, estados, historial, vinculación futura, integración con Diseño y restricciones de UI para no alterar las vistas existentes (§11.1) y registro de decisiones D-01 a D-22. Propuesta para revisión; sin código ni migración. |
| [`plan-datos-solicitudes-diseno.md`](./plan-datos-solicitudes-diseno.md) | Modelo de datos, restricciones, catálogos, auditoría, matriz de permisos, RLS y objetos remotos por comprobar para ese módulo. Propuesta; el SQL incluido es ilustrativo. |
| [`plan-importacion-solicitudes-diseno.md`](./plan-importacion-solicitudes-diseno.md) | Mapeo de las 22 columnas de la hoja histórica, reglas de normalización, identidades, entregables, idempotencia, conciliación y criterios para autorizar la importación. Propuesta; la hoja no se pudo inspeccionar. |
| [`roadmap-solicitudes-diseno.md`](./roadmap-solicitudes-diseno.md) | Fases F0–F8, dependencias, riesgos y plan de pruebas del módulo de solicitudes de Diseño. |

## Cómo leer los prototipos

- Cada `*.dc.html` es una pantalla de tamaño fijo. Usan los tokens de `tailwind.config.ts` (azul `#0066D2`, azul oscuro `#002F80`, tinta `#10233F`, hueso `#FAF8F4`, borde `#E7E4DC`) y la fuente Inter.
- Los estilos están en línea dentro de cada archivo. No dependen de Tailwind ni de componentes del repo, así que sirven como referencia visual, no como código para copiar.
- Los archivos incluyen `<script src="./support.js">` y las etiquetas `<x-dc>` del lienzo donde se crearon. **No se verificó que se rendericen fuera de ese lienzo.** Si necesitas verlos en el navegador, ábrelos desde el lienzo o quita esas dos líneas.
- No hay capturas exportadas. Cuando una pantalla se implemente, conviene guardar una captura en `docs/design/screenshots/` para comparar.

## Fuente de verdad

1. Base desplegada: manda sobre cualquier documento; su estado solo se considera verificado con una consulta o evidencia actual del proyecto remoto.
2. `modales-publicacion.md`: decisiones confirmadas y alcance de implementación.
3. Prototipos: apariencia. Si difieren del documento, gana el documento.

## Uso con Codex

1. Lee este README y `modales-publicacion.md` completos antes de empezar.
2. Los prototipos indican diseño objetivo; comprueba el estado de cada capacidad en `modales-publicacion.md` antes de implementarla.
3. Cada pantalla corresponde a un archivo de `prototypes/` (tabla de la sección 3 del documento) y a un componente actual o nuevo indicado en la sección 1.
4. No añadas lo marcado como fuera de alcance (sección 7). Antes de cambiar la base, parte de `supabase db pull` y revisa constraints, triggers, funciones y políticas desplegados.
5. Al terminar una pantalla, actualiza la columna **Estado** de la tabla de campos.

## Alcance actual

_Estado al 2026-10-21 (`main`, `6d911ac`), contrastado con el código y las migraciones del repositorio. El estado del proyecto remoto solo se afirma cuando el usuario lo reportó._

**Design.** La cola (`/design/publications`), el historial (`/design/publications/history`) y la ficha única (`/design/requests/[source]/[id]`) atienden Social Media, Interno y Eventos. Las rutas anteriores redirigen a las comunes. La ficha incluye asignación al abrir, carga directa resumible a `Entregables`, entrega y reapertura de correcciones para los tres orígenes; Eventos crea su carpeta raíz de Drive al abrir una solicitud activa que aún no tenga una. La UI del prototipo se restableció en las tandas U0–U3 de [`plan-restablecer-ui-design.md`](./plan-restablecer-ui-design.md). Las RPC de lectura aún no devuelven algunos datos (diseñador en Eventos, motivo de cancelación, actor de la línea de tiempo, campaña y temas); la UI los omite.

**Base remota.** El historial remoto confirmado por el usuario incluye las migraciones hasta `20261021030127`, incluida `20261020011400_design_request_details.sql`. La migración `20261021030128_event_brief_design_corrections.sql` (correcciones de Interno y Eventos, carga del brief opcional de Eventos) está en el repositorio y figura como pendiente de aplicar. Siguen pendientes la conciliación con `supabase db pull` de `202610150001_events_schedule.sql` y la confirmación de `set_publication_design_requirement` y su trigger.

**Social Media.** En Editar quedan inactivas las pestañas **Producción** e **Historial**. Social Media define instrucciones para Design y revisa las entregas desde el modal. **Archivo** permite restaurar publicaciones y resolver manualmente fallos de limpieza. **Brief** cuenta con carga directa resumible a Drive y la solicitud validada con retorno a `PENDIENTE_BRIEF`; consulta `plan-validacion-brief-drive.md` para sus límites y `modales-publicacion.md` para el alcance de cada modal.
