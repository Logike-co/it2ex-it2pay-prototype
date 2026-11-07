import { DEFAULT_COMMISSION } from './catalog';
import { addDays, Clock, localDate } from './clock';
import { formatMoney, maskAccount, pad } from './format';
import {
  AppUser,
  AuthAttempt,
  AuthOverride,
  BusinessLine,
  CashClosing,
  CompensationMode,
  ConciliationProposal,
  Consignment,
  Device,
  DeviceType,
  Liquidation,
  Obligation,
  OperationType,
  PaymentMethod,
  PresenterPanel,
  ProfileName,
  ReverseKind,
  Result,
  Review,
  RevalRecord,
  ScenarioState,
  Service,
  ServiceReference,
  Shift,
  Transaction,
  TxStatus,
} from './model';
import { holderFor, obligationKey } from './seed';
import {
  catalogForRegister,
  chainOfPdv,
  commissionFor,
  conciliation,
  expectedByMethod,
  expectedCash,
  liquidationTotals,
  liveLiquidationRows,
  liveReverse,
  pendingVerificationInShift,
  quotaStatus,
} from './selectors';

/**
 * Motor de simulación determinista (flow-map §3 y §4). Opera sobre un
 * `ScenarioState` mutable: quien lo usa le entrega una copia y, al terminar
 * cada comando, guarda `sim.state`. Sin Angular ni efectos externos; el
 * reloj se inyecta (FM-19).
 */

export const MESSAGES = {
  sending: 'Enviando a Reval (simulado)…',
  approved: 'Aprobada (simulado)',
  rejected: 'Rechazada por el autorizador simulado',
  otpInvalid: 'OTP inválido (simulado)',
  timeout: 'Sin respuesta del autorizador (simulado): operación en verificación',
  inProcess: 'En proceso: continúe consultando',
  definitiveRejection: 'Rechazada definitiva: no se reintenta',
  noRecord: 'Sin registro en Reval (simulado)',
  noIdempotency: 'Sin idempotencia: no se reintenta; queda para conciliación',
  voided: 'Anulada (simulado)',
  reverseApproved: 'Reverso aprobado (simulado)',
  reverseRejected: 'Reverso rechazado por el autorizador simulado',
  noObligation: 'Referencia sin obligación pendiente (simulado)',
  overdue: 'Obligación vencida: el convenio no admite pago extemporáneo',
  registerClosed: 'Caja cerrada: abra un turno para operar',
  noVerificationReceipt: 'No entregue comprobante: operación en verificación',
  rechargeNoVoid: 'Las recargas no se anulan en esta simulación; use Reversar (ilustrativo)',
  withdrawalNoVoid: 'Los retiros no se anulan en esta simulación (ilustrativo)',
  reverseNoVoid: 'Un reverso no se anula ni se reversa',
  cashInsufficient: 'Efectivo insuficiente',
};

export interface AuthorizeInput {
  serviceId: string;
  references: string[];
  value: number;
  method: PaymentMethod;
  cashReceived?: number | null;
  otp?: string | null;
}

export interface ConsultResult {
  code: string;
  message: string;
  status: TxStatus;
}

type Outcome =
  | 'approve'
  | 'reject'
  | 'reject-otp'
  | 'timeout-approve'
  | 'timeout-reject'
  | 'timeout-inprocess'
  | 'timeout-norecord';

const OVERRIDE_OUTCOME: Record<Exclude<AuthOverride, 'gatillo'>, Outcome> = {
  aprobar: 'approve',
  rechazar: 'reject',
  'timeout-aprobada': 'timeout-approve',
  'timeout-rechazada': 'timeout-reject',
  'timeout-en-proceso': 'timeout-inprocess',
  'timeout-sin-registro': 'timeout-norecord',
};

const TRIGGER_OUTCOME: Record<string, Outcome> = {
  '013': 'reject',
  '408': 'timeout-approve',
  '409': 'timeout-reject',
  '410': 'timeout-inprocess',
  '404': 'timeout-norecord',
};

const ok = <T>(value: T, message?: string): Result<T> => ({ ok: true, value, message });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

/** Clave de gatillo: tres últimos dígitos de la referencia principal (FM-05). */
export const triggerKey = (references: string[]): string => {
  const last = references[references.length - 1] ?? '';
  return last.slice(-3);
};

/**
 * R-20: referencias del convenio (obligatorias, numéricas, con su longitud;
 * celular de 10 dígitos que inicia por 3). Devuelve el mensaje o `null`.
 * Lo usan F12 (motor) y el avance de paso de V05 (validación temprana).
 */
export const referenceError = (svc: Service, refs: string[]): string | null => {
  if (refs.length !== svc.references.length) {
    return 'Complete todas las referencias del convenio';
  }
  for (let i = 0; i < svc.references.length; i++) {
    const def: ServiceReference = svc.references[i];
    const value = (refs[i] ?? '').trim();
    if (!value) {
      return `Ingrese «${def.name}»`;
    }
    if (def.options) {
      if (!def.options.includes(value)) {
        return `Seleccione «${def.name}»`;
      }
      continue;
    }
    if (!/^\d+$/.test(value) || value.length < def.minLength || value.length > def.maxLength) {
      const len = def.minLength === def.maxLength ? `${def.minLength}` : `${def.minLength} a ${def.maxLength}`;
      return `«${def.name}» debe tener ${len} dígitos`;
    }
    if (def.mobile && !value.startsWith('3')) {
      return 'El número celular debe tener 10 dígitos e iniciar por 3';
    }
  }
  return null;
};

/** R-20: valor dentro del rango del servicio (recargas, depósitos y retiros). */
export const rangeError = (svc: Service, value: number): string | null =>
  svc.range && (value < svc.range.min || value > svc.range.max)
    ? `El valor debe estar entre ${formatMoney(svc.range.min)} y ${formatMoney(svc.range.max)}`
    : null;

export class Simulator {
  constructor(
    public state: ScenarioState,
    private readonly clock: Clock
  ) {}

  // ================================================================ utilidades

  private nowIso(): string {
    return this.clock.now().toISOString();
  }

  private today(): string {
    return localDate(this.clock.now());
  }

  private get esc(): string {
    return this.state.id[0];
  }

  private sessionUser(): string {
    return this.state.auth.userId ?? this.state.session.userId ?? 'sistema';
  }

  /** Usuario autenticado en el login; undefined sin login (pruebas del motor y procesos del sistema). */
  private actor(): AppUser | undefined {
    const id = this.state.auth.userId;
    return id ? this.state.users.find((u) => u.id === id) : undefined;
  }

  /** Falla si hay un usuario autenticado y su rol no está entre los permitidos (defensa en profundidad). */
  private denied(roles: ProfileName[], message: string): string | null {
    const a = this.actor();
    return a && !roles.includes(a.profile) ? message : null;
  }

  private tx(id: string): Transaction | undefined {
    return this.state.transactions.find((t) => t.id === id);
  }

  private service(id: string): Service | undefined {
    return this.state.services.find((s) => s.id === id);
  }

  private revalOf(id: string): RevalRecord | undefined {
    return this.state.reval.find((r) => r.sharedId === id);
  }

  private nextTxId(): { id: string; n: number } {
    const n = this.state.counters.TX;
    this.state.counters.TX += 1;
    return { id: `TX-${this.esc}-${pad(n, 4)}`, n };
  }

  private authCodeFor(txId: string): string {
    return `AUT-${this.esc}-${100000 + Number(txId.slice(-4))}`;
  }

  private moveTo(tx: Transaction, to: TxStatus, event: string, note: string | null = null): void {
    tx.trace.push({
      from: tx.status,
      to,
      event,
      at: this.nowIso(),
      user: this.sessionUser(),
      note,
    });
    tx.status = to;
  }

