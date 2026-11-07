import { Component, input, signal } from '@angular/core';
import { AccessView, VIEW_ACCESS, VIEW_NOTES } from '../../core/access/access';
import { ProfileName, PROFILES } from '../../core/simulation/model';
import { VIEWS } from '../../views';

interface RoleInfo {
  role: ProfileName;
  org: 'Punto de venta' | 'IT2EX';
  portal: string;
  does: string;
}

/** Catálogo de roles (glosario §1.2 de la Fase D re-ejecutada, D-ACT-01 a D-ACT-04). */
export const ROLE_INFO: RoleInfo[] = [
  { role: 'Colocador', org: 'Punto de venta', portal: 'Transaccional', does: 'Opera el recaudo en el PDV (cajero): consulta, cobra, autoriza, emite el comprobante, anula en su turno y cierra su caja.' },
  { role: 'Punto de Venta', org: 'Punto de venta', portal: 'Administrativo', does: 'Se crea con su PDV y solo ve su PDV: crea cajas y colocadores, confirma la anulación de depósitos y consulta cupo, transacciones y arqueo.' },
  { role: 'Asesor de Ventas', org: 'IT2EX', portal: 'Administrativo', does: 'Crea cadenas, sucursales y puntos de venta; consulta ventas y la actividad de la red.' },
  { role: 'Operador', org: 'IT2EX', portal: 'Administrativo', does: 'Monitorea la operación, ajusta cupos, activa e inactiva PDV y es el único que reversa una transacción.' },
  { role: 'Finanzas', org: 'IT2EX', portal: 'Módulos financieros', does: 'Concilia, propone ajustes, liquida comisiones, genera la cuenta de cobro y registra consignaciones.' },
  { role: 'Aprobador financiero', org: 'IT2EX', portal: 'Módulos financieros', does: 'Aprueba lo que genera Finanzas: ajustes de conciliación, liquidaciones y cuentas de cobro. Nadie aprueba lo que generó.' },
  { role: 'Administrador', org: 'IT2EX', portal: 'Administrativo', does: 'Crea los usuarios internos y asigna sus roles; consulta la auditoría.' },
  { role: 'Super Usuario', org: 'IT2EX', portal: 'Administrativo', does: 'Parametriza el sistema: convenios, servicios, habilitaciones y comisiones.' },
];

const DIAGRAMS = [
  { id: 'pdv', label: 'Punto de venta', src: 'roles/casos-de-uso-1-punto-de-venta.svg' },
  { id: 'operacion', label: 'Operación de IT2EX', src: 'roles/casos-de-uso-2-operacion-it2ex.svg' },
  { id: 'financiero', label: 'Módulos financieros', src: 'roles/casos-de-uso-3-financiero.svg' },
];

/**
 * «Roles y accesos» (D-T4): tabla de roles, matriz rol × vista generada desde `access.ts`
 * (nunca diverge del comportamiento) y diagramas de casos de uso. Solo consulta: la
 * administración granular de roles (B11) sigue fuera del demo (P3).
 */
@Component({
  selector: 'app-roles',
  template: `
    @if (!embedded()) {
      <h1 class="page-title mb-1">Roles y accesos</h1>
      <p class="mb-4 text-sm text-muted">Qué hace cada perfil de IT2Pay y a qué opciones accede. Solo consulta.</p>
    }

    <section class="card mb-4" data-testid="tabla-roles">
      <h2 class="card-title">Perfiles</h2>
      <div class="overflow-x-auto"><table class="table">
        <thead><tr><th>Perfil</th><th>Organización</th><th>Portal</th><th>Qué hace</th></tr></thead>
        <tbody>
          @for (r of roles; track r.role) {
            <tr [attr.data-testid]="'rol-' + r.role">
              <td class="font-semibold whitespace-nowrap">{{ r.role }}</td><td>{{ r.org }}</td><td>{{ r.portal }}</td><td class="text-sm">{{ r.does }}</td>
            </tr>
          }
        </tbody>
      </table></div>
    </section>

    <section class="card mb-4" data-testid="matriz-accesos">
      <h2 class="card-title">Matriz de accesos</h2>
      <div class="overflow-x-auto"><table class="table text-xs">
        <thead>
          <tr>
            <th>Vista</th>
            @for (p of profiles; track p) {
              <th class="text-center">{{ p }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (v of views; track v.id) {
            <tr [attr.data-testid]="'matriz-' + v.id">
              <td class="whitespace-nowrap"><span class="font-mono text-muted">{{ v.code }}</span> {{ v.name }}</td>
              @for (p of profiles; track p) {
                <td class="text-center" [attr.data-testid]="'celda-' + v.id + '-' + p">
                  @if (has(v.id, p)) {
                    <span class="font-semibold text-success" aria-label="Con acceso">✓</span>
                    @if (note(v.id, p); as n) {
                      <span class="block text-[11px] text-muted">{{ n }}</span>
                    }
                  } @else {
                    <span class="text-muted" aria-label="Sin acceso">—</span>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table></div>
    </section>

    <section class="card" data-testid="diagramas-casos-uso">
      <h2 class="card-title">Casos de uso</h2>
      <div class="mb-3 flex flex-wrap gap-2" role="tablist">
        @for (d of diagrams; track d.id) {
          <button
            type="button"
            role="tab"
            class="btn"
            [class.btn-primary]="tab() === d.id"
            [attr.aria-selected]="tab() === d.id"
            [attr.data-testid]="'tab-' + d.id"
            (click)="tab.set(d.id)"
          >{{ d.label }}</button>
        }
      </div>
      @for (d of diagrams; track d.id) {
        @if (tab() === d.id) {
          <div class="overflow-x-auto rounded border border-line bg-white p-2">
            <img [src]="d.src" [alt]="'Diagrama de casos de uso: ' + d.label" class="mx-auto max-w-none" [attr.data-testid]="'diagrama-' + d.id" />
          </div>
        }
      }
    </section>
  `,
})
export class RolesComponent {
  /** true cuando se muestra dentro de la guía de demo (sin título de página). */
  readonly embedded = input(false);

  readonly roles = ROLE_INFO;
  readonly profiles = PROFILES;
  readonly diagrams = DIAGRAMS;
  readonly tab = signal(DIAGRAMS[0].id);
  readonly views: { id: AccessView; code: string; name: string }[] = [
    ...VIEWS.map((v) => ({ id: v.id as AccessView, code: v.id, name: v.name })),
    { id: 'ROLES', code: '', name: 'Roles y accesos' },
  ];

  has(view: AccessView, role: ProfileName): boolean {
    return VIEW_ACCESS[view].includes(role);
  }

  note(view: AccessView, role: ProfileName): string {
    return VIEW_NOTES[view]?.[role] ?? '';
  }
}
