import { expect, Page, test } from '@playwright/test';

/**
 * QA T.4c — Reglas A–D y caminos de error en la interfaz (flow-map §3.3,
 * R-04..R-10, escenarios E19..E42). Cada prueba parte de Supermercados
 * recién reiniciado, en CJ-S1-01 con CAJ-S01 (antecedente común de §5).
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

const fresh = async (page: Page) => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
};

const login = async (page: Page, chain: string, branch: string, register: string, user: string) => {
  await page.getByTestId('nav-V01').click();
  await page.getByTestId('sel-cadena').selectOption(chain);
  await page.getByTestId('sel-sucursal').selectOption(branch);
  await page.getByTestId('sel-caja').selectOption(register);
  await page.getByTestId('sel-usuario').selectOption(user);
  await page.getByTestId('btn-ingresar').click();
  await expect(page).toHaveURL(/\/caja$/);
};

const freshS1 = async (page: Page) => {
  await fresh(page);
  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-01', 'CAJ-S01');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 730.200');
};

/** Recaudo ENEL hasta el paso 3 (sin autorizar). */
const newOp = async (page: Page) => {
  await page.getByTestId('nav-V05').click();
  await expect(page).toHaveURL(/\/caja$/);
  await page.keyboard.press('F1');
};

const openPanel = async (page: Page) => {
  if (!(await page.getByTestId('panel-presentador').isVisible())) {
    await page.getByTestId('btn-presentador').click();
  }
};

const enelToPay = async (page: Page, ref: string) => {
  await newOp(page);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill(ref);
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('btn-continuar-2').click();
};

const enel = async (page: Page, ref: string, cash: string, txId: string) => {
  await enelToPay(page, ref);
  await page.getByTestId('efectivo-recibido').fill(cash);
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(new RegExp(`tx=${txId}`));
};

const recarga = async (page: Page, txId: string) => {
  await newOp(page);
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('sugerido-20000').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('20000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(new RegExp(`tx=${txId}`));
};

const deposito = async (page: Page, txId: string) => {
  await newOp(page);
  await page.getByTestId('servicio-SRV-13').click();
  await page.getByTestId('ref-0').selectOption('Ahorros');
  await page.getByTestId('ref-1').fill('1100556677');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('200000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('200000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(new RegExp(`tx=${txId}`));
};

const estado = (page: Page) => page.getByTestId('resultado-estado');

const cupoDisponible = async (page: Page, row: string) => {
  await page.getByTestId('nav-V08').click();
  return page.getByTestId(`cupo-${row}`).getByTestId('disponible');
};

const esperadoCaja = async (page: Page) => {
  await page.getByTestId('nav-V05').click();
  return page.getByTestId('efectivo-esperado');
};

test('E16/E17/E24/E25/E28: catálogo, consulta de obligación y bloqueos de captura', async ({ page }) => {
  await freshS1(page);
  // E16
  await page.keyboard.press('F2');
  await expect(page.getByTestId('linea-Recaudos')).toHaveText('Recaudos (7)');
  await expect(page.getByTestId('linea-Recargas')).toHaveText('Recargas (2)');
  await expect(page.getByTestId('linea-Corresponsalía')).toHaveText('Corresponsalía (2)');
  for (const id of ['SRV-06', 'SRV-12', 'SRV-15', 'SRV-16', 'SRV-17']) {
    await expect(page.getByTestId(`servicio-${id}`)).toHaveCount(0);
  }
  // E17
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-titular')).toHaveText('Titular Demo 2100');
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 98.700');
  await expect(page.getByTestId('obl-estado')).toHaveText('Pendiente');
  await expect(page.getByTestId('pago-total')).toBeVisible();
  // E24
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112999');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('error-caja')).toHaveText('Referencia sin obligación pendiente (simulado)');
  await expect(page.getByTestId('paso-1')).toHaveClass(/bg-primary/);
  // E25
  await page.getByTestId('ref-0').fill('4500112555');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('error-caja')).toHaveText('Obligación vencida: el convenio no admite pago extemporáneo');
  await expect(page.getByTestId('obl-valor')).toHaveCount(0);
  // E28
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-07').click();
  await page.getByTestId('ref-0').fill('3300408');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('error-caja')).toHaveText(
    'Obligación en verificación por la transacción TX-S-0010: resuelva su estado antes de un nuevo pago'
  );
  // Ninguna consulta creó transacción.
  await page.getByTestId('nav-V07').click();
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('10 transacciones');
  // E16 segunda parte: CJ-S2-01 no ofrece depósito ni retiro.
  await login(page, 'CAD-S1', 'SUC-S2', 'CJ-S2-01', 'CAJ-S03');
  await expect(page.getByTestId('servicio-SRV-13')).toHaveCount(0);
  await expect(page.getByTestId('servicio-SRV-14')).toHaveCount(0);
});

