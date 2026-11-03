import { FixedClock } from './clock';
import { rangeError, referenceError, Simulator } from './engine';
import { formatPercent } from './format';
import { ScenarioId, Transaction } from './model';
import { buildSeed } from './seed';
import {
  catalogForRegister,
  chainQuotaConsolidated,
  compensation,
  conciliation,
  coverage,
  expectedByMethod,
  expectedCash,
  indicators,
  liveLiquidationRows,
  liquidationTotals,
  portfolio,
  quotaStatus,
} from './selectors';

const DEMO_DAY = new Date(2026, 9, 25, 10, 0, 0);

const setup = (scenario: ScenarioId = 'SUP') => {
  const clock = new FixedClock(DEMO_DAY);
  const sim = new Simulator(buildSeed(scenario, clock), clock);
  return { sim, clock };
};

const loginS1 = (sim: Simulator) => {
  const r = sim.login('CJ-S1-01', 'CAJ-S01');
  expect(r.ok).toBe(true);
};

const okValue = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) {
    throw new Error(`Se esperaba éxito y llegó: ${r.error}`);
  }
  return r.value;
};

const errorOf = (r: { ok: boolean; error?: string }): string => {
  expect(r.ok).toBe(false);
  return r.error as string;
};

const tx = (sim: Simulator, id: string): Transaction =>
  sim.state.transactions.find((t) => t.id === id) as Transaction;

const recaudoEnel = (sim: Simulator, ref: string, value: number, cash = value) =>
  sim.authorize({ serviceId: 'SRV-01', references: [ref], value, method: 'efectivo', cashReceived: cash });

const recargaMovilUno = (sim: Simulator) =>
  sim.authorize({ serviceId: 'SRV-10', references: ['3001112233'], value: 20_000, method: 'efectivo', cashReceived: 20_000 });

const depositoBanco = (sim: Simulator, account = '1100556677') =>
  sim.authorize({ serviceId: 'SRV-13', references: ['Ahorros', account], value: 200_000, method: 'efectivo', cashReceived: 200_000 });

describe('Motor de simulación — valores de control tras el reinicio (§6.7)', () => {
  it('Supermercados cuadra con §6.7', () => {
    const { sim } = setup('SUP');
    const s = sim.state;
    const ind = indicators(s);
    expect(ind.income).toBe(612_700);
    expect(ind.incomeByLine).toEqual({ Recaudos: 292_700, Recargas: 20_000, Corresponsalía: 300_000 });
    expect(ind.incomeByChain).toEqual({ 'CAD-S1': 530_200, 'CAD-S2': 82_500 });
    expect(ind.current).toBe(5);
    expect(ind.rejected.count).toBe(1);
    expect(ind.voided.count).toBe(1);
    expect(ind.reversed.count).toBe(1);
    expect(ind.inVerification).toEqual({ count: 1, value: 120_000 });
    expect(formatPercent(ind.approvalRate)).toBe('87,5 %');
    expect(ind.authorized).toBe(7);
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([2_050, 1_000]);
    const comp = compensation(s);
    expect(comp.obligation).toBe(612_700);
    expect([comp.delivered, comp.toValidate]).toEqual([500_000, 300_000]);
    expect(comp.pendingToDeliver).toBe(3_862_700);
    expect(comp.pendingByPdv).toEqual([
      { pdvId: 'PDV-S1', value: 1_830_200 },
      { pdvId: 'PDV-S2', value: 1_950_000 },
      { pdvId: 'PDV-S3', value: 82_500 },
    ]);
    const q = (pdv: string, line: 'Recaudos' | 'Recargas' | 'Corresponsalía') => {
      const r = quotaStatus(s, pdv, line);
      return [r.used, r.inVerification, r.available];
    };
    expect(q('PDV-S1', 'Recaudos')).toEqual([930_200, 120_000, 3_949_800]);
    expect(q('PDV-S1', 'Recargas')).toEqual([100_000, 0, 900_000]);
    expect(q('PDV-S1', 'Corresponsalía')).toEqual([800_000, 0, 2_200_000]);
    expect(q('PDV-S2', 'Recaudos')).toEqual([1_950_000, 0, 50_000]);
    expect(q('PDV-S3', 'Recaudos')).toEqual([62_500, 0, 2_937_500]);
    expect(q('PDV-S3', 'Recargas')).toEqual([20_000, 0, 480_000]);
    expect(ind.quotasInAlert).toBe(1);
    expect(quotaStatus(s, 'PDV-S2', 'Recaudos').alert).toBe(true);
    const conc = conciliation(s);
    expect([conc.compared, conc.conciliated, conc.exceptions.length]).toEqual([9, 7, 2]);
    expect(conc.informativeDifferences).toBe(27_000);
    expect(expectedCash(s, 'T-S1-01')).toBe(730_200);
    expect(expectedCash(s, 'T-S1-02')).toBe(200_000);
    expect(expectedCash(s, 'T-S2-01')).toBe(100_000);
    expect(expectedCash(s, 'T-S3-01')).toBe(120_000);
    expect(expectedByMethod(s, 'T-S3-01').debito).toBe(62_500);
    expect(ind.closingDifferences).toBe(0);
    expect(s.counters.TX).toBe(11);
  });

  it('Parqueaderos cuadra con §6.7', () => {
    const { sim } = setup('PAR');
    const s = sim.state;
    const ind = indicators(s);
    expect(ind.income).toBe(485_000);
    expect(ind.incomeByLine).toEqual({ Recaudos: 275_000, Recargas: 60_000, Corresponsalía: 150_000 });
    expect(ind.incomeByChain).toEqual({ 'CAD-P1': 475_000, 'CAD-P2': 10_000 });
    expect([ind.current, ind.rejected.count, ind.voided.count, ind.reversed.count, ind.inVerification.count]).toEqual([5, 1, 0, 1, 0]);
    expect(formatPercent(ind.approvalRate)).toBe('85,7 %');
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([1_900, 950]);
    const comp = compensation(s);
    expect(comp.obligation).toBe(485_000);
    expect([comp.delivered, comp.toValidate]).toEqual([200_000, 100_000]);
    expect(comp.pendingToDeliver).toBe(2_055_000);
    expect(comp.pendingByPdv.map((p) => p.value)).toEqual([1_075_000, 970_000, 10_000]);
    const q = (pdv: string, line: 'Recaudos' | 'Recargas' | 'Corresponsalía') => {
      const r = quotaStatus(s, pdv, line);
      return [r.used, r.inVerification, r.available];
    };
    expect(q('PDV-P1', 'Recaudos')).toEqual([675_000, 0, 2_325_000]);
    expect(q('PDV-P1', 'Recargas')).toEqual([250_000, 0, 1_250_000]);
    expect(q('PDV-P1', 'Corresponsalía')).toEqual([150_000, 0, 850_000]);
    expect(q('PDV-P2', 'Recaudos')).toEqual([970_000, 0, 30_000]);
    expect(q('PDV-P3', 'Recargas')).toEqual([10_000, 0, 990_000]);
    expect(ind.quotasInAlert).toBe(1);
    const conc = conciliation(s);
    expect([conc.compared, conc.conciliated, conc.exceptions.length]).toEqual([7, 6, 1]);
    expect(conc.exceptions[0].classification).toBe('Inconsistencia reportada por Reval (simulado)');
    expect(conc.informativeDifferences).toBe(0);
    expect(expectedCash(s, 'T-P1-01')).toBe(445_000);
    expect(expectedByMethod(s, 'T-P1-01').credito).toBe(180_000);
    expect(expectedCash(s, 'T-P1-02')).toBe(150_000);
    expect(expectedCash(s, 'T-P2-01')).toBe(100_000);
    expect(expectedCash(s, 'T-P3-01')).toBe(110_000);
    expect(ind.closingDifferences).toBe(0);
    expect(s.counters.TX).toBe(9);
  });

  it('E07: filtros del dashboard por cadena y PDV', () => {
    const { sim } = setup();
    const byChain = indicators(sim.state, { chainId: 'CAD-S1' });
    expect([byChain.income, byChain.current]).toEqual([530_200, 3]);
    const byPdv = indicators(sim.state, { pdvId: 'PDV-S3' });
    expect([byPdv.income, byPdv.current]).toEqual([82_500, 2]);
  });

  it('E43/E44: traza de TX-S-0008 y agrupación por caja y sucursal', () => {
    const { sim } = setup();
    expect(sim.state.transactions).toHaveLength(10);
    expect(tx(sim, 'TX-S-0008').trace.map((t) => `${t.to} ${t.note ?? ''}`.trim())).toEqual([
      'PENDING',
      'APPROVED',
      'REVERSED por TX-S-0009',
    ]);
    const current = sim.state.transactions.filter((t) => t.status === 'APPROVED' && t.type !== 'reverso');
    const sumBy = (key: 'registerId' | 'branchId', id: string) =>
      current.filter((t) => t[key] === id).reduce((a, t) => a + t.value, 0);
    expect(sumBy('registerId', 'CJ-S1-01')).toBe(530_200);
    expect(sumBy('registerId', 'CJ-S3-01')).toBe(82_500);
    expect([sumBy('branchId', 'SUC-S1'), sumBy('branchId', 'SUC-S3'), sumBy('branchId', 'SUC-S2')]).toEqual([530_200, 82_500, 0]);
  });

  it('E46: consolidado de cupo por cadena', () => {
    const { sim } = setup();
    expect(chainQuotaConsolidated(sim.state, 'CAD-S1').used).toBe(3_780_200);
  });
});

