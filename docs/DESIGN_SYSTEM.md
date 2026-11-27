# Sistema de diseño CANVIA — Aurora Enterprise UI

**Versión documental:** 2.0 · **Fecha:** 27/11/2026  
**Estado:** estándar objetivo aprobado, consolidado en Fase 1.6; implementación y QA pendientes.

## Alcance y fuentes de verdad

Este documento fija la identidad y especificaciones visuales de CANVIA. El [PRD de modernización](requirements/NN_modernizacion_frontend_ux_ui_PRD.md) fija alcance, requisitos, restricciones, orden y aceptación; la [skill canvia-design-system](../.agents/skills/canvia-design-system/SKILL.md) fija procedimientos operativos. El código vigente, diff y pruebas ejecutadas acreditan el estado real. No se presentan estos tokens como instalados ni se declara cumplimiento visual o funcional.

Durante esta modernización solo se autorizan cambios visuales HTML/CSS/SCSS y documentación en el alcance de cada tarea. TypeScript, backend, datos, reglas de negocio, rutas, servicios, funciones y todas las exportaciones quedan protegidos. La invocación de una skill no autoriza editar. Si hay contradicción, no ampliar alcance: registrar y resolver mediante autorización explícita.

## Identidad visual

### Objetivo aprobado

CANVIA — Aurora Enterprise UI utiliza la variante Aurora Light: una interfaz empresarial, tecnológica y luminosa. Aurora / Mesh Gradients es el estilo protagonista, con presencia visible en fondos y encabezados; los datos conservan superficies claras.

Usa verde, menta y naranja como ambiente, Roboto como familia principal, Sidenav Aurora Deep; evita glassmorfismo excesivo y no adoptes glassmorfismo como estilo independiente. Mantén densidad operativa, información legible, secciones, orden funcional y acciones existentes. La rejilla modular responde al contenido real; Bento no es una segunda dirección estética aprobada ni autoriza a inventar paneles o cambiar su alcance.

No implementes modo oscuro completo. No uses fotografías decorativas en dashboards ni los conviertas en landing pages comerciales. Login y Landing admiten Aurora de alta presencia sin añadir contenido o comportamientos ajenos a lo autorizado.

### Relación con frontend-skill

Conserva la versión oficial histórica instalada; esta skill no la modifica ni necesita cargarla en todas las tareas.

| Orientación genérica | Adaptación aprobada para CANVIA |
| --- | --- |
| Preferencia por interfaces sin tarjetas | Las tarjetas analíticas están permitidas cuando agrupan datos o controles útiles. Evita envoltorios redundantes. |
| Evitar gradientes decorativos en aplicaciones | Aurora es identidad aprobada y debe ser visible en fondo y encabezados, conservando claridad en gráficos y tablas. |
| Preferencia por un solo acento | Se mantienen verde y naranja corporativos; los colores de datos conservan su semántica actual. |
| Imágenes como ancla visual | No añadir fotografías decorativas a dashboards. |
| Preferencia por Framer Motion | No introducir Framer Motion ni otras librerías; usar CSS dentro de los límites existentes. |
| Jerarquía, composición y movimiento intencional | Aplicar estos principios sin cambiar funcionalidades, textos de negocio ni orden funcional. |

angular-developer y playwright podrán utilizarse cuando estén instaladas, disponibles y autorizadas. No las consideres requisitos de ejecución de canvia-design-system ni las instales automáticamente.


#### Intensidad y composición

Aurora es protagonista en el fondo y encabezados; alta en Login y Landing, media-alta en navegación, moderada en KPI y baja en filtros, diálogos y contenedores analíticos. Las tablas son sólidas y los skeletons neutros. Aurora no alcanza reportes descargables. No hay animación ambiental permanente.

Jerarquía orientativa: encabezado → filtros → KPI → insights → gráficos → tablas → análisis, solo cuando esas secciones ya existan. Preservar orden funcional y estructura necesaria para los datos.

## Design Tokens

Estos valores son el estándar objetivo aprobado; documentarlos aquí no los instala en el frontend. Al implementarlos con autorización, usa nombres semánticos consistentes con prefijo canvia dentro de un ámbito que excluya las exportaciones; no añadas automáticamente variables a :root o body.

### Color

