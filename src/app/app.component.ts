import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { branchName, chainName, pdvOfRegister, userName } from './core/simulation/selectors';
import { SimulatorStore } from './core/state/simulator.store';
import { DemoHudComponent } from './demo/demo-hud.component';
import { DemoModeStore } from './demo/demo-mode.store';
import { ViewTraceComponent } from './demo/view-trace.component';
import { VIEWS } from './views';
import { CodeTextComponent } from './shared/code-text.component';

/**
 * Shell: banda de simulación, barra superior (☰, logo IT2Pay, sesión y botón de la guía),
 * menú de 12 vistas y guía de demo acoplada. Todos los controles de la demo viven en la
 * guía (workflow T §1.4); el shell solo conserva el diálogo de reinicio y los atajos.
 */
@Component({
  selector: 'app-root',
  imports: [CodeTextComponent, RouterOutlet, RouterLink, RouterLinkActive, DemoHudComponent, ViewTraceComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(SimulatorStore);
  readonly demo = inject(DemoModeStore);
  private readonly router = inject(Router);

  readonly views = VIEWS;
  readonly confirmReset = this.demo.confirmReset;
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
  /** Menú de las 12 vistas: el botón ☰ lo oculta o lo muestra en cualquier ancho. */
  readonly menuOpen = signal(true);

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

  /** En pantallas angostas el menú se cierra al elegir una vista; en escritorio se queda abierto. */
  closeMenuOnSmallScreen(): void {
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches) {
      this.menuOpen.set(false);
    }
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