describe('Sesión e inicio (V01)', () => {
  it('E01: cobertura del escenario', () => {
    const { sim } = setup();
    expect(coverage(sim.state)).toEqual({ chains: 2, branches: 3, pdvs: 3, registers: 4, cashiers: 4, services: 11 });
  });

  it('E02: ingresa al turno abierto T-S1-01 con base 200.000', () => {
    const { sim } = setup();
    const shift = okValue(sim.login('CJ-S1-01', 'CAJ-S01'));
    expect(shift.id).toBe('T-S1-01');
    expect(shift.baseCash).toBe(200_000);
    expect(sim.state.session.registerId).toBe('CJ-S1-01');
  });

  it('E03/E10/E11: crea la red y abre turno en una caja sin turno', () => {
    const { sim } = setup();
    expect(okValue(sim.createBranch('CAD-S1', 'Sucursal Demo Nueva'))).toBe('SUC-S4');
    expect(okValue(sim.createPdv('SUC-S4', 'Punto de servicios Nuevo'))).toBe('PDV-S4');
    expect(okValue(sim.createRegister('PDV-S4'))).toBe('CJ-S4-01');
    expect(okValue(sim.createUser('Cajero Demo 05', 'Cajero', ['CJ-S4-01']))).toBe('CAJ-S05');
    const cov = coverage(sim.state);
    expect([cov.branches, cov.pdvs, cov.registers]).toEqual([4, 4, 5]);
    expect(quotaStatus(sim.state, 'PDV-S4', 'Recaudos').defined).toBe(false);
    const shift = okValue(sim.login('CJ-S4-01', 'CAJ-S05', 100_000));
    expect([shift.id, shift.baseCash]).toEqual(['T-S4-01', 100_000]);
    expect(sim.state.registers.find((r) => r.id === 'CJ-S4-01')?.currentShiftId).toBe('T-S4-01');
  });

  it('E09: crea y renombra una cadena', () => {
    const { sim } = setup();
    expect(okValue(sim.createChain('Mercado Express Demo'))).toBe('CAD-S3');
    expect(sim.state.chains.find((c) => c.id === 'CAD-S3')?.nit).toContain('(ficticio)');
    okValue(sim.updateChain('CAD-S3', { name: 'Mercado Express Demo 2' }));
    expect(sim.state.chains.find((c) => c.id === 'CAD-S3')?.name).toBe('Mercado Express Demo 2');
  });

  it('E12: registra un dispositivo lógico con serial SIM-S-0007', () => {
    const { sim } = setup();
    sim.createBranch('CAD-S1', 'Sucursal Demo Nueva');
    sim.createPdv('SUC-S4', 'Punto de servicios Nuevo');
    sim.createRegister('PDV-S4');
    expect(sim.suggestedSerial()).toBe('SIM-S-0007');
    expect(okValue(sim.createDevice('CJ-S4-01', 'Terminal web'))).toBe('DSP-S4-01');
  });
});

