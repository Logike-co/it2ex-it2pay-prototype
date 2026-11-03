import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { closingBlockMessage } from '../../core/simulation/engine';
import { METHOD_LABELS } from '../../core/simulation/format';
import { CashClosing, PAYMENT_METHODS } from '../../core/simulation/model';
import { expectedByMethod, pendingVerificationInShift, userName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V09 — Cierre de caja (C02, C03; R-10). */
@Component({
  selector: 'app-cierre',
  imports: [TraceBadgeComponent, FormsModule, EmptyStateComponent, LegendComponent, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './cierre.component.html',
})
export class CierreComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  readonly methods = PAYMENT_METHODS;
  readonly methodLabels = METHOD_LABELS;

  readonly registerId = signal<string>(this.store.state().session.registerId ?? '');
  readonly lastClosing = signal<CashClosing | null>(null);
  readonly consulting = signal(false);
  declared: number | null = null;
  observation = '';

  readonly register = computed(() => this.state().registers.find((r) => r.id === this.registerId()) ?? null);
  readonly shift = computed(() => {
    const id = this.register()?.currentShiftId;
    return this.state().shifts.find((s) => s.id === id) ?? null;
  });
  readonly expected = computed(() => {
    const sh = this.shift();
    return sh ? expectedByMethod(this.state(), sh.id) : null;
  });
  readonly pending = computed(() => {
    const sh = this.shift();
    return sh ? pendingVerificationInShift(this.state(), sh.id) : [];
  });
  readonly blockMessage = computed(() =>
    this.pending().length ? closingBlockMessage(this.pending().map((t) => t.id)) : null
  );
  readonly history = computed(() => [...this.state().closings].reverse());

  cashier(id: string): string {
    return `${userName(this.state(), id)} (${id})`;
  }

  async consult(txId: string): Promise<void> {
    this.consulting.set(true);
    await this.store.wait(this.store.latency.consult);
    this.store.exec((sim) => {
      const r = sim.consultStatus(txId);
      return r.ok ? { ok: true as const, value: r.value, message: `${txId}: ${r.value.message}` } : r;
    });
    this.consulting.set(false);
  }

  confirm(): void {
    const r = this.store.exec((sim) => sim.closeShift(this.registerId(), Number(this.declared), this.observation));
    if (r.ok) {
      this.lastClosing.set(r.value);
      this.declared = null;
      this.observation = '';
    }
  }

  diffOf(): number {
    const e = this.expected();
    return e && this.declared !== null && this.declared !== undefined ? Number(this.declared) - e.efectivo : 0;
  }
}
