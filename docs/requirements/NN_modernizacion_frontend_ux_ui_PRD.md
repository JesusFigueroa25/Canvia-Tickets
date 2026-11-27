# PRD — Modernización del frontend y experiencia UX/UI de CANVIA

**Estado:** v1.0 — Fase 1 cerrada documentalmente; Fase 1.6 auditada: APROBADO CON OBSERVACIONES. Fase 2 no iniciada.\
**Fecha:** 27/11/2026  
**Rama propuesta:** `style/modernizacion-frontend-ux-ui`

**Convención Git:** el usuario aprobó expresamente el prefijo `style/` para modificaciones visuales. H03 permanece como observación administrativa no bloqueante: la discrepancia con los prefijos de [AGENTS.md](../../AGENTS.md#flujo-de-desarrollo) se resolverá posteriormente. Se conserva la rama propuesta.

## 1. Contexto
CANVIA es una plataforma empresarial de gestión y análisis de tickets. La estructura Angular existente contiene 16 páginas, navegación, layout y componentes especializados de KPI, gráficos, tablas, diálogos y reportes. La auditoría estática identificó colores repetidos, radios y alturas variables y tema Material Azure/Blue. El [Design System](../DESIGN_SYSTEM.md) consolida ahora el estándar objetivo Aurora Enterprise UI Light, todavía no implementado. La evidencia histórica se mantiene allí.

El paquete documental está incorporado: Design System v2.0, este PRD v1.0 y canvia-design-system v1.1.0. La skill está reconocida en el catálogo de la sesión de auditoría y fue utilizada durante la Fase 1.6.

## 2. Objetivo
Modernizar la interfaz con una estética profesional, tecnológica y consistente, mejorar la comprensión de datos y la percepción de carga, y establecer patrones visuales reutilizables. Mantener la identidad CANVIA y preservar el comportamiento funcional actual.

## 3. Alcance
- Frontend Angular: `src/styles.css`, `src/material-theme.scss`, layout, navegación, páginas, KPI, gráficos Chart.js, tablas Angular Material, filtros, diálogos, formularios y estados de interfaz.
- Skeleton loading reutilizable mediante HTML de componentes padres y clases CSS compartidas, usando estados existentes; sin crear componentes Angular ni modificar TS.
- Evaluación de referencias visuales, principios UX, motion y responsive.
- Revisión de experiencias especiales: chat IA, login, landing e importaciones. Las exportaciones y sus reportes descargables quedan excluidos de la modernización; solo se permite verificar su preservación mediante QA de regresión.
- Documentación y pruebas frontend.

## 4. Fuera de alcance
- Todo cambio en archivos TypeScript, incluyendo pruebas TS, modelos, servicios, módulos, rutas, opciones Chart.js y animaciones internas. No crear nuevos TS ni modificar funcionalidades comentadas. Si un requisito visual exige TS o no puede aislarse de una exportación, detener esa parte y registrar el bloqueo; no ampliar el alcance.
- Backend FastAPI, SQL Server, consultas, ETL, endpoints, autenticación, contratos HTTP, modelos de datos y reglas de negocio.
- Cambiar fórmulas, umbrales SLA, criterios de filtrado, conteos, rutas o funcionalidades.
- Migrar a otro framework o librería visual; añadir dependencias sin aprobación.
- Modo oscuro completo o cambios de identidad corporativa sin aprobación.
- Todos los componentes de reportes descargables, incluyendo sus archivos HTML, CSS, TypeScript, fixtures, utilidades y pruebas existentes, así como su lógica de generación, captura y descarga. No aplicarles tokens nuevos, skeletons, animaciones, cambios de tema ni ajustes de composición.

### 4.1. Componentes protegidos
Los siguientes siete selectores fueron expresamente excluidos por el usuario; se incluye además el octavo reporte identificado. Sus carpetas se encuentran bajo `fronted-tickets/src/app/components/charts/Consolidated/`, según la estructura proporcionada:

| Módulo | Selector / carpeta |
|---|---|
| Análisis de Incidentes | `app-incident-cause-report` / `incident-cause-report/` |
| Incidentes Consolidados | `app-incident-monthly-report` / `incident-monthly-report/` |
| Incidentes Consolidados | `app-incident-project-report` / `incident-project-report/` |
| Incidentes Consolidados | `app-incident-project-monthly-report` / `incident-project-monthly-report/` |
| Incidentes Consolidados | `app-incident-recurring-alerts-report` / `incident-recurring-alerts-report/` |
| Auditoría de Categorización | `app-requirement-categorization-report` / `requirement-categorization-report/` |
| Resumen ejecutivo de incidentes (montaje dinámico desde Análisis de Incidentes) | `app-incident-executive-summary-report` / `incident-executive-summary-report/` |
| Report Times | `tickets-report-times-report/` (selector a verificar en código) |

Proteger también cualquier otro componente de exportación identificado. Consultar el [inventario operativo de la skill](../../.agents/skills/canvia-design-system/references/08-protected-components.md) para padres, montaje dinámico, CSS compartido y dependencias; revalidar contra el código vigente. El inventario no es exhaustivo.

### 4.2. Protección frente a efectos indirectos
- Se pueden modernizar las páginas padre y gráficos interactivos en pantalla, pero conservar los bindings, inputs, referencias de plantilla, eventos, configuración y flujo de exportación existentes.
- Auditar dependencias de los reportes respecto a CSS global, tema Material, tipografía, variables CSS, estilos de ancestros y configuración global/compartida de Chart.js. Encapsular o acotar los cambios del dashboard para que no alteren los reportes ni sus dependencias visuales. Si no se puede aislar un cambio sin modificar un reporte protegido, detener ese cambio y documentar el bloqueo para revisión.
- No modificar las carpetas protegidas ni cambiar el resultado exportado. Permitir únicamente lectura técnica y comprobación de regresión con datos controlados; no ejecutar exportaciones contra datos confidenciales.

## 5. Requisitos
| ID | Requisito |
|---|---|
| RF-01 | Inventariar componentes y estilos globales/locales con evidencia de rutas y líneas. |
| RF-02 | Definir y centralizar tokens de color, tipografía, espaciado, bordes, sombras, foco y motion; armonizar el tema Material en SCSS con APIs compatibles con la versión instalada y aislamiento verificado de reportes y overlays; bloquear cambios que no puedan aislarse. |
| RF-03 | Homogeneizar navegación, contenedores, cabeceras, filtros, KPI, gráficos, tablas y diálogos sin alterar sus contratos. |
| RF-04 | Mantener legibilidad de visualizaciones densas; no modificar series, datos, denominadores ni semántica de colores sin aprobación. |
| RF-05 | Implementar skeletons de dimensiones representativas en HTML de padres con CSS reutilizable y estados existentes. Diferenciar carga inicial, actualización, vacío y error cuando el contrato actual lo permita; registrar limitaciones sin añadir TS. |
| RF-06 | Reducir parpadeos y saltos visuales cuando sea compatible con el contrato actual; respetar concurrencia, ciclo de vida y estados existentes. No introducir temporizadores ni retrasar datos disponibles. |
| RF-07 | Usar transiciones discretas e interrumpibles y respetar `prefers-reduced-motion`. |
| RF-08 | Mantener accesibilidad de teclado, foco visible, etiquetas, contraste WCAG 2.2 AA como objetivo y estados no dependientes solo del color. |
| RF-09 | Mantener responsive, scroll local en tablas y gráficos legibles; evitar desbordamientos globales. |
| RF-10 | Proteger exportaciones PNG/reportes, modo pantalla completa, filtros, navegación y estados actuales mediante pruebas de regresión. Cero modificaciones en carpetas protegidas y cero cambios visuales o funcionales en reportes por efectos indirectos. |

## 6. Datos y reglas de negocio
- Mantener los servicios HTTP, modelos, solicitudes y respuestas existentes.
- Conservar filtros globales y particulares, valores por defecto, orden de prioridades, métricas y reglas SLA existentes.
- Skeletons son placeholders visuales, no registros ficticios; no deben aparecer en exportaciones.
- Para recargas, conservar contenido previo identificado como actualizándose solo cuando los estados existentes permitan acreditar su vigencia; no mostrar datos de filtros anteriores como si fueran actuales. No cambiar montaje de hijos, solicitudes ni sus referencias para integrar placeholders.
- No cambiar umbrales SLA documentados como objetivos sin verificar su significado y obtener aprobación.

## 7. Dirección visual definitiva
CANVIA — Aurora Enterprise UI, variante Aurora Light. Aurora / Mesh Gradients es el estilo protagonista; Roboto, verde y naranja corporativos, superficies analíticas claras y Sidenav Aurora Deep. Sin modo oscuro completo, fotografías decorativas en dashboards, glassmorfismo excesivo ni Framer Motion.

El [Design System](../DESIGN_SYSTEM.md) es la fuente de verdad para tokens, cuatro gradientes, patrones, los diez principios UX, Motion Design, skeletons y mapa de las 16 páginas. Emerald y Sunset son referencias derivadas pendientes de revisión visual en Home. No reinterpretar los ejemplos visuales como nuevas funcionalidades.

La [skill canvia-design-system](../../.agents/skills/canvia-design-system/SKILL.md) establece el procedimiento operativo y las restricciones; no duplica los valores normativos. La documentación define el objetivo, el código y las pruebas acreditan la implementación.

## 8. Plan de implementación
### Fase 0 — Auditoría e investigación (definición cerrada; capturas base pendientes si no existen)
- Revisar AGENTS.md, DESIGN_SYSTEM.md, documentación y configuración del frontend; inventariar dependencias y estilos.
- Analizar referencias de Instagram, las diez tendencias y los diecinueve principios aportados.
- Evaluar skills oficiales y comunitarias; comprobar rutas, instrucciones, permisos, compatibilidad y procedencia.
- Obtener capturas base si se puede ejecutar el sistema de forma segura y sin datos confidenciales.

### Fase 1 — Definición (cerrada documentalmente con observaciones no bloqueantes)
1.1 Identidad visual y Design Tokens.
1.2 Patrones de componentes.
1.3 Aplicación por módulo; Home como piloto.
1.4 frontend-skill instalada y reconocida según evidencia de Codex.
1.5 canvia-design-system v1.1.0 incorporada, reconocida y utilizada en la sesión de auditoría.
1.6 Auditoría documental completada con veredicto **APROBADO CON OBSERVACIONES**, aceptado por el usuario; validación estructural manual satisfactoria.

**Cierre de Fase 1:** cierre documental registrado tras las correcciones H01, H02 y H04. H03 permanece como observación administrativa justificada por la aprobación expresa de `style/`; no bloquea el avance autorizado. La Fase 2 todavía no se ha iniciado.

**Validaciones técnicas pendientes:** el validador oficial de skills no pudo ejecutarse por indisponibilidad de Python utilizable. Siguen pendientes las comprobaciones de implementación y QA: compilación, pruebas Angular, capturas, comparación de exportaciones, accesibilidad, responsive y rendimiento. La revisión estructural manual no sustituye estas verificaciones ni acredita cumplimiento de la aplicación.

### Fase 2 — Codex (no iniciada)
- Verificar e instalar únicamente las skills aprobadas que falten; no mover las 24 skills anteriores como parte de esta tarea.
- Plan Mode de solo lectura antes de editar, estado Git inicial, mapa de dependencias y capturas base controladas cuando sea posible. Aprobación explícita del plan y de los bloques a ejecutar.
- Implementar progresivamente el orden siguiente. Validar aislamiento antes de cambios globales o Material; no propagar el piloto hasta revisar su resultado.

1. Design Tokens y fundamentos visuales.
2. Tema Angular Material.
3. Sidenav y layout general.
4. Skeletons reutilizables mediante HTML/CSS.
5. KPI Cards.
6. Home como página piloto.
7. Contenedores, filtros y componentes compartidos.
8. Gráficos y tablas.
9. Dashboards Consolidados y SLA.
10. Análisis, auditoría, Report Times y demás dashboards.
11. Centro de IA, login, landing e importaciones.
12. Pruebas visuales, funcionales y documentación.

El bloque 12 coordina el cierre de QA de Fase 3. No iniciar todos los bloques por implicación; detener partes incompatibles con las restricciones y continuar solo el trabajo independiente autorizado.

### Fase 3 — QA
- Ejecutar build y pruebas frontend existentes. Registrar resultados y fallos preexistentes por separado.
- Comparar capturas antes/después con datos de prueba controlados y tamaños representativos.
- Validar navegación, filtros, tablas, gráficos, fullscreen, reportes, diálogos, chat e importaciones sin operaciones reales.
- Revisar contraste, teclado, responsive, carga, error y estado vacío; inspeccionar regresiones y cambios Git.

## 9. Criterios de aceptación
- [ ] Cero cambios en archivos TypeScript atribuibles a esta modernización, incluso specs; no se crean TS nuevos.
- [ ] Diff comparado contra baseline de cambios previos del usuario; sin sobrescribir ni incluir cambios ajenos en el commit.
- [ ] Cero cambios en backend, SQL, servicios HTTP o contratos de datos.
- [ ] La navegación y las funciones existentes se conservan.
- [ ] Los componentes incluidos utilizan los tokens y patrones aprobados, con excepciones documentadas.
- [ ] Skeletons muestran la geometría adecuada, desaparecen al finalizar la carga y no ocultan errores ni estados vacíos.
- [ ] Las vistas siguen siendo utilizables en escritorio y tamaños menores acordados, con scroll local cuando corresponda.
- [ ] Se verifica contraste, foco y teclado en componentes intervenidos; movimiento reducido compatible.
- [ ] Cero modificaciones atribuibles a esta modernización en las carpetas de reportes protegidos, verificado mediante comparación contra baseline Git (no revertir cambios preexistentes).
- [ ] Los reportes y descargas conservan su comportamiento, composición, dimensiones, tipografía, colores y gráficos previamente aprobados; comparar exportaciones antes/después con los mismos datos controlados, tolerando únicamente diferencias no deterministas justificadas.
- [ ] Los reportes no reciben skeletons, nuevas animaciones ni efectos del tema por cambios globales; sus botones y flujo de descarga siguen funcionando.
- [ ] Build y pruebas existentes ejecutados cuando estén autorizados, resultados registrados; distinguir fallos preexistentes, bloqueos y regresiones. No modificar TS de pruebas para hacerlas pasar.
- [ ] Capturas antes/después y revisión del diff frontend entregadas.
- [ ] DESIGN_SYSTEM.md y documentación pertinente actualizados conforme a la implementación efectiva.

## 10. Skills seleccionadas
| Skill | Función | Estado de preparación |
| --- | --- | --- |
| frontend-skill | Diseño general, versión histórica oficial 30444aed500c00c85294d12074f6e3ee794f808a | Instalada y reconocida según Codex; no modificar |
| canvia-design-system | Estándar CANVIA y flujo operativo | v1.1.0 incorporada, reconocida y utilizada en la sesión de auditoría |
| angular-developer | Buenas prácticas Angular | Pendiente Fase 2; verificar nombre/ubicación y procedencia |
| playwright | QA visual y funcional | Pendiente Fase 2–3; verificar nombre/ubicación y procedencia |

ui-ux-pro-max descartada. No instalar otras skills automáticamente. Las 24 skills anteriores no forman parte de esta reorganización. La skill del proyecto adapta las recomendaciones genéricas al estándar aprobado sin autorizar cambios adicionales.

## 11. Decisiones pendientes y condiciones de avance
- Asignar número correlativo `NN` según inventario de docs/requirements/; mantener nombre actual hasta tener evidencia y autorización para renombrar.
- Ejecutar el validador oficial cuando exista Python utilizable y su ejecución esté autorizada; la validación estructural manual ya fue satisfactoria.
- Verificar versiones efectivas de Angular/Material/Chart.js, compatibilidad de tema y herramientas y estructura de carga actual.
- Confirmar inventario completo de exportaciones, dependencias, cascada y baseline visual; el aislamiento es condición previa para cada cambio.
- Validar variantes derivadas Emerald y Sunset, contraste de controles y superficies, geometría de componentes y comportamiento responsive en Home. Referencias de tamaño: 480, 768, 1024, 1280, 1440 y 1920px, más un ancho estrecho representativo.
- Acordar presupuesto medible de rendimiento si es necesario; no inventar métricas ni metas de backend.
- No resolver defectos preexistentes, reglas SLA, logo remoto/fuente local ni limitaciones TS sin autorización específica.

## 12. Referencias
- Documentos proporcionados: estructura de proyecto, componentes padres/hijos y `DESIGN_SYSTEM.md` con contexto de diseño.
- [OpenAI — Frontend prompting y skill](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)
- [OpenAI — Build skills](https://developers.openai.com/codex/skills)
- [Angular — Agent Skills](https://angular.dev/ai/agent-skills)
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — evaluada y descartada.
- [Carbon — Loading](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Laws of UX](https://lawsofux.com/)

**Historial v0.2:** Se excluyen expresamente todos los reportes descargables; se registran los siete selectores proporcionados y se incorpora la protección de Report Times y otros reportes que se identifiquen.

**Historial v1.0:** dirección Aurora Light, Home piloto, tokens/componentes/motion/skeleton aprobados, protección estricta TS y exportaciones, cuatro skills y doce bloques; conciliación documental Fase 1.6.

**Nota:** Este PRD no acredita cambios implementados, pruebas ejecutadas ni aceptación de la aplicación. La Fase 2 necesita autorización y plan revisado.

**Commit final recomendado:** `style(frontend): modernizar sistema de diseño y experiencia UX/UI` (solo tras implementación y validación autorizadas).

