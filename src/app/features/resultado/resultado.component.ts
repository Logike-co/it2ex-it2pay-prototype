import { afterNextRender, Component, computed, HostListener, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MESSAGES } from '../../core/simulation/engine';
import { TRACE_LABELS } from '../../core/simulation/format';
import { serviceName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SIM_PIPES } from '../../shared/pipes';
import { ReceiptComponent } from '../../shared/receipt.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TxActionsComponent } from '../../shared/tx-actions.component';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V06 — Resultado y comprobante (F11, F12, F14; FM-26). */
@Component({
  selector: 'app-resultado',
  imports: [TraceBadgeComponent, RouterLink, EmptyStateComponent, ReceiptComponent, StatusBadgeComponent, TxActionsComponent, ...SIM_PIPES],
  templateUrl: './resultado.component.html',
})
export class ResultadoComponent {
  private readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  /** Query param `?tx=` (enlazado por el router). */
  readonly tx = input<string | undefined>();
  /** Query param `?imprimir=1`: F8 desde V05 abre la impresión en un solo paso. */
  readonly imprimir = input<string | undefined>();

  readonly messages = MESSAGES;
  readonly traceLabels = TRACE_LABELS;

  readonly txId = computed(() => this.tx() ?? this.store.state().lastResultTxId);
  readonly current = computed(
    () => this.store.state().transactions.find((t) => t.id === this.txId()) ?? null
  );
  readonly service = computed(() => serviceName(this.store.state(), this.current()?.serviceId ?? null));
  readonly attempts = computed(() =>
    this.store.state().authAttempts.filter((a) => a.txId === this.txId())
  );
  readonly related = computed(() => {
    const t = this.current();
    if (!t) {
      return [];
    }
    return this.store
      .state()
      .transactions.filter((x) => x.id === t.originalId || t.reverseIds.includes(x.id));
  });
  readonly canPrint = computed(() => {
    const t = this.current();
    return !!t && ['APPROVED', 'VOIDED', 'REVERSED'].includes(t.status);
  });

  constructor() {
    afterNextRender(() => {
      if (this.imprimir() === '1') {
        this.print();
        // Se retira el parámetro para que recargar la vista no vuelva a imprimir.
        this.router.navigate([], { queryParams: { tx: this.txId() }, replaceUrl: true });
      }
    });
  }

  show(id: string): void {
    this.router.navigate(['/caja/resultado'], { queryParams: { tx: id } });
  }

  print(): void {
    if (this.canPrint()) {
      window.print();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'F8') {
      event.preventDefault();
      this.print();
    } else if (event.key === 'F1') {
      event.preventDefault();
      this.router.navigateByUrl('/caja');
    }
  }
}
