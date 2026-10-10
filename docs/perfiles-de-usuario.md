# Perfiles de usuario

Este documento describe quién usa Kromi Connect, qué necesita resolver y cómo esas necesidades orientan los flujos y la interfaz. Es una referencia funcional viva para el desarrollo: se amplía conforme se investigan y construyen perfiles nuevos.

## Cómo usar y mantener este documento

- Describe necesidades, tareas y experiencia de uso; no concede acceso técnico.
- Los roles y permisos efectivos se documentan en la [sección 7 del SRS](kromi-connect-srs.md) y en las migraciones Supabase. Antes de implementar una acción, confirmar allí los permisos vigentes.
- Mantener explícita la diferencia entre lo observado/implementado, lo definido como objetivo y lo que sigue pendiente de validar.
- Actualizar la ficha del perfil cuando cambien sus flujos o se añadan módulos relevantes. Registrar decisiones pendientes en vez de completar vacíos con supuestos.

## Estado de perfiles

| Perfil funcional | Estado de definición | Referencia de rol de acceso | Nota |
|---|---|---|---|
| Social Media / Responsable de Redes Sociales | Descrito; es el perfil que guía el desarrollo actual | `social-media` | Perfil funcional más desarrollado; alcance y estado por módulo en el SRS. |
| Eventos | Por definir | `events` | El rol está enumerado; tareas, flujos y necesidades de interfaz no están especificados. |
| Diseño | Por definir | `design` | El rol está enumerado y se menciona colaboración con Social Media; falta una ficha funcional propia. |
| Interno | Por definir | `internal` | El rol está enumerado; falta precisar a quién representa y qué tareas realiza. |
| Atención al cliente | Por definir | `customer-support` | El rol está enumerado; falta definir alcance, relación con escucha social y flujos de `/support`. |
| Gerencia | Por definir | `management` | El rol está enumerado; falta especificar decisiones, indicadores y vistas requeridas. |

`pending` y `admin` son roles de acceso descritos en el SRS, no perfiles funcionales de producto en este documento. El primero representa una cuenta que aún no tiene acceso habilitado; el segundo gestiona acceso. No se deben tratar como personas usuarias con necesidades operativas equivalentes a las fichas anteriores.

## Perfil: Social Media / Responsable de Redes Sociales

**Estado:** perfil de referencia para la Fase 1. El sistema y su interfaz se han desarrollado principalmente para este perfil. La cobertura real de sus funciones varía por módulo; consultar la auditoría del [SRS](kromi-connect-srs.md) antes de considerar una función terminada.

### Propósito

Planificar y coordinar la presencia de marca en redes sociales, desde la planificación de contenido y la preparación de briefs hasta el seguimiento de producción, campañas y resultados.

### Responsabilidades documentadas

- Planificar el calendario mensual de contenido.
- Redactar briefs y copys.
- Coordinar rodajes en sedes, documentadas como Prebo y Mañongo.
- Gestionar solicitudes de terceros.
- Dar seguimiento a entregas de diseño y sus SLA.
- Revisar métricas y atender escucha social.

Estas responsabilidades corresponden al alcance funcional descrito en la sección 1 del [SRS](kromi-connect-srs.md). La auditoría del SRS marca varias de ellas como parciales o pendientes; su inclusión aquí no afirma que estén implementadas de extremo a extremo.

### Interacciones principales

- **Diseño:** preparar briefs y assets para revisión y aprobación. El flujo previsto se detalla en el SRS; la edición completa del brief y el QA/aprobación tienen brechas documentadas.
- **Eventos, sedes y terceros:** coordinar rodajes y solicitudes relacionadas con campañas y contenido. El alcance específico para esos otros perfiles todavía debe definirse.
- **Cuentas sociales:** organizar publicaciones para cuentas asignadas. Las reglas de asignación y alcance están descritas en [Publicaciones por cuenta social](publicaciones-por-cuenta-social.md).

### Áreas de producto relacionadas

El SRS relaciona este perfil con calendario/Grid, Kanban, solicitudes, rodaje, campañas, efemérides y escucha social. La disponibilidad y madurez no son uniformes: algunas rutas carecen actualmente de permisos concedidos y algunas tablas todavía no tienen consumidor de interfaz. La lista de permisos efectivos está en §7.3 del [SRS](kromi-connect-srs.md); el estado funcional está en §6 del mismo documento.

### Límites conocidos del acceso actual

El rol `social-media` cuenta con permisos aprobados para Grid, publicaciones, campañas y efemérides. No asumir que el nombre del perfil habilita automáticamente Kanban, solicitudes, rodaje, soporte o terceros: el SRS indica que esas rutas no tienen concesiones actuales. Además, las publicaciones tienen alcance por cuentas asignadas, según el documento de publicaciones por cuenta social.

### Preguntas por resolver

- Precisar qué decisiones puede tomar el perfil en el flujo de QA y aprobación de diseño.
- Definir el flujo completo de briefing, revisiones, SLA y entrega de assets.
- Confirmar el alcance de escucha social y su relación con Atención al cliente.
- Validar qué módulos deben ser centrales en la navegación de este perfil y cuáles son tareas ocasionales.

## Fichas futuras

Crear una ficha para cada perfil cuando haya información suficiente. Como mínimo, registrar propósito, responsabilidades, tareas frecuentes, áreas de producto necesarias, interacciones con otros perfiles, límites/decisiones, estado de implementación y preguntas abiertas. Las etiquetas de rol actuales sirven como inventario inicial, no como especificaciones funcionales completas.
