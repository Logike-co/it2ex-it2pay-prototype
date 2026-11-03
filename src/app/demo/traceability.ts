/**
 * Trazabilidad del simulador (workflow T §1.4-4, ítem X04).
 *
 * Fuente: `prototype/flow-map.md` §10 de la iniciativa `upgrade-it2pay`, que a su vez sale de
 * `scope-matrix.md` (ítem → historia), del PRD §2.3 (US-NN ↔ RF-NN, S-09) y de las etiquetas
 * `@E` de los escenarios BDD (§5). Si cambia alguna de esas fuentes, se actualiza aquí.
 */

export type Level = 'P1' | 'P2';

export interface ItemTrace {
  /** Ítem de la matriz de alcance (F/B/C). */
  id: string;
  name: string;
  level: Level;
  /** Vista que lo implementa. */
  view: string;
  /** Historias del backlog productivo; vacío = «solo demo». */
  us: string[];
  /** Escenarios BDD del flow-map que lo cubren. */
  bdd: string[];
}

export interface ScenarioTrace {
  id: string;
  name: string;
  items: string[];
}

/** El requerimiento funcional de una historia: el PRD §2.3 los asigna uno a uno (US-NN ↔ RF-NN). */
export const rfOf = (us: string): string => `RF-${us.slice(3)}`;

export const ITEMS: Record<string, ItemTrace> = {
  F01: { id: 'F01', name: 'Seleccionar cadena, establecimiento y caja', level: 'P1', view: 'V01', us: ['US-05'], bdd: ['E01'] },
  F02: { id: 'F02', name: 'Ingresar con perfil de cajero ficticio', level: 'P1', view: 'V01', us: ['US-01', 'US-03'], bdd: ['E02', 'E03'] },
  F03: { id: 'F03', name: 'Consultar catálogo de servicios habilitados', level: 'P1', view: 'V05', us: ['US-06'], bdd: ['E16'] },
  F04: { id: 'F04', name: 'Recaudar factura por convenio y referencia', level: 'P1', view: 'V05', us: ['US-09', 'US-30'], bdd: ['E18'] },
  F05: { id: 'F05', name: 'Consultar obligación y valor adeudado simulado', level: 'P1', view: 'V05', us: ['US-09'], bdd: ['E17'] },
  F06: { id: 'F06', name: 'Recargar celular por operador, número y valor', level: 'P1', view: 'V05', us: [], bdd: ['E20'] },
  F07: { id: 'F07', name: 'Simular depósito bancario', level: 'P1', view: 'V05', us: [], bdd: ['E21'] },
  F08: { id: 'F08', name: 'Simular retiro con OTP ficticio', level: 'P2', view: 'V05', us: [], bdd: ['E22'] },
  F09: { id: 'F09', name: 'Registrar efectivo y calcular cambio', level: 'P1', view: 'V05', us: ['US-10'], bdd: ['E19'] },
  F10: { id: 'F10', name: 'Simular pago con tarjeta', level: 'P2', view: 'V05', us: ['US-10'], bdd: ['E23'] },
  F11: { id: 'F11', name: 'Obtener autorización, rechazo o timeout ficticios', level: 'P1', view: 'V06', us: ['US-11', 'US-13'], bdd: ['E29', 'E30'] },
  F12: { id: 'F12', name: 'Generar comprobante imprimible marcado DEMO', level: 'P1', view: 'V06', us: ['US-12'], bdd: ['E36'] },
  F13: { id: 'F13', name: 'Consultar transacciones y estados', level: 'P1', view: 'V07', us: ['US-30'], bdd: ['E43'] },
  F14: { id: 'F14', name: 'Reversar una operación simulada', level: 'P2', view: 'V06', us: ['US-13'], bdd: ['E38'] },
  B01: { id: 'B01', name: 'Administrar cadenas, aliados y comercios', level: 'P1', view: 'V03', us: ['US-05', 'US-31'], bdd: ['E09'] },
  B02: { id: 'B02', name: 'Registrar sucursales, PDV y cajas', level: 'P1', view: 'V03', us: ['US-05'], bdd: ['E10'] },
  B03: { id: 'B03', name: 'Registrar y asignar cajeros', level: 'P1', view: 'V03', us: ['US-03', 'US-05'], bdd: ['E11'] },
  B04: { id: 'B04', name: 'Registrar dispositivos lógicos', level: 'P2', view: 'V03', us: ['US-05'], bdd: ['E12'] },
  B05: { id: 'B05', name: 'Administrar catálogo de convenios y servicios', level: 'P1', view: 'V04', us: ['US-06', 'US-31'], bdd: ['E13'] },
  B06: { id: 'B06', name: 'Habilitar servicios por cadena o PDV', level: 'P1', view: 'V04', us: ['US-07'], bdd: ['E14'] },
  B07: { id: 'B07', name: 'Parametrizar comisiones básicas', level: 'P1', view: 'V04', us: ['US-15'], bdd: ['E15'] },
  B08: { id: 'B08', name: 'Definir cupos por caja o PDV', level: 'P1', view: 'V08', us: ['US-21'], bdd: ['E45'] },
  B09: { id: 'B09', name: 'Consultar cupo disponible y utilizado', level: 'P1', view: 'V08', us: ['US-21'], bdd: ['E46'] },
  B10: { id: 'B10', name: 'Simular bloqueo por insuficiencia de cupo', level: 'P2', view: 'V08', us: ['US-21'], bdd: ['E27'] },
  C01: { id: 'C01', name: 'Consultar recaudos por caja y establecimiento', level: 'P1', view: 'V07', us: ['US-32'], bdd: ['E44'] },
  C02: { id: 'C02', name: 'Cerrar caja y declarar efectivo', level: 'P1', view: 'V09', us: [], bdd: ['E47'] },
  C03: { id: 'C03', name: 'Identificar sobrantes y faltantes', level: 'P1', view: 'V09', us: [], bdd: ['E48'] },
  C04: { id: 'C04', name: 'Conciliar operaciones frente a Reval simulado', level: 'P1', view: 'V10', us: ['US-23'], bdd: ['E50'] },
  C05: { id: 'C05', name: 'Gestionar transacciones no conciliadas', level: 'P2', view: 'V10', us: ['US-25'], bdd: ['E51'] },
  C06: { id: 'C06', name: 'Registrar consignación ficticia de efectivo', level: 'P1', view: 'V11', us: ['US-24'], bdd: ['E54'] },
  C07: { id: 'C07', name: 'Consultar efectivo pendiente por entregar', level: 'P1', view: 'V11', us: [], bdd: ['E55'] },
  C08: { id: 'C08', name: 'Mostrar compensación y obligaciones frente a Reval', level: 'P1', view: 'V11', us: [], bdd: ['E56'] },
  C09: { id: 'C09', name: 'Liquidar comisiones ilustrativas', level: 'P1', view: 'V12', us: ['US-16'], bdd: ['E57'] },
  C10: { id: 'C10', name: 'Consultar cartera y saldos pendientes', level: 'P2', view: 'V12', us: ['US-21'], bdd: ['E58'] },
  C11: { id: 'C11', name: 'Mostrar cuenta de cobro o factura de ejemplo', level: 'P2', view: 'V12', us: ['US-20'], bdd: ['E59'] },
  C12: { id: 'C12', name: 'Visualizar dashboard por cadena y PDV', level: 'P1', view: 'V02', us: ['US-32'], bdd: ['E07'] },
  C13: { id: 'C13', name: 'Consultar indicadores y reportes transaccionales', level: 'P1', view: 'V02', us: ['US-32'], bdd: ['E08'] },
};

