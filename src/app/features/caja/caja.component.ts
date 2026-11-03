import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { describeReferences } from '../../core/simulation/catalog';
import { rangeError, referenceError } from '../../core/simulation/engine';
import { METHOD_LABELS } from '../../core/simulation/format';
import {
  BUSINESS_LINES,
  BusinessLine,
  Obligation,
  PAYMENT_METHODS,
  PaymentMethod,
  Service,
} from '../../core/simulation/model';
import {
  branchName,
  catalogForRegister,
  CatalogEntry,
  chainName,
  expectedCash,
  quotaStatus,
  userName,
} from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';
import { CodeTextComponent } from '../../shared/code-text.component';

/**
 * V05 — Terminal de caja: asistente de 4 pasos operable por teclado
 * (F1 nueva operación · F2 buscar convenio · Enter avanzar · F12 autorizar ·
 * F8 imprimir comprobante · Esc volver). F03–F10.
 */
@Component({
  selector: 'app-caja',
  imports: [CodeTextComponent, TraceBadgeComponent, FormsModule, RouterLink, EmptyStateComponent, ...SIM_PIPES],
  templateUrl: './caja.component.html',
})
export class CajaComponent {
  readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly host = inject(ElementRef<HTMLElement>);
  /** La vista puede destruirse durante la latencia simulada (p. ej. reinicio con Ctrl+Shift+R). */
  private destroyed = false;
  private readonly onDestroy = inject(DestroyRef).onDestroy(() => (this.destroyed = true));

  readonly lines = BUSINESS_LINES;
  readonly methods = PAYMENT_METHODS;
  readonly methodLabels = METHOD_LABELS;
  readonly describeReferences = describeReferences;

  readonly step = signal<1 | 2 | 3>(1);
  readonly serviceId = signal<string | null>(null);
  readonly obligation = signal<Obligation | null>(null);
  readonly error = signal<string | null>(null);
  readonly sending = signal(false);
  readonly f12Pressed = signal(false);

  search = '';
  refs: string[] = [];
  value: number | null = null;
  otp = '';
  method: PaymentMethod = 'efectivo';
  cashReceived: number | null = null;
  cardConfirmed = false;
  baseCash = 100_000;

  readonly state = this.store.state;
  readonly session = computed(() => this.state().session);
  readonly register = computed(
    () => this.state().registers.find((r) => r.id === this.session().registerId) ?? null
  );
  readonly shiftOpen = computed(() => !!this.register()?.currentShiftId);
  readonly header = computed(() => {
    const s = this.state();
    const reg = this.register();
    if (!reg) {
      return '';
    }
    return `${chainName(s, this.session().chainId)} · ${branchName(s, this.session().branchId)} · ${reg.pdvId} · ${reg.id}`;
  });
  readonly cashierName = computed(() => userName(this.state(), this.session().userId));
  readonly expected = computed(() => {
    const shiftId = this.register()?.currentShiftId;
    return shiftId ? expectedCash(this.state(), shiftId) : 0;
  });
  readonly catalog = computed<CatalogEntry[]>(() => {
    const reg = this.register();
    return reg ? catalogForRegister(this.state(), reg.id) : [];
  });
  readonly service = computed<Service | null>(
    () => this.state().services.find((s) => s.id === this.serviceId()) ?? null
  );
  readonly lastTx = computed(() => {
    const s = this.state();
    return s.transactions.find((t) => t.id === s.lastResultTxId) ?? null;
  });

  // ---------------------------------------------------------------- catálogo

  filtered(line: BusinessLine): CatalogEntry[] {
    const q = this.search.trim().toLowerCase();
    return this.catalog().filter(
      (c) => c.service.line === line && (!q || c.service.name.toLowerCase().includes(q))
    );
  }

  countByLine(line: BusinessLine): number {
    return this.catalog().filter((c) => c.service.line === line).length;
  }

