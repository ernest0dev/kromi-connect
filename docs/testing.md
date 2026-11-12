# Pruebas y verificaciones

## Comandos

```bash
pnpm test
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm test` ejecuta Jest en serie para mantener la suite local predecible y excluye `tests/integration/`. Incluye tests unitarios/locales en `tests/` y los tests Jest colocados junto al código de `src/`. No requiere acceso a Google Drive ni a APIs remotas. El test Python local, que sustituye el cliente REST por un mock, se ejecuta por separado con:

```bash
python -m pip install tzdata==2026.6
python -m unittest discover -s tests -p "test_*.py"
```

En Windows, `tzdata` proporciona los datos IANA para `America/Caracas`, que `zoneinfo` necesita en esta prueba. Los fixtures usan un directorio temporal y cierran el archivo antes de que el código bajo prueba lo vuelva a abrir.

`pnpm test:integration` usa `jest.integration.config.js` para seleccionar explícitamente `tests/integration/**/*.test.ts`. La configuración requerida para este caso es:

- `NEXT_PUBLIC_SUPABASE_URL` apuntando a `localhost`, `127.0.0.1` o `::1`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` y una cuenta local autenticada con permiso `social-media.posts.create` para la acción.
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` y credenciales OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) o credenciales de cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL` o `GOOGLE_CLIENT_EMAIL`, más `GOOGLE_PRIVATE_KEY`).

Las variables pueden cargarse desde `.env.local`, que Jest/Next carga para esta configuración. No guardes credenciales en el repositorio. Si faltan variables requeridas, la suite falla en `beforeAll` con los nombres de configuración ausentes. Si Supabase apunta a un host remoto, la prueba falla antes de llamar a la acción.

La integración existente `tests/integration/googleDriveAction.test.ts` invoca una acción que crea una carpeta real en Drive y una publicación en Supabase, y puede añadir permisos de lectura pública a esa carpeta. Esta prueba real no se ha ejecutado durante F0; `--listTests` solo confirma qué archivo selecciona Jest. Usa solo recursos de prueba y una instancia Supabase local aislada. La acción necesita una sesión Supabase de un usuario local autorizado; Jest por sí solo no establece el contexto de cookies de una petición Next, así que hace falta un harness de petición autenticada real antes de poder validar esta llamada (no se debe simular la autorización). El usuario debe tener permiso `social-media.posts.create` y al menos una cuenta social activa y asignada. El fixture actual tampoco envía `social_account_ids`, obligatorio para la acción; hay que añadir el ID local asignado al input de prueba. Hasta completar esos requisitos, un fallo no cuenta como validación de la integración.

El resto de los tests de Jest no usa servicios externos. Los tests de inventario/RPC usan datos de entrada locales; el test de la página de historial inyecta un cliente Supabase simulado; el de importación Python simula las peticiones REST. Ningún otro test existente se clasificó como integración real. Los specs de Playwright bajo `e2e/` siguen disponibles mediante `pnpm test:e2e` y no se mezclan con Jest.

## Tipo de comprobación

- `pnpm test`: Jest local, excluyendo integración real.
- `pnpm test:integration`: solo tests bajo `tests/integration/`.
- Python: `unittest` local, separado de Jest.
- `pnpm typecheck`: `tsc --noEmit --incremental false`; no escribe archivos de salida ni actualiza el cache incremental.
- `pnpm lint`: ESLint según `eslint.config.mjs`.
- `pnpm build`: build de producción con Next.js.

La referencia de rutas vigente se encuentra en [docs/architecture/routes-baseline.md](architecture/routes-baseline.md).
