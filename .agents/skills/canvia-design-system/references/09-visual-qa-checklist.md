# Visual QA Checklist

## Alcance y evidencia

Usa esta lista para preparar o revisar validación; cada punto queda como verificado con evidencia, pendiente, bloqueado o no aplicable con motivo. No marques cumplimiento por inspección de reglas CSS únicamente.

En tareas exclusivamente documentales, valida formato, enlaces, coherencia y alcance; no ejecutes build, pruebas o navegador de la aplicación salvo autorización. En tareas de implementación, ejecuta solo comprobaciones autorizadas y disponibles. No instales herramientas o dependencias para completar la lista sin autorización. La skill no exige MCP ni una skill externa.

## Identidad y componentes

- [ ] Aurora Soft visible y uniforme entre componentes, usando la composición Aurora Light sin lámina blanca de página; Sidenav Aurora Deep conservado.
- [ ] Tokens de color, tipografía, radios, espaciado y elevación consistentes con [Design Tokens](../../../../docs/DESIGN_SYSTEM.md#design-tokens).
- [ ] Tarjetas, filtros, botones, tablas y diálogos siguen los patrones aplicables sin contenido inventado.
- [ ] Gráficos y tablas conservan superficies claras, cifras y etiquetas legibles.
- [ ] No hay modo oscuro completo, fotografías decorativas en dashboards ni glassmorfismo excesivo.
- [ ] La jerarquía respeta secciones, orden funcional y acciones existentes.

## Accesibilidad, movimiento y responsive

- [ ] Contraste WCAG 2.2 AA como objetivo: medir las combinaciones reales de texto, controles y foco, incluyendo gradientes, transparencia y estados. Aplicar los criterios normativos pertinentes sin inferir cumplimiento de la paleta.
- [ ] Estado comprensible sin depender solo del color; semántica de colores de datos conservada.
- [ ] Navegación por teclado y foco visible de 2px en controles intervenidos; conservar orden y comportamiento de foco.
- [ ] Diálogos conservan apertura, cierre, proyección y relación con fullscreen.
- [ ] prefers-reduced-motion elimina shimmer y movimiento CSS no esencial; cualquier limitación de motion TS se declara.
- [ ] Sin animación permanente de fondo, transition: all o bloqueos de interacción por motion.
- [ ] Responsive revisado en 480, 768, 1024, 1280, 1440 y 1920px según alcance, más un tamaño estrecho representativo; conservar lógica y umbrales TS.
- [ ] Sin desbordamiento global; scroll local de tablas/gráficos y fullscreen funcional.

## Datos y estados

- [ ] Skeletons solo desde HTML de padres y clases CSS reutilizables, sin componentes o registros TS nuevos.
- [ ] Loading, actualización, vacío y error representan estados existentes; limitaciones documentadas cuando falte información.
- [ ] Recursos disponibles aparecen sin esperar a todos; no se altera concurrencia ni se duplican consultas.
- [ ] Sin cifras ficticias, progreso inventado, demora artificial, parpadeo o saltos de layout observados.
- [ ] Mensajes y acciones existentes permanecen disponibles; no se inventan recuperaciones.
- [ ] Chat conserva indicadores de envío/respuesta; importaciones conservan estados por archivo; login no recibe un pending inexistente.
- [ ] Paneles comentados y sus funciones permanecen sin activar, eliminar o corregir.

## Regresión y protección

- [ ] Diff acotado a archivos autorizados; cambios previos del usuario conservados.
- [ ] Ningún TypeScript nuevo o modificado atribuible al alcance visual, incluyendo pruebas, modelos, servicios y módulos.
- [ ] Sin cambios de backend, SQL Server, contratos, endpoints, rutas, autenticación, permisos, fórmulas o filtros.
- [ ] Sin cambios en opciones Chart.js, datalabels, tooltips, series, callbacks o animaciones internas.
- [ ] Inputs, outputs, bindings, eventos, condiciones disabled y referencias de plantilla preservados.
- [ ] Búsqueda, ordenamiento, paginación, selección, navegación y fullscreen conservados.
- [ ] Ocho reportes protegidos y cualquier otro descubierto conservan archivos y dependencias respecto de la línea base; no revertir modificaciones previas del usuario.
- [ ] Cascada y ámbitos de CSS/Material/variables/fuentes no afectan a exportaciones.
- [ ] PNG comparados antes/después con datos ficticios equivalentes: composición, dimensiones, colores, tipografía, gráficos, contenido y funcionamiento originales.
- [ ] Errores de captura, reintento y descarte de resultados tardíos siguen el protocolo existente.
- [ ] El resultado de pruebas existentes se registra sin modificar fixtures o specs protegidos.

## Rendimiento y entrega

- [ ] Evaluar con evidencia el coste de blur, gradientes, animaciones y redimensionado de canvas; no prometer mejoras a partir de CSS.
- [ ] Registrar las comprobaciones realmente ejecutadas con comando o procedimiento, entorno, resultado y evidencia disponible.
- [ ] Separar fallos preexistentes, regresiones nuevas, inferencias y pendientes; los resultados históricos de docs/TEST_PLAN.md no equivalen a una ejecución actual.
- [ ] No afirmar equivalencia de exportaciones solo por conservar hashes o pasar un validador documental.
- [ ] Documentar cambios y bloqueos únicamente en el destino autorizado; no iniciar otra fase ni realizar commits/push por implicación.

La ausencia de una herramienta o de autorización deja la comprobación pendiente. No cambia el resultado de lo que sí pudo verificarse ni justifica ampliar el alcance.
