import { buildCatalog } from './catalog';
import { addDays, atTime, Clock, localDate } from './clock';
import { maskAccount } from './format';
import {
  AppUser,
  AuthAttempt,
  BusinessLine,
  CashClosing,
  Consignment,
  Device,
  Enablement,
  Obligation,
  PaymentMethod,
  PortfolioBalance,
  Quota,
  RevalRecord,
  ScenarioId,
  ScenarioState,
  SCHEMA_VERSION,
  Shift,
  TraceEntry,
  Transaction,
  TransactionType,
  TxStatus,
} from './model';

/**
 * Semilla determinista de los dos escenarios (flow-map §6) y contenido exacto
 * que restaura «Reiniciar escenario» (§6.9).
 */

export const SCENARIO_NAMES: Record<ScenarioId, string> = {
  SUP: 'Red de supermercados (ficticia)',
  PAR: 'Red de parqueaderos (ficticia)',
};

export const SCENARIO_SHORT: Record<ScenarioId, string> = {
  SUP: 'Supermercados',
  PAR: 'Parqueaderos',
};

export const obligationKey = (serviceId: string, refs: string[]): string =>
  `${serviceId}|${refs.join('/')}`;

/** «Titular Demo <últimos 4 dígitos>» (§2.10). */
export const holderFor = (refs: string[]): string =>
  `Titular Demo ${refs.join('').slice(-4)}`;

interface SeedTx {
  id: string;
  time: string;
  register: string;
  cashier: string;
  type: TransactionType;
  serviceId: string | null;
  refs: string[];
  value: number;
  method: PaymentMethod;
  cash?: [number, number];
  status: TxStatus;
  commission?: [number, number];
  /** Transición final con hora propia (anulación o reverso). */
  finalAt?: string;
  voidReason?: string;
  originalId?: string;
  reverseId?: string;
  reverseReason?: string;
  gatillo?: string;
}

interface Ctx {
  scenario: ScenarioId;
  day: Date;
  registerPdv: Record<string, string>;
  pdvBranch: Record<string, string>;
  branchChain: Record<string, string>;
  serviceLine: Record<string, BusinessLine | null>;
}

const iso = (ctx: Ctx, hhmm: string): string => atTime(ctx.day, hhmm).toISOString();

const referenceDisplay = (type: TransactionType, refs: string[]): string => {
  if (type === 'deposito' && refs.length === 2) {
    return `${refs[0]} ${maskAccount(refs[1])}`;
  }
  if (type === 'retiro') {
    return maskAccount(refs[refs.length - 1]);
  }
  return refs.join(' / ');
};

