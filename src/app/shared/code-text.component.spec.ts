import { splitCodes } from './code-text.component';

describe('splitCodes (códigos que no se parten entre líneas)', () => {
  it('marca como código cada identificador del simulador y deja el resto como texto', () => {
    expect(splitCodes('Mercado Central Demo · PDV-S1 · CJ-S1-01')).toEqual([
      { text: 'Mercado Central Demo · ', code: false },
      { text: 'PDV-S1', code: true },
      { text: ' · ', code: false },
      { text: 'CJ-S1-01', code: true },
    ]);
    expect(splitCodes('Abierta (T-S1-01)').filter((p) => p.code).map((p) => p.text)).toEqual(['T-S1-01']);
    expect(splitCodes('DSP-S1-01, DSP-S1-02').filter((p) => p.code)).toHaveLength(2);
  });

  it('deja intacto un texto sin códigos', () => {
    expect(splitCodes('Todas las cajas')).toEqual([{ text: 'Todas las cajas', code: false }]);
    expect(splitCodes('')).toEqual([]);
  });
});
