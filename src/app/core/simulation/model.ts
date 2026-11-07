/**
 * Modelo de estado compartido del simulador (flow-map §2).
 * Todo el estado de un escenario es JSON plano: se clona, se persiste y se
 * restaura sin pérdida. Los derivados (cupo, efectivo esperado, indicadores,
 * conciliación…) se calculan en `selectors.ts`, nunca se copian aquí.
 */

export type ScenarioId = 'SUP' | 'PAR';

export type BusinessLine = 'Recaudos' | 'Recargas' | 'Corresponsalía';
export const BUSINESS_LINES: readonly BusinessLine[] = [
  'Recaudos',
  'Recargas',
  'Corresponsalía',
];

export type OperationType = 'recaudo' | 'recarga' | 'deposito' | 'retiro';
export type TransactionType = OperationType | 'reverso';

export type TxStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_VERIFICATION'
  | 'VOIDED'
  | 'REVERSED';

export type PaymentMethod =
  | 'efectivo'
  | 'debito'
  | 'credito'
  | 'transferencia'
  | 'qr';
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'efectivo',
  'debito',
  'credito',
  'transferencia',
  'qr',
];

/**
 * Los 8 roles de IT2Pay (glosario §1.2 de la Fase D re-ejecutada, D-ACT-01 a D-ACT-04).
 * «Cajero» es sinónimo de Colocador; el «Supervisor» lo cubre el Punto de Venta.
 */
export type ProfileName =
  | 'Colocador'
  | 'Punto de Venta'
  | 'Asesor de Ventas'
  | 'Operador'
  | 'Finanzas'
  | 'Aprobador financiero'
  | 'Administrador'
  | 'Super Usuario';

export const PROFILES: readonly ProfileName[] = [
  'Colocador',
  'Punto de Venta',
  'Asesor de Ventas',
  'Operador',
  'Finanzas',
  'Aprobador financiero',
  'Administrador',
  'Super Usuario',
];

export interface Chain {
  id: string;
  name: string;
  nit: string;
  active: boolean;
}

export interface Branch {
  id: string;
  chainId: string;
  name: string;
  active: boolean;
}

export interface PointOfSale {
  id: string;
  branchId: string;
  name: string;
  activityType: string;
  active: boolean;
}

export interface CashRegister {
  id: string;
  pdvId: string;
  currentShiftId: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  profile: ProfileName;
  registerIds: string[];
  active: boolean;
  /** PDV al que pertenece (Colocador y Punto de Venta, RN-ACC-04); null para el personal de IT2EX. */
  pdvId: string | null;
}

export interface Shift {
  id: string;
  registerId: string;
  cashierId: string;
  openedAt: string;
  baseCash: number;
  status: 'abierto' | 'cerrado';
  closingId: string | null;
}

export type DeviceType =
  | 'Terminal web'
  | 'Datáfono simulado'
  | 'Impresora de tirilla simulada';

export interface Device {
  id: string;
  registerId: string;
  type: DeviceType;
  serial: string;
  active: boolean;
}

export interface ServiceReference {
  name: string;
  minLength: number;
  maxLength: number;
  /** Lista cerrada de valores (p. ej. tipo de cuenta). */
  options?: string[];
  /** Número celular: 10 dígitos que inician por 3 (R-20). */
  mobile?: boolean;
}

export interface Service {
  id: string;
  name: string;
  categoryCode: number;
  category: string;
  subcategoryCode: number | null;
  subcategory: string;
  operationType: OperationType | null;
  line: BusinessLine | null;
  references: ServiceReference[];
  requiresOtp: boolean;
  allowsPartial: boolean;
  minPartial: number | null;
  allowsLate: boolean;
  range: { min: number; max: number } | null;
  suggestedValues: number[];
  active: boolean;
  /** Capacidad documentada (P3), no operable en la demo. */
  documentedOnly: boolean;
  /** Ítem de nivel P2 (visualización ligera). */
  p2: boolean;
}

export type ObligationStatus = 'Pendiente' | 'En verificación' | 'Pagada';

export interface Obligation {
  key: string;
  serviceId: string;
  references: string[];
  holder: string;
  value: number;
  dueDate: string;
  balance: number;
  status: ObligationStatus;
  verifyingTxId: string | null;
}

