import { Component, computed, input } from '@angular/core';
import { STATUS_LABELS } from '../core/simulation/format';
import { TxStatus } from '../core/simulation/model';

const COLORS: Record<TxStatus, string> = {
  PENDING: 'bg-primary-soft text-ink',
  APPROVED: 'bg-success-soft text-success',
  REJECTED: 'bg-error-soft text-error',
  PENDING_VERIFICATION: 'bg-warning-soft text-warning',
  VOIDED: 'bg-surface-alt text-muted',
  REVERSED: 'bg-surface-alt text-muted',
};

@Component({
  selector: 'app-status-badge',
  template: `<span
    [class]="'inline-block rounded px-2 py-0.5 text-xs font-semibold ' + color()"
    [attr.data-status]="status()"
    >{{ label() }}</span
  >`,
})
export class StatusBadgeComponent {
  readonly status = input.required<TxStatus>();
  readonly label = computed(() => STATUS_LABELS[this.status()]);
  readonly color = computed(() => COLORS[this.status()]);
}
