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
| [`plan-eventos-programacion.md`](./plan-eventos-programacion.md) | Plan del módulo de programación de eventos del perfil Eventos: datos, varias tiendas, estados automáticos por hora, reglas, modelo, permisos, funciones, vistas y decisiones. Con propuesta de migración sin aplicar y sin código de la aplicación. |
| [`prototypes/events-inventory/`](./prototypes/events-inventory) | Siete maquetas del inventario de Eventos (tabla, formulario, actividad, estados, móvil, modelo y decisiones). Mapeadas en [`plan-inventario-eventos.md` §5](./plan-inventario-eventos.md#5-mapa-de-maquetas). Mismo aviso sobre `support.js` que las demás. |
| [`prototypes/events-schedule/`](./prototypes/events-schedule) | Ocho maquetas de la programación de eventos (calendario mensual y semanal, agenda móvil, listado, ficha, formulario con varias tiendas, estados y decisiones). Mapeadas en [`plan-eventos-programacion.md` §9](./plan-eventos-programacion.md#9-vistas-cliente-propuesta-de-ui). Mismo aviso sobre `support.js`. |
| [`prototypes/design-role/`](./prototypes/design-role) | Ocho maquetas del perfil Design y de los cambios en Social Media (cola, historial, ficha, instrucciones, revisión). Mapeadas a fases en [`plan-rol-design.md` §8.1](./plan-rol-design.md#81-maquetas-de-referencia). El marco de layout es ilustrativo y no coincide con los colores implementados. |

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

_Estado local al 2026-10-12: las mejoras descritas en [`plan-rol-design.md`](./plan-rol-design.md) están implementadas en el workspace; la migración `202610120001` aún no está aplicada ni verificada en Supabase remoto._

En Editar quedan inactivas las pestañas **Producción** e **Historial**. La cola Design está en `/design/publications` y ahora incluye ficha, asignación al abrir, carga directa resumible a `Entregables` e historial. Social Media puede definir instrucciones y revisar las entregas desde el modal. Estas capacidades requieren aplicar `202610120001_design_profile.sql` antes de usarse. **Archivo** permite restaurar publicaciones y resolver manualmente fallos de limpieza. **Brief** ya cuenta con carga directa resumible a Drive; consulta `plan-validacion-brief-drive.md` para sus límites y `modales-publicacion.md` para el alcance de cada modal.
