import { expect, Page, test } from '@playwright/test';

/**
 * Regresión visual: contraste del menú, contenido que cabe en su tarjeta con la guía
 * abierta y comprobante centrado al imprimir.
 */

const VIEWS = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08', 'V09', 'V10', 'V11', 'V12'];

const fresh = async (page: Page) => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
};

const loginAndPay = async (page: Page) => {
  await page.getByTestId('sel-cadena').selectOption('CAD-S1');
  await page.getByTestId('sel-sucursal').selectOption('SUC-S1');
  await page.getByTestId('sel-caja').selectOption('CJ-S1-01');
  await page.getByTestId('sel-usuario').selectOption('CAJ-S01');
  await page.getByTestId('btn-ingresar').click();
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
  const active = page.getByTestId('nav-V01');
  await active.hover();
  const [bg, fg] = await active.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.backgroundColor, s.color];
  });
  expect(fg).toBe('rgb(255, 255, 255)');
  expect(bg).not.toBe('rgb(241, 245, 249)');
});

test('con la guía abierta a 1280 px, ninguna vista se desborda', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAndPay(page);
  await page.getByTestId('btn-guia-demo').click();
  for (const v of VIEWS) {
    await page.getByTestId(`nav-${v}`).click();
    await page.waitForTimeout(150);
    expect(await layoutProblems(page), v).toEqual([]);
  }
});

test('el botón «Registrar consignación» contiene su texto', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('btn-guia-demo').click();
  await page.getByTestId('nav-V11').click();
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

test('ningún código (CJ-S1-01, CAJ-S02, T-S1-01…) se parte en dos líneas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAndPay(page);
  await page.getByTestId('btn-guia-demo').click();
  for (const v of VIEWS) {
    await page.getByTestId(`nav-${v}`).click();
    await page.waitForTimeout(150);
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
    expect(broken, v).toEqual([]);
  }
});
