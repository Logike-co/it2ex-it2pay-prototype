import { Component, computed, inject, signal } from '@angular/core';
import {
  chainName,
  compensation,
  liquidationTotals,
  liveLiquidationRows,
  portfolio,
  serviceName,
} from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V12 — Gestión financiera (C09, C10, C11; R-15, R-16). */
@Component({
  selector: 'app-finanzas',
  imports: [TraceBadgeComponent, EmptyStateComponent, LegendComponent, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './finanzas.component.html',
})
export class FinanzasComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  /** RN-ACC-06: Finanzas liquida y genera la cuenta de cobro; el Aprobador financiero aprueba. */
  readonly canGenerate = computed(() => this.store.can('finanzas.generar'));
  readonly canApprove = computed(() => this.store.can('finanzas.aprobar'));

  readonly rows = computed(() => liveLiquidationRows(this.state()));
  readonly totals = computed(() => liquidationTotals(this.rows()));
  readonly liquidations = computed(() => [...this.state().liquidations].reverse());
  readonly portfolio = computed(() => portfolio(this.state()));
  readonly pending = computed(() => compensation(this.state()).pendingToDeliver);
  readonly selectedCc = signal<string | null>(null);
  readonly cc = computed(() => {
    const list = this.state().collectionAccounts;
    return list.find((c) => c.id === this.selectedCc()) ?? list[list.length - 1] ?? null;
  });

  portfolioTotal(concept: string): number {
    return this.portfolio()
      .filter((p) => p.concept === concept)
      .reduce((a, p) => a + p.value, 0);
  }

  chainLabel(id: string): string {
    return chainName(this.state(), id);
  }

  serviceLabel(id: string): string {
    return serviceName(this.state(), id);
  }

  userOf(id: string | null): string {
    return id ? (this.state().users.find((u) => u.id === id)?.name ?? id) : '—';
  }

  /** La cuenta de cobro aprobada queda «Emitida (simulado)». */
  ccStatus(status: string): string {
    return status === 'Aprobada' ? 'Emitida (simulado)' : status;
  }

  review(kind: 'liquidacion' | 'cuenta', id: string, approve: boolean): void {
    this.store.exec((sim) => sim.review(kind, id, approve));
  }

  liquidate(): void {
    this.store.exec((sim) => sim.liquidate());
  }

  generateCc(): void {
    const last = this.state().liquidations[this.state().liquidations.length - 1];
    if (!last) {
      this.store.flash.set({ kind: 'error', text: 'Primero liquide el periodo demo' });
      return;
    }
    const r = this.store.exec((sim) => sim.generateCollectionAccount(last.id));
    if (r.ok) {
      this.selectedCc.set(r.value);
    }
  }
}
