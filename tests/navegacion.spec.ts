import { expect, test } from '@playwright/test';

/** CA-01 y CA-09: las 12 rutas cargan sin errores y llevan la leyenda fija. */

const LEGEND = 'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL';

const VIEWS = [
  { route: '/inicio', id: 'V01', name: 'Inicio y escenarios' },
  { route: '/dashboard', id: 'V02', name: 'Dashboard ejecutivo' },
  { route: '/red', id: 'V03', name: 'Administración de red' },
  { route: '/convenios', id: 'V04', name: 'Convenios y servicios' },
  { route: '/caja', id: 'V05', name: 'Terminal de caja' },
  { route: '/caja/resultado', id: 'V06', name: 'Resultado y comprobante' },
  { route: '/transacciones', id: 'V07', name: 'Consulta transaccional' },
  { route: '/cupos', id: 'V08', name: 'Cupos y riesgo' },
  { route: '/cierre', id: 'V09', name: 'Cierre de caja' },
  { route: '/conciliacion', id: 'V10', name: 'Conciliación' },
  { route: '/compensacion', id: 'V11', name: 'Compensación y efectivo' },
  { route: '/finanzas', id: 'V12', name: 'Gestión financiera' },
];

test('las 12 rutas cargan por URL directa y por menú, sin errores de consola y con la leyenda', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`${page.url()} → ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => errors.push(`${page.url()} → ${err.message}`));

  for (const view of VIEWS) {
    await page.goto(view.route);
    await expect(page.locator('h1')).toContainText(`${view.id} · ${view.name}`);
    const band = page.getByTestId('banda-simulacion');
    await expect(band).toBeVisible();
    await expect(band).toHaveText(LEGEND);
    await expect(page).toHaveTitle(`IT2Pay · ${view.name}`);
  }

  await page.goto('/inicio');
  for (const view of VIEWS) {
    await page.getByTestId(`nav-${view.id}`).click();
    await expect(page.locator('h1')).toContainText(view.name);
    await expect(page.getByTestId('banda-simulacion')).toHaveText(LEGEND);
  }

  expect(errors).toEqual([]);
});

test('una ruta desconocida vuelve a Inicio y V06 sin operación muestra su estado vacío', async ({ page }) => {
  await page.goto('/no-existe');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/caja/resultado');
  await expect(page.getByTestId('estado-vacio')).toContainText('Sin operación reciente');
});