| Familia | Token | Valor |
| --- | --- | --- |
| Brand | orange | #FF620F |
| Brand | orange-soft | #FFB184 |
| Brand | orange-light | #FFF1E7 |
| Brand | green | #16835B |
| Brand | green-soft | #63B891 |
| Brand | green-deep | #003421 |
| Aurora | emerald | #34D399 |
| Aurora | mint | #D1FAE5 |
| Aurora | sage | #A8DCC2 |
| Aurora | peach | #FFCFAB |
| Aurora | amber | #FFD89C |
| Aurora | cream | #FFF5EB |
| Surface | page | #F7F9FB |
| Surface | card | #FFFFFF |
| Surface | green | #F2FCF5 |
| Surface | orange | #FFF8F3 |
| Surface | muted | #F2F4F7 |
| Text | primary | #101828 |
| Text | secondary | #475467 |
| Text | muted | #667085 |
| Text | disabled | #98A2B3 |
| Text | brand | #12633F |
| Border | default | #E5E9EE |
| Border | control | #98A2B3, sujeto a contraste suficiente |
| Focus | default | #12633F |

Convención de nombres: --canvia-brand-orange, --canvia-aurora-emerald, --canvia-surface-page, --canvia-text-primary, --canvia-border-default y --canvia-focus. No confundas un color decorativo Aurora con una condición SLA o una serie existente.

| Estado semántico | Primer plano | Fondo |
| --- | --- | --- |
| Success | #12633F | #E7F5EC |
| Warning | #9A3412 | #FFF1E7 |
| Error | #B42318 | #FEF3F2 |
| Info | #175CD3 | #EFF8FF |
| Neutral | #475467 | #F2F4F7 |

El color aprobado no acredita contraste en todas las combinaciones. Verifica fondo efectivo, transparencia, estados y foco; usa superficie sólida cuando sea necesario. No cambies colores semánticos actuales de gráficos ni reglas de negocio.

### Paleta de gráficos existente

| Token de referencia | Valor |
| --- | --- |
| chart-amber | #D97706 |
| chart-yellow | #F4C95D |
| chart-green-dark | #12633F |
| chart-green-light | #A8DCC2 |

Referencias históricas de la paleta de datos. No reasignar colores internos ni introducir cambios de Chart.js; preservar significados, leyendas y contraste.

### Gradientes radiales multicapa

Las siguientes composiciones son referencias documentales. Mantén Aurora visible sin animación permanente de fondo. Aurora Light utiliza intensidad esmeralda 70%, naranja 55% y verde suave/menta 45%. Las tarjetas pueden usar blanco al 94%; tablas, diálogos y superficies que lo necesiten serán sólidos.

#### Aurora Light — fondo principal

```css
radial-gradient(ellipse at 10% 0%, rgba(52,211,153,.70), transparent 65%),
radial-gradient(ellipse at 100% 0%, rgba(255,98,15,.55), transparent 65%),
radial-gradient(ellipse at 90% 100%, rgba(99,184,145,.45), transparent 70%),
#F7F9FB
```

#### Aurora Emerald — predominio verde

Composición de referencia derivada de los tokens aprobados; pendiente de validación visual en Home, sin introducir nuevos colores:

```css
radial-gradient(ellipse at 10% 0%, rgba(52,211,153,.70), transparent 65%),
radial-gradient(ellipse at 100% 0%, rgba(99,184,145,.45), transparent 65%),
radial-gradient(ellipse at 90% 100%, rgba(209,250,229,.45), transparent 70%),
#F7F9FB
```

#### Aurora Sunset — predominio cálido

Composición de referencia derivada de los tokens aprobados; pendiente de validación visual en Home:

```css
radial-gradient(ellipse at 100% 0%, rgba(255,98,15,.55), transparent 65%),
radial-gradient(ellipse at 10% 0%, rgba(255,207,171,.45), transparent 65%),
radial-gradient(ellipse at 90% 100%, rgba(255,216,156,.45), transparent 70%),
#FFF5EB
```

#### Aurora Deep — navegación y contraste puntual

```css
radial-gradient(ellipse at 0% 0%, #16835B, transparent 75%),
#003421
```

No copies estos fondos a reportes, canvas, tablas densas o documentos exportables. No apliques opacity al ancestro completo de una tarjeta: la transparencia de superficie no debe atenuar texto y controles.

### Tipografía

Familia: Roboto, Arial, sans-serif. No cambiar las fuentes locales protegidas de reportes. Usa font-variant-numeric: tabular-nums para cifras donde sea compatible.

| Uso | Tamaño | Peso |
| --- | --- | --- |
| Display | 40px | 700 |
| Page title | 34px | 700 |
| Section title | 24px | 600 |
| Card title | 18px | 600 |
| Subtitle | 16px | 500 |
| Body | 14px | 400 |
| Table | 13px | 400 |
| Caption | 12px | 500 |
| KPI | 34px | 700 |
| KPI compact | 28px | 700 |

