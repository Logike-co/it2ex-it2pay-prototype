import { expect, Page, test } from '@playwright/test';
import { AccessView, VIEW_ACCESS } from '../src/app/core/access/access';
import { ProfileName } from '../src/app/core/simulation/model';
import { enGuia } from './guia';
import { ingresarComo, irA, limpio } from './sesion';

/**
 * Acceso por rol (D-T4): login con usuarios precargados, menú con solo las opciones del
 * perfil, acciones restringidas (RN-ACC-05, RN-ACC-06) y la vista «Roles y accesos».
 */

const consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text());
    }
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await limpio(page);
});
test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

const USERS: [string, ProfileName][] = [
  ['COL-S01', 'Colocador'],
  ['PV-S01', 'Punto de Venta'],
  ['ASE-S01', 'Asesor de Ventas'],
  ['OPE-S01', 'Operador'],
  ['FIN-S01', 'Finanzas'],
  ['APR-S01', 'Aprobador financiero'],
  ['ADM-S01', 'Administrador'],
  ['SU-S01', 'Super Usuario'],
];

const menuIds = async (page: Page): Promise<string[]> =>
  (await page.locator('[data-testid="menu"] [data-testid^="nav-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-testid')!.slice(4))
  )) as string[];

const imagenCargada = (page: Page, testId: string) =>
  expect
    .poll(() => page.getByTestId(testId).evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

test('cada perfil ve en el menú exactamente sus vistas (VIEW_ACCESS)', async ({ page }) => {
  for (const [user, role] of USERS) {
    await ingresarComo(page, user);
    await expect(page.getByTestId('rol-sesion')).toHaveText(role);
    const expected = (Object.keys(VIEW_ACCESS) as AccessView[]).filter((v) => VIEW_ACCESS[v].includes(role));
    expect(await menuIds(page), `menú de ${user}`).toEqual(expected);
  }
});

test('la contraseña se llena sola al elegir el usuario', async ({ page }) => {
  await expect(page.getByTestId('login-clave')).toHaveValue('');
  await expect(page.getByTestId('btn-ingresar')).toBeDisabled();
  await page.getByTestId('login-usuario').selectOption('FIN-S01');
  await expect(page.getByTestId('login-clave')).not.toHaveValue('');
  await expect(page.getByTestId('login-clave')).toHaveAttribute('type', 'password');
  await expect(page.getByTestId('btn-ingresar')).toBeEnabled();
  await page.getByTestId('login-usuario').selectOption('');
  await expect(page.getByTestId('login-clave')).toHaveValue('');
});

test('una URL vedada lleva al inicio del perfil con el aviso', async ({ page }) => {
  await ingresarComo(page, 'COL-S01');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('aviso')).toContainText('no tiene acceso');

  await ingresarComo(page, 'FIN-S01');
  await page.goto('/red');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByTestId('aviso')).toContainText('Su perfil (Finanzas) no tiene acceso a esa opción');
});

test('solo el Operador ve «Reversar» (RN-ACC-05)', async ({ page }) => {
  for (const user of ['PV-S01', 'ASE-S01', 'FIN-S01', 'APR-S01', 'OPE-S01']) {
    await ingresarComo(page, user);
    await page.goto('/transacciones?tx=TX-S-0006');
    const detalle = page.getByTestId('detalle-transaccion');
    await expect(detalle).toContainText('TX-S-0006');
    await expect(detalle.getByTestId('btn-reversar'), user).toHaveCount(user === 'OPE-S01' ? 1 : 0);
    await expect(detalle.getByTestId('btn-anular'), user).toHaveCount(0);
  }
  // El Colocador anula en su turno, pero no reversa.
  await ingresarComo(page, 'COL-S01');
  await page.goto('/caja/resultado?tx=TX-S-0006');
  await expect(page.getByTestId('btn-anular')).toBeVisible();
  await expect(page.getByTestId('btn-reversar')).toHaveCount(0);
});

