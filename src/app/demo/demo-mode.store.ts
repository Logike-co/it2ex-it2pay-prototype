import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SimulatorStore } from '../core/state/simulator.store';
import { VIEWS } from '../views';
import { DemoPreset, presetById, PresetId, PRESETS, stepForView, stepViews } from './demo-script';

const PREFS_KEY = 'it2pay-simulador:v1:modo-demo';

interface DemoPrefs {
  hudOpen: boolean;
  showTrace: boolean;
  preset: PresetId;
  step: number;
}

const DEFAULT_PREFS: DemoPrefs = { hudOpen: false, showTrace: false, preset: 'ESC-01', step: 0 };

/**
 * Estado del modo presentador (workflow T §1.4): guía en pantalla, trazabilidad visible,
 * preset activo y paso del guion. Son preferencias de quien presenta; los datos de la
 * simulación siguen en `SimulatorStore`.
 */
@Injectable({ providedIn: 'root' })
export class DemoModeStore {
  private readonly sim = inject(SimulatorStore);
  private readonly router = inject(Router);

  private readonly initial = this.load();
  readonly hudOpen = signal(this.initial.hudOpen);
  readonly showTrace = signal(this.initial.showTrace);
  readonly presetId = signal<PresetId>(this.initial.preset);
  readonly stepIndex = signal(this.initial.step);

  /** Vista activa (V01..V12) según la ruta; null fuera de las 12 vistas. */
  readonly currentView = signal<string | null>(null);

  readonly presets = PRESETS;
  readonly preset = computed<DemoPreset>(() => presetById(this.presetId()));
  readonly step = computed(() => {
    const steps = this.preset().steps;
    return steps[Math.min(this.stepIndex(), steps.length - 1)];
  });
  /** La pantalla actual es una de las que recorre el paso en curso. */
  readonly viewInStep = computed(() => {
    const view = this.currentView();
    return view !== null && stepViews(this.step()).includes(view);
  });

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        const view = viewOfUrl(e.urlAfterRedirects);
        this.currentView.set(view);
        this.followView(view);
      }
    });
  }

  /**
   * La guía sigue a la pantalla: al navegar por el menú (o desde la propia vista) pasa al paso
   * del guion que usa esa pantalla. Si la pantalla no está en el guion, el paso no cambia.
   */
  private followView(view: string | null): void {
    if (view === null) return;
    const steps = this.preset().steps;
    const current = Math.min(this.stepIndex(), steps.length - 1);
    const target = stepForView(steps, current, view);
    if (target >= 0 && target !== current) {
      this.stepIndex.set(target);
      this.save();
    }
  }

  toggleHud(): void {
    this.hudOpen.update((v) => !v);
    this.save();
  }

  toggleTrace(): void {
    this.showTrace.update((v) => !v);
    this.save();
  }

  /**
   * Aplica un preset (flow-map §11): reinicia sus datos, fija el panel del presentador,
   * abre la guía en el primer paso y navega a su vista.
   */
  applyPreset(id: PresetId): void {
    const preset = presetById(id);
    this.sim.selectScenario(preset.scenario);
    this.sim.resetScenario(preset.scenario);
    this.sim.run((s) => s.setPresenter({ nextAuthorization: preset.nextAuthorization }));
    this.presetId.set(preset.id);
    this.stepIndex.set(0);
    this.hudOpen.set(true);
    this.save();
    this.sim.flash.set({ kind: 'ok', text: `${preset.id} · ${preset.name}: datos iniciales restaurados` });
    this.router.navigateByUrl('/' + preset.steps[0].route);
  }

  /**
   * Reinicio en 1 clic (`Ctrl+Shift+R`, X02): reinicia sin diálogo el escenario del preset
   * activo (y lo selecciona, para que la guía y los datos coincidan), deja el panel del
   * presentador del preset y vuelve al primer paso del guion.
   */
  quickReset(): void {
    const preset = this.preset();
    this.sim.selectScenario(preset.scenario);
    this.sim.resetScenario(preset.scenario);
    this.sim.run((s) => s.setPresenter({ nextAuthorization: preset.nextAuthorization }));
    this.stepIndex.set(0);
    this.save();
    this.sim.flash.set({ kind: 'ok', text: 'Reinicio en 1 clic: escenario restaurado a sus datos iniciales' });
    this.router.navigateByUrl('/inicio');
  }

  goTo(index: number): void {
    const steps = this.preset().steps;
    const i = Math.max(0, Math.min(index, steps.length - 1));
    this.stepIndex.set(i);
    this.save();
    this.router.navigateByUrl('/' + steps[i].route);
  }

  next(): void {
    this.goTo(this.stepIndex() + 1);
  }

  previous(): void {
    this.goTo(this.stepIndex() - 1);
  }

  private save(): void {
    const prefs: DemoPrefs = {
      hudOpen: this.hudOpen(),
      showTrace: this.showTrace(),
      preset: this.presetId(),
      step: this.stepIndex(),
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Sin almacenamiento local: las preferencias viven solo en memoria.
    }
  }

  private load(): DemoPrefs {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<DemoPrefs>;
        const preset = PRESETS.some((x) => x.id === p.preset) ? (p.preset as PresetId) : DEFAULT_PREFS.preset;
        return {
          hudOpen: p.hudOpen === true,
          showTrace: p.showTrace === true,
          preset,
          step: Number.isInteger(p.step) && (p.step as number) >= 0 ? (p.step as number) : 0,
        };
      }
    } catch {
      // Preferencias corruptas o almacenamiento bloqueado: valores por defecto.
    }
    return { ...DEFAULT_PREFS };
  }
}

/** Vista del simulador para una URL (`/caja/resultado` → V06, `/caja` → V05). */
export function viewOfUrl(url: string): string | null {
  const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return VIEWS.find((v) => v.path === path)?.id ?? null;
}