test('E19/E26: cambio, efectivo insuficiente y pago parcial', async ({ page }) => {
  await freshS1(page);
  await enelToPay(page, '4500112100');
  await page.getByTestId('efectivo-recibido').fill('98700');
  await expect(page.getByTestId('cambio')).toHaveText('$ 0');
  await expect(page.getByTestId('btn-autorizar')).toBeEnabled();
  await page.getByTestId('efectivo-recibido').fill('90000');
  await expect(page.getByTestId('cambio')).toHaveText('Efectivo insuficiente');
  await expect(page.getByTestId('btn-autorizar')).toBeDisabled();
  await page.keyboard.press('F1');
  // E26
  await page.getByTestId('servicio-SRV-05').click();
  await page.getByTestId('ref-0').fill('2');
  await page.getByTestId('ref-1').fill('301');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 350.000');
  await expect(page.getByTestId('obligacion').locator('..')).toContainText('mínimo $ 50.000');
  await page.getByTestId('valor').fill('30000');
  await page.getByTestId('btn-continuar-2').click();
  await expect(page.getByTestId('error-caja')).toHaveText('El abono mínimo es $ 50.000');
  await page.getByTestId('valor').fill('100000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0011/);
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado')).toContainText('$ 100.000');
  await newOp(page);
  await page.getByTestId('servicio-SRV-05').click();
  await page.getByTestId('ref-0').fill('2');
  await page.getByTestId('ref-1').fill('301');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 250.000');
  await expect(page.getByTestId('obl-estado')).toHaveText('Pendiente');
});

test('E18/E08/E40: recaudo aprobado, indicadores y anulación en el mismo turno', async ({ page }) => {
  await freshS1(page);
  await expect(await cupoDisponible(page, 'PDV-S1-Recaudos')).toHaveText('$ 3.949.800');
  await enel(page, '4500112100', '100000', 'TX-S-0011');
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado-autorizacion')).toHaveText('AUT-S-100011');
  await expect(await esperadoCaja(page)).toHaveText('$ 828.900');
  await expect(await cupoDisponible(page, 'PDV-S1-Recaudos')).toHaveText('$ 3.851.100');
  // E08
  await page.getByTestId('nav-V02').click();
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 711.400');
  await expect(page.getByTestId('kpi-vigentes')).toHaveText('6');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('88,9 %');
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 2.500');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 1.200');
  await expect(page.getByTestId('ultimas-operaciones').locator('tbody tr').first()).toContainText('TX-S-0011');
  // Obligación pagada: ya no se puede consultar como pendiente.
  await newOp(page);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('error-caja')).toBeVisible();
  // E40: anular el recaudo.
  await page.goto('/caja/resultado?tx=TX-S-0011');
  await page.getByTestId('btn-anular').click();
  await page.getByTestId('motivo-anular').selectOption('Error del cajero');
  await page.getByTestId('confirmar-anular').click();
  await expect(estado(page)).toHaveText('Anulada');
  await expect(page.getByTestId('comprobante')).toContainText('Anulación: Error del cajero');
  await expect(await esperadoCaja(page)).toHaveText('$ 730.200');
  await expect(await cupoDisponible(page, 'PDV-S1-Recaudos')).toHaveText('$ 3.949.800');
  await page.getByTestId('nav-V02').click();
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 2.050');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 1.000');
  await page.getByTestId('nav-V07').click();
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('11 transacciones');
  await page.getByTestId('nav-V10').click();
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('comparacion').locator('tr', { hasText: 'TX-S-0011' })).toContainText('anulada');
  await newOp(page);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112100');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-estado')).toHaveText('Pendiente');
});

