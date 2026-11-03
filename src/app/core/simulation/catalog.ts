import { Service } from './model';

/** Las 8 categorías del alcance §11 (S-02). */
export const CATEGORIES: { code: number; name: string }[] = [
  { code: 1, name: 'Operaciones bancarias y de efectivo' },
  { code: 2, name: 'Recaudos y pagos de obligaciones' },
  { code: 3, name: 'Giros, remesas y transferencias' },
  { code: 4, name: 'Recargas de productos digitales' },
  { code: 5, name: 'Juegos de suerte y azar' },
  { code: 6, name: 'Subsidios, beneficios y pagos masivos' },
  { code: 7, name: 'Seguros, asistencia y protección' },
  { code: 8, name: 'Servicios comerciales y trámites' },
];

/** Subcategorías que usa el catálogo propuesto (sugerencias del formulario). */
export const SUBCATEGORY_SUGGESTIONS: string[] = [
  'Retiros de dinero',
  'Depósitos y consignaciones',
  'Servicios públicos',
  'Telecomunicaciones',
  'Impuestos y obligaciones públicas',
  'Educación',
  'Giros nacionales',
  'Recargas móviles',
  'Recargas de movilidad',
  'Chance',
  'Subsidios gubernamentales',
  'Pago primas de seguros',
  'Recaudo conjuntos residenciales',
  'Pago multas y comparendos',
  'Pagos de facturas',
];

/** Comisión general por defecto: cadena 400 / IT2EX 200 (§11, FM-15). */
export const DEFAULT_COMMISSION = { chainValue: 400, it2exValue: 200 };

const cat = (code: number): string =>
  CATEGORIES.find((c) => c.code === code)?.name ?? '';

const base = {
  requiresOtp: false,
  allowsPartial: false,
  minPartial: null,
  allowsLate: false,
  range: null,
  suggestedValues: [] as number[],
  active: true,
  documentedOnly: false,
  p2: false,
};

const recaudo = (
  id: string,
  name: string,
  categoryCode: number,
  subcategoryCode: number,
  subcategory: string,
  refName: string,
  length: number,
  allowsLate: boolean
): Service => ({
  ...base,
  id,
  name,
  categoryCode,
  category: cat(categoryCode),
  subcategoryCode,
  subcategory,
  operationType: 'recaudo',
  line: 'Recaudos',
  references: [{ name: refName, minLength: length, maxLength: length }],
  allowsLate,
});

const MOBILE_SUGGESTED = [5_000, 10_000, 20_000, 50_000];

