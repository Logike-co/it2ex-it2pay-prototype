import { expect, Page, test } from '@playwright/test';
import { abrirTurno, ingresarComo, irA, limpio } from './sesion';

/**
 * QA T.4c — Recorrido de referencia SUP (flow-map §1, pasos 1–7 sin variantes)
 * repetido de forma independiente, verificando en la interfaz todas las filas
 * de los valores de control de §6.8. Cada paso lo hace su perfil (D-T4).
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

const PATHS: Record<string, string> = {
  V01: 'inicio', V02: 'dashboard', V03: 'red', V04: 'convenios', V05: 'caja', V07: 'transacciones',
  V08: 'cupos', V09: 'cierre', V10: 'conciliacion', V11: 'compensacion', V12: 'finanzas',
};

const nav = (page: Page, id: string) => irA(page, PATHS[id]);

test('§6.8 completo tras el recorrido SUP', async ({ page }) => {
  await limpio(page);

  // Paso 2: el Asesor crea la sucursal y el PDV; el Punto de Venta, su caja y su colocador.
  await ingresarComo(page, 'ASE-S01', 'red');
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await page.getByTestId('pdv-sucursal').selectOption('SUC-S4');
  await page.getByTestId('nuevo-pdv').fill('Punto de servicios Nuevo');
  await page.getByTestId('crear-pdv').click();
  await expect(page.getByTestId('aviso')).toContainText('PV-S04');
  await ingresarComo(page, 'PV-S04', 'red');
  await page.getByTestId('caja-pdv').selectOption('PDV-S4');
  await page.getByTestId('crear-caja').click();
  await page.getByTestId('nuevo-usuario').fill('Colocador Demo 05');
  await page.getByTestId('usuario-caja').selectOption('CJ-S4-01');
  await page.getByTestId('crear-usuario').click();
  await expect(page.getByTestId('aviso')).toContainText('COL-S05');
  await ingresarComo(page, 'SU-S01', 'convenios');
  await page.getByTestId('hab-servicio').selectOption('SRV-06');
  await page.getByTestId('hab-pdv-PDV-S4').selectOption('si');
  await page.getByTestId('com-servicio').selectOption('SRV-01');
  await expect(page.getByTestId('seccion-comisiones')).toContainText('Vigente para esta combinación: 400 / 200');
  await ingresarComo(page, 'OPE-S01', 'cupos');
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
  await ingresarComo(page, 'COL-S05');
  await abrirTurno(page, 'CJ-S4-01', 100_000);
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
  // Paso 7: Finanzas concilia y propone; el Aprobador financiero aprueba.
  await ingresarComo(page, 'FIN-S01', 'conciliacion');
  await page.getByTestId('btn-conciliar').click();
  await page.getByTestId('consultar-TX-S-0010').click();
  await expect(page.getByTestId('resuelta-TX-S-0010')).toBeVisible();
  await page.getByTestId('nota-TX-S-0006').fill('Ajuste');
  await page.getByTestId('ajuste-TX-S-0006').click();
  await expect(page.getByTestId('pendiente-TX-S-0006')).toBeVisible();
  await ingresarComo(page, 'APR-S01', 'conciliacion');
  await page.getByTestId('aprobar-PRO-S-001').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('12');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('11');
  await expect(page.getByTestId('conc-ajustes')).toHaveText('1');
  await expect(page.getByTestId('conc-abiertas')).toHaveText('0');
  await ingresarComo(page, 'FIN-S01', 'compensacion');
  await page.getByTestId('con-pdv').selectOption('PDV-S4');
  await page.getByTestId('con-linea').selectOption('Recaudos');
  await page.getByTestId('con-valor').fill('98700');
  await page.getByTestId('btn-consignar').click();
  await page.getByTestId('validar-CON-S-003').click();
  await nav(page, 'V12');
  await page.getByTestId('btn-liquidar').click();
  await ingresarComo(page, 'APR-S01', 'finanzas');
  await page.getByTestId('aprobar-LIQ-S-001').click();
  await ingresarComo(page, 'FIN-S01', 'finanzas');
  await page.getByTestId('btn-cuenta-cobro').click();
  await expect(page.getByTestId('cc-estado')).toHaveText('Pendiente de aprobación');

  // §6.8 fila por fila.
  await ingresarComo(page, 'OPE-S01', 'transacciones');
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
  await ingresarComo(page, 'FIN-S01', 'compensacion');
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
  await ingresarComo(page, 'COL-S05', 'cierre');
  await expect(page.getByTestId('cierre-CIE-S-001')).toContainText('Faltante');
  await expect(page.getByTestId('cierre-CIE-S-001')).toContainText('$ 410.000');
  await ingresarComo(page, 'COL-S01', 'cierre');
  await page.getByTestId('cierre-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 850.200');
  await ingresarComo(page, 'FIN-S01', 'finanzas');
  const liq = page.getByTestId('liquidacion-LIQ-S-001');
  await expect(liq.getByTestId('snap-tx')).toHaveText('9');
  await expect(liq.getByTestId('snap-cadena')).toHaveText('$ 3.700');
  await expect(liq.getByTestId('snap-it2ex')).toHaveText('$ 1.800');
  await expect(liq.getByTestId('snap-total')).toHaveText('$ 5.500');
  await expect(page.getByTestId('cc-total')).toHaveText('$ 1.800');

  // Siguiente transacción: TX-S-0014 (rechazo por gatillo en CJ-S1-01 para no mover totales).
  await ingresarComo(page, 'COL-S01');
  await expect(page).toHaveURL(/\/caja$/);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112013');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('76000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0014/);
});
