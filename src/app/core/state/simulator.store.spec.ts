import { TestBed } from '@angular/core/testing';
import { FixedClock } from '../simulation/clock';
import { indicators } from '../simulation/selectors';
import { conciliation } from '../simulation/selectors';
import { SIM_CLOCK, SIM_LATENCY, SimulatorStore, toneOf } from './simulator.store';

const DEMO_DAY = new Date(2026, 9, 25, 10, 0, 0);

const createStore = (): SimulatorStore => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SIM_CLOCK, useValue: new FixedClock(DEMO_DAY) },
      { provide: SIM_LATENCY, useValue: { authorization: 0, timeout: 0, consult: 0 } },
    ],
  });
  return TestBed.inject(SimulatorStore);
};

describe('SimulatorStore (persistencia y reinicio, R-18 / FM-24)', () => {
  beforeEach(() => localStorage.clear());

  it('arranca con la semilla de Supermercados', () => {
    const store = createStore();
    expect(store.activeScenario()).toBe('SUP');
    expect(store.state().transactions).toHaveLength(10);
    expect(indicators(store.state()).income).toBe(612_700);
  });

  it('persiste cada escenario por separado en el navegador', () => {
    const store = createStore();
    store.run((sim) => sim.createBranch('CAD-S1', 'Sucursal Demo Nueva'));
    const again = createStore();
    expect(again.state().branches.some((b) => b.id === 'SUC-S4')).toBe(true);
    again.selectScenario('PAR');
    expect(again.state().branches.some((b) => b.id === 'SUC-P4')).toBe(false);
  });

  it('E04: reiniciar el escenario restaura la semilla y no toca el otro escenario', () => {
    const store = createStore();
    store.selectScenario('PAR');
    store.run((sim) => sim.createChain('Parqueo Express Demo'));
    store.selectScenario('SUP');
    store.run((sim) => sim.createBranch('CAD-S1', 'Sucursal Demo Nueva'));
    store.run((sim) => sim.createPdv('SUC-S4', 'Punto de servicios Nuevo'));
    store.run((sim) => sim.login('CJ-S1-01', 'COL-S01'));
    const tx = store.run((sim) =>
      sim.authorize({ serviceId: 'SRV-01', references: ['4500112100'], value: 98_700, method: 'efectivo', cashReceived: 100_000 })
    );
    expect(tx.ok && tx.value.id).toBe('TX-S-0011');

    store.resetScenario();
    const s = store.state();
    expect(s.transactions.some((t) => t.id === 'TX-S-0011')).toBe(false);
    expect(s.pdvs.some((p) => p.id === 'PDV-S4')).toBe(false);
    expect(indicators(s).income).toBe(612_700);
    expect(conciliation(s).open).toBe(2);
    expect(s.counters.TX).toBe(11);
    expect(s.session.registerId).toBeNull();
    store.selectScenario('PAR');
    expect(store.state().chains.some((c) => c.id === 'CAD-P3')).toBe(true);

    store.resetAll();
    expect(store.state().chains.some((c) => c.id === 'CAD-P3')).toBe(false);
  });

  it('exec publica el error del motor en la barra de avisos', () => {
    const store = createStore();
    const r = store.exec((sim) => sim.createChain('  '));
    expect(r.ok).toBe(false);
    expect(store.flash()).toEqual({ kind: 'error', text: 'El nombre es obligatorio' });
  });

  it('descarta un estado persistido de otra versión del esquema', () => {
    const store = createStore();
    const stale = { ...store.state(), schemaVersion: 1, transactions: [] };
    localStorage.setItem('it2pay-simulador:v1:SUP', JSON.stringify(stale));
    expect(createStore().state().transactions).toHaveLength(10);
  });

  it('exec colorea como alerta o error un desenlace negativo que el motor devuelve como ok', () => {
    expect([toneOf('APPROVED'), toneOf('PENDING_VERIFICATION'), toneOf('REJECTED')]).toEqual(['ok', 'warning', 'error']);
    const store = createStore();
    store.exec(() => ({ ok: true, value: 'REJECTED' as const, message: 'Rechazada definitiva: no se reintenta' }), toneOf);
    expect(store.flash()).toEqual({ kind: 'error', text: 'Rechazada definitiva: no se reintenta' });
  });

  it('ignora un estado persistido corrupto y vuelve a la semilla', () => {
    localStorage.setItem('it2pay-simulador:v1:SUP', '{no es json');
    const store = createStore();
    expect(store.state().transactions).toHaveLength(10);
  });
});
