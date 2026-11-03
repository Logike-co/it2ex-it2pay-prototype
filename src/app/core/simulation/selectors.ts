import { DEFAULT_COMMISSION } from './catalog';
import { localDate } from './clock';
import {
  BUSINESS_LINES,
  BusinessLine,
  CompensationMode,
  ExceptionResolution,
  ExceptionType,
  LiquidationRow,
  PAYMENT_METHODS,
  PaymentMethod,
  PortfolioBalance,
  ResolutionStatus,
  RevalRecord,
  RevalStatus,
  ScenarioState,
  Service,
  Transaction,
  TxStatus,
} from './model';

/**
 * Derivados del estado (flow-map §2: «los derivados se calculan, nunca se
 * copian»). Funciones puras sobre `ScenarioState`.
 */

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

export const QUOTA_ALERT_THRESHOLD = 0.2;

/** Tipos que consumen cupo (R-08). */
const CONSUMES_QUOTA = new Set(['recaudo', 'recarga', 'deposito']);

// ---------------------------------------------------------------- red

export const chainOfPdv = (s: ScenarioState, pdvId: string): string | null => {
  const pdv = s.pdvs.find((p) => p.id === pdvId);
  const branch = pdv ? s.branches.find((b) => b.id === pdv.branchId) : undefined;
  return branch?.chainId ?? null;
};

export const branchOfPdv = (s: ScenarioState, pdvId: string): string | null =>
  s.pdvs.find((p) => p.id === pdvId)?.branchId ?? null;

export const pdvOfRegister = (s: ScenarioState, registerId: string): string | null =>
  s.registers.find((r) => r.id === registerId)?.pdvId ?? null;

export const chainName = (s: ScenarioState, id: string | null): string =>
  s.chains.find((c) => c.id === id)?.name ?? '—';

export const branchName = (s: ScenarioState, id: string | null): string =>
  s.branches.find((b) => b.id === id)?.name ?? '—';

export const pdvName = (s: ScenarioState, id: string | null): string =>
  s.pdvs.find((p) => p.id === id)?.name ?? '—';

export const userName = (s: ScenarioState, id: string | null): string =>
  s.users.find((u) => u.id === id)?.name ?? '—';

export const serviceName = (s: ScenarioState, id: string | null): string =>
  s.services.find((x) => x.id === id)?.name ?? '—';

/** Cajeros asignados a una caja (relación N—M guardada en el usuario). */
export const cashiersOfRegister = (s: ScenarioState, registerId: string) =>
  s.users.filter((u) => u.registerIds.includes(registerId));

// ---------------------------------------------------------------- habilitación (R-21)

export const isServiceEnabledForPdv = (
  s: ScenarioState,
  serviceId: string,
  pdvId: string
): boolean => {
  const service = s.services.find((x) => x.id === serviceId);
  if (!service || !service.active || service.documentedOnly) {
    return false;
  }
  const pdvRule = s.enablements.find(
    (e) => e.serviceId === serviceId && e.level === 'pdv' && e.targetId === pdvId
  );
  if (pdvRule) {
    return pdvRule.enabled;
  }
  const chainId = chainOfPdv(s, pdvId);
  const chainRule = s.enablements.find(
    (e) => e.serviceId === serviceId && e.level === 'cadena' && e.targetId === chainId
  );
  return chainRule?.enabled ?? false;
};

export interface CatalogEntry {
  service: Service;
  noQuota: boolean;
}

/** Catálogo efectivo de una caja (F03, R-21). */
export const catalogForRegister = (s: ScenarioState, registerId: string): CatalogEntry[] => {
  const pdvId = pdvOfRegister(s, registerId);
  if (!pdvId) {
    return [];
  }
  return s.services
    .filter((svc) => isServiceEnabledForPdv(s, svc.id, pdvId))
    .map((service) => ({
      service,
      noQuota:
        service.operationType !== 'retiro' &&
        !!service.line &&
        !s.quotas.some((q) => q.pdvId === pdvId && q.line === service.line),
    }));
};

// ---------------------------------------------------------------- comisiones (R-15)