const buildTx = (ctx: Ctx, s: SeedTx): Transaction => {
  const n = Number(s.id.slice(-4));
  const at = iso(ctx, s.time);
  const pdvId = ctx.registerPdv[s.register];
  const branchId = ctx.pdvBranch[pdvId];
  const trace: TraceEntry[] = [
    { from: null, to: 'PENDING', event: 'F12 Autorizar', at, user: s.cashier, note: null },
  ];
  const authorized = ['APPROVED', 'VOIDED', 'REVERSED'].includes(s.status);
  if (authorized) {
    trace.push({
      from: 'PENDING',
      to: 'APPROVED',
      event: s.type === 'reverso' ? 'Reverso aprobado' : 'Respuesta aprobada',
      at,
      user: s.cashier,
      note: null,
    });
  }
  if (s.status === 'REJECTED') {
    trace.push({ from: 'PENDING', to: 'REJECTED', event: 'Respuesta rechazada', at, user: s.cashier, note: null });
  }
  if (s.status === 'PENDING_VERIFICATION') {
    trace.push({ from: 'PENDING', to: 'PENDING_VERIFICATION', event: 'Timeout sin respuesta', at, user: s.cashier, note: null });
  }
  if (s.status === 'VOIDED') {
    trace.push({
      from: 'APPROVED',
      to: 'VOIDED',
      event: 'Anulación',
      at: iso(ctx, s.finalAt ?? s.time),
      user: s.cashier,
      note: s.voidReason ?? null,
    });
  }
  if (s.status === 'REVERSED') {
    trace.push({
      from: 'APPROVED',
      to: 'REVERSED',
      event: 'Reverso aprobado',
      at: iso(ctx, s.finalAt ?? s.time),
      user: s.cashier,
      note: `por ${s.reverseId}`,
    });
  }
  const codes: Record<TxStatus, [string | null, string | null]> = {
    PENDING: [null, null],
    APPROVED: s.type === 'reverso' ? ['RV', 'Reverso aprobado (simulado)'] : ['00', 'Aprobada (simulado)'],
    REJECTED: ['R-13', 'Rechazada por el autorizador simulado'],
    PENDING_VERIFICATION: ['TO', 'Sin respuesta del autorizador (simulado): operación en verificación'],
    VOIDED: ['AN', 'Anulada (simulado)'],
    REVERSED: ['RV', 'Reversada (simulado)'],
  };
  const [code, message] = codes[s.status];
  return {
    id: s.id,
    idempotencyKey: `IDEM-${s.id}`,
    at,
    scenario: ctx.scenario,
    chainId: ctx.branchChain[branchId],
    branchId,
    pdvId,
    registerId: s.register,
    shiftId: `T-${s.register.slice(3)}`,
    operatorId: s.cashier,
    type: s.type,
    line: s.serviceId ? ctx.serviceLine[s.serviceId] : null,
    serviceId: s.serviceId,
    references: s.refs,
    referenceDisplay: referenceDisplay(s.type, s.refs),
    value: s.value,
    method: s.method,
    cashReceived: s.cash ? s.cash[0] : null,
    change: s.cash ? s.cash[1] : null,
    status: s.status,
    authorization: authorized ? `AUT-${ctx.scenario[0]}-${100000 + n}` : null,
    responseCode: code,
    responseMessage: message,
    originalId: s.originalId ?? null,
    reverseKind: s.type === 'reverso' ? 'funcional' : null,
    reverseReason: s.reverseReason ?? null,
    reverseIds: s.reverseId ? [s.reverseId] : [],
    voidInfo:
      s.status === 'VOIDED'
        ? { at: iso(ctx, s.finalAt ?? s.time), reason: s.voidReason ?? '', authorizedBy: s.cashier }
        : null,
    chainCommission: s.commission ? s.commission[0] : null,
    it2exCommission: s.commission ? s.commission[1] : null,
    consultations: 0,
    trace,
    appliedOutcome: s.gatillo ? `Gatillo ${s.gatillo}` : 'Dato precargado',
    pendingInProcess: 0,
    lastConsultResult: null,
    retryAvailable: false,
    obligationKey:
      s.type === 'recaudo' && s.serviceId ? obligationKey(s.serviceId, s.refs) : null,
    partial: false,
  };
};

const attemptFor = (tx: Transaction): AuthAttempt => ({
  id: `${tx.id}-A1`,
  txId: tx.id,
  attempt: 1,
  requestType: tx.type === 'reverso' ? 'reversar' : 'autorizar',
  result:
    tx.status === 'REJECTED'
      ? 'rechazada'
      : tx.status === 'PENDING_VERIFICATION'
        ? 'timeout'
        : 'aprobada',
  code: tx.trace[1]?.to === 'APPROVED' ? (tx.type === 'reverso' ? 'RV' : '00') : (tx.responseCode ?? ''),
  message: tx.trace[1]?.event ?? '',
  authorization: tx.authorization,
  at: tx.at,
});

const obligation = (
  ctx: Ctx,
  serviceId: string,
  refs: string[],
  value: number,
  dueOffset: number,
  status: Obligation['status'],
  verifyingTxId: string | null = null
): Obligation => ({
  key: obligationKey(serviceId, refs),
  serviceId,
  references: refs,
  holder: holderFor(refs),
  value,
  dueDate: localDate(addDays(ctx.day, dueOffset)),
  balance: status === 'Pagada' ? 0 : value,
  status,
  verifyingTxId,
});

const enable = (level: 'cadena' | 'pdv', targetId: string, ids: number[], enabled = true): Enablement[] =>
  ids.map((n) => ({
    serviceId: `SRV-${String(n).padStart(2, '0')}`,
    level,
    targetId,
    enabled,
  }));

