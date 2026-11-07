import { expect, Page, test } from '@playwright/test';
import { ingresarComo, irA, limpio } from './sesion';

/**
 * QA T.4c — Reglas de borde en la interfaz: R-06/R-07 con turno cerrado,
 * R-09 (retiro sin efectivo en caja), R-20 (validaciones de captura),
 * habilitación efectiva (R-21/FM-27), entidades inactivas y FM-26.
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

const fresh = (page: Page, scenario: 'SUP' | 'PAR' = 'SUP') => limpio(page, scenario);

const ROUTES: Record<string, string> = {
  V01: 'inicio', V02: 'dashboard', V03: 'red', V04: 'convenios', V05: 'caja', V06: 'caja/resultado',
  V07: 'transacciones', V08: 'cupos', V09: 'cierre', V10: 'conciliacion', V11: 'compensacion', V12: 'finanzas',
};
const nav = (page: Page, id: string) => irA(page, ROUTES[id]);

/** El Colocador entra y retoma el turno abierto de su caja (D-T4). */
const login = async (page: Page, user: string) => {
  await ingresarComo(page, user);
  await expect(page).toHaveURL(/\/caja$/);
};

const newOp = async (page: Page) => {
  await nav(page, 'V05');
  await expect(page).toHaveURL(/\/caja$/);
  await page.keyboard.press('F1');
};

test('R-06/R-07: con el turno de la original cerrado no se anula ni se reversa', async ({ page }) => {
  await fresh(page);
  await login(page, 'COL-S04');
  // Recaudo Acueducto 7788002 (obligación generada) en efectivo.
  await page.getByTestId('servicio-SRV-02').click();
  await page.getByTestId('ref-0').fill('7788002');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 22.000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('22000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0011/);
  await nav(page, 'V09');
  await page.getByTestId('cierre-declarado').fill('142000');
  await page.getByTestId('btn-confirmar-cierre').click();
  await expect(page.getByTestId('cierre-clasificacion')).toHaveText('Cuadrada');
  await page.goto('/caja/resultado?tx=TX-S-0011');
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');
  // Con el turno cerrado, el Colocador ve «Anular» deshabilitado y explicado; no ve «Reversar».
  await expect(page.getByTestId('btn-anular')).toBeDisabled();
  await expect(page.getByTestId('btn-anular')).toHaveAttribute('title', /Turno cerrado/);
  await expect(page.getByTestId('btn-reversar')).toHaveCount(0);
  await expect(page.getByTestId('turno-cerrado')).toBeVisible();
  // El Operador, único que reversa (RN-ACC-05), lo ve deshabilitado y explicado.
  await ingresarComo(page, 'OPE-S01');
  await page.goto('/caja/resultado?tx=TX-S-0011');
  await expect(page.getByTestId('btn-reversar')).toBeDisabled();
  await expect(page.getByTestId('btn-reversar')).toHaveAttribute('title', /Turno cerrado/);
  await expect(page.getByTestId('btn-anular')).toHaveCount(0);
  await expect(page.getByTestId('turno-cerrado')).toBeVisible();
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');
  await nav(page, 'V07');
  await expect(page.getByTestId('fila-TX-S-0012')).toHaveCount(0);
});

test('R-07: en V10 el reverso técnico se deshabilita con el turno de la original cerrado', async ({ page }) => {
  await fresh(page, 'PAR');
  await login(page, 'COL-P01');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 445.000');
  await nav(page, 'V09');
  await page.getByTestId('cierre-declarado').fill('445000');
  await page.getByTestId('btn-confirmar-cierre').click();
  await expect(page.getByTestId('cierre-clasificacion')).toHaveText('Cuadrada');
  await ingresarComo(page, 'FIN-P01');
  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('reverso-tecnico-TX-P-0005')).toBeDisabled();
  await expect(page.getByTestId('reverso-tecnico-TX-P-0005')).toHaveAttribute('title', /Turno cerrado/);
  await expect(page.getByTestId('turno-cerrado-TX-P-0005')).toBeVisible();
  await expect(page.getByTestId('excepcion-TX-P-0005').getByTestId('excepcion-resolucion')).toHaveText('abierta');
});

test('R-09/FM-23: el retiro exige efectivo esperado suficiente en el turno', async ({ page }) => {
  await fresh(page, 'PAR');
  await login(page, 'COL-P02');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 150.000');
  await page.getByTestId('servicio-SRV-14').click();
  await page.getByTestId('ref-0').fill('1100667788');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('200000');
  await page.getByTestId('otp').fill('123456');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('btn-autorizar').click();
  await expect(page.getByTestId('error-caja')).toBeVisible();
  await expect(page).toHaveURL(/\/caja$/);
  // El Colocador solo ve sus movimientos: el conteo de la red lo ve el Operador.
  await ingresarComo(page, 'OPE-P01');
  await nav(page, 'V07');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('8 transacciones');
});

