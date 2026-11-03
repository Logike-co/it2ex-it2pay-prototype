import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { FixedClock } from '../core/simulation/clock';
import { indicators } from '../core/simulation/selectors';
import { SIM_CLOCK, SIM_LATENCY, SimulatorStore } from '../core/state/simulator.store';
import { VIEWS } from '../views';
import { DemoModeStore, viewOfUrl } from './demo-mode.store';
import { PRESETS } from './demo-script';
import { ITEMS, itemsTrace, rfOf, VIEW_BDD, viewTrace } from './traceability';

const DEMO_DAY = new Date(2026, 9, 25, 10, 0, 0);

const setup = (): { demo: DemoModeStore; sim: SimulatorStore } => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: SIM_CLOCK, useValue: new FixedClock(DEMO_DAY) },
      { provide: SIM_LATENCY, useValue: { authorization: 0, timeout: 0, consult: 0 } },
    ],
  });
  return { demo: TestBed.inject(DemoModeStore), sim: TestBed.inject(SimulatorStore) };
};

describe('Trazabilidad en pantalla (X04, flow-map §10)', () => {
  it('cubre las 12 vistas con al menos un ítem y un escenario BDD', () => {
    for (const v of VIEWS) {
      const t = viewTrace(v.id);
      expect(t.items.length).toBeGreaterThan(0);
      expect(t.bdd.length).toBeGreaterThan(0);
    }
  });

  it('lleva los 37 ítems P1 + P2 de la matriz de alcance, cada uno en una vista y con escenario BDD', () => {
    const items = Object.values(ITEMS);
    expect(items).toHaveLength(37);
    expect(items.filter((i) => i.level === 'P1')).toHaveLength(29);
    const views = new Set(VIEWS.map((v) => v.id));
    for (const i of items) {
      expect(views.has(i.view)).toBe(true);
      expect(i.bdd.length).toBeGreaterThan(0);
    }
  });

  it('cuenta los 59 escenarios BDD del flow-map', () => {
    expect(Object.values(VIEW_BDD).flat()).toHaveLength(59);
  });

  it('asigna a cada historia su requerimiento (PRD §2.3) y marca los ítems «solo demo»', () => {
    expect(rfOf('US-09')).toBe('RF-09');
    expect(itemsTrace(['F04']).rf).toEqual(['RF-09', 'RF-30']);
    const soloDemo = Object.values(ITEMS)
      .filter((i) => i.us.length === 0)
      .map((i) => i.id);
    expect(soloDemo).toEqual(['F06', 'F07', 'F08', 'C02', 'C03', 'C07', 'C08']);
    expect(viewTrace('V09').us).toEqual([]);
  });
});

describe('Guiones de la demo (X01, X03)', () => {
  it('cada paso apunta a una vista existente, con su ruta y con ítems de la matriz', () => {
    for (const preset of PRESETS) {
      expect(preset.steps.length).toBeGreaterThan(0);
      preset.steps.forEach((s, i) => {
        expect(s.n).toBe(i + 1);
        const view = VIEWS.find((v) => v.path === s.route);
        expect(view?.id).toBe(s.view);
        for (const item of s.items) {
          expect(ITEMS[item]).toBeDefined();
        }
        expect(s.actions.length).toBeGreaterThan(0);
        expect(s.expect.length).toBeGreaterThan(0);
        expect(s.say).not.toBe('');
      });
    }
  });

  it('ofrece los presets ESC-01..03', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['ESC-01', 'ESC-02', 'ESC-03']);
  });

  it('resuelve la vista de una URL', () => {
    expect(viewOfUrl('/caja')).toBe('V05');
    expect(viewOfUrl('/caja/resultado?tx=TX-S-0001')).toBe('V06');
    expect(viewOfUrl('/inicio')).toBe('V01');
    expect(viewOfUrl('/no-existe')).toBeNull();
  });
});

describe('DemoModeStore (presets y reinicio en 1 clic, X02)', () => {
  beforeEach(() => localStorage.clear());

  it('ESC-03 reinicia Supermercados y deja la próxima autorización en «Rechazar»', () => {
    const { demo, sim } = setup();
    sim.run((s) => s.createBranch('CAD-S1', 'Sucursal Demo Nueva'));
    demo.applyPreset('ESC-03');
    expect(sim.activeScenario()).toBe('SUP');
    expect(sim.state().branches.some((b) => b.id === 'SUC-S4')).toBe(false);
    expect(sim.state().presenter.nextAuthorization).toBe('rechazar');
    expect(demo.hudOpen()).toBe(true);
    expect(demo.stepIndex()).toBe(0);
  });

  it('ESC-02 activa Parqueaderos reiniciado', () => {
    const { demo, sim } = setup();
    demo.applyPreset('ESC-02');
    expect(sim.activeScenario()).toBe('PAR');
    expect(sim.state().presenter.nextAuthorization).toBe('gatillo');
    expect(demo.step().view).toBe('V01');
  });

  it('el reinicio en 1 clic restaura la semilla, vuelve al primer paso y conserva el panel del preset', () => {
    const { demo, sim } = setup();
    demo.applyPreset('ESC-03');
    demo.next();
    sim.run((s) => s.createBranch('CAD-S1', 'Sucursal Demo Nueva'));
    sim.run((s) => s.setPresenter({ nextAuthorization: 'gatillo', idempotency: false }));
    demo.quickReset();
    expect(sim.state().transactions).toHaveLength(10);
    expect(indicators(sim.state()).income).toBe(612_700);
    expect(sim.state().presenter.nextAuthorization).toBe('rechazar');
    expect(sim.state().presenter.idempotency).toBe(true);
    expect(demo.stepIndex()).toBe(0);
  });

  it('el reinicio en 1 clic vuelve al escenario del preset aunque se haya cambiado el selector', () => {
    const { demo, sim } = setup();
    demo.applyPreset('ESC-02');
    sim.selectScenario('SUP');
    demo.quickReset();
    expect(sim.activeScenario()).toBe('PAR');
    expect(demo.step().title).toBe('Ingresar a la caja del aeropuerto');
  });

  it('navega entre pasos sin salirse del guion', () => {
    const { demo } = setup();
    demo.applyPreset('ESC-01');
    demo.previous();
    expect(demo.stepIndex()).toBe(0);
    demo.goTo(99);
    expect(demo.stepIndex()).toBe(7);
    expect(demo.step().title).toBe('Resultados');
  });

  it('recuerda la guía y la trazabilidad de quien presenta', () => {
    const { demo } = setup();
    demo.toggleTrace();
    demo.toggleHud();
    const again = setup().demo;
    expect(again.showTrace()).toBe(true);
    expect(again.hudOpen()).toBe(true);
  });
});
