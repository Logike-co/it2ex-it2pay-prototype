import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BUSINESS_LINES } from '../../core/simulation/model';
import { chainName, chainOfPdv, indicators, serviceName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { IllustrativeComponent, LegendComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V02 — Dashboard ejecutivo (C12, C13, R-17). */
@Component({
  selector: 'app-dashboard',
  imports: [TraceBadgeComponent, FormsModule, RouterLink, LegendComponent, IllustrativeComponent, StatusBadgeComponent, ...SIM_PIPES],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  readonly lines = BUSINESS_LINES;

  readonly chainId = signal('');
  readonly pdvId = signal('');

  readonly pdvs = computed(() =>
    this.state().pdvs.filter((p) => !this.chainId() || chainOfPdv(this.state(), p.id) === this.chainId())
  );

  readonly ind = computed(() =>
    indicators(this.state(), { chainId: this.chainId() || null, pdvId: this.pdvId() || null })
  );

  onChain(id: string): void {
    this.chainId.set(id);
    this.pdvId.set('');
  }

  chainLabel(id: string): string {
    return chainName(this.state(), id);
  }

  serviceOf(id: string | null): string {
    return serviceName(this.state(), id);
  }
}
