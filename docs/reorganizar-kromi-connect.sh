#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Kromi Connect — Script de reorganización de estructura
# Ejecutar desde la raíz del repo (~/Escritorio/Repositorios/kromi-connect)
# Compatible con Git Bash en Windows (desactiva conversión de rutas MSYS)
# ============================================================

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

echo "== 0. Crear rama de trabajo =="
git checkout -b chore/reorganize-structure

APP_DASH="src/app/(dashboard)"
ACTIONS="src/app/actions"

echo "== 1. Crear carpetas nuevas =="
mkdir -p "$APP_DASH/social-media/campaigns"
mkdir -p "$APP_DASH/social-media/grid"
mkdir -p "$APP_DASH/social-media/kanban"
mkdir -p "$APP_DASH/social-media/requests"
mkdir -p "$APP_DASH/social-media/shooting"
mkdir -p "$APP_DASH/social-media/components"
mkdir -p "$ACTIONS/publicaciones"
mkdir -p "$ACTIONS/solicitudes"
mkdir -p "$ACTIONS/campanas"
mkdir -p "$ACTIONS/support"
mkdir -p "$ACTIONS/third-parties"

echo "== 2. Mover rutas a social-media/ (archivo por archivo, sin carpetas temporales) =="
git mv "$APP_DASH/campaigns/page.tsx" "$APP_DASH/social-media/campaigns/page.tsx"
git mv "$APP_DASH/campaigns/CampaignsClientView.tsx" "$APP_DASH/social-media/campaigns/CampaignsClientView.tsx"
rmdir "$APP_DASH/campaigns"

git mv "$APP_DASH/grid/page.tsx" "$APP_DASH/social-media/grid/page.tsx"
git mv "$APP_DASH/grid/GridClientView.tsx" "$APP_DASH/social-media/grid/GridClientView.tsx"
rmdir "$APP_DASH/grid"

git mv "$APP_DASH/kanban/page.tsx" "$APP_DASH/social-media/kanban/page.tsx"
git mv "$APP_DASH/kanban/KanbanClientView.tsx" "$APP_DASH/social-media/kanban/KanbanClientView.tsx"
rmdir "$APP_DASH/kanban"

git mv "$APP_DASH/requests/page.tsx" "$APP_DASH/social-media/requests/page.tsx"
git mv "$APP_DASH/requests/RequestsClientView.tsx" "$APP_DASH/social-media/requests/RequestsClientView.tsx"
rmdir "$APP_DASH/requests"

git mv "$APP_DASH/shooting/page.tsx" "$APP_DASH/social-media/shooting/page.tsx"
git mv "$APP_DASH/shooting/ShootingClientView.tsx" "$APP_DASH/social-media/shooting/ShootingClientView.tsx"
rmdir "$APP_DASH/shooting"

git mv "$APP_DASH/components/NewTicketModal.tsx" "$APP_DASH/social-media/components/NewTicketModal.tsx"
# DndWrapper.tsx se queda donde está (genérico, usado por grid)

echo "== 3. Mover y renombrar Server Actions =="
git mv "$ACTIONS/createPostWithDrive.ts" "$ACTIONS/publicaciones/create.ts"
git mv "$ACTIONS/recalculateSlaDates.ts" "$ACTIONS/publicaciones/recalculateSla.ts"
git mv "$ACTIONS/shooting.ts" "$ACTIONS/publicaciones/shooting.ts"
git mv "$ACTIONS/requests.ts" "$ACTIONS/solicitudes/convert.ts"
git mv "$ACTIONS/campaigns.ts" "$ACTIONS/campanas/campaigns.ts"
git mv "$ACTIONS/customerSupport.ts" "$ACTIONS/support/customerSupport.ts"
git mv "$ACTIONS/thirdParties.ts" "$ACTIONS/third-parties/thirdParties.ts"

echo "== 4. Eliminar legacy confirmado muerto =="
git rm "$ACTIONS/tickets.ts"

echo "== 5. posts.ts: NO eliminar todavía =="
echo "   -> test-actions/page.tsx todavía lo importa."
echo "   -> Editar test-actions/page.tsx manualmente para usar publicaciones/create.ts,"
echo "      luego: git rm '$ACTIONS/posts.ts'"

echo ""
echo "== 6. Buscar imports rotos que quedaron con ruta vieja =="
echo "   (revisar manualmente cada resultado y corregir el import)"
grep -rn "app/actions/createPostWithDrive" src/ || true
grep -rn "app/actions/recalculateSlaDates" src/ || true
grep -rn "app/actions/shooting" src/ || true
grep -rn "app/actions/requests" src/ || true
grep -rn "app/actions/campaigns" src/ || true
grep -rn "app/actions/customerSupport" src/ || true
grep -rn "app/actions/thirdParties" src/ || true
grep -rn "(dashboard)/campaigns/\|(dashboard)/grid/\|(dashboard)/kanban/\|(dashboard)/requests/\|(dashboard)/shooting/" src/ || true
grep -rn "NewTicketModal" src/ || true

echo ""
echo "== 7. Verificar build =="
echo "   pnpm build"
echo "   pnpm lint"

echo ""
echo "Listo. Revisa 'git status' y 'git diff' antes de commitear."
