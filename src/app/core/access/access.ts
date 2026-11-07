import { AppUser, ProfileName, PROFILES } from '../simulation/model';

/**
 * Matriz de acceso por rol: fuente única del menú, la guarda de rutas, los botones de cada
 * vista y la vista «Roles y accesos». Deriva de los casos de uso de la Fase D re-ejecutada
 * (architecture/models/use-case-upgrade-it2pay.puml) y de las reglas RN-ACC-01 a RN-ACC-08.
 */

/** Las 12 vistas numeradas más «Roles y accesos», que no lleva código V. */
export type AccessView =
  | 'V01' | 'V02' | 'V03' | 'V04' | 'V05' | 'V06'
  | 'V07' | 'V08' | 'V09' | 'V10' | 'V11' | 'V12'
  | 'ROLES';

const ALL = PROFILES;
const IT2EX: ProfileName[] = ['Asesor de Ventas', 'Operador', 'Finanzas', 'Aprobador financiero', 'Administrador', 'Super Usuario'];

export const VIEW_ACCESS: Record<AccessView, readonly ProfileName[]> = {
  V01: ALL,
  V02: IT2EX,
  V03: ['Punto de Venta', 'Asesor de Ventas', 'Operador', 'Administrador', 'Super Usuario'],
  V04: ['Operador', 'Super Usuario'],
  V05: ['Colocador'],
  V06: ['Colocador', 'Punto de Venta', 'Operador'],
  V07: ['Colocador', 'Punto de Venta', 'Asesor de Ventas', 'Operador', 'Finanzas', 'Aprobador financiero'],
  V08: ['Punto de Venta', 'Asesor de Ventas', 'Operador', 'Finanzas'],
  V09: ['Colocador', 'Punto de Venta'],
  V10: ['Finanzas', 'Aprobador financiero'],
  V11: ['Finanzas', 'Aprobador financiero'],
  V12: ['Finanzas', 'Aprobador financiero'],
  ROLES: ['Administrador', 'Super Usuario'],
};

/** Acciones restringidas dentro de las vistas. */
export type AccessAction =
  | 'caja.operar'
  | 'tx.anular'
  | 'tx.reversar'
  | 'red.cadenas'
  | 'red.pdv'
  | 'red.activar'
  | 'red.cajas'
  | 'red.colocadores'
  | 'red.usuariosInternos'
  | 'convenios.editar'
  | 'cupos.editar'
  | 'cierre.cerrar'
  | 'conciliacion.operar'
  | 'compensacion.operar'
  | 'finanzas.generar'
  | 'finanzas.aprobar';

export const ACTION_ACCESS: Record<AccessAction, readonly ProfileName[]> = {
  'caja.operar': ['Colocador'],
  'tx.anular': ['Colocador'],
  'tx.reversar': ['Operador'],
  'red.cadenas': ['Asesor de Ventas'],
  'red.pdv': ['Asesor de Ventas'],
  'red.activar': ['Operador'],
  'red.cajas': ['Punto de Venta'],
  'red.colocadores': ['Punto de Venta'],
  'red.usuariosInternos': ['Administrador'],
  'convenios.editar': ['Super Usuario'],
  'cupos.editar': ['Operador'],
  'cierre.cerrar': ['Colocador'],
  'conciliacion.operar': ['Finanzas'],
  'compensacion.operar': ['Finanzas'],
  'finanzas.generar': ['Finanzas'],
  'finanzas.aprobar': ['Aprobador financiero'],
};

/** Qué hace cada rol en cada vista (texto de la matriz en «Roles y accesos»). */
export const VIEW_NOTES: Partial<Record<AccessView, Partial<Record<ProfileName, string>>>> = {
  V01: { Colocador: 'Abre su turno' },
  V03: {
    'Punto de Venta': 'Sus colocadores y cajas',
    'Asesor de Ventas': 'Crea cadenas, sucursales y PDV',
    Operador: 'Activa e inactiva PDV',
    Administrador: 'Usuarios internos',
    'Super Usuario': 'Consulta',
  },
  V04: { Operador: 'Consulta', 'Super Usuario': 'Parametriza' },
  V06: { Colocador: 'Comprobante y anulación', 'Punto de Venta': 'Confirma la anulación de depósitos', Operador: 'Reversa' },
  V07: { Colocador: 'Sus movimientos', 'Punto de Venta': 'Su PDV', Operador: 'Reversa' },
  V08: { 'Punto de Venta': 'Su cupo', Operador: 'Ajusta cupos' },
  V09: { Colocador: 'Cierra su turno', 'Punto de Venta': 'Arqueo de su PDV' },
  V10: { Finanzas: 'Concilia y propone', 'Aprobador financiero': 'Aprueba ajustes' },
  V11: { Finanzas: 'Registra consignaciones', 'Aprobador financiero': 'Consulta' },
  V12: { Finanzas: 'Liquida y genera la cuenta de cobro', 'Aprobador financiero': 'Aprueba' },
  ROLES: { Administrador: 'Consulta', 'Super Usuario': 'Consulta' },
};

export const canView = (role: ProfileName | null | undefined, view: AccessView): boolean =>
  !!role && VIEW_ACCESS[view].includes(role);

export const can = (role: ProfileName | null | undefined, action: AccessAction): boolean =>
  !!role && ACTION_ACCESS[action].includes(role);

/** Primera pantalla después del login: la caja si el Colocador retomó su turno; si no, Inicio. */
export const homeFor = (user: AppUser, hasShift: boolean): string =>
  user.profile === 'Colocador' && hasShift ? '/caja' : '/inicio';

/** Rol que sugiere la guía para una vista (el primero con acceso). */
export const roleFor = (view: AccessView): ProfileName => VIEW_ACCESS[view][0];

/** Alcance de los datos: el Colocador ve lo suyo y el Punto de Venta su PDV (RN-ACC-04). */
export type DataScope = { kind: 'all' } | { kind: 'pdv'; pdvId: string } | { kind: 'own'; userId: string };

export const scopeOf = (user: AppUser | null | undefined): DataScope =>
  user?.profile === 'Colocador'
    ? { kind: 'own', userId: user.id }
    : user?.profile === 'Punto de Venta' && user.pdvId
      ? { kind: 'pdv', pdvId: user.pdvId }
      : { kind: 'all' };
