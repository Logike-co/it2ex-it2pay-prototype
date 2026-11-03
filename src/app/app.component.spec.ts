import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { VIEWS } from './views';

describe('AppComponent (shell)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('muestra la banda fija de simulación, la marca IT2Pay y las 12 vistas', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="banda-simulacion"]')?.textContent?.trim()).toBe(
      'SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL'
    );
    expect(el.querySelector('[data-testid="logotipo"]')?.textContent).toContain('IT2Pay');
    expect(el.querySelectorAll('[data-testid^="nav-V"]')).toHaveLength(12);
  });

  it('cada vista tiene una ruta registrada', () => {
    const paths = routes.map((r) => r.path);
    for (const v of VIEWS) {
      expect(paths).toContain(v.path);
    }
  });
});