test('R-20: validaciones de captura de referencias, celular, cuenta, rango y OTP', async ({ page }) => {
  await fresh(page);
  await login(page, 'COL-S01');
  const err = page.getByTestId('error-caja');
  // Referencia de longitud inválida.
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('45001');
  await page.getByTestId('btn-continuar-1').click();
  await expect(err).toBeVisible();
  await expect(page.getByTestId('paso-1')).toHaveClass(/bg-primary/);
  // Celular que no empieza por 3: se valida al avanzar del paso 1 (R-20 temprana).
  await newOp(page);
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('2001112233');
  await page.getByTestId('btn-continuar-1').click();
  await expect(err).toHaveText('El número celular debe tener 10 dígitos e iniciar por 3');
  await expect(page.getByTestId('paso-1')).toHaveClass(/bg-primary/);
  // Valor de recarga fuera de rango: se valida al avanzar del paso 2.
  await newOp(page);
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('250000');
  await page.getByTestId('btn-continuar-2').click();
  await expect(err).toHaveText('El valor debe estar entre $ 1.000 y $ 200.000');
  await expect(page.getByTestId('paso-2')).toHaveClass(/bg-primary/);
  // Cuenta de depósito de 9 dígitos: se valida al avanzar del paso 1.
  await newOp(page);
  await page.getByTestId('servicio-SRV-13').click();
  await page.getByTestId('ref-1').fill('110055667');
  await page.getByTestId('btn-continuar-1').click();
  await expect(err).toHaveText('«Número de cuenta» debe tener 10 dígitos');
  await expect(page.getByTestId('paso-1')).toHaveClass(/bg-primary/);
  // OTP de 5 dígitos.
  await newOp(page);
  await page.getByTestId('servicio-SRV-14').click();
  await page.getByTestId('ref-0').fill('1100667788');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('50000');
  await page.getByTestId('otp').fill('12345');
  await page.getByTestId('btn-continuar-2').click();
  await expect(err).toHaveText('Ingrese un OTP de 6 dígitos');
  await ingresarComo(page, 'OPE-S01');
  await nav(page, 'V07');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('10 transacciones');
});

test('FM-27/§2.2: regla de PDV prevalece, servicio y cadena inactivos no se ofrecen', async ({ page }) => {
  await fresh(page);
  await ingresarComo(page, 'SU-S01');
  await nav(page, 'V04');
  await page.getByTestId('hab-servicio').selectOption('SRV-01');
  await page.getByTestId('hab-pdv-PDV-S1').selectOption('no');
  await expect(page.getByTestId('hab-efectivo-PDV-S1')).toHaveText('No');
  await page.getByTestId('srv-SRV-02').getByRole('button', { name: 'Inactivar' }).click();
  await login(page, 'COL-S01');
  await expect(page.getByTestId('servicio-SRV-01')).toHaveCount(0);
  await expect(page.getByTestId('servicio-SRV-02')).toHaveCount(0);
  await expect(page.getByTestId('servicio-SRV-03')).toBeVisible();
  // El Operador inactiva la cadena: deja de contar en la red activa.
  await ingresarComo(page, 'OPE-S01');
  await nav(page, 'V03');
  await page.getByTestId('cadena-CAD-S2').getByRole('button', { name: 'Inactivar' }).click();
  await nav(page, 'V01');
  await expect(page.getByTestId('tarjeta-SUP').getByTestId('cov-cadenas')).toHaveText('1');
});

test('FM-26 y enlaces del dashboard: V07 → V06 y KPI → consulta filtrada', async ({ page }) => {
  await fresh(page);
  await ingresarComo(page, 'OPE-S01');
  await nav(page, 'V02');
  await page.getByTestId('link-en-verificacion').click();
  await expect(page).toHaveURL(/estado=PENDING_VERIFICATION/);
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('1 transacciones');
  await page.getByTestId('fila-TX-S-0010').click();
  await page.getByTestId('btn-ver-comprobante').click();
  await expect(page).toHaveURL(/\/caja\/resultado\?tx=TX-S-0010/);
  await expect(page.getByTestId('sin-comprobante')).toBeVisible();
  // Consultar desde V07 también resuelve (R-04: V06, V07, V09 o V10).
  await nav(page, 'V07');
  await page.getByTestId('fila-TX-S-0010').click();
  await page.getByTestId('detalle-transaccion').getByTestId('btn-consultar').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Aprobada');
});

test('FM-02 (D-T4): el Punto de Venta solo ve su PDV y el Colocador solo su caja', async ({ page }) => {
  await fresh(page);
  await ingresarComo(page, 'PV-S01');
  await expect(page.getByTestId('rol-sesion')).toHaveText('Punto de Venta');
  await nav(page, 'V03');
  await expect(page.getByTestId('seccion-cajas').locator('[data-testid^="caja-CJ-"]')).toHaveCount(2);
  await expect(page.getByTestId('caja-CJ-S1-02')).toBeVisible();
  await expect(page.getByTestId('caja-CJ-S2-01')).toHaveCount(0);
  await page.goto('/caja');
  await expect(page).toHaveURL(/\/inicio$/);
  await ingresarComo(page, 'COL-S02');
  await expect(page.getByTestId('sesion-encabezado')).toContainText('Colocador Demo 02 (COL-S02)');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 200.000');
});
