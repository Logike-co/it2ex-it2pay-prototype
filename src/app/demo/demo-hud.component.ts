import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SimulatorStore } from '../core/state/simulator.store';
import { VIEWS } from '../views';
import { DemoModeStore } from './demo-mode.store';
import { PresetId } from './demo-script';
import { itemsTrace } from './traceability';

/**
 * Guía de demo en pantalla (workflow T §1.4-1, X01): paso actual del guion con acción,
 * narrativa y checklist, saltos a cualquier paso o vista, presets ESC-01..03 (X02) y
 * acceso al panel del presentador. Se abre con el botón «Guía de demo» o `Ctrl+Shift+D`,
 * acoplada a la derecha de la vista para no tapar sus controles.
 */
@Component({
  selector: 'app-demo-hud',
  // El panel es un hijo directo de la fila del shell: se acopla a la derecha sin tapar la vista.
  host: { class: 'contents' },
  template: `@if (demo.hudOpen()) {
    <aside
      class="no-print sticky top-6 flex max-h-[calc(100vh-1.5rem)] w-[22rem] max-w-[40vw] 2xl:w-[24rem] shrink-0 flex-col self-start overflow-hidden border-l border-line bg-surface text-sm"
      data-testid="guia-demo"
      aria-label="Guía de demo"
    >
      <header class="flex items-center gap-2 border-b border-line bg-primary px-3 py-2 text-primary-contrast">
        <strong class="flex-1">Guía de demo</strong>
        <span class="text-xs opacity-80">Ctrl+Shift+D</span>
        <button type="button" class="px-1" aria-label="Cerrar guía" data-testid="guia-cerrar" (click)="demo.toggleHud()">✕</button>
      </header>

      <div class="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2" data-testid="guia-presets">
        @for (p of demo.presets; track p.id) {
          <button
            type="button"
            class="rounded border px-2 py-0.5 text-xs"
            [class]="p.id === demo.presetId() ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface-alt'"
            [attr.data-testid]="'preset-' + p.id"
            [title]="p.summary + ' Aplicarlo reinicia sus datos.'"
            (click)="askPreset(p.id)"
          >
            {{ p.id }} · {{ p.name }}
          </button>
        }
      </div>
      @if (pendingPreset(); as pid) {
        <div class="border-b border-line bg-warning-soft px-3 py-2 text-xs" data-testid="guia-confirmar-preset">
          Aplicar {{ pid }} reinicia los datos de su escenario. Lo operado en ese escenario se pierde.
          <div class="mt-1 flex gap-2">
            <button type="button" class="btn" (click)="pendingPreset.set(null)">Cancelar</button>
            <button type="button" class="btn btn-danger" data-testid="guia-aplicar-preset" (click)="applyPreset(pid)">Aplicar {{ pid }}</button>
          </div>
        </div>
      }

      <div class="flex-1 overflow-y-auto px-3 py-2">
        @if (demo.step(); as s) {
          <p class="text-xs text-muted" data-testid="guia-paso-num">
            {{ demo.preset().id }} · Paso {{ s.n }} de {{ demo.preset().steps.length }} · {{ s.view }}
          </p>
          <h2 class="text-base font-bold" data-testid="guia-paso-titulo">{{ s.title }}</h2>
          @if (demo.currentView() !== s.view) {
            <p class="mt-1 rounded bg-warning-soft px-2 py-1 text-xs" data-testid="guia-fuera-de-vista">
              Este paso arranca en {{ s.view }}.
              <button type="button" class="underline" data-testid="guia-ir-vista" (click)="demo.goTo(demo.stepIndex())">Ir a {{ s.view }}</button>
            </p>
          }
          @if (demo.showTrace()) {
            <p class="mt-1 font-mono text-[11px] text-muted" data-testid="guia-paso-trazabilidad">
              {{ s.items.join(' · ') }} → {{ stepTrace() }}
            </p>
          }

          <h3 class="mt-2 text-xs font-semibold text-muted uppercase">Qué hacer</h3>
          <ol class="ml-4 list-decimal">
            @for (a of s.actions; track $index) {
              <li>{{ a }}</li>
            }
          </ol>

          <h3 class="mt-2 text-xs font-semibold text-muted uppercase">Qué contar</h3>
          <p class="italic" data-testid="guia-narrativa">«{{ s.say }}»</p>

          <h3 class="mt-2 text-xs font-semibold text-muted uppercase">Qué debe verse</h3>
          <ul class="list-none p-0" data-testid="guia-checklist">
            @for (e of s.expect; track $index) {
              <li>
                <label class="flex items-start gap-2">
                  <input type="checkbox" class="mt-1" [checked]="isChecked($index)" (change)="toggleCheck($index)" />
                  <span>{{ e }}</span>
                </label>
              </li>
            }
          </ul>
        }

        <details class="mt-3">
          <summary class="cursor-pointer text-xs font-semibold text-muted" data-testid="guia-todos-los-pasos">Todos los pasos</summary>
          <ol class="mt-1 ml-4 list-decimal">
            @for (st of demo.preset().steps; track st.n) {
              <li>
                <button
                  type="button"
                  class="text-left hover:underline"
                  [class.font-bold]="$index === demo.stepIndex()"
                  [attr.data-testid]="'guia-ir-paso-' + st.n"
                  (click)="demo.goTo($index)"
                >
                  {{ st.title }} <span class="text-muted">({{ st.view }})</span>
                </button>
              </li>
            }
          </ol>
        </details>

        <label class="mt-2 flex items-center gap-2 text-xs">
          <span class="whitespace-nowrap text-muted">Saltar a vista</span>
          <select class="input min-w-0 flex-1 text-xs" data-testid="guia-saltar-vista" (change)="jump($event)">
            <option value="">—</option>
            @for (v of views; track v.id) {
              <option [value]="v.path">{{ v.id }} · {{ v.name }}</option>
            }
          </select>
        </label>
      </div>

      <footer class="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <button type="button" class="btn" data-testid="guia-anterior" [disabled]="demo.stepIndex() === 0" (click)="demo.previous()">◀ Anterior</button>
        <button
          type="button"
          class="btn"
          data-testid="guia-siguiente"
          [disabled]="demo.stepIndex() >= demo.preset().steps.length - 1"
          (click)="demo.next()"
        >
          Siguiente ▶
        </button>
        <span class="flex-1"></span>
        <label class="flex items-center gap-1 text-xs">
          <input type="checkbox" data-testid="guia-trazabilidad" [checked]="demo.showTrace()" (change)="demo.toggleTrace()" />
          Trazabilidad
        </label>
        <button type="button" class="text-xs underline" data-testid="guia-panel-presentador" (click)="sim.presenterOpen.set(!sim.presenterOpen())">
          Panel del presentador
        </button>
      </footer>
      <p class="border-t border-line px-3 py-1 text-[11px] text-muted">Ctrl+Shift+R reinicia el escenario en 1 clic</p>
    </aside>
  }`,
})
export class DemoHudComponent {
  readonly demo = inject(DemoModeStore);
  readonly sim = inject(SimulatorStore);
  private readonly router = inject(Router);
  readonly views = VIEWS;

  readonly pendingPreset = signal<PresetId | null>(null);
  private readonly checked = signal<Set<number>>(new Set());

  readonly stepTrace = computed(() => {
    const t = itemsTrace(this.demo.step().items);
    return t.us.length ? t.us.map((u) => `${u}/RF-${u.slice(3)}`).join(', ') : 'solo demo';
  });

  constructor() {
    // La checklist es del paso: se limpia al cambiar de paso o de preset.
    effect(() => {
      this.demo.presetId();
      this.demo.stepIndex();
      this.checked.set(new Set());
    });
  }

  askPreset(id: PresetId): void {
    this.pendingPreset.set(id);
  }

  applyPreset(id: PresetId): void {
    this.pendingPreset.set(null);
    this.demo.applyPreset(id);
  }

  isChecked(i: number): boolean {
    return this.checked().has(i);
  }

  toggleCheck(i: number): void {
    const next = new Set(this.checked());
    if (next.has(i)) {
      next.delete(i);
    } else {
      next.add(i);
    }
    this.checked.set(next);
  }

  jump(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.router.navigateByUrl('/' + select.value);
      select.value = '';
    }
  }
}
