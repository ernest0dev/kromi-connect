# Documentación Técnica: Lógica de Negocio y Server Actions

## 1. Resumen de Implementación

Se construyó la capa de servidor de Kromi Connect sobre Next.js (App Router), utilizando Server Actions como mecanismo exclusivo de mutación de datos —sin exposición de rutas API REST intermedias—. Esta capa concentra tres responsabilidades funcionales:

1. Gestión del ciclo de vida de publicaciones (`publicaciones`), incluyendo creación, actualización de fechas y transición de estatus.
2. Automatización del cálculo de fechas límite de producción (Regla SLA 3+2), aislada como lógica pura desacoplada del acceso a datos.
3. Integración con Google Drive API para la generación automática de estructuras de carpetas por ticket de contenido, con persistencia de los metadatos resultantes en Supabase.

Toda escritura contra la base de datos se ejecuta a través de un cliente administrativo de Supabase con Service Role Key, restringido al entorno de servidor.

---

## 2. Definición y Tipado de Módulos (`src/types/`)

La arquitectura de tipos del sistema se organiza en módulos independientes bajo `src/types/`, cada uno con una responsabilidad delimitada:

- **`enums.ts`**: define en TypeScript los dominios controlados equivalentes a los tipos enumerados del esquema (formato, estatus, tipo de campaña, departamento emisor, canal, sede), garantizando coherencia de valores entre cliente y servidor.
- **`publicaciones.ts`**: define las interfaces de dominio para la entidad central `publicaciones` y sus relaciones directas (canales de publicación, checklist de rodaje), incluyendo los tipos de entrada (payloads) consumidos por las Server Actions.
- **`database.types.ts`**: contiene el tipado estructural generado/mantenido a partir del esquema de Supabase, utilizado para tipar las respuestas del cliente de base de datos.
- **`index.ts`**: punto de exportación unificado (Barrel Export) que reexporta el contenido de los módulos anteriores, permitiendo que el resto de la aplicación importe tipos mediante una única ruta (`@/types`) sin necesidad de referenciar archivos individuales.

Esta separación desacopla el tipado de dominio (`publicaciones.ts`, `enums.ts`) del tipado de infraestructura (`database.types.ts`), evitando que cambios en la generación automática del esquema de base de datos propaguen modificaciones directas sobre los tipos de negocio consumidos por los componentes de UI.

---

## 3. Módulo de Utilidades de SLA (`src/app/utils/sla.ts`)

Se implementó la función `calcularMatrizSLA` como unidad de lógica pura, sin efectos secundarios ni dependencias de acceso a datos.

**Responsabilidades de la función:**

- **Regla 3+2 (cálculo de `fecha_limite_brief`):** a partir de `fecha_publicacion`, se descuentan 5 días calendario para determinar la fecha límite de entrega de brief, representando la ventana combinada de 3 días de rodaje más 2 días de diseño contados hacia atrás desde la publicación.
- **Cálculo de `fecha_entrega_diseno_estimada`:** a partir de `fecha_solicitud_diseno`, se suman 2 días calendario para proyectar la fecha estimada de entrega de diseño.

**Criterio de diseño:** la función se mantiene aislada de cualquier llamada a Supabase u otro servicio externo. Esto permite ejecutar pruebas unitarias sobre la lógica de fechas de forma determinística, sin necesidad de mocks de base de datos ni de un entorno de ejecución de servidor.

---

## 4. Server Actions Implementadas (`src/app/actions/`)

### 4.1. `recalcularFechasSLAAction`

- **Propósito:** gestionar la actualización de fechas de una publicación existente y soportar la reprogramación en cascada ("Quick Reschedule"), donde el cambio de `fecha_publicacion` recalcula automáticamente las fechas derivadas.
- **Flujo de ejecución:**
  1. Lectura del registro actual de la publicación en Supabase.
  2. Recálculo de fechas derivadas mediante `calcularMatrizSLA`, tomando como entrada la nueva `fecha_publicacion`.
  3. Actualización atómica del registro en la tabla `publicaciones` con las fechas recalculadas.
  4. Invalidación de caché de la ruta `/parrilla` mediante `revalidatePath('/parrilla')`, forzando la regeneración de las vistas dependientes (Calendario, Kanban, Tabla).

### 4.2. `crearPublicacionConDriveAction`

- **Propósito:** ejecutar la creación completa de un ticket de publicación, incluyendo la integración con el almacenamiento en la nube para la organización de assets.
- **Flujo de ejecución:**
  1. Invocación de la integración con Google Drive API (`createTicketFolder`) para generar una subcarpeta dedicada al ticket, con convención de nombre `[TITULO]_[FORMATO]`.
  2. Captura de los metadatos devueltos por la API de Drive: `drive_folder_id` y `drive_folder_url`.
  3. Cálculo automático de `fecha_limite_brief` mediante `calcularMatrizSLA`, y asignación del estatus inicial `PENDIENTE_BRIEF`.
  4. Inserción atómica del registro en Supabase, mapeando la estructura granular de copy (`hook_texto`, `body_texto`, `cta_texto`, `hashtags`) junto con los metadatos de Drive obtenidos.
  5. Invalidación de caché de la ruta `/parrilla` mediante `revalidatePath('/parrilla')`.

### 4.3. `convertirSolicitudATicketAction`

- **Propósito:** ejecutar la ingesta y transformación de solicitudes externas registradas en `solicitudes_terceros`, convirtiéndolas en tickets operativos dentro de la parrilla de contenidos, mediante la creación del registro correspondiente en `publicaciones` y la actualización del estado de la solicitud de origen.

---

## 5. Integración y Seguridad

- **Cliente administrativo (`getSupabaseAdmin`):** las Server Actions que ejecutan operaciones de escritura utilizan un cliente de Supabase inicializado con Service Role Key, instanciado exclusivamente en contexto de servidor. Este cliente opera con bypass de las políticas de Row Level Security, delegando el control de acceso a la capa de Server Actions en lugar de a las políticas de base de datos para las operaciones administrativas del flujo de creación y actualización.
- **Manejo de tipos opcionales:** se aplicó manejo explícito de valores potencialmente indefinidos provenientes de respuestas externas (p. ej. `folderUrl ?? ''`) para prevenir errores de compilación de TypeScript y garantizar consistencia de tipos entre el resultado de la integración con Google Drive API y la estructura esperada por la tabla `publicaciones`.
