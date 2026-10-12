# Diseño de interfaz

Esta carpeta guarda las decisiones de diseño que no caben en el código: qué muestra cada pantalla, de dónde sale cada dato y qué falta por construir.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| [`modales-publicacion.md`](./modales-publicacion.md) | Especificación de Crear, Editar, Detalle, Archivo y la sección Brief: campos, permisos, flujo confirmado, migraciones y alcance. |
| [`plan-validacion-brief-drive.md`](./plan-validacion-brief-drive.md) | Decisiones, arquitectura y estado de implementación del brief con Drive y retorno `SOLICITADO → PENDIENTE_BRIEF`. |
| [`plan-rol-design.md`](./plan-rol-design.md) | Plan por fases del perfil Design completo: instrucciones obligatorias, auto-asignación, carga de entregables en la app, historial y revisión por Social Media. |
| [`prototypes/`](./prototypes) | Maquetas HTML + CSS de cada artboard (un archivo `.dc.html` por pantalla) y `canvas.json` con su posición en el lienzo. |

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

En Editar quedan inactivas las pestañas **Producción** e **Historial**. La cola Design está en `/design/publications`, permite consultar listas de Brief y Entregables, abrir solicitudes y entregar piezas; la carga final sigue en Drive y no hay asignación individual. **Archivo** permite restaurar publicaciones y resolver manualmente fallos de limpieza. **Brief** ya cuenta con carga directa resumible a Drive, listado de archivos y solicitud validada; consulta `plan-validacion-brief-drive.md` para sus límites y `modales-publicacion.md` para el alcance de cada modal. La opción de publicación sin Design está descrita en esos documentos y su migración local es `202610110002_publication_design_requirement.sql`.