  private attempt(
    tx: Transaction,
    requestType: AuthAttempt['requestType'],
    result: AuthAttempt['result'],
    code: string,
    message: string
  ): void {
    const n = this.state.authAttempts.filter((a) => a.txId === tx.id).length + 1;
    this.state.authAttempts.push({
      id: `${tx.id}-A${n}`,
      txId: tx.id,
      attempt: n,
      requestType,
      result,
      code,
      message,
      authorization: tx.authorization,
      at: this.nowIso(),
    });
  }

  private upsertReval(tx: Transaction, status: RevalRecord['status']): RevalRecord {
    let rec = this.state.reval.find((r) => r.idempotencyKey === tx.idempotencyKey);
    if (!rec) {
      rec = {
        sharedId: tx.id,
        idempotencyKey: tx.idempotencyKey,
        type: tx.type,
        value: tx.value,
        status,
        inconsistency: null,
        originalId: tx.originalId,
      };
      this.state.reval.push(rec);
    } else {
      rec.status = status;
    }
    return rec;
  }

  private obligation(key: string | null): Obligation | undefined {
    return key ? this.state.obligations.find((o) => o.key === key) : undefined;
  }

  // ================================================================ login y sesión (V01)

  /** La caja opera solo si su PDV, su sucursal y su cadena están activos. */
  private networkActive(registerId: string): boolean {
    const pdv = this.state.pdvs.find((p) => p.id === this.state.registers.find((r) => r.id === registerId)?.pdvId);
    const branch = this.state.branches.find((b) => b.id === pdv?.branchId);
    const chain = this.state.chains.find((c) => c.id === branch?.chainId);
    return !!(pdv?.active && branch?.active && chain?.active);
  }

  /**
   * Login simulado: la contraseña se llena sola y no se valida (exclusión §9 del alcance).
   * Un Colocador con turno abierto en su caja retoma esa sesión de caja.
   */
  signIn(userId: string): Result<AppUser> {
    const user = this.state.users.find((u) => u.id === userId && u.active);
    if (!user) {
      return fail('Seleccione un usuario activo');
    }
    this.state.auth = { userId: user.id };
    this.logout();
    if (user.profile === 'Colocador') {
      const register = this.state.registers.find(
        (r) => user.registerIds.includes(r.id) && r.currentShiftId && this.networkActive(r.id)
      );
      if (register) {
        const pdvId = register.pdvId;
        this.state.session = {
          chainId: chainOfPdv(this.state, pdvId),
          branchId: this.state.pdvs.find((p) => p.id === pdvId)?.branchId ?? null,
          registerId: register.id,
          userId: user.id,
          shiftId: register.currentShiftId,
        };
      }
    }
    return ok(user, `Bienvenido, ${user.name} (${user.profile})`);
  }

  /** Cierra la sesión del usuario; el turno de la caja sigue abierto. */
  signOut(): void {
    this.state.auth = { userId: null };
    this.logout();
  }

  login(registerId: string, userId: string, baseCash = 100_000): Result<Shift> {
    const register = this.state.registers.find((r) => r.id === registerId);
    const user = this.state.users.find((u) => u.id === userId && u.active);
    if (!register) {
      return fail('Seleccione una caja');
    }
    if (!user) {
      return fail('Seleccione un usuario activo');
    }
    if (user.profile !== 'Colocador') {
      return fail('Solo un Colocador abre turno en una caja (RN-ACC-01)');
    }
    if (!user.registerIds.includes(registerId)) {
      return fail(`${user.name} no está asignado a ${registerId}`);
    }
    if (!this.networkActive(registerId)) {
      return fail(`${registerId} no opera: su PDV, sucursal o cadena está inactiva`);
    }
    const pdvId = register.pdvId;
    const branchId = this.state.pdvs.find((p) => p.id === pdvId)?.branchId ?? null;
    const chainId = chainOfPdv(this.state, pdvId);
    let shift = this.state.shifts.find((s) => s.id === register.currentShiftId);
    let message = `Sesión en el turno abierto ${shift?.id}`;
    if (!shift) {
      if (!(baseCash >= 0)) {
        return fail('La base inicial debe ser un valor mayor o igual a cero');
      }
      const baseId = `T-${registerId.slice(3)}`;
      let id = baseId;
      let k = 2;
      while (this.state.shifts.some((s) => s.id === id)) {
        id = `${baseId}-${k++}`;
      }
      shift = {
        id,
        registerId,
        cashierId: userId,
        openedAt: this.nowIso(),
        baseCash,
        status: 'abierto',
        closingId: null,
      };
      this.state.shifts.push(shift);
      register.currentShiftId = id;
      message = `Turno ${id} abierto con base de ${formatMoney(baseCash)}`;
    }
    this.state.session = { chainId, branchId, registerId, userId, shiftId: shift.id };
    return ok(shift, message);
  }

  logout(): void {
    this.state.session = { chainId: null, branchId: null, registerId: null, userId: null, shiftId: null };
  }

  // ================================================================ red (V03, B01–B04)

  createChain(name: string): Result<string> {
    const denied = this.denied(['Asesor de Ventas'], 'Solo el Asesor de Ventas crea cadenas y razones sociales');
    if (denied) {
      return fail(denied);
    }
    if (!name.trim()) {
      return fail('El nombre es obligatorio');
    }
    const n = this.state.counters.CAD++;
    const id = `CAD-${this.esc}${n}`;
    const digit = this.esc === 'S' ? 1 : 2;
    this.state.chains.push({
      id,
      name: name.trim(),
      nit: `000.111.${digit}${pad(n, 2)}-${n % 10} (ficticio)`,
      active: true,
    });
    return ok(id, `Cadena ${id} creada`);
  }

  updateChain(id: string, patch: { name?: string; active?: boolean }): Result<string> {
    const denied = this.denied(['Asesor de Ventas', 'Operador'], 'Su perfil no modifica cadenas');
    if (denied) {
      return fail(denied);
    }
    const chain = this.state.chains.find((c) => c.id === id);
    if (!chain) {
      return fail('Cadena no encontrada');
    }
    if (patch.name !== undefined) {
      if (!patch.name.trim()) {
        return fail('El nombre es obligatorio');
      }
      chain.name = patch.name.trim();
    }
    if (patch.active !== undefined) {
      chain.active = patch.active;
    }
    return ok(id, `Cadena ${id} actualizada`);
  }

  createBranch(chainId: string, name: string): Result<string> {
    const denied = this.denied(['Asesor de Ventas'], 'Solo el Asesor de Ventas crea sucursales');
    if (denied) {
      return fail(denied);
    }
    if (!this.state.chains.some((c) => c.id === chainId)) {
      return fail('Seleccione una cadena');
    }
    if (!name.trim()) {
      return fail('El nombre es obligatorio');
    }
    const id = `SUC-${this.esc}${this.state.counters.SUC++}`;
    this.state.branches.push({ id, chainId, name: name.trim(), active: true });
    return ok(id, `Sucursal ${id} creada`);
  }

  createPdv(branchId: string, name: string): Result<string> {
    if (!this.state.branches.some((b) => b.id === branchId)) {
      return fail('Seleccione una sucursal');
    }
    if (!name.trim()) {
      return fail('El nombre es obligatorio');
    }
    const denied = this.denied(['Asesor de Ventas'], 'Solo el Asesor de Ventas crea puntos de venta');
    if (denied) {
      return fail(denied);
    }
    const id = `PDV-${this.esc}${this.state.counters.PDV++}`;
    this.state.pdvs.push({
      id,
      branchId,
      name: name.trim(),
      activityType: this.state.id === 'SUP' ? 'Punto de servicios' : 'Taquilla',
      active: true,
    });
    // RN-ACC-03: el usuario Punto de Venta se crea con su PDV.
    const n = this.state.users.filter((u) => u.profile === 'Punto de Venta').length + 1;
    const userId = `PV-${this.esc}${pad(n, 2)}`;
    this.state.users.push({
      id: userId,
      name: `PDV ${name.trim()}`,
      profile: 'Punto de Venta',
      registerIds: [],
      active: true,
      pdvId: id,
    });
    return ok(id, `PDV ${id} creado con su usuario Punto de Venta ${userId}`);
  }