export interface Enablement {
  serviceId: string;
  level: 'cadena' | 'pdv';
  targetId: string;
  enabled: boolean;
}

export interface Commission {
  id: string;
  serviceId: string;
  /** null = comisión general del servicio. */
  chainId: string | null;
  chainValue: number;
  it2exValue: number;
}

export interface Quota {
  pdvId: string;
  line: BusinessLine;
  assigned: number;
  initialConsumption: number;
}

export interface QuotaAlert {
  id: string;
  pdvId: string;
  line: BusinessLine;
  serviceId: string;
  attemptedValue: number;
  available: number | null;
  at: string;
  registerId: string;
  message: string;
}

export interface TraceEntry {
  from: TxStatus | null;
  to: TxStatus;
  event: string;
  at: string;
  user: string;
  note: string | null;
}

export type ReverseKind = 'funcional' | 'tecnico';

export interface Transaction {
  id: string;
  idempotencyKey: string;
  at: string;
  scenario: ScenarioId;
  chainId: string;
  branchId: string;
  pdvId: string;
  registerId: string;
  shiftId: string;
  operatorId: string;
  type: TransactionType;
  line: BusinessLine | null;
  serviceId: string | null;
  references: string[];
  referenceDisplay: string;
  value: number;
  method: PaymentMethod;
  cashReceived: number | null;
  change: number | null;
  status: TxStatus;
  authorization: string | null;
  responseCode: string | null;
  responseMessage: string | null;
  originalId: string | null;
  reverseKind: ReverseKind | null;
  reverseReason: string | null;
  /** Reversos solicitados sobre esta transacción (histórico). */
  reverseIds: string[];
  voidInfo: { at: string; reason: string; authorizedBy: string } | null;
  chainCommission: number | null;
  it2exCommission: number | null;
  consultations: number;
  trace: TraceEntry[];
  /** Gatillo o panel que decidió el desenlace (solo panel del presentador). */
  appliedOutcome: string;
  /** Consultas que aún responden «En proceso» (gatillo 410). */
  pendingInProcess: number;
  lastConsultResult: 'EP' | 'SR' | null;
  retryAvailable: boolean;
  obligationKey: string | null;
  partial: boolean;
}

export type AuthRequestType =
  | 'autorizar'
  | 'consultar estado'
  | 'reintentar'
  | 'anular'
  | 'reversar'
  | 'consultar reverso';

export interface AuthAttempt {
  id: string;
  txId: string;
  attempt: number;
  requestType: AuthRequestType;
  result: 'aprobada' | 'rechazada' | 'timeout' | 'en proceso' | 'sin registro';
  code: string;
  message: string;
  authorization: string | null;
  at: string;
}

export type RevalStatus =
  | 'aprobada'
  | 'rechazada'
  | 'anulada'
  | 'reversada'
  | 'en proceso';

export interface RevalRecord {
  sharedId: string;
  idempotencyKey: string;
  type: TransactionType;
  value: number;
  status: RevalStatus;
  inconsistency: string | null;
  originalId: string | null;
}

export type ExceptionType =
  | 'Diferencia de valor'
  | 'Diferencia de estado'
  | 'Solo en IT2Pay'
  | 'Solo en Reval (simulado)'
  | 'Inconsistencia reportada por Reval (simulado)';

export type ResolutionStatus =
  | 'abierta'
  | 'resuelta por consulta'
  | 'resuelta con ajuste'
  | 'resuelta por reverso técnico';

export interface ExceptionResolution {
  txId: string;
  type: ExceptionType;
  resolution: ResolutionStatus;
  note: string | null;
  at: string;
  user: string;
}

export type ClosingClassification = 'Cuadrada' | 'Sobrante' | 'Faltante';

export interface CashClosing {
  id: string;
  shiftId: string;
  registerId: string;
  cashierId: string;
  at: string;
  expectedByMethod: Record<PaymentMethod, number>;
  declaredCash: number;
  difference: number;
  classification: ClosingClassification;
  observation: string;
  /** Cierre de un día anterior: se muestra en el historial, fuera del periodo demo. */
  historical: boolean;
}

export type ConsignmentStatus = 'Reportada' | 'Validada' | 'Rechazada';

