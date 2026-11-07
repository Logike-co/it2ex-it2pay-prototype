import { expect, Page, test } from '@playwright/test';
import { enGuia } from './guia';

/**
 * QA T.4c — Valores de control de flow-map §6.7 tras el reinicio, verificados
 * en la interfaz (no en el motor) para Supermercados y Parqueaderos, más los
 * escenarios de lectura E01, E07, E43, E44, E46, E50, E55, E56, E57, E58.
 */

/** Sin errores de consola ni excepciones de página en ninguna prueba de QA. */
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

const LEGEND = 'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL';
const ILLUSTRATIVE = 'Ilustrativo — sujeto a validación del responsable funcional';

const fresh = async (page: Page, scenario: 'SUP' | 'PAR') => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (scenario === 'PAR') {
    await (await enGuia(page, 'selector-escenario')).selectOption('PAR');
  }
  await expect((await enGuia(page, 'selector-escenario'))).toHaveValue(scenario);
};

const nav = (page: Page, id: string) => page.getByTestId(`nav-${id}`).click();

test('§6.7 Supermercados tras el reinicio, vista por vista', async ({ page }) => {
  await fresh(page, 'SUP');

  // V01 · E01: cobertura y encabezado de selección.
  const cov = page.getByTestId('cobertura-SUP');
  await expect(cov.getByTestId('cov-cadenas')).toHaveText('2');
  await expect(cov.getByTestId('cov-sucursales')).toHaveText('3');
  await expect(cov.getByTestId('cov-pdv')).toHaveText('3');
  await expect(cov.getByTestId('cov-cajas')).toHaveText('4');
  await expect(cov.getByTestId('cov-cajeros')).toHaveText('4');
  await expect(cov.getByTestId('cov-servicios')).toHaveText('11');
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S1');
  await page.getByTestId('sel-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('seleccion-encabezado')).toHaveText(
    'Mercado Central Demo · Sucursal Norte · PDV-S1 · CJ-S1-01'
  );

  // V02 · E07.
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 612.700');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('5');
  await expect(page.getByTestId('cnt-rechazadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-anuladas')).toHaveText('1');
  await expect(page.getByTestId('cnt-reversadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-verificacion')).toHaveText('1');
  await expect(page.getByTestId('estados')).toContainText('$ 120.000');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('87,5 %');
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 2.050');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 1.000');
  await expect(page.getByTestId('kpi-excepciones')).toHaveText('2');
  await expect(page.getByTestId('kpi-pendiente')).toHaveText('$ 3.862.700');
  await expect(page.getByTestId('kpi-cupos-alerta')).toHaveText('1');
  await expect(page.getByTestId('kpi-dif-cierre')).toHaveText('0');
  await expect(page.getByTestId('recaudo-CAD-S1')).toHaveText('$ 530.200');
  await expect(page.getByTestId('recaudo-CAD-S2')).toHaveText('$ 82.500');
  for (const v of ['$ 292.700', '$ 20.000', '$ 300.000']) {
    await expect(page.locator('section', { hasText: 'Recaudo por línea' })).toContainText(v);
  }
  await expect(page.getByTestId('kpis-financieros').getByTestId('leyenda')).toHaveText(LEGEND);
  await page.getByTestId('dash-cadena').selectOption('CAD-S1');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 530.200');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('3');
  await page.getByTestId('dash-cadena').selectOption('');
  await page.getByTestId('dash-pdv').selectOption('PDV-S3');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 82.500');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('2');

  // V07 · E43 y E44.
  await nav(page, 'V07');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('10 transacciones');
  await page.getByTestId('filtro-estado').selectOption('PENDING_VERIFICATION');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('1 transacciones');
  await expect(page.getByTestId('fila-TX-S-0010')).toBeVisible();
  await page.getByTestId('filtro-estado').selectOption('');
  await page.getByTestId('fila-TX-S-0008').click();
  await expect(page.getByTestId('traza-detalle')).toContainText('Enviando 08:15');
  await expect(page.getByTestId('traza-detalle')).toContainText('Aprobada 08:15');
  await expect(page.getByTestId('traza-detalle')).toContainText('Reversada 08:20');
  await expect(page.getByTestId('traza-detalle')).toContainText('TX-S-0009');
  await expect(page.getByTestId('enlace-TX-S-0009')).toBeVisible();
  await expect(page.getByTestId('grupo-CJ-S1-01')).toContainText('$ 530.200');
  await expect(page.getByTestId('grupo-CJ-S1-01')).toContainText('3');
  await expect(page.getByTestId('grupo-CJ-S3-01')).toContainText('$ 82.500');
  await page.getByTestId('agrupacion').selectOption('sucursal');
  await expect(page.getByTestId('grupo-SUC-S1')).toContainText('$ 530.200');
  await expect(page.getByTestId('grupo-SUC-S3')).toContainText('$ 82.500');
  await expect(page.getByTestId('grupo-SUC-S2')).toContainText('$ 0');

  // V08 · E46.
  await nav(page, 'V08');
  const cupo = async (row: string, used: string, pv: string, avail: string) => {
    const r = page.getByTestId(`cupo-${row}`);
    await expect(r.getByTestId('utilizado')).toHaveText(used);
    await expect(r.getByTestId('en-verificacion')).toHaveText(pv);
    await expect(r.getByTestId('disponible')).toHaveText(avail);
  };
  await cupo('PDV-S1-Recaudos', '$ 930.200', '$ 120.000', '$ 3.949.800');
  await cupo('PDV-S1-Recargas', '$ 100.000', '$ 0', '$ 900.000');
  await cupo('PDV-S1-Corresponsalía', '$ 800.000', '$ 0', '$ 2.200.000');
  await cupo('PDV-S2-Recaudos', '$ 1.950.000', '$ 0', '$ 50.000');
  await cupo('PDV-S3-Recaudos', '$ 62.500', '$ 0', '$ 2.937.500');
  await cupo('PDV-S3-Recargas', '$ 20.000', '$ 0', '$ 480.000');
  await expect(page.getByTestId('cupo-PDV-S2-Recaudos').getByTestId('alerta-cupo')).toHaveText('Cupo bajo');
  await expect(page.getByTestId('alerta-cupo')).toHaveCount(1);
  await expect(page.getByTestId('consolidado-CAD-S1').getByTestId('consolidado-utilizado')).toHaveText('$ 3.780.200');
  await expect(page.getByTestId('tabla-cupos').getByTestId('ilustrativo')).toContainText(ILLUSTRATIVE);
  await expect(page.getByTestId('tabla-cupos').getByTestId('leyenda')).toHaveText(LEGEND);
  await expect(page.getByTestId('definir-cupo').getByTestId('leyenda')).toHaveText(LEGEND);
  await expect(page.getByTestId('alertas-cupo').getByTestId('leyenda')).toHaveText(LEGEND);

  // V09 · efectivo esperado por caja.
  await nav(page, 'V09');
  const esperado = async (caja: string, efectivo: string) => {
    await page.getByTestId('cierre-caja').selectOption(caja);
    await expect(page.getByTestId('esperado-efectivo')).toContainText(efectivo);
  };
  await esperado('CJ-S1-01', '$ 730.200');
  await expect(page.getByTestId('cierre-bloqueado')).toContainText(
    '1 transacción en verificación (TX-S-0010): resuélvala antes de cerrar'
  );
  await expect(page.getByTestId('btn-confirmar-cierre')).toBeDisabled();
  await esperado('CJ-S1-02', '$ 200.000');
  await esperado('CJ-S2-01', '$ 100.000');
  await esperado('CJ-S3-01', '$ 120.000');
  await expect(page.getByTestId('esperado-debito')).toContainText('$ 62.500');
  await expect(page.getByTestId('historial-cierres')).toContainText('CIE-S-000');

  // V10 · E50.
  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('9');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('7');
  await expect(page.getByTestId('conc-excepciones')).toHaveText('2');
  await expect(page.getByTestId('excepcion-TX-S-0006').getByTestId('excepcion-tipo')).toContainText('Diferencia de valor');
  await expect(page.getByTestId('excepcion-TX-S-0006')).toContainText('$ 85.000');
  await expect(page.getByTestId('excepcion-TX-S-0006')).toContainText('$ 58.000');
  await expect(page.getByTestId('excepcion-TX-S-0006')).toContainText('27.000');
  await expect(page.getByTestId('excepcion-TX-S-0010').getByTestId('excepcion-tipo')).toContainText('Diferencia de estado');
  await expect(page.getByTestId('excepcion-TX-S-0010')).toContainText('En verificación / aprobada');
  await expect(page.getByTestId('comparacion')).not.toContainText('TX-S-0004');
  await expect(page.getByTestId('resumen-conciliacion').getByTestId('leyenda')).toHaveText(LEGEND);
  await expect(page.getByTestId('resumen-conciliacion').getByTestId('ilustrativo')).toContainText(ILLUSTRATIVE);
  // §7: nunca «Reval» solo en un resultado.
  expect(await page.locator('main').textContent()).not.toMatch(/Reval(?!\s+\(simulado\))/);

  // V11 · E55 y E56.
  await nav(page, 'V11');
  await expect(page.getByTestId('comp-ingresos')).toHaveText('$ 612.700');
  await expect(page.getByTestId('comp-retiros')).toHaveText('$ 0');
  for (const v of ['$ 292.700', '$ 20.000', '$ 300.000']) {
    await expect(page.getByTestId('compensacion')).toContainText(v);
  }
  await expect(page.getByTestId('comp-obligacion')).toHaveText('$ 612.700');
  await expect(page.getByTestId('obligacion-CAD-S1')).toContainText('$ 530.200');
  await expect(page.getByTestId('obligacion-CAD-S2')).toContainText('$ 82.500');
  await expect(page.getByTestId('comp-com-cadena')).toHaveText('$ 2.050');
  await expect(page.getByTestId('comp-com-it2ex')).toHaveText('$ 1.000');
  await expect(page.getByTestId('comp-verificacion')).toHaveText('$ 120.000');
  await expect(page.getByTestId('comp-diferencias')).toHaveText('$ 27.000');
  await expect(page.getByTestId('pendiente-total')).toHaveText('$ 3.862.700');
  await expect(page.getByTestId('pendiente-PDV-S1')).toContainText('$ 1.830.200');
  await expect(page.getByTestId('pendiente-PDV-S2')).toContainText('$ 1.950.000');
  await expect(page.getByTestId('pendiente-PDV-S3')).toContainText('$ 82.500');
  await expect(page.getByTestId('efectivo-entregado')).toHaveText('$ 500.000');
  await expect(page.getByTestId('por-validar')).toHaveText('$ 300.000');
  await page.getByTestId('modalidad-descontado').check();
  await expect(page.getByTestId('comp-neto')).toHaveText('$ 609.650');
  await expect(page.getByTestId('compensacion').getByTestId('leyenda')).toHaveText(LEGEND);
  await expect(page.getByTestId('compensacion').getByTestId('ilustrativo')).toContainText(ILLUSTRATIVE);
  await expect(page.getByTestId('consignaciones').getByTestId('leyenda')).toHaveText(LEGEND);
  expect(await page.locator('main').textContent()).not.toMatch(/Reval(?!\s+\(simulado\))/);

  // V12 · E57 y E58.
  await nav(page, 'V12');
  await expect(page.getByTestId('liq-CAD-S1-SRV-01')).toContainText('$ 450');
  await expect(page.getByTestId('liq-CAD-S1-SRV-13')).toContainText('$ 400');
  await expect(page.getByTestId('liq-CAD-S1-SRV-04')).toContainText('$ 400');
  await expect(page.getByTestId('liq-CAD-S2-SRV-02')).toContainText('$ 400');
  await expect(page.getByTestId('liq-CAD-S2-SRV-10')).toContainText('$ 400');
  await expect(page.getByTestId('liq-total-tx')).toHaveText('5');
  await expect(page.getByTestId('liq-total-cadena')).toHaveText('$ 2.050');
  await expect(page.getByTestId('liq-total-it2ex')).toHaveText('$ 1.000');
  await expect(page.getByTestId('liq-total')).toHaveText('$ 3.050');
  await expect(page.getByTestId('cartera-it2ex')).toHaveText('$ 25.600');
  await expect(page.getByTestId('cartera-cadenas')).toHaveText('$ 33.550');
  await expect(page.getByTestId('cartera-pendiente')).toHaveText('$ 3.862.700');
  for (const v of ['$ 18.400', '$ 6.200', '$ 31.500']) {
    await expect(page.getByTestId('cartera')).toContainText(v);
  }
  await expect(page.getByTestId('cartera').getByTestId('leyenda')).toHaveText(LEGEND);
});