  setActive(kind: 'branch' | 'pdv', id: string, active: boolean): Result<string> {
    const denied = this.denied(['Operador'], 'Solo el Operador activa e inactiva puntos de venta');
    if (denied) {
      return fail(denied);
    }
    const list = kind === 'branch' ? this.state.branches : this.state.pdvs;
    const item = list.find((x) => x.id === id);
    if (!item) {
      return fail('Registro no encontrado');
    }
    item.active = active;
    return ok(id, `${id} ${active ? 'activado' : 'inactivado'}`);
  }

  createRegister(pdvId: string): Result<string> {
    const denied = this.denied(['Punto de Venta'], 'Solo el Punto de Venta crea cajas en su PDV');
    if (denied) {
      return fail(denied);
    }
    if (!this.state.pdvs.some((p) => p.id === pdvId)) {
      return fail('Seleccione un PDV');
    }
    const owner = this.actor();
    if (owner?.pdvId && owner.pdvId !== pdvId) {
      return fail('El Punto de Venta solo crea cajas en su PDV (RN-ACC-04)');
    }
    const suffix = pdvId.replace('PDV-', '');
    const n = this.state.registers.filter((r) => r.pdvId === pdvId).length + 1;
    const id = `CJ-${suffix}-${pad(n, 2)}`;
    this.state.registers.push({ id, pdvId, currentShiftId: null });
    return ok(id, `Caja ${id} creada`);
  }

  createUser(name: string, profile: ProfileName, registerIds: string[]): Result<string> {
    if (!name.trim()) {
      return fail('El nombre es obligatorio');
    }
    const actor = this.actor();
    if (actor && !creatableProfiles(actor.profile).includes(profile)) {
      return fail(`El perfil ${actor.profile} no crea usuarios ${profile}`);
    }
    if (profile === 'Punto de Venta') {
      return fail('El usuario Punto de Venta se crea con su PDV');
    }
    let pdvId: string | null = null;
    if (profile === 'Colocador') {
      const pdvs = new Set(registerIds.map((r) => this.state.registers.find((x) => x.id === r)?.pdvId));
      pdvId = [...pdvs][0] ?? actor?.pdvId ?? null;
      if (actor?.profile === 'Punto de Venta' && (pdvs.size > 1 || pdvId !== actor.pdvId)) {
        return fail('El Punto de Venta solo crea colocadores de su PDV (RN-ACC-04)');
      }
    }
    let id: string;
    if (profile === 'Colocador') {
      id = `COL-${this.esc}${pad(this.state.counters.CAJ++, 2)}`;
    } else {
      const n = this.state.users.filter((u) => u.profile === profile).length + 1;
      id = `${PROFILE_PREFIX[profile]}-${this.esc}${pad(n, 2)}`;
    }
    const user: AppUser = { id, name: name.trim(), profile, registerIds: [...registerIds], active: true, pdvId };
    this.state.users.push(user);
    return ok(id, `Usuario ${id} creado`);
  }

  assignUser(userId: string, registerId: string): Result<string> {
    const denied = this.denied(['Punto de Venta'], 'Solo el Punto de Venta asigna colocadores a sus cajas');
    if (denied) {
      return fail(denied);
    }
    const user = this.state.users.find((u) => u.id === userId);
    if (!user || !this.state.registers.some((r) => r.id === registerId)) {
      return fail('Seleccione un colocador y una caja');
    }
    if (!user.registerIds.includes(registerId)) {
      user.registerIds.push(registerId);
    }
    return ok(userId, `${user.name} asignado a ${registerId}`);
  }

  suggestedSerial(): string {
    return `SIM-${this.esc}-${pad(this.state.devices.length + 1, 4)}`;
  }

  createDevice(registerId: string, type: DeviceType, serial?: string): Result<string> {
    const denied = this.denied(['Punto de Venta'], 'Solo el Punto de Venta registra dispositivos en sus cajas');
    if (denied) {
      return fail(denied);
    }
    const register = this.state.registers.find((r) => r.id === registerId);
    if (!register) {
      return fail('Seleccione una caja');
    }
    const suffix = register.pdvId.replace('PDV-', '');
    const pdvRegisters = this.state.registers.filter((r) => r.pdvId === register.pdvId).map((r) => r.id);
    const n = this.state.devices.filter((d) => pdvRegisters.includes(d.registerId)).length + 1;
    const device: Device = {
      id: `DSP-${suffix}-${pad(n, 2)}`,
      registerId,
      type,
      serial: serial?.trim() || this.suggestedSerial(),
      active: true,
    };
    this.state.devices.push(device);
    return ok(device.id, `Dispositivo ${device.id} registrado`);
  }

  // ================================================================ catálogo (V04, B05–B07)

  createService(input: {
    name: string;
    categoryCode: number;
    category: string;
    subcategory: string;
    operationType: OperationType;
    line: BusinessLine;
    referenceName: string;
    referenceLength: number;
    allowsPartial: boolean;
    minPartial: number | null;
    allowsLate: boolean;
    range: { min: number; max: number } | null;
  }): Result<string> {
    const denied = this.denied(['Super Usuario'], 'Solo el Super Usuario parametriza convenios');
    if (denied) {
      return fail(denied);
    }
    if (!input.name.trim() || !input.referenceName.trim()) {
      return fail('El nombre del servicio y el de la referencia son obligatorios');
    }
    if (!(input.referenceLength > 0)) {
      return fail('La longitud de la referencia debe ser mayor que cero');
    }
    const id = `SRV-${pad(this.state.counters.SRV++, 2)}`;
    this.state.services.push({
      id,
      name: input.name.trim(),
      categoryCode: input.categoryCode,
      category: input.category,
      subcategoryCode: null,
      subcategory: input.subcategory.trim(),
      operationType: input.operationType,
      line: input.line,
      references: [
        { name: input.referenceName.trim(), minLength: input.referenceLength, maxLength: input.referenceLength },
      ],
      requiresOtp: input.operationType === 'retiro',
      allowsPartial: input.allowsPartial,
      minPartial: input.allowsPartial ? input.minPartial : null,
      allowsLate: input.allowsLate,
      range: input.operationType === 'recaudo' ? null : input.range,
      suggestedValues: [],
      active: true,
      documentedOnly: false,
      p2: false,
    });
    return ok(id, `Servicio ${id} creado`);
  }

  setServiceActive(id: string, active: boolean): Result<string> {
    const denied = this.denied(['Super Usuario'], 'Solo el Super Usuario parametriza convenios');
    if (denied) {
      return fail(denied);
    }
    const svc = this.service(id);
    if (!svc || svc.documentedOnly) {
      return fail('Servicio no editable');
    }
    svc.active = active;
    return ok(id, `${id} ${active ? 'activado' : 'inactivado'}`);
  }

  /** `enabled = null` elimina la regla (el PDV vuelve a heredar de la cadena). */
  setEnablement(serviceId: string, level: 'cadena' | 'pdv', targetId: string, enabled: boolean | null): Result<string> {
    const denied = this.denied(['Super Usuario'], 'Solo el Super Usuario parametriza convenios');
    if (denied) {
      return fail(denied);
    }
    const idx = this.state.enablements.findIndex(
      (e) => e.serviceId === serviceId && e.level === level && e.targetId === targetId
    );
    if (enabled === null) {
      if (idx >= 0) {
        this.state.enablements.splice(idx, 1);
      }
      return ok(serviceId, `${serviceId} hereda la regla de la cadena en ${targetId}`);
    }
    if (idx >= 0) {
      this.state.enablements[idx].enabled = enabled;
    } else {
      this.state.enablements.push({ serviceId, level, targetId, enabled });
    }
    return ok(serviceId, `${serviceId} ${enabled ? 'habilitado' : 'deshabilitado'} para ${targetId}`);
  }