const quota = (pdvId: string, line: BusinessLine, assigned: number, initialConsumption: number): Quota => ({
  pdvId,
  line,
  assigned,
  initialConsumption,
});

const shift = (ctx: Ctx, register: string, cashier: string, time: string, base: number): Shift => ({
  id: `T-${register.slice(3)}`,
  registerId: register,
  cashierId: cashier,
  openedAt: iso(ctx, time),
  baseCash: base,
  status: 'abierto',
  closingId: null,
});

const user = (id: string, name: string, profile: AppUser['profile'], registerIds: string[] = []): AppUser => ({
  id,
  name,
  profile,
  registerIds,
  active: true,
});

const device = (id: string, registerId: string, type: Device['type'], serial: string): Device => ({
  id,
  registerId,
  type,
  serial,
  active: true,
});

const reval = (
  tx: Transaction,
  status: RevalRecord['status'],
  value = tx.value,
  inconsistency: string | null = null
): RevalRecord => ({
  sharedId: tx.id,
  idempotencyKey: tx.idempotencyKey,
  type: tx.type,
  value,
  status,
  inconsistency,
  originalId: tx.originalId,
});

const methodsZero = (): Record<PaymentMethod, number> => ({
  efectivo: 0,
  debito: 0,
  credito: 0,
  transferencia: 0,
  qr: 0,
});

const historicalClosing = (
  ctx: Ctx,
  id: string,
  register: string,
  cashier: string,
  expected: number,
  declared: number
): CashClosing => {
  const diff = declared - expected;
  return {
    id,
    shiftId: `T-${register.slice(3)} (día anterior)`,
    registerId: register,
    cashierId: cashier,
    at: atTime(addDays(ctx.day, -1), '19:00').toISOString(),
    expectedByMethod: { ...methodsZero(), efectivo: expected },
    declaredCash: declared,
    difference: diff,
    classification: diff === 0 ? 'Cuadrada' : diff > 0 ? 'Sobrante' : 'Faltante',
    observation: 'Cierre histórico precargado',
    historical: true,
  };
};

const consignment = (
  ctx: Ctx,
  id: string,
  pdvId: string,
  line: BusinessLine,
  value: number,
  support: string,
  status: Consignment['status'],
  time: string
): Consignment => ({
  id,
  pdvId,
  line,
  value,
  bank: 'Banco Demo Dos',
  support,
  status,
  reportedAt: iso(ctx, time),
  validatedAt: status === 'Validada' ? iso(ctx, time) : null,
});

const portfolio = (concept: string, creditor: string, aging: PortfolioBalance['aging'], value: number): PortfolioBalance => ({
  concept,
  debtor: 'Reval (simulado)',
  creditor,
  aging,
  value,
  origin: 'precargado',
});

const baseState = (scenario: ScenarioId, day: Date): Omit<
  ScenarioState,
  | 'chains'
  | 'branches'
  | 'pdvs'
  | 'registers'
  | 'users'
  | 'shifts'
  | 'devices'
  | 'obligations'
  | 'enablements'
  | 'commissions'
  | 'quotas'
  | 'transactions'
  | 'authAttempts'
  | 'reval'
  | 'closings'
  | 'consignments'
  | 'portfolio'
> => ({
  schemaVersion: SCHEMA_VERSION,
  id: scenario,
  name: SCENARIO_NAMES[scenario],
  commerceType: scenario === 'SUP' ? 'supermercado' : 'parqueadero',
  demoDate: localDate(day),
  services: buildCatalog(),
  alerts: [],
  resolutions: [],
  liquidations: [],
  collectionAccounts: [],
  counters: {
    TX: scenario === 'SUP' ? 11 : 9,
    CIE: 1,
    CON: 3,
    LIQ: 1,
    CC: 1,
    ALR: 1,
    SUC: 4,
    PDV: 4,
    CAJ: 5,
    CAD: 3,
    SRV: 18,
    COM: 2,
  },
  presenter: { nextAuthorization: 'gatillo', nextReverse: 'aprobado', idempotency: true },
  compensationMode: 'separado',
  session: { chainId: null, branchId: null, registerId: null, userId: null, shiftId: null },
  lastConciliationAt: null,
  lastResultTxId: null,
});

