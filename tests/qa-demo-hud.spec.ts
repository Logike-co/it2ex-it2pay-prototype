import { expect, Page, test } from '@playwright/test';
import { enGuia } from './guia';
import { ingresarComo, irA, limpio } from './sesion';

/**
 * Modo presentador (workflow T §1.4, X01–X04): guía de demo, atajos, presets ESC-01..03,
 * reinicio en 1 clic y trazabilidad US/RF en pantalla. Cada paso del guion se hace con su
 * perfil (D-T4): la guía ofrece «Ingresar como…».
 */

const fresh = async (page: Page) => {
  await limpio(page);
};

const applyPreset = async (page: Page, id: string) => {
  if (!(await page.getByTestId('guia-demo').isVisible())) {
    await page.getByTestId('btn-guia-demo').click();
  }
  await page.getByTestId(`preset-${id}`).click();
  await page.getByTestId('guia-aplicar-preset').click();
};

const goToStep = async (page: Page, n: number) => {
  const step = page.getByTestId(`guia-ir-paso-${n}`);
  if (!(await step.isVisible())) {
    await page.getByTestId('guia-todos-los-pasos').click();
  }
  await step.click();
};

/** «Ingresar como…» del paso en curso; verifica la sesión del usuario esperado. */
const ingresarDelPaso = async (page: Page, user: string) => {
  await expect(page.getByTestId('guia-usuario-paso')).toContainText(user);
  await page.getByTestId('guia-ingresar-como').click();
  await expect(page.getByTestId('usuario-sesion')).toContainText(user);
  await expect(page.getByTestId('guia-ingresar-como')).toHaveCount(0);
};

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('X01: la guía se abre y se cierra con el botón y con Ctrl+Shift+D', async ({ page }) => {
  const hud = page.getByTestId('guia-demo');
  await expect(hud).toBeHidden();
  await page.getByTestId('btn-guia-demo').click();
  await expect(hud).toBeVisible();
  await page.getByTestId('guia-cerrar').click();
  await expect(hud).toBeHidden();

  await page.keyboard.press('Control+Shift+D');
  await expect(hud).toBeVisible();
  await page.keyboard.press('Control+Shift+D');
  await expect(hud).toBeHidden();
});

test('X01: la guía recorre los pasos y navega a la vista de cada uno', async ({ page }) => {
  await applyPreset(page, 'ESC-01');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByTestId('usuario-sesion')).toContainText('ASE-S01');
  await expect(page.getByTestId('guia-paso-num')).toContainText('ESC-01 · Paso 1 de 14 · V01');
  await expect(page.getByTestId('guia-paso-titulo')).toHaveText('Elegir escenario');
  await expect(page.getByTestId('guia-anterior')).toBeDisabled();

  await page.getByTestId('guia-siguiente').click();
  await expect(page).toHaveURL(/\/red$/);
  await expect(page.getByTestId('guia-paso-titulo')).toHaveText('Crear el punto de venta');
  await expect(page.getByTestId('guia-ingresar-como')).toHaveCount(0);

  // El paso 3 es del Punto de Venta PV-S04, que aún no existe: se crea en el paso 2.
  await page.getByTestId('guia-siguiente').click();
  await expect(page.getByTestId('guia-usuario-paso')).toContainText('se crea en un paso anterior');
  await expect(page.getByTestId('guia-ingresar-como')).toHaveCount(0);

  await goToStep(page, 14);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('guia-siguiente')).toBeDisabled();
  await expect(page.getByTestId('guia-usuario-paso')).toContainText('OPE-S01');
  await expect(page.getByTestId('guia-ingresar-como')).toBeVisible();

  // La guía sigue a la pantalla: al ir a V08 por el menú pasa al paso que la usa.
  await irA(page, 'cupos');
  await expect(page.getByTestId('guia-paso-titulo')).toHaveText('Cupos');
  await expect(page.getByTestId('guia-fuera-de-vista')).toBeHidden();
  await irA(page, 'red');
  await expect(page.getByTestId('guia-paso-num')).toContainText('Paso 3 de 14');

  // «Saltar a vista» solo ofrece las vistas del perfil.
  await expect(page.getByTestId('guia-saltar-vista').locator('option[value="convenios"]')).toHaveCount(0);
  await page.getByTestId('guia-saltar-vista').selectOption('cupos');
  await expect(page).toHaveURL(/\/cupos$/);
});