  quotaAvailable(line: BusinessLine | null): number | null {
    const reg = this.register();
    if (!reg || !line) {
      return null;
    }
    const q = quotaStatus(this.state(), reg.pdvId, line);
    return q.defined ? q.available : null;
  }

  selectService(svc: Service): void {
    this.serviceId.set(svc.id);
    this.refs = svc.references.map((r) => (r.options ? r.options[0] : ''));
    this.obligation.set(null);
    this.error.set(null);
    this.value = null;
    this.otp = '';
    setTimeout(() => this.focusFirst('[data-ref-input]'));
  }

  // ---------------------------------------------------------------- navegación del asistente

  newOperation(): void {
    this.step.set(1);
    this.serviceId.set(null);
    this.obligation.set(null);
    this.error.set(null);
    this.refs = [];
    this.value = null;
    this.otp = '';
    this.method = 'efectivo';
    this.cashReceived = null;
    this.cardConfirmed = false;
    this.f12Pressed.set(false);
    this.search = '';
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  focusSearch(): void {
    if (this.step() !== 1) {
      this.step.set(1);
    }
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  /** Enter: avanza al siguiente paso si los datos del paso actual son válidos. */
  advance(): void {
    const svc = this.service();
    if (!svc || this.sending()) {
      return;
    }
    this.error.set(null);
    if (this.step() === 1) {
      if (svc.operationType === 'recaudo') {
        const r = this.store.run((sim) => sim.consultObligation(svc.id, this.refs));
        if (!r.ok) {
          this.error.set(r.error);
          return;
        }
        this.obligation.set(r.value);
        this.value = r.value.balance;
      } else {
        // R-20 temprana: celular / cuenta con la misma regla y mensaje que F12.
        const refError = referenceError(svc, this.refs.map((x) => String(x ?? '')));
        if (refError) {
          this.error.set(refError);
          return;
        }
      }
      this.step.set(2);
      setTimeout(() => this.focusFirst('[data-step2-input]') || this.focusFirst('[data-continue]'));
      return;
    }
    if (this.step() === 2) {
      if (!this.value || this.value <= 0) {
        this.error.set('Ingrese el valor de la operación');
        return;
      }
      // R-20 temprana: rango de recargas, depósitos y retiros (mismo mensaje que F12).
      const outOfRange = svc.operationType === 'recaudo' ? null : rangeError(svc, Math.round(this.value));
      if (outOfRange) {
        this.error.set(outOfRange);
        return;
      }
      if (svc.requiresOtp && !/^\d{6}$/.test(this.otp)) {
        this.error.set('Ingrese un OTP de 6 dígitos');
        return;
      }
      if (svc.operationType === 'recaudo' && this.obligation()) {
        const obl = this.obligation() as Obligation;
        if (!svc.allowsPartial && this.value !== obl.balance) {
          this.error.set('El convenio no admite pago parcial');
          return;
        }
        if (svc.allowsPartial && this.value < Math.min(svc.minPartial ?? 0, obl.balance)) {
          this.error.set(`El abono mínimo es $ ${(svc.minPartial ?? 0).toLocaleString('es-CO')}`);
          return;
        }
      }
      this.method = 'efectivo';
      this.cashReceived = null;
      this.cardConfirmed = false;
      this.f12Pressed.set(false);
      this.step.set(3);
      setTimeout(() => this.focusFirst('[data-cash-input]'));
    }
  }

  back(): void {
    if (this.sending()) {
      return;
    }
    this.error.set(null);
    if (this.step() === 3) {
      this.step.set(2);
    } else if (this.step() === 2) {
      this.step.set(1);
    } else {
      this.newOperation();
    }
  }

  setSuggested(v: number): void {
    this.value = v;
  }

  isPartial(): boolean {
    const obl = this.obligation();
    return !!obl && !!this.value && this.value < obl.balance;
  }

  // ---------------------------------------------------------------- pago y autorización

  isWithdrawal(): boolean {
    return this.service()?.operationType === 'retiro';
  }

  change(): number | null {
    if (this.method !== 'efectivo' || this.cashReceived === null || this.value === null) {
      return null;
    }
    return this.cashReceived - this.value;
  }

  cashInsufficient(): boolean {
    if (this.isWithdrawal() || this.method !== 'efectivo') {
      return false;
    }
    return this.cashReceived === null || this.cashReceived < (this.value ?? 0);
  }

  canAuthorize(): boolean {
    if (this.step() !== 3 || this.f12Pressed() || this.sending() || !this.shiftOpen()) {
      return false;
    }
    if (this.isWithdrawal()) {
      return true;
    }
    if (this.method === 'efectivo') {
      return !this.cashInsufficient();
    }
    return this.cardConfirmed;
  }

  onMethod(m: PaymentMethod): void {
    this.method = m;
    this.cardConfirmed = false;
    this.cashReceived = null;
  }

  async authorize(): Promise<void> {
    const svc = this.service();
    if (!svc || !this.canAuthorize()) {
      return;
    }
    this.f12Pressed.set(true);
    this.error.set(null);
    const r = this.store.run((sim) =>
      sim.authorize({
        serviceId: svc.id,
        references: this.refs,
        value: Number(this.value),
        method: this.isWithdrawal() ? 'efectivo' : this.method,
        cashReceived: this.cashReceived,
        otp: this.otp,
      })
    );
    if (!r.ok) {
      // Validación o bloqueo por cupo: no se creó transacción.
      this.error.set(r.error);
      this.f12Pressed.set(false);
      return;
    }
    this.sending.set(true);
    const delay =
      r.value.status === 'PENDING_VERIFICATION'
        ? this.store.latency.timeout
        : this.store.latency.authorization;
    await this.store.wait(delay);
    this.sending.set(false);
    // Si la vista se cerró o el escenario se reinició durante la espera, no se navega.
    if (this.destroyed || !this.store.state().transactions.some((t) => t.id === r.value.id)) {
      return;
    }
    await this.router.navigate(['/caja/resultado'], { queryParams: { tx: r.value.id } });
  }

  openShift(): void {
    const reg = this.register();
    const user = this.session().userId;
    if (reg && user) {
      this.store.exec((sim) => sim.login(reg.id, user, Number(this.baseCash)));
    }
  }

  printLast(): void {
    const t = this.lastTx();
    if (t) {
      this.router.navigate(['/caja/resultado'], { queryParams: { tx: t.id, imprimir: 1 } });
    }
  }

  // ---------------------------------------------------------------- teclado

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    // Enter y Escape en los controles del modo presentador (guía, encabezado, trazabilidad)
    // son de esos controles: no deben operar la caja.
    if ((event.key === 'Enter' || event.key === 'Escape') && target?.closest('app-demo-hud, header, app-view-trace')) {
      return;
    }
    switch (event.key) {
      case 'F1':
        event.preventDefault();
        this.newOperation();
        return;
      case 'F2':
        event.preventDefault();
        this.focusSearch();
        return;
      case 'F8':
        event.preventDefault();
        this.printLast();
        return;
      case 'F12':
        event.preventDefault();
        this.authorize();
        return;
      case 'Escape':
        event.preventDefault();
        this.back();
        return;
      case 'Enter': {
        if (!target || target.tagName === 'BUTTON' || target.tagName === 'A') {
          return;
        }
        event.preventDefault();
        if (target.hasAttribute('data-search')) {
          const first = this.lines.flatMap((l) => this.filtered(l))[0];
          if (first) {
            this.selectService(first.service);
          }
          return;
        }
        if (this.step() === 3) {
          this.authorize();
          return;
        }
        this.advance();
        return;
      }
    }
  }

  private focusFirst(selector: string): boolean {
    const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
    el?.focus();
    return !!el;
  }
}
