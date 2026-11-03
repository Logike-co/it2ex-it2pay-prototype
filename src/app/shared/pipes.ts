import { Pipe, PipeTransform } from '@angular/core';
import {
  formatDateTime,
  formatMoney,
  formatPercent,
  formatSigned,
  formatTime,
  METHOD_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from '../core/simulation/format';
import { PaymentMethod, TransactionType, TxStatus } from '../core/simulation/model';

/** En pantalla, el signo y la cifra nunca se separan en dos líneas («$ 120.000»). */
const keepTogether = (text: string): string => text.replace(/ /g, '\u00a0');

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : keepTogether(formatMoney(value));
  }
}

@Pipe({ name: 'signed' })
export class SignedPipe implements PipeTransform {
  transform(value: number): string {
    return keepTogether(formatSigned(value));
  }
}

@Pipe({ name: 'pct' })
export class PercentPipe implements PipeTransform {
  transform(value: number | null): string {
    return formatPercent(value);
  }
}

@Pipe({ name: 'hora' })
export class TimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatTime(value);
  }
}

@Pipe({ name: 'fechaHora' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}

@Pipe({ name: 'estado' })
export class StatusLabelPipe implements PipeTransform {
  transform(value: TxStatus): string {
    return STATUS_LABELS[value];
  }
}

@Pipe({ name: 'tipo' })
export class TypeLabelPipe implements PipeTransform {
  transform(value: TransactionType): string {
    return TYPE_LABELS[value];
  }
}

@Pipe({ name: 'medio' })
export class MethodLabelPipe implements PipeTransform {
  transform(value: PaymentMethod): string {
    return METHOD_LABELS[value];
  }
}

export const SIM_PIPES = [
  MoneyPipe,
  SignedPipe,
  PercentPipe,
  TimePipe,
  DateTimePipe,
  StatusLabelPipe,
  TypeLabelPipe,
  MethodLabelPipe,
] as const;