describe('Catálogo, habilitación y comisiones (V04)', () => {
  it('E13: crea SRV-18 con comisión general 400/200 y sin habilitar', () => {
    const { sim } = setup();
    const id = okValue(
      sim.createService({
        name: 'Recaudo Gimnasio Demo',
        categoryCode: 2,
        category: 'Recaudos y pagos de obligaciones',
        subcategory: 'Pagos de facturas',
        operationType: 'recaudo',
        line: 'Recaudos',
        referenceName: 'Número de socio',
        referenceLength: 8,
        allowsPartial: false,
        minPartial: null,
        allowsLate: true,
        range: null,
      })
    );
    expect(id).toBe('SRV-18');
    expect(catalogForRegister(sim.state, 'CJ-S1-01').some((c) => c.service.id === 'SRV-18')).toBe(false);
  });

  it('E14/E16: habilitación efectiva por PDV y catálogo por caja', () => {
    const { sim } = setup();
    const lines = (reg: string) =>
      catalogForRegister(sim.state, reg).reduce<Record<string, number>>((acc, c) => {
        acc[c.service.line as string] = (acc[c.service.line as string] ?? 0) + 1;
        return acc;
      }, {});
    expect(lines('CJ-S1-01')).toEqual({ Recaudos: 7, Recargas: 2, Corresponsalía: 2 });
    const ids = (reg: string) => catalogForRegister(sim.state, reg).map((c) => c.service.id);
    expect(ids('CJ-S1-01')).not.toContain('SRV-06');
    expect(ids('CJ-S1-01')).not.toContain('SRV-12');
    expect(ids('CJ-S2-01')).not.toContain('SRV-13');
    expect(ids('CJ-S2-01')).not.toContain('SRV-14');
    sim.setEnablement('SRV-06', 'pdv', 'PDV-S1', true);
    expect(ids('CJ-S1-01')).toContain('SRV-06');
    expect(ids('CJ-S1-02')).toContain('SRV-06');
    expect(ids('CJ-S2-01')).not.toContain('SRV-06');
  });

  it('E15: la comisión diferenciada solo afecta operaciones futuras', () => {
    const { sim } = setup();
    loginS1(sim);
    sim.setCommission('SRV-10', 'CAD-S1', 350, 200);
    const t = okValue(recargaMovilUno(sim));
    expect([t.id, t.chainCommission, t.it2exCommission]).toEqual(['TX-S-0011', 350, 200]);
    expect([tx(sim, 'TX-S-0003').chainCommission, tx(sim, 'TX-S-0003').it2exCommission]).toEqual([400, 200]);
  });
});

