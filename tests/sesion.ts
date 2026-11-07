import { expect, Page } from '@playwright/test';
import { enGuia } from './guia';

/**
 * Sesión por rol (D-T4). El demo se recorre con usuarios ficticios: cada perfil ve solo sus
 * opciones. Estos ayudantes entran por la pantalla de login, como en la aplicación real.
 */

/** Arranca limpio (sin estado guardado) en la pantalla de login, opcionalmente en Parqueaderos. */
export const limpio = async (page: Page, scenario: 'SUP' | 'PAR' = 'SUP'): Promise<void> => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('form-login')).toBeVisible();
  if (scenario === 'PAR') {
    await (await enGuia(page, 'selector-escenario')).selectOption('PAR');
    await page.getByTestId('guia-cerrar').click();
  }
};

/**
 * Entra como `userId` (cierra antes la sesión actual). La contraseña se llena sola.
 * Con `ruta`, navega después a esa ruta (el perfil debe tenerla).
 */
export const ingresarComo = async (page: Page, userId: string, ruta?: string): Promise<void> => {
  const salir = page.getByTestId('btn-cerrar-sesion');
  if (await salir.isVisible()) {
    await salir.click();
  }
  if (!/\/login/.test(page.url())) {
    await page.goto('/login');
  }
  await page.getByTestId('login-usuario').selectOption(userId);
  await expect(page.getByTestId('login-clave')).not.toHaveValue('');
  await page.getByTestId('btn-ingresar').click();
  await expect(page.getByTestId('usuario-sesion')).toContainText(userId);
  if (ruta) {
    await irA(page, ruta);
  }
};

/** Navega por el menú del perfil (abre ☰ si está oculto) o, si la ruta no está en el menú, por URL. */
export const irA = async (page: Page, ruta: string): Promise<void> => {
  const path = ruta.replace(/^\//, '');
  const link = page.locator(`[data-testid="menu"] a[href="/${path}"]`);
  if ((await link.count()) === 0) {
    await page.goto('/' + path);
    return;
  }
  // El menú se oculta al cambiar de usuario (también tras cambiar de escenario): se reabre
  // hasta que el enlace esté visible, para no competir con ese cierre.
  await expect(async () => {
    if (!(await page.getByTestId('menu').isVisible())) {
      await page.getByTestId('btn-menu').click();
    }
    await expect(link).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/${path.replace('/', '\\/')}(\\?|$)`));
};

/** El Colocador abre turno (o retoma el abierto) en una de sus cajas y llega a la terminal. */
export const abrirTurno = async (page: Page, caja: string, base?: number): Promise<void> => {
  await irA(page, 'inicio');
  await page.getByTestId('sel-caja').selectOption(caja);
  if (base !== undefined && (await page.getByTestId('base-turno').isVisible())) {
    await page.getByTestId('base-turno').fill(String(base));
  }
  await page.getByTestId('btn-abrir-turno').click();
  await expect(page).toHaveURL(/\/caja$/);
};
