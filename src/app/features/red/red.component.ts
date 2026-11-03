import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Simulator } from '../../core/simulation/engine';
import { DeviceType, ProfileName, Result } from '../../core/simulation/model';
import { branchName, cashiersOfRegister, chainName, pdvName } from '../../core/simulation/selectors';
import { SimulatorStore } from '../../core/state/simulator.store';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { TraceBadgeComponent } from '../../shared/trace-badge.component';
import { CodeTextComponent } from '../../shared/code-text.component';

/** V03 — Administración de red (B01–B04). */
@Component({
  selector: 'app-red',
  imports: [CodeTextComponent, TraceBadgeComponent, FormsModule, EmptyStateComponent],
  templateUrl: './red.component.html',
})
export class RedComponent {
  private readonly store = inject(SimulatorStore);
  readonly state = this.store.state;

  readonly profiles: ProfileName[] = ['Cajero', 'Supervisor', 'Administrador', 'Analista financiero'];
  readonly deviceTypes: DeviceType[] = ['Terminal web', 'Datáfono simulado', 'Impresora de tirilla simulada'];

  newChain = '';
  editingChain = signal<string | null>(null);
  editName = '';
  branchChain = '';
  newBranch = '';
  pdvBranch = '';
  newPdv = '';
  registerPdv = '';
  userName = '';
  userProfile: ProfileName = 'Cajero';
  userRegister = '';
  assignUser = '';
  assignRegister = '';
  deviceRegister = '';
  deviceType: DeviceType = 'Terminal web';
  deviceSerial = '';

  readonly suggestedSerial = computed(() => new Simulator(this.state(), { now: () => new Date() }).suggestedSerial());

  private exec<T>(cmd: (sim: Simulator) => Result<T>): boolean {
    return this.store.exec(cmd).ok;
  }

  createChain(): void {
    if (this.exec((sim) => sim.createChain(this.newChain))) {
      this.newChain = '';
    }
  }

  startEdit(id: string, name: string): void {
    this.editingChain.set(id);
    this.editName = name;
  }

  saveChain(id: string): void {
    if (this.exec((sim) => sim.updateChain(id, { name: this.editName }))) {
      this.editingChain.set(null);
    }
  }

  toggleChain(id: string, active: boolean): void {
    this.exec((sim) => sim.updateChain(id, { active }));
  }

  toggle(kind: 'branch' | 'pdv', id: string, active: boolean): void {
    this.exec((sim) => sim.setActive(kind, id, active));
  }

  createBranch(): void {
    if (this.exec((sim) => sim.createBranch(this.branchChain, this.newBranch))) {
      this.newBranch = '';
    }
  }

  createPdv(): void {
    if (this.exec((sim) => sim.createPdv(this.pdvBranch, this.newPdv))) {
      this.newPdv = '';
    }
  }

  createRegister(): void {
    this.exec((sim) => sim.createRegister(this.registerPdv));
  }

  createUser(): void {
    const regs = this.userRegister ? [this.userRegister] : [];
    if (this.exec((sim) => sim.createUser(this.userName, this.userProfile, regs))) {
      this.userName = '';
    }
  }

  assign(): void {
    this.exec((sim) => sim.assignUser(this.assignUser, this.assignRegister));
  }

  createDevice(): void {
    if (this.exec((sim) => sim.createDevice(this.deviceRegister, this.deviceType, this.deviceSerial))) {
      this.deviceSerial = '';
    }
  }

  chainOf(id: string): string {
    return chainName(this.state(), id);
  }

  branchOf(id: string): string {
    return branchName(this.state(), id);
  }

  pdvOf(id: string): string {
    return pdvName(this.state(), id);
  }

  cashiers(registerId: string): string {
    return cashiersOfRegister(this.state(), registerId)
      .map((u) => u.id)
      .join(', ') || '—';
  }

  devices(registerId: string): string {
    return this.state().devices.filter((d) => d.registerId === registerId).map((d) => d.id).join(', ') || '—';
  }
}