export const commissionFor = (
  s: ScenarioState,
  serviceId: string,
  chainId: string
): { chainValue: number; it2exValue: number; source: string } => {
  const specific = s.commissions.find((c) => c.serviceId === serviceId && c.chainId === chainId);
  if (specific) {
    return { ...specific, source: specific.id };
  }
  const general = s.commissions.find((c) => c.serviceId === serviceId && c.chainId === null);
  if (general) {
    return { ...general, source: general.id };
  }
  return { ...DEFAULT_COMMISSION, source: 'General 400 / 200' };
};

// ---------------------------------------------------------------- cupo (R-08)

export interface QuotaStatus {
  pdvId: string;
  line: BusinessLine;
  defined: boolean;
  assigned: number;
  initialConsumption: number;
  consumption: number;
  releases: number;
  used: number;
  inVerification: number;
  available: number;
  usage: number;
  alert: boolean;
}

export const quotaStatus = (s: ScenarioState, pdvId: string, line: BusinessLine): QuotaStatus => {
  const q = s.quotas.find((x) => x.pdvId === pdvId && x.line === line);
  const txs = s.transactions.filter(
    (t) => t.pdvId === pdvId && t.line === line && CONSUMES_QUOTA.has(t.type)
  );
  const consumption = sum(txs.filter((t) => t.status === 'APPROVED').map((t) => t.value));
  const inVerification = sum(
    txs.filter((t) => t.status === 'PENDING_VERIFICATION').map((t) => t.value)
  );
  const consignments = sum(
    s.consignments
      .filter((c) => c.pdvId === pdvId && c.line === line && c.status === 'Validada')
      .map((c) => c.value)
  );
  const withdrawals =
    line === 'Corresponsalía'
      ? sum(
          s.transactions
            .filter((t) => t.pdvId === pdvId && t.type === 'retiro' && t.status === 'APPROVED')
            .map((t) => t.value)
        )
      : 0;
  const releases = consignments + withdrawals;
  const assigned = q?.assigned ?? 0;
  const initialConsumption = q?.initialConsumption ?? 0;
  const used = Math.max(0, initialConsumption + consumption - releases);
  const available = assigned - used - inVerification;
  return {
    pdvId,
    line,
    defined: !!q,
    assigned,
    initialConsumption,
    consumption,
    releases,
    used,
    inVerification,
    available,
    usage: assigned > 0 ? (used + inVerification) / assigned : 0,
    alert: !!q && available < QUOTA_ALERT_THRESHOLD * assigned,
  };
};

export const quotaTable = (s: ScenarioState): QuotaStatus[] =>
  s.pdvs.flatMap((p) =>
    BUSINESS_LINES.filter((line) => s.quotas.some((q) => q.pdvId === p.id && q.line === line)).map(
      (line) => quotaStatus(s, p.id, line)
    )
  );

export const chainQuotaConsolidated = (s: ScenarioState, chainId: string) => {
  const rows = quotaTable(s).filter((r) => chainOfPdv(s, r.pdvId) === chainId);
  return {
    assigned: sum(rows.map((r) => r.assigned)),
    used: sum(rows.map((r) => r.used)),
    inVerification: sum(rows.map((r) => r.inVerification)),
    available: sum(rows.map((r) => r.available)),
  };
};

// ---------------------------------------------------------------- caja y cierre (R-10)

export const shiftTransactions = (s: ScenarioState, shiftId: string): Transaction[] =>
  s.transactions.filter((t) => t.shiftId === shiftId);

export const expectedByMethod = (s: ScenarioState, shiftId: string): Record<PaymentMethod, number> => {
  const shift = s.shifts.find((x) => x.id === shiftId);
  const approved = shiftTransactions(s, shiftId).filter((t) => t.status === 'APPROVED');
  const result = {} as Record<PaymentMethod, number>;
  for (const m of PAYMENT_METHODS) {
    result[m] = sum(
      approved.filter((t) => CONSUMES_QUOTA.has(t.type) && t.method === m).map((t) => t.value)
    );
  }
  const withdrawals = sum(approved.filter((t) => t.type === 'retiro').map((t) => t.value));
  result.efectivo += (shift?.baseCash ?? 0) - withdrawals;
  return result;
};

export const expectedCash = (s: ScenarioState, shiftId: string): number =>
  expectedByMethod(s, shiftId).efectivo;

export const pendingVerificationInShift = (s: ScenarioState, shiftId: string): Transaction[] =>
  shiftTransactions(s, shiftId).filter((t) => t.status === 'PENDING_VERIFICATION');

// ---------------------------------------------------------------- reversos

