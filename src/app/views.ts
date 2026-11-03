/** Las 12 vistas del simulador y sus rutas exactas (prototype.yaml). */
export interface ViewDef {
  id: string;
  name: string;
  path: string;
}

export const VIEWS: ViewDef[] = [
  { id: 'V01', name: 'Inicio y escenarios', path: 'inicio' },
  { id: 'V02', name: 'Dashboard ejecutivo', path: 'dashboard' },
  { id: 'V03', name: 'Administración de red', path: 'red' },
  { id: 'V04', name: 'Convenios y servicios', path: 'convenios' },
  { id: 'V05', name: 'Terminal de caja', path: 'caja' },
  { id: 'V06', name: 'Resultado y comprobante', path: 'caja/resultado' },
  { id: 'V07', name: 'Consulta transaccional', path: 'transacciones' },
  { id: 'V08', name: 'Cupos y riesgo', path: 'cupos' },
  { id: 'V09', name: 'Cierre de caja', path: 'cierre' },
  { id: 'V10', name: 'Conciliación', path: 'conciliacion' },
  { id: 'V11', name: 'Compensación y efectivo', path: 'compensacion' },
  { id: 'V12', name: 'Gestión financiera', path: 'finanzas' },
];
