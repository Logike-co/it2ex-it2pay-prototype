# IT2Pay · Simulador comercial

Aplicación web de demostración que simula, de punta a punta, la operación de IT2Pay en una red de puntos de venta: configuración de la red, terminal de caja (recaudo, recarga, depósito y retiro), autorización contra un autorizador ficticio («Reval (simulado)»), cierre de caja, conciliación, compensación, comisiones y cartera.

> **SIMULACIÓN / SIN VALIDEZ TRANSACCIONAL.** Ninguna operación mueve dinero ni se conecta con sistemas reales. Todos los nombres, NIT, cuentas y valores son ficticios.

## Qué incluye

- **12 vistas** con sus rutas: `/inicio`, `/dashboard`, `/red`, `/convenios`, `/caja`, `/caja/resultado`, `/transacciones`, `/cupos`, `/cierre`, `/conciliacion`, `/compensacion` y `/finanzas`.
- **Dos escenarios** de referencia sobre el mismo motor: Supermercados y Parqueaderos, con datos iniciales deterministas.
- **Motor de simulación** en TypeScript puro (`src/app/core/simulation/`): máquina de estados de la transacción (aprobación, rechazo, timeout, consulta, reintento con la misma clave idempotente, anulación y reverso), cupos por PDV y línea de negocio, cierre de caja, conciliación con sus tres tipos de excepción, compensación, comisiones, liquidación, cartera y cuenta de cobro de ejemplo.
- **Estado compartido** en `signal()` de Angular (`src/app/core/state/simulator.store.ts`), persistido por escenario en el almacenamiento local del navegador.
- **Terminal de caja operable por teclado**: `F1` nueva operación · `F2` buscar convenio · `Enter` avanzar · `F12` autorizar · `F8` imprimir comprobante · `Esc` volver o cancelar.
- **Panel del presentador** (sección plegable de la guía de demo): fuerza el desenlace de la próxima autorización o del próximo reverso y activa o desactiva la idempotencia del autorizador ficticio.
- **Identidad visual de IT2Pay**: azul institucional, degradado aqua, logo y tipografía Nunito del portal transaccional IT2Pay, con una barra superior limpia (☰, logo, sesión y botón de la guía).
- **Modo presentador**: guía de demo en pantalla que concentra todos los controles de la demo, escenarios precargados ESC-01..03, reinicio en 1 clic y trazabilidad de cada vista con sus historias de usuario y requerimientos (ver «Modo presentador»).

## Requisitos

- Node.js 22 LTS o superior y npm.

## Instalar y ejecutar

```bash
npm ci          # o npm install
npm start       # abre en http://localhost:4200
```

Compilación de producción:

```bash
npm run build:prod   # salida en dist/it2pay-simulador/browser
```

## Pruebas

```bash
npm run lint    # ESLint (TypeScript y plantillas)
npm test        # Jest: motor de simulación, valores de control, persistencia, shell y modo presentador
npm run e2e     # Playwright: recorrido comercial completo, navegación por las 12 vistas y modo presentador
```

La primera vez que se corran las pruebas de extremo a extremo hay que instalar el navegador de Playwright:

```bash
npx playwright install chromium
```

`npm run e2e` levanta el servidor de desarrollo por su cuenta (o reutiliza uno que ya esté corriendo en el puerto 4200).

## Modo presentador

| Control | Cómo se usa | Qué hace |
| :--- | :--- | :--- |
| Guía de demo | Botón «Guía de demo» de la barra superior o `Ctrl+Shift+D` | Panel acoplado a la derecha que reúne todos los controles de la demo, para que la pantalla quede limpia con el paso actual del guion: qué hacer, qué contar y la checklist de lo que debe verse. Sigue a la pantalla: al cambiar de vista desde el menú pasa al paso del guion que la usa. Permite ir a cualquier paso o vista |
| Escenario | Lista «Escenario» arriba en la guía | Cambia entre Supermercados y Parqueaderos sin borrar datos |
| Escenarios precargados | Botones ESC-01, ESC-02 y ESC-03 en la guía | Reinician los datos de su escenario, fijan el panel del presentador y abren su guion: camino feliz (Supermercados), excepciones y discrepancias (Parqueaderos) y rechazo (Supermercados) |
| Reinicio en 1 clic | `Ctrl+Shift+R` | Restaura el escenario activo sin diálogo de confirmación y vuelve al primer paso del guion |
| Panel del presentador | Sección plegable «Panel del presentador» de la guía | Fuerza el desenlace de la próxima autorización o del próximo reverso, activa o desactiva la idempotencia y muestra los gatillos y el último desenlace |
| Trazabilidad | Casilla «Trazabilidad» al pie de la guía | Muestra encima de cada vista y en los títulos de sus tarjetas la historia de usuario y el requerimiento que valida (`US-09 · RF-09`), con sus escenarios BDD. No sale en la impresión |