describe('Terminal de caja (V05)', () => {
  it('E17/E18/E08: recaudo aprobado y su propagación', () => {
    const { sim } = setup();
    loginS1(sim);
    const obl = okValue(sim.consultObligation('SRV-01', ['4500112100']));
    expect([obl.holder, obl.value, obl.status, obl.dueDate]).toEqual(['Titular Demo 2100', 98_700, 'Pendiente', '2026-11-01']);
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    const t = okValue(recaudoEnel(sim, '4500112100', 98_700, 100_000));
    expect([t.id, t.status, t.authorization, t.change]).toEqual(['TX-S-0011', 'APPROVED', 'AUT-S-100011', 1_300]);
    expect([t.chainCommission, t.it2exCommission]).toEqual([450, 200]);
    expect(sim.state.obligations.find((o) => o.key === 'SRV-01|4500112100')?.status).toBe('Pagada');
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(828_900);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recaudos').available).toBe(3_851_100);
    const ind = indicators(sim.state);
    expect([ind.income, ind.current]).toEqual([711_400, 6]);
    expect(formatPercent(ind.approvalRate)).toBe('88,9 %');
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([2_500, 1_200]);
    expect(ind.latest[0].id).toBe('TX-S-0011');
    expect(sim.state.reval.find((r) => r.sharedId === 'TX-S-0011')?.status).toBe('aprobada');
    expect(conciliation(sim.state).rows.find((r) => r.id === 'TX-S-0011')?.classification).toBe('Conciliada');
  });

  it('E19: efectivo insuficiente no autoriza', () => {
    const { sim } = setup();
    loginS1(sim);
    expect(errorOf(recaudoEnel(sim, '4500112100', 98_700, 90_000))).toBe('Efectivo insuficiente');
    expect(okValue(recaudoEnel(sim, '4500112100', 98_700, 98_700)).change).toBe(0);
  });

  it('E20: recarga celular', () => {
    const { sim } = setup();
    loginS1(sim);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recargas').available).toBe(900_000);
    const t = okValue(recargaMovilUno(sim));
    expect([t.id, t.status, t.chainCommission, t.it2exCommission]).toEqual(['TX-S-0011', 'APPROVED', 400, 200]);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recargas').available).toBe(880_000);
  });

  it('E21: depósito con cuenta enmascarada', () => {
    const { sim } = setup();
    loginS1(sim);
    const t = okValue(depositoBanco(sim));
    expect([t.status, t.referenceDisplay]).toEqual(['APPROVED', 'Ahorros ••••6677']);
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(930_200);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Corresponsalía').available).toBe(2_000_000);
  });

  it('E22: retiro con OTP ficticio (aprobado y rechazado)', () => {
    const { sim } = setup();
    loginS1(sim);
    const retiro = (otp: string) =>
      sim.authorize({ serviceId: 'SRV-14', references: ['1100667788'], value: 50_000, method: 'efectivo', otp });
    const rejected = okValue(retiro('000000'));
    expect([rejected.status, rejected.responseCode]).toEqual(['REJECTED', 'R-OTP']);
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    const approved = okValue(retiro('123456'));
    expect(approved.status).toBe('APPROVED');
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(680_200);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Corresponsalía').used).toBe(750_000);
  });

  it('E23: pago con tarjeta débito no suma al efectivo', () => {
    const { sim } = setup();
    loginS1(sim);
    const t = okValue(sim.authorize({ serviceId: 'SRV-01', references: ['4500112100'], value: 98_700, method: 'debito' }));
    expect([t.status, t.method]).toEqual(['APPROVED', 'debito']);
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    expect(expectedByMethod(sim.state, 'T-S1-01').debito).toBe(98_700);
  });

  it('E24/E25/E28: consultas que no permiten pagar', () => {
    const { sim } = setup();
    loginS1(sim);
    expect(errorOf(sim.consultObligation('SRV-01', ['4500112999']))).toBe('Referencia sin obligación pendiente (simulado)');
    expect(errorOf(sim.consultObligation('SRV-01', ['4500112555']))).toBe('Obligación vencida: el convenio no admite pago extemporáneo');
    expect(errorOf(sim.consultObligation('SRV-07', ['3300408']))).toBe(
      'Obligación en verificación por la transacción TX-S-0010: resuelva su estado antes de un nuevo pago'
    );
    expect(sim.state.counters.TX).toBe(11);
  });

  it('E26: pago parcial con abono mínimo', () => {
    const { sim } = setup();
    loginS1(sim);
    const obl = okValue(sim.consultObligation('SRV-05', ['2', '301']));
    expect(obl.balance).toBe(350_000);
    const pay = (value: number) =>
      sim.authorize({ serviceId: 'SRV-05', references: ['2', '301'], value, method: 'efectivo', cashReceived: value });
    expect(errorOf(pay(30_000))).toBe('El abono mínimo es $ 50.000');
    const t = okValue(pay(100_000));
    expect([t.status, t.value, t.partial]).toEqual(['APPROVED', 100_000, true]);
    const after = sim.state.obligations.find((o) => o.key === 'SRV-05|2/301');
    expect([after?.status, after?.balance]).toEqual(['Pendiente', 250_000]);
  });

  it('E27: bloqueo por cupo sin crear transacción', () => {
    const { sim } = setup();
    sim.login('CJ-S2-01', 'CAJ-S03');
    expect(errorOf(recaudoEnel(sim, '4500112100', 98_700))).toBe('Cupo insuficiente: disponible $ 50.000 en Recaudos de PDV-S2');
    expect(sim.state.counters.TX).toBe(11);
    expect(sim.state.alerts.map((a) => [a.id, a.pdvId])).toEqual([['ALR-S-001', 'PDV-S2']]);
    sim.createBranch('CAD-S1', 'Sucursal Demo Nueva');
    sim.createPdv('SUC-S4', 'Punto de servicios Nuevo');
    sim.createRegister('PDV-S4');
    sim.createUser('Cajero Demo 05', 'Cajero', ['CJ-S4-01']);
    sim.login('CJ-S4-01', 'CAJ-S05');
    expect(catalogForRegister(sim.state, 'CJ-S4-01').find((c) => c.service.id === 'SRV-01')?.noQuota).toBe(true);
    expect(errorOf(recaudoEnel(sim, '4500112100', 98_700))).toBe('PDV sin cupo asignado para Recaudos');
    expect(sim.state.counters.TX).toBe(11);
    expect(sim.state.alerts[1].pdvId).toBe('PDV-S4');
    expect(indicators(sim.state).quotaBlocks).toBe(2);
  });
});

