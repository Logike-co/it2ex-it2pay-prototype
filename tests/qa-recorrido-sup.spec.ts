import { expect, Page, test } from '@playwright/test';

/**
 * QA T.4c — Recorrido de referencia SUP (flow-map §1, pasos 1–7 sin variantes)
 * repetido de forma independiente, verificando en la interfaz todas las filas
 * de los valores de control de §6.8.
 */

const consoleErrors: string[] = [];
test.beforeEach(({ page }) => {
  consoleErrors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text());
    }
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
});
test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

const nav = (page: Page, id: string) => page.getByTestId(`nav-${id}`).click();

test('§6.8 completo tras el recorrido SUP', async ({ page }) => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Paso 2
  await nav(page, 'V03');
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await page.getByTestId('pdv-sucursal').selectOption('SUC-S4');
  await page.getByTestId('nuevo-pdv').fill('Punto de servicios Nuevo');
  await page.getByTestId('crear-pdv').click();
  await page.getByTestId('caja-pdv').selectOption('PDV-S4');
  await page.getByTestId('crear-caja').click();
  await page.getByTestId('nuevo-usuario').fill('Cajero Demo 05');
  await page.getByTestId('usuario-caja').selectOption('CJ-S4-01');
  await page.getByTestId('crear-usuario').click();
  await expect(page.getByTestId('aviso')).toContainText('CAJ-S05');
  await nav(page, 'V04');
  await page.getByTestId('hab-servicio').selectOption('SRV-06');
  await page.getByTestId('hab-pdv-PDV-S4').selectOption('si');
  await page.getByTestId('com-servicio').selectOption('SRV-01');
  await expect(page.getByTestId('seccion-comisiones')).toContainText('Vigente para esta combinación: 400 / 200');
  await nav(page, 'V08');
  for (const [line, value] of [
    ['Recaudos', '2000000'],
    ['Recargas', '500000'],
    ['Corresponsalía', '1000000'],
  ]) {
    await page.getByTestId('nuevo-cupo-pdv').selectOption('PDV-S4');
    await page.getByTestId('nuevo-cupo-linea').selectOption(line);
    await page.getByTestId('nuevo-cupo-valor').fill(value);
    await page.getByTestId('btn-definir-cupo').click();
    await expect(page.getByTestId(`cupo-PDV-S4-${line}`).getByTestId('utilizado')).toHaveText('$ 0');
  }
  await nav(page, 'V02');
  await page.getByTestId('dash-cadena').selectOption('CAD-S1');
  await expect(page.getByTestId('dash-pdv')).toContainText('PDV-S4');
  await nav(page, 'V01');
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S4');
  await page.getByTestId('sel-caja').selectOption('CJ-S4-01');
  await page.getByTestId('sel-usuario').selectOption('CAJ-S05');
  await page.getByTestId('btn-ingresar').click();
  await expect(page.getByTestId('servicio-SRV-06')).toBeVisible();

  // Paso 3
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0011/);
  // Paso 4
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('sugerido-20000').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('20000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0012/);
  // Paso 5
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-13').click();
  await page.getByTestId('ref-1').fill('1100556677');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('200000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('200000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0013/);
  // Paso 6
  await nav(page, 'V09');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 418.700');
  await page.getByTestId('cierre-declarado').fill('410000');
  await page.getByTestId('btn-confirmar-cierre').click();
  await expect(page.getByTestId('cierre-esperado')).toHaveText('$ 418.700');
  await expect(page.getByTestId('cierre-diferencia')).toHaveText('−8.700');
  // Paso 7
  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await page.getByTestId('consultar-TX-S-0010').click();
  await expect(page.getByTestId('resuelta-TX-S-0010')).toBeVisible();
  await page.getByTestId('nota-TX-S-0006').fill('Ajuste');
  await page.getByTestId('ajuste-TX-S-0006').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('12');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('11');
  await expect(page.getByTestId('conc-ajustes')).toHaveText('1');
  await expect(page.getByTestId('conc-abiertas')).toHaveText('0');
  await nav(page, 'V11');
  await page.getByTestId('con-pdv').selectOption('PDV-S4');
  await page.getByTestId('con-linea').selectOption('Recaudos');
  await page.getByTestId('con-valor').fill('98700');
  await page.getByTestId('btn-consignar').click();
  await page.getByTestId('validar-CON-S-003').click();
  await nav(page, 'V12');
  await page.getByTestId('btn-liquidar').click();
  await page.getByTestId('btn-cuenta-cobro').click();

  // §6.8 fila por fila.
  await nav(page, 'V07');
  for (const [id, text] of [
    ['TX-S-0011', '$ 98.700'],
    ['TX-S-0012', '$ 20.000'],
    ['TX-S-0013', '$ 200.000'],
  ]) {
    await expect(page.getByTestId(`fila-${id}`)).toContainText(text);
    await expect(page.getByTestId(`fila-${id}`)).toContainText('CJ-S4-01');
  }
  await expect(page.getByTestId('fila-TX-S-0014')).toHaveCount(0);
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 1.051.400');
  await expect(page.getByTestId('recaudo-CAD-S1')).toHaveText('$ 968.900');
  await expect(page.getByTestId('recaudo-CAD-S2')).toHaveText('$ 82.500');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('9');
  await expect(page.getByTestId('cnt-rechazadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-anuladas')).toHaveText('1');
  await expect(page.getByTestId('cnt-reversadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-verificacion')).toHaveText('0');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('91,7 %');
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 3.700');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 1.800');
  await nav(page, 'V11');
  await expect(page.getByTestId('comp-obligacion')).toHaveText('$ 1.051.400');
  await expect(page.getByTestId('efectivo-entregado')).toHaveText('$ 598.700');
  await expect(page.getByTestId('pendiente-total')).toHaveText('$ 4.202.700');
  await expect(page.getByTestId('pendiente-PDV-S1')).toContainText('$ 1.950.200');
  await expect(page.getByTestId('pendiente-PDV-S2')).toContainText('$ 1.950.000');
  await expect(page.getByTestId('pendiente-PDV-S3')).toContainText('$ 82.500');
  await expect(page.getByTestId('pendiente-PDV-S4')).toContainText('$ 220.000');
  await nav(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-S4-Recaudos').getByTestId('utilizado')).toHaveText('$ 0');
  await expect(page.getByTestId('cupo-PDV-S4-Recargas').getByTestId('utilizado')).toHaveText('$ 20.000');
  await expect(page.getByTestId('cupo-PDV-S4-Corresponsalía').getByTestId('utilizado')).toHaveText('$ 200.000');
  await nav(page, 'V09');
  await expect(page.getByTestId('cierre-CIE-S-001')).toContainText('Faltante');
  await expect(page.getByTestId('cierre-CIE-S-001')).toContainText('$ 410.000');
  await page.getByTestId('cierre-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 850.200');
  await nav(page, 'V12');
  const liq = page.getByTestId('liquidacion-LIQ-S-001');
  await expect(liq.getByTestId('snap-tx')).toHaveText('9');
  await expect(liq.getByTestId('snap-cadena')).toHaveText('$ 3.700');
  await expect(liq.getByTestId('snap-it2ex')).toHaveText('$ 1.800');
  await expect(liq.getByTestId('snap-total')).toHaveText('$ 5.500');
  await expect(page.getByTestId('cc-total')).toHaveText('$ 1.800');

  // Siguiente transacción: TX-S-0014 (rechazo por gatillo en CJ-S1-01 para no mover totales).
  await nav(page, 'V01');
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S1');
  await page.getByTestId('sel-caja').selectOption('CJ-S1-01');
  await page.getByTestId('sel-usuario').selectOption('CAJ-S01');
  await page.getByTestId('btn-ingresar').click();
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112013');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('76000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0014/);
});