const ctxFor = (
  scenario: ScenarioId,
  day: Date,
  registers: Record<string, string>,
  pdvs: Record<string, string>,
  branches: Record<string, string>
): Ctx => {
  const serviceLine: Record<string, BusinessLine | null> = {};
  for (const s of buildCatalog()) {
    serviceLine[s.id] = s.line;
  }
  return { scenario, day, registerPdv: registers, pdvBranch: pdvs, branchChain: branches, serviceLine };
};

const buildSupermarkets = (clock: Clock): ScenarioState => {
  const day = clock.now();
  const ctx = ctxFor(
    'SUP',
    day,
    { 'CJ-S1-01': 'PDV-S1', 'CJ-S1-02': 'PDV-S1', 'CJ-S2-01': 'PDV-S2', 'CJ-S3-01': 'PDV-S3' },
    { 'PDV-S1': 'SUC-S1', 'PDV-S2': 'SUC-S2', 'PDV-S3': 'SUC-S3' },
    { 'SUC-S1': 'CAD-S1', 'SUC-S2': 'CAD-S1', 'SUC-S3': 'CAD-S2' }
  );
  const seedTx: SeedTx[] = [
    { id: 'TX-S-0001', time: '07:05', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recaudo', serviceId: 'SRV-01', refs: ['4500112001'], value: 145_200, method: 'efectivo', cash: [150_000, 4_800], status: 'APPROVED', commission: [450, 200] },
    { id: 'TX-S-0002', time: '07:12', register: 'CJ-S3-01', cashier: 'CAJ-S04', type: 'recaudo', serviceId: 'SRV-02', refs: ['7788001'], value: 62_500, method: 'debito', status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-S-0003', time: '07:20', register: 'CJ-S3-01', cashier: 'CAJ-S04', type: 'recarga', serviceId: 'SRV-10', refs: ['3001234567'], value: 20_000, method: 'efectivo', cash: [20_000, 0], status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-S-0004', time: '07:31', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recaudo', serviceId: 'SRV-03', refs: ['5566013'], value: 88_000, method: 'efectivo', cash: [88_000, 0], status: 'REJECTED', gatillo: '013' },
    { id: 'TX-S-0005', time: '07:40', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'deposito', serviceId: 'SRV-13', refs: ['Ahorros', '1100223344'], value: 300_000, method: 'efectivo', cash: [300_000, 0], status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-S-0006', time: '07:52', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recaudo', serviceId: 'SRV-04', refs: ['99001234'], value: 85_000, method: 'efectivo', cash: [85_000, 0], status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-S-0007', time: '08:05', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recarga', serviceId: 'SRV-11', refs: ['3109876543'], value: 10_000, method: 'efectivo', cash: [10_000, 0], status: 'VOIDED', commission: [400, 200], finalAt: '08:07', voidReason: 'Número errado' },
    { id: 'TX-S-0008', time: '08:15', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recaudo', serviceId: 'SRV-01', refs: ['4500112020'], value: 54_300, method: 'efectivo', cash: [54_300, 0], status: 'REVERSED', commission: [450, 200], finalAt: '08:20', reverseId: 'TX-S-0009' },
    { id: 'TX-S-0009', time: '08:20', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'reverso', serviceId: 'SRV-01', refs: ['4500112020'], value: 54_300, method: 'efectivo', status: 'APPROVED', originalId: 'TX-S-0008', reverseReason: 'Solicitud del cliente' },
    { id: 'TX-S-0010', time: '08:30', register: 'CJ-S1-01', cashier: 'CAJ-S01', type: 'recaudo', serviceId: 'SRV-07', refs: ['3300408'], value: 120_000, method: 'efectivo', cash: [120_000, 0], status: 'PENDING_VERIFICATION', gatillo: '408' },
  ];
  const transactions = seedTx.map((s) => buildTx(ctx, s));
  const revalStatus: Record<string, RevalRecord['status']> = {
    'TX-S-0004': 'rechazada',
    'TX-S-0007': 'anulada',
    'TX-S-0008': 'reversada',
  };
  const revalRecords = transactions.map((t) =>
    reval(t, revalStatus[t.id] ?? 'aprobada', t.id === 'TX-S-0006' ? 58_000 : t.value)
  );
  return {
    ...baseState('SUP', day),
    chains: [
      { id: 'CAD-S1', name: 'Mercado Central Demo', nit: '000.111.001-1 (ficticio)', active: true },
      { id: 'CAD-S2', name: 'Superahorro Demo', nit: '000.111.002-2 (ficticio)', active: true },
    ],
    branches: [
      { id: 'SUC-S1', chainId: 'CAD-S1', name: 'Sucursal Norte', active: true },
      { id: 'SUC-S2', chainId: 'CAD-S1', name: 'Sucursal Sur', active: true },
      { id: 'SUC-S3', chainId: 'CAD-S2', name: 'Sucursal Centro', active: true },
    ],
    pdvs: [
      { id: 'PDV-S1', branchId: 'SUC-S1', name: 'Punto de servicios Norte', activityType: 'Punto de servicios', active: true },
      { id: 'PDV-S2', branchId: 'SUC-S2', name: 'Punto de servicios Sur', activityType: 'Punto de servicios', active: true },
      { id: 'PDV-S3', branchId: 'SUC-S3', name: 'Punto de servicios Centro', activityType: 'Punto de servicios', active: true },
    ],
    registers: [
      { id: 'CJ-S1-01', pdvId: 'PDV-S1', currentShiftId: 'T-S1-01' },
      { id: 'CJ-S1-02', pdvId: 'PDV-S1', currentShiftId: 'T-S1-02' },
      { id: 'CJ-S2-01', pdvId: 'PDV-S2', currentShiftId: 'T-S2-01' },
      { id: 'CJ-S3-01', pdvId: 'PDV-S3', currentShiftId: 'T-S3-01' },
    ],
    users: [
      user('CAJ-S01', 'Cajero Demo 01', 'Cajero', ['CJ-S1-01']),
      user('CAJ-S02', 'Cajero Demo 02', 'Cajero', ['CJ-S1-02']),
      user('CAJ-S03', 'Cajero Demo 03', 'Cajero', ['CJ-S2-01']),
      user('CAJ-S04', 'Cajero Demo 04', 'Cajero', ['CJ-S3-01']),
      user('SUP-S01', 'Supervisor Demo S', 'Supervisor'),
      user('ADM-S01', 'Administrador Demo S', 'Administrador'),
      user('ANA-S01', 'Analista Demo S', 'Analista financiero'),
    ],
    shifts: [
      shift(ctx, 'CJ-S1-01', 'CAJ-S01', '07:00', 200_000),
      shift(ctx, 'CJ-S1-02', 'CAJ-S02', '07:00', 200_000),
      shift(ctx, 'CJ-S2-01', 'CAJ-S03', '07:00', 100_000),
      shift(ctx, 'CJ-S3-01', 'CAJ-S04', '07:00', 100_000),
    ],
    devices: [
      device('DSP-S1-01', 'CJ-S1-01', 'Terminal web', 'SIM-S-0001'),
      device('DSP-S1-02', 'CJ-S1-01', 'Datáfono simulado', 'SIM-S-0002'),
      device('DSP-S1-03', 'CJ-S1-01', 'Impresora de tirilla simulada', 'SIM-S-0003'),
      device('DSP-S1-04', 'CJ-S1-02', 'Terminal web', 'SIM-S-0004'),
      device('DSP-S2-01', 'CJ-S2-01', 'Terminal web', 'SIM-S-0005'),
      device('DSP-S3-01', 'CJ-S3-01', 'Terminal web', 'SIM-S-0006'),
    ],
    obligations: [
      obligation(ctx, 'SRV-01', ['4500112001'], 145_200, 5, 'Pagada'),
      obligation(ctx, 'SRV-01', ['4500112020'], 54_300, 5, 'Pendiente'),
      obligation(ctx, 'SRV-01', ['4500112100'], 98_700, 7, 'Pendiente'),
      obligation(ctx, 'SRV-01', ['4500112013'], 76_000, 7, 'Pendiente'),
      obligation(ctx, 'SRV-01', ['4500112555'], 132_000, -1, 'Pendiente'),
      obligation(ctx, 'SRV-02', ['7788001'], 62_500, 5, 'Pagada'),
      obligation(ctx, 'SRV-03', ['5566013'], 88_000, 5, 'Pendiente'),
      obligation(ctx, 'SRV-04', ['99001234'], 85_000, 5, 'Pagada'),
      obligation(ctx, 'SRV-05', ['2', '301'], 350_000, 10, 'Pendiente'),
      obligation(ctx, 'SRV-06', ['20261001'], 1_250_000, -3, 'Pendiente'),
      obligation(ctx, 'SRV-07', ['3300408'], 120_000, 5, 'En verificación', 'TX-S-0010'),
      obligation(ctx, 'SRV-08', ['010203'], 480_000, 20, 'Pendiente'),
    ],
    enablements: [
      ...enable('cadena', 'CAD-S1', [1, 2, 3, 4, 5, 7, 8, 10, 11, 13, 14]),
      ...enable('pdv', 'PDV-S2', [13, 14], false),
      ...enable('cadena', 'CAD-S2', [1, 2, 3, 4, 10, 11]),
    ],
    commissions: [
      { id: 'COM-S1', serviceId: 'SRV-01', chainId: 'CAD-S1', chainValue: 450, it2exValue: 200 },
    ],
    quotas: [
      quota('PDV-S1', 'Recaudos', 5_000_000, 1_200_000),
      quota('PDV-S1', 'Recargas', 1_000_000, 100_000),
      quota('PDV-S1', 'Corresponsalía', 3_000_000, 500_000),
      quota('PDV-S2', 'Recaudos', 2_000_000, 1_950_000),
      quota('PDV-S2', 'Recargas', 500_000, 0),
      quota('PDV-S3', 'Recaudos', 3_000_000, 0),
      quota('PDV-S3', 'Recargas', 500_000, 0),
    ],
    transactions,
    authAttempts: transactions.map(attemptFor),
    reval: revalRecords,
    closings: [historicalClosing(ctx, 'CIE-S-000', 'CJ-S1-02', 'CAJ-S02', 640_000, 635_000)],
    consignments: [
      consignment(ctx, 'CON-S-001', 'PDV-S1', 'Recaudos', 500_000, 'CNS-0001', 'Validada', '06:30'),
      consignment(ctx, 'CON-S-002', 'PDV-S1', 'Recaudos', 300_000, 'CNS-0002', 'Reportada', '08:40'),
    ],
    portfolio: [
      portfolio('Comisión IT2EX', 'IT2EX', '1–30 días', 18_400),
      portfolio('Comisión IT2EX', 'IT2EX', '31–60 días', 6_200),
      portfolio('Comisión de cadenas', 'Cadenas', '1–30 días', 31_500),
    ],
  };
};

const buildParkings = (clock: Clock): ScenarioState => {
  const day = clock.now();
  const ctx = ctxFor(
    'PAR',
    day,
    { 'CJ-P1-01': 'PDV-P1', 'CJ-P1-02': 'PDV-P1', 'CJ-P2-01': 'PDV-P2', 'CJ-P3-01': 'PDV-P3' },
    { 'PDV-P1': 'SUC-P1', 'PDV-P2': 'SUC-P2', 'PDV-P3': 'SUC-P3' },
    { 'SUC-P1': 'CAD-P1', 'SUC-P2': 'CAD-P1', 'SUC-P3': 'CAD-P2' }
  );
  const seedTx: SeedTx[] = [
    { id: 'TX-P-0001', time: '06:40', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'recarga', serviceId: 'SRV-12', refs: ['8800112233'], value: 50_000, method: 'efectivo', cash: [50_000, 0], status: 'APPROVED', commission: [300, 150] },
    { id: 'TX-P-0002', time: '06:55', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'recaudo', serviceId: 'SRV-09', refs: ['2026110001'], value: 180_000, method: 'credito', status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-P-0003', time: '07:10', register: 'CJ-P3-01', cashier: 'CAJ-P04', type: 'recarga', serviceId: 'SRV-10', refs: ['3015550101'], value: 10_000, method: 'efectivo', cash: [10_000, 0], status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-P-0004', time: '07:25', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'recaudo', serviceId: 'SRV-01', refs: ['4500220013'], value: 97_400, method: 'efectivo', cash: [97_400, 0], status: 'REJECTED', gatillo: '013' },
    { id: 'TX-P-0005', time: '07:40', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'recaudo', serviceId: 'SRV-09', refs: ['2026110002'], value: 95_000, method: 'efectivo', cash: [95_000, 0], status: 'APPROVED', commission: [400, 200] },
    { id: 'TX-P-0006', time: '07:58', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'recarga', serviceId: 'SRV-12', refs: ['8800445566'], value: 30_000, method: 'efectivo', cash: [30_000, 0], status: 'REVERSED', commission: [300, 150], finalAt: '08:01', reverseId: 'TX-P-0007' },
    { id: 'TX-P-0007', time: '08:01', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'reverso', serviceId: 'SRV-12', refs: ['8800445566'], value: 30_000, method: 'efectivo', status: 'APPROVED', originalId: 'TX-P-0006', reverseReason: 'Solicitud del cliente' },
    { id: 'TX-P-0008', time: '08:10', register: 'CJ-P1-01', cashier: 'CAJ-P01', type: 'deposito', serviceId: 'SRV-13', refs: ['Ahorros', '1100998877'], value: 150_000, method: 'efectivo', cash: [150_000, 0], status: 'APPROVED', commission: [400, 200] },
  ];
  const transactions = seedTx.map((s) => buildTx(ctx, s));
  const revalStatus: Record<string, RevalRecord['status']> = {
    'TX-P-0004': 'rechazada',
    'TX-P-0006': 'reversada',
  };
  return {
    ...baseState('PAR', day),
    chains: [
      { id: 'CAD-P1', name: 'ParkCity Demo', nit: '000.111.003-3 (ficticio)', active: true },
      { id: 'CAD-P2', name: 'Parqueaderos Ruta Demo', nit: '000.111.004-4 (ficticio)', active: true },
    ],
    branches: [
      { id: 'SUC-P1', chainId: 'CAD-P1', name: 'Sede Aeropuerto', active: true },
      { id: 'SUC-P2', chainId: 'CAD-P1', name: 'Sede Centro', active: true },
      { id: 'SUC-P3', chainId: 'CAD-P2', name: 'Sede Terminal', active: true },
    ],
    pdvs: [
      { id: 'PDV-P1', branchId: 'SUC-P1', name: 'Taquilla Aeropuerto', activityType: 'Taquilla', active: true },
      { id: 'PDV-P2', branchId: 'SUC-P2', name: 'Taquilla Centro', activityType: 'Taquilla', active: true },
      { id: 'PDV-P3', branchId: 'SUC-P3', name: 'Taquilla Terminal', activityType: 'Taquilla', active: true },
    ],
    registers: [
      { id: 'CJ-P1-01', pdvId: 'PDV-P1', currentShiftId: 'T-P1-01' },
      { id: 'CJ-P1-02', pdvId: 'PDV-P1', currentShiftId: 'T-P1-02' },
      { id: 'CJ-P2-01', pdvId: 'PDV-P2', currentShiftId: 'T-P2-01' },
      { id: 'CJ-P3-01', pdvId: 'PDV-P3', currentShiftId: 'T-P3-01' },
    ],
    users: [
      user('CAJ-P01', 'Cajero Demo P01', 'Cajero', ['CJ-P1-01']),
      user('CAJ-P02', 'Cajero Demo P02', 'Cajero', ['CJ-P1-02']),
      user('CAJ-P03', 'Cajero Demo P03', 'Cajero', ['CJ-P2-01']),
      user('CAJ-P04', 'Cajero Demo P04', 'Cajero', ['CJ-P3-01']),
      user('SUP-P01', 'Supervisor Demo P', 'Supervisor'),
      user('ADM-P01', 'Administrador Demo P', 'Administrador'),
      user('ANA-P01', 'Analista Demo P', 'Analista financiero'),
    ],
    shifts: [
      shift(ctx, 'CJ-P1-01', 'CAJ-P01', '06:30', 150_000),
      shift(ctx, 'CJ-P1-02', 'CAJ-P02', '06:30', 150_000),
      shift(ctx, 'CJ-P2-01', 'CAJ-P03', '06:30', 100_000),
      shift(ctx, 'CJ-P3-01', 'CAJ-P04', '06:30', 100_000),
    ],
    devices: [
      device('DSP-P1-01', 'CJ-P1-01', 'Terminal web', 'SIM-P-0001'),
      device('DSP-P1-02', 'CJ-P1-01', 'Datáfono simulado', 'SIM-P-0002'),
      device('DSP-P1-03', 'CJ-P1-02', 'Terminal web', 'SIM-P-0003'),
      device('DSP-P2-01', 'CJ-P2-01', 'Terminal web', 'SIM-P-0004'),
      device('DSP-P3-01', 'CJ-P3-01', 'Terminal web', 'SIM-P-0005'),
    ],
    obligations: [
      obligation(ctx, 'SRV-01', ['4500220013'], 97_400, 5, 'Pendiente'),
      obligation(ctx, 'SRV-01', ['4500220100'], 76_300, 7, 'Pendiente'),
      obligation(ctx, 'SRV-09', ['2026110001'], 180_000, 15, 'Pagada'),
      obligation(ctx, 'SRV-09', ['2026110002'], 95_000, 15, 'Pagada'),
      obligation(ctx, 'SRV-09', ['2026110050'], 210_000, 15, 'Pendiente'),
      obligation(ctx, 'SRV-07', ['3300500'], 89_000, 10, 'Pendiente'),
    ],
    enablements: [
      ...enable('cadena', 'CAD-P1', [1, 7, 9, 10, 11, 12, 13, 14]),
      ...enable('cadena', 'CAD-P2', [1, 9, 10, 12]),
    ],
    commissions: [
      { id: 'COM-P1', serviceId: 'SRV-12', chainId: 'CAD-P1', chainValue: 300, it2exValue: 150 },
    ],
    quotas: [
      quota('PDV-P1', 'Recaudos', 3_000_000, 600_000),
      quota('PDV-P1', 'Recargas', 1_500_000, 200_000),
      quota('PDV-P1', 'Corresponsalía', 1_000_000, 0),
      quota('PDV-P2', 'Recaudos', 1_000_000, 970_000),
      quota('PDV-P2', 'Recargas', 300_000, 0),
      quota('PDV-P3', 'Recaudos', 2_000_000, 0),
      quota('PDV-P3', 'Recargas', 1_000_000, 0),
    ],
    transactions,
    authAttempts: transactions.map(attemptFor),
    reval: transactions.map((t) =>
      reval(
        t,
        revalStatus[t.id] ?? 'aprobada',
        t.value,
        t.id === 'TX-P-0005' ? 'Referencia no corresponde al convenio (simulado)' : null
      )
    ),
    closings: [historicalClosing(ctx, 'CIE-P-000', 'CJ-P1-01', 'CAJ-P01', 380_000, 382_000)],
    consignments: [
      consignment(ctx, 'CON-P-001', 'PDV-P1', 'Recaudos', 200_000, 'CNS-0001', 'Validada', '06:20'),
      consignment(ctx, 'CON-P-002', 'PDV-P1', 'Recargas', 100_000, 'CNS-0002', 'Reportada', '08:30'),
    ],
    portfolio: [
      portfolio('Comisión IT2EX', 'IT2EX', '1–30 días', 12_600),
      portfolio('Comisión de cadenas', 'Cadenas', '1–30 días', 22_800),
    ],
  };
};

/** Semilla exacta de un escenario (§6.9). */
export const buildSeed = (scenario: ScenarioId, clock: Clock): ScenarioState =>
  scenario === 'SUP' ? buildSupermarkets(clock) : buildParkings(clock);
