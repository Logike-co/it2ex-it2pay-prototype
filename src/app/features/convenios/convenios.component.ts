import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CATEGORIES, describeReferences, SUBCATEGORY_SUGGESTIONS } from '../../core/simulation/catalog';
import { BUSINESS_LINES, BusinessLine, OperationType } from '../../core/simulation/model';
import { chainName, chainOfPdv, commissionFor, isServiceEnabledForPdv } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { IllustrativeComponent } from '../../shared/legend.component';
import { SIM_PIPES } from '../../shared/pipes';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';

/** V04 — Convenios y servicios (B05, B06, B07). */
@Component({
  selector: 'app-convenios',
  imports: [TraceBadgeComponent, FormsModule, IllustrativeComponent, ...SIM_PIPES],
  templateUrl: './convenios.component.html',
})
export class ConveniosComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;
  /** D-T4: solo el rol con «convenios.editar» opera; los demás consultan. */
  readonly editable = computed(() => this.store.can('convenios.editar'));
  readonly categories = CATEGORIES;
  readonly subcategories = SUBCATEGORY_SUGGESTIONS;
  readonly lines = BUSINESS_LINES;
  readonly describeReferences = describeReferences;
  readonly opTypes: { value: OperationType; label: string; line: BusinessLine }[] = [
    { value: 'recaudo', label: 'Recaudo', line: 'Recaudos' },
    { value: 'recarga', label: 'Recarga', line: 'Recargas' },
    { value: 'deposito', label: 'Depósito', line: 'Corresponsalía' },
    { value: 'retiro', label: 'Retiro', line: 'Corresponsalía' },
  ];

  // Formulario de servicio nuevo (B05).
  name = '';
  categoryCode = 2;
  subcategory = '';
  opType: OperationType = 'recaudo';
  referenceName = '';
  referenceLength = 8;
  allowsPartial = false;
  minPartial = 50_000;
  allowsLate = true;
  rangeMin = 1_000;
  rangeMax = 200_000;

  // Habilitación (B06) y comisión (B07).
  readonly enableServiceId = signal('SRV-06');
  comServiceId = 'SRV-01';
  comChainId = '';
  comChain = 400;
  comIt2ex = 200;

  readonly enableService = computed(() => this.state().services.find((s) => s.id === this.enableServiceId()) ?? null);

  general(serviceId: string): string {
    const c = this.state().commissions.find((x) => x.serviceId === serviceId && x.chainId === null);
    return c ? `${c.chainValue} / ${c.it2exValue}` : '400 / 200';
  }

  chainRule(serviceId: string, chainId: string): boolean {
    return !!this.state().enablements.find(
      (e) => e.serviceId === serviceId && e.level === 'cadena' && e.targetId === chainId && e.enabled
    );
  }

  pdvRule(serviceId: string, pdvId: string): string {
    const r = this.state().enablements.find((e) => e.serviceId === serviceId && e.level === 'pdv' && e.targetId === pdvId);
    return r ? (r.enabled ? 'si' : 'no') : 'hereda';
  }

  effective(serviceId: string, pdvId: string): boolean {
    return isServiceEnabledForPdv(this.state(), serviceId, pdvId);
  }

  chainOf(pdvId: string): string {
    return chainName(this.state(), chainOfPdv(this.state(), pdvId));
  }

  chainLabel(id: string | null): string {
    return id ? chainName(this.state(), id) : 'General del servicio';
  }

  setChainRule(serviceId: string, chainId: string, enabled: boolean): void {
    this.store.exec((sim) => sim.setEnablement(serviceId, 'cadena', chainId, enabled));
  }

  setPdvRule(serviceId: string, pdvId: string, value: string): void {
    const enabled = value === 'hereda' ? null : value === 'si';
    this.store.exec((sim) => sim.setEnablement(serviceId, 'pdv', pdvId, enabled));
  }

  toggleService(id: string, active: boolean): void {
    this.store.exec((sim) => sim.setServiceActive(id, active));
  }

  createService(): void {
    const cat = CATEGORIES.find((c) => c.code === Number(this.categoryCode));
    const op = this.opTypes.find((o) => o.value === this.opType);
    const r = this.store.exec((sim) =>
      sim.createService({
        name: this.name,
        categoryCode: Number(this.categoryCode),
        category: cat?.name ?? '',
        subcategory: this.subcategory,
        operationType: this.opType,
        line: op?.line ?? 'Recaudos',
        referenceName: this.referenceName,
        referenceLength: Number(this.referenceLength),
        allowsPartial: this.allowsPartial,
        minPartial: this.allowsPartial ? Number(this.minPartial) : null,
        allowsLate: this.allowsLate,
        range: { min: Number(this.rangeMin), max: Number(this.rangeMax) },
      })
    );
    if (r.ok) {
      this.name = '';
      this.referenceName = '';
    }
  }

  currentCommission(): string {
    const chainId = this.comChainId;
    if (!chainId) {
      return this.general(this.comServiceId);
    }
    const c = commissionFor(this.state(), this.comServiceId, chainId);
    return `${c.chainValue} / ${c.it2exValue}`;
  }

  saveCommission(): void {
    this.store.exec((sim) =>
      sim.setCommission(this.comServiceId, this.comChainId || null, Number(this.comChain), Number(this.comIt2ex))
    );
  }

  serviceLabel(id: string): string {
    return this.state().services.find((s) => s.id === id)?.name ?? id;
  }
}
