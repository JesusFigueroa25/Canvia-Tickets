# Patrones de componentes — guía operativa

**Fuente normativa:** [Patrones de componentes en DESIGN_SYSTEM.md](../../../../docs/DESIGN_SYSTEM.md#patrones-de-componentes). Consulta esa sección antes de diseñar o revisar; sus valores no se duplican aquí.

Inspecciona el HTML/CSS/SCSS actual y sus consumidores antes de editar. Usa las variantes y medidas del documento enlazado; no cambies inputs, outputs, bindings, eventos, formularios, disabled, foco o referencias. El KPI existente tiene variantes orange/green; verifica el contrato actual, adapta solo con HTML/CSS y documenta cualquier variante que exija TS. Conserva Sidenav/Body, filtros, fullscreen, tablas y diálogo, incluidos overlays y ng-content.

Consulta [05 Skeletons](05-skeleton-patterns.md), [06 Gráficos](06-chart-guidelines.md), [08 Protección](08-protected-components.md) y [09 QA](09-visual-qa-checklist.md).
