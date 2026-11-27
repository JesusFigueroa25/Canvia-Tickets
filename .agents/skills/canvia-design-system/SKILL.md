---
name: canvia-design-system
description: Diseña, implementa o revisa la presentación del frontend CANVIA con Aurora Enterprise UI, tokens y patrones aprobados. Úsala para tareas visuales de CANVIA; no para cambios funcionales, backend o reportes descargables.
metadata:
  version: "1.1.0"
---

# CANVIA Design System

Aplica el estándar objetivo aprobado **CANVIA — Aurora Enterprise UI**, variante **Aurora Light**. Estas instrucciones documentan un objetivo; no acreditan que esté implementado o validado.

## Alcance y autorización

La invocación de esta skill no autoriza a editar código, instalar herramientas ni ejecutar operaciones externas. Distingue investigación, propuesta, implementación y revisión; actúa solo dentro de lo solicitado.

En la modernización visual conserva funcionalidades, orden funcional, rutas, autenticación, permisos, filtros, cálculos, modelos, contratos HTTP y servicios. No modifiques TypeScript, backend, SQL Server, opciones internas de Chart.js ni animaciones definidas en TS. No crees componentes Angular ni registros de módulos para skeletons. No elimines funcionalidades comentadas ni corrijas defectos funcionales ajenos al alcance.

Un cambio que exceda estos límites requiere autorización explícita específica; una petición visual genérica no la concede. No instales dependencias ni skills por iniciativa propia. Conserva los cambios locales previos y evita acceder a secretos o datos confidenciales.

## Fuentes y referencias

Localiza la raíz del repositorio y lee sus AGENTS.md aplicables, README y documentación pertinente en docs/. Usa arquitectura, estado, pruebas y código como evidencia del comportamiento actual. Para el objetivo visual consulta [DESIGN_SYSTEM.md](../../../docs/DESIGN_SYSTEM.md) como fuente de verdad. El [PRD vigente](../../../docs/requirements/NN_modernizacion_frontend_ux_ui_PRD.md) establece alcance, requisitos, orden y aceptación. Las referencias de la skill orientan la ejecución y apuntan al estándar; no prevalecen sobre sus valores. Si existe una contradicción, documenta el conflicto y no amplíes alcance. Si el PRD cambia de nombre, localízalo en docs/requirements/ y verifica que sea el vigente.

Consulta solo las referencias necesarias:

| Tarea | Referencia |
| --- | --- |
| Identidad, alcance y relación con frontend-skill | [01 Dirección de diseño](references/01-design-direction.md) |
| Valores de color, gradientes, tipografía y geometría | [02 Design Tokens](references/02-design-tokens.md) |
| Presentación de navegación, controles y superficies | [03 Patrones de componentes](references/03-component-patterns.md) |
| Principios UX y movimiento CSS | [04 UX y motion](references/04-ux-motion-guidelines.md) |
| Placeholders desde padres, con estados existentes | [05 Skeletons](references/05-skeleton-patterns.md) |
| Contenedores de gráficos y límites de Chart.js | [06 Gráficos](references/06-chart-guidelines.md) |
| Mapa de módulos, Home piloto y orden futuro | [07 Módulos](references/07-module-guidelines.md) |
| Padres, dependencias y aislamiento de exportaciones | [08 Componentes protegidos](references/08-protected-components.md) |
| Validación y evidencia de resultados | [09 QA visual](references/09-visual-qa-checklist.md) |

Antes de tocar estilos globales, tema Material, layout, padres con exportaciones o skeletons, lee la referencia 08 y rastrea las dependencias afectadas. Antes de implementar o revisar cambios, consulta la referencia 09.

## Flujo de trabajo

1. Identifica el alcance autorizado y el estado Git inicial.
2. Inspecciona los archivos afectados, sus consumidores, estados reales y dependencias; distingue HTML activo, comentarios y montaje dinámico.
3. Consulta las referencias pertinentes y define archivos, ámbito CSS y plan de validación. Presenta un plan proporcionado a la tarea.
4. Implementa únicamente lo ya autorizado, conservando bindings, eventos, condiciones disabled, referencias de plantilla y protocolos de exportación. Si solo se pidió análisis, entrega la propuesta sin editar.
5. Valida según el alcance y las herramientas autorizadas. Contrasta el diff con la situación inicial; no sobrescribas trabajo previo.
6. Entrega cambios o hallazgos, evidencia, limitaciones y bloqueos. Documenta en el destino autorizado; no inicies otra fase por implicación.

Si una modificación no puede aislarse de los reportes, detén esa modificación y documenta el motivo. Si falta un estado de carga, no lo inventes ni añadas TS: explica la limitación y continúa solo con las partes compatibles.

## Límites de interpretación

Mantén Aurora visible en fondo y encabezados, superficies legibles y densidad operativa. No implementes modo oscuro completo, glassmorfismo excesivo ni Framer Motion. En dashboards no añadas fotografías decorativas ni los conviertas en landing pages comerciales. No inventes métricas o contenido funcional.

Aplica de frontend-skill composición, jerarquía, legibilidad y movimiento intencional cuando sea pertinente, sin depender de su instalación. Las tarjetas analíticas útiles, Aurora y los acentos verde/naranja están aprobados para CANVIA y prevalecen sobre sus preferencias genéricas. Conserva intacta esa skill histórica.

No declares reconocimiento automático de esta skill sin evidencia del catálogo de la sesión. No declares cumplimiento visual, accesibilidad, rendimiento o pruebas exitosas sin evidencia de ejecución.