No fuerces estos valores dentro de canvas o configuraciones TS. Los títulos móviles usan 26–28px según el patrón de encabezado.

### Espaciado

Escala: 4, 8, 12, 16, 20, 24, 32, 40, 48 y 64px.

| Uso | Valor |
| --- | --- |
| Padding dashboard | 24px |
| Padding móvil | 16px |
| Gap tarjetas | 20px |
| Padding tarjetas | 24px |
| Gap secciones | 32px |

### Radio y elevación

| Radio | Valor |
| --- | --- |
| XS | 4px |
| SM | 8px |
| MD | 12px |
| LG | 16px |
| XL | 24px |
| Full | 999px |

Radio general de tarjetas: 16px. Los diálogos tienen el radio específico de 20px del patrón de componente; no lo conviertas en un nuevo valor general.

| Nivel | Sombra |
| --- | --- |
| 0 | none |
| 1 | 0 2px 8px rgba(16,24,40,.06) |
| 2 | 0 6px 18px rgba(16,24,40,.09) |
| 3 | 0 16px 40px rgba(16,24,40,.14) |

#### Controles, superficies y contraste

Usar naranja con texto oscuro; verde primario con texto blanco si el contraste efectivo es suficiente; verde profundo para foco. El borde de control #98A2B3 es una referencia condicionada: no asumir que alcanza el contraste de controles. Usar un borde de mayor contraste si la prueba de la combinación real lo requiere. Mantener estados disabled y focus existentes.

### Responsive

Desktop First con referencias de 480, 768, 1024, 1280, 1440 y 1920px. Son puntos de adaptación visual, no una autorización para cambiar lógica o breakpoints en TypeScript. Conserva el umbral de 768px usado por Body y Sidenav mientras exista en el código.

Mantén scroll local de tablas y gráficos densos. No reduzcas texto o datos para encajar una composición; adapta columnas y superficies sin cambiar orden funcional ni alcance de filtros.

## Patrones de componentes

Aplica estos patrones a los componentes existentes mediante HTML, CSS o SCSS autorizados. Conserva inputs, outputs, eventos, expresiones, condiciones disabled, formularios y referencias de plantilla. Las medidas son objetivos visuales sujetos a contenido legible; no autorizan recortes ni cambios funcionales.

### Sidenav y layout

| Componente | Patrón |
| --- | --- |
| Sidenav | Aurora Deep; texto blanco; acento activo #FFB184; iconos existentes 20–22px; texto 14px; opciones 44–48px; radio activo 12px. |
| Layout | Aurora Light; padding 24px y móvil 16px; gap de tarjetas 20px; secciones 32px; tarjetas claras de radio 16px. |
| Encabezados | Título 34px/700, móvil 26–28px; descripción 14px; separación inferior 24px; conservar botones y acciones. |

Preserva expansión, contracción, navegación y compensación de Body. No cambies las animaciones o breakpoints TS del sidenav para alcanzar una medida visual.

### KPI Cards

Variantes visuales: Neutral, Aurora Emerald, Aurora Sunset y Aurora Deep puntual. Valor 34px/700, compacto 28px/700; etiqueta 14px/500; descripción existente 12px; iconos existentes 20–24px; padding 24px; radio 16px; mínimo orientativo 136px; elevación 1.

El KpiCard actual acepta color orange o green y no contiene un input de carga. Representa variantes mediante clases HTML/CSS acotadas, sin ampliar inputs o tipos TS. No añadas descripciones, tendencias, sparklines, métricas o iconos que no existan. Si una variante exige TS o cambia semántica, registra la limitación.

### Controles

| Componente | Patrón |
| --- | --- |
| Filtros | Altura 44–48px; radio 12px; texto 14px; etiquetas 12–13px; gap 16px; foco visible de 2px. |
| Botones | Altura 44px; radio 12px; primario verde; acento naranja con texto oscuro; secundarios claros; foco visible; hover 120ms. |
| Formularios | Contenedor radio 24px; campos 44–48px; etiquetas 14px; gap 16–20px; errores 12–13px; botón primario verde. |
| Login | Aurora Light de alta presencia, conservando formulario, eventos y validaciones actuales. |

Mantén Angular Material y Reactive Forms existentes, selección automática o manual vigente y alcance global/dinámico/local de cada filtro. No añadas botones de limpiar o reintentar, cambies disabled ni corrijas el envío del login como parte de un ajuste visual.

