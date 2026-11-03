import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `<div
    data-testid="estado-vacio"
    class="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center"
  >
    <p class="font-medium text-ink">{{ title() }}</p>
    @if (detail()) {
      <p class="mt-1 text-sm text-muted">{{ detail() }}</p>
    }
    <div class="mt-3"><ng-content /></div>
  </div>`,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly detail = input<string>('');
}