test('E29/E35: rechazo por gatillo y desenlace forzado por el panel', async ({ page }) => {
  await freshS1(page);
  await enel(page, '4500112013', '76000', 'TX-S-0011');
  await expect(estado(page)).toHaveText('Rechazada');
  await expect(page.getByTestId('resultado-codigo')).toHaveText('R-13');
  await expect(page.getByTestId('devolver-efectivo')).toHaveText('Devuelva el efectivo al cliente');
  await expect(page.getByTestId('resultado-autorizacion')).toHaveText('—');
  await expect(page.getByTestId('btn-imprimir')).toBeDisabled();
  await expect(await esperadoCaja(page)).toHaveText('$ 730.200');
  await page.getByTestId('nav-V02').click();
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 612.700');
  await expect(page.getByTestId('kpi-tasa')).toHaveText('77,8 %');
  await newOp(page);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112013');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-estado')).toHaveText('Pendiente');
  // E35
  await openPanel(page);
  await page.getByTestId('panel-autorizacion').selectOption('rechazar');
  await enel(page, '4500112100', '100000', 'TX-S-0012');
  await expect(estado(page)).toHaveText('Rechazada');
  await expect(page.getByTestId('panel-autorizacion')).toHaveValue('gatillo');
});

test('E30/E31/E32: timeout → consulta aprobada, rechazada definitiva y en proceso', async ({ page }) => {
  await freshS1(page);
  // E30 (complementa la prueba existente): reserva de cupo y sin TX nueva.
  await enel(page, '4500112408', '28000', 'TX-S-0011');
  await expect(estado(page)).toHaveText('En verificación');
  await expect(page.getByTestId('resultado-mensaje')).toHaveText(
    'Sin respuesta del autorizador (simulado): operación en verificación'
  );
  await expect(page.getByTestId('btn-reintentar')).toHaveCount(0);
  await page.getByTestId('nav-V08').click();
  await expect(page.getByTestId('cupo-PDV-S1-Recaudos').getByTestId('en-verificacion')).toHaveText('$ 148.000');
  await page.goto('/caja/resultado?tx=TX-S-0011');
  await page.getByTestId('btn-consultar').click();
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('traza')).toContainText('Enviando');
  await expect(page.getByTestId('traza')).toContainText('En verificación');
  await expect(page.getByTestId('traza')).toContainText('Aprobada');
  await page.getByTestId('nav-V07').click();
  await expect(page.getByTestId('fila-TX-S-0012')).toHaveCount(0);

  // E31: 409 → rechazada definitiva, se suelta la reserva y la obligación vuelve a Pendiente.
  await enel(page, '4500112409', '29000', 'TX-S-0012');
  await expect(estado(page)).toHaveText('En verificación');
  await page.getByTestId('btn-consultar').click();
  await expect(estado(page)).toHaveText('Rechazada');
  await expect(page.getByTestId('mensaje-accion')).toHaveText('Rechazada definitiva: no se reintenta');
  await expect(page.getByTestId('mensaje-accion')).toHaveClass(/text-error/);
  await expect(page.getByTestId('btn-reintentar')).toHaveCount(0);
  await page.getByTestId('nav-V08').click();
  await expect(page.getByTestId('cupo-PDV-S1-Recaudos').getByTestId('en-verificacion')).toHaveText('$ 120.000');
  await newOp(page);
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112409');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-estado')).toHaveText('Pendiente');

  // E32: 410 → en proceso → aprobada a la segunda consulta.
  await enel(page, '4500112410', '30000', 'TX-S-0013');
  await page.getByTestId('btn-consultar').click();
  await expect(page.getByTestId('mensaje-accion')).toHaveText('En proceso: continúe consultando');
  await expect(page.getByTestId('mensaje-accion')).toHaveClass(/text-warning/);
  await expect(estado(page)).toHaveText('En verificación');
  await page.getByTestId('btn-consultar').click();
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado-consultas')).toHaveText('2');
});

