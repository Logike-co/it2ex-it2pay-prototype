/**
 * Guiones de la demo (workflow T §1.4-1 y §1.4-3, ítems X01 y X03).
 *
 * Fuente: `prototype/demo-guide.md` (guion paso a paso) y `prototype/flow-map.md` §11 (presets
 * ESC-01..03) de la iniciativa `upgrade-it2pay`. Los valores esperados son los del flow-map §6.7 y §6.8.
 */
import { AuthOverride, ScenarioId } from '../core/simulation/model';

export type PresetId = 'ESC-01' | 'ESC-02' | 'ESC-03';

export interface DemoStep {
  /** Número del paso dentro del guion. */
  n: number;
  title: string;
  /** Vista donde arranca el paso. */
  view: string;
  /** Ruta de la vista (sin «/»). */
  route: string;
  /** Ítems de la matriz de alcance que demuestra el paso. */
  items: string[];
  /** Acción física del presentador: clics y datos exactos. */
  actions: string[];
  /** Narrativa sugerida para los asistentes. */
  say: string;
  /** Resultado observable que se verifica en pantalla. */
  expect: string[];
}

export interface DemoPreset {
  id: PresetId;
  name: string;
  /** Datos del escenario que se reinician al aplicar el preset. */
  scenario: ScenarioId;
  /** Desenlace de la próxima autorización que se fija en el panel del presentador. */
  nextAuthorization: AuthOverride;
  summary: string;
  steps: DemoStep[];
}

