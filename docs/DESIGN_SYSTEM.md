# Sistema de diseño CANVIA

## Alcance

Este documento fija como estándar objetivo la paleta, jerarquía y estructura visual proporcionadas para CANVIA y las contrasta con los estilos que existen en `fronted-tickets/src/`. Los valores del estándar objetivo provienen del requerimiento de documentación; no se presentan como tokens ya centralizados en el código. La revisión fue estática, sin renderizado visual.

## Estándar visual objetivo

### Color

| Uso | Token | Valor |
|---|---|---|
| Naranja principal | `brand-orange` | `#FF620F` |
| Naranja suave | `brand-orange-soft` | `#FFB184` |
| Verde principal | `brand-green` | `#16835B` |
| Verde suave | `brand-green-soft` | `#63B891` |
| Fondo general | `surface-page` | `#F7F9FB` |
| Tarjetas/superficies | `surface-card` | `#FFFFFF` |
| Texto principal | `text-primary` | `#101828` |
| Texto secundario | `text-secondary` | `#667085` |
| Bordes | `border-default` | `#E5E9EE` |

Paleta adicional recomendada para series, categorías y estados de gráficos:

| Token | Valor |
|---|---|
| `chart-amber` | `#D97706` |
| `chart-yellow` | `#F4C95D` |
| `chart-green-dark` | `#12633F` |
| `chart-green-light` | `#A8DCC2` |

Usar el naranja y verde CANVIA para identidad y énfasis; reservar la paleta de gráficos para distinguir series. Los estados no deben depender solo del color: acompañar estados SLA con texto/etiqueta e iconografía accesible.

### Componentes y jerarquía

- Tarjetas: fondo blanco, borde sólido de 1 px, radio de 14 px y sombra mínima. Evitar sombras decorativas fuertes.
- Título de página: 32–34 px.
- Título de tarjeta: 17–18 px.
- Valor KPI: 26–30 px; etiqueta de KPI secundaria y legible.
- Gráficos: altura habitual de 250–300 px; hasta 330 px para visualizaciones complejas. Mantener comportamiento responsive y permitir desbordamiento/scroll explícito en gráficos tabulares o series extensas.
- Orden de contenido sugerido: **Header → Filtros → KPIs → Insights → Gráficos → Tablas → Análisis**. Es una guía de composición, no una afirmación de que cada pantalla actual tenga todas esas secciones.

### Umbrales visuales SLA deseados

| Cumplimiento | Estado objetivo | Color objetivo |
|---|---|---|
| ≥ 95 % | Cumple | Verde CANVIA `#16835B` |
| ≥ 90 % y < 95 % | Atención | Naranja CANVIA `#FF620F` |
| < 90 % | Bajo | Rojo de estado, a normalizar como token semántico |

Los umbrales anteriores son el estándar solicitado. El código revisado no permite afirmar que exista una única regla central que los aplique a todos los gráficos, tablas y KPI de SLA; confirmar cada indicador antes de tratarlo como comportamiento funcional.

## Componentes y estilos identificados

### Reutilizables

- `components/kpi-card/`: componente compartido de KPI con variantes visuales `orange` y `green`.
- `components/sidenav/` y `components/layouts/body/`: navegación y contenedor/layout.
- `components/charts/project-explorer-table/` y `ticket-explorer-table/`: exploradores reutilizables para tablas/listados.
- `components/charts/Report-Diary/daily-report-chart/` y `daily-report-table/`: visualización y tabla del reporte diario.
- Las carpetas `charts/SLA`, `charts/Consolidated`, `charts/Categorization`, `charts/Home` y `charts/Report-Diary` organizan visualizaciones por dominio. Muchas son componentes específicos, no un sistema de diseño común.
- `components/pages/ai-chat/` contiene piezas separadas para sidebar, mensajes y composer.

### Globales

- `src/styles.css` carga Roboto desde Google Fonts, establece reset global y define `.card` con fondo blanco, radio de `0.5rem` (8 px), sombra y estilos anidados de encabezado/cuerpo.
- `src/material-theme.scss` usa el tema Material 3 con paletas Angular Material Azure y Blue, tipografía Roboto y densidad 0.
- `src/app/app-module.ts` integra Angular Material, animaciones y la configuración de Chart.js.
- Los estilos de página y componente están principalmente en CSS local; no se encontró un archivo único de tokens CSS o SCSS que gobierne toda la aplicación.

