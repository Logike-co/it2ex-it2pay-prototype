import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { VIEWS } from './views';
import { SimulatorStore } from './core/state/simulator.store';
import { AccessView, VIEW_ACCESS } from './core/access/access';

describe('AppComponent (shell)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('muestra la banda fija de simulación y la marca IT2Pay; sin sesión no hay menú', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="banda-simulacion"]')?.textContent?.trim()).toBe(
      'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL'
    );
    expect(el.querySelector('[data-testid="logotipo"]')?.textContent).toContain('IT2Pay');
    expect(el.querySelector('[data-testid="menu"]')).toBeNull();
    expect(el.querySelector('[data-testid="btn-menu"]')).toBeNull();
  });

  it('con sesión, el menú muestra solo las vistas del perfil y arranca oculto (D-T4)', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const store = TestBed.inject(SimulatorStore);
    store.run((sim) => sim.signIn('OPE-S01'));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const expected = (Object.keys(VIEW_ACCESS) as AccessView[]).filter((v) => VIEW_ACCESS[v].includes('Operador'));
    const shown = [...el.querySelectorAll('[data-testid^="nav-"]')].map((a) => a.getAttribute('data-testid')!.slice(4));
    expect(shown).toEqual(expected);
    expect(el.querySelector('[data-testid="menu"]')?.classList).toContain('hidden');
    expect(el.querySelector('[data-testid="btn-menu"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-testid="rol-sesion"]')?.textContent).toBe('Operador');
  });

  it('la barra superior no tiene controles de demo: viven en la guía', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const bar = el.querySelector('[data-testid="barra-superior"]') as HTMLElement;
    expect(bar.querySelector('[data-testid="logo-img"]')?.getAttribute('src')).toBe('brand/it2pay-logo.png');
    for (const id of ['selector-escenario', 'btn-trazabilidad', 'btn-presentador', 'btn-reiniciar', 'btn-reiniciar-todo']) {
      expect(el.querySelector(`[data-testid="${id}"]`)).toBeNull();
    }

    (bar.querySelector('[data-testid="btn-guia-demo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const guide = el.querySelector('[data-testid="guia-demo"]') as HTMLElement;
    for (const id of ['selector-escenario', 'btn-trazabilidad', 'btn-presentador', 'btn-reiniciar', 'btn-reiniciar-todo']) {
      expect(guide.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
  });

  it('el botón de reinicio de la guía abre el diálogo del shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.demo.hudOpen.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="btn-reiniciar-todo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="dialogo-reinicio"]')?.textContent).toContain('Reiniciar los dos escenarios');
  });

  it('cada vista tiene una ruta registrada', () => {
    const paths = routes.map((r) => r.path);
    for (const v of VIEWS) {
      expect(paths).toContain(v.path);
    }
  });
});