  setCommission(serviceId: string, chainId: string | null, chainValue: number, it2exValue: number): Result<string> {
    const denied = this.denied(['Super Usuario'], 'Solo el Super Usuario parametriza convenios');
    if (denied) {
      return fail(denied);
    }
    if (!(chainValue >= 0) || !(it2exValue >= 0)) {
      return fail('Las comisiones deben ser valores mayores o iguales a cero');
    }
    const existing = this.state.commissions.find((c) => c.serviceId === serviceId && c.chainId === chainId);
    if (existing) {
      existing.chainValue = chainValue;
      existing.it2exValue = it2exValue;
      return ok(existing.id, `Comisión ${existing.id} actualizada: aplica a operaciones futuras`);
    }
    const id = `COM-${this.esc}${this.state.counters.COM++}`;
    this.state.commissions.push({ id, serviceId, chainId, chainValue, it2exValue });
    return ok(id, `Comisión ${id} creada: aplica a operaciones futuras`);
  }

  // ================================================================ cupos (V08, B08)

  setQuota(pdvId: string, line: BusinessLine, assigned: number): Result<string> {
    const denied = this.denied(['Operador'], 'Solo el Operador ajusta los parámetros de venta');
    if (denied) {
      return fail(denied);
    }
    if (!(assigned >= 0)) {
      return fail('El cupo asignado debe ser un valor mayor o igual a cero');
    }
    const q = this.state.quotas.find((x) => x.pdvId === pdvId && x.line === line);
    if (q) {
      q.assigned = assigned;
    } else {
      this.state.quotas.push({ pdvId, line, assigned, initialConsumption: 0 });
    }
    return ok(pdvId, `Cupo de ${line} de ${pdvId}: ${formatMoney(assigned)}`);
  }

  // ================================================================ caja (V05)

  /** Consulta de la obligación (F05, R-20, FM-21). Crea la obligación generada si no existe. */
  consultObligation(serviceId: string, refs: string[]): Result<Obligation> {
    const svc = this.service(serviceId);
    if (!svc || svc.operationType !== 'recaudo') {
      return fail('Seleccione un convenio de recaudo');
    }
    const refError = referenceError(svc, refs);
    if (refError) {
      return fail(refError);
    }
    const cleaned = refs.map((r) => r.trim());
    if (triggerKey(cleaned) === '999') {
      return fail(MESSAGES.noObligation);
    }
    const key = obligationKey(serviceId, cleaned);
    let obl = this.obligation(key);
    if (!obl) {
      const digits = cleaned.join('');
      const last4 = Number(digits.slice(-4));
      const value = 20_000 + (last4 % 100) * 1_000;
      obl = {
        key,
        serviceId,
        references: cleaned,
        holder: holderFor(cleaned),
        value,
        dueDate: localDate(addDays(this.clock.now(), 10)),
        balance: value,
        status: 'Pendiente',
        verifyingTxId: null,
      };
      this.state.obligations.push(obl);
    }
    if (obl.status === 'En verificación') {
      return fail(
        `Obligación en verificación por la transacción ${obl.verifyingTxId}: resuelva su estado antes de un nuevo pago`
      );
    }
    if (obl.status === 'Pagada' || obl.balance <= 0) {
      return fail('Obligación pagada: sin saldo pendiente (simulado)');
    }
    if (obl.dueDate < this.today() && !svc.allowsLate) {
      return fail(MESSAGES.overdue);
    }
    return ok(obl);
  }

  /** F12: valida, bloquea por cupo o crea la transacción y aplica el desenlace (§3, R-01..R-09). */
  authorize(input: AuthorizeInput): Result<Transaction> {
    const denied = this.denied(['Colocador'], 'Solo el Colocador opera la caja (RN-ACC-01)');
    if (denied) {
      return fail(denied);
    }
    const session = this.state.session;
    const register = this.state.registers.find((r) => r.id === session.registerId);
    if (!register || !session.userId) {
      return fail('Seleccione una caja e ingrese con un perfil en Inicio');
    }
    const shift = this.state.shifts.find((s) => s.id === register.currentShiftId && s.status === 'abierto');
    if (!shift) {
      return fail(MESSAGES.registerClosed);
    }
    const pdvId = register.pdvId;
    const svc = this.service(input.serviceId);
    if (!svc || !svc.operationType || !svc.line) {
      return fail('Seleccione un servicio');
    }
    if (!catalogForRegister(this.state, register.id).some((c) => c.service.id === svc.id)) {
      return fail('Servicio no habilitado para esta caja');
    }
    const refs = input.references.map((r) => (r ?? '').trim());
    const refError = referenceError(svc, refs);
    if (refError) {
      return fail(refError);
    }
    const value = Math.round(input.value);
    let obligation: Obligation | undefined;
    let partial = false;
    if (svc.operationType === 'recaudo') {
      const consult = this.consultObligation(svc.id, refs);
      if (!consult.ok) {
        return fail(consult.error);
      }
      obligation = consult.value;
      if (value !== obligation.balance) {
        if (!svc.allowsPartial) {
          return fail('El convenio no admite pago parcial: el valor debe ser el saldo de la obligación');
        }
        const min = Math.min(svc.minPartial ?? 0, obligation.balance);
        if (value < min) {
          return fail(`El abono mínimo es ${formatMoney(svc.minPartial ?? 0)}`);
        }
        if (value > obligation.balance) {
          return fail(`El abono no puede superar el saldo de ${formatMoney(obligation.balance)}`);
        }
        partial = true;
      }
    } else {
      const outOfRange = rangeError(svc, value);
      if (outOfRange) {
        return fail(outOfRange);
      }
    }
    if (!(value > 0)) {
      return fail('Ingrese un valor mayor que cero');
    }
    if (svc.requiresOtp && !/^\d{6}$/.test(input.otp ?? '')) {
      return fail('Ingrese un OTP de 6 dígitos');
    }
    const method: PaymentMethod = svc.operationType === 'retiro' ? 'efectivo' : input.method;
    let cashReceived: number | null = null;
    let change: number | null = null;
    if (method === 'efectivo' && svc.operationType !== 'retiro') {
      cashReceived = Math.round(input.cashReceived ?? 0);
      if (cashReceived < value) {
        return fail(MESSAGES.cashInsufficient);
      }
      change = cashReceived - value;
    }
    // R-09: bloqueo por cupo antes de enviar al autorizador.
    if (svc.operationType === 'retiro') {
      if (expectedCash(this.state, shift.id) < value) {
        return fail('Efectivo insuficiente en caja para el retiro (simulado)');
      }
    } else {
      const quota = quotaStatus(this.state, pdvId, svc.line);
      if (!quota.defined || value > quota.available) {
        const message = !quota.defined
          ? `PDV sin cupo asignado para ${svc.line}`
          : `Cupo insuficiente: disponible ${formatMoney(quota.available)} en ${svc.line} de ${pdvId}`;
        this.state.alerts.push({
          id: `ALR-${this.esc}-${pad(this.state.counters.ALR++, 3)}`,
          pdvId,
          line: svc.line,
          serviceId: svc.id,
          attemptedValue: value,
          available: quota.defined ? quota.available : null,
          at: this.nowIso(),
          registerId: register.id,
          message,
        });
        return fail(message);
      }
    }

    // T1: — → PENDING con su clave idempotente.
    const { id } = this.nextTxId();
    const chainId = chainOfPdv(this.state, pdvId) as string;
    const branchId = this.state.pdvs.find((p) => p.id === pdvId)?.branchId as string;
    const tx: Transaction = {
      id,
      idempotencyKey: `IDEM-${id}`,
      at: this.nowIso(),
      scenario: this.state.id,
      chainId,
      branchId,
      pdvId,
      registerId: register.id,
      shiftId: shift.id,
      operatorId: session.userId,
      type: svc.operationType,
      line: svc.line,
      serviceId: svc.id,
      references: refs,
      referenceDisplay:
        svc.operationType === 'deposito'
          ? `${refs[0]} ${maskAccount(refs[1])}`
          : svc.operationType === 'retiro'
            ? maskAccount(refs[0])
            : refs.join(' / '),
      value,
      method,
      cashReceived,
      change,
      status: 'PENDING',
      authorization: null,
      responseCode: null,
      responseMessage: MESSAGES.sending,
      originalId: null,
      reverseKind: null,
      reverseReason: null,
      reverseIds: [],
      voidInfo: null,
      chainCommission: null,
      it2exCommission: null,
      consultations: 0,
      trace: [{ from: null, to: 'PENDING', event: 'F12 Autorizar', at: this.nowIso(), user: session.userId, note: null }],
      appliedOutcome: '',
      pendingInProcess: 0,
      lastConsultResult: null,
      retryAvailable: false,
      obligationKey: obligation?.key ?? null,
      partial,
    };
    this.state.transactions.push(tx);
    this.state.lastResultTxId = id;

    // Desenlace: panel de un solo uso > OTP > gatillo.
    let outcome: Outcome;
    const override = this.state.presenter.nextAuthorization;
    if (override !== 'gatillo') {
      outcome = OVERRIDE_OUTCOME[override];
      tx.appliedOutcome = `Panel del presentador: ${override}`;
      this.state.presenter.nextAuthorization = 'gatillo';
    } else if (svc.requiresOtp && input.otp === '000000') {
      outcome = 'reject-otp';
      tx.appliedOutcome = 'OTP 000000';
    } else {
      const key = triggerKey(refs);
      outcome = TRIGGER_OUTCOME[key] ?? 'approve';
      tx.appliedOutcome = TRIGGER_OUTCOME[key] ? `Gatillo ${key}` : 'Según gatillo (sin terminación reservada)';
    }
    this.applyOutcome(tx, outcome);
    return ok(tx);
  }