## Contraste con la implementación actual

| Aspecto | Estándar objetivo | Evidencia del frontend | Lectura |
|---|---|---|---|
| Marca primaria | Naranja `#FF620F`, verde `#16835B` | Ambos aparecen en `kpi-card.css`, chat y varios componentes de productividad. | Alineación parcial y localizada. |
| Superficies y tipografía | `#F7F9FB`, blanco, `#101828`, `#667085` | Aparecen en páginas de tareas, tablas de productividad y chat; Roboto se define globalmente. | Alineación parcial, tokens repetidos localmente. |
| Bordes y tarjetas | Borde 1 px, radio 14 px, sombra mínima | `project-explorer-table.css` usa borde/radio 14 px y sombra suave. `.card` global usa 8 px y sombra más visible; `kpi-card` tiene borde transparente y hover con sombra más fuerte. | Variación entre componentes; el estándar aún no está uniformado. |
| Títulos | Página 32–34 px; tarjeta 17–18 px | KPI usa título de 14 px y valor de 28 px; tablas/gráficos de productividad usan 17–18 px en algunos encabezados. | KPI coincide en valor, pero no en etiqueta; títulos de página no se verificaron como regla compartida. |
| Gráficos | 250–300 px, complejo hasta 330 px | Hay alturas de 250, 290, 300 y 330 px; se observan también mínimos o alturas de 360–390 px en ciertos gráficos y componentes de listas. | La altura no está normalizada; distinguir lienzo, contenedor y tabla scrollable al armonizar. |
| Paleta de gráficos | `#D97706`, `#F4C95D`, `#12633F`, `#A8DCC2` | Se usan varios de esos colores, especialmente `#F4C95D`, `#D97706`, `#12633F` y `#A8DCC2`; también aparecen rojos y naranjas alternativos como `#D95C4F` y `#FF8A42`. | Existe una familia coherente, pero no una paleta única central. |
| Navegación | Naranja/verde CANVIA | `sidenav.css` usa verde oscuro `#003421` y naranja `#FF5300`. | Diferente del naranja primario objetivo; revisar si es una variante de marca aprobada o legado. |
| Tema Material | Paleta CANVIA | `material-theme.scss` usa Azure/Blue de Angular Material. | Los componentes Material pueden divergir de los tokens CANVIA; no se encontró una paleta Material personalizada. |
| Umbrales SLA | Verde ≥95 %, naranja ≥90 % y <95 %, rojo <90 % | La revisión no confirmó una regla única compartida que aplique exactamente esos límites en todas las vistas. | Mantener los umbrales como objetivo hasta validar los cálculos/indicadores de cada componente. |
| Orden de pantalla | Header → Filtros → KPIs → Insights → Gráficos → Tablas → Análisis | Las páginas son específicas por dominio y combinan elementos en distinto orden; la estructura no aparece como plantilla compartida única. | Adoptar como patrón objetivo, no describir como implementación actual. |

## Recomendaciones de consistencia

1. Tratar la paleta solicitada como fuente de verdad y centralizarla en variables CSS/SCSS cuando se autorice trabajo de frontend.
2. Resolver la relación entre `src/styles.css` y el tema Material para que los tokens de marca se apliquen también a componentes Material.
3. Acordar si los colores de navegación `#003421` y `#FF5300` son variantes aprobadas; conservarlos como excepción documentada o alinearlos en una modificación futura.
4. Unificar tarjetas (borde, radio, sombra), tamaños de título y alturas de gráfico por tipo de componente, respetando tablas con scroll y visualizaciones densas.
5. Centralizar los umbrales SLA en el contrato de negocio y revisar que texto, color y significado sean consistentes en KPI, tablas y leyendas.
6. Comprobar contraste, navegación por teclado y lectura de estados sin depender únicamente del color en una validación visual/accesible posterior.

## Pendiente de validación

- Confirmar que la paleta y métricas indicadas son el estándar aprobado para todas las vistas CANVIA.
- Revisar capturas/renderizado a escritorio y móvil; este documento no incluye QA visual ejecutado.
- Confirmar estados SLA exactos por cada indicador y qué significa el denominador de cumplimiento.
- Acordar tokens semánticos para rojo, warning, éxito, información, disabled y focus.
- Determinar si el logo remoto y la fuente Google Fonts deben servirse localmente para entornos restringidos o sin salida a internet.