export const liveReverse = (s: ScenarioState, tx: Transaction): Transaction | null =>
  s.transactions.find(
    (r) =>
      r.type === 'reverso' &&
      r.originalId === tx.id &&
      ['PENDING', 'PENDING_VERIFICATION', 'APPROVED'].includes(r.status)
  ) ?? null;

// ---------------------------------------------------------------- indicadores (R-17)

export interface IndicatorFilter {
  chainId?: string | null;
  pdvId?: string | null;
}

const inFilter = (t: Transaction, f: IndicatorFilter): boolean =>
  (!f.chainId || t.chainId === f.chainId) && (!f.pdvId || t.pdvId === f.pdvId);

export const filterTransactions = (s: ScenarioState, f: IndicatorFilter = {}): Transaction[] =>
  s.transactions.filter((t) => inFilter(t, f));

const isIncome = (t: Transaction): boolean =>
  t.status === 'APPROVED' && CONSUMES_QUOTA.has(t.type);

export const isCurrent = (t: Transaction): boolean =>
  t.status === 'APPROVED' && t.type !== 'reverso';

export interface Indicators {
  income: number;
  incomeByLine: Record<BusinessLine, number>;
  incomeByChain: Record<string, number>;
  withdrawals: number;
  current: number;
  rejected: { count: number; value: number };
  voided: { count: number; value: number };
  reversed: { count: number; value: number };
  inVerification: { count: number; value: number };
  approvalRate: number | null;
  authorized: number;
  chainCommission: number;
  it2exCommission: number;
  openExceptions: number;
  pendingToDeliver: number;
  quotasInAlert: number;
  quotaBlocks: number;
  closingDifferences: number;
  latest: Transaction[];
}

const countValue = (txs: Transaction[]) => ({
  count: txs.length,
  value: sum(txs.map((t) => t.value)),
});

export const indicators = (s: ScenarioState, f: IndicatorFilter = {}): Indicators => {
  const txs = filterTransactions(s, f);
  const nonReverse = txs.filter((t) => t.type !== 'reverso');
  const income = txs.filter(isIncome);
  const incomeByLine = {} as Record<BusinessLine, number>;
  for (const line of BUSINESS_LINES) {
    incomeByLine[line] = sum(income.filter((t) => t.line === line).map((t) => t.value));
  }
  const incomeByChain: Record<string, number> = {};
  for (const c of s.chains) {
    incomeByChain[c.id] = sum(income.filter((t) => t.chainId === c.id).map((t) => t.value));
  }
  const current = nonReverse.filter((t) => t.status === 'APPROVED');
  const rejected = nonReverse.filter((t) => t.status === 'REJECTED');
  const authorized = nonReverse.filter((t) => t.authorization !== null).length;
  const pdvIds = s.pdvs
    .filter((p) => (!f.pdvId || p.id === f.pdvId) && (!f.chainId || chainOfPdv(s, p.id) === f.chainId))
    .map((p) => p.id);
  const quotas = quotaTable(s).filter((q) => pdvIds.includes(q.pdvId));
  const today = s.demoDate;
  const conc = conciliation(s);
  const openExceptions = conc.rows.filter(
    (r) =>
      r.resolution === 'abierta' &&
      (!r.tx || inFilter(r.tx, f)) &&
      (r.tx || (!f.chainId && !f.pdvId))
  ).length;
  return {
    income: sum(income.map((t) => t.value)),
    incomeByLine,
    incomeByChain,
    withdrawals: sum(
      txs.filter((t) => t.type === 'retiro' && t.status === 'APPROVED').map((t) => t.value)
    ),
    current: current.length,
    rejected: countValue(rejected),
    voided: countValue(nonReverse.filter((t) => t.status === 'VOIDED')),
    reversed: countValue(nonReverse.filter((t) => t.status === 'REVERSED')),
    inVerification: countValue(nonReverse.filter((t) => t.status === 'PENDING_VERIFICATION')),
    authorized,
    approvalRate: authorized + rejected.length > 0 ? authorized / (authorized + rejected.length) : null,
    chainCommission: sum(current.map((t) => t.chainCommission ?? 0)),
    it2exCommission: sum(current.map((t) => t.it2exCommission ?? 0)),
    openExceptions,
    pendingToDeliver: sum(quotas.map((q) => q.used)),
    quotasInAlert: quotas.filter((q) => q.alert).length,
    quotaBlocks: s.alerts.filter(
      (a) => pdvIds.includes(a.pdvId) && localDate(new Date(a.at)) === today
    ).length,
    closingDifferences: sum(
      s.closings
        .filter((c) => !c.historical)
        .filter((c) => {
          const pdvId = pdvOfRegister(s, c.registerId);
          return !!pdvId && pdvIds.includes(pdvId);
        })
        .map((c) => c.difference)
    ),
    latest: [...txs].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 10),
  };
};

