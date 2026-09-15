# Resumen de Implementación de UI y Capacidades de Kromi Connect

Este documento detalla la estructura de vistas, componentes y funcionalidades activas dentro del ecosistema de **Kromi Connect**.

---

## 🚀 Vistas Principales y Funcionalidades

### 1. Gestión de Solicitudes (`/requests`)
* **Visualización Dinámica:** Mapeo de solicitudes de contenido con filtros por estado y formato.
* **Aprovisionamiento Automatizado:** Invocación del modal `NewTicketModal` para el registro de publicaciones.
* **Estructuración de Copy:** Captura granular de Hook, Cuerpo del mensaje, Call to Action (CTA) y Hashtags.
* **Integración Automatizada:** Generación automática de carpetas en Google Drive API vinculadas directamente al registro en Supabase.

### 2. Flujo Operativo Kanban (`/kanban`)
* **Ciclo de Vida del Contenido:** Distribución visual en columnas según el estatus (`PENDIENTE_BRIEF`, `POR_DISENAR`, `EN_REVISION`, `APROBADO`, `PROGRAMADO`, `PUBLICADO`).
* **Acceso Directo a Assets:** Enlace directo en cada tarjeta a la carpeta asignada en Google Drive para la gestión de recursos multimedia por parte del equipo creativo.

### 3. Coordinación de Rodajes (`/shooting`)
* **Planificación de Campo:** Filtro de entregables que requieren captura de footage en sitio (Reels, Stories, coberturas especiales).
* **Control de Producción:** Seguimiento del estado del material previo a la fase de postproducción y edición.

### 4. Planificación Visual Grid (`/grid`)
* **Vista Previa de Feed:** Maquetación gráfica de los contenidos ordenados cronológicamente por su fecha de publicación.
* **Sincronización Estética:** Verificación de la línea gráfica antes de la programación final en redes sociales.

---

## 🛠️ Arquitectura de Backend e Infraestructura

* **Google Drive API v3:** Creación automatizada de carpetas en Google Cloud con permisos de lectura para previsualización de assets.
* **Base de Datos Supabase:** Persistencia en PostgreSQL administrada mediante Server Actions y revalidación de caché en Next.js App Router.
* **Suite de Pruebas:**
  * Pruebas de Integración con Jest (`npm run test:integration`).
  * Pruebas End-to-End con Playwright (`npm run test:e2e`).
* **Sincronización CI/CD:** Control de dependencias alineado con `pnpm-lock.yaml` para despliegues automatizados en Vercel.