test('E33/E34: sin registro con y sin idempotencia', async ({ page }) => {
  await freshS1(page);
  await enel(page, '4500112404', '24000', 'TX-S-0011');
  await page.getByTestId('btn-consultar').click();
  await expect(page.getByTestId('mensaje-accion')).toHaveText('Sin registro en Reval (simulado)');
  await expect(page.getByTestId('btn-reintentar')).toHaveText('Reintentar con la misma clave IDEM-TX-S-0011');
  await page.getByTestId('btn-reintentar').click();
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado')).toContainText('IDEM-TX-S-0011');
  await page.getByTestId('nav-V10').click();
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('comparacion').locator('tr', { hasText: 'TX-S-0011' })).toHaveCount(1);
  await expect(page.getByTestId('comparacion').locator('tr', { hasText: 'TX-S-0011' })).toContainText('Conciliada');

  // E34: idempotencia = No.
  await openPanel(page);
  await page.getByTestId('panel-idempotencia').uncheck();
  await enel(page, '4500111404', '24000', 'TX-S-0012');
  await page.getByTestId('btn-consultar').click();
  await expect(page.getByTestId('mensaje-accion')).toContainText('Sin idempotencia: no se reintenta; queda para conciliación');
  await expect(page.getByTestId('mensaje-accion')).not.toHaveClass(/text-success/);
  await expect(estado(page)).toHaveText('En verificación');
  await expect(page.getByTestId('btn-reintentar')).toHaveCount(0);
  await page.getByTestId('nav-V10').click();
  await expect(page.getByTestId('excepcion-TX-S-0012').getByTestId('excepcion-tipo')).toContainText('Solo en IT2Pay');
});

test('E36/E37: comprobante DEMO completo, vista de impresión y sin comprobante en verificación', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints++;
    };
  });
  await freshS1(page);
  await enel(page, '4500112100', '100000', 'TX-S-0011');
  const r = page.getByTestId('comprobante');
  for (const t of [
    'IT2Pay · COMPROBANTE DEMO',
    'Cadena: Mercado Central Demo · Sucursal Norte',
    'PDV: PDV-S1',
    'Caja: CJ-S1-01',
    'Cajero: CAJ-S01',
    'Fecha y hora:',
    'Servicio: ENEL (ficticio)',
    'Referencia: 4500112100',
    'Valor: $ 98.700',
    'Medio: Efectivo',
    'Recibido: $ 100.000',
    'Cambio: $ 1.300',
    'Autorización (simulada): AUT-S-100011',
    'Transacción: TX-S-0011',
    'Autorizador: Reval (simulado)',
  ]) {
    await expect(r).toContainText(t);
  }
  await page.keyboard.press('F8');
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('banda-simulacion')).toBeVisible();
  await expect(r).toBeVisible();
  await expect(r.getByTestId('marca-agua')).toBeVisible();
  await expect(r.getByTestId('leyenda-cabecera')).toBeVisible();
  await expect(r.getByTestId('leyenda-pie')).toBeVisible();
  await expect(page.getByTestId('menu')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  // E37
  await page.goto('/caja/resultado?tx=TX-S-0010');
  await expect(page.getByTestId('sin-comprobante')).toHaveText('No entregue comprobante: operación en verificación');
  await expect(page.getByTestId('comprobante')).toHaveCount(0);
  await expect(page.getByTestId('btn-imprimir')).toBeDisabled();
  await page.keyboard.press('F8');
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(0);
});

