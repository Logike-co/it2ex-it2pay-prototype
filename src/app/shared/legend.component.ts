import { Component } from '@angular/core';

/** Leyenda obligatoria junto a todo resultado financiero (§7, CA-09). */
@Component({
  selector: 'app-legend',
  template: `<span
    data-testid="leyenda"
    class="inline-block rounded border border-band px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-band"
    >SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL</span
  >`,
})
export class LegendComponent {}

/** Rótulo de toda fórmula ilustrativa (S-01). */
@Component({
  selector: 'app-illustrative',
  template: `<div
    data-testid="ilustrativo"
    class="mt-2 rounded border border-dashed border-warning bg-warning-soft px-3 py-2 text-xs text-ink"
  >
    <p class="font-semibold text-warning">
      Ilustrativo — sujeto a validación del responsable funcional
    </p>
    <div class="mt-1 font-mono whitespace-pre-wrap text-muted">
      <ng-content />
    </div>
  </div>`,
})
export class IllustrativeComponent {}
