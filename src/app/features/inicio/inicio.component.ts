import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ScenarioId } from '../../core/simulation/model';
import { SCENARIO_NAMES, SCENARIO_SHORT } from '../../core/simulation/seed';
import { coverage, pdvOfRegister } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V01 — Inicio y escenarios (F01, F02, CA-08). */
@Component({
  selector: 'app-inicio',
  imports: [TraceBadgeComponent, FormsModule, RouterLink, ...SIM_PIPES],
  templateUrl: './inicio.component.html',
})
export class InicioComponent {
  readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  chainId = '';
  branchId = '';
  registerId = '';
  userId = '';
  baseCash = 100_000;

  readonly scenarioCards = computed(() =>
    (['SUP', 'PAR'] as ScenarioId[]).map((id) => ({
      id,
      short: SCENARIO_SHORT[id],
      name: SCENARIO_NAMES[id],
      cov: coverage(this.store.stateOf(id)),
      active: this.store.activeScenario() === id,
    }))
  );

  readonly state = this.store.state;

  chains() {
    return this.state().chains.filter((c) => c.active);
  }

  branches() {
    return this.state().branches.filter((b) => b.chainId === this.chainId && b.active);
  }

  registers() {
    const pdvIds = this.state()
      .pdvs.filter((p) => p.branchId === this.branchId && p.active)
      .map((p) => p.id);
    return this.state().registers.filter((r) => pdvIds.includes(r.pdvId));
  }

  register() {
    return this.state().registers.find((r) => r.id === this.registerId) ?? null;
  }

  users() {
    return this.state().users.filter(
      (u) => u.active && (u.profile !== 'Cajero' || u.registerIds.includes(this.registerId))
    );
  }

  /** «Mercado Central Demo · Sucursal Norte · PDV-S1 · CJ-S1-01» (E01). */
  selectionHeader(): string {
    const s = this.state();
    const chain = s.chains.find((c) => c.id === this.chainId)?.name ?? '';
    const branch = s.branches.find((b) => b.id === this.branchId)?.name ?? '';
    return `${chain} · ${branch} · ${this.pdvOf(this.registerId)} · ${this.registerId}`;
  }

  pdvOf(registerId: string): string {
    return pdvOfRegister(this.state(), registerId) ?? '—';
  }

  useScenario(id: ScenarioId): void {
    this.store.selectScenario(id);
    this.resetForm();
  }

  onChain(): void {
    this.branchId = '';
    this.registerId = '';
    this.userId = '';
  }

  onBranch(): void {
    this.registerId = '';
    this.userId = '';
  }

  onRegister(): void {
    this.userId = '';
  }

  login(): void {
    const r = this.store.exec((sim) => sim.login(this.registerId, this.userId, Number(this.baseCash)));
    if (r.ok) {
      this.router.navigateByUrl('/caja');
    }
  }

  logout(): void {
    this.store.run((sim) => sim.logout());
  }

  private resetForm(): void {
    this.chainId = '';
    this.onChain();
  }
}