test('E39 y reverso rechazado: timeout del reverso sin duplicarlo y nueva solicitud tras rechazo', async ({ page }) => {
  await freshS1(page);
  await recarga(page, 'TX-S-0011');
  await openPanel(page);
  await page.getByTestId('panel-reverso').selectOption('timeout-aprobado');
  await page.getByTestId('btn-reversar').click();
  await page.getByTestId('confirmar-reversar').click();
  await expect(page).toHaveURL(/tx=TX-S-0012/);
  await expect(estado(page)).toHaveText('En verificación');
  await expect(page.getByTestId('btn-consultar')).toHaveText('Consultar estado del reverso');
  await page.goto('/caja/resultado?tx=TX-S-0011');
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('marca-reverso-pv')).toContainText('Reverso en verificación (TX-S-0012)');
  await expect(page.getByTestId('btn-reversar')).toBeDisabled();
  await expect(page.getByTestId('btn-anular')).toBeDisabled();
  await page.getByTestId('btn-consultar-reverso').click();
  await expect(estado(page)).toHaveText('Reversada');
  await expect(page.locator('[data-testid^="vinculada-"]')).toHaveCount(1);
  await openPanel(page);
  await expect(page.getByTestId('panel-reverso')).toHaveValue('aprobado');
  await expect(await esperadoCaja(page)).toHaveText('$ 730.200');
  await expect(await cupoDisponible(page, 'PDV-S1-Recargas')).toHaveText('$ 900.000');

  // Reverso rechazado: la original sigue aprobada y admite una nueva solicitud (R-07).
  await recarga(page, 'TX-S-0013');
  await openPanel(page);
  await page.getByTestId('panel-reverso').selectOption('rechazado');
  await page.getByTestId('btn-reversar').click();
  await page.getByTestId('confirmar-reversar').click();
  await expect(page.getByTestId('mensaje-accion')).toBeVisible();
  await page.goto('/caja/resultado?tx=TX-S-0013');
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('btn-reversar')).toBeEnabled();
  await page.getByTestId('btn-reversar').click();
  await page.getByTestId('confirmar-reversar').click();
  await expect(page).toHaveURL(/tx=TX-S-0015/);
  await expect(estado(page)).toHaveText('Aprobada');
  await page.goto('/caja/resultado?tx=TX-S-0013');
  await expect(estado(page)).toHaveText('Reversada');

  // Timeout del reverso → rechazado.
  await recarga(page, 'TX-S-0016');
  await openPanel(page);
  await page.getByTestId('panel-reverso').selectOption('timeout-rechazado');
  await page.getByTestId('btn-reversar').click();
  await page.getByTestId('confirmar-reversar').click();
  await expect(page).toHaveURL(/tx=TX-S-0017/);
  await page.getByTestId('btn-consultar').click();
  await expect(estado(page)).toHaveText('Rechazada');
  await page.goto('/caja/resultado?tx=TX-S-0016');
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('btn-reversar')).toBeEnabled();
});

test('E41/E42 y retiro: anulación por tipo', async ({ page }) => {
  await freshS1(page);
  await recarga(page, 'TX-S-0011');
  await page.getByTestId('btn-anular').click();
  await expect(page.getByTestId('mensaje-accion')).toHaveText(
    'Las recargas no se anulan en esta simulación; use Reversar (ilustrativo)'
  );
  await expect(estado(page)).toHaveText('Aprobada');

  // E42
  await deposito(page, 'TX-S-0012');
  await expect(page.getByTestId('comprobante')).toContainText('••••6677');
  await page.getByTestId('btn-anular').click();
  await page.getByTestId('confirmar-anular').click();
  await expect(page.getByTestId('mensaje-accion')).toBeVisible();
  await expect(estado(page)).toHaveText('Aprobada');
  await page.getByTestId('supervisor-anular').selectOption('SUP-S01');
  await page.getByTestId('confirmar-anular').click();
  await expect(estado(page)).toHaveText('Anulada');
  await expect(await esperadoCaja(page)).toHaveText('$ 750.200');

  // E22: retiro con OTP válido y con OTP 000000; los retiros no se anulan ni se reversan.
  const retiro = async (otp: string, txId: string) => {
    await newOp(page);
    await page.getByTestId('servicio-SRV-14').click();
    await page.getByTestId('ref-0').fill('1100667788');
    await page.getByTestId('btn-continuar-1').click();
    await page.getByTestId('valor').fill('50000');
    await page.getByTestId('otp').fill(otp);
    await page.getByTestId('btn-continuar-2').click();
    await expect(page.getByTestId('retiro-efectivo')).toBeVisible();
    await page.getByTestId('btn-autorizar').click();
    await expect(page).toHaveURL(new RegExp(`tx=${txId}`));
  };
  await retiro('000000', 'TX-S-0013');
  await expect(estado(page)).toHaveText('Rechazada');
  await expect(page.getByTestId('resultado-codigo')).toHaveText('R-OTP');
  await expect(await esperadoCaja(page)).toHaveText('$ 750.200');
  await retiro('123456', 'TX-S-0014');
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('btn-reversar')).toBeDisabled();
  await page.getByTestId('btn-anular').click();
  await expect(page.getByTestId('mensaje-accion')).toHaveText('Los retiros no se anulan en esta simulación (ilustrativo)');
  await expect(await esperadoCaja(page)).toHaveText('$ 700.200');
});

