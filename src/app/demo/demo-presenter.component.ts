import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthOverride, ReverseOverride } from '../core/simulation/model';
import { SimulatorStore } from '../core/state/simulator.store';

/**
 * Sección «Presentador» de la guía de demo (X03): desenlaces forzados de un solo uso,
 * idempotencia de Reval (simulado), gatillos por terminación y último desenlace.
 * Vive dentro de la guía para que la pantalla de la demo quede limpia; se pliega con
 * su botón y el estado plegado es `SimulatorStore.presenterOpen`.
 */
@Component({
  selector: 'app-demo-presenter',
  imports: [FormsModule],
  template: `<section class="mt-3 rounded border border-line" aria-label="Panel del presentador">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-semibold text-primary uppercase hover:bg-primary-soft"
      data-testid="btn-presentador"
      [attr.aria-expanded]="sim.presenterOpen()"
      (click)="sim.presenterOpen.set(!sim.presenterOpen())"
    >
      <span class="flex-1">Panel del presentador</span>
      <span aria-hidden="true">{{ sim.presenterOpen() ? '▾' : '▸' }}</span>
    </button>
    @if (sim.presenterOpen()) {
      <div class="flex flex-col gap-2 border-t border-line bg-warning-soft px-2 py-2" data-testid="panel-presentador">
        <label>
          <span class="label">Próxima autorización (un solo uso)</span>
          <select
            class="input text-xs"
            data-testid="panel-autorizacion"
            [ngModel]="sim.state().presenter.nextAuthorization"
            (ngModelChange)="setAuth($event)"
          >
            @for (o of authOptions; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </label>
        <label>
          <span class="label">Próximo reverso (un solo uso)</span>
          <select
            class="input text-xs"
            data-testid="panel-reverso"
            [ngModel]="sim.state().presenter.nextReverse"
            (ngModelChange)="setReverse($event)"
          >
            @for (o of reverseOptions; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </label>
        <label class="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            data-testid="panel-idempotencia"
            [ngModel]="sim.state().presenter.idempotency"
            (ngModelChange)="setIdempotency($event)"
          />
          <span>Reval (simulado) ofrece idempotencia</span>
        </label>
        <p class="text-[11px] text-muted">
          Gatillos por terminación: 013 rechazo · 408 timeout→aprobada · 409 timeout→rechazada · 410 en proceso ·
          404 sin registro · 999 sin obligación · OTP 000000 rechazo.
          @if (lastTx(); as t) {
            <br />Último desenlace: <strong>{{ t.id }}</strong> — {{ t.appliedOutcome }}
          }
        </p>
      </div>
    }
  </section>`,
})
export class DemoPresenterComponent {
  readonly sim = inject(SimulatorStore);

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

  readonly lastTx = computed(() => {
    const s = this.sim.state();
    return s.transactions.find((t) => t.id === s.lastResultTxId) ?? null;
  });

  setAuth(value: AuthOverride): void {
    this.sim.run((s) => s.setPresenter({ nextAuthorization: value }));
  }

  setReverse(value: ReverseOverride): void {
    this.sim.run((s) => s.setPresenter({ nextReverse: value }));
  }

  setIdempotency(value: boolean): void {
    this.sim.run((s) => s.setPresenter({ idempotency: value }));
  }
}
