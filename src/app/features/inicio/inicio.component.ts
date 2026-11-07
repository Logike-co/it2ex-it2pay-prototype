import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccessView, VIEW_NOTES } from '../../core/access/access';
import { ScenarioId } from '../../core/simulation/model';
import { SCENARIO_NAMES, SCENARIO_SHORT } from '../../core/simulation/seed';
import { branchName, chainName, coverage, pdvOfRegister } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { VIEWS } from '../../views';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';
import { CodeTextComponent } from '../../shared/code-text.component';

/**
 * V01 — Inicio (F01, F02). Después del login: el Colocador abre su turno en una de sus cajas;
 * los demás perfiles ven solo los módulos a los que tienen acceso (D-T4).
 */
@Component({
  selector: 'app-inicio',
  imports: [TraceBadgeComponent, CodeTextComponent, FormsModule, RouterLink, ...SIM_PIPES],
  templateUrl: './inicio.component.html',
})
export class InicioComponent {
  readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  readonly state = this.store.state;
  readonly user = this.store.currentUser;

  registerId = '';
  baseCash = 100_000;

  constructor() {
    this.registerId = this.myRegisters()[0]?.id ?? '';
  }

  /** Módulos del perfil (sin V01). */
  readonly modules = computed(() => {
    const role = this.store.role();
    return VIEWS.filter((v) => v.id !== 'V01' && this.store.canView(v.id as AccessView)).map((v) => ({
      ...v,
      note: role ? (VIEW_NOTES[v.id as AccessView]?.[role] ?? '') : '',
    }));
  });

  readonly scenarioCards = computed(() =>
    (['SUP', 'PAR'] as ScenarioId[]).map((id) => ({
      id,
      short: SCENARIO_SHORT[id],
      name: SCENARIO_NAMES[id],
      cov: coverage(this.store.stateOf(id)),
      active: this.store.activeScenario() === id,
    }))
  );

  myRegisters() {
    const u = this.user();
    return u ? this.state().registers.filter((r) => u.registerIds.includes(r.id)) : [];
  }

  register() {
    return this.state().registers.find((r) => r.id === this.registerId) ?? null;
  }

  pdvOf(registerId: string): string {
    return pdvOfRegister(this.state(), registerId) ?? '—';
  }

  /** «Mercado Central Demo · Sucursal Norte · PDV-S1 · CJ-S1-01» (E01). */
  selectionHeader(): string {
    const s = this.state();
    const pdvId = pdvOfRegister(s, this.registerId);
    const pdv = s.pdvs.find((p) => p.id === pdvId);
    const branch = s.branches.find((b) => b.id === pdv?.branchId);
    return `${chainName(s, branch?.chainId ?? null)} · ${branchName(s, branch?.id ?? null)} · ${pdvId} · ${this.registerId}`;
  }

  openShift(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    const r = this.store.exec((sim) => sim.login(this.registerId, u.id, Number(this.baseCash)));
    if (r.ok) {
      this.router.navigateByUrl('/caja');
    }
  }
}