test('E20/E21/E23: recarga, depósito y tarjeta afectan cupo, efectivo y cierre', async ({ page }) => {
  await freshS1(page);
  await recarga(page, 'TX-S-0011');
  await expect(page.getByTestId('resultado')).toBeVisible();
  await page.getByTestId('nav-V07').click();
  await page.getByTestId('fila-TX-S-0011').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('400 / 200');
  await expect(await cupoDisponible(page, 'PDV-S1-Recargas')).toHaveText('$ 880.000');
  await deposito(page, 'TX-S-0012');
  await expect(await esperadoCaja(page)).toHaveText('$ 950.200');
  await expect(await cupoDisponible(page, 'PDV-S1-Corresponsalía')).toHaveText('$ 2.000.000');
  // E23
  await enelToPay(page, '4500112100');
  await page.getByTestId('medio-debito').check();
  await expect(page.getByTestId('btn-autorizar')).toBeDisabled();
  await page.getByTestId('btn-simular-medio').click();
  await expect(page.getByTestId('btn-simular-medio')).toHaveText(/Simular lectura en datáfono simulado/);
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0013/);
  await expect(estado(page)).toHaveText('Aprobada');
  await expect(page.getByTestId('comprobante')).toContainText('Medio: Tarjeta débito');
  await expect(await esperadoCaja(page)).toHaveText('$ 950.200');
  await page.getByTestId('nav-V09').click();
  await page.getByTestId('cierre-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('esperado-debito')).toContainText('$ 98.700');
});

test('E27: bloqueo por cupo insuficiente y por PDV sin cupo', async ({ page }) => {
  await fresh(page);
  await login(page, 'CAD-S1', 'SUC-S2', 'CJ-S2-01', 'CAJ-S03');
  await enelToPay(page, '4500112100');
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page.getByTestId('error-caja')).toHaveText('Cupo insuficiente: disponible $ 50.000 en Recaudos de PDV-S2');
  await expect(page).toHaveURL(/\/caja$/);
  await page.getByTestId('nav-V08').click();
  await expect(page.getByTestId('alertas-cupo')).toContainText('PDV-S2');
  await expect(page.locator('[data-testid^="alerta-ALR-"]')).toHaveCount(1);
  await page.getByTestId('nav-V02').click();
  await expect(page.getByTestId('kpi-bloqueos')).toHaveText('1');

  // PDV-S4 sin cupo (creado en V03, habilitado por herencia de CAD-S1).
  await page.getByTestId('nav-V03').click();
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
  await login(page, 'CAD-S1', 'SUC-S4', 'CJ-S4-01', 'CAJ-S05');
  await expect(page.getByTestId('servicio-SRV-01')).toContainText('Sin cupo asignado');
  await enelToPay(page, '4500112100');
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page.getByTestId('error-caja')).toHaveText('PDV sin cupo asignado para Recaudos');
  await page.getByTestId('nav-V08').click();
  await expect(page.locator('[data-testid^="alerta-ALR-"]')).toHaveCount(2);
  await expect(page.getByTestId('alertas-cupo')).toContainText('PDV-S4');
  // La próxima transacción sigue siendo TX-S-0011.
  await page.getByTestId('nav-V07').click();
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('10 transacciones');
});