describe('Resultado: rechazo, timeout, reintento, anulación y reverso (V06, §3)', () => {
  it('E29: rechazo del autorizador ficticio', () => {
    const { sim } = setup();
    loginS1(sim);
    const t = okValue(recaudoEnel(sim, '4500112013', 76_000));
    expect([t.id, t.status, t.responseCode, t.authorization]).toEqual(['TX-S-0011', 'REJECTED', 'R-13', null]);
    expect(indicators(sim.state).income).toBe(612_700);
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    expect(sim.state.obligations.find((o) => o.key === 'SRV-01|4500112013')?.status).toBe('Pendiente');
    expect(formatPercent(indicators(sim.state).approvalRate)).toBe('77,8 %');
  });

  it('E30: timeout resuelto por consulta como aprobada (sin id nuevo)', () => {
    const { sim } = setup();
    loginS1(sim);
    const t = okValue(recaudoEnel(sim, '4500112408', 28_000));
    expect([t.id, t.status, t.retryAvailable]).toEqual(['TX-S-0011', 'PENDING_VERIFICATION', false]);
    expect(t.responseMessage).toBe('Sin respuesta del autorizador (simulado): operación en verificación');
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recaudos').inVerification).toBe(148_000);
    expect(sim.state.obligations.find((o) => o.key === 'SRV-01|4500112408')?.status).toBe('En verificación');
    const r = okValue(sim.consultStatus('TX-S-0011'));
    expect(r.code).toBe('00');
    const after = tx(sim, 'TX-S-0011');
    expect([after.status, after.authorization]).toEqual(['APPROVED', 'AUT-S-100011']);
    expect(after.trace.map((x) => x.to)).toEqual(['PENDING', 'PENDING_VERIFICATION', 'APPROVED']);
    expect(tx(sim, 'TX-S-0012')).toBeUndefined();
  });

  it('E31: timeout resuelto como rechazada definitiva', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recaudoEnel(sim, '4500112409', 29_000));
    const r = okValue(sim.consultStatus('TX-S-0011'));
    expect(r.message).toBe('Rechazada definitiva: no se reintenta');
    expect(tx(sim, 'TX-S-0011').status).toBe('REJECTED');
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recaudos').inVerification).toBe(120_000);
    expect(sim.state.obligations.find((o) => o.key === 'SRV-01|4500112409')?.status).toBe('Pendiente');
    expect(errorOf(sim.retrySameKey('TX-S-0011'))).toContain('Solo se reintenta');
  });

  it('E32: timeout en proceso exige seguir consultando', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recaudoEnel(sim, '4500112410', 30_000));
    expect(okValue(sim.consultStatus('TX-S-0011')).message).toBe('En proceso: continúe consultando');
    expect(tx(sim, 'TX-S-0011').status).toBe('PENDING_VERIFICATION');
    okValue(sim.consultStatus('TX-S-0011'));
    expect([tx(sim, 'TX-S-0011').status, tx(sim, 'TX-S-0011').consultations]).toEqual(['APPROVED', 2]);
  });

  it('E33: sin registro y reintento con la misma clave idempotente', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recaudoEnel(sim, '4500112404', 24_000));
    expect(errorOf(sim.retrySameKey('TX-S-0011'))).toContain('Solo se reintenta');
    const r = okValue(sim.consultStatus('TX-S-0011'));
    expect(r.message).toBe('Sin registro en Reval (simulado)');
    expect(tx(sim, 'TX-S-0011').retryAvailable).toBe(true);
    okValue(sim.retrySameKey('TX-S-0011'));
    const t = tx(sim, 'TX-S-0011');
    expect([t.status, t.idempotencyKey]).toEqual(['APPROVED', 'IDEM-TX-S-0011']);
    expect(sim.state.reval.filter((x) => x.idempotencyKey === 'IDEM-TX-S-0011')).toHaveLength(1);
    expect(t.trace.map((x) => x.to)).toEqual(['PENDING', 'PENDING_VERIFICATION', 'PENDING', 'APPROVED']);
  });

  it('E34: sin idempotencia no se reintenta y queda «Solo en IT2Pay»', () => {
    const { sim } = setup();
    loginS1(sim);
    sim.setPresenter({ idempotency: false });
    okValue(recaudoEnel(sim, '4500112404', 24_000));
    const r = okValue(sim.consultStatus('TX-S-0011'));
    expect(r.message).toContain('Sin idempotencia: no se reintenta; queda para conciliación');
    expect(tx(sim, 'TX-S-0011').status).toBe('PENDING_VERIFICATION');
    expect(errorOf(sim.retrySameKey('TX-S-0011'))).toBe('Sin idempotencia: no se reintenta; queda para conciliación');
    expect(conciliation(sim.state).rows.find((x) => x.id === 'TX-S-0011')?.classification).toBe('Solo en IT2Pay');
  });

  it('E35: el panel del presentador fuerza un desenlace de un solo uso', () => {
    const { sim } = setup();
    loginS1(sim);
    sim.setPresenter({ nextAuthorization: 'rechazar' });
    expect(okValue(recaudoEnel(sim, '4500112100', 98_700)).status).toBe('REJECTED');
    expect(sim.state.presenter.nextAuthorization).toBe('gatillo');
  });

  it('E38: reverso funcional como transacción compensatoria vinculada', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recargaMovilUno(sim));
    const rev = okValue(sim.reverse('TX-S-0011', 'funcional', 'Solicitud del cliente'));
    expect([rev.id, rev.type, rev.originalId, rev.status, rev.authorization]).toEqual([
      'TX-S-0012',
      'reverso',
      'TX-S-0011',
      'APPROVED',
      'AUT-S-100012',
    ]);
    const orig = tx(sim, 'TX-S-0011');
    expect(orig.status).toBe('REVERSED');
    expect(orig.trace[orig.trace.length - 1]).toMatchObject({ from: 'APPROVED', to: 'REVERSED', note: 'por TX-S-0012' });
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recargas').available).toBe(900_000);
    expect(indicators(sim.state).chainCommission).toBe(2_050);
    expect(errorOf(sim.reverse('TX-S-0011', 'funcional', 'Otra vez'))).toBe('Solo se reversa una transacción aprobada');
    expect(conciliation(sim.state).exceptions).toHaveLength(2);
  });

  it('E39: timeout del reverso, resuelto consultando el reverso sin duplicarlo', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recargaMovilUno(sim));
    sim.setPresenter({ nextReverse: 'timeout-aprobado' });
    const rev = okValue(sim.reverse('TX-S-0011', 'funcional', 'Solicitud del cliente'));
    expect(rev.status).toBe('PENDING_VERIFICATION');
    expect(tx(sim, 'TX-S-0011').status).toBe('APPROVED');
    expect(errorOf(sim.reverse('TX-S-0011', 'funcional', 'Otra'))).toBe('Ya existe un reverso vivo para esta transacción');
    expect(sim.state.presenter.nextReverse).toBe('aprobado');
    okValue(sim.consultStatus('TX-S-0012'));
    expect([tx(sim, 'TX-S-0012').status, tx(sim, 'TX-S-0011').status]).toEqual(['APPROVED', 'REVERSED']);
    expect(sim.state.transactions.filter((t) => t.originalId === 'TX-S-0011')).toHaveLength(1);
  });

  it('Un reverso rechazado permite una nueva solicitud', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recargaMovilUno(sim));
    sim.setPresenter({ nextReverse: 'rechazado' });
    expect(okValue(sim.reverse('TX-S-0011', 'funcional', 'Solicitud')).status).toBe('REJECTED');
    expect(tx(sim, 'TX-S-0011').status).toBe('APPROVED');
    expect(okValue(sim.reverse('TX-S-0011', 'funcional', 'Solicitud')).status).toBe('APPROVED');
  });

  it('E40: anulación de un recaudo en el mismo turno', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recaudoEnel(sim, '4500112100', 98_700, 100_000));
    okValue(sim.voidTransaction('TX-S-0011', 'Error del cajero', null));
    expect(tx(sim, 'TX-S-0011').status).toBe('VOIDED');
    expect(sim.state.transactions).toHaveLength(11);
    expect(sim.state.obligations.find((o) => o.key === 'SRV-01|4500112100')?.status).toBe('Pendiente');
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
    expect(quotaStatus(sim.state, 'PDV-S1', 'Recaudos').available).toBe(3_949_800);
    const ind = indicators(sim.state);
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([2_050, 1_000]);
    expect(sim.state.reval.find((r) => r.sharedId === 'TX-S-0011')?.status).toBe('anulada');
  });

  it('E41: las recargas no admiten anulación', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(recargaMovilUno(sim));
    expect(errorOf(sim.voidTransaction('TX-S-0011', 'Motivo', null))).toBe(
      'Las recargas no se anulan en esta simulación; use Reversar (ilustrativo)'
    );
    expect(tx(sim, 'TX-S-0011').status).toBe('APPROVED');
  });

  it('E42: anular un depósito exige la confirmación del supervisor', () => {
    const { sim } = setup();
    loginS1(sim);
    okValue(depositoBanco(sim));
    expect(errorOf(sim.voidTransaction('TX-S-0011', 'Error', null))).toContain('Supervisor');
    okValue(sim.voidTransaction('TX-S-0011', 'Error', 'SUP-S01'));
    expect(tx(sim, 'TX-S-0011').status).toBe('VOIDED');
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(730_200);
  });

  it('Transiciones prohibidas: no se anula ni reversa en verificación ni un reverso', () => {
    const { sim } = setup();
    loginS1(sim);
    expect(errorOf(sim.voidTransaction('TX-S-0010', 'x', null))).toBe('Solo se anula una transacción aprobada');
    expect(errorOf(sim.reverse('TX-S-0010', 'funcional', 'x'))).toBe('Solo se reversa una transacción aprobada');
    expect(errorOf(sim.reverse('TX-S-0009', 'funcional', 'x'))).toBe('Un reverso no se anula ni se reversa');
    expect(errorOf(sim.voidTransaction('TX-S-0009', 'x', null))).toBe('Un reverso no se anula ni se reversa');
  });
});

