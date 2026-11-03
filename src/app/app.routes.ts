import { Routes } from '@angular/router';

const title = (name: string) => `IT2Pay · ${name}`;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'inicio',
    title: title('Inicio y escenarios'),
    loadComponent: () => import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'dashboard',
    title: title('Dashboard ejecutivo'),
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'red',
    title: title('Administración de red'),
    loadComponent: () => import('./features/red/red.component').then((m) => m.RedComponent),
  },
  {
    path: 'convenios',
    title: title('Convenios y servicios'),
    loadComponent: () => import('./features/convenios/convenios.component').then((m) => m.ConveniosComponent),
  },
  {
    path: 'caja',
    title: title('Terminal de caja'),
    loadComponent: () => import('./features/caja/caja.component').then((m) => m.CajaComponent),
  },
  {
    path: 'caja/resultado',
    title: title('Resultado y comprobante'),
    loadComponent: () => import('./features/resultado/resultado.component').then((m) => m.ResultadoComponent),
  },
  {
    path: 'transacciones',
    title: title('Consulta transaccional'),
    loadComponent: () =>
      import('./features/transacciones/transacciones.component').then((m) => m.TransaccionesComponent),
  },
  {
    path: 'cupos',
    title: title('Cupos y riesgo'),
    loadComponent: () => import('./features/cupos/cupos.component').then((m) => m.CuposComponent),
  },
  {
    path: 'cierre',
    title: title('Cierre de caja'),
    loadComponent: () => import('./features/cierre/cierre.component').then((m) => m.CierreComponent),
  },
  {
    path: 'conciliacion',
    title: title('Conciliación'),
    loadComponent: () =>
      import('./features/conciliacion/conciliacion.component').then((m) => m.ConciliacionComponent),
  },
  {
    path: 'compensacion',
    title: title('Compensación y efectivo'),
    loadComponent: () =>
      import('./features/compensacion/compensacion.component').then((m) => m.CompensacionComponent),
  },
  {
    path: 'finanzas',
    title: title('Gestión financiera'),
    loadComponent: () => import('./features/finanzas/finanzas.component').then((m) => m.FinanzasComponent),
  },
  { path: '**', redirectTo: 'inicio' },
];
