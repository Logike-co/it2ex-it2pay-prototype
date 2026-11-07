import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { STATUS_LABELS } from '../../core/simulation/format';
import { ConciliationRow, conciliation, liveReverse } from '../../core/simulation/selectors';
import { SimulatorStore, toneOf } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V10 — Conciliación contra Reval (simulado) (C04, C05; R-11). */
@Component({
  selector: 'app-conciliacion',
  imports: [TraceBadgeComponent, FormsModule, EmptyStateComponent, LegendComponent, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './conciliacion.component.html',
})
export class ConciliacionComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  readonly statusLabels = STATUS_LABELS;

  readonly result = computed(() => conciliation(this.state()));
  /** RN-ACC-06: Finanzas concilia y propone; el Aprobador financiero aprueba o rechaza. */
  readonly canOperate = computed(() => this.store.can('conciliacion.operar'));
  readonly canApprove = computed(() => this.store.can('finanzas.aprobar'));
  readonly proposals = computed(() => [...this.state().proposals].reverse());

  pendingFor(txId: string) {
    return this.state().proposals.find((p) => p.txId === txId && p.status === 'Pendiente de aprobación') ?? null;
  }

  userOf(id: string | null): string {
    return id ? (this.state().users.find((u) => u.id === id)?.name ?? id) : '—';
  }
  readonly busy = signal(false);
  notes: Record<string, string> = {};

  run(): void {
    this.store.exec((sim) => sim.runConciliation());
  }

  action(row: ConciliationRow): 'consulta' | 'reverso' | 'ajuste' {
    if (row.classification === 'Inconsistencia reportada por Reval (simulado)') {
      return 'reverso';
    }
    const tx = row.tx;
    const pv =
      !!tx &&
      (tx.status === 'PENDING_VERIFICATION' ||
        liveReverse(this.state(), tx)?.status === 'PENDING_VERIFICATION');
    if (pv && (row.classification === 'Diferencia de estado' || row.classification === 'Solo en IT2Pay')) {
      return 'consulta';
    }
    return 'ajuste';
  }

  /** R-07: con el turno de la transacción original cerrado no se reversa (lo valida el motor). */
  shiftClosed(row: ConciliationRow): boolean {
    const tx = row.tx;
    if (!tx) {
      return false;
    }
    const shift = this.state().shifts.find((s) => s.id === tx.shiftId);
    return !shift || shift.status !== 'abierto';
  }

  async consult(id: string): Promise<void> {
    this.busy.set(true);
    await this.store.wait(this.store.latency.consult);
    this.store.exec(
      (sim) => {
        const r = sim.resolveByConsult(id);
        return r.ok ? { ok: true as const, value: r.value, message: `${id}: ${r.value.message}` } : r;
      },
      (v) => toneOf(v.status)
    );
    this.busy.set(false);
  }

  /** UC-17: Finanzas propone el reverso técnico; lo ejecuta la aprobación (UC-18). */
  technicalReverse(id: string): void {
    this.store.exec((sim) => sim.propose(id, 'reverso técnico'));
  }

  adjust(id: string): void {
    this.store.exec((sim) => sim.propose(id, 'ajuste', this.notes[id] ?? ''));
  }

  async review(id: string, approve: boolean): Promise<void> {
    const p = this.state().proposals.find((x) => x.id === id);
    this.busy.set(true);
    if (approve && p?.kind === 'reverso técnico') {
      await this.store.wait(this.store.latency.authorization);
    }
    const r = this.store.exec((sim) => sim.review('propuesta', id, approve));
    this.busy.set(false);
    const rev = r.ok && approve && p?.kind === 'reverso técnico' ? this.state().transactions.find((t) => t.originalId === p.txId && t.reverseKind === 'tecnico') : null;
    if (rev) {
      this.store.flash.set({ kind: toneOf(rev.status), text: `${id} aprobada · reverso técnico ${rev.id}: ${rev.responseMessage}` });
    }
  }

  itStatus(row: ConciliationRow): string {
    return row.tx ? STATUS_LABELS[row.tx.status] : '—';
  }
}
