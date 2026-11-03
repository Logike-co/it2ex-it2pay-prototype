import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { STATUS_LABELS, TRACE_LABELS, TYPE_LABELS } from '../../core/simulation/format';
import { TransactionType, TxStatus } from '../../core/simulation/model';
import { branchName, chainName, isCurrent, serviceName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { SIM_PIPES } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TxActionsComponent } from '../../shared/tx-actions.component';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V07 — Consulta transaccional (F13, C01). */
@Component({
  selector: 'app-transacciones',
  imports: [TraceBadgeComponent, FormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent, TxActionsComponent, ...SIM_PIPES],
  templateUrl: './transacciones.component.html',
})
export class TransaccionesComponent {
  private readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  /** Query params enlazados por el router. */
  readonly tx = input<string | undefined>();
  readonly estado = input<string | undefined>();

  readonly statusOptions = Object.entries(STATUS_LABELS) as [TxStatus, string][];
  readonly typeOptions = Object.entries(TYPE_LABELS) as [TransactionType, string][];
  readonly traceLabels = TRACE_LABELS;

  readonly fStatus = signal<string>('');
  readonly fType = signal<string>('');
  readonly fChain = signal<string>('');
  readonly fRegister = signal<string>('');
  readonly fText = signal<string>('');
  readonly selectedId = signal<string | null>(null);
  readonly grouping = signal<'caja' | 'sucursal'>('caja');

  readonly state = this.store.state;

  constructor() {
    effect(() => {
      const e = this.estado();
      if (e) {
        this.fStatus.set(e);
      }
    });
    effect(() => {
      const id = this.tx();
      if (id) {
        this.selectedId.set(id);
      }
    });
  }

  readonly rows = computed(() => {
    const s = this.state();
    const text = this.fText().trim().toLowerCase();
    return [...s.transactions]
      .filter((t) => !this.fStatus() || t.status === this.fStatus())
      .filter((t) => !this.fType() || t.type === this.fType())
      .filter((t) => !this.fChain() || t.chainId === this.fChain())
      .filter((t) => !this.fRegister() || t.registerId === this.fRegister())
      .filter(
        (t) =>
          !text ||
          t.id.toLowerCase().includes(text) ||
          t.referenceDisplay.toLowerCase().includes(text) ||
          serviceName(s, t.serviceId).toLowerCase().includes(text)
      )
      .sort((a, b) => b.id.localeCompare(a.id));
  });

  readonly selected = computed(
    () => this.state().transactions.find((t) => t.id === this.selectedId()) ?? null
  );

  readonly groups = computed(() => {
    const s = this.state();
    const current = s.transactions.filter(isCurrent);
    if (this.grouping() === 'caja') {
      return s.registers.map((r) => {
        const txs = current.filter((t) => t.registerId === r.id);
        return { key: r.id, label: `${r.id} · ${r.pdvId}`, count: txs.length, total: txs.reduce((a, t) => a + t.value, 0) };
      });
    }
    return s.branches.map((b) => {
      const txs = current.filter((t) => t.branchId === b.id);
      return {
        key: b.id,
        label: `${b.name} (${chainName(s, b.chainId)})`,
        count: txs.length,
        total: txs.reduce((a, t) => a + t.value, 0),
      };
    });
  });

  serviceOf(id: string | null): string {
    return serviceName(this.state(), id);
  }

  chainOf(id: string): string {
    return chainName(this.state(), id);
  }

  branchOf(id: string): string {
    return branchName(this.state(), id);
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  clearFilters(): void {
    this.fStatus.set('');
    this.fType.set('');
    this.fChain.set('');
    this.fRegister.set('');
    this.fText.set('');
  }

  openResult(id: string): void {
    this.router.navigate(['/caja/resultado'], { queryParams: { tx: id } });
  }
}
