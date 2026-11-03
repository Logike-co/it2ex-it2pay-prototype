import { PaymentMethod, TransactionType, TxStatus } from './model';

const groupThousands = (n: number): string =>
  String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** `$ 145.200` — pesos colombianos, punto de miles y sin decimales. */
export const formatMoney = (n: number): string =>
  `${n < 0 ? '−' : ''}$ ${groupThousands(n)}`;

/** Diferencia con signo explícito: `+5.000`, `−10.000`, `0`. */
export const formatSigned = (n: number): string =>
  n === 0 ? '0' : `${n > 0 ? '+' : '−'}${groupThousands(n)}`;

/** `87,5 %` — una cifra decimal y coma decimal. */
export const formatPercent = (ratio: number | null): string => {
  if (ratio === null || Number.isNaN(ratio)) {
    return '—';
  }
  return `${(Math.round(ratio * 1000) / 10).toFixed(1).replace('.', ',')} %`;
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${d.getFullYear()}`;
  return `${date} ${formatTime(iso)}`;
};

/** Etiquetas en pantalla de los estados (flow-map §3.1, FM-04). */
export const STATUS_LABELS: Record<TxStatus, string> = {
  PENDING: 'Enviando…',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PENDING_VERIFICATION: 'En verificación',
  VOIDED: 'Anulada',
  REVERSED: 'Reversada',
};

/** Etiqueta corta para la traza («Enviando 08:15 → Aprobada 08:15»). */
export const TRACE_LABELS: Record<TxStatus, string> = {
  ...STATUS_LABELS,
  PENDING: 'Enviando',
};

export const TYPE_LABELS: Record<TransactionType, string> = {
  recaudo: 'Recaudo',
  recarga: 'Recarga',
  deposito: 'Depósito',
  retiro: 'Retiro',
  reverso: 'Reverso',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta débito',
  credito: 'Tarjeta crédito',
  transferencia: 'Transferencia (billetera o llave, ficticia)',
  qr: 'QR (ficticio)',
};

export const maskAccount = (account: string): string =>
  `••••${account.slice(-4)}`;

export const pad = (n: number, size: number): string =>
  String(n).padStart(size, '0');