// ---------------------------------------------------------------- conciliación (R-11)

export type ConciliationClass = ExceptionType | 'Conciliada';

export interface ConciliationRow {
  id: string;
  tx: Transaction | null;
  reval: RevalRecord | null;
  classification: ConciliationClass;
  itValue: number | null;
  revalValue: number | null;
  difference: number;
  resolution: ResolutionStatus | null;
  resolutionInfo: ExceptionResolution | null;
}

const EQUIVALENT: Partial<Record<TxStatus, RevalStatus>> = {
  APPROVED: 'aprobada',
  VOIDED: 'anulada',
  REVERSED: 'reversada',
};

export const conciliation = (s: ScenarioState) => {
  const itUniverse = s.transactions.filter((t) => t.status !== 'REJECTED' && t.status !== 'PENDING');
  const revalUniverse = s.reval.filter((r) => r.status !== 'rechazada');
  const ids = Array.from(
    new Set([...itUniverse.map((t) => t.id), ...revalUniverse.map((r) => r.sharedId)])
  ).sort();
  const rows: ConciliationRow[] = ids.map((id) => {
    const tx = itUniverse.find((t) => t.id === id) ?? null;
    const rec = revalUniverse.find((r) => r.sharedId === id) ?? null;
    let classification: ConciliationClass;
    if (tx && !rec) {
      classification = 'Solo en IT2Pay';
    } else if (!tx && rec) {
      classification = 'Solo en Reval (simulado)';
    } else if (rec?.inconsistency) {
      classification = 'Inconsistencia reportada por Reval (simulado)';
    } else if (tx && rec && EQUIVALENT[tx.status] !== rec.status) {
      classification = 'Diferencia de estado';
    } else if (tx && rec && tx.value !== rec.value) {
      classification = 'Diferencia de valor';
    } else {
      classification = 'Conciliada';
    }
    const info = s.resolutions.find((r) => r.txId === id) ?? null;
    const itValue = tx?.value ?? null;
    const revalValue = rec?.value ?? null;
    return {
      id,
      tx,
      reval: rec,
      classification,
      itValue,
      revalValue,
      difference: (itValue ?? 0) - (revalValue ?? 0),
      resolution:
        classification === 'Conciliada'
          ? (info?.resolution ?? null)
          : (info?.resolution ?? 'abierta'),
      resolutionInfo: info,
    };
  });
  const exceptions = rows.filter((r) => r.classification !== 'Conciliada');
  return {
    rows,
    exceptions,
    compared: rows.length,
    conciliated: rows.length - exceptions.length,
    open: exceptions.filter((r) => r.resolution === 'abierta').length,
    resolvedWithAdjustment: exceptions.filter((r) => r.resolution === 'resuelta con ajuste').length,
    resolved: s.resolutions.filter((r) => r.resolution !== 'abierta'),
    informativeDifferences: sum(
      rows
        .filter((r) => r.classification === 'Diferencia de valor')
        .map((r) => Math.abs(r.difference))
    ),
  };
};

// ---------------------------------------------------------------- compensación (R-12..R-14)

export const pendingToDeliverByPdv = (s: ScenarioState) =>
  s.pdvs.map((p) => ({
    pdvId: p.id,
    value: sum(quotaTable(s).filter((q) => q.pdvId === p.id).map((q) => q.used)),
  }));