Los atajos usan `Ctrl` también en Mac. Los datos de la guía y la trazabilidad están en `src/app/demo/`.

## Reiniciar escenarios

- **Reiniciar escenario** (pie de la guía, con confirmación): restaura exactamente los datos iniciales del escenario activo y borra todo lo creado en vivo. El otro escenario no se toca.
- **Reiniciar todo** (pie de la guía, con confirmación): restaura los dos escenarios.
- Para empezar de cero sin la aplicación, basta con borrar los datos del sitio en el navegador (claves `it2pay-simulador:v1:*`).

## Gatillos de la demo

Los desenlaces de la autorización dependen de los tres últimos dígitos de la referencia principal (o del número celular, del TAG o de la cuenta):

| Terminación | Desenlace |
| :--- | :--- |
| `013` | Rechazo del autorizador simulado |
| `408` | Timeout; la consulta de estado la aprueba |
| `409` | Timeout; la consulta la rechaza de forma definitiva |
| `410` | Timeout; la primera consulta responde «en proceso» y la segunda aprueba |
| `404` | Timeout sin registro; se reintenta con la misma clave (si hay idempotencia) |
| `999` | Referencia sin obligación pendiente (solo recaudos) |
| OTP `000000` | Retiro rechazado por OTP inválido |

Cualquier otra terminación se aprueba. El panel del presentador puede forzar el desenlace de la siguiente operación.

## Limitaciones

- **Sin backend**: no hay servidor, base de datos ni llamadas a servicios reales. El estado vive en el navegador de quien presenta.
- **Datos ficticios**: convenios, operadores, bancos, cadenas, cajeros y titulares son inventados. El catálogo es una propuesta.
- **Reglas ilustrativas**: las fórmulas de cupo, cierre, conciliación, compensación, comisiones, cartera y facturación están rotuladas «Ilustrativo — sujeto a validación del responsable funcional» y no representan reglas contractuales.
- No hay cifrado, autenticación real, impuestos, facturación electrónica ni integración contable.

## Identidad visual

La marca se toma del **portal transaccional IT2Pay**, que es la referencia vigente de la identidad:

| Elemento | Valor | Dónde |
| :--- | :--- | :--- |
| Azul institucional | `#0E4495` (hover `#0A3A80`) | `--it2pay-primary`: botones principales, títulos, menú activo y encabezado de la guía |
| Azul claro | `#C9E7F4` | `--it2pay-primary-soft`: franja izquierda de las tarjetas, hover del menú y píldora «Simulador comercial» |
| Degradado aqua | `#C9E7F4 → #9CE8DD` | `--it2pay-brand-gradient`: filete bajo la barra superior |
| Cian y lima del logo | `#00AEEF`, `#72EE4B` | `--it2pay-accent`, `--it2pay-accent-2`: solo decorativos, nunca para texto (no alcanzan contraste AA) |
| Fondo, bordes y texto | `#F8F9FC`, `#E3E6F0`, `#3A3B45`, `#5A5C69` | `--it2pay-surface-alt`, `--it2pay-border`, `--it2pay-text`, `--it2pay-text-muted` |
| Tipografía | Nunito (variable, latin) | `src/fonts/`, autoalojada: la demo funciona sin red |
| Logo | `public/brand/it2pay-logo.png` | Barra superior (`data-testid="logotipo"`) |

Si llega un manual de marca, se cambian **solo** los tokens de `:root` en `src/styles.css`, el logo de `public/brand/` y `public/favicon.svg`. Las vistas usan clases como `bg-primary`, `text-ink` o `border-line`, que se derivan de esos tokens; no hay que tocarlas. Verifique el contraste del texto sobre los colores nuevos.

## Estructura

```text
src/app/
  core/simulation/   motor puro: modelo, semilla, reglas, derivados y formatos (+ pruebas Jest)
  core/state/        almacén con signal() y persistencia por escenario
  shared/            leyenda, rótulo ilustrativo, comprobante DEMO, badge de trazabilidad, acciones de transacción, pipes
  features/          una carpeta por vista (V01–V12)
  demo/              modo presentador: guiones, presets, trazabilidad y guía en pantalla
tests/               pruebas Playwright
```

## Licencia

Propiedad de IT2EX; todos los derechos reservados (ver `LICENSE`). Los avisos de componentes de terceros están en `THIRD_PARTY_NOTICES.md`.