  private applyOutcome(tx: Transaction, outcome: Outcome): void {
    switch (outcome) {
      case 'approve':
        this.approve(tx, 'Respuesta aprobada', 'autorizar');
        return;
      case 'reject':
      case 'reject-otp': {
        const otp = outcome === 'reject-otp';
        this.reject(tx, 'Respuesta rechazada', otp ? 'R-OTP' : 'R-13', otp ? MESSAGES.otpInvalid : MESSAGES.rejected);
        this.upsertReval(tx, 'rechazada');
        this.attempt(tx, 'autorizar', 'rechazada', tx.responseCode as string, tx.responseMessage as string);
        return;
      }
      default: {
        this.moveTo(tx, 'PENDING_VERIFICATION', 'Timeout sin respuesta');
        tx.responseCode = 'TO';
        tx.responseMessage = MESSAGES.timeout;
        const obl = this.obligation(tx.obligationKey);
        if (obl) {
          obl.status = 'En verificación';
          obl.verifyingTxId = tx.id;
        }
        if (outcome === 'timeout-approve') {
          this.upsertReval(tx, 'aprobada');
        } else if (outcome === 'timeout-reject') {
          this.upsertReval(tx, 'rechazada');
        } else if (outcome === 'timeout-inprocess') {
          this.upsertReval(tx, 'aprobada');
          tx.pendingInProcess = 1;
        }
        this.attempt(tx, 'autorizar', 'timeout', 'TO', MESSAGES.timeout);
      }
    }
  }

  /** Aprobación y su propagación (R-02, tabla §4.1). */
  private approve(tx: Transaction, event: string, request: AuthAttempt['requestType']): void {
    this.moveTo(tx, 'APPROVED', event);
    tx.authorization = this.authCodeFor(tx.id);
    tx.responseCode = '00';
    tx.responseMessage = MESSAGES.approved;
    tx.retryAvailable = false;
    tx.lastConsultResult = null;
    if (tx.serviceId) {
      const c = commissionFor(this.state, tx.serviceId, tx.chainId);
      tx.chainCommission = c.chainValue;
      tx.it2exCommission = c.it2exValue;
    } else {
      tx.chainCommission = DEFAULT_COMMISSION.chainValue;
      tx.it2exCommission = DEFAULT_COMMISSION.it2exValue;
    }
    const obl = this.obligation(tx.obligationKey);
    if (obl) {
      obl.balance = Math.max(0, obl.balance - tx.value);
      obl.status = obl.balance === 0 ? 'Pagada' : 'Pendiente';
      obl.verifyingTxId = null;
    }
    this.upsertReval(tx, 'aprobada');
    this.attempt(tx, request, 'aprobada', '00', MESSAGES.approved);
  }

  /** Rechazo (R-03): la obligación sigue o vuelve a Pendiente. */
  private reject(tx: Transaction, event: string, code: string, message: string): void {
    this.moveTo(tx, 'REJECTED', event);
    tx.responseCode = code;
    tx.responseMessage = message;
    tx.retryAvailable = false;
    const obl = this.obligation(tx.obligationKey);
    if (obl && obl.verifyingTxId === tx.id) {
      obl.status = 'Pendiente';
      obl.verifyingTxId = null;
    }
  }

  /** «Consultar estado» (R-04, R-05; T5–T8). Para un reverso, consulta el reverso. */
  consultStatus(txId: string): Result<ConsultResult> {
    const tx = this.tx(txId);
    if (!tx) {
      return fail('Transacción no encontrada');
    }
    if (tx.status !== 'PENDING_VERIFICATION') {
      return fail('Solo se consulta una transacción en verificación');
    }
    tx.consultations += 1;
    if (tx.type === 'reverso') {
      return this.consultReverse(tx);
    }
    if (tx.pendingInProcess > 0) {
      tx.pendingInProcess -= 1;
      tx.lastConsultResult = 'EP';
      tx.responseCode = 'EP';
      tx.responseMessage = MESSAGES.inProcess;
      this.attempt(tx, 'consultar estado', 'en proceso', 'EP', MESSAGES.inProcess);
      return ok({ code: 'EP', message: MESSAGES.inProcess, status: tx.status });
    }
    const rec = this.revalOf(tx.id);
    if (!rec) {
      const idem = this.state.presenter.idempotency;
      tx.lastConsultResult = 'SR';
      tx.retryAvailable = idem;
      tx.responseCode = 'SR';
      tx.responseMessage = idem ? MESSAGES.noRecord : `${MESSAGES.noRecord}. ${MESSAGES.noIdempotency}`;
      this.attempt(tx, 'consultar estado', 'sin registro', 'SR', tx.responseMessage);
      return ok({ code: 'SR', message: tx.responseMessage, status: tx.status });
    }
    if (rec.status === 'aprobada') {
      this.approve(tx, 'Consulta de estado: aprobada', 'consultar estado');
      return ok({ code: '00', message: MESSAGES.approved, status: tx.status });
    }
    if (rec.status === 'rechazada') {
      this.reject(tx, 'Consulta de estado: rechazada definitiva', 'R-13', MESSAGES.definitiveRejection);
      this.attempt(tx, 'consultar estado', 'rechazada', 'R-13', MESSAGES.definitiveRejection);
      return ok({ code: 'R-13', message: MESSAGES.definitiveRejection, status: tx.status });
    }
    tx.lastConsultResult = 'EP';
    this.attempt(tx, 'consultar estado', 'en proceso', 'EP', MESSAGES.inProcess);
    return ok({ code: 'EP', message: MESSAGES.inProcess, status: tx.status });
  }