describe('Cupos (V08)', () => {
  it('E45: cambiar el cupo asignado quita la alerta', () => {
    const { sim } = setup();
    okValue(sim.setQuota('PDV-S2', 'Recaudos', 2_500_000));
    const q = quotaStatus(sim.state, 'PDV-S2', 'Recaudos');
    expect([q.available, q.alert]).toEqual([550_000, false]);
    expect(indicators(sim.state).quotasInAlert).toBe(0);
  });
});

describe('Cierre de caja (V09, R-10)', () => {
  it.each([
    [120_000, 0, 'Cuadrada'],
    [110_000, -10_000, 'Faltante'],
    [125_000, 5_000, 'Sobrante'],
  ])('E47/E48: declarar %i en CJ-S3-01', (declared, diff, cls) => {
    const { sim } = setup();
    sim.login('CJ-S3-01', 'CAJ-S04');
    const closing = okValue(sim.closeShift('CJ-S3-01', declared, ''));
    expect(closing.expectedByMethod.efectivo).toBe(120_000);
    expect(closing.expectedByMethod.debito).toBe(62_500);
    expect([closing.id, closing.difference, closing.classification]).toEqual(['CIE-S-001', diff, cls]);
    expect(sim.state.shifts.find((s) => s.id === 'T-S3-01')?.status).toBe('cerrado');
    expect(sim.state.registers.find((r) => r.id === 'CJ-S3-01')?.currentShiftId).toBeNull();
    expect(indicators(sim.state).closingDifferences).toBe(diff);
    expect(errorOf(sim.authorize({ serviceId: 'SRV-01', references: ['4500112100'], value: 98_700, method: 'debito' }))).toBe(
      'Caja cerrada: abra un turno para operar'
    );
  });

  it('E49: el cierre se bloquea con transacciones en verificación', () => {
    const { sim } = setup();
    loginS1(sim);
    expect(errorOf(sim.closeShift('CJ-S1-01', 730_200, ''))).toBe('1 transacción en verificación (TX-S-0010): resuélvala antes de cerrar');
    okValue(sim.consultStatus('TX-S-0010'));
    expect(tx(sim, 'TX-S-0010').status).toBe('APPROVED');
    expect(expectedCash(sim.state, 'T-S1-01')).toBe(850_200);
    expect(okValue(sim.closeShift('CJ-S1-01', 850_200, '')).classification).toBe('Cuadrada');
  });
});

describe('Conciliación (V10, R-11)', () => {
  it('E50 SUP: excepciones de valor y de estado', () => {
    const { sim } = setup();
    okValue(sim.runConciliation());
    const conc = conciliation(sim.state);
    expect(conc.exceptions.map((e) => [e.id, e.classification, e.itValue, e.revalValue, e.difference])).toEqual([
      ['TX-S-0006', 'Diferencia de valor', 85_000, 58_000, 27_000],
      ['TX-S-0010', 'Diferencia de estado', 120_000, 120_000, 0],
    ]);
    expect(conc.rows.some((r) => r.id === 'TX-S-0004')).toBe(false);
  });

  it('E51: una diferencia de estado se resuelve consultando', () => {
    const { sim } = setup();
    okValue(sim.resolveByConsult('TX-S-0010'));
    const conc = conciliation(sim.state);
    expect([conc.compared, conc.conciliated]).toEqual([9, 8]);
    expect(conc.resolved.find((r) => r.txId === 'TX-S-0010')?.resolution).toBe('resuelta por consulta');
    expect(indicators(sim.state).income).toBe(732_700);
    const q = quotaStatus(sim.state, 'PDV-S1', 'Recaudos');
    expect([q.used, q.inVerification]).toEqual([1_050_200, 0]);
  });

  it('E52 PAR: inconsistencia resuelta con reverso técnico', () => {
    const { sim } = setup('PAR');
    sim.login('CJ-P1-01', 'CAJ-P01');
    const rev = okValue(sim.resolveByTechnicalReverse('TX-P-0005'));
    expect([rev.id, rev.reverseKind, rev.status, rev.originalId]).toEqual(['TX-P-0009', 'tecnico', 'APPROVED', 'TX-P-0005']);
    expect(tx(sim, 'TX-P-0005').status).toBe('REVERSED');
    const conc = conciliation(sim.state);
    expect([conc.compared, conc.conciliated]).toEqual([8, 8]);
    expect(conc.resolved.find((r) => r.txId === 'TX-P-0005')?.resolution).toBe('resuelta por reverso técnico');
    const ind = indicators(sim.state);
    expect(ind.income).toBe(390_000);
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([1_500, 750]);
    expect(quotaStatus(sim.state, 'PDV-P1', 'Recaudos').used).toBe(580_000);
    expect(expectedCash(sim.state, 'T-P1-01')).toBe(350_000);
  });

  it('E53: una diferencia de valor se resuelve con un ajuste ilustrativo', () => {
    const { sim } = setup();
    expect(errorOf(sim.registerAdjustment('TX-S-0006', ' '))).toBe('La nota es obligatoria en los ajustes');
    okValue(sim.registerAdjustment('TX-S-0006', 'Ajuste de valor ilustrativo'));
    const conc = conciliation(sim.state);
    expect(conc.open).toBe(1);
    expect(conc.informativeDifferences).toBe(27_000);
    expect(tx(sim, 'TX-S-0006').value).toBe(85_000);
  });
});

