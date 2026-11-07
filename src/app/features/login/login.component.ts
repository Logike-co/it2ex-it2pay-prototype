import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { homeFor } from '../../core/access/access';
import { PROFILES } from '../../core/simulation/model';
import { SimulatorStore } from '../../core/state/simulator.store';

/** Contraseña demo: se llena sola al elegir el usuario y no se valida (exclusión §9 del alcance). */
export const DEMO_PASSWORD = 'demo-it2pay';

/**
 * Login simulado (D-T4): lista de usuarios precargados del escenario activo, agrupados por rol.
 * Al elegir uno, la contraseña se llena sola; el usuario solo verá las opciones de su rol.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="mx-auto mt-8 max-w-md">
      <form class="card" data-testid="form-login" (ngSubmit)="signIn()">
        <div class="mb-4 flex flex-col items-center gap-2">
          <img src="brand/it2pay-logo.png" alt="IT2Pay" class="h-10 w-auto" width="205" height="40" />
          <h1 class="page-title text-center">Ingreso a IT2Pay</h1>
          <p class="text-center text-sm text-muted">
            {{ scenarioName() }} · usuarios ficticios de demostración
          </p>
        </div>
        <label class="mb-3 block">
          <span class="label">Usuario</span>
          <select
            class="input"
            name="usuario"
            data-testid="login-usuario"
            [ngModel]="userId"
            (ngModelChange)="pick($event)"
          >
            <option value="">— Elija un usuario —</option>
            @for (g of groups(); track g.role) {
              <optgroup [label]="g.role">
                @for (u of g.users; track u.id) {
                  <option [value]="u.id">{{ u.name }} — {{ u.profile }} ({{ u.id }})</option>
                }
              </optgroup>
            }
          </select>
        </label>
        <label class="mb-4 block">
          <span class="label">Contraseña</span>
          <input
            class="input"
            type="password"
            name="clave"
            autocomplete="off"
            data-testid="login-clave"
            [ngModel]="password"
            readonly
          />
        </label>
        <button type="submit" class="btn btn-primary w-full" data-testid="btn-ingresar" [disabled]="!userId">Ingresar</button>
        <p class="mt-3 text-center text-xs text-muted">
          Simulación: la contraseña se llena sola y no se valida. El escenario se cambia desde la guía de demo.
        </p>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private readonly store = inject(SimulatorStore);
  private readonly router = inject(Router);

  userId = '';
  password = '';

  readonly scenarioName = computed(() => this.store.state().name);

  readonly groups = computed(() => {
    const users = this.store.state().users.filter((u) => u.active);
    return PROFILES.map((role) => ({ role, users: users.filter((u) => u.profile === role) })).filter(
      (g) => g.users.length
    );
  });

  pick(id: string): void {
    this.userId = id;
    this.password = id ? DEMO_PASSWORD : '';
  }

  signIn(): void {
    const r = this.store.exec((sim) => sim.signIn(this.userId));
    if (r.ok) {
      this.router.navigateByUrl(homeFor(r.value, !!this.store.state().session.shiftId));
    }
  }
}