  /** T8: reintento con la MISMA clave, solo tras «Sin registro» y con idempotencia = Sí. */
  retrySameKey(txId: string): Result<ConsultResult> {
    const tx = this.tx(txId);
    if (!tx) {
      return fail('Transacción no encontrada');
    }
    if (tx.status !== 'PENDING_VERIFICATION' || tx.lastConsultResult !== 'SR') {
      return fail('Solo se reintenta tras consultar el estado y obtener «Sin registro»');
    }
    if (!this.state.presenter.idempotency) {
      return fail(MESSAGES.noIdempotency);
    }
    const existing = this.state.reval.find((r) => r.idempotencyKey === tx.idempotencyKey);
    this.moveTo(tx, 'PENDING', `Reintento con la misma clave ${tx.idempotencyKey}`);
    if (existing && existing.status === 'rechazada') {
      this.reject(tx, 'Respuesta rechazada', 'R-13', MESSAGES.rejected);
      this.attempt(tx, 'reintentar', 'rechazada', 'R-13', MESSAGES.rejected);
      return ok({ code: 'R-13', message: MESSAGES.rejected, status: tx.status });
    }
    this.approve(tx, 'Respuesta aprobada (reintento)', 'reintentar');
    return ok({ code: '00', message: MESSAGES.approved, status: tx.status });
  }

  /** Anulación (R-06, FM-07). */
  voidTransaction(txId: string, reason: string, pdvUserId: string | null): Result<Transaction> {
    const denied = this.denied(['Colocador'], 'Solo el Colocador anula una transacción de su turno');
    if (denied) {
      return fail(denied);
    }
    const tx = this.tx(txId);
    if (!tx) {
      return fail('Transacción no encontrada');
    }
    if (tx.type === 'recarga') {
      return fail(MESSAGES.rechargeNoVoid);
    }
    if (tx.type === 'retiro') {
      return fail(MESSAGES.withdrawalNoVoid);
    }
    if (tx.type === 'reverso') {
      return fail(MESSAGES.reverseNoVoid);
    }
    if (tx.status !== 'APPROVED') {
      return fail('Solo se anula una transacción aprobada');
    }
    if (liveReverse(this.state, tx)) {
      return fail('La transacción tiene un reverso vivo: no se anula');
    }
    const shift = this.state.shifts.find((s) => s.id === tx.shiftId);
    if (!shift || shift.status !== 'abierto') {
      return fail('El turno de la transacción ya está cerrado: no se anula');
    }
    if (!reason.trim()) {
      return fail('El motivo es obligatorio');
    }
    let authorizedBy = this.sessionUser();
    if (tx.type === 'deposito') {
      // D-ACT-04: confirma el usuario Punto de Venta del PDV de la transacción.
      const pdvUser = this.state.users.find(
        (u) => u.id === pdvUserId && u.profile === 'Punto de Venta' && u.pdvId === tx.pdvId
      );
      if (!pdvUser) {
        return fail('La anulación de un depósito exige la confirmación del usuario Punto de Venta del PDV');
      }
      authorizedBy = pdvUser.id;
    }
    this.moveTo(tx, 'VOIDED', 'Anulación', reason.trim());
    tx.voidInfo = { at: this.nowIso(), reason: reason.trim(), authorizedBy };
    tx.responseCode = 'AN';
    tx.responseMessage = MESSAGES.voided;
    const obl = this.obligation(tx.obligationKey);
    if (obl) {
      obl.balance = Math.min(obl.value, obl.balance + tx.value);
      obl.status = 'Pendiente';
    }
    this.upsertReval(tx, 'anulada');
    this.attempt(tx, 'anular', 'aprobada', 'AN', MESSAGES.voided);
    return ok(tx, `${tx.id} anulada`);
  }

  /** Reverso funcional (V06/V07) o técnico (V10) como transacción compensatoria vinculada (R-07). */
  reverse(txId: string, kind: ReverseKind, reason: string): Result<Transaction> {
    const original = this.tx(txId);
    if (!original) {
      return fail('Transacción no encontrada');
    }
    if (original.type === 'reverso') {
      return fail(MESSAGES.reverseNoVoid);
    }
    // RN-ACC-05: solo el Operador reversa; el técnico lo ejecuta la aprobación de la conciliación.
    const denied = kind === 'funcional' ? this.denied(['Operador'], 'Solo el Operador reversa una transacción') : null;
    if (denied) {
      return fail(denied);
    }
    if (kind === 'funcional' && original.type === 'retiro') {
      return fail('Los retiros no se reversan en esta simulación (ilustrativo)');
    }
    if (original.status !== 'APPROVED') {
      return fail('Solo se reversa una transacción aprobada');
    }
    if (liveReverse(this.state, original)) {
      return fail('Ya existe un reverso vivo para esta transacción');
    }
    const shift = this.state.shifts.find((s) => s.id === original.shiftId);
    if (!shift || shift.status !== 'abierto') {
      return fail('El turno de la transacción original ya está cerrado: no se reversa');
    }
    if (!reason.trim()) {
      return fail('El motivo es obligatorio');
    }
    const { id } = this.nextTxId();
    const operator = this.state.auth.userId ?? this.state.session.userId ?? original.operatorId;
    const rev: Transaction = {
      ...original,
      id,
      idempotencyKey: `IDEM-${id}`,
      at: this.nowIso(),
      operatorId: operator,
      type: 'reverso',
      status: 'PENDING',
      cashReceived: null,
      change: null,
      authorization: null,
      responseCode: null,
      responseMessage: MESSAGES.sending,
      originalId: original.id,
      reverseKind: kind,
      reverseReason: reason.trim(),
      reverseIds: [],
      voidInfo: null,
      chainCommission: null,
      it2exCommission: null,
      consultations: 0,
      trace: [{ from: null, to: 'PENDING', event: `Reversar (${kind})`, at: this.nowIso(), user: operator, note: `de ${original.id}` }],
      appliedOutcome: '',
      pendingInProcess: 0,
      lastConsultResult: null,
      retryAvailable: false,
      obligationKey: null,
      partial: false,
    };
    this.state.transactions.push(rev);
    original.reverseIds.push(id);
    this.state.lastResultTxId = id;
    const outcome = this.state.presenter.nextReverse;
    rev.appliedOutcome = `Panel «Próximo reverso»: ${outcome}`;
    this.state.presenter.nextReverse = 'aprobado';
    if (outcome === 'aprobado') {
      this.approveReverse(rev, original, 'Reverso aprobado');
    } else if (outcome === 'rechazado') {
      this.rejectReverse(rev, 'Reverso rechazado');
    } else {
      this.moveTo(rev, 'PENDING_VERIFICATION', 'Timeout del reverso');
      rev.responseCode = 'TO';
      rev.responseMessage = MESSAGES.timeout;
      const revRec = this.upsertReval(rev, outcome === 'timeout-aprobado' ? 'aprobada' : 'rechazada');
      if (revRec.status === 'aprobada') {
        const origRec = this.revalOf(original.id);
        if (origRec) {
          origRec.status = 'reversada';
        }
      }
      this.attempt(rev, 'reversar', 'timeout', 'TO', MESSAGES.timeout);
    }
    return ok(rev);
  }

  private approveReverse(rev: Transaction, original: Transaction, event: string): void {
    this.moveTo(rev, 'APPROVED', event);
    rev.authorization = this.authCodeFor(rev.id);
    rev.responseCode = 'RV';
    rev.responseMessage = MESSAGES.reverseApproved;
    this.moveTo(original, 'REVERSED', 'Reverso aprobado', `por ${rev.id}`);
    original.responseCode = 'RV';
    original.responseMessage = 'Reversada (simulado)';
    const obl = this.obligation(original.obligationKey);
    if (obl) {
      obl.balance = Math.min(obl.value, obl.balance + original.value);
      obl.status = 'Pendiente';
    }
    this.upsertReval(rev, 'aprobada');
    const origRec = this.revalOf(original.id);
    if (origRec) {
      origRec.status = 'reversada';
      if (rev.reverseKind === 'tecnico' && origRec.inconsistency) {
        origRec.inconsistency = null;
        this.setResolution(original.id, 'Inconsistencia reportada por Reval (simulado)', 'resuelta por reverso técnico', null);
      }
    }
    this.attempt(rev, 'reversar', 'aprobada', 'RV', MESSAGES.reverseApproved);
  }