test('Finanzas genera sin aprobar; el Aprobador aprueba y no liquida (RN-ACC-06)', async ({ page }) => {
  await ingresarComo(page, 'FIN-S01', 'finanzas');
  await page.getByTestId('btn-liquidar').click();
  const liq = page.getByTestId('liquidacion-LIQ-S-001');
  await expect(liq.getByTestId('liq-estado')).toHaveText('Pendiente de aprobación');
  await expect(page.getByRole('button', { name: /^Aprobar/ })).toHaveCount(0);
  await page.getByTestId('btn-cuenta-cobro').click();
  await expect(page.getByTestId('aviso')).toContainText('liquidación aprobada');

  await ingresarComo(page, 'APR-S01', 'finanzas');
  await expect(page.getByTestId('btn-liquidar')).toHaveCount(0);
  await expect(page.getByTestId('btn-cuenta-cobro')).toHaveCount(0);
  await page.getByTestId('aprobar-LIQ-S-001').click();
  await expect(liq.getByTestId('liq-estado')).toHaveText('Aprobada');
  await expect(liq).toContainText('Generó: Finanzas Demo S · Revisó: Aprobador Demo S');
});

test('el menú arranca oculto tras el login y tras «Ingresar como…» de la guía; ☰ lo muestra', async ({ page }) => {
  await ingresarComo(page, 'OPE-S01');
  const menu = page.getByTestId('menu');
  const btn = page.getByTestId('btn-menu');
  await expect(menu).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(menu).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');

  // El paso 1 de ESC-01 es del Asesor: la guía ofrece entrar como él.
  await (await enGuia(page, 'guia-ingresar-como')).click();
  await expect(page.getByTestId('usuario-sesion')).toContainText('ASE-S01');
  await expect(menu).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await btn.click();
  await expect(menu).toBeVisible();
});

test('«Cerrar sesión» vuelve al login y sin sesión no hay menú', async ({ page }) => {
  await ingresarComo(page, 'SU-S01');
  await page.getByTestId('btn-cerrar-sesion').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('form-login')).toBeVisible();
  await expect(page.getByTestId('btn-menu')).toHaveCount(0);
  await expect(page.getByTestId('menu')).toHaveCount(0);
  await page.goto('/conciliacion');
  await expect(page).toHaveURL(/\/login$/);
});

test('«Roles y accesos» muestra perfiles, matriz y los 3 diagramas de casos de uso', async ({ page }) => {
  await ingresarComo(page, 'ADM-S01', 'roles');
  await expect(page.getByTestId('tabla-roles').locator('tbody tr')).toHaveCount(8);
  const matriz = page.getByTestId('matriz-accesos');
  await expect(matriz.locator('tbody tr')).toHaveCount(13);
  await expect(page.getByTestId('celda-V05-Colocador')).toContainText('✓');
  await expect(page.getByTestId('celda-V05-Operador')).toContainText('—');
  await expect(page.getByTestId('celda-V12-Aprobador financiero')).toContainText('Aprueba');
  for (const tab of ['pdv', 'operacion', 'financiero']) {
    await page.getByTestId(`tab-${tab}`).click();
    await imagenCargada(page, `diagrama-${tab}`);
  }
});

test('la guía abre la matriz de roles en un diálogo con cualquier perfil', async ({ page }) => {
  await ingresarComo(page, 'COL-S01');
  await expect(page.getByTestId('nav-ROLES')).toHaveCount(0);
  await (await enGuia(page, 'guia-matriz-roles')).click();
  const dialogo = page.getByTestId('dialogo-roles');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByTestId('matriz-accesos').locator('tbody tr')).toHaveCount(13);
  for (const tab of ['pdv', 'operacion', 'financiero']) {
    await dialogo.getByTestId(`tab-${tab}`).click();
    await imagenCargada(page, `diagrama-${tab}`);
  }
  await page.getByTestId('cerrar-roles').click();
  await expect(dialogo).toHaveCount(0);
  await irA(page, 'caja');
});