export const compensation = (s: ScenarioState, mode: CompensationMode = s.compensationMode) => {
  const ind = indicators(s);
  const obligationByChain = s.chains.map((c) => {
    const income = sum(
      s.transactions.filter((t) => t.chainId === c.id && isIncome(t)).map((t) => t.value)
    );
    const withdrawals = sum(
      s.transactions
        .filter((t) => t.chainId === c.id && t.type === 'retiro' && t.status === 'APPROVED')
        .map((t) => t.value)
    );
    return { chainId: c.id, income, withdrawals, obligation: income - withdrawals };
  });
  const obligation = ind.income - ind.withdrawals;
  const delivered = sum(
    s.consignments.filter((c) => c.status === 'Validada').map((c) => c.value)
  );
  const toValidate = sum(
    s.consignments.filter((c) => c.status === 'Reportada').map((c) => c.value)
  );
  const incomeTx = s.transactions.filter(isIncome);
  return {
    mode,
    income: ind.income,
    incomeByLine: ind.incomeByLine,
    withdrawals: ind.withdrawals,
    obligation,
    obligationByChain,
    chainCommission: ind.chainCommission,
    it2exCommission: ind.it2exCommission,
    netToTransfer:
      mode === 'descontado' ? obligation - ind.chainCommission - ind.it2exCommission : obligation,
    inVerification: ind.inVerification.value,
    informativeDifferences: conciliation(s).informativeDifferences,
    delivered,
    toValidate,
    pendingToDeliver: ind.pendingToDeliver,
    pendingByPdv: pendingToDeliverByPdv(s),
    cashIncome: sum(incomeTx.filter((t) => t.method === 'efectivo').map((t) => t.value)),
    otherIncome: sum(incomeTx.filter((t) => t.method !== 'efectivo').map((t) => t.value)),
  };
};

// ---------------------------------------------------------------- comisiones y finanzas (R-15, R-16)

export const liveLiquidationRows = (s: ScenarioState): LiquidationRow[] => {
  const rows: LiquidationRow[] = [];
  for (const t of s.transactions.filter(isCurrent)) {
    const key = { chainId: t.chainId, serviceId: t.serviceId ?? '—' };
    let row = rows.find((r) => r.chainId === key.chainId && r.serviceId === key.serviceId);
    if (!row) {
      row = { ...key, count: 0, chainCommission: 0, it2exCommission: 0 };
      rows.push(row);
    }
    row.count += 1;
    row.chainCommission += t.chainCommission ?? 0;
    row.it2exCommission += t.it2exCommission ?? 0;
  }
  return rows.sort(
    (a, b) => a.chainId.localeCompare(b.chainId) || a.serviceId.localeCompare(b.serviceId)
  );
};

export const liquidationTotals = (rows: LiquidationRow[]) => {
  const chain = sum(rows.map((r) => r.chainCommission));
  const it2ex = sum(rows.map((r) => r.it2exCommission));
  return { count: sum(rows.map((r) => r.count)), chain, it2ex, total: chain + it2ex };
};

export const portfolio = (s: ScenarioState): PortfolioBalance[] => {
  const ind = indicators(s);
  const live: PortfolioBalance[] = [
    {
      concept: 'Comisión IT2EX',
      debtor: 'Reval (simulado)',
      creditor: 'IT2EX',
      aging: 'Periodo demo',
      value: ind.it2exCommission,
      origin: 'vivo',
    },
    {
      concept: 'Comisión de cadenas',
      debtor: 'Reval (simulado)',
      creditor: 'Cadenas',
      aging: 'Periodo demo',
      value: ind.chainCommission,
      origin: 'vivo',
    },
  ];
  return [...live, ...s.portfolio];
};

// ---------------------------------------------------------------- cobertura (V01)

export const coverage = (s: ScenarioState) => {
  const activeChains = s.chains.filter((c) => c.active);
  const chainIds = new Set(activeChains.map((c) => c.id));
  const branches = s.branches.filter((b) => chainIds.has(b.chainId) && b.active);
  const branchIds = new Set(branches.map((b) => b.id));
  const pdvs = s.pdvs.filter((p) => branchIds.has(p.branchId) && p.active);
  const pdvIds = new Set(pdvs.map((p) => p.id));
  const registers = s.registers.filter((r) => pdvIds.has(r.pdvId));
  const enabled = new Set<string>();
  for (const p of pdvs) {
    for (const svc of s.services) {
      if (isServiceEnabledForPdv(s, svc.id, p.id)) {
        enabled.add(svc.id);
      }
    }
  }
  return {
    chains: activeChains.length,
    branches: branches.length,
    pdvs: pdvs.length,
    registers: registers.length,
    cashiers: s.users.filter((u) => u.profile === 'Cajero' && u.active).length,
    services: enabled.size,
  };
};
