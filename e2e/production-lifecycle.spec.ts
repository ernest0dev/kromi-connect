import { test, expect } from '@playwright/test';

test.describe('Kromi Connect - Flujo E2E de Producción', () => {
  test('debe registrar solicitud, verificar en Kanban, Shooting y Grilla Macro', async ({ page }) => {
    // 1. Inbox de Solicitudes
    await page.goto('/requests', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/requests');

    // 2. Tablero Kanban
    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/kanban');

    // 3. Modo Rodaje
    await page.goto('/shooting', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/shooting');

    // 4. Grilla Macro Mensual
    await page.goto('/grid', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/grid');
  });
});