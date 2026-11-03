import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsultResult } from '../core/simulation/engine';
import { Result } from '../core/simulation/model';
import { liveReverse } from '../core/simulation/selectors';
import { SimulatorStore, Tone, toneOf } from '../core/state/simulator.store';

/**
 * Acciones sobre una transacción (V06/V07): consultar estado, reintentar con
 * la misma clave, anular y reversar (§3.3, R-04..R-07).
 */
@Component({
  selector: 'app-tx-actions',
  imports: [FormsModule],
  templateUrl: './tx-actions.component.html',
})
export class TxActionsComponent {
  private readonly store = inject(SimulatorStore);
  readonly txId = input.required<string>();
  /** Emite el id de la transacción que conviene mostrar tras la acción. */
  readonly changed = output<string>();

  readonly busy = signal<string | null>(null);
  readonly message = signal<{ kind: Tone; text: string } | null>(null);
  readonly mode = signal<'none' | 'void' | 'reverse'>('none');
  reason = '';
  supervisorId = '';

  readonly reasons = ['Error del cajero', 'Solicitud del cliente', 'Número errado', 'Otro'];

  readonly tx = computed(() => this.store.state().transactions.find((t) => t.id === this.txId()) ?? null);
  readonly live = computed(() => {
    const t = this.tx();
    return t ? liveReverse(this.store.state(), t) : null;
  });
  /** R-06/R-07: con el turno de la transacción cerrado no se anula ni se reversa (lo valida el motor). */
  readonly shiftClosed = computed(() => {
    const t = this.tx();
    if (!t) {
      return false;
    }
    const shift = this.store.state().shifts.find((s) => s.id === t.shiftId);
    return !shift || shift.status !== 'abierto';
  });
  readonly supervisors = computed(() =>
    this.store.state().users.filter((u) => u.profile === 'Supervisor' && u.active)
  );
  readonly idempotency = computed(() => this.store.state().presenter.idempotency);

  private show(result: { ok: boolean; error?: string; message?: string }, fallback: string): void {
    this.message.set(
      result.ok ? { kind: 'ok', text: result.message ?? fallback } : { kind: 'error', text: result.error ?? '' }
    );
  }

  /** Desenlace de consulta o reintento: rechazado = error, en verificación = alerta. */
  private showOutcome(r: Result<ConsultResult>): void {
    this.message.set(
      r.ok ? { kind: toneOf(r.value.status), text: r.value.message } : { kind: 'error', text: r.error }
    );
  }

  async consult(targetId: string): Promise<void> {
    this.busy.set('Consultando estado en Reval (simulado)…');
    await this.store.wait(this.store.latency.consult);
    const r = this.store.run((sim) => sim.consultStatus(targetId));
    this.busy.set(null);
    this.showOutcome(r);
    this.changed.emit(this.txId());
  }

  async retry(): Promise<void> {
    this.busy.set('Reintentando con la misma clave…');
    await this.store.wait(this.store.latency.authorization);
    const r = this.store.run((sim) => sim.retrySameKey(this.txId()));
    this.busy.set(null);
    this.showOutcome(r);
    this.changed.emit(this.txId());
  }

  openVoid(): void {
    const t = this.tx();
    if (t && (t.type === 'recarga' || t.type === 'retiro')) {
      // R-06: el motor responde con el mensaje propio del tipo.
      const r = this.store.run((sim) => sim.voidTransaction(t.id, 'x', null));
      this.show(r, '');
      return;
    }
    this.reason = this.reasons[0];
    this.supervisorId = '';
    this.message.set(null);
    this.mode.set('void');
  }

  openReverse(): void {
    this.reason = 'Solicitud del cliente';
    this.message.set(null);
    this.mode.set('reverse');
  }

  confirmVoid(): void {
    const r = this.store.run((sim) => sim.voidTransaction(this.txId(), this.reason, this.supervisorId || null));
    this.show(r, 'Anulada');
    if (r.ok) {
      this.mode.set('none');
      this.changed.emit(this.txId());
    }
  }

  async confirmReverse(): Promise<void> {
    this.busy.set('Enviando reverso a Reval (simulado)…');
    await this.store.wait(this.store.latency.authorization);
    const r = this.store.run((sim) => sim.reverse(this.txId(), 'funcional', this.reason));
    this.busy.set(null);
    if (r.ok) {
      this.mode.set('none');
      this.message.set({ kind: toneOf(r.value.status), text: `${r.value.id}: ${r.value.responseMessage}` });
      this.changed.emit(r.value.id);
    } else {
      this.show(r, '');
    }
  }
}