export interface Consignment {
  id: string;
  pdvId: string;
  line: BusinessLine;
  value: number;
  bank: string;
  support: string;
  status: ConsignmentStatus;
  reportedAt: string;
  validatedAt: string | null;
}

export interface LiquidationRow {
  chainId: string;
  serviceId: string;
  count: number;
  chainCommission: number;
  it2exCommission: number;
}

export interface Liquidation {
  id: string;
  period: string;
  at: string;
  rows: LiquidationRow[];
  totals: { count: number; chain: number; it2ex: number; total: number };
  status: ApprovalStatus;
  review: Review;
}

/** Segregación de funciones (RN-ACC-06): Finanzas genera, el Aprobador financiero aprueba. */
export type ApprovalStatus = 'Pendiente de aprobación' | 'Aprobada' | 'Rechazada';

export interface Review {
  createdBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/** Propuesta de Finanzas para resolver una excepción de conciliación (UC-17), que aprueba el Aprobador (UC-18). */
export interface ConciliationProposal {
  id: string;
  txId: string;
  kind: 'reverso técnico' | 'ajuste';
  note: string | null;
  at: string;
  status: ApprovalStatus;
  review: Review;
}

export interface CollectionAccount {
  id: string;
  issuer: string;
  receiver: string;
  period: string;
  liquidationId: string;
  at: string;
  items: { concept: string; quantity: number; value: number }[];
  total: number;
  status: ApprovalStatus;
  review: Review;
}

export type PortfolioAging = 'Periodo demo' | '1–30 días' | '31–60 días';

export interface PortfolioBalance {
  concept: string;
  debtor: string;
  creditor: string;
  aging: PortfolioAging;
  value: number;
  origin: 'precargado' | 'vivo';
}

export interface Counters {
  TX: number;
  CIE: number;
  CON: number;
  LIQ: number;
  CC: number;
  PRO: number;
  ALR: number;
  SUC: number;
  PDV: number;
  CAJ: number;
  CAD: number;
  SRV: number;
  COM: number;
}

export type AuthOverride =
  | 'gatillo'
  | 'aprobar'
  | 'rechazar'
  | 'timeout-aprobada'
  | 'timeout-rechazada'
  | 'timeout-en-proceso'
  | 'timeout-sin-registro';

export type ReverseOverride =
  | 'aprobado'
  | 'rechazado'
  | 'timeout-aprobado'
  | 'timeout-rechazado';

export interface PresenterPanel {
  nextAuthorization: AuthOverride;
  nextReverse: ReverseOverride;
  idempotency: boolean;
}

export type CompensationMode = 'separado' | 'descontado';

export interface Session {
  chainId: string | null;
  branchId: string | null;
  registerId: string | null;
  userId: string | null;
  shiftId: string | null;
}

/** Usuario autenticado en el login (separado del turno de caja). */
export interface Auth {
  userId: string | null;
}

export interface ScenarioState {
  schemaVersion: number;
  id: ScenarioId;
  name: string;
  commerceType: 'supermercado' | 'parqueadero';
  demoDate: string;
  chains: Chain[];
  branches: Branch[];
  pdvs: PointOfSale[];
  registers: CashRegister[];
  users: AppUser[];
  shifts: Shift[];
  devices: Device[];
  services: Service[];
  obligations: Obligation[];
  enablements: Enablement[];
  commissions: Commission[];
  quotas: Quota[];
  alerts: QuotaAlert[];
  transactions: Transaction[];
  authAttempts: AuthAttempt[];
  reval: RevalRecord[];
  resolutions: ExceptionResolution[];
  closings: CashClosing[];
  consignments: Consignment[];
  liquidations: Liquidation[];
  collectionAccounts: CollectionAccount[];
  proposals: ConciliationProposal[];
  portfolio: PortfolioBalance[];
  counters: Counters;
  presenter: PresenterPanel;
  compensationMode: CompensationMode;
  session: Session;
  auth: Auth;
  lastConciliationAt: string | null;
  lastResultTxId: string | null;
}

export type Result<T> =
  | { ok: true; value: T; message?: string }
  | { ok: false; error: string };

/**
 * Versión del estado persistido. v2: tipos de excepción renombrados a
 * «… Reval (simulado)». v3: 8 roles, login y aprobaciones (D-T4).
 * Un estado guardado con otra versión se descarta.
 */
export const SCHEMA_VERSION = 3;
