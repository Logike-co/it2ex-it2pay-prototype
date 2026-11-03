/**
 * Reloj inyectable (FM-19): en la demo, el reloj del navegador; en pruebas,
 * un reloj fijo para que los resultados sean reproducibles.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

const pad = (n: number, size = 2): string => String(n).padStart(size, '0');

/** Fecha local `AAAA-MM-DD`. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Hora fija `HH:MM` del día de `base`, en hora local. */
export const atTime = (base: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
};
