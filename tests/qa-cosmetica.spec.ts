import { expect, Page, test } from '@playwright/test';
import { ingresarComo, irA, limpio } from './sesion';

/**
 * Regresión visual: contraste del menú, contenido que cabe en su tarjeta con la guía
 * abierta y comprobante centrado al imprimir.
 */

/**
 * Las 12 vistas y «Roles y accesos», cada una con un perfil que la tiene (D-T4).
 * V06 se recorre con el Colocador después de su recaudo.
 */
const TOUR: { user: string; routes: string[] }[] = [
  { user: 'COL-S01', routes: ['inicio', 'caja', 'caja/resultado', 'cierre'] },
  { user: 'OPE-S01', routes: ['dashboard', 'transacciones', 'cupos'] },
  { user: 'ASE-S01', routes: ['red'] },
  { user: 'SU-S01', routes: ['convenios'] },
  { user: 'FIN-S01', routes: ['conciliacion', 'compensacion', 'finanzas'] },
  { user: 'ADM-S01', routes: ['roles'] },
];

const tour = async (page: Page, check: (label: string) => Promise<void>) => {
  for (const t of TOUR) {
    await ingresarComo(page, t.user);
    for (const r of t.routes) {
      await irA(page, r);
      await page.waitForTimeout(150);
      await check(`${t.user} /${r}`);
    }
  }
};

const fresh = async (page: Page) => {
  await limpio(page);
};

const loginAndPay = async (page: Page) => {
  await ingresarComo(page, 'COL-S01');
  await expect(page).toHaveURL(/\/caja$/);
  await page.getByTestId('buscar-servicio').fill('ENEL');
  await page.keyboard.press('Enter');
  await page.getByTestId('ref-0').fill('4500112100');
  await page.keyboard.press('Enter');
  await page.getByTestId('btn-continuar-2').click();
  await page.getByTestId('efectivo-recibido').fill('100000');
  await page.getByTestId('btn-autorizar').click();
  await expect(page.getByTestId('resultado-estado')).toBeVisible();
};

/** Problemas de maquetación visibles: scroll horizontal, tarjetas desbordadas, texto fuera del botón. */
const layoutProblems = (page: Page) =>
  page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) problems.push(`scroll horizontal ${root.scrollWidth}`);
    for (const card of Array.from(document.querySelectorAll<HTMLElement>('main .card'))) {
      if (card.offsetParent && card.scrollWidth > card.clientWidth + 2) {
        problems.push(`tarjeta desbordada: ${card.textContent?.trim().slice(0, 40)}`);
      }
    }
    for (const b of Array.from(document.querySelectorAll<HTMLElement>('main .btn'))) {
      if (!b.offsetParent) continue;
      const r = b.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(b);
      const t = range.getBoundingClientRect();
      if (t.right > r.right + 1 || t.left < r.left - 1) problems.push(`texto fuera del botón: ${b.textContent?.trim()}`);
    }
    return problems;
  });

test.beforeEach(async ({ page }) => {
  await fresh(page);
});

test('el ítem activo del menú conserva el contraste con el mouse encima', async ({ page }) => {
  await ingresarComo(page, 'OPE-S01');
  await page.getByTestId('btn-menu').click();
  const active = page.getByTestId('nav-V01');
  await active.hover();
  const [bg, fg] = await active.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.backgroundColor, s.color];
  });
  expect(fg).toBe('rgb(255, 255, 255)');
  // Sigue en el azul institucional (#0E4495), no en el fondo de hover de los ítems inactivos.
  expect(bg).toBe('rgb(14, 68, 149)');
});

test('con la guía abierta a 1280 px, ninguna vista se desborda', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAndPay(page);
  await page.getByTestId('btn-guia-demo').click();
  await tour(page, async (label) => {
    expect(await layoutProblems(page), label).toEqual([]);
  });
});

test('el botón «Registrar consignación» contiene su texto', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ingresarComo(page, 'FIN-S01');
  await page.getByTestId('btn-guia-demo').click();
  await irA(page, 'compensacion');
  const box = await page.getByTestId('btn-consignar').evaluate((b) => {
    const range = document.createRange();
    range.selectNodeContents(b);
    return { button: b.getBoundingClientRect().right, text: range.getBoundingClientRect().right };
  });
  expect(box.text).toBeLessThanOrEqual(box.button);
});

test('al imprimir, el comprobante sale centrado', async ({ page }) => {
  await loginAndPay(page);
  await page.emulateMedia({ media: 'print' });
  const { left, right } = await page.getByTestId('comprobante').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: document.documentElement.clientWidth - r.right };
  });
  expect(Math.abs(left - right)).toBeLessThan(40);
});

test('ningún código (CJ-S1-01, COL-S02, T-S1-01…) se parte en dos líneas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAndPay(page);
  await page.getByTestId('btn-guia-demo').click();
  await tour(page, async (label) => {
    const broken = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.parentElement?.offsetParent) continue;
        for (const m of (n.textContent ?? '').matchAll(/\b[A-Z]{1,5}(?:-[A-Z0-9]+)+\b/g)) {
          const range = document.createRange();
          range.setStart(n, m.index ?? 0);
          range.setEnd(n, (m.index ?? 0) + m[0].length);
          if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) found.push(m[0]);
        }
      }
      return found;
    });
    expect(broken, label).toEqual([]);
  });
});