const ESC_01: DemoPreset = {
  id: 'ESC-01',
  name: 'Camino feliz',
  scenario: 'SUP',
  nextAuthorization: 'gatillo',
  summary: 'Recorrido principal en Supermercados: red, caja, comprobante, cierre, conciliación, compensación, comisiones y dashboard.',
  steps: [
    {
      n: 1,
      title: 'Elegir escenario',
      view: 'V01',
      route: 'inicio',
      items: ['F01'],
      actions: ['Verifica que el selector de escenario esté en Supermercados.'],
      say: 'IT2Pay opera redes de cadenas, sucursales, puntos de venta y cajas; aquí vemos una red de supermercados.',
      expect: ['Cobertura: 2 cadenas, 3 sucursales, 3 PDV, 4 cajas, 11 servicios.', 'La banda de simulación está visible.'],
    },
    {
      n: 2,
      title: 'Configurar la red',
      view: 'V03',
      route: 'red',
      items: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09'],
      actions: [
        'V03 · Mercado Central Demo: crea «Sucursal Demo Nueva» (SUC-S4), el PDV «Punto de servicios Demo Nuevo» (PDV-S4) y su caja (CJ-S4-01).',
        'Crea el usuario «Cajero Demo 05», perfil Cajero, caja CJ-S4-01 → Crear y asignar (CAJ-S05). Registra un dispositivo.',
        'V04: muestra el catálogo propuesto y habilita «Universidad Demo del Norte» para PDV-S4. Muestra la comisión 400 / 200 sin editarla.',
        'V08: para PDV-S4 define Recaudos $ 2.000.000, Recargas $ 500.000 y Corresponsalía $ 1.000.000.',
      ],
      say: 'La red y los cupos se administran desde la plataforma, por punto de venta y línea de negocio.',
      expect: ['En V04, la habilitación efectiva de PDV-S4 dice «Sí».', 'En V01, la cobertura pasa a 4 PDV y 5 cajas.'],
    },
    {
      n: 3,
      title: 'Recaudar una factura',
      view: 'V01',
      route: 'inicio',
      items: ['F02', 'F03', 'F04', 'F05', 'F09', 'F11', 'F12'],
      actions: [
        'En V01 elige Mercado Central Demo → Sucursal Demo Nueva → CJ-S4-01, usuario Cajero Demo 05, base 100000 → Ingresar.',
        'Solo con teclado: F2, «ENEL», Enter; referencia 4500112100, Enter; Enter; efectivo 100000; F12.',
        'F8 abre la impresión del comprobante; cancélala para seguir.',
      ],
      say: 'El cajero recauda una factura en segundos, solo con teclado, y entrega un comprobante.',
      expect: [
        'Al ingresar, efectivo esperado $ 100.000.',
        'Valor $ 98.700, titular Titular Demo 2100, cambio $ 1.300.',
        '«Enviando…» y luego resultado Aprobada, autorización AUT-S-100011.',
        'Comprobante «IT2Pay · COMPROBANTE DEMO» con marca de agua DEMO, la leyenda arriba y abajo y «Autorizador: Reval (simulado)».',
      ],
    },
    {
      n: 4,
      title: 'Recarga',
      view: 'V05',
      route: 'caja',
      items: ['F06'],
      actions: ['F1, F2, «MóvilUno», Enter; número 3001112233 → valor $ 20.000 → efectivo 20000 → F12.'],
      say: 'La misma caja vende recargas de los operadores habilitados.',
      expect: ['Resultado Aprobada, transacción TX-S-0012.'],
    },
    {
      n: 5,
      title: 'Corresponsalía: depósito',
      view: 'V05',
      route: 'caja',
      items: ['F07', 'F08'],
      actions: [
        'Elige «Depósito Banco Demo Uno»; cuenta Ahorros 1100556677 → valor 200000 → efectivo 200000 → F12.',
        'Opcional: muestra el retiro con OTP ficticio sin autorizarlo.',
      ],
      say: 'El punto de venta también opera como corresponsal bancario.',
      expect: ['Resultado Aprobada, transacción TX-S-0013, cuenta enmascarada ••••6677.'],
    },
    {
      n: 6,
      title: 'Cierre de caja',
      view: 'V09',
      route: 'cierre',
      items: ['C02', 'C03'],
      actions: ['Caja CJ-S4-01: declara 410000 → Confirmar cierre.'],
      say: 'El cierre compara lo esperado con lo declarado y registra la diferencia. La caja queda cerrada hasta abrir un nuevo turno.',
      expect: ['Efectivo esperado $ 418.700.', 'Cierre CIE-S-001, diferencia −8.700, clasificación Faltante.'],
    },
    {
      n: 7,
      title: 'Conciliar y compensar',
      view: 'V10',
      route: 'conciliacion',
      items: ['C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C11'],
      actions: [
        'V10: Ejecutar conciliación; en TX-S-0010 Consultar estado; en TX-S-0006 nota «Ajuste ilustrativo de valor» → Registrar ajuste.',
        'V11: consignación de PDV-S4, línea Recaudos, 98700 → Registrar consignación (CON-S-003) → Validar.',
        'V12: Liquidar periodo demo → Generar cuenta de cobro de ejemplo.',
      ],
      say: 'Lo que se operó en la caja llega a la conciliación con el autorizador, a la compensación y a las comisiones, sin procesos manuales.',
      expect: [
        'Al ejecutar la conciliación: 12 comparados, 10 conciliados.',
        'Tras consultar y ajustar: 12 comparados, 11 conciliados, 1 ajuste, 0 abiertas.',
        'Efectivo entregado $ 598.700; pendiente por entregar $ 4.202.700; obligación frente a Reval (simulado) $ 1.051.400.',
        'LIQ-S-001: 9 transacciones, total $ 5.500; CC-DEMO-S-0001 por $ 1.800.',
      ],
    },
    {
      n: 8,
      title: 'Resultados',
      view: 'V02',
      route: 'dashboard',
      items: ['C12', 'C13', 'F13', 'C01'],
      actions: ['Revisa el dashboard y pulsa la última operación, TX-S-0013, para abrir su detalle en V07.'],
      say: 'Todo lo que se mostró queda trazado de punta a punta, desde la caja hasta el tablero.',
      expect: [
        'Recaudo confirmado $ 1.051.400; tasa de aprobación 91,7 %.',
        'Vigentes 9 · rechazadas 1 · anuladas 1 · reversadas 1 · en verificación 0.',
        'Comisiones cadena $ 3.700 · IT2EX $ 1.800.',
        'Pendiente por entregar $ 4.202.700 · excepciones abiertas 0 · diferencias de cierre −8.700.',
        'V07 muestra 13 transacciones y la traza de estados de TX-S-0013.',
        'V08: cupos utilizados de PDV-S4: Recaudos $ 0, Recargas $ 20.000, Corresponsalía $ 200.000.',
        'V09: en la caja CJ-S1-01, efectivo esperado $ 850.200.',
      ],
    },
  ],
};

