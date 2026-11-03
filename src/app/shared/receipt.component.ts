import { Component, computed, inject, input } from '@angular/core';
import { Transaction } from '../core/simulation/model';
import { branchName, chainName, serviceName } from '../core/simulation/selectors';
import { SimulatorStore } from '../core/state/simulator.store';
import { SIM_PIPES } from './pipes';

/** Comprobante DEMO (§7): título, marca de agua y leyenda arriba y abajo. */
@Component({
  selector: 'app-receipt',
  imports: [...SIM_PIPES],
  templateUrl: './receipt.component.html',
})
export class ReceiptComponent {
  private readonly store = inject(SimulatorStore);
  readonly tx = input.required<Transaction>();

  readonly chain = computed(() => chainName(this.store.state(), this.tx().chainId));
  readonly branch = computed(() => branchName(this.store.state(), this.tx().branchId));
  readonly service = computed(() => serviceName(this.store.state(), this.tx().serviceId));
}
