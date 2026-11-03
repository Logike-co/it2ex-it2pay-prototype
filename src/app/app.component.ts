import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthOverride, ReverseOverride, ScenarioId } from './core/simulation/model';
import { SCENARIO_SHORT } from './core/simulation/seed';
import { branchName, chainName, pdvOfRegister, userName } from './core/simulation/selectors';
import { SimulatorStore } from './core/state/simulator.store';
import { DemoHudComponent } from './demo/demo-hud.component';
import { DemoModeStore } from './demo/demo-mode.store';
import { ViewTraceComponent } from './demo/view-trace.component';
import { VIEWS } from './views';
import { CodeTextComponent } from './shared/code-text.component';

/**
 * Shell: banda de simulación, encabezado, menú de 12 vistas, reinicio, panel del presentador,
 * guía de demo y trazabilidad (workflow T §1.4).
 */
@Component({
  selector: 'app-root',
  imports: [CodeTextComponent, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, DemoHudComponent, ViewTraceComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(SimulatorStore);
  readonly demo = inject(DemoModeStore);
  private readonly router = inject(Router);

  readonly views = VIEWS;
  readonly scenarios: { id: ScenarioId; name: string }[] = [
    { id: 'SUP', name: SCENARIO_SHORT.SUP },
    { id: 'PAR', name: SCENARIO_SHORT.PAR },
  ];
  readonly authOptions: { value: AuthOverride; label: string }[] = [
    { value: 'gatillo', label: 'Según gatillo' },
    { value: 'aprobar', label: 'Aprobar' },
    { value: 'rechazar', label: 'Rechazar' },
    { value: 'timeout-aprobada', label: 'Timeout → aprobada al consultar' },
    { value: 'timeout-rechazada', label: 'Timeout → rechazada al consultar' },
    { value: 'timeout-en-proceso', label: 'Timeout → en proceso, aprobada a la 2.ª consulta' },
    { value: 'timeout-sin-registro', label: 'Timeout → sin registro (reintento)' },
  ];
  readonly reverseOptions: { value: ReverseOverride; label: string }[] = [
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'timeout-aprobado', label: 'Timeout → aprobado' },
    { value: 'timeout-rechazado', label: 'Timeout → rechazado' },
  ];

  readonly confirmReset = signal<'scenario' | 'all' | null>(null);
  private flashAt = 0;

  constructor() {
    // Un aviso se descarta al cambiar de vista, salvo que lo haya producido la acción que navegó.
    effect(() => {
      this.store.flash();
      this.flashAt = Date.now();
    });
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd && Date.now() - this.flashAt > 1500) {
        this.store.flash.set(null);
      }
    });
  }
  readonly menuOpen = signal(false);

  readonly session = computed(() => {
    const s = this.store.state();
    const sess = s.session;
    if (!sess.registerId) {
      return null;
    }
    const pdvId = pdvOfRegister(s, sess.registerId);
    return {
      text: `${chainName(s, sess.chainId)} · ${branchName(s, sess.branchId)} · ${pdvId} · ${sess.registerId}`,
      user: `${userName(s, sess.userId)} (${sess.userId})`,
      shift: sess.shiftId ?? 'Caja cerrada',
    };
  });

  readonly lastTx = computed(() => {
    const s = this.store.state();
    return s.transactions.find((t) => t.id === s.lastResultTxId) ?? null;
  });

  /**
   * Atajos del modo presentador, iguales en Mac y Windows (se evalúa Ctrl, no Cmd):
   * `Ctrl+Shift+D` abre o cierra la guía de demo; `Ctrl+Shift+R` reinicia el escenario
   * en 1 clic, sin diálogo (X01, X02). No chocan con los atajos F1–F12 de la caja (ADR-0007).
   */
  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent): void {
    if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
      return;
    }
    if (event.code === 'KeyD') {
      event.preventDefault();
      this.demo.toggleHud();
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      this.confirmReset.set(null);
      this.demo.quickReset();
    }
  }

  changeScenario(id: ScenarioId): void {
    this.store.selectScenario(id);
  }

  setAuth(value: AuthOverride): void {
    this.store.run((sim) => sim.setPresenter({ nextAuthorization: value }));
  }

  setReverse(value: ReverseOverride): void {
    this.store.run((sim) => sim.setPresenter({ nextReverse: value }));
  }

  setIdempotency(value: boolean): void {
    this.store.run((sim) => sim.setPresenter({ idempotency: value }));
  }

  doReset(): void {
    if (this.confirmReset() === 'all') {
      this.store.resetAll();
    } else {
      this.store.resetScenario();
    }
    this.confirmReset.set(null);
    this.router.navigateByUrl('/inicio');
  }
}