test('X01: en una pantalla fuera del guion, la guía conserva el paso, lo advierte y ofrece volver', async ({ page }) => {
  await applyPreset(page, 'ESC-02');
  await expect(page).toHaveURL(/\/caja$/);
  await irA(page, 'cierre');
  await expect(page.getByTestId('guia-paso-titulo')).toHaveText('Ingresar a la caja del aeropuerto');
  await expect(page.getByTestId('guia-fuera-de-vista')).toContainText('V09 no forma parte del guion de ESC-02');
  await page.getByTestId('guia-ir-vista').click();
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('guia-fuera-de-vista')).toBeHidden();
});

test('X01: la caja y su resultado no mueven la guía del paso en curso', async ({ page }) => {
  await applyPreset(page, 'ESC-03');
  // El preset entra como Colocador Demo 01, que retoma su turno: la caja es parte del paso 1.
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('usuario-sesion')).toContainText('COL-S01');
  await expect(page.getByTestId('guia-paso-num')).toContainText('Paso 1 de 4');
  await expect(page.getByTestId('guia-fuera-de-vista')).toBeHidden();
  await page.getByTestId('guia-siguiente').click();
  await expect(page.getByTestId('guia-paso-num')).toContainText('Paso 2 de 4');
  await page.getByTestId('buscar-servicio').fill('ENEL');
  await page.keyboard.press('Enter');
  await page.getByTestId('ref-0').fill('4500112100');
  await page.keyboard.press('Enter');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/resultado/);
  await expect(page.getByTestId('guia-paso-num')).toContainText('Paso 2 de 4');
});

test('X02: Ctrl+Shift+R reinicia el escenario en 1 clic, sin diálogo y sin recargar la página', async ({ page }) => {
  await ingresarComo(page, 'ASE-S01', 'red');
  await page.evaluate(() => ((window as unknown as { __sinRecarga: boolean }).__sinRecarga = true));
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await expect(page.getByTestId('aviso')).toContainText('SUC-S4');

  const t0 = Date.now();
  await page.keyboard.press('Control+Shift+R');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByTestId('aviso')).toContainText('Reinicio en 1 clic');
  expect(Date.now() - t0).toBeLessThan(1000);
  await expect(page.getByTestId('dialogo-reinicio')).toBeHidden();
  // La página no se recargó: la marca puesta en window sigue ahí.
  expect(await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga)).toBe(true);

  // El reinicio entra con el usuario del primer paso del preset (ASE-S01).
  await expect(page.getByTestId('usuario-sesion')).toContainText('ASE-S01');
  await irA(page, 'red');
  await expect(page.getByText('SUC-S4')).toHaveCount(0);
});

test('ESC-02: Parqueaderos reiniciado; Finanzas propone el reverso técnico y el Aprobador lo aprueba', async ({ page }) => {
  await applyPreset(page, 'ESC-02');
  await expect(await enGuia(page, 'selector-escenario')).toHaveValue('PAR');
  await expect(page.getByTestId('usuario-sesion')).toContainText('COL-P01');
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 445.000');

  // Punto de partida de la red, con el Operador.
  await ingresarComo(page, 'OPE-P01', 'dashboard');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 485.000');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('85,7 %');

  await goToStep(page, 2);
  await ingresarDelPaso(page, 'FIN-P01');
  await expect(page).toHaveURL(/\/conciliacion$/);
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByText('Inconsistencia reportada por Reval (simulado)').first()).toBeVisible();
  await page.getByTestId('reverso-tecnico-TX-P-0005').click();
  await expect(page.getByTestId('pendiente-TX-P-0005')).toContainText('PRO-P-001');
  await expect(page.getByTestId('aprobar-PRO-P-001')).toHaveCount(0);

  await goToStep(page, 3);
  await ingresarDelPaso(page, 'APR-P01');
  await page.getByTestId('aprobar-PRO-P-001').click();
  await expect(page.getByTestId('resuelta-TX-P-0005')).toContainText('resuelta por reverso técnico');
  await expect(page.getByTestId('conc-comparados')).toHaveText('8');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('8');

  await goToStep(page, 4);
  await ingresarDelPaso(page, 'OPE-P01');
  await expect(page).toHaveURL(/\/transacciones$/);
  await page.getByTestId('fila-TX-P-0005').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Reversada');
});

