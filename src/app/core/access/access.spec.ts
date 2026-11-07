import { PROFILES } from '../simulation/model';
import { VIEWS } from '../../views';
import { ACTION_ACCESS, can, canView, homeFor, scopeOf, VIEW_ACCESS } from './access';

describe('Matriz de acceso (D-T4)', () => {
  it('cubre las 12 vistas y «Roles y accesos»; cada vista tiene al menos un perfil y cada perfil al menos una vista', () => {
    expect(Object.keys(VIEW_ACCESS).sort()).toEqual([...VIEWS.map((v) => v.id), 'ROLES'].sort());
    for (const roles of Object.values(VIEW_ACCESS)) {
      expect(roles.length).toBeGreaterThan(0);
    }
    for (const p of PROFILES) {
      expect(Object.values(VIEW_ACCESS).filter((r) => r.includes(p)).length).toBeGreaterThan(0);
    }
  });

  it('aplica las reglas RN-ACC: caja del Colocador, reversa del Operador y segregación en finanzas', () => {
    expect(VIEW_ACCESS.V05).toEqual(['Colocador']);
    expect(ACTION_ACCESS['tx.reversar']).toEqual(['Operador']);
    expect(ACTION_ACCESS['finanzas.generar']).toEqual(['Finanzas']);
    expect(ACTION_ACCESS['finanzas.aprobar']).toEqual(['Aprobador financiero']);
    expect(can('Finanzas', 'finanzas.aprobar')).toBe(false);
    expect(canView('Colocador', 'V02')).toBe(false);
    expect(canView(null, 'V01')).toBe(false);
  });

  it('toda acción restringida es de un perfil que ve alguna vista donde se ejecuta', () => {
    for (const roles of Object.values(ACTION_ACCESS)) {
      for (const r of roles) {
        expect(Object.values(VIEW_ACCESS).some((v) => v.includes(r))).toBe(true);
      }
    }
  });

  it('lleva al Colocador con turno a la caja y acota los datos por perfil', () => {
    const col = { id: 'COL-S01', name: 'C', profile: 'Colocador' as const, registerIds: [], active: true, pdvId: 'PDV-S1' };
    expect(homeFor(col, true)).toBe('/caja');
    expect(homeFor(col, false)).toBe('/inicio');
    expect(scopeOf(col)).toEqual({ kind: 'own', userId: 'COL-S01' });
    expect(scopeOf({ ...col, profile: 'Punto de Venta' })).toEqual({ kind: 'pdv', pdvId: 'PDV-S1' });
    expect(scopeOf({ ...col, profile: 'Operador', pdvId: null })).toEqual({ kind: 'all' });
  });
});