  private rejectReverse(rev: Transaction, event: string): void {
    this.moveTo(rev, 'REJECTED', event);
    rev.responseCode = 'R-13';
    rev.responseMessage = MESSAGES.reverseRejected;
    this.upsertReval(rev, 'rechazada');
    this.attempt(rev, 'reversar', 'rechazada', 'R-13', MESSAGES.reverseRejected);
  }

  private consultReverse(rev: Transaction): Result<ConsultResult> {
    const original = this.tx(rev.originalId as string) as Transaction;
    const rec = this.revalOf(rev.id);
    if (rec?.status === 'aprobada') {
      this.approveReverse(rev, original, 'Consulta del reverso: aprobado');
      return ok({ code: 'RV', message: MESSAGES.reverseApproved, status: rev.status });
    }
    this.rejectReverse(rev, 'Consulta del reverso: rechazado');
    return ok({ code: 'R-13', message: MESSAGES.reverseRejected, status: rev.status });
  }

  // ================================================================ cierre (V09, R-10)

  closeShift(registerId: string, declaredCash: number, observation: string): Result<CashClosing> {
    const denied = this.denied(['Colocador'], 'Solo el Colocador cierra su turno');
    if (denied) {
      return fail(denied);
    }
    const register = this.state.registers.find((r) => r.id === registerId);
    const shift = this.state.shifts.find((s) => s.id === register?.currentShiftId && s.status === 'abierto');
    if (!register || !shift) {
      return fail('La caja no tiene un turno abierto');
    }
    const pending = pendingVerificationInShift(this.state, shift.id);
    if (pending.length) {
      return fail(closingBlockMessage(pending.map((t) => t.id)));
    }
    if (!(declaredCash >= 0)) {
      return fail('Declare el efectivo contado (valor mayor o igual a cero)');
    }
    const expected = expectedByMethod(this.state, shift.id);
    const difference = Math.round(declaredCash) - expected.efectivo;
    const closing: CashClosing = {
      id: `CIE-${this.esc}-${pad(this.state.counters.CIE++, 3)}`,
      shiftId: shift.id,
      registerId,
      cashierId: this.state.session.userId ?? shift.cashierId,
      at: this.nowIso(),
      expectedByMethod: expected,
      declaredCash: Math.round(declaredCash),
      difference,
      classification: difference === 0 ? 'Cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante',
      observation: observation.trim(),
      historical: false,
    };
    this.state.closings.push(closing);
    shift.status = 'cerrado';
    shift.closingId = closing.id;
    register.currentShiftId = null;
    if (this.state.session.shiftId === shift.id) {
      this.state.session.shiftId = null;
    }
    return ok(closing, `Cierre ${closing.id}: ${closing.classification}`);
  }

  // ================================================================ conciliación (V10, R-11)

