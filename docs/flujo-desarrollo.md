# Flujo de desarrollo

Esta guía define el flujo operativo reproducible de Kromi Connect. No sustituye las migraciones versionadas de `supabase/migrations/` ni contiene valores de configuración sensibles.

## Ramas y pull requests

| Rama | Uso | Entrada |
| --- | --- | --- |
| `main` | Producción | Solo PR desde `dev` |
| `dev` | Integración y staging | PR desde `feature/*` o `fix/*` |
| `feature/*` | Funcionalidad nueva | Crear desde `dev` |
| `fix/*` | Corrección acotada | Crear desde `dev` |

No se hace push directo a `main` ni a `dev`. Actualiza la rama de trabajo con `origin/dev`, valida el cambio y abre un PR a `dev`. Tras la validación de integración, abre un PR de `dev` a `main` para producción.

## Límites de los entornos

| Entorno | Datos | Propósito | Límites |
| --- | --- | --- | --- |
| Local | Supabase local + `supabase/seed.sql` | Desarrollo y pruebas de cambios reales | Nunca requiere producción |
| Preview de `dev` | Fixtures de solo lectura | Demostración y revisión visual | No usa Supabase, Postgres, Google ni cron |
| Producción (`main`) | Supabase y servicios de producción | Operación real | Solo se configura y despliega desde `main` |

El preview de `dev` usa `KROMI_DATA_MODE=fixtures`. En este modo el proxy sirve la demostración en `/staging` para navegación de lectura y bloquea:

- Todas las rutas `/api/*`, incluso con `GET`.
- Toda solicitud que no sea `GET` o `HEAD`, incluidas autenticación y mutaciones.
- Accesos a Supabase, integración con Drive/Sheets y tareas programadas.

No se agregan credenciales ficticias ni variables de producción al preview. El modo `fixtures` es una demostración, no una réplica funcional de Supabase.

## Supabase local

Docker Desktop debe estar iniciado antes de trabajar con Supabase local. Desde la raíz del repositorio:

```bash
pnpm supabase:start
pnpm supabase:status
```

`supabase:start` levanta el stack local y `supabase:status` muestra su estado. No copies claves ni URLs de ese comando a documentación, commits o tickets.

Para reconstruir **solo** la base local desde las migraciones y el seed determinista:

```bash
pnpm supabase:reset
```

`supabase:reset` borra y recrea el estado local; no lo ejecutes contra un entorno remoto ni para preservar pruebas manuales. Las migraciones aplicables viven en `supabase/migrations/` y el seed local en `supabase/seed.sql`.

`.env.local` está ignorado por Git. Consérvalo únicamente en tu equipo, no lo subas ni lo copies al preview de `dev`. Las credenciales y configuraciones de producción se administran fuera del repositorio y no se reutilizan para desarrollo local o fixtures.

## Limitaciones conocidas

- Los módulos de `atencion_cliente` y `terceros` están deshabilitados temporalmente. No se reactivan ni se inventa persistencia hasta recuperar DDL/migraciones autorizadas.
- El contenedor auxiliar local `supabase_vector_kromi-connect` puede reiniciarse por un problema de conexión de analítica/logs. No bloquea la base, API, Auth ni Studio locales.

## Rutina diaria

1. Actualiza `dev` y crea `feature/<tema>` o `fix/<tema>`.
2. Inicia Docker y, si el cambio toca datos, levanta Supabase local con `pnpm supabase:start`.
3. Implementa y valida el cambio localmente; usa `pnpm supabase:reset` solo cuando necesites reconstruir el estado local.
4. Ejecuta las comprobaciones aplicables y abre un PR a `dev`.
5. Revisa el preview de `dev` como demostración de fixtures de solo lectura; las operaciones reales se prueban contra Supabase local.
6. Después de integrar en `dev`, promueve a `main` únicamente mediante PR cuando el cambio esté listo para producción.
