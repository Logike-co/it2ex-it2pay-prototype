import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BUSINESS_LINES, BusinessLine } from '../../core/simulation/model';
import { chainName, chainOfPdv, chainQuotaConsolidated, quotaTable, serviceName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V08 — Cupos y riesgo (B08, B09, B10; R-08, R-09). */
@Component({
  selector: 'app-cupos',
  imports: [TraceBadgeComponent, FormsModule, EmptyStateComponent, LegendComponent, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './cupos.component.html',
})
export class CuposComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  /** D-T4: el Operador ajusta los cupos; los demás consultan y el Punto de Venta solo ve su PDV. */
  readonly editable = computed(() => this.store.can('cupos.editar'));
  readonly myPdv = computed(() => {
    const u = this.store.currentUser();
    return u?.profile === 'Punto de Venta' ? u.pdvId : null;
  });
  readonly lines = BUSINESS_LINES;

  readonly rows = computed(() => quotaTable(this.state()).filter((r) => !this.myPdv() || r.pdvId === this.myPdv()));
  readonly chains = computed(() =>
    this.state().chains.map((c) => ({ ...c, cons: chainQuotaConsolidated(this.state(), c.id) }))
  );
  readonly alerts = computed(() => [...this.state().alerts].reverse());

  edits: Record<string, number> = {};
  newPdv = '';
  newLine: BusinessLine = 'Recaudos';
  newAssigned = 0;

  key(pdvId: string, line: string): string {
    return `${pdvId}|${line}`;
  }

  editValue(pdvId: string, line: string, assigned: number): number {
    const k = this.key(pdvId, line);
    return this.edits[k] ?? assigned;
  }

  setEdit(pdvId: string, line: string, value: number): void {
    this.edits[this.key(pdvId, line)] = value;
  }

  save(pdvId: string, line: BusinessLine, assigned: number): void {
    const value = Number(this.editValue(pdvId, line, assigned));
    if (this.store.exec((sim) => sim.setQuota(pdvId, line, value)).ok) {
      delete this.edits[this.key(pdvId, line)];
    }
  }

  define(): void {
    this.store.exec((sim) => sim.setQuota(this.newPdv, this.newLine, Number(this.newAssigned)));
  }

  chainOf(pdvId: string): string {
    return chainName(this.state(), chainOfPdv(this.state(), pdvId));
  }

  serviceOf(id: string): string {
    return serviceName(this.state(), id);
  }
}