test('§6.7 Parqueaderos tras el reinicio, vista por vista', async ({ page }) => {
  await fresh(page, 'PAR');

  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 485.000');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('5');
  await expect(page.getByTestId('cnt-rechazadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-anuladas')).toHaveText('0');
  await expect(page.getByTestId('cnt-reversadas')).toHaveText('1');
  await expect(page.getByTestId('cnt-verificacion')).toHaveText('0');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('85,7 %');
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 1.900');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 950');
  await expect(page.getByTestId('kpi-pendiente')).toHaveText('$ 2.055.000');
  await expect(page.getByTestId('kpi-cupos-alerta')).toHaveText('1');
  await expect(page.getByTestId('kpi-excepciones')).toHaveText('1');
  await expect(page.getByTestId('kpi-dif-cierre')).toHaveText('0');
  await expect(page.getByTestId('recaudo-CAD-P1')).toHaveText('$ 475.000');
  await expect(page.getByTestId('recaudo-CAD-P2')).toHaveText('$ 10.000');
  for (const v of ['$ 275.000', '$ 60.000', '$ 150.000']) {
    await expect(page.locator('section', { hasText: 'Recaudo por línea' })).toContainText(v);
  }

  await nav(page, 'V07');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('8 transacciones');

  await nav(page, 'V08');
  const cupo = async (row: string, used: string, pv: string, avail: string) => {
    const r = page.getByTestId(`cupo-${row}`);
    await expect(r.getByTestId('utilizado')).toHaveText(used);
    await expect(r.getByTestId('en-verificacion')).toHaveText(pv);
    await expect(r.getByTestId('disponible')).toHaveText(avail);
  };
  await cupo('PDV-P1-Recaudos', '$ 675.000', '$ 0', '$ 2.325.000');
  await cupo('PDV-P1-Recargas', '$ 250.000', '$ 0', '$ 1.250.000');
  await cupo('PDV-P1-Corresponsalía', '$ 150.000', '$ 0', '$ 850.000');
  await cupo('PDV-P2-Recaudos', '$ 970.000', '$ 0', '$ 30.000');
  await cupo('PDV-P3-Recargas', '$ 10.000', '$ 0', '$ 990.000');
  await expect(page.getByTestId('cupo-PDV-P2-Recaudos').getByTestId('alerta-cupo')).toHaveText('Cupo bajo');
  await expect(page.getByTestId('alerta-cupo')).toHaveCount(1);

  await nav(page, 'V09');
  const esperado = async (caja: string, efectivo: string) => {
    await page.getByTestId('cierre-caja').selectOption(caja);
    await expect(page.getByTestId('esperado-efectivo')).toContainText(efectivo);
  };
  await esperado('CJ-P1-01', '$ 445.000');
  await expect(page.getByTestId('esperado-credito')).toContainText('$ 180.000');
  await expect(page.getByTestId('cierre-bloqueado')).toHaveCount(0);
  await esperado('CJ-P1-02', '$ 150.000');
  await esperado('CJ-P2-01', '$ 100.000');
  await esperado('CJ-P3-01', '$ 110.000');
  await expect(page.getByTestId('historial-cierres')).toContainText('CIE-P-000');

  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('7');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('6');
  await expect(page.getByTestId('conc-excepciones')).toHaveText('1');
  await expect(page.getByTestId('excepcion-TX-P-0005').getByTestId('excepcion-tipo')).toContainText(
    'Inconsistencia reportada por Reval (simulado)'
  );

  await nav(page, 'V11');
  await expect(page.getByTestId('comp-obligacion')).toHaveText('$ 485.000');
  await expect(page.getByTestId('efectivo-entregado')).toHaveText('$ 200.000');
  await expect(page.getByTestId('por-validar')).toHaveText('$ 100.000');
  await expect(page.getByTestId('pendiente-total')).toHaveText('$ 2.055.000');
  await expect(page.getByTestId('pendiente-PDV-P1')).toContainText('$ 1.075.000');
  await expect(page.getByTestId('pendiente-PDV-P2')).toContainText('$ 970.000');
  await expect(page.getByTestId('pendiente-PDV-P3')).toContainText('$ 10.000');
  await expect(page.getByTestId('comp-diferencias')).toHaveText('$ 0');

  // Siguiente transacción TX-P-0009 (se verifica operando una recarga en CJ-P3-01).
  await nav(page, 'V01');
  await page.getByTestId('sel-cadena').selectOption('CAD-P2');
  await page.getByTestId('sel-sucursal').selectOption('SUC-P3');
  await page.getByTestId('sel-caja').selectOption('CJ-P3-01');
  await page.getByTestId('sel-usuario').selectOption('CAJ-P04');
  await page.getByTestId('btn-ingresar').click();
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 110.000');
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('sugerido-5000').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('5000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-P-0009/);
  await expect(page.getByTestId('resultado-autorizacion')).toHaveText('AUT-P-100009');
});
