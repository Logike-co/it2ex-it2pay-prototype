import { expect, test } from '@playwright/test';
import { ingresarComo, limpio } from './sesion';

/**
 * CA-01 y CA-09: las 12 rutas cargan sin errores y llevan la leyenda fija. Con el acceso por
 * rol (D-T4) cada vista se recorre con un usuario que la tiene: así el comercial navega las
 * doce vistas cambiando de usuario, sin rutas rotas (ALC-SIM-05).
 */

const LEGEND = 'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL';

const VIEWS = [
  { route: '/inicio', id: 'V01', name: 'Inicio y escenarios', h1: 'V01 · Inicio', user: 'ASE-S01' },
  { route: '/dashboard', id: 'V02', name: 'Dashboard ejecutivo', user: 'OPE-S01' },
  { route: '/red', id: 'V03', name: 'Administración de red', user: 'ASE-S01' },
  { route: '/convenios', id: 'V04', name: 'Convenios y servicios', user: 'SU-S01' },
  { route: '/caja', id: 'V05', name: 'Terminal de caja', user: 'COL-S01' },
  { route: '/caja/resultado', id: 'V06', name: 'Resultado y comprobante', user: 'COL-S01' },
  { route: '/transacciones', id: 'V07', name: 'Consulta transaccional', user: 'OPE-S01' },
  { route: '/cupos', id: 'V08', name: 'Cupos y riesgo', user: 'OPE-S01' },
  { route: '/cierre', id: 'V09', name: 'Cierre de caja', user: 'COL-S01' },
  { route: '/conciliacion', id: 'V10', name: 'Conciliación', user: 'FIN-S01' },
  { route: '/compensacion', id: 'V11', name: 'Compensación y efectivo', user: 'FIN-S01' },
  { route: '/finanzas', id: 'V12', name: 'Gestión financiera', user: 'FIN-S01' },
];

test('las 12 rutas cargan por URL directa y por menú con un usuario que las tiene, sin errores y con la leyenda', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`${page.url()} → ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => errors.push(`${page.url()} → ${err.message}`));

  await limpio(page);
  for (const view of VIEWS) {
    await ingresarComo(page, view.user);
    await page.goto(view.route);
    await expect(page).toHaveURL(new RegExp(`${view.route}$`));
    await expect(page.locator('h1')).toContainText(view.h1 ?? `${view.id} · ${view.name}`);
    const band = page.getByTestId('banda-simulacion');
    await expect(band).toBeVisible();
    await expect(band).toHaveText(LEGEND);
    await expect(page).toHaveTitle(`IT2Pay · ${view.name}`);
  }

  for (const view of VIEWS.filter((v) => v.id !== 'V06')) {
    await ingresarComo(page, view.user);
    if (!(await page.getByTestId('menu').isVisible())) {
      await page.getByTestId('btn-menu').click();
    }
    await page.getByTestId(`nav-${view.id}`).click();
    await expect(page.locator('h1')).toContainText(view.h1 ?? view.name);
    await expect(page.getByTestId('banda-simulacion')).toHaveText(LEGEND);
  }

  expect(errors).toEqual([]);
});

test('una vista fuera del perfil no está en el menú y por URL vuelve al inicio del perfil con aviso', async ({ page }) => {
  await limpio(page);
  await ingresarComo(page, 'FIN-S01');
  await page.getByTestId('btn-menu').click();
  await expect(page.getByTestId('nav-V05')).toHaveCount(0);
  await page.goto('/caja');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByTestId('aviso')).toContainText('no tiene acceso');
});

test('una ruta desconocida lleva al login sin sesión y al inicio con sesión; V06 sin operación muestra su estado vacío', async ({ page }) => {
  await limpio(page);
  await page.goto('/no-existe');
  await expect(page).toHaveURL(/\/login$/);
  await ingresarComo(page, 'OPE-S01');
  await page.goto('/no-existe');
  await expect(page).toHaveURL(/\/inicio$/);
  await ingresarComo(page, 'COL-S03');
  await page.goto('/caja/resultado');
  await expect(page.getByTestId('estado-vacio')).toContainText('Sin operación reciente');
});
