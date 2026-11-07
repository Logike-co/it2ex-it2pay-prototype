# Changelog

Todos los cambios relevantes del simulador comercial de IT2Pay se registran en este archivo.

## [1.2.0] — Acceso por rol

- Pantalla de login con usuarios ficticios precargados de los 8 perfiles de IT2Pay (Colocador, Punto de Venta, Asesor de Ventas, Operador, Finanzas, Aprobador financiero, Administrador y Super Usuario); la contraseña se llena sola. El menú lateral arranca oculto después de cada login.
- Cada perfil ve en el menú solo sus opciones y solo sus acciones: la caja es del Colocador, la reversa del Operador, la parametrización del Super Usuario y los cupos del Operador. El Punto de Venta solo ve su PDV y confirma la anulación de los depósitos (antes, «Supervisor»).
- Segregación de funciones en finanzas: Finanzas propone ajustes de conciliación y genera liquidaciones y cuentas de cobro; el Aprobador financiero los aprueba. Nadie aprueba lo que generó.
- Vista «Roles y accesos» con la matriz de accesos y los diagramas de casos de uso, también disponible desde la guía.
- La guía indica el usuario de cada paso y cambia de usuario en un clic («Ingresar como…»); ESC-01 pasa a 14 pasos.
- Terminología: «Colocador (cajero)». Los datos guardados de versiones anteriores se descartan (esquema v3).

## [1.1.0] — Identidad visual de IT2Pay

- Identidad visual tomada del portal transaccional IT2Pay: azul institucional `#0E4495`, azul claro y degradado aqua, franja izquierda en las tarjetas, logo de IT2Pay y tipografía Nunito autoalojada.
- Barra superior limpia: botón ☰ que oculta o muestra el menú de vistas en cualquier ancho, logo, sesión activa y botón «Guía de demo».
- Todos los controles de la demo pasan a la guía: escenario, presets, panel del presentador (ahora una sección plegable), trazabilidad y reinicios. La franja del panel del presentador bajo el encabezado desaparece.

## [1.0.0] — Primera Iteración

- Simulador comercial interactivo con 12 vistas, dos escenarios (Supermercados y Parqueaderos), motor de simulación determinista y persistencia local por escenario.
- Modo presentador: guía de demo en pantalla (`Ctrl+Shift+D`), escenarios precargados ESC-01..03, reinicio en 1 clic (`Ctrl+Shift+R`) y trazabilidad de cada vista con sus historias de usuario y requerimientos.
- Maquetación que se adapta al espacio disponible: las vistas se reacomodan según el ancho del área de contenido (con o sin guía abierta), las tablas anchas se desplazan dentro de su tarjeta, el menú se compacta mientras la guía está abierta, y ni los montos ni los códigos (CJ-S1-01, CAJ-S02…) se parten entre líneas.
