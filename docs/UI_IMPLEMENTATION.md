# Implementación de UI y capacidades

> Estado revisado el 2026-10-21 contra el código y las migraciones locales (`main`, `6d911ac`). La documentación describe la implementación del repositorio; la aplicación real de migraciones remotas solo se afirma cuando el usuario la reportó.

## Publicaciones y Grid

La ruta principal es `/social-media/grid`. Social Media crea, consulta, edita, reprograma, archiva y restaura publicaciones. Los modales están en `src/app/(dashboard)/social-media/components/NewTicketModal.tsx` y `src/app/(dashboard)/social-media/grid/components/`; el detalle se compone desde `GridView.tsx`. La vista Archivo está bajo `src/app/(dashboard)/social-media/grid/archive/`.

El modelo admite cuentas destino y categorías relacionales, copy por Hook/Cuerpo/CTA/hashtags, formatos POST/CARRUSEL/REEL/STORY, fechas y horas, producción/rodaje, estados y registro de historial. `REEL` se etiqueta “Short” para YouTube y “Reel” para Instagram/TikTok. El campo legado `linea_contenido` aún existe; la revisión completa de categorías queda pendiente.

### Brief en Google Drive

- Crear publicación genera su estructura de Drive; los archivos de Brief se suben directamente desde el navegador a la carpeta `Brief`, con sesiones resumibles coordinadas por servidor. El contenido no pasa por una petición a Vercel ni se almacena en Supabase.
- La UI de crear (tras guardar), editar y detalle lista metadatos y enlaces para abrir archivos. Tipos permitidos por política operativa: JPG/JPEG, PNG, WebP, PDF y MP4; máximo 100 MB por archivo y 10 existentes o reservados por publicación. No hay inspección de firma/antimalware, preview embebido ni borrado desde Kromi.
- La solicitud a Design es validada por acción de servidor contra el contenido real de Drive. La RPC `request_publication_to_design` es solo para `service_role`; la transición genérica no permite establecer `SOLICITADO`.
- Design ve los archivos de `Brief` (solo lectura) y de `Entregables` en la ficha de la solicitud y carga el entregable final desde la app, con sesión resumible directa a Drive (varios archivos, hasta 500 MB cada uno). El servidor exige un archivo en `Entregables` creado después del último paso a `EN_DISENO` al entregar.
- Instrucciones para Design: texto libre obligatorio al solicitar cuando `requiere_diseno` es verdadero; se editan solo en `PENDIENTE_BRIEF` o `EN_RODAJE`. Los ajustes posteriores llegan como corrección.

## Flujo de estados

`PENDIENTE_BRIEF` y, cuando corresponde, `EN_RODAJE` son etapas previas. Si la publicación requiere diseño (valor predeterminado), Social Media solicita a Design con Brief verificado; Design abre (`EN_DISENO`), entrega (`EN_REVISION_CM`), Social Media devuelve con observación obligatoria (`EN_CORRECCION`) o continúa hacia aprobación/programación/publicación. Design vuelve a `EN_DISENO` al abrir una corrección. Social Media puede cancelar desde cualquier estado activo con motivo obligatorio. Antes de que Design abra, Social Media puede regresar `SOLICITADO` a `PENDIENTE_BRIEF`; se limpia la fecha del ciclo vigente y se conserva el evento en historial.

Si `requiere_diseno = false`, el Brief es opcional y no se usa la cola de Design ni se aplican sus SLA. Social Media puede pasar de `PENDIENTE_BRIEF` a `PENDIENTE_APROBACION_GERENCIA` si no hay rodaje, o pasar por `EN_RODAJE` y luego a aprobación. “Por aprobación” representa una decisión externa; el rol Gerencia no tiene interfaz en esta etapa.

## Design

Design trabaja con **una sola cola, un solo historial y una sola ficha** para tres orígenes: Social Media, Interno y Eventos.

- **Cola:** `/design/publications`, con secciones "Por tomar" y "En curso", filtro Todas/Mías y filtro por origen. Incluye publicaciones `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION` que requieren diseño, y las solicitudes equivalentes de pendientes de Interno y de eventos.
- **Historial:** `/design/publications/history`, tabla con diseñador, plazo (SLA), estado y paginación; cada fila enlaza a la ficha.
- **Ficha:** `/design/requests/[source]/[id]` con `source` en `social_media`, `internal` o `events`. Las rutas anteriores (`/design/publications/[id]`, `/design/internal`, `/design/internal/[id]`, `/design/internal/history`, `/design/events/[id]`) redirigen a las comunes.
- **Acciones:** tomar y abrir (queda registrado el diseñador y se conserva tras las correcciones), cargar entregables, entregar y reabrir una corrección. Los datos y reglas de visibilidad por origen se adaptan en `src/lib/designRequests.ts`.
- **Límites conocidos:** la UI omite el nombre del diseñador en Eventos, el motivo de cancelación en el historial, el actor en la línea de tiempo y la campaña/temas en Social Media, porque las RPC actuales no los devuelven. No hay reasignación entre diseñadores, versionado ni vista previa embebida.

Detalle en [`design/plan-rol-design.md`](design/plan-rol-design.md), [`design/plan-ficha-unica-design.md`](design/plan-ficha-unica-design.md) y [`design/plan-restablecer-ui-design.md`](design/plan-restablecer-ui-design.md).

## Eventos

`/events/calendar` es la programación (calendario mensual y semanal); `/events/calendar/list` y `/events/calendar/archive` son sus vistas de listado y archivo, y `/events/list`, `/events/archive` y `/events` redirigen a ellas. `/events/inventory` es el inventario compartido por sede. Un evento puede solicitar diseño a Design (formato digital o impresión, instrucciones, fecha de entrega, brief opcional en Drive), con corrección y retiro de la solicitud; ver [`design/plan-eventos-diseno.md`](design/plan-eventos-diseno.md).

## Interno

`/internal/pendientes` muestra el mapa funcional de tiendas con los pendientes del usuario; `/internal/pendientes/archive` es el archivo. Cada pendiente puede guardar un brief en Drive y solicitar diseño a Design (impresiones u otras piezas). El rol Interno también accede al inventario de Eventos. Ver [`design/plan-rol-interno.md`](design/plan-rol-interno.md) y [`design/implementacion-rol-interno.md`](design/implementacion-rol-interno.md).

## Otras rutas

Campañas y efemérides están bajo `/social-media/campaigns` y `/social-media/efemerides`. Existen además rutas para Kanban, rodaje, solicitudes de terceros, soporte y directorio de terceros; su disponibilidad visual no garantiza acceso: las concesiones efectivas dependen de permisos sembrados y policies. Revisar `kromi-connect-srs.md` §7 y las migraciones antes de afirmar que un rol puede usarlas.

## Fuente y límites

La implementación se determina por `src/app/`, `src/app/actions/`, `src/lib/` y `supabase/migrations/`. Los archivos de `docs/design/prototypes/` son referencias visuales, no evidencia de funciones activas. Para el detalle de decisiones y migraciones consultar el [SRS](kromi-connect-srs.md), [perfiles](perfiles-de-usuario.md), [migraciones Supabase](supabase-db-migration.md) y [diseño de modales](design/modales-publicacion.md).