/** Escenarios BDD por vista (flow-map §5). */
export const VIEW_BDD: Record<string, ScenarioTrace[]> = {
  V01: [
    { id: 'E01', name: 'Seleccionar cadena, establecimiento y caja', items: ['F01'] },
    { id: 'E02', name: 'Ingresar con perfil de cajero ficticio en una caja con turno abierto', items: ['F02'] },
    { id: 'E03', name: 'Abrir turno al ingresar a una caja sin turno', items: ['F02'] },
    { id: 'E04', name: 'Reiniciar el escenario restaura la semilla', items: [] },
    { id: 'E05', name: 'Navegar a cada vista sin rutas rotas', items: [] },
    { id: 'E06', name: 'Toda vista identifica la operación como simulada', items: [] },
  ],
  V02: [
    { id: 'E07', name: 'Dashboard por cadena y PDV tras el reinicio', items: ['C12'] },
    { id: 'E08', name: 'Los indicadores se actualizan tras una aprobación', items: ['C13'] },
  ],
  V03: [
    { id: 'E09', name: 'Crear y editar una cadena ficticia', items: ['B01'] },
    { id: 'E10', name: 'Registrar sucursal, PDV y caja', items: ['B02'] },
    { id: 'E11', name: 'Registrar y asignar un cajero', items: ['B03'] },
    { id: 'E12', name: 'Registrar un dispositivo lógico', items: ['B04'] },
  ],
  V04: [
    { id: 'E13', name: 'Crear un servicio en el catálogo', items: ['B05'] },
    { id: 'E14', name: 'Habilitar un servicio para un PDV', items: ['B06'] },
    { id: 'E15', name: 'Una comisión diferenciada solo afecta las operaciones futuras', items: ['B07'] },
  ],
  V05: [
    { id: 'E16', name: 'El catálogo muestra solo los servicios habilitados', items: ['F03'] },
    { id: 'E17', name: 'Consultar una obligación y su valor adeudado', items: ['F05'] },
    { id: 'E18', name: 'Recaudo aprobado de factura por convenio y referencia', items: ['F04'] },
    { id: 'E19', name: 'Registrar efectivo y calcular el cambio', items: ['F09'] },
    { id: 'E20', name: 'Recargar celular por operador, número y valor', items: ['F06'] },
    { id: 'E21', name: 'Simular un depósito bancario', items: ['F07'] },
    { id: 'E22', name: 'Simular un retiro con OTP ficticio', items: ['F08'] },
    { id: 'E23', name: 'Simular el pago con tarjeta', items: ['F10'] },
    { id: 'E24', name: 'Referencia sin obligación pendiente', items: [] },
    { id: 'E25', name: 'Obligación vencida en un convenio sin pago extemporáneo', items: [] },
    { id: 'E26', name: 'Pago parcial en un convenio que lo admite', items: [] },
    { id: 'E27', name: 'Bloqueo por cupo insuficiente', items: ['B10'] },
    { id: 'E28', name: 'Una obligación en verificación no admite un segundo pago', items: [] },
  ],
  V06: [
    { id: 'E29', name: 'Rechazo del autorizador ficticio', items: ['F11'] },
    { id: 'E30', name: 'Timeout resuelto por consulta como aprobada', items: ['F11'] },
    { id: 'E31', name: 'Timeout resuelto por consulta como rechazada definitiva', items: [] },
    { id: 'E32', name: 'Timeout en proceso que exige seguir consultando', items: [] },
    { id: 'E33', name: 'Sin registro en el autorizador y reintento con la misma clave idempotente', items: [] },
    { id: 'E34', name: 'Sin idempotencia no se reintenta', items: [] },
    { id: 'E35', name: 'El panel del presentador fuerza un desenlace guiado', items: [] },
    { id: 'E36', name: 'Comprobante imprimible marcado DEMO', items: ['F12'] },
    { id: 'E37', name: 'Sin comprobante para una operación en verificación', items: [] },
    { id: 'E38', name: 'Reverso funcional como transacción compensatoria vinculada', items: ['F14'] },
    { id: 'E39', name: 'Timeout del reverso, resuelto consultando el reverso sin duplicarlo', items: [] },
    { id: 'E40', name: 'Anulación de un recaudo en el mismo turno', items: [] },
    { id: 'E41', name: 'Las recargas no admiten anulación', items: [] },
    { id: 'E42', name: 'Anular un depósito exige la confirmación del supervisor', items: [] },
  ],
  V07: [
    { id: 'E43', name: 'Consultar transacciones, estados y traza', items: ['F13'] },
    { id: 'E44', name: 'Consultar recaudos por caja y por establecimiento', items: ['C01'] },
  ],
  V08: [
    { id: 'E45', name: 'Definir el cupo de un PDV', items: ['B08'] },
    { id: 'E46', name: 'Consultar el cupo disponible y el utilizado', items: ['B09'] },
  ],
  V09: [
    { id: 'E47', name: 'Cerrar caja y declarar el efectivo', items: ['C02'] },
    { id: 'E48', name: 'Identificar sobrantes y faltantes', items: ['C03'] },
    { id: 'E49', name: 'El cierre se bloquea mientras haya transacciones en verificación', items: [] },
  ],
  V10: [
    { id: 'E50', name: 'Conciliar tras el reinicio', items: ['C04'] },
    { id: 'E51', name: 'Una diferencia de estado se resuelve consultando', items: ['C05'] },
    { id: 'E52', name: 'Una inconsistencia reportada por Reval (simulado) se resuelve con reverso técnico', items: [] },
    { id: 'E53', name: 'Una diferencia de valor se resuelve con un ajuste ilustrativo', items: [] },
  ],
  V11: [
    { id: 'E54', name: 'Registrar una consignación ficticia y validarla para liberar cupo', items: ['C06'] },
    { id: 'E55', name: 'Consultar el efectivo pendiente por entregar', items: ['C07'] },
    { id: 'E56', name: 'Mostrar la compensación y las obligaciones frente a Reval', items: ['C08'] },
  ],
  V12: [
    { id: 'E57', name: 'Liquidar comisiones ilustrativas', items: ['C09'] },
    { id: 'E58', name: 'Consultar cartera y saldos pendientes', items: ['C10'] },
    { id: 'E59', name: 'Mostrar una cuenta de cobro de ejemplo', items: ['C11'] },
  ],
};

export interface ViewTrace {
  view: string;
  items: ItemTrace[];
  us: string[];
  rf: string[];
  bdd: ScenarioTrace[];
}

const unique = (xs: string[]): string[] => [...new Set(xs)].sort();

/** Trazabilidad consolidada de una vista (flow-map §10.1). */
export function viewTrace(view: string): ViewTrace {
  const items = Object.values(ITEMS).filter((i) => i.view === view);
  const us = unique(items.flatMap((i) => i.us));
  return { view, items, us, rf: us.map(rfOf), bdd: VIEW_BDD[view] ?? [] };
}

/** Trazabilidad de un conjunto de ítems (badges por componente). */
export function itemsTrace(ids: string[]): { items: ItemTrace[]; us: string[]; rf: string[]; bdd: string[] } {
  const items = ids.map((id) => ITEMS[id]).filter((i): i is ItemTrace => Boolean(i));
  const us = unique(items.flatMap((i) => i.us));
  return { items, us, rf: us.map(rfOf), bdd: unique(items.flatMap((i) => i.bdd)) };
}
