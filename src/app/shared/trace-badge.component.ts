import { Component, computed, inject, input } from '@angular/core';
import { DemoModeStore } from '../demo/demo-mode.store';
import { itemsTrace } from '../demo/traceability';

/**
 * Badge de trazabilidad de un componente (workflow T §1.4-4, X04): historia (US) y
 * requerimiento (RF) que valida, con los ítems y escenarios BDD en el tooltip.
 * Solo se ve con «Trazabilidad» activa y nunca se imprime.
 */
@Component({
  selector: 'app-trace-badge',
  template: `@if (demo.showTrace()) {
    <span
      class="no-print ml-2 inline-flex flex-wrap items-center gap-1 align-middle text-[11px] font-normal"
      data-testid="badge-trazabilidad"
      [attr.data-items]="items().join(' ')"
      [title]="tooltip()"
    >
      @for (u of trace().us; track u) {
        <span class="rounded border border-line bg-primary-soft px-1 font-mono text-primary">{{ u }} · RF-{{ u.slice(3) }}</span>
      } @empty {
        <span class="rounded border border-line bg-surface-alt px-1 text-muted">Solo demo</span>
      }
    </span>
  }`,
})
export class TraceBadgeComponent {
  readonly demo = inject(DemoModeStore);
  /** Ítems de la matriz de alcance que implementa el componente (F/B/C). */
  readonly items = input.required<string[]>();

  readonly trace = computed(() => itemsTrace(this.items()));
  readonly tooltip = computed(() => {
    const t = this.trace();
    const items = t.items.map((i) => `${i.id} (${i.level}) ${i.name}`).join('\n');
    return `${items}\nEscenarios BDD: ${t.bdd.join(', ') || '—'}`;
  });
}
