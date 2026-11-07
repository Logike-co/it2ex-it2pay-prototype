import { expect, Page, test } from '@playwright/test';
import { enGuia } from './guia';

/**
 * Recorrido comercial de referencia (flow-map §1) sobre Supermercados,
 * verificando los valores de control de §6.8.
 */

const LEGEND = 'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL';

const go = async (page: Page, path: string) => {
  await page.getByTestId(`nav-${path}`).click();
};

const flashContains = async (page: Page, text: string | RegExp) => {
  await expect(page.getByTestId('aviso')).toContainText(text);
};

const resetScenario = async (page: Page) => {
  await (await enGuia(page, 'btn-reiniciar')).click();
  await page.getByTestId('confirmar-reinicio').click();
  await expect(page).toHaveURL(/\/inicio$/);
};

test('recorrido comercial SUP (pasos 1–8) cuadra con §6.8', async ({ page }) => {
  await page.goto('/inicio');
  await expect(page.getByTestId('banda-simulacion')).toHaveText(LEGEND);

  // Paso 1 · escenario y reinicio (CA-08).
  await resetScenario(page);
  const cobertura = page.getByTestId('cobertura-SUP');
  await expect(cobertura.getByTestId('cov-cadenas')).toHaveText('2');
  await expect(cobertura.getByTestId('cov-pdv')).toHaveText('3');
  await expect(cobertura.getByTestId('cov-cajas')).toHaveText('4');
  await expect(cobertura.getByTestId('cov-servicios')).toHaveText('11');

  // Paso 2 · configurar red, habilitación y cupos.
  await go(page, 'V03');
  await page.getByTestId('sucursal-cadena').selectOption('CAD-S1');
  await page.getByTestId('nueva-sucursal').fill('Sucursal Demo Nueva');
  await page.getByTestId('crear-sucursal').click();
  await flashContains(page, 'SUC-S4');
  await page.getByTestId('pdv-sucursal').selectOption('SUC-S4');
  await page.getByTestId('nuevo-pdv').fill('Punto de servicios Demo Nuevo');
  await page.getByTestId('crear-pdv').click();
  await flashContains(page, 'PDV-S4');
  await page.getByTestId('caja-pdv').selectOption('PDV-S4');
  await page.getByTestId('crear-caja').click();
  await flashContains(page, 'CJ-S4-01');
  await page.getByTestId('nuevo-usuario').fill('Cajero Demo 05');
  await page.getByTestId('usuario-perfil').selectOption('Cajero');
  await page.getByTestId('usuario-caja').selectOption('CJ-S4-01');
  await page.getByTestId('crear-usuario').click();
  await flashContains(page, 'CAJ-S05');
  await page.getByTestId('dispositivo-caja').selectOption('CJ-S4-01');
  await page.getByTestId('crear-dispositivo').click();
  await expect(page.getByTestId('dispositivo-DSP-S4-01')).toContainText('SIM-S-0007');

  await go(page, 'V04');
  await expect(page.getByTestId('catalogo-propuesto')).toBeVisible();
  await page.getByTestId('hab-servicio').selectOption('SRV-06');
  await page.getByTestId('hab-pdv-PDV-S4').selectOption('si');
  await expect(page.getByTestId('hab-efectivo-PDV-S4')).toHaveText('Sí');

  await go(page, 'V08');
  for (const [line, value] of [
    ['Recaudos', '2000000'],
    ['Recargas', '500000'],
    ['Corresponsalía', '1000000'],
  ]) {
    await page.getByTestId('nuevo-cupo-pdv').selectOption('PDV-S4');
    await page.getByTestId('nuevo-cupo-linea').selectOption(line);
    await page.getByTestId('nuevo-cupo-valor').fill(value);
    await page.getByTestId('btn-definir-cupo').click();
    await flashContains(page, `Cupo de ${line} de PDV-S4`);
  }

  // Ingreso a CJ-S4-01 con CAJ-S05 (abre turno con base $ 100.000).
  await go(page, 'V01');
  await expect(page.getByTestId('cobertura-SUP').getByTestId('cov-pdv')).toHaveText('4');
  await expect(page.getByTestId('cobertura-SUP').getByTestId('cov-cajas')).toHaveText('5');
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S4');
  await page.getByTestId('sel-caja').selectOption('CJ-S4-01');
  await expect(page.getByTestId('seleccion-encabezado')).toHaveText(
    'Mercado Central Demo · Sucursal Demo Nueva · PDV-S4 · CJ-S4-01'
  );
  await page.getByTestId('sel-usuario').selectOption('CAJ-S05');
  await page.getByTestId('base-turno').fill('100000');
  await page.getByTestId('btn-ingresar').click();
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 100.000');

  // Paso 3 · recaudo ENEL, operado solo con teclado (F2, Enter, F12).
  await page.keyboard.press('F2');
  await expect(page.getByTestId('buscar-servicio')).toBeFocused();
  await page.keyboard.type('ENEL');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ref-0')).toBeFocused();
  await page.keyboard.type('4500112100');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 98.700');
  await expect(page.getByTestId('obl-titular')).toHaveText('Titular Demo 2100');
  await expect(page.getByTestId('btn-continuar-2')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('efectivo-recibido')).toBeFocused();
  await page.keyboard.type('100000');
  await expect(page.getByTestId('cambio')).toHaveText('$ 1.300');
  await page.keyboard.press('F12');
  await expect(page.getByTestId('enviando')).toBeVisible();
  await expect(page).toHaveURL(/\/caja\/resultado\?tx=TX-S-0011/);
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado-autorizacion')).toHaveText('AUT-S-100011');
  const receipt = page.getByTestId('comprobante');
  await expect(receipt).toContainText('IT2Pay · COMPROBANTE DEMO');
  await expect(receipt.getByTestId('marca-agua')).toHaveText('DEMO');
  await expect(receipt.getByTestId('leyenda-cabecera')).toHaveText(LEGEND);
  await expect(receipt.getByTestId('leyenda-pie')).toHaveText(LEGEND);
  await expect(receipt).toContainText('Autorizador: Reval (simulado)');

  // Paso 4 · recarga MóvilUno $ 20.000.
  await page.keyboard.press('F1');
  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByTestId('buscar-servicio')).toBeVisible();
  await page.keyboard.press('F2');
  await expect(page.getByTestId('buscar-servicio')).toBeFocused();
  await page.keyboard.type('MóvilUno');
  await expect(page.getByTestId('servicio-SRV-01')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('sugerido-20000').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('20000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0012/);
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');

  // Paso 5 · depósito $ 200.000 en la cuenta 1100556677.
  await go(page, 'V05');
  await page.getByTestId('servicio-SRV-13').click();
  await page.getByTestId('ref-0').selectOption('Ahorros');
  await page.getByTestId('ref-1').fill('1100556677');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('valor').fill('200000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('200000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0013/);
  await expect(page.getByTestId('comprobante')).toContainText('••••6677');

  // Paso 6 · cierre de CJ-S4-01 con faltante de $ 8.700.
  await go(page, 'V09');
  await expect(page.getByTestId('cierre-caja')).toHaveValue('CJ-S4-01');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 418.700');
  await page.getByTestId('cierre-declarado').fill('410000');
  await page.getByTestId('btn-confirmar-cierre').click();
  const closing = page.getByTestId('resultado-cierre');
  await expect(closing).toContainText('CIE-S-001');
  await expect(closing.getByTestId('cierre-diferencia')).toHaveText('−8.700');
  await expect(closing.getByTestId('cierre-clasificacion')).toHaveText('Faltante');
  await expect(closing.getByTestId('leyenda')).toHaveText(LEGEND);

  // Paso 7 · conciliar, consignar, liquidar y cuenta de cobro.
  await go(page, 'V10');
  await page.getByTestId('btn-conciliar').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('12');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('10');
  await page.getByTestId('consultar-TX-S-0010').click();
  await expect(page.getByTestId('resuelta-TX-S-0010')).toContainText('resuelta por consulta');
  await page.getByTestId('nota-TX-S-0006').fill('Ajuste ilustrativo de valor');
  await page.getByTestId('ajuste-TX-S-0006').click();
  await expect(page.getByTestId('conc-comparados')).toHaveText('12');
  await expect(page.getByTestId('conc-conciliados')).toHaveText('11');
  await expect(page.getByTestId('conc-ajustes')).toHaveText('1');
  await expect(page.getByTestId('conc-abiertas')).toHaveText('0');

  await go(page, 'V11');
  await page.getByTestId('con-pdv').selectOption('PDV-S4');
  await page.getByTestId('con-linea').selectOption('Recaudos');
  await page.getByTestId('con-valor').fill('98700');
  await page.getByTestId('btn-consignar').click();
  await flashContains(page, 'CON-S-003');
  await page.getByTestId('validar-CON-S-003').click();
  await expect(page.getByTestId('consignacion-CON-S-003').getByTestId('consignacion-estado')).toHaveText('Validada');
  await expect(page.getByTestId('efectivo-entregado')).toHaveText('$ 598.700');
  await expect(page.getByTestId('pendiente-total')).toHaveText('$ 4.202.700');
  await expect(page.getByTestId('pendiente-PDV-S1')).toContainText('$ 1.950.200');
  await expect(page.getByTestId('pendiente-PDV-S4')).toContainText('$ 220.000');
  await expect(page.getByTestId('comp-obligacion')).toHaveText('$ 1.051.400');

  await go(page, 'V12');
  await page.getByTestId('btn-liquidar').click();
  const liq = page.getByTestId('liquidacion-LIQ-S-001');
  await expect(liq.getByTestId('snap-tx')).toHaveText('9');
  await expect(liq.getByTestId('snap-cadena')).toHaveText('$ 3.700');
  await expect(liq.getByTestId('snap-it2ex')).toHaveText('$ 1.800');
  await expect(liq.getByTestId('snap-total')).toHaveText('$ 5.500');
  await page.getByTestId('btn-cuenta-cobro').click();
  await expect(page.getByTestId('cc-numero')).toHaveText('CC-DEMO-S-0001');
  await expect(page.getByTestId('cc-total')).toHaveText('$ 1.800');
  await expect(page.getByTestId('documento-cc')).toContainText('Documento de ejemplo — sin validez fiscal');

  // Paso 8 · dashboard y trazabilidad: valores de control de §6.8.
  await go(page, 'V02');
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
  await expect(page.getByTestId('kpi-pendiente')).toHaveText('$ 4.202.700');
  await expect(page.getByTestId('kpi-excepciones')).toHaveText('0');
  await expect(page.getByTestId('kpi-dif-cierre')).toHaveText('−8.700');
  await expect(page.getByTestId('kpis-financieros').getByTestId('leyenda')).toHaveText(LEGEND);
  await page.getByTestId('ultima-TX-S-0013').click();
  await expect(page).toHaveURL(/\/transacciones\?tx=TX-S-0013/);
  await expect(page.getByTestId('detalle-transaccion')).toContainText('TX-S-0013');
  await expect(page.getByTestId('traza-detalle')).toContainText('Enviando');
  await expect(page.getByTestId('conteo-transacciones')).toHaveText('13 transacciones');

  await go(page, 'V08');
  await expect(page.getByTestId('cupo-PDV-S4-Recaudos').getByTestId('utilizado')).toHaveText('$ 0');
  await expect(page.getByTestId('cupo-PDV-S4-Recargas').getByTestId('utilizado')).toHaveText('$ 20.000');
  await expect(page.getByTestId('cupo-PDV-S4-Corresponsalía').getByTestId('utilizado')).toHaveText('$ 200.000');

  await go(page, 'V09');
  await page.getByTestId('cierre-caja').selectOption('CJ-S1-01');
  await expect(page.getByTestId('esperado-efectivo')).toContainText('$ 850.200');
});

test('variantes guiadas: timeout resuelto por consulta y reverso funcional (CA-05)', async ({ page }) => {
  await page.goto('/inicio');
  await resetScenario(page);
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S1');
  await page.getByTestId('sel-caja').selectOption('CJ-S1-01');
  await page.getByTestId('sel-usuario').selectOption('CAJ-S01');
  await page.getByTestId('btn-ingresar').click();
  await expect(page.getByTestId('efectivo-esperado')).toHaveText('$ 730.200');

  // E30: referencia terminada en 408 → timeout, sin comprobante, consulta → aprobada.
  await page.getByTestId('servicio-SRV-01').click();
  await page.getByTestId('ref-0').fill('4500112408');
  await page.getByTestId('btn-continuar-1').click();
  await expect(page.getByTestId('obl-valor')).toHaveText('$ 28.000');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('28000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0011/);
  await expect(page.getByTestId('resultado-estado')).toHaveText('En verificación');
  await expect(page.getByTestId('sin-comprobante')).toHaveText('No entregue comprobante: operación en verificación');
  await expect(page.getByTestId('btn-imprimir')).toBeDisabled();
  await expect(page.getByTestId('btn-reintentar')).toHaveCount(0);
  await page.getByTestId('btn-consultar').click();
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');
  await expect(page.getByTestId('resultado-autorizacion')).toHaveText('AUT-S-100011');
  await expect(page.getByTestId('traza')).toContainText('Enviando');
  await expect(page.getByTestId('traza')).toContainText('En verificación');

  // E20 + E38: recarga y reverso funcional vinculado.
  await page.keyboard.press('F1');
  await page.getByTestId('servicio-SRV-10').click();
  await page.getByTestId('ref-0').fill('3001112233');
  await page.getByTestId('btn-continuar-1').click();
  await page.getByTestId('sugerido-20000').click();
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('20000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page).toHaveURL(/tx=TX-S-0012/);
  await page.getByTestId('btn-anular').click();
  await expect(page.getByTestId('mensaje-accion')).toHaveText(
    'Las recargas no se anulan en esta simulación; use Reversar (ilustrativo)'
  );
  await page.getByTestId('btn-reversar').click();
  await page.getByTestId('motivo-reversar').selectOption('Solicitud del cliente');
  await page.getByTestId('confirmar-reversar').click();
  await expect(page).toHaveURL(/tx=TX-S-0013/);
  await expect(page.getByTestId('resultado-estado')).toHaveText('Aprobada');
  await expect(page.getByTestId('comprobante')).toContainText('Reverso de: TX-S-0012');
  await page.getByTestId('vinculada-TX-S-0012').click();
  await expect(page.getByTestId('resultado-estado')).toHaveText('Reversada');
  await expect(page.getByTestId('btn-reversar')).toHaveCount(0);
});
