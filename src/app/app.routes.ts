import { Routes } from '@angular/router';
import { accessGuard, loginGuard } from './core/access/access.guard';

const title = (name: string) => `IT2Pay · ${name}`;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: title('Ingreso'),
    canMatch: [loginGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'roles',
    title: title('Roles y accesos'),
    canMatch: [accessGuard],
    data: { view: 'ROLES' },
    loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent),
  },
  {
    path: 'inicio',
    canMatch: [accessGuard],
    data: { view: 'V01' },
    title: title('Inicio y escenarios'),
    loadComponent: () => import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'dashboard',
    canMatch: [accessGuard],
    data: { view: 'V02' },
    title: title('Dashboard ejecutivo'),
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'red',
    canMatch: [accessGuard],
    data: { view: 'V03' },
    title: title('Administración de red'),
    loadComponent: () => import('./features/red/red.component').then((m) => m.RedComponent),
  },
  {
    path: 'convenios',
    canMatch: [accessGuard],
    data: { view: 'V04' },
    title: title('Convenios y servicios'),
    loadComponent: () => import('./features/convenios/convenios.component').then((m) => m.ConveniosComponent),
  },
  {
    path: 'caja',
    pathMatch: 'full',
    canMatch: [accessGuard],
    data: { view: 'V05' },
    title: title('Terminal de caja'),
    loadComponent: () => import('./features/caja/caja.component').then((m) => m.CajaComponent),
  },
  {
    path: 'caja/resultado',
    canMatch: [accessGuard],
    data: { view: 'V06' },
    title: title('Resultado y comprobante'),
    loadComponent: () => import('./features/resultado/resultado.component').then((m) => m.ResultadoComponent),
  },
  {
    path: 'transacciones',
    canMatch: [accessGuard],
    data: { view: 'V07' },
    title: title('Consulta transaccional'),
    loadComponent: () =>
      import('./features/transacciones/transacciones.component').then((m) => m.TransaccionesComponent),
  },
  {
    path: 'cupos',
    canMatch: [accessGuard],
    data: { view: 'V08' },
    title: title('Cupos y riesgo'),
    loadComponent: () => import('./features/cupos/cupos.component').then((m) => m.CuposComponent),
  },
  {
    path: 'cierre',
    canMatch: [accessGuard],
    data: { view: 'V09' },
    title: title('Cierre de caja'),
    loadComponent: () => import('./features/cierre/cierre.component').then((m) => m.CierreComponent),
  },
  {
    path: 'conciliacion',
    canMatch: [accessGuard],
    data: { view: 'V10' },
    title: title('Conciliación'),
    loadComponent: () =>
      import('./features/conciliacion/conciliacion.component').then((m) => m.ConciliacionComponent),
  },
  {
    path: 'compensacion',
    canMatch: [accessGuard],
    data: { view: 'V11' },
    title: title('Compensación y efectivo'),
    loadComponent: () =>
      import('./features/compensacion/compensacion.component').then((m) => m.CompensacionComponent),
  },
  {
    path: 'finanzas',
    canMatch: [accessGuard],
    data: { view: 'V12' },
    title: title('Gestión financiera'),
    loadComponent: () => import('./features/finanzas/finanzas.component').then((m) => m.FinanzasComponent),
  },
  { path: '**', redirectTo: 'login' },
];