test('ESC-03: la próxima autorización se rechaza; no suma al recaudo y queda trazada', async ({ page }) => {
  await applyPreset(page, 'ESC-03');
  await (await enGuia(page, 'btn-presentador')).click();
  await expect(page.getByTestId('panel-autorizacion')).toHaveValue('rechazar');

  await expect(page.getByTestId('usuario-sesion')).toContainText('COL-S01');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 730.200');
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0011/);
  await expect(page.getByTestId('resultado-estado')).toHaveText('Rechazada');
  await expect(page.getByTestId('resultado-codigo')).toHaveText('R-13');

  // Paso 3: el Colocador ve el rechazo en sus movimientos.
  await goToStep(page, 3);
  await expect(page).toHaveURL(/\/transacciones$/);
  await expect(page.getByTestId('fila-TX-S-0011')).toBeVisible();

  // Paso 4: indicadores, con el Operador.
  await goToStep(page, 4);
  await ingresarDelPaso(page, 'OPE-S01');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 612.700');
  await expect(page.getByTestId('cnt-rechazadas')).toHaveText('2');
});

test('X04: la trazabilidad muestra US y RF en cada vista, marca «solo demo» y no se imprime', async ({ page }) => {
  await ingresarComo(page, 'COL-S01');
  await expect(page.getByTestId('trazabilidad-vista')).toHaveCount(0);
  await (await enGuia(page, 'btn-trazabilidad')).check();

  await irA(page, 'caja');
  const strip = page.getByTestId('trazabilidad-vista');
  await expect(strip).toHaveAttribute('data-view', 'V05');
  await expect(strip).toContainText('US-09 · RF-09');
  await expect(strip).toContainText('13 escenarios BDD');
  await page.getByTestId('trazabilidad-detalle').click();
  await expect(strip).toContainText('E18');

  await irA(page, 'cierre');
  await expect(page.getByTestId('trazabilidad-vista')).toContainText('Solo demo');

  await ingresarComo(page, 'SU-S01', 'convenios');
  await expect(page.locator('[data-testid="badge-trazabilidad"][data-items="B07"]')).toContainText('US-15 · RF-15');

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('trazabilidad-vista')).toBeHidden();
  await expect(page.getByTestId('badge-trazabilidad').first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await (await enGuia(page, 'btn-trazabilidad')).uncheck();
  await expect(page.getByTestId('badge-trazabilidad')).toHaveCount(0);
});

test('D-02: Enter en un control de la guía no autoriza la operación de la caja', async ({ page }) => {
  await ingresarComo(page, 'COL-S01');
  await expect(page).toHaveURL(/\/caja$/);
  await page.getByTestId('btn-guia-demo').click();
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');

  for (const id of ['btn-trazabilidad', 'btn-presentador', 'guia-saltar-vista']) {
    await page.getByTestId(id).focus();
    await page.keyboard.press('Enter');
    // La autorización navega tras la latencia simulada (~0,8 s): se espera más que eso.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/caja$/);
    await page.getByTestId(id).focus();
    await page.keyboard.press('Escape');
    // Escape tampoco retrocede el asistente: el paso 3 (efectivo) sigue a la vista.
    await expect(page.getByTestId('efectivo-recibido')).toBeVisible();
  }
  await expect(page.getByTestId('efectivo-recibido')).toHaveValue('100000');
});

test('D-01: a 1280 px con la guía abierta, los controles del paso 7 no quedan tapados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ingresarComo(page, 'FIN-S01', 'compensacion');
  await page.getByTestId('btn-guia-demo').click();
  await page.getByTestId('con-pdv').selectOption('PDV-S1');
  await page.getByTestId('con-linea').selectOption('Recaudos');
  await page.getByTestId('con-valor').fill('1000');
  await page.getByTestId('btn-consignar').click();
  const validar = page.locator('[data-testid^="validar-CON-S-"]').first();
  await validar.scrollIntoViewIfNeeded();
  // El punto central del botón pertenece al botón, no a la guía.
  const hit = await validar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el || el.contains(top);
  });
  expect(hit).toBe(true);
  await validar.click({ trial: true });
});

