# Componentes protegidos

## Invariantes

Todos los reportes descargables están excluidos de la modernización. La lectura se permite para identificar dependencias y prevenir regresiones. El inventario no limita la exclusión: protege cualquier reporte adicional que se descubra.

Conserva HTML, CSS, TS, utilidades, fixtures, pruebas, modelos, snapshots, inputs, bindings, referencias de plantilla, eventos, dimensiones, colores, fuentes, gráficos y protocolos de preparación, renderizado, captura y descarga. Incluye los métodos y condiciones de exportación en los padres.

No apliques tokens nuevos, skeletons, animaciones, cambios de tema o composición a esos documentos. No uses su CSS como base del nuevo Design System.

## Inventario y padres

Las carpetas de los ocho componentes están bajo fronted-tickets/src/app/components/charts/Consolidated/.

| Componente protegido | Padre y enlace que debe conservarse |
| --- | --- |
| incident-cause-report | pages/incident-cause-analysis: reporteImagen, reporteListo, inputs del reporte largo y descargarReporte. |
| incident-monthly-report | pages/incident-consolidated: reporteMensualImagen, datosReporteMensual, renderizado/errorRenderizado y descarga R01. |
| incident-project-report | pages/incident-consolidated: reporteProyectosImagen, datosReporteProyectos y protocolo R02. |
| incident-project-monthly-report | pages/incident-consolidated: reporteProyectoMensualImagen, datosReporteProyectoMensual y protocolo R03. |
| incident-recurring-alerts-report | pages/incident-consolidated: reporteAlertasImagen, datosReporteAlertas y protocolo R04. |
| incident-executive-summary-report | pages/incident-cause-analysis: resumenHost, importación dinámica, ViewContainerRef, datos y eventos del componente creado al descargarResumen. |
| requirement-categorization-report | pages/requirement-categorization-audit: reporteImagen, datosReporte, renderizado/errorRenderizado y captura. |
| tickets-report-times-report | pages/tickets-report-times: reporteImagen, datosReporte, estados de preparación, render y captura. |

Comprueba los nombres en el código actual antes de actuar. Conserva utilidades dentro de las carpetas anteriores, modelos de reporte de src/app/models/ y utilidades compartidas como src/app/utils/formatear-tiempo.ts cuando formen parte del flujo.

Las visualizaciones interactivas llamadas Report-Diary o Report-Times no son automáticamente documentos descargables; rastrea la captura real. El reporte protegido puede existir sin un selector literal en la plantilla, como el resumen ejecutivo dinámico.

## Dependencias visuales compartidas

incident-monthly-report.css es importado por:

- incident-project-report.css.
- incident-project-monthly-report.css.
- incident-recurring-alerts-report.css.
- incident-executive-summary-report.css.
- requirement-categorization-report.css.

Ese archivo base y sus importadores permanecen protegidos. Sus colores y fuentes locales no deben migrarse a los tokens de Aurora.

Los padres contienen etapas de exportación fuera de pantalla: monthly-report-export-stage, report-export-stage y summary-export-stage. Su posición y ancho forman parte de la captura. Conserva clases, referencias, condiciones de montaje, aria-hidden/inert existentes y ciclo de vida.

## Comprobar aislamiento antes de implementar

1. Localiza los padres, snapshots, utilidades, importaciones CSS y puntos de captura afectados por el cambio propuesto.
2. Traza la cascada real: estilos globales, tema Material, tipografía, variables heredadas y estilos de ancestros, además de cualquier configuración compartida de Chart.js.
3. Define un ámbito CSS para la interfaz interactiva que excluya las etapas de exportación. No supongas que la encapsulación de un componente impide toda herencia o regla global.
4. Comprueba que reglas sobre canvas, svg, .card, .chart-card, tablas y encabezados no alcancen reportes. Evita nuevos resets amplios, Chart.js defaults, transformaciones/filtros de ancestros y animaciones durante captura.
5. Mantén el protocolo de exportación independiente de los placeholders. No cambies su disponibilidad por un nuevo estado de carga ni muevas refs para acomodar skeletons.
6. Si una modificación no puede aislarse sin tocar un elemento protegido, detén esa modificación y documenta selector/ancestro/dependencia, impacto y autorización necesaria. Continúa solo con trabajo independiente ya autorizado.

No resuelvas un bloqueo copiando, extrayendo, reescribiendo o compensando archivos del reporte. No impongas display:none, content-visibility o transformaciones para ocultar etapas que necesitan medir su documento.

## Validación futura

Cuando esté autorizada, compara las exportaciones antes/después con los mismos datos ficticios, filtros y condiciones controladas, preservando apariencia, dimensiones, fuentes, gráficos y descarga. No consultes datos confidenciales ni bases compartidas para obtener evidencias.

Una coincidencia de hashes o ausencia de diff demuestra conservación de archivos, no equivalencia visual del PNG frente a efectos indirectos. Si no se ejecutó captura, registra esa comprobación como pendiente. No modifiques fixtures ni pruebas protegidas para hacer pasar la validación.

Consulta [09 QA visual](09-visual-qa-checklist.md).