describe('Compensación y efectivo (V11)', () => {
  it('E54/E55: consignaciones y pendiente por entregar', () => {
    const { sim } = setup();
    const c = okValue(sim.reportConsignment('PDV-S2', 'Recaudos', 1_000_000));
    expect([c.id, c.status, c.support]).toEqual(['CON-S-003', 'Reportada', 'CNS-0003']);
    expect(quotaStatus(sim.state, 'PDV-S2', 'Recaudos').used).toBe(1_950_000);
    okValue(sim.validateConsignment('CON-S-002'));
    const q = quotaStatus(sim.state, 'PDV-S1', 'Recaudos');
    expect([q.used, q.available]).toEqual([630_200, 4_249_800]);
    expect(compensation(sim.state).delivered).toBe(800_000);
    expect(errorOf(sim.reportConsignment('PDV-S3', 'Recaudos', 100_000))).toContain('no puede superar el utilizado');
  });

  it('E56: compensación y obligación frente a Reval en las dos modalidades', () => {
    const { sim } = setup();
    const sep = compensation(sim.state, 'separado');
    expect(sep.income).toBe(612_700);
    expect(sep.incomeByLine).toEqual({ Recaudos: 292_700, Recargas: 20_000, Corresponsalía: 300_000 });
    expect(sep.withdrawals).toBe(0);
    expect(sep.obligationByChain.map((o) => o.obligation)).toEqual([530_200, 82_500]);
    expect([sep.chainCommission, sep.it2exCommission, sep.inVerification, sep.informativeDifferences]).toEqual([
      2_050, 1_000, 120_000, 27_000,
    ]);
    expect(compensation(sim.state, 'descontado').netToTransfer).toBe(609_650);
  });
});

describe('Gestión financiera (V12)', () => {
  it('E57/E59: liquidación ilustrativa como snapshot y cuenta de cobro', () => {
    const { sim } = setup();
    const rows = liveLiquidationRows(sim.state);
    expect(rows.map((r) => [r.chainId, r.serviceId, r.count, r.chainCommission, r.it2exCommission])).toEqual([
      ['CAD-S1', 'SRV-01', 1, 450, 200],
      ['CAD-S1', 'SRV-04', 1, 400, 200],
      ['CAD-S1', 'SRV-13', 1, 400, 200],
      ['CAD-S2', 'SRV-02', 1, 400, 200],
      ['CAD-S2', 'SRV-10', 1, 400, 200],
    ]);
    expect(liquidationTotals(rows)).toEqual({ count: 5, chain: 2_050, it2ex: 1_000, total: 3_050 });
    const liq = okValue(sim.liquidate());
    expect([liq.id, liq.status]).toEqual(['LIQ-S-001', 'Liquidada (ilustrativa)']);
    loginS1(sim);
    okValue(recargaMovilUno(sim));
    expect(liquidationTotals(liveLiquidationRows(sim.state)).count).toBe(6);
    expect(sim.state.liquidations[0].totals.count).toBe(5);
    const ccId = okValue(sim.generateCollectionAccount('LIQ-S-001'));
    const cc = sim.state.collectionAccounts[0];
    expect([ccId, cc.issuer, cc.receiver, cc.total, cc.items[0].quantity]).toEqual([
      'CC-DEMO-S-0001',
      'IT2EX S.A.S. (datos ficticios)',
      'Reval (simulado)',
      1_000,
      5,
    ]);
  });

  it('E58: cartera y saldos pendientes', () => {
    const { sim } = setup();
    const rows = portfolio(sim.state);
    const it2ex = rows.filter((r) => r.concept === 'Comisión IT2EX');
    expect(it2ex.map((r) => [r.aging, r.value])).toEqual([
      ['Periodo demo', 1_000],
      ['1–30 días', 18_400],
      ['31–60 días', 6_200],
    ]);
    expect(it2ex.reduce((a, r) => a + r.value, 0)).toBe(25_600);
    const chains = rows.filter((r) => r.concept === 'Comisión de cadenas');
    expect(chains.map((r) => [r.aging, r.value])).toEqual([
      ['Periodo demo', 2_050],
      ['1–30 días', 31_500],
    ]);
  });
});

