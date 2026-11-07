import { expect, test } from '@playwright/test';

/**
 * Identidad visual de IT2Pay (marca del portal transaccional) y encabezado limpio:
 * la barra superior solo lleva ☰, el logo, la sesión y el botón de la guía; todos los
 * controles de la demo viven dentro de la guía.
 */
const DEMO_CONTROLS = [
  'selector-escenario',
  'btn-trazabilidad',
  'btn-presentador',
  'btn-reiniciar',
  'btn-reiniciar-todo',
  'panel-presentador',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/inicio');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('la barra superior está limpia: sin controles de demo fuera de la guía', async ({ page }) => {
  const bar = page.getByTestId('barra-superior');
  await expect(bar).toBeVisible();
  await expect(bar.getByTestId('btn-menu')).toBeVisible();
  await expect(bar.getByTestId('logotipo')).toBeVisible();
  await expect(bar.getByTestId('sesion-encabezado')).toBeVisible();
  await expect(bar.getByTestId('btn-guia-demo')).toBeVisible();
  await expect(bar.locator('button, select, input')).toHaveCount(2);

  for (const id of DEMO_CONTROLS) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }

  await page.getByTestId('btn-guia-demo').click();
  const guide = page.getByTestId('guia-demo');
  for (const id of DEMO_CONTROLS.filter((x) => x !== 'panel-presentador')) {
    await expect(guide.getByTestId(id)).toBeVisible();
  }
  await guide.getByTestId('btn-presentador').click();
  await expect(guide.getByTestId('panel-presentador')).toBeVisible();
});

test('el botón ☰ oculta y muestra el menú de vistas', async ({ page }) => {
  const menuBtn = page.getByTestId('btn-menu');
  await expect(page.getByTestId('menu')).toBeVisible();
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

  await menuBtn.click();
  await expect(page.getByTestId('menu')).toBeHidden();
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

  await menuBtn.click();
  await expect(page.getByTestId('menu')).toBeVisible();
  // En escritorio el menú sigue abierto después de elegir una vista.
  await page.getByTestId('nav-V02').click();
  await expect(page.getByTestId('menu')).toBeVisible();
});

test('el logo de IT2Pay carga y la marca usa el azul institucional y Nunito', async ({ page }) => {
  const logo = page.getByTestId('logo-img');
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  const [titleColor, font] = await page.locator('h1.page-title').evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.fontFamily];
  });
  expect(titleColor).toBe('rgb(14, 68, 149)');
  expect(font).toContain('Nunito');
  // La fuente autoalojada se descarga de verdad (funciona sin red: viene en el build).
  expect(await page.evaluate(async () => (await document.fonts.load('16px Nunito')).length)).toBeGreaterThan(0);
});
