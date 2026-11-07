import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { SimulatorStore } from '../state/simulator.store';
import { AccessView, homeFor } from './access';

/**
 * Guarda de las vistas: sin login lleva a /login; con un perfil sin acceso lleva a su inicio
 * con un aviso. Las opciones vedadas no aparecen en el menú (D-T4).
 */
export const accessGuard: CanMatchFn = (route) => {
  const store = inject(SimulatorStore);
  const router = inject(Router);
  const user = store.currentUser();
  if (!user) {
    return router.parseUrl('/login');
  }
  const view = route.data?.['view'] as AccessView | undefined;
  if (!view || store.canView(view)) {
    return true;
  }
  store.flash.set({ kind: 'warning', text: `Su perfil (${user.profile}) no tiene acceso a esa opción` });
  return router.parseUrl(homeFor(user, !!store.state().session.shiftId));
};

/** La pantalla de login solo se ve sin sesión. */
export const loginGuard: CanMatchFn = () => {
  const store = inject(SimulatorStore);
  const user = store.currentUser();
  return user ? inject(Router).parseUrl(homeFor(user, !!store.state().session.shiftId)) : true;
};
