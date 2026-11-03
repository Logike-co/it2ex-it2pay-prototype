import { Component, computed, inject, signal } from '@angular/core';
import { DemoModeStore } from './demo-mode.store';
import { rfOf, viewTrace } from './traceability';

/**
 * Trazabilidad de la vista activa (workflow T §1.4-4, X04): historias (US) y requerimientos
 * (RF) que valida, con el detalle de ítems y escenarios BDD desplegable. Va encima de la vista,
 * solo con «Trazabilidad» activa, y nunca se imprime.
 */
@Component({
  selector: 'app-view-trace',
  template: `@if (demo.showTrace() && trace(); as t) {
    <section
      class="no-print mb-3 rounded border border-line bg-surface px-3 py-2 text-xs"
      data-testid="trazabilidad-vista"
      [attr.data-view]="t.view"
      aria-label="Trazabilidad de la vista"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="font-semibold text-muted">Trazabilidad {{ t.view }}</span>
        @for (u of t.us; track u) {
          <span class="rounded border border-line bg-primary-soft px-1 font-mono text-primary" data-testid="badge-us">{{ u }} · {{ rf(u) }}</span>
        } @empty {
          <span class="rounded border border-line bg-surface-alt px-1 text-muted" data-testid="badge-us">Solo demo</span>
        }
        <span class="text-muted">· {{ t.items.length }} ítems · {{ t.bdd.length }} escenarios BDD</span>
        <button type="button" class="ml-auto underline" data-testid="trazabilidad-detalle" (click)="open.set(!open())">
          {{ open() ? 'Ocultar detalle' : 'Ver detalle' }}
        </button>
      </div>
      @if (open()) {
        <div class="mt-2 grid gap-2 @3xl:grid-cols-2">
          <table class="w-full">
            <thead>
              <tr class="text-left text-muted"><th>Ítem</th><th>Nivel</th><th>Historia / requerimiento</th></tr>
            </thead>
            <tbody>
              @for (i of t.items; track i.id) {
                <tr>
                  <td class="pr-2 align-top font-mono">{{ i.id }}</td>
                  <td class="pr-2 align-top">{{ i.level }}</td>
                  <td class="align-top">
                    {{ i.name }}
                    <span class="font-mono text-muted">· {{ i.us.length ? usRf(i.us) : 'solo demo' }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <ul class="list-none p-0">
            @for (b of t.bdd; track b.id) {
              <li><span class="font-mono">{{ b.id }}</span> {{ b.name }}</li>
            }
          </ul>
        </div>
      }
    </section>
  }`,
})
export class ViewTraceComponent {
  readonly demo = inject(DemoModeStore);
  readonly open = signal(false);
  readonly trace = computed(() => {
    const v = this.demo.currentView();
    return v ? viewTrace(v) : null;
  });
  readonly rf = rfOf;
  usRf(us: string[]): string {
    return us.map((u) => `${u}/${rfOf(u)}`).join(', ');
  }
}