describe('Recorrido de referencia SUP, pasos 1–7 (§6.8)', () => {
  it('cuadra con todos los valores de control de §6.8', () => {
    const { sim, clock } = setup('SUP');
    // Paso 2: red, habilitación y cupos.
    okValue(sim.createBranch('CAD-S1', 'Sucursal Demo Nueva'));
    okValue(sim.createPdv('SUC-S4', 'Punto de servicios Nuevo'));
    okValue(sim.createRegister('PDV-S4'));
    okValue(sim.createUser('Cajero Demo 05', 'Cajero', ['CJ-S4-01']));
    okValue(sim.createDevice('CJ-S4-01', 'Terminal web'));
    okValue(sim.setEnablement('SRV-06', 'pdv', 'PDV-S4', true));
    okValue(sim.setQuota('PDV-S4', 'Recaudos', 2_000_000));
    okValue(sim.setQuota('PDV-S4', 'Recargas', 500_000));
    okValue(sim.setQuota('PDV-S4', 'Corresponsalía', 1_000_000));
    expect(catalogForRegister(sim.state, 'CJ-S4-01').some((c) => c.service.id === 'SRV-06')).toBe(true);
    // Paso 3: recaudo.
    clock.advanceMinutes(5);
    okValue(sim.login('CJ-S4-01', 'CAJ-S05', 100_000));
    const t11 = okValue(recaudoEnel(sim, '4500112100', 98_700, 100_000));
    expect([t11.id, t11.authorization, t11.change]).toEqual(['TX-S-0011', 'AUT-S-100011', 1_300]);
    // Paso 4: recarga.
    expect(okValue(recargaMovilUno(sim)).id).toBe('TX-S-0012');
    // Paso 5: depósito.
    expect(okValue(depositoBanco(sim)).id).toBe('TX-S-0013');
    // Paso 6: cierre con faltante.
    const closing = okValue(sim.closeShift('CJ-S4-01', 410_000, 'Faltante en el conteo'));
    expect([closing.id, closing.expectedByMethod.efectivo, closing.declaredCash, closing.difference, closing.classification]).toEqual([
      'CIE-S-001',
      418_700,
      410_000,
      -8_700,
      'Faltante',
    ]);
    // Paso 7: conciliación, consignación y finanzas.
    okValue(sim.runConciliation());
    okValue(sim.resolveByConsult('TX-S-0010'));
    okValue(sim.registerAdjustment('TX-S-0006', 'Ajuste ilustrativo'));
    const con = okValue(sim.reportConsignment('PDV-S4', 'Recaudos', 98_700));
    expect(con.id).toBe('CON-S-003');
    okValue(sim.validateConsignment('CON-S-003'));
    const liq = okValue(sim.liquidate());
    const ccId = okValue(sim.generateCollectionAccount(liq.id));

    const s = sim.state;
    const ind = indicators(s);
    expect(ind.income).toBe(1_051_400);
    expect(ind.incomeByChain).toEqual({ 'CAD-S1': 968_900, 'CAD-S2': 82_500 });
    expect([ind.current, ind.rejected.count, ind.voided.count, ind.reversed.count, ind.inVerification.count]).toEqual([9, 1, 1, 1, 0]);
    expect(formatPercent(ind.approvalRate)).toBe('91,7 %');
    expect(`${ind.authorized} / ${ind.authorized + ind.rejected.count}`).toBe('11 / 12');
    expect([ind.chainCommission, ind.it2exCommission]).toEqual([3_700, 1_800]);
    const comp = compensation(s);
    expect(comp.obligation).toBe(1_051_400);
    expect(comp.delivered).toBe(598_700);
    expect(comp.pendingToDeliver).toBe(4_202_700);
    expect(comp.pendingByPdv).toEqual([
      { pdvId: 'PDV-S1', value: 1_950_200 },
      { pdvId: 'PDV-S2', value: 1_950_000 },
      { pdvId: 'PDV-S3', value: 82_500 },
      { pdvId: 'PDV-S4', value: 220_000 },
    ]);
    expect(['Recaudos', 'Recargas', 'Corresponsalía'].map((l) => quotaStatus(s, 'PDV-S4', l as 'Recaudos').used)).toEqual([
      0, 20_000, 200_000,
    ]);
    expect(expectedCash(s, 'T-S1-01')).toBe(850_200);
    const conc = conciliation(s);
    expect([conc.compared, conc.conciliated, conc.resolvedWithAdjustment, conc.open]).toEqual([12, 11, 1, 0]);
    expect([liq.id, liq.totals]).toEqual(['LIQ-S-001', { count: 9, chain: 3_700, it2ex: 1_800, total: 5_500 }]);
    expect([ccId, s.collectionAccounts[0].total]).toEqual(['CC-DEMO-S-0001', 1_800]);
    expect(s.counters.TX).toBe(14);
  });
});

describe('R-20: validaciones de captura compartidas por F12 y el avance de paso de V05', () => {
  const svc = (id: string) => {
    const { sim } = setup();
    const found = sim.state.services.find((x) => x.id === id);
    if (!found) {
      throw new Error(`Servicio ${id} no encontrado`);
    }
    return found;
  };

  it('celular de 10 dígitos que inicia por 3', () => {
    expect(referenceError(svc('SRV-10'), ['2001112233'])).toBe('El número celular debe tener 10 dígitos e iniciar por 3');
    expect(referenceError(svc('SRV-10'), ['300111'])).toBe('«Número celular» debe tener 10 dígitos');
    expect(referenceError(svc('SRV-10'), ['3001112233'])).toBeNull();
  });

  it('valor dentro del rango del servicio, con el mismo mensaje que F12', () => {
    expect(rangeError(svc('SRV-10'), 500)).toBe('El valor debe estar entre $ 1.000 y $ 200.000');
    expect(rangeError(svc('SRV-10'), 20_000)).toBeNull();
    expect(rangeError(svc('SRV-01'), 1)).toBeNull();
  });

  it('F12 conserva el mismo mensaje de rango', () => {
    const { sim } = setup();
    loginS1(sim);
    const r = sim.authorize({ serviceId: 'SRV-10', references: ['3001112233'], value: 500, method: 'efectivo', cashReceived: 500 });
    expect(r).toEqual({ ok: false, error: 'El valor debe estar entre $ 1.000 y $ 200.000' });
  });
});

describe('R-11: tipos de excepción nombran «Reval (simulado)»', () => {
  it('un registro sin transacción de IT2Pay queda «Solo en Reval (simulado)»', () => {
    const { sim } = setup();
    sim.state.reval.push({ ...sim.state.reval[0], sharedId: 'TX-S-9999', idempotencyKey: 'IDEM-TX-S-9999', status: 'aprobada', inconsistency: null });
    expect(conciliation(sim.state).rows.find((x) => x.id === 'TX-S-9999')?.classification).toBe('Solo en Reval (simulado)');
  });
});
