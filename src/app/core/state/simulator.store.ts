import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Clock, SystemClock } from '../simulation/clock';
import { Simulator } from '../simulation/engine';
import { AccessAction, AccessView, can, canView } from '../access/access';
import { AppUser, Result, ScenarioId, ScenarioState, SCHEMA_VERSION, TxStatus } from '../simulation/model';
import { buildSeed } from '../simulation/seed';

/** Reloj de la demo (FM-19). Las pruebas lo sustituyen por un `FixedClock`. */
export const SIM_CLOCK = new InjectionToken<Clock>('SIM_CLOCK', {
  providedIn: 'root',
  factory: () => new SystemClock(),
});

/** Latencias simuladas (FM-05): autorización, timeout y consulta. */
export interface SimLatency {
  authorization: number;
  timeout: number;
  consult: number;
}

export const SIM_LATENCY = new InjectionToken<SimLatency>('SIM_LATENCY', {
  providedIn: 'root',
  factory: () => ({ authorization: 800, timeout: 2000, consult: 500 }),
});

const STORAGE_PREFIX = 'it2pay-simulador:v1:';
const ACTIVE_KEY = `${STORAGE_PREFIX}escenario-activo`;

export type Tone = 'ok' | 'warning' | 'error';

export interface Flash {
  kind: Tone;
  text: string;
}

/**
 * Color del desenlace de una consulta, reintento o reverso: solo lo aprobado es
 * positivo; lo que sigue en verificación es alerta y lo rechazado es error.
 */
export const toneOf = (status: TxStatus): Tone =>
  status === 'REJECTED' ? 'error' : status === 'PENDING_VERIFICATION' ? 'warning' : 'ok';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Almacén único por escenario (Regla de oro del prototipo: estado en
 * `signal()`), persistido en el navegador por escenario (FM-24).
 */
@Injectable({ providedIn: 'root' })
export class SimulatorStore {
  private readonly clock = inject(SIM_CLOCK);
  readonly latency = inject(SIM_LATENCY);

  readonly activeScenario = signal<ScenarioId>(this.loadActive());
  private readonly states = {
    SUP: signal<ScenarioState>(this.loadOrSeed('SUP')),
    PAR: signal<ScenarioState>(this.loadOrSeed('PAR')),
  };

  readonly state = computed(() => this.states[this.activeScenario()]());

  /** Usuario autenticado en el escenario activo (null = pantalla de login). */
  readonly currentUser = computed<AppUser | null>(() => {
    const s = this.state();
    return s.users.find((u) => u.id === s.auth.userId) ?? null;
  });
  readonly role = computed(() => this.currentUser()?.profile ?? null);

  can(action: AccessAction): boolean {
    return can(this.role(), action);
  }

  canView(view: AccessView): boolean {
    return canView(this.role(), view);
  }

  /** Estado de cualquier escenario (solo lectura), p. ej. para las tarjetas de V01. */
  stateOf(id: ScenarioId): ScenarioState {
    return this.states[id]();
  }
  readonly flash = signal<Flash | null>(null);
  readonly presenterOpen = signal(false);

  /** Ejecuta un comando del motor sobre una copia y guarda el resultado. */
  run<T>(command: (sim: Simulator) => T): T {
    const sim = new Simulator(clone(this.state()), this.clock);
    const result = command(sim);
    this.commit(sim.state);
    return result;
  }

  /**
   * Igual que `run`, pero publica el mensaje del resultado en la barra de avisos.
   * `tone` permite marcar como alerta o error un desenlace negativo que el motor devuelve como `ok`.
   */
  exec<T>(command: (sim: Simulator) => Result<T>, tone?: (value: T) => Tone): Result<T> {
    const result = this.run(command);
    this.flash.set(
      result.ok
        ? result.message
          ? { kind: tone ? tone(result.value) : 'ok', text: result.message }
          : null
        : { kind: 'error', text: result.error }
    );
    return result;
  }

  selectScenario(id: ScenarioId): void {
    this.activeScenario.set(id);
    this.flash.set(null);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // El almacenamiento puede no estar disponible: la demo sigue en memoria.
    }
  }

  /** «Reiniciar escenario» (R-18): restaura exactamente §6.9 en el escenario activo. */
  resetScenario(id: ScenarioId = this.activeScenario()): void {
    this.commit(this.reseed(id), id);
    this.flash.set({ kind: 'ok', text: `Escenario reiniciado: datos iniciales de demostración restaurados` });
  }

  /** «Reiniciar todo»: restaura los dos escenarios. */
  resetAll(): void {
    this.commit(this.reseed('SUP'), 'SUP');
    this.commit(this.reseed('PAR'), 'PAR');
    this.flash.set({ kind: 'ok', text: 'Los dos escenarios fueron reiniciados' });
  }

  /** Semilla del escenario; el usuario autenticado sigue con su sesión si existe en la semilla. */
  private reseed(id: ScenarioId): ScenarioState {
    const seed = buildSeed(id, this.clock);
    const userId = this.states[id]().auth.userId;
    if (userId && seed.users.some((u) => u.id === userId)) {
      const sim = new Simulator(seed, this.clock);
      sim.signIn(userId);
      return sim.state;
    }
    return seed;
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private commit(next: ScenarioState, id: ScenarioId = next.id): void {
    this.states[id].set(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(next));
    } catch {
      // Sin almacenamiento local: el estado vive solo en memoria.
    }
  }

  private loadOrSeed(id: ScenarioId): ScenarioState {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw) as ScenarioState;
        if (parsed.schemaVersion === SCHEMA_VERSION && parsed.id === id) {
          return parsed;
        }
      }
    } catch {
      // Estado corrupto o almacenamiento bloqueado: se usa la semilla.
    }
    return buildSeed(id, this.clock);
  }

  private loadActive(): ScenarioId {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      return raw === 'PAR' ? 'PAR' : 'SUP';
    } catch {
      return 'SUP';
    }
  }
}
