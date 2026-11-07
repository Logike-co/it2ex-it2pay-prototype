import { Locator, Page } from '@playwright/test';

/**
 * Los controles de la demo (escenario, presets, panel del presentador, trazabilidad y
 * reinicios) viven dentro de la guía de demo. Este ayudante abre la guía si está cerrada
 * y devuelve el control pedido.
 */
export const enGuia = async (page: Page, testId: string): Promise<Locator> => {
  if (!(await page.getByTestId('guia-demo').isVisible())) {
    await page.getByTestId('btn-guia-demo').click();
  }
  return page.getByTestId(testId);
};