/** Catálogo propuesto común a los dos escenarios (flow-map §6.1, FM-20). */
export const buildCatalog = (): Service[] => [
  recaudo('SRV-01', 'ENEL (ficticio)', 2, 9, 'Servicios públicos', 'Número de cliente', 10, false),
  recaudo('SRV-02', 'Acueducto Sabana Demo', 2, 9, 'Servicios públicos', 'Matrícula', 7, false),
  recaudo('SRV-03', 'Gas Andino Demo', 2, 9, 'Servicios públicos', 'Contrato', 7, true),
  recaudo('SRV-04', 'Cable Andes Demo', 2, 10, 'Telecomunicaciones', 'Cuenta', 8, true),
  {
    ...recaudo('SRV-05', 'Conjunto Residencial Los Robles Demo', 2, 52, 'Recaudo conjuntos residenciales', 'Torre', 2, true),
    references: [
      { name: 'Torre', minLength: 1, maxLength: 2 },
      { name: 'Apartamento', minLength: 3, maxLength: 4 },
    ],
    allowsPartial: true,
    minPartial: 50_000,
  },
  recaudo('SRV-06', 'Universidad Demo del Norte', 2, 13, 'Educación', 'Código de estudiante', 8, true),
  recaudo('SRV-07', 'Seguros Protección Demo', 7, 44, 'Pago primas de seguros', 'Número de póliza', 7, false),
  recaudo('SRV-08', 'Predial Municipio Demo', 2, 12, 'Impuestos y obligaciones públicas', 'Ficha catastral', 6, false),
  recaudo('SRV-09', 'Comparendos Tránsito Demo', 8, 56, 'Pago multas y comparendos', 'Número de comparendo', 10, true),
  {
    ...base,
    id: 'SRV-10',
    name: 'MóvilUno Demo',
    categoryCode: 4,
    category: cat(4),
    subcategoryCode: 23,
    subcategory: 'Recargas móviles',
    operationType: 'recarga',
    line: 'Recargas',
    references: [{ name: 'Número celular', minLength: 10, maxLength: 10, mobile: true }],
    range: { min: 1_000, max: 200_000 },
    suggestedValues: MOBILE_SUGGESTED,
  },
  {
    ...base,
    id: 'SRV-11',
    name: 'Celmax Demo',
    categoryCode: 4,
    category: cat(4),
    subcategoryCode: 23,
    subcategory: 'Recargas móviles',
    operationType: 'recarga',
    line: 'Recargas',
    references: [{ name: 'Número celular', minLength: 10, maxLength: 10, mobile: true }],
    range: { min: 1_000, max: 200_000 },
    suggestedValues: MOBILE_SUGGESTED,
  },
  {
    ...base,
    id: 'SRV-12',
    name: 'TAG TransVía Demo',
    categoryCode: 4,
    category: cat(4),
    subcategoryCode: 28,
    subcategory: 'Recargas de movilidad',
    operationType: 'recarga',
    line: 'Recargas',
    references: [{ name: 'Número de TAG', minLength: 10, maxLength: 10 }],
    range: { min: 10_000, max: 500_000 },
  },
  {
    ...base,
    id: 'SRV-13',
    name: 'Depósito Banco Demo Uno',
    categoryCode: 1,
    category: cat(1),
    subcategoryCode: 2,
    subcategory: 'Depósitos y consignaciones',
    operationType: 'deposito',
    line: 'Corresponsalía',
    references: [
      { name: 'Tipo de cuenta', minLength: 0, maxLength: 0, options: ['Ahorros', 'Corriente'] },
      { name: 'Número de cuenta', minLength: 10, maxLength: 10 },
    ],
    range: { min: 10_000, max: 3_000_000 },
  },
  {
    ...base,
    id: 'SRV-14',
    name: 'Retiro Banco Demo Uno',
    categoryCode: 1,
    category: cat(1),
    subcategoryCode: 1,
    subcategory: 'Retiros de dinero',
    operationType: 'retiro',
    line: 'Corresponsalía',
    references: [{ name: 'Número de cuenta', minLength: 10, maxLength: 10 }],
    requiresOtp: true,
    range: { min: 10_000, max: 600_000 },
    p2: true,
  },
  {
    ...base,
    id: 'SRV-15',
    name: 'Giro Nacional Demo',
    categoryCode: 3,
    category: cat(3),
    subcategoryCode: 20,
    subcategory: 'Giros nacionales',
    operationType: null,
    line: null,
    references: [],
    active: false,
    documentedOnly: true,
  },
  {
    ...base,
    id: 'SRV-16',
    name: 'Chance Demo',
    categoryCode: 5,
    category: cat(5),
    subcategoryCode: 30,
    subcategory: 'Chance',
    operationType: null,
    line: null,
    references: [],
    active: false,
    documentedOnly: true,
  },
  {
    ...base,
    id: 'SRV-17',
    name: 'Subsidio Demo',
    categoryCode: 6,
    category: cat(6),
    subcategoryCode: 36,
    subcategory: 'Subsidios gubernamentales',
    operationType: null,
    line: null,
    references: [],
    active: false,
    documentedOnly: true,
  },
];

/** Texto de referencias para el catálogo: «Número de cuenta (10); OTP (6)». */
export const describeReferences = (s: Service): string => {
  const parts = s.references.map((r) => {
    if (r.options) {
      return r.name;
    }
    const len =
      r.minLength === r.maxLength ? `${r.minLength}` : `${r.minLength}–${r.maxLength}`;
    return `${r.name} (${len})`;
  });
  if (s.requiresOtp) {
    parts.push('OTP (6)');
  }
  return parts.length ? parts.join('; ') : '—';
};
