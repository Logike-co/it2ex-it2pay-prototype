import { formatMoney, formatPercent, formatSigned, maskAccount } from './format';

describe('Formatos de pantalla (§ convenciones del flow-map)', () => {
  it('montos en pesos con punto de miles y sin decimales', () => {
    expect(formatMoney(145_200)).toBe('$ 145.200');
    expect(formatMoney(3_862_700)).toBe('$ 3.862.700');
    expect(formatMoney(0)).toBe('$ 0');
    expect(formatMoney(-8_700)).toBe('−$ 8.700');
  });

  it('diferencias con signo', () => {
    expect(formatSigned(-10_000)).toBe('−10.000');
    expect(formatSigned(5_000)).toBe('+5.000');
    expect(formatSigned(0)).toBe('0');
  });

  it('porcentajes con coma decimal', () => {
    expect(formatPercent(7 / 8)).toBe('87,5 %');
    expect(formatPercent(8 / 9)).toBe('88,9 %');
    expect(formatPercent(7 / 9)).toBe('77,8 %');
    expect(formatPercent(11 / 12)).toBe('91,7 %');
    expect(formatPercent(null)).toBe('—');
  });

  it('enmascara cuentas', () => {
    expect(maskAccount('1100556677')).toBe('••••6677');
  });
});
