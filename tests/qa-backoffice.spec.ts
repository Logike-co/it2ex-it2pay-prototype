import { expect, Page, test } from '@playwright/test';
import { enGuia } from './guia';

/**
 * QA T.4c — Red, convenios, cupos, cierre, conciliación, compensación y
 * gestión financiera en la interfaz (E09..E15, E45, E47..E54, E57, E59).
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

const ILLUSTRATIVE = 'Ilustrativo — sujeto a validación del responsable funcional';

const fresh = async (page: Page) => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
};

const nav = (page: Page, id: string) => page.getByTestId(`nav-${id}`).click();

const login = async (page: Page, chain: string, branch: string, register: string, user: string) => {
  await nav(page, 'V01');
  await page.getByTestId('sel-cadena').selectOption(chain);
  await page.getByTestId('sel-sucursal').selectOption(branch);
  await page.getByTestId('sel-caja').selectOption(register);
  await page.getByTestId('sel-usuario').selectOption(user);
  await page.getByTestId('btn-ingresar').click();
  await expect(page).toHaveURL(/\/caja$/);
};

const newOp = async (page: Page) => {
  await nav(page, 'V05');
  await expect(page).toHaveURL(/\/caja$/);
  await page.keyboard.press('F1');
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

test('E09..E15: red y convenios (crear, editar, habilitar, comisión diferenciada)', async ({ page }) => {
  await fresh(page);
  // E09
  await nav(page, 'V03');
  await page.getByTestId('nueva-cadena').fill('Mercado Express Demo');
  await page.getByTestId('crear-cadena').click();
  const cad = page.getByTestId('cadena-CAD-S3');
  await expect(cad).toContainText('Mercado Express Demo');
  await expect(cad).toContainText('Activa');
  await expect(cad).toContainText('ficticio');
  await page.getByTestId('editar-CAD-S3').click();
  await page.getByTestId('editar-nombre-cadena').fill('Mercado Express Demo 2');
  await page.getByTestId('guardar-cadena').click();
  await expect(cad).toContainText('Mercado Express Demo 2');
  await nav(page, 'V01');
  await expect(page.getByTestId('sel-cadena')).toContainText('Mercado Express Demo 2');
  await nav(page, 'V02');
  await expect(page.getByTestId('dash-cadena')).toContainText('Mercado Express Demo 2');

  // E10/E11/E12
  await nav(page, 'V03');
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await page.getByTestId('pdv-sucursal').selectOption('SUC-S4');
  await page.getByTestId('nuevo-pdv').fill('Punto de servicios Nuevo');
  await page.getByTestId('crear-pdv').click();
  await page.getByTestId('caja-pdv').selectOption('PDV-S4');
  await page.getByTestId('crear-caja').click();
  await expect(page.getByTestId('caja-CJ-S4-01')).toContainText('Cerrada');
  await page.getByTestId('nuevo-usuario').fill('Cajero Demo 05');
  await page.getByTestId('usuario-perfil').selectOption('Cajero');
  await page.getByTestId('usuario-caja').selectOption('CJ-S4-01');
  await page.getByTestId('crear-usuario').click();
  await expect(page.getByTestId('caja-CJ-S4-01')).toContainText('CAJ-S05');
  await page.getByTestId('dispositivo-caja').selectOption('CJ-S4-01');
  await page.getByTestId('dispositivo-tipo').selectOption('Terminal web');
  await page.getByTestId('dispositivo-serial').fill('SIM-S-0007');
  await page.getByTestId('crear-dispositivo').click();
  await expect(page.getByTestId('dispositivo-DSP-S4-01')).toContainText('SIM-S-0007');
  await nav(page, 'V01');
  const cov = page.getByTestId('cobertura-SUP');
  await expect(cov.getByTestId('cov-sucursales')).toHaveText('4');
  await expect(cov.getByTestId('cov-pdv')).toHaveText('4');
  await expect(cov.getByTestId('cov-cajas')).toHaveText('5');
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S4');
  await page.getByTestId('sel-caja').selectOption('CJ-S4-01');
  await expect(page.getByTestId('sel-usuario')).toContainText('Cajero Demo 05 (CAJ-S05)');
  await nav(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-S4-Recaudos')).toHaveCount(0);
  // E03: ingresar a una caja sin turno abre T-S4-01 con base 100.000.
  await login(page, 'CAD-S1', 'SUC-S4', 'CJ-S4-01', 'CAJ-S05');
  await expect(page.getByTestId('caja-encabezado')).toContainText('Abierta · T-S4-01');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 100.000');

  // E13
  await nav(page, 'V04');
  await expect(page.getByTestId('catalogo-propuesto')).toHaveText('Catálogo propuesto');
  await page.getByTestId('srv-nombre').fill('Recaudo Gimnasio Demo');
  await page.getByTestId('srv-categoria').selectOption({ label: '2 Recaudos y pagos de obligaciones' });
  await page.getByTestId('srv-subcategoria').fill('Pagos de facturas');
  await page.getByTestId('srv-tipo').selectOption('recaudo');
  await page.getByTestId('srv-referencia').fill('Número de socio');
  await page.getByTestId('srv-longitud').fill('8');
  await page.getByTestId('srv-extemporaneo').check();
  await page.getByTestId('crear-servicio').click();
  await expect(page.getByTestId('srv-SRV-18')).toContainText('Recaudo Gimnasio Demo');
  await expect(page.getByTestId('srv-SRV-18')).toContainText('400 / 200');
  await expect(page.getByTestId('srv-SRV-18')).toContainText('Activo');

  // E14
  await page.getByTestId('hab-servicio').selectOption('SRV-06');
  await page.getByTestId('hab-pdv-PDV-S1').selectOption('si');
  await expect(page.getByTestId('hab-efectivo-PDV-S1')).toHaveText('Sí');
  await expect(page.getByTestId('hab-efectivo-PDV-S2')).toHaveText('No');

  // E15
  await page.getByTestId('com-servicio').selectOption('SRV-10');
  await page.getByTestId('com-cadena').selectOption('CAD-S1');
  await page.getByTestId('com-valor-cadena').fill('350');
  await page.getByTestId('com-valor-it2ex').fill('200');
  await page.getByTestId('guardar-comision').click();
  await expect(page.getByTestId('seccion-comisiones')).toContainText('350 / 200');
  await expect(page.getByTestId('seccion-comisiones').getByTestId('ilustrativo')).toContainText(ILLUSTRATIVE);

  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-01', 'CAJ-S01');
  await expect(page.getByTestId('servicio-SRV-06')).toBeVisible();
  await expect(page.getByTestId('servicio-SRV-18')).toHaveCount(0);
  await recarga(page, 'TX-S-0011');
  await nav(page, 'V07');
  await page.getByTestId('fila-TX-S-0011').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('350 / 200');
  await page.getByTestId('fila-TX-S-0003').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('400 / 200');
  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-02', 'CAJ-S02');
  await expect(page.getByTestId('servicio-SRV-06')).toBeVisible();
  await login(page, 'CAD-S1', 'SUC-S2', 'CJ-S2-01', 'CAJ-S03');
  await expect(page.getByTestId('servicio-SRV-06')).toHaveCount(0);
});

test('E45: definir cupo quita la alerta y actualiza el dashboard', async ({ page }) => {
  await fresh(page);
  await nav(page, 'V08');
  const row = page.getByTestId('cupo-PDV-S2-Recaudos');
  await expect(row.getByTestId('disponible')).toHaveText('$ 50.000');
  await page.getByTestId('asignado-PDV-S2-Recaudos').fill('2500000');
  await page.getByTestId('guardar-PDV-S2-Recaudos').click();
  await expect(row.getByTestId('disponible')).toHaveText('$ 550.000');
  await expect(row.getByTestId('alerta-cupo')).toHaveCount(0);
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-cupos-alerta')).toHaveText('0');
});

test('E47/E48/E49: cierre cuadrado, faltante, sobrante y bloqueo por verificación', async ({ page }) => {
  await fresh(page);
  await login(page, 'CAD-S2', 'SUC-S3', 'CJ-S3-01', 'CAJ-S04');
  await nav(page, 'V09');
  await expect(page.getByTestId('cierre-caja')).toHaveValue('CJ-S3-01');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 120.000');
  await expect(page.getByTestId('esperado-debito')).toContainText('$ 62.500');
  await page.getByTestId('cierre-declarado').fill('110000');
  await page.getByTestId('btn-confirmar-cierre').click();
  const res = page.getByTestId('resultado-cierre');
  await expect(res).toContainText('CIE-S-001');
  await expect(res.getByTestId('cierre-diferencia')).toHaveText('−10.000');
  await expect(res.getByTestId('cierre-clasificacion')).toHaveText('Faltante');
  await expect(res.getByTestId('ilustrativo')).toContainText(ILLUSTRATIVE);
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-dif-cierre')).toHaveText('−10.000');
  await nav(page, 'V05');
  await expect(page.getByTestId('caja-cerrada')).toContainText('Caja cerrada: abra un turno para operar');
  await nav(page, 'V01');
  await page.getByTestId('sel-cadena').selectOption('CAD-S2');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S3');
  await expect(page.getByTestId('sel-caja')).toContainText('CJ-S3-01 · PDV-S3 · Cerrada');

  // Nuevo turno y sobrante.
  await nav(page, 'V05');
  await page.getByTestId('btn-abrir-turno').click();
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 100.000');
  await nav(page, 'V09');
  await page.getByTestId('cierre-caja').selectOption('CJ-S3-01');
  await page.getByTestId('cierre-declarado').fill('105000');
  await page.getByTestId('btn-confirmar-cierre').click();
  await expect(page.getByTestId('cierre-diferencia')).toHaveText('+5.000');
  await expect(page.getByTestId('cierre-clasificacion')).toHaveText('Sobrante');
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-dif-cierre')).toHaveText('−5.000');

  // Cuadrada.
  await nav(page, 'V05');
  await page.getByTestId('btn-abrir-turno').click();
  await nav(page, 'V09');
  await page.getByTestId('cierre-caja').selectOption('CJ-S3-01');
  await page.getByTestId('cierre-declarado').fill('100000');
  await page.getByTestId('btn-confirmar-cierre').click();
  await expect(page.getByTestId('cierre-clasificacion')).toHaveText('Cuadrada');

  // E49
  await page.getByTestId('cierre-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('cierre-bloqueado')).toContainText(
    '1 transacción en verificación (TX-S-0010): resuélvala antes de cerrar'
  );
  await page.getByTestId('cierre-declarado').fill('850200');
  await expect(page.getByTestId('btn-confirmar-cierre')).toBeDisabled();
  await page.getByTestId('cierre-consultar-TX-S-0010').click();
  await expect(page.getByTestId('cierre-bloqueado')).toHaveCount(0);
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 850.200');
  await expect(page.getByTestId('btn-confirmar-cierre')).toBeEnabled();
});

test('E51/E53/E54: conciliación por consulta y ajuste, consignaciones', async ({ page }) => {
  await fresh(page);
  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await page.getByTestId('consultar-TX-S-0010').click();
  await expect(page.getByTestId('resuelta-TX-S-0010')).toContainText('resuelta por consulta');
  await expect(page.getByTestId('conc-comparados')).toHaveText('9');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('8');
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 732.700');
  await nav(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-S1-Recaudos').getByTestId('utilizado')).toHaveText('$ 1.050.200');
  await expect(page.getByTestId('cupo-PDV-S1-Recaudos').getByTestId('en-verificacion')).toHaveText('$ 0');

  // E53
  await nav(page, 'V10');
  await page.getByTestId('ajuste-TX-S-0006').click();
  await expect(page.getByTestId('aviso')).toBeVisible();
  await expect(page.getByTestId('excepcion-TX-S-0006').getByTestId('excepcion-resolucion')).toHaveText('abierta');
  await page.getByTestId('nota-TX-S-0006').fill('Ajuste ilustrativo');
  await page.getByTestId('ajuste-TX-S-0006').click();
  await expect(page.getByTestId('resuelta-TX-S-0006')).toContainText('resuelta con ajuste');
  await expect(page.getByTestId('conc-abiertas')).toHaveText('0');
  await nav(page, 'V07');
  await page.getByTestId('fila-TX-S-0006').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('$ 85.000');
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Aprobada');
  await nav(page, 'V11');
  await expect(page.getByTestId('comp-diferencias')).toHaveText('$ 27.000');

  // E54
  await page.getByTestId('con-pdv').selectOption('PDV-S2');
  await page.getByTestId('con-linea').selectOption('Recaudos');
  await page.getByTestId('con-valor').fill('1000000');
  await page.getByTestId('btn-consignar').click();
  await expect(page.getByTestId('consignacion-CON-S-003').getByTestId('consignacion-estado')).toHaveText('Reportada');
  await page.getByTestId('validar-CON-S-002').click();
  await expect(page.getByTestId('consignacion-CON-S-002').getByTestId('consignacion-estado')).toHaveText('Validada');
  await expect(page.getByTestId('efectivo-entregado')).toHaveText('$ 800.000');
  await page.getByTestId('rechazar-CON-S-003').click();
  await expect(page.getByTestId('consignacion-CON-S-003').getByTestId('consignacion-estado')).toHaveText('Rechazada');
  // R-12: el valor no puede superar el utilizado de la línea.
  await page.getByTestId('con-pdv').selectOption('PDV-S3');
  await page.getByTestId('con-linea').selectOption('Recargas');
  await page.getByTestId('con-valor').fill('30000');
  await page.getByTestId('btn-consignar').click();
  await expect(page.getByTestId('aviso')).toHaveClass(/text-error/);
  await expect(page.getByTestId('consignacion-CON-S-004')).toHaveCount(0);
  await nav(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-S1-Recaudos').getByTestId('utilizado')).toHaveText('$ 750.200');
  await expect(page.getByTestId('cupo-PDV-S2-Recaudos').getByTestId('utilizado')).toHaveText('$ 1.950.000');
});

test('E57/E59: liquidación snapshot y cuenta de cobro de ejemplo', async ({ page }) => {
  await fresh(page);
  await nav(page, 'V12');
  await page.getByTestId('btn-cuenta-cobro').click();
  await expect(page.getByTestId('aviso')).toContainText('Primero liquide el periodo demo');
  await page.getByTestId('btn-liquidar').click();
  const liq = page.getByTestId('liquidacion-LIQ-S-001');
  await expect(liq).toContainText('Liquidada (ilustrativa)');
  await expect(liq.getByTestId('snap-tx')).toHaveText('5');
  await expect(liq.getByTestId('snap-total')).toHaveText('$ 3.050');
  await page.getByTestId('btn-cuenta-cobro').click();
  const cc = page.getByTestId('documento-cc');
  await expect(page.getByTestId('cc-numero')).toHaveText('CC-DEMO-S-0001');
  await expect(page.getByTestId('cc-emisor')).toHaveText('IT2EX S.A.S. (datos ficticios)');
  await expect(page.getByTestId('cc-receptor')).toHaveText('Reval (simulado)');
  await expect(page.getByTestId('cc-concepto')).toHaveText('Servicio de integración — comisión IT2EX del periodo demo');
  await expect(cc).toContainText('5');
  await expect(page.getByTestId('cc-total')).toHaveText('$ 1.000');
  await expect(cc).toContainText('Impuestos: no calculados en la simulación');
  await expect(cc).toContainText('Documento de ejemplo — sin validez fiscal');
  await expect(cc).toContainText('DEMO');
  await expect(cc).toContainText('SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL');
  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-01', 'CAJ-S01');
  await recarga(page, 'TX-S-0011');
  await nav(page, 'V12');
  await expect(page.getByTestId('liq-total-tx')).toHaveText('6');
  await expect(page.getByTestId('liquidacion-LIQ-S-001').getByTestId('snap-tx')).toHaveText('5');
});

test('E52: reverso técnico en Parqueaderos', async ({ page }) => {
  await fresh(page);
  await (await enGuia(page, 'selector-escenario')).selectOption('PAR');
  await login(page, 'CAD-P1', 'SUC-P1', 'CJ-P1-01', 'CAJ-P01');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 445.000');
  await nav(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await page.getByTestId('reverso-tecnico-TX-P-0005').click();
  await expect(page.getByTestId('resuelta-TX-P-0005')).toContainText('resuelta por reverso técnico');
  await expect(page.getByTestId('conc-comparados')).toHaveText('8');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('8');
  await nav(page, 'V07');
  await page.getByTestId('fila-TX-P-0009').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Reverso');
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Aprobada');
  await expect(page.getByTestId('enlace-TX-P-0005')).toBeVisible();
  await page.getByTestId('fila-TX-P-0005').click();
  await expect(page.getByTestId('detalle-transaccion')).toContainText('Reversada');
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 390.000');
  await expect(page.getByTestId('kpi-com-cadena')).toHaveText('$ 1.500');
  await expect(page.getByTestId('kpi-com-it2ex')).toHaveText('$ 750');
  await nav(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-P1-Recaudos').getByTestId('utilizado')).toHaveText('$ 580.000');
  await nav(page, 'V05');
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 350.000');
});

test('E04/R-18: persistencia al recargar, reinicio aislado por escenario y «Reiniciar todo»', async ({ page }) => {
  await fresh(page);
  // SUP: crear PDV-S4 y aprobar TX-S-0011; abrir panel y cambiar modalidad.
  await nav(page, 'V03');
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await page.getByTestId('pdv-sucursal').selectOption('SUC-S4');
  await page.getByTestId('nuevo-pdv').fill('Punto de servicios Nuevo');
  await page.getByTestId('crear-pdv').click();
  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-01', 'CAJ-S01');
  await recarga(page, 'TX-S-0011');
  await nav(page, 'V11');
  await page.getByTestId('modalidad-descontado').check();
  await nav(page, 'V12');
  await page.getByTestId('btn-liquidar').click();
  await (await enGuia(page, 'btn-presentador')).click();
  await page.getByTestId('panel-idempotencia').uncheck();

  // PAR: una operación.
  await (await enGuia(page, 'selector-escenario')).selectOption('PAR');
  await login(page, 'CAD-P2', 'SUC-P3', 'CJ-P3-01', 'CAJ-P04');
  await recarga(page, 'TX-P-0009');

  // Recargar conserva ambos escenarios y el activo.
  await page.reload();
  await expect((await enGuia(page, 'selector-escenario'))).toHaveValue('PAR');
  await nav(page, 'V07');
  await expect(page.getByTestId('fila-TX-P-0009')).toBeVisible();
  await (await enGuia(page, 'selector-escenario')).selectOption('SUP');
  await expect(page.getByTestId('fila-TX-S-0011')).toBeVisible();
  await expect(page.getByTestId('sesion-encabezado')).toContainText('CJ-S1-01');

  // Reiniciar escenario (SUP).
  await (await enGuia(page, 'btn-reiniciar')).click();
  await expect(page.getByTestId('dialogo-reinicio')).toContainText('el otro escenario no se toca');
  await page.getByTestId('confirmar-reinicio').click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByTestId('sesion-encabezado')).toHaveText(/Sin caja seleccionada/);
  await nav(page, 'V07');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('10 transacciones');
  await nav(page, 'V03');
  await expect(page.getByTestId('seccion-sucursales')).not.toContainText('PDV-S4');
  await nav(page, 'V02');
  await expect(page.getByTestId('kpi-recaudo')).toHaveText('$ 612.700');
  await expect(page.getByTestId('kpi-excepciones')).toHaveText('2');
  await nav(page, 'V11');
  await expect(page.getByTestId('modalidad-separado')).toBeChecked();
  await nav(page, 'V12');
  await expect(page.getByTestId('liquidacion-LIQ-S-001')).toHaveCount(0);
  await nav(page, 'V10');
  await expect(page.getByTestId('corte')).toContainText('sin ejecutar');
  if (!(await page.getByTestId('panel-presentador').isVisible())) {
    await (await enGuia(page, 'btn-presentador')).click();
  }
  await expect(page.getByTestId('panel-idempotencia')).toBeChecked();
  await expect(page.getByTestId('panel-autorizacion')).toHaveValue('gatillo');
  await expect(page.getByTestId('panel-reverso')).toHaveValue('aprobado');
  await login(page, 'CAD-S1', 'SUC-S1', 'CJ-S1-01', 'CAJ-S01');
  await recarga(page, 'TX-S-0011');

  // PAR conserva su estado.
  await (await enGuia(page, 'selector-escenario')).selectOption('PAR');
  await nav(page, 'V07');
  await expect(page.getByTestId('fila-TX-P-0009')).toBeVisible();

  // Reiniciar todo.
  await (await enGuia(page, 'btn-reiniciar-todo')).click();
  await page.getByTestId('confirmar-reinicio').click();
  await nav(page, 'V07');
  await expect(page.getByTestId('fila-TX-P-0009')).toHaveCount(0);
  await (await enGuia(page, 'selector-escenario')).selectOption('SUP');
  await expect(page.getByTestId('fila-TX-S-0011')).toHaveCount(0);
});
