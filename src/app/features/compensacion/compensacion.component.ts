import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BUSINESS_LINES, BusinessLine, CompensationMode } from '../../core/simulation/model';
import { chainName, compensation } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V11 — Compensación y efectivo (C06, C07, C08; R-12..R-14). */
@Component({
  selector: 'app-compensacion',
  imports: [TraceBadgeComponent, FormsModule, EmptyStateComponent, LegendComponent, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './compensacion.component.html',
})
export class CompensacionComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  readonly lines = BUSINESS_LINES;

  readonly comp = computed(() => compensation(this.state()));
  readonly consignments = computed(() => [...this.state().consignments].reverse());

  conPdv = '';
  conLine: BusinessLine = 'Recaudos';
  conValue: number | null = null;

  setMode(mode: CompensationMode): void {
    this.store.run((sim) => sim.setCompensationMode(mode));
  }

  report(): void {
    const r = this.store.exec((sim) => sim.reportConsignment(this.conPdv, this.conLine, Number(this.conValue)));
    if (r.ok) {
      this.conValue = null;
    }
  }

  validate(id: string): void {
    this.store.exec((sim) => sim.validateConsignment(id));
  }

  reject(id: string): void {
    this.store.exec((sim) => sim.rejectConsignment(id));
  }

  chainLabel(id: string): string {
    return chainName(this.state(), id);
  }
}