const ESC_02: DemoPreset = {
  id: 'ESC-02',
  name: 'Excepciones y discrepancias',
  scenario: 'PAR',
  nextAuthorization: 'gatillo',
  summary: 'Parqueaderos: una inconsistencia reportada por Reval (simulado) se resuelve con reverso técnico.',
  steps: [
    {
      n: 1,
      title: 'Ingresar a la caja del aeropuerto',
      view: 'V01',
      route: 'inicio',
      items: ['F01', 'F02'],
      actions: [
        'Opcional: abre V02 (Dashboard) para mostrar el punto de partida de la red.',
        'Elige ParkCity Demo → Sede Aeropuerto → CJ-P1-01, usuario Cajero Demo P01 → Ingresar.',
      ],
      say: 'El mismo motor opera una red de parqueaderos, con sus propios cupos y convenios.',
      expect: ['En V02: recaudo $ 485.000 y tasa 85,7 %.', 'Al ingresar, efectivo esperado $ 445.000.'],
    },
    {
      n: 2,
      title: 'Conciliar contra Reval (simulado)',
      view: 'V10',
      route: 'conciliacion',
      items: ['C04', 'C05'],
      actions: ['V10 → Ejecutar conciliación.', 'No cierres CJ-P1-01 antes de este paso: con el turno cerrado no hay reverso técnico.'],
      say: 'La conciliación cruza cada operación con lo que reporta el autorizador y separa las diferencias.',
      expect: ['TX-P-0005 aparece como «Inconsistencia reportada por Reval (simulado)».'],
    },
    {
      n: 3,
      title: 'Resolver con reverso técnico',
      view: 'V10',
      route: 'conciliacion',
      items: ['C05'],
      actions: ['En TX-P-0005 → Reverso técnico.'],
      say: 'Una discrepancia no se corrige a mano: se resuelve con un reverso vinculado que deja traza.',
      expect: ['Queda «resuelta por reverso técnico», con 8 comparados y 8 conciliados.'],
    },
    {
      n: 4,
      title: 'Ver la traza',
      view: 'V07',
      route: 'transacciones',
      items: ['F13'],
      actions: ['Abre TX-P-0005 en la consulta transaccional.'],
      say: 'La operación original y su reverso quedan enlazados en la traza de estados.',
      expect: ['TX-P-0005 aparece Reversada, con su reverso vinculado.'],
    },
  ],
};

const ESC_03: DemoPreset = {
  id: 'ESC-03',
  name: 'Rechazo',
  scenario: 'SUP',
  nextAuthorization: 'rechazar',
  summary: 'Supermercados con la próxima autorización forzada a «Rechazar»: el rechazo no suma al recaudo ni consume cupo.',
  steps: [
    {
      n: 1,
      title: 'Ingresar a la caja',
      view: 'V01',
      route: 'inicio',
      items: ['F01', 'F02'],
      actions: [
        'Abre el Panel del presentador (encabezado o pie de la guía).',
        'Elige Mercado Central Demo → Sucursal Norte → CJ-S1-01, usuario Cajero Demo 01 → Ingresar.',
      ],
      say: 'Veamos qué pasa cuando el autorizador rechaza una operación.',
      expect: ['En el panel, «Próxima autorización (un solo uso)» está en «Rechazar».', 'Al ingresar, efectivo esperado $ 730.200.'],
    },
    {
      n: 2,
      title: 'Recaudo rechazado',
      view: 'V05',
      route: 'caja',
      items: ['F04', 'F11'],
      actions: ['F2, «ENEL», Enter; referencia 4500112100, Enter; Enter; efectivo 100000; F12.'],
      say: 'El autorizador rechaza la operación y la caja lo informa de inmediato; no se entrega comprobante válido.',
      expect: ['«Rechazada por el autorizador simulado», código R-13.', 'La factura sigue pendiente.'],
    },
    {
      n: 3,
      title: 'El rechazo queda trazado',
      view: 'V07',
      route: 'transacciones',
      items: ['F13', 'C01'],
      actions: ['Abre la última transacción en la consulta transaccional.'],
      say: 'El rechazo no suma al recaudo ni consume cupo, pero queda registrado con su código.',
      expect: ['TX-S-0011 aparece Rechazada en la consulta, con su traza «Enviando → Rechazada».'],
    },
    {
      n: 4,
      title: 'Indicadores',
      view: 'V02',
      route: 'dashboard',
      items: ['C12', 'C13'],
      actions: ['Revisa el dashboard.'],
      say: 'Los indicadores reflejan el rechazo en la tasa de aprobación, no en el recaudo.',
      expect: ['Recaudo confirmado sin cambios ($ 612.700).', 'Rechazadas sube en 1.'],
    },
  ],
};

export const PRESETS: DemoPreset[] = [ESC_01, ESC_02, ESC_03];

export const presetById = (id: PresetId): DemoPreset => PRESETS.find((p) => p.id === id) ?? ESC_01;