  runConciliation(): Result<string> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas ejecuta la conciliación');
    if (denied) {
      return fail(denied);
    }
    this.state.lastConciliationAt = this.nowIso();
    const c = conciliation(this.state);
    return ok(
      this.state.lastConciliationAt,
      `${c.compared} comparados · ${c.conciliated} conciliados · ${c.exceptions.length} excepción(es)`
    );
  }

  private setResolution(
    txId: string,
    type: ExceptionTypeArg,
    resolution: 'resuelta por consulta' | 'resuelta con ajuste' | 'resuelta por reverso técnico',
    note: string | null
  ): void {
    this.state.resolutions = this.state.resolutions.filter((r) => r.txId !== txId);
    this.state.resolutions.push({ txId, type, resolution, note, at: this.nowIso(), user: this.sessionUser() });
  }

  private exceptionRow(txId: string) {
    return conciliation(this.state).rows.find((r) => r.id === txId && r.classification !== 'Conciliada');
  }

  /** C05 «Consultar estado» sobre una diferencia de estado o «Solo en IT2Pay» en verificación. */
  resolveByConsult(txId: string): Result<ConsultResult> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas gestiona las discrepancias');
    if (denied) {
      return fail(denied);
    }
    const row = this.exceptionRow(txId);
    if (!row || !row.tx) {
      return fail('No hay una excepción abierta para esa transacción');
    }
    const target =
      row.tx.status === 'PENDING_VERIFICATION'
        ? row.tx
        : (liveReverse(this.state, row.tx) ?? row.tx);
    if (target.status !== 'PENDING_VERIFICATION') {
      return fail('La transacción no está en verificación: use «Registrar ajuste»');
    }
    const result = this.consultStatus(target.id);
    if (result.ok && result.value.status !== 'PENDING_VERIFICATION') {
      this.setResolution(txId, row.classification as ExceptionTypeArg, 'resuelta por consulta', null);
    }
    return result;
  }

  /** C05 «Reverso técnico» sobre una «Inconsistencia reportada por Reval (simulado)». */
  resolveByTechnicalReverse(txId: string): Result<Transaction> {
    const denied = this.denied(['Aprobador financiero'], 'El reverso técnico lo aprueba el Aprobador financiero');
    if (denied) {
      return fail(denied);
    }
    const row = this.exceptionRow(txId);
    if (!row || row.classification !== 'Inconsistencia reportada por Reval (simulado)') {
      return fail('El reverso técnico aplica solo a una inconsistencia reportada por Reval (simulado)');
    }
    return this.reverse(txId, 'tecnico', `Inconsistencia reportada por Reval (simulado): ${row.reval?.inconsistency}`);
  }

  /** C05 «Registrar ajuste» (nota obligatoria): no modifica la transacción. */
  registerAdjustment(txId: string, note: string): Result<string> {
    const denied = this.denied(['Aprobador financiero'], 'El ajuste lo aprueba el Aprobador financiero');
    if (denied) {
      return fail(denied);
    }
    const row = this.exceptionRow(txId);
    if (!row) {
      return fail('No hay una excepción abierta para esa transacción');
    }
    if (!note.trim()) {
      return fail('La nota es obligatoria en los ajustes');
    }
    this.setResolution(txId, row.classification as ExceptionTypeArg, 'resuelta con ajuste', note.trim());
    return ok(txId, `${txId}: resuelta con ajuste (ilustrativo)`);
  }

  /** UC-17: Finanzas propone resolver una excepción con reverso técnico o ajuste; queda pendiente de aprobación. */
  propose(txId: string, kind: ConciliationProposal['kind'], note: string | null = null): Result<ConciliationProposal> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas propone ajustes de conciliación');
    if (denied) {
      return fail(denied);
    }
    const row = this.exceptionRow(txId);
    if (!row) {
      return fail('No hay una excepción abierta para esa transacción');
    }
    if (kind === 'reverso técnico' && row.classification !== 'Inconsistencia reportada por Reval (simulado)') {
      return fail('El reverso técnico aplica solo a una inconsistencia reportada por Reval (simulado)');
    }
    if (kind === 'ajuste' && !note?.trim()) {
      return fail('La nota es obligatoria en los ajustes');
    }
    if (this.state.proposals.some((p) => p.txId === txId && p.status === 'Pendiente de aprobación')) {
      return fail(`${txId} ya tiene una propuesta pendiente de aprobación`);
    }
    const proposal: ConciliationProposal = {
      id: `PRO-${this.esc}-${pad(this.state.counters.PRO++, 3)}`,
      txId,
      kind,
      note: note?.trim() || null,
      at: this.nowIso(),
      status: 'Pendiente de aprobación',
      review: this.newReview(),
    };
    this.state.proposals.push(proposal);
    return ok(proposal, `${proposal.id}: ${kind} de ${txId} pendiente de aprobación`);
  }

  /**
   * UC-18, UC-20 y UC-22: el Aprobador financiero aprueba o rechaza lo que generó Finanzas.
   * Nadie aprueba lo que generó (RN-ACC-06).
   */
  review(kind: 'propuesta' | 'liquidacion' | 'cuenta', id: string, approve: boolean): Result<string> {
    const item =
      kind === 'propuesta'
        ? this.state.proposals.find((p) => p.id === id)
        : kind === 'liquidacion'
          ? this.state.liquidations.find((l) => l.id === id)
          : this.state.collectionAccounts.find((c) => c.id === id);
    if (!item || item.status !== 'Pendiente de aprobación') {
      return fail('Solo se revisa lo que está pendiente de aprobación');
    }
    const actor = this.actor();
    if (!actor || actor.profile !== 'Aprobador financiero') {
      return fail('Solo el Aprobador financiero aprueba (RN-ACC-06)');
    }
    if (item.review.createdBy === actor.id) {
      return fail('Nadie aprueba lo que generó (RN-ACC-06)');
    }
    if (approve && kind === 'propuesta') {
      const p = item as ConciliationProposal;
      const done: Result<unknown> =
        p.kind === 'reverso técnico' ? this.resolveByTechnicalReverse(p.txId) : this.registerAdjustment(p.txId, p.note ?? '');
      if (!done.ok) {
        return fail(done.error);
      }
    }
    item.status = approve ? 'Aprobada' : 'Rechazada';
    item.review = { ...item.review, reviewedBy: actor.id, reviewedAt: this.nowIso() };
    return ok(id, `${id} ${approve ? 'aprobada' : 'rechazada'} por ${actor.name}`);
  }

  private newReview(): Review {
    return { createdBy: this.sessionUser(), reviewedBy: null, reviewedAt: null };
  }

  // ================================================================ consignaciones (V11, R-12)

  reportConsignment(pdvId: string, line: BusinessLine, value: number): Result<Consignment> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas registra consignaciones');
    if (denied) {
      return fail(denied);
    }
    const q = quotaStatus(this.state, pdvId, line);
    if (!q.defined) {
      return fail(`PDV sin cupo asignado para ${line}`);
    }
    if (!(value > 0)) {
      return fail('Ingrese un valor mayor que cero');
    }
    if (value > q.used) {
      return fail(
        `La consignación no puede superar el utilizado de ${line} de ${pdvId} (${formatMoney(q.used)})`
      );
    }
    const n = this.state.counters.CON++;
    const c: Consignment = {
      id: `CON-${this.esc}-${pad(n, 3)}`,
      pdvId,
      line,
      value: Math.round(value),
      bank: 'Banco Demo Dos',
      support: `CNS-${pad(n, 4)}`,
      status: 'Reportada',
      reportedAt: this.nowIso(),
      validatedAt: null,
    };
    this.state.consignments.push(c);
    return ok(c, `Consignación ${c.id} reportada`);
  }

  validateConsignment(id: string): Result<Consignment> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas valida consignaciones');
    if (denied) {
      return fail(denied);
    }
    const c = this.state.consignments.find((x) => x.id === id);
    if (!c || c.status !== 'Reportada') {
      return fail('Solo se valida una consignación reportada');
    }
    c.status = 'Validada';
    c.validatedAt = this.nowIso();
    return ok(c, `${c.id} validada por el banco simulado: libera cupo`);
  }

  rejectConsignment(id: string): Result<Consignment> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas rechaza consignaciones');
    if (denied) {
      return fail(denied);
    }
    const c = this.state.consignments.find((x) => x.id === id);
    if (!c || c.status !== 'Reportada') {
      return fail('Solo se rechaza una consignación reportada');
    }
    c.status = 'Rechazada';
    c.validatedAt = this.nowIso();
    return ok(c, `${c.id} rechazada: no libera cupo`);
  }

  // ================================================================ finanzas (V12, R-15, R-16)

  liquidate(): Result<Liquidation> {
    const denied = this.denied(['Finanzas'], 'Solo Finanzas liquida comisiones');
    if (denied) {
      return fail(denied);
    }
    const rows = liveLiquidationRows(this.state).map((r) => ({ ...r }));
    const liq: Liquidation = {
      id: `LIQ-${this.esc}-${pad(this.state.counters.LIQ++, 3)}`,
      period: this.state.demoDate,
      at: this.nowIso(),
      rows,
      totals: liquidationTotals(rows),
      status: 'Pendiente de aprobación',
      review: this.newReview(),
    };
    this.state.liquidations.push(liq);
    return ok(liq, `${liq.id} liquidada (ilustrativa): pendiente de aprobación`);
  }

  generateCollectionAccount(liquidationId: string): Result<string> {
    const liq = this.state.liquidations.find((l) => l.id === liquidationId);
    if (!liq) {
      return fail('Primero liquide el periodo demo');
    }
    const denied = this.denied(['Finanzas'], 'Solo Finanzas genera la cuenta de cobro');
    if (denied) {
      return fail(denied);
    }
    if (liq.status !== 'Aprobada') {
      return fail(`La cuenta de cobro se genera desde una liquidación aprobada (${liq.id}: ${liq.status})`);
    }
    const existing = this.state.collectionAccounts.find((c) => c.liquidationId === liq.id);
    if (existing) {
      return ok(existing.id, `${existing.id} ya existe para ${liq.id}`);
    }
    const id = `CC-DEMO-${this.esc}-${pad(this.state.counters.CC++, 4)}`;
    this.state.collectionAccounts.push({
      id,
      issuer: 'IT2EX S.A.S. (datos ficticios)',
      receiver: 'Reval (simulado)',
      period: liq.period,
      liquidationId: liq.id,
      at: this.nowIso(),
      items: [
        {
          concept: 'Servicio de integración — comisión IT2EX del periodo demo',
          quantity: liq.totals.count,
          value: liq.totals.it2ex,
        },
      ],
      total: liq.totals.it2ex,
      status: 'Pendiente de aprobación',
      review: this.newReview(),
    });
    return ok(id, `Cuenta de cobro ${id} generada: pendiente de aprobación`);
  }

  // ================================================================ presentador

  setPresenter(patch: Partial<PresenterPanel>): void {
    this.state.presenter = { ...this.state.presenter, ...patch };
  }

  setCompensationMode(mode: CompensationMode): void {
    this.state.compensationMode = mode;
  }
}

type ExceptionTypeArg =
  | 'Diferencia de valor'
  | 'Diferencia de estado'
  | 'Solo en IT2Pay'
  | 'Solo en Reval (simulado)'
  | 'Inconsistencia reportada por Reval (simulado)';

/** Prefijo del id de usuario por rol. */
export const PROFILE_PREFIX: Record<ProfileName, string> = {
  Colocador: 'COL',
  'Punto de Venta': 'PV',
  'Asesor de Ventas': 'ASE',
  Operador: 'OPE',
  Finanzas: 'FIN',
  'Aprobador financiero': 'APR',
  Administrador: 'ADM',
  'Super Usuario': 'SU',
};

/**
 * Perfiles que cada rol puede crear: el Punto de Venta crea a sus colocadores (RN-ACC-03) y
 * el Administrador a los usuarios internos (todos menos Colocador y Punto de Venta).
 */
export const creatableProfiles = (creator: ProfileName): ProfileName[] =>
  creator === 'Punto de Venta'
    ? ['Colocador']
    : creator === 'Administrador'
      ? ['Asesor de Ventas', 'Operador', 'Finanzas', 'Aprobador financiero', 'Administrador', 'Super Usuario']
      : [];

export const closingBlockMessage = (ids: string[]): string =>
  ids.length === 1
    ? `1 transacción en verificación (${ids[0]}): resuélvala antes de cerrar`
    : `${ids.length} transacciones en verificación (${ids.join(', ')}): resuélvalas antes de cerrar`;

