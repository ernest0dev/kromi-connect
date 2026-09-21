import { test, expect } from '@playwright/test';

test.describe('Kromi Connect - Flujo E2E de Producción', () => {
  test('debe registrar solicitud, verificar en Kanban, Shooting y Grilla Macro', async ({ page }) => {
    // 1. Inbox de Solicitudes
    await page.goto('/social-media/requests', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/social-media/requests');

    // 2. Tablero Kanban
    await page.goto('/social-media/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/social-media/kanban');

    // 3. Modo Rodaje
    await page.goto('/social-media/shooting', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/social-media/shooting');

    // 4. Grilla Macro Mensual
    await page.goto('/social-media/grid', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/social-media/grid');
  });
});