El tema Material se trabaja en SCSS únicamente si está autorizado y su ámbito no afecta a reportes. No cambies providers o módulos TS ni selectores internos globales como atajo. Los overlays deben respetar los límites de [08 Componentes protegidos](../.agents/skills/canvia-design-system/references/08-protected-components.md); si aislarlos requiere una modificación TS, documenta ese punto sin realizarla.

### Gráficos

Contenedor claro al 94% o sólido, radio 16px, padding 20–24px, título 18px/600. Altura habitual 250–300px; complejos 330px o más según contenido y geometría existente.

Modifica solo la presentación exterior permitida. Conserva opciones, colores semánticos, datos, interacciones y animaciones internas. Lee [06 Gráficos](#gráficos).

### Tablas y diálogos

| Componente | Patrón |
| --- | --- |
| Tablas | Blanco sólido; cabecera neutra o verde muy suave de 44px; filas 44–48px y compactas 36–40px; texto 13px; separadores #E5E9EE; hover #F2FCF5; radio 16px. |
| Cifras | Alineación derecha cuando corresponda y tabular-nums, sin alterar formato, unidades ni redondeos. |
| Diálogos | Blanco sólido; radio 20px; padding 24px; título 20–24px; elevación 3; animación CSS 250ms solo si es compatible. |

Conserva búsqueda, ordenamiento, paginación, selección y fullscreen. No cambies límites de filas, datasets ni filtros. Preserva apertura, cierre, foco y proyección existentes del diálogo, incluido ng-content cuando interviene en fullscreen.

### Estados

Distingue visualmente loading, success, warning, error, information, empty y disabled cuando existan realmente. No simules progreso ni confirmaciones. Reutiliza mensajes y acciones disponibles; si no hay un estado compatible, no añadas una propiedad TS.

No uses filas skeleton como registros reales ni emitas métricas de muestra. Para placeholders consulta [05 Skeletons](#skeleton-loading-system).

#### Distribución responsive orientativa

| Elemento | Escritorio | Tablet | Móvil |
| --- | --- | --- | --- |
| KPI | 3–4 por fila según cantidad | 2 | 1–2 |
| Filtros | Horizontal | Varias filas | Vertical |
| Gráficos | 1–2 por fila | Según espacio | 1 por fila |
| Tablas | Ancho disponible | Scroll localizado | Scroll localizado |
| Diálogos | Centrados | Adaptables | Ancho disponible |
| Encabezados | Acciones horizontales | Flex wrap | Vertical |
| Sidenav | Comportamiento actual | Comportamiento actual | Comportamiento actual |

Las dimensiones se adaptan al contenido y a la navegación existente; verificar también fullscreen.

## UX y motion

### Principios UX aplicados a CANVIA

Estas prioridades orientan decisiones visuales; no conceden permiso para crear funciones, eliminar controles o cambiar el orden funcional.

| Prioridad | Principio | Aplicación práctica |
| --- | --- | --- |
| Muy alta | Doherty Threshold | Mostrar feedback con los estados reales al comenzar una operación; no prometer tiempos de backend ni retrasar resultados para lucir una animación. |
| Muy alta | Fitts's Law | Usar objetivos de interacción legibles de las alturas aprobadas; conservar sus eventos y separación. |
| Muy alta | Hick's Law | Mejorar agrupación y jerarquía de filtros existentes; no retirar opciones ni inventar menús. |
| Muy alta | Von Restorff Effect | Destacar acción o selección relevante con acentos CANVIA; preservar colores y significados de SLA. |
| Muy alta | Timing | Ajustar transiciones al tipo de feedback y mostrar cada recurso cuando esté listo. No sincronizar datos independientes por decoración. |
| Muy alta | Frequency of Use | Dar legibilidad y acceso visual claro a acciones frecuentes, conservando navegación y funciones vigentes. |
| Alta | Origin Awareness | Mantener relación visual entre control, sección actualizada y selección; conservar contenedores de fullscreen y proyección. |
| Alta | Slow In, Slow Out | Usar el easing aprobado en transiciones CSS permitidas, sin alterar animaciones TS. |
| Alta | Interruptible Motion | Preferir transiciones CSS que puedan cambiar de estado sin bloquear controles o ignorar nuevas selecciones. |
| Alta | Peak-End Rule | Mantener claros el resultado final y los errores reales; no fabricar confirmaciones, éxito o recuperación. |

### Motion Design System

| Uso | Duración |
| --- | --- |
| Feedback inmediato | 80ms |
| Hover | 120ms |
| Estados | 150ms |
| Filtros | 200ms |
| Sidenav | 250ms |
| Diálogos | 250ms |
| Contenido | 300ms |
| Skeleton shimmer | 1600ms |

Easing: cubic-bezier(0.2, 0.7, 0.2, 1).

Estas duraciones gobiernan motion CSS nuevo autorizado; no son temporizadores de solicitudes, tiempos mínimos de carga o permiso para reescribir motion ya definido en TS. En Sidenav o diálogos donde el comportamiento actual pertenece a TS, conserva ese código y documenta cualquier discrepancia.

Prioriza transform y opacity cuando sean apropiados. Evita transition: all, cambios animados de anchura/altura que desplacen datos, animaciones decorativas permanentes y fondos Aurora animados. No añadas movimiento de entrada repetido en cada actualización si produce parpadeo.

Respeta prefers-reduced-motion: reduce deslizamientos y elimina shimmer y movimiento no esencial mediante CSS; el skeleton permanece estático. No declares cobertura completa si una animación TS fuera del alcance sigue sin adaptarse.

No introduzcas Framer Motion ni librerías de motion. No cambies la animación interna de Chart.js, sus callbacks o sus opciones TS.

### Legibilidad y accesibilidad

Mantén foco visible, contraste WCAG 2.2 AA como objetivo y estado comprensible sin depender solo del color. Comprueba el fondo real bajo superficies transparentes, títulos y controles. No describas la paleta aprobada como certificación automática.

Las mejoras HTML/CSS deben conservar el comportamiento actual. Si una alternativa de teclado, control de foco o feedback requiere TS o una función nueva, documenta esa limitación y solicita autorización específica solo cuando no exista ya.

## Skeleton Loading System

### Límite de implementación

Los skeletons se implementan exclusivamente en las plantillas de los componentes padres mediante HTML y clases CSS reutilizables. Reutiliza estados de carga existentes.

No crees componentes Angular, directivas, pipes, servicios, inputs, propiedades TS, módulos o registros para este sistema. No cambies solicitudes HTTP, sus filtros, concurrencia, cancelación, timeouts o disparadores. No añadas skeletons a reportes descargables ni paneles comentados.

La reutilización corresponde a las clases y patrones de markup, no a un nuevo componente Angular. Los hijos siguen presentando los datos y emitiendo sus eventos actuales.

### Tokens y variantes

| Token | Valor |
| --- | --- |
| Base | #E5E9EE |
| Highlight | #F7F9FB |
| Shimmer | 1600ms |
| Radio de bloque | 6px |
| Radio de contenedor | 16px |
| Tabla | 3–5 filas ilustrativas |

| Variante | Geometría de referencia |
| --- | --- |
| KPI | Espacio del valor, etiqueta e icono existentes; conservar el tamaño de la tarjeta. |
| Gráfico de barras | Área del gráfico y cabecera exterior, sin series o cifras ficticias. |
| Donut | Anillo decorativo y zonas de leyenda acordes con el bloque actual. |
| Tabla | Cabecera y 3–5 filas decorativas; no registros, totales o paginación falsos. |
| Insights | Líneas neutras representativas, sin fabricar conclusiones. |
| Lista | Filas de longitud variada con dimensiones estables. |
| Historial de chat | Lista de conversaciones durante su consulta inicial. |

Estas formas no sustituyen los datos ni se exportan. Evita que un skeleton y el loader ya presente anuncien dos veces la misma carga.

### Elegir la representación

| Estado real disponible | Acción visual permitida |
| --- | --- |
| Cargando y sin datos disponibles | Mostrar el skeleton correspondiente con geometría reservada. |
| Actualizando con datos disponibles | Conservar contenido y usar un indicador discreto solo si los bindings existentes permiten identificar ese estado con coherencia. |
| Respuesta vacía válida | Mostrar el estado vacío existente; el skeleton debe desaparecer. |
| Error conocido | Conservar el mensaje y acciones existentes; no ocultarlos con placeholders. |
| Recurso listo y otros pendientes | Mostrarlo sin esperar al resto cuando la estructura actual lo permita. |
| Generación IA, envío o importación | Conservar indicadores de operación reales; no convertirlos en porcentajes o datos fingidos. |

No deduzcas que los datos corresponden al filtro actual solo porque el array no está vacío. Si el código no expone estado inicial/actualización, error o vigencia suficientes, documenta esa limitación. No añadas flags o lógica TS para satisfacer este patrón.

No uses CSS para fingir que terminó una consulta ni temporizadores para retrasar datos. No impongas una duración mínima del shimmer. Evita desmontar hijos o mover sus referencias de plantilla como efecto lateral de cambiar condiciones.

### Accesibilidad y movimiento

Oculta las formas decorativas a tecnologías de asistencia y reutiliza un mensaje de estado accesible por sección. aria-busy puede vincularse a un booleano existente cuando corresponda; no bloquees toda la página por una carga local.

Con prefers-reduced-motion, elimina el shimmer y conserva las formas estáticas. Mantén contraste suficiente y evita destellos. La geometría debe verificarse en escritorio, móvil y fullscreen; su reserva por CSS no demuestra ausencia de saltos.

### Mapa de aplicación y evidencia

El mapa completo por página, incluyendo intensidad Aurora, estados observados y alternativas a skeleton, está en [07 Módulos](#aplicación-por-módulo). Consulta solo la fila del módulo afectado y verifica su código actual.

Puntos de partida desde la raíz del repositorio:

- Home: home.ts, cargandoResumen/errorResumen y una respuesta agregada; home.html oculta contenido mientras carga. No inventar carga HTTP progresiva por bloques.
- Tareas/Cambios: diccionarios cargas/errores y helpers de consulta en sus padres; no modificar esos helpers.
- Paralelos: estados por sección y agregados compartidos entre tabla y gráfico; conservar su límite de concurrencia.
- Tiempos y Categorización: los datos del dashboard y protocolos de reportes comparten padres; preservarlos según [08 Protección](../.agents/skills/canvia-design-system/references/08-protected-components.md).
- Login: no existe un estado pendiente compatible en la revisión estática de Fase 0; no añadir indicador que requiera TS.
- Landing: sin skeleton si no hay consultas. Importaciones: mantener procesamiento por archivo; solo considerar skeleton para datos asíncronos reales que lo justifiquen.

No arregles como parte de este sistema el doble disparador del login, las consultas de paneles comentados o errores funcionales preexistentes. Regístralos fuera de alcance.

## Gráficos

### Ámbito permitido

Moderniza el contenedor y su presentación HTML/CSS: superficie clara al 94% o sólida, radio 16px, padding 20–24px, título 18px/600 y geometría legible.

Altura habitual 250–300px; complejos 330px o más según necesidad. Conserva las dimensiones que dependen de cálculos TS, comportamiento responsive actual y fullscreen; no fuerces una altura que recorte etiquetas o cambie las proporciones funcionales.

No coloques Aurora intensa o glassmorfismo bajo datos densos. Los gráficos conservan superficies claras y contraste suficiente.

### Configuración interna protegida

No modifiques archivos TypeScript, Chart.js defaults ni las opciones por instancia definidas en TS. Preserva:

- Series, datasets, orden, valores, denominadores y cálculos.
- Colores semánticos actuales, umbrales SLA y significados de leyendas.
- Datalabels, fuentes internas, tooltips y formatos.
- Animaciones internas y plugins.
- Eventos de selección, callbacks y filtros dinámicos.
- Escalas, límites, ejes y reglas de agregación.

El objetivo tipográfico general no autoriza a cambiar texto dibujado en canvas o su configuración TS. Si una mejora requiere esos cambios, documenta la limitación sin implementarla.

### Padres e hijos

Los padres coordinan solicitudes y filtros; los gráficos reciben datos y emiten las selecciones ya existentes. No añadas peticiones desde el hijo ni dupliques consultas para separar skeleton y gráfico.

En Paralelos, tablas y gráficos de una dimensión comparten arrays; conserva esta relación. En volume-month, el filtro mensual y su evento pertenecen al contrato existente. El skeleton del contenedor debe respetar esos contratos.

Comprueba referencias de fullscreen, ng-content y selectores CSS de padres antes de cambiar wrappers o clases. Las reglas ::ng-deep existentes no autorizan reglas globales nuevas sobre canvas, svg o .chart-card.

### Reportes y validación

Las configuraciones de pantalla y las exportaciones deben permanecer separadas. No reutilices el CSS protegido de reportes, no les apliques tokens nuevos y no cambies sus gráficos HTML/SVG/CSS.

Lee [08 Protección](../.agents/skills/canvia-design-system/references/08-protected-components.md) para dependencias y [09 QA](../.agents/skills/canvia-design-system/references/09-visual-qa-checklist.md) para comparar tamaños, tooltips, etiquetas, selección, fullscreen y regresiones con datos controlados cuando la validación esté autorizada.

## Aplicación por módulo

### Lectura del mapa

Aurora Light es la identidad común. La intensidad corresponde al fondo y encabezados, no a degradados dentro de tablas o gráficos. Home es la página piloto aprobada.

Las rutas parten de fronted-tickets/src/app/components/pages/. Los estados indicados son observaciones estáticas de Fase 0: compruébalos de nuevo al ejecutar una tarea. No afirman funcionamiento ni autorizan TS.

| Página | Presencia Aurora | Estado observado y aplicación de carga |
| --- | --- | --- |
| home | Alta | home.ts: cargandoResumen/errorResumen; una respuesta agregada. Skeleton de KPI, gráficos y resumen desde el padre; no prometer progreso HTTP independiente. |
| incident-consolidated | Media-alta en layout y encabezados | Booleanos por KPI, gráficos y tablas, contadores de solicitud y cuatro protocolos de reporte. Skeleton solo en paneles activos; preservar exportaciones. |
| requirement-consolidated | Media-alta en layout y encabezados | Cargas por consulta, cancelación y versiones. Skeleton de KPI, gráficos y tablas activos. Productividad, dotación y actualizaciones manuales contienen paneles comentados. |
| incident-sla | Moderada | Booleanos por consultas de KPI, gráficos y tablas; usar variantes de barras/donut solo donde haya un gráfico activo de ese tipo. Preservar semántica SLA y errores existentes. |
| requirement-sla | Moderada | Carga de filtros, booleanos y diccionario de nuevos gráficos; control de versiones. Skeleton de KPI, gráficos y tablas; sin cambios de significado o solicitudes. |
| incident-cause-analysis | Moderada | Cargas de atribución, causas, tipos, servidores, proyectos, resolutores y narrativa IA. Skeleton de gráficos, insights y tablas activos; conservar mensaje de generación IA y claridad de hallazgos. KPI generales comentados: no reactivarlos. |
| requirement-categorization-audit | Moderada | Resumen, resolutores, estadísticas, motivos, tickets y estado de ejecución; sinResultados/404 en flujos concretos. Skeleton por datos reales; priorizar lectura de resultados y preservar reporte. |
| change-consolidated | Moderada y operativa | Diccionarios cargas/errores y estados por detalle; panel de actividades/horas comentado. Skeleton solo para KPI, gráficos y tablas activos. |
| task-consolidated | Moderada y operativa | Diccionarios cargas/errores, versiones y carga agregada derivada. Skeleton por recurso, sin crear otro coordinador TS. |
| tickets-parallel-analysis | Moderada | Estados por sección, versiones, cancelación y cola de dos consultas. Tabla y gráfico comparten agregados. Skeleton por dimensión; tablas y diálogo sólidos. |
| tickets-report-times | Moderada | Seis recursos de dashboard con sus errores; snapshot y exportación independientes. Skeleton de KPI, volumen, tablas y gráficos; cifras legibles y reporte intacto. |
| daily-report | Moderada | Carga conjunta de KPI/diario/resumen y consultas separadas de proyectos/Top. Skeleton de KPI, gráficos y tablas según contenido activo, sin inventar estados por endpoint. |
| ai-chat | Alta | cargandoConversaciones, cargandoConversacion y enviando. Skeleton de historial/conversación al cargar; mantener feedback de respuesta y superficies legibles. |
| importaciones | Moderada | Estados de módulo/archivo y cola secuencial. Conservar indicadores de procesamiento; skeleton solo para datos asíncronos reales que lo justifiquen. |
| login | Alta | No hay estado pendiente de petición compatible en el componente auditado. No añadir indicador ni nuevas condiciones que requieran TS. |
| landing | Alta | Componente sin consulta HTTP en la revisión. Sin skeleton mientras no existan consultas reales. |
| Reportes descargables | Ningún cambio | Proteger todos sus archivos, fuentes, dimensiones, datos, eventos y protocolos según referencia 08. |

No inventes métricas, tendencias, insights, layouts funcionales o contenido para ocupar una rejilla. Preserva agrupación, orden funcional, botones, filtros locales/globales/dinámicos y navegación actuales.

### Secuencia de trabajo

Home es el piloto. El orden de los doce bloques y las condiciones de ejecución se mantienen en el [PRD](requirements/NN_modernizacion_frontend_ux_ui_PRD.md).

### Evidencia de la arquitectura actual

Desde la raíz: src/app/app-routing-module.ts, app-module.ts, components/layouts/body/ y components/sidenav/ dentro de fronted-tickets/. Las páginas consultan services/ y models/ de src/app/. No migres AppModule ni añadas registros TS para cumplir el objetivo visual.

Al inspeccionar HTML distingue comentarios, contenido proyectado y montaje dinámico. El resumen ejecutivo de Incidentes se importa y crea desde incident-cause-analysis.ts; su ausencia como selector literal en HTML no lo hace prescindible.

## Protección de exportaciones

Todos los reportes descargables, incluidos los ocho inventariados, están fuera de alcance. Se conservan archivos, bindings de padres, dependencias compartidas, dimensiones, colores, fuentes, configuración de gráficos, snapshots y flujo de captura/descarga. No aplicar cambios directos ni indirectos por cascada, variables, fuentes, tema Material, ancestros o animaciones. Si no es posible aislar un cambio, detenerlo y documentar el bloqueo. El inventario, dependencias y procedimiento se mantienen en [08 Componentes protegidos](../.agents/skills/canvia-design-system/references/08-protected-components.md).

## Validación y accesibilidad

Objetivo WCAG 2.2 AA, comprobado sobre combinaciones reales de texto, fondo y controles; foco visible, teclado y estados no dependientes del color. Verificar responsive, fullscreen, carga, errores, vacío, rendimiento y regresiones. Comparar PNG antes/después con datos controlados y preservar el protocolo de exportación. Una ausencia de diff no acredita equivalencia visual. Consultar el [checklist operativo de QA](../.agents/skills/canvia-design-system/references/09-visual-qa-checklist.md) y la aceptación del PRD. Todas estas verificaciones de la aplicación quedan pendientes.

## Línea base histórica — revisión estática anterior

Esta evidencia se conserva para orientar la implementación, no representa una nueva auditoría ni prevalece sobre los estándares de Aurora anteriores. Revalidar rutas, dependencias y estado en el repositorio antes de editar.

### Componentes y estilos identificados

#### Reutilizables

- `components/kpi-card/`: componente compartido de KPI con variantes visuales `orange` y `green`.
- `components/sidenav/` y `components/layouts/body/`: navegación y contenedor/layout.
- `components/charts/project-explorer-table/` y `ticket-explorer-table/`: exploradores reutilizables para tablas/listados.
- `components/charts/Report-Diary/daily-report-chart/` y `daily-report-table/`: visualización y tabla del reporte diario.
- Las carpetas `charts/SLA`, `charts/Consolidated`, `charts/Categorization`, `charts/Home` y `charts/Report-Diary` organizan visualizaciones por dominio. Muchas son componentes específicos, no un sistema de diseño común.
- `components/pages/ai-chat/` contiene piezas separadas para sidebar, mensajes y composer.

#### Globales

- `src/styles.css` carga Roboto desde Google Fonts, establece reset global y define `.card` con fondo blanco, radio de `0.5rem` (8 px), sombra y estilos anidados de encabezado/cuerpo.
- `src/material-theme.scss` usa el tema Material 3 con paletas Angular Material Azure y Blue, tipografía Roboto y densidad 0.
- `src/app/app-module.ts` integra Angular Material, animaciones y la configuración de Chart.js.
- Los estilos de página y componente están principalmente en CSS local; no se encontró un archivo único de tokens CSS o SCSS que gobierne toda la aplicación.

### Contraste histórico con el estándar anterior

| Aspecto | Estándar anterior (no normativo) | Evidencia del frontend | Lectura |
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

### Umbrales SLA documentados anteriormente (no normativos)

El documento anterior proponía ≥95% Cumple, ≥90% y <95% Atención, <90% Bajo. No está confirmado que todos los indicadores apliquen esos límites. No modificar fórmulas, denominadores, etiquetas, colores semánticos ni umbrales para uniformar la estética. La verificación funcional de esas reglas queda fuera del alcance visual.

### Pendientes de implementación y comprobación

- Centralizar tokens en ámbito aislado; comprobar tema Material, cascada y overlays sin alcanzar reportes.
- Revalidar el comportamiento real de cada módulo, sus estados y dependencias. No modificar TS para resolver incompatibilidades.
- Comparar capturas, contraste, keyboard/focus, motion reducido, fullscreen y PNG con datos controlados.
- Confirmar si logo remoto o Google Fonts deben servirse localmente; no cambiar fuentes ni recursos sin autorización.
- Medir rendimiento y documentar excepciones en lugar de asumir mejoras.

**Historial:** versión 2.0 sustituye el objetivo visual anterior por Aurora Light; conserva evidencia histórica y distingue especificaciones aprobadas de resultados todavía pendientes.
