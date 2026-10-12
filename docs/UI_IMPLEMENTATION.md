# Implementación de UI y capacidades

> Estado revisado el 2026-10-12 contra el código y las migraciones locales. La documentación describe la implementación del repositorio; la aplicación real de migraciones remotas solo se afirma cuando el usuario la reportó.

## Publicaciones y Grid

La ruta principal es `/social-media/grid`. Social Media crea, consulta, edita, reprograma, archiva y restaura publicaciones. Los modales están en `src/app/(dashboard)/social-media/components/NewTicketModal.tsx` y `src/app/(dashboard)/social-media/grid/components/`; el detalle se compone desde `GridView.tsx`. La vista Archivo está bajo `src/app/(dashboard)/social-media/grid/archive/`.

El modelo admite cuentas destino y categorías relacionales, copy por Hook/Cuerpo/CTA/hashtags, formatos POST/CARRUSEL/REEL/STORY, fechas y horas, producción/rodaje, estados y registro de historial. `REEL` se etiqueta “Short” para YouTube y “Reel” para Instagram/TikTok. El campo legado `linea_contenido` aún existe; la revisión completa de categorías queda pendiente.

### Brief en Google Drive

- Crear publicación genera su estructura de Drive; los archivos de Brief se suben directamente desde el navegador a la carpeta `Brief`, con sesiones resumibles coordinadas por servidor. El contenido no pasa por una petición a Vercel ni se almacena en Supabase.
- La UI de crear (tras guardar), editar y detalle lista metadatos y enlaces para abrir archivos. Tipos permitidos por política operativa: JPG/JPEG, PNG, WebP, PDF y MP4; máximo 100 MB por archivo y 10 existentes o reservados por publicación. No hay inspección de firma/antimalware, preview embebido ni borrado desde Kromi.
- La solicitud a Design es validada por acción de servidor contra el contenido real de Drive. La RPC `request_publication_to_design` es solo para `service_role`; la transición genérica no permite establecer `SOLICITADO`.
- Design ve archivos de `Brief` y `Entregables` en su cola; la carga del entregable final sigue siendo manual en Drive. El servidor exige un archivo en `Entregables` al entregar.

## Flujo de estados

`PENDIENTE_BRIEF` y, cuando corresponde, `EN_RODAJE` son etapas previas. Si la publicación requiere diseño (valor predeterminado), Social Media solicita a Design con Brief verificado; Design abre (`EN_DISENO`), entrega (`EN_REVISION_CM`), Social Media devuelve con observación obligatoria (`EN_CORRECCION`) o continúa hacia aprobación/programación/publicación. Design vuelve a `EN_DISENO` al abrir una corrección. Social Media puede cancelar desde cualquier estado activo con motivo obligatorio. Antes de que Design abra, Social Media puede regresar `SOLICITADO` a `PENDIENTE_BRIEF`; se limpia la fecha del ciclo vigente y se conserva el evento en historial.

Si `requiere_diseno = false`, el Brief es opcional y no se usa la cola de Design ni se aplican sus SLA. Social Media puede pasar de `PENDIENTE_BRIEF` a `PENDIENTE_APROBACION_GERENCIA` si no hay rodaje, o pasar por `EN_RODAJE` y luego a aprobación. “Por aprobación” representa una decisión externa; el rol Gerencia no tiene interfaz en esta etapa.

## Design

`/design/publications` es una cola compartida filtrada a publicaciones `SOLICITADO`, `EN_DISENO` y `EN_CORRECCION` que requieren diseño. El rol puede abrir solicitudes y entregar piezas, y consultar las listas de Brief/Entregables. No hay asignación individual por `disenador_id`, edición del brief ni carga de archivos dentro de la app.

## Otras rutas

Campañas y efemérides están bajo `/social-media/campaigns` y `/social-media/efemerides`. Existen además rutas para Kanban, rodaje, solicitudes de terceros, soporte y directorio de terceros; su disponibilidad visual no garantiza acceso: las concesiones efectivas dependen de permisos sembrados y policies. Revisar `kromi-connect-srs.md` §7 y las migraciones antes de afirmar que un rol puede usarlas.

## Fuente y límites

La implementación se determina por `src/app/`, `src/app/actions/`, `src/lib/` y `supabase/migrations/`. Los archivos de `docs/design/prototypes/` son referencias visuales, no evidencia de funciones activas. Para el detalle de decisiones y migraciones consultar el [SRS](kromi-connect-srs.md), [perfiles](perfiles-de-usuario.md), [migraciones Supabase](supabase-db-migration.md) y [diseño de modales](design/modales-publicacion.md).
