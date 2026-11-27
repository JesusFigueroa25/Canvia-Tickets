Necesita realizar una nueva implementación.

0. Resumen Ejecutivo Mensual, de los tickets Incidentes y Requerimientos.

1. Quienes son los que estuvieron trabajando en paralelo, ósea que resolutores o especialistas del Grupo Resolutor "BASE DE DATOS Y EBS". 
Se hara estos 4 componentes, 1 grafico y 3 tablas:

- 1 Tabla Resumen Mensual Tickets en paralelo por Resolutor
Fila: Resolutor
Columnas: Meses
Totales: 1 Fila y  1 Columna
Datos: Cantidad de Tickets en paralelo
Filtro Local (Tipo de Ticket)
Un buscador, solo nivel fronted, te pasare los comp hijos para que te guíes (Resolutor)
Componente de referencia (Detalle de Tiempos por Resolutor)[app-report-times-resolver-table]


- 2 Grafico del Top de Resolutores con mas tickets en Paralelo por Mes (se basa de Detalle de Tickets en paralelo por Mes y Resolutor)
Gráfico de barras horizontales ordenado
Eje Y (vertical): Los nombres de los resolutores.
Eje X (horizontal): mide el valor numérico ("Cantidad", del 0 al 800).
Segmentación por colores (apilado): cada barra completa representa el total de tickets en paralelo del resolutor, pero está dividida en bloques de distintos colores (meses).
Etiqueta de total al final: indica la suma de todos los segmentos de esa barra.   
Filtros Locales fronted (Tipo de Ticket, Meses)
Un buscador, solo nivel fronted, te pasare los comp hijos para que te guíes (Resolutor)
Componente de referencia (Horas Registradas por Resolutor)[app-report-times-resolver-chart]



- 3 Tabla de Explorador de Tickets en Paralelo
Se muestra Tabla de datos interactiva de los tickets que se trabajaron en paralelo.
Filas: Tickets
Columnas: Resolutor, Proyecto, Fechas, Tickets Simultáneos[cantidad], (Detalle)
Filtro Local (Tipo de Ticket)
Componente de referencia (Detalle de Tickets con Superposición)[app-requirement-parallel-details-table]

Tabla de Explorador de Tickets en Paralelo
Tabla Detalle de Tickets en paralelo.

- 4 Tabla Detalle de Tickets en paralelo.
Cuando por ejemplo el usuario da click en una fila de "Explorador de Tickets en Paralelo", 100-361822, se muestra una tabla pop up de los tickets que se trabajo en paralelo en cuestión por ejm: 100-361675 100-361808 etc., dicha tabla con las columnas mas importantes.
Componente de referencia (Explorador de Tickets)[app-ticket-explorer-table]


2. Cuales y cuantos tickets estuvieron paralelo en Estado En curso por Proyecto, ósea se estuvieron trabajaron en paralelo o al mismo tiempo del Grupo Resolutor de "BASE DE DATOS Y EBS". 
Y se manejara por el filtro local Tipo de ticket, ya sea Incidente o Requerimiento.

Aquí se implementara 1 tabla y 1 grafico.

- 1 Tabla Resumen Mensual Tickets en paralelo por Proyecto
Fila: Proyecto
Columnas: Meses
Totales: 1 Fila y  1 Columna
Datos: Cantidad de Tickets en paralelo
Filtros Locales (Tipo de Ticket, Proyectos)
Componente de referencia (Detalle de Tiempos por Proyecto)[app-report-times-project-table]


- 2 Grafico Tickets en paralelo por Proyecto y Mes
Eje X (horizontal): representa los periodos de tiempo (meses)
Eje Y (vertical): mide la magnitud en tickets en paralelo
Agrupación por series (colores): dentro de cada mes, las barras se colocan una al lado de la otra para comparar directamente el rendimiento de cada proyecto (EUROMOTORS, KOMATSU, ASOCIACION DE AFP, SAN MIGUEL FRUIT, etc.) en ese mismo periodo.
Etiquetas de datos (data labels): muestra el valor exacto encima de cada columna.
Filtros Locales (Tipo de Ticket)
Un buscador, solo nivel fronted, te pasare los comp hijos para que te guíes (Proyecto o ALP)
Componente de referencia (Horas Registradas por Proyecto y Mes)[app-report-times-project-table]



Te pasare el contexto necesario:
- Excel 1 de Octubre a  Noviembre (tickets_report_times) tickets en Proceso, ósea tickets que se abrió y se cerro de forma normal. Para agilizar la lectura, fíltralo solo por "Asignar al grupo" como [BASE DE DATOS Y EBS]. Solo que revises la información.

- Excel 2 de Octubre a Noviembre (tickets_manual_updates) tickets manuales, ósea tickets que se modifico manualmente, le dieron en Registro de Trabajo el tiempo invertido y colocado el tiempo en minutos y le dio en Enviar. Ojo los tickets ya sea incidente y requerimiento. Para agilizar la lectura, fíltralo solo por "Asignar al grupo" como [BASE DE DATOS Y EBS]. Solo que revises la información.

- Te pasare las tablas SQL y model de tickets_report_times, tickets_manual_updates, incident_consolidated, requirement_consolidated y task_consolidated
- Backends de referencia: "Análisis de Tiempos de Informes Mensuales" [tickets_report_times], "Requerimientos Consolidados"[requirement_consolidated] y "tickets_manual_updates"
- Estructura del proyecto.
- Logica de los tiempos
- ETL de tickets_manual_updates , quitar lo de eliminar duplicados.


Pasos:
0. Primero analizaras toda la información, revisaras todo el contexto inicial, me darás la info y nombre de archivo de este PRD.
Y me dirás como quedara las tablas y columnas visualmente, .

1. Si es necesario actualizar las columnas de la tabla SQL y model tickets_manual_updates  lo haremos, agregaremos:
Date_Work_Created	
work_type	
work_description	
work_time_spent_mins	
created_by_contact_id	
work_by_first_name	
work_by_last_name

Actualizaremos el ETL, que no se elimine los duplicados en tickets_manual_updates.

2. Revisaremos y definiremos las reglas de negocio, revisaremos cuales son las fechas que debemos considerar, te pasare un ejemplo de un ticket que se trabajo en paralelo, y tickets míos que modifique manualmente.
Para definir los alcances o reglas de negocios para todas los endpoints deberíamos hacer un Join de las 2 tablas SQL [tickets_manual_updates] y [tickets_report_times], con incident_consolidated, requirement_consolidated ?
Que deberíamos hacer y validar?



3. Una vez definida las reglas de negocios, haremos los endpoints en el backend de tickets_manual_updates.
Endpoints:
- Resumen Ejecutivo Mensual, de los tipos de tickets
- Tabla Resumen Mensual Tickets en paralelo por Resolutor y Grafico del Top de Resolutores con mas tickets en Paralelo por Mes, compartirán el mismo endpoint.
- Tabla de Explorador de Tickets en Paralelo
- Tabla Detalle de Tickets en paralelo.
- Tabla Resumen Mensual Tickets en paralelo por Proyecto y Grafico Tickets en paralelo por Proyecto y Mes, compartirán el mismo endpoint.

Filtros globales:
Fechas (desde) (hasta)
Grupo Resolutor [BASE DE DATOS Y EBS] por defecto.
Prioridad
Motivo
Proyectos

KPIS:
Total de Tickets
Total de Total Resolutores
Total de Proyectos


Me generaras los archivos.

4. Haremos el fronted, me generas los archivos del service y model, te pasare los ejemplos , me haces acordar.
5. Fronted, haremos el componente padre. Te pasare uno de ejemplo, el comp de KPI. Haremos los filtros, KPIS.
6. Fronted, Crearemos los componente hijos, me pasaras los comandos para crearlos:
ejm:
ng g c components/charts/Paralelos/component --skip-tests=true --standalone=false
Y me generaras los archivos.
Primero haremos los 2 primeros:
Tabla Resumen Mensual Tickets en paralelo por Resolutor y Grafico del Top de Resolutores
Luego: Tabla de Explorador de Tickets en Paralelo y Tabla Detalle de Tickets en paralelo.
Finalmente: Tabla Resumen Mensual Tickets en paralelo por Proyecto y Grafico Tickets en paralelo por Proyecto y Mes.

7. Fronted, integraremos los comps hijos al padre. Aquí lo haremos manualmente en el chat.
------------------------------------------------------------------------------------------------------------

Logica de los tiempos:


Aquí te dare la lógica de los tablas de tiempos en proceso[tickets_report_times] y manual [tickets_manual_updates], con un ticket de Incidente y Requerimiento, con sus tickets tareas.


1. Requerimiento:
Ticket: 100-360228
Tabla [requirement_consolidated]
| Ticket_ID  | Fecha_Apertura      | Fecha_Resolucion    | Fecha_Cierre | Fecha_Ultima_Modificacion |
| ---------- | ------------------- | ------------------- | ------------ | ------------------------- |
| 100-360228 | 2026-10-26 08:56:40 | 2026-10-26 17:50:37 | NULL         | 2026-10-26 17:50:37       |

[tickets_report_times]:
| Ticket_ID  | Ticket_type     | Fecha_Creacion      | Nombre_Resolutor            | Action_Start_Date   | Action_End_Date     | Horas |
| ---------- | --------------- | ------------------- | --------------------------- | ------------------- | ------------------- | ----- |
| 100-360228 | Service Request | 2026-10-26 08:56:40 | Nemberk Jesús Jara Figueroa | 2026-10-26 13:04:50 | 2026-10-26 17:50:37 | 4.76  |
| 100-360228 | Service Request | 2026-10-26 08:56:40 | Nemberk Jesús Jara Figueroa | 2026-10-26 08:57:16 | 2026-10-26 08:59:02 | 0.03  |
Total de horas: 4.79
Cada fila donde indica Action_Start_Date y Action_End_Date, quiere decir que el Resolutor, ósea yo, Le dio en Pendiente Especialista para que no corra el tiempo en el ticket padre "Requerimiento" para crearse tickets tareas.

El flujo es este:
- Yo creo el ticket a la fecha y hora: 2026-10-26 08:56:40
- Acepte asignación a las 26/10/2026 8:57, y se cambio a estado en Curso "Acción llevada a cabo: Aceptar asignación; Se ha cambiado el estado a: Activo con Código de motivo: En curso".
- Cambie de estado a "Pendiente Especialista" para que no corra el tiempo y para crear mis tickets tareas, a las 26/10/2026 8:59.
- Acepte asignación, estado a "En curso", a las 26/10/2026 13:04.
- Resolví el requerimiento, Estado "Resuelto", a las 26/10/2026 17:50
- Acción llevada a cabo: Cambio de estado automático; Se ha cambiado el estado a: Cerrado con Código de motivo: Auto Closed after 3 days, 29/10/2026 18:00.
- Registro de trabajo, 25/11/2026 13:12, Agregado Registro de trabajo "Olvidé cambiar el estado del ticket al terminar la actividad, por lo que siguió contabilizando las horas." Tiempo invertido (min.) : 60

[tickets_manual_updates]
| Ticket_ID  | Fecha_Creacion      | Ticket_type     | Grupo_Resolutor     | Nombre_Resolutor            |
| ---------- | ------------------- | --------------- | ------------------- | --------------------------- |
| 100-360228 | 2026-10-26 08:56:40 | Service Request | BASE DE DATOS Y EBS | Jara Figueroa,Nemberk Jesús |

aquí falta agregar mas columnas, tengo estas nomas:
Ticket_ID, Fecha_Creacion, Ticket_type, Grupo_Resolutor, Nombre_Resolutor, Motivo_Resolucion, Estado, Proyecto
Falta agregar estas columnas a tickets_manual_updates:
work_type
work_description
work_time_spent_mins
created_by_contact_id
work_by_first_name
work_by_last_name


Excel tickets_manual_updates 
| ID del ticket | Fecha de creación   | ticket_type     | Date_Work_Created    | work_type | work_description                                                                                          | work_time_spent (mins) | created_by_contact_id | work_by_first_name | work_by_last_name |
| ------------- | ------------------- | --------------- | -------------------- | --------- | --------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------- | ------------------ | ----------------- |
| 100-360228    | 26-Oct-2026 8:56:40 | Service Request | 25-Nov-2026 13:12:49 |           | Olvidé cambiar el estado del ticket al terminar la actividad, por lo que siguió contabilizando las horas. | 60                     | 1,755                 | Nemberk Jesús      | Jara Figueroa     |

Service AIDE (Información verídica):


Aquí añadí un registro de Trabajo, ósea hice un ajuste manual para regularizar mis horas, y coloque 60 mins


Tareas task_consolidated:
| Ticket_ID | Ticket_Padre | Fecha_Apertura      | Fecha_Resolucion | Fecha_Cierre        | Fecha_Ultima_Modificacion |
| --------- | ------------ | ------------------- | ---------------- | ------------------- | ------------------------- |
| 500-97889 | 100-360228   | 2026-10-26 09:02:31 | NULL             | 2026-10-26 10:55:31 | 2026-10-26 10:55:31       |
| 500-97907 | 100-360228   | 2026-10-26 10:56:16 | NULL             | 2026-10-26 13:04:38 | 2026-10-26 13:04:38       |

Aquí se muestran los tickets tareas del padre, ahora te dare los tiempos [tickets_report_times]:
| Ticket_ID | Ticket_type | Fecha_Creacion      | Nombre_Resolutor            | Action_Start_Date   | Action_End_Date     | Horas |
| --------- | ----------- | ------------------- | --------------------------- | ------------------- | ------------------- | ----- |
| 500-97889 | Task Ticket | 2026-10-26 09:02:31 | Nemberk Jesús Jara Figueroa | 2026-10-26 10:54:46 | 2026-10-26 10:55:31 | 0.01  |
| --------- | ----------- | ------------------- | --------------------------- | ------------------- | ------------------- | ----- |
| 500-97907 | Task Ticket | 2026-10-26 10:56:16 | Nemberk Jesús Jara Figueroa | 2026-10-26 10:56:20 | 2026-10-26 13:04:38 | 2.14  |


2. Incidentes:


Ticket: 300-287028
Tabla [incident_consolidated]
| Ticket_ID  | Fecha_Apertura      | Fecha_Resolucion    | Fecha_Cierre        | Fecha_Ultima_Modificacion |
| ---------- | ------------------- | ------------------- | ------------------- | ------------------------- |
| 300-287028 | 2026-04-19 04:55:57 | 2026-04-21 13:21:09 | 2026-04-21 13:21:15 | 2026-04-21 13:21:15       |

[tickets_report_times]:
| Ticket_ID  | Ticket_type | Fecha_Creacion      | Nombre_Resolutor      | Action_Start_Date   | Action_End_Date     | Horas |
| ---------- | ----------- | ------------------- | --------------------- | ------------------- | ------------------- | ----- |
| 300-287028 | Incident    | 2026-04-19 04:55:57 | Hitalo Castillo Berru | 2026-04-21 13:18:05 | 2026-04-21 13:21:09 | 0.05  |
| 300-287028 | Incident    | 2026-04-19 04:55:57 | Hitalo Castillo Berru | 2026-04-19 05:39:27 | 2026-04-19 05:54:01 | 0.24  |
Total de horas: 0.29

Cada fila donde indica Action_Start_Date y Action_End_Date, quiere decir que el Resolutor, Le dio en Pendiente Especialista para que no corra el tiempo en el ticket padre "Incidente" para crearse tickets tareas.

El flujo es este:
- Se creo el ticket a la fecha y hora: 2026-04-19 04:55:57
- Registro de trabajo, 19/04/2026 5:01, Agregado Registro de trabajo, SU APOYO, Tiempo invertido (min.) : 10
- El especialista Acepto asignación del ticket a las 19/04/2026 5:39, y se cambio a estado en Curso "Acción llevada a cabo: Aceptar asignación; Se ha cambiado el estado a: Activo con Código de motivo: En curso".
- Cambio de estado a "Pendiente Cliente" para que no corra el tiempo y para crear sus tickets tareas, a las 19/04/2026 5:54.
- Acepto asignación, estado a "En curso", a las 21/04/2026 13:18 "Acción llevada a cabo: Aceptar asignación; Se ha cambiado el estado a: Activo con Código de motivo: En curso"
- Resolvio el Incidente, Estado "Resuelto", a las 21/04/2026 13:21 "Acción llevada a cabo: Resolved Incident; Se ha cambiado el estado a: Resuelto con Código de motivo: Resuelto"
- Acción llevada a cabo: Cerrar incidente; Se ha cambiado el estado a: Cerrado con Código de motivo: Resuelto, 21/04/2026 13:21.


[tickets_manual_updates]
| Ticket_ID  | Fecha_Creacion      | Ticket_type | Grupo_Resolutor     | Nombre_Resolutor      |
| ---------- | ------------------- | ----------- | ------------------- | --------------------- |
| 300-287028 | 2026-04-19 04:55:57 | Incident    | BASE DE DATOS Y EBS | Castillo Berru,Hitalo |

aquí falta agregar mas columnas, tengo estas nomas:
Ticket_ID, Fecha_Creacion, Ticket_type, Grupo_Resolutor, Nombre_Resolutor, Motivo_Resolucion, Estado, Proyecto.
Falta agregar estas columnas a tickets_manual_updates:
work_type
work_description
work_time_spent_mins
created_by_contact_id
work_by_first_name
work_by_last_name


Excel tickets_manual_updates
| ID del ticket | Fecha de creación   | ticket_type | Date_Work_Created   | work_type | work_description | work_time_spent (mins) | created_by_contact_id | work_by_first_name | work_by_last_name |
| ------------- | ------------------- | ----------- | ------------------- | --------- | ---------------- | ---------------------- | --------------------- | ------------------ | ----------------- |
| 300-287028    | 19-Apr-2026 4:55:57 | Incident    | 19-Apr-2026 5:01:42 |           | SU APOYO         | 10                     | 1,294                 | Samuel Junior      | Gonzales Yuca     |


Aquí se añadio un registro de Trabajo, ósea se hizo un ajuste manual para regularizar las horas, y se coloco 10 mins


Tareas task_consolidated:
| Ticket_ID | Ticket_Padre | Fecha_Apertura      | Fecha_Resolucion | Fecha_Cierre        | Fecha_Ultima_Modificacion |
| --------- | ------------ | ------------------- | ---------------- | ------------------- | ------------------------- |
| 500-74181 | 300-287028   | 2026-04-20 17:35:33 | NULL             | 2026-04-20 18:58:38 | 2026-04-20 18:58:38       |
| 500-74252 | 300-287028   | 2026-04-21 10:12:38 | NULL             | 2026-04-21 13:17:58 | 2026-04-21 13:17:58       |

Aquí se muestran los tickets tareas del padre, ahora te dare los tiempos [tickets_report_times]:
| Ticket_ID | Ticket_type | Fecha_Creacion      | Nombre_Resolutor      | Action_Start_Date   | Action_End_Date     | Horas |
| --------- | ----------- | ------------------- | --------------------- | ------------------- | ------------------- | ----- |
| 500-74181 | Task Ticket | 2026-04-20 17:35:33 | Hitalo Castillo Berru | 2026-04-20 17:35:38 | 2026-04-20 18:58:38 | 1.38  |
| 500-74252 | Task Ticket | 2026-04-21 10:12:38 | Hitalo Castillo Berru | 2026-04-21 10:12:44 | 2026-04-21 13:17:58 | 3.09  |
 Total de horas: 4.47


Cuantas horas ocupabilidad se hizo el requerimiento e incidente? y cuales son las fechas  que debería tomar en cuenta para saber si se trabajo en paralelo?

------------------------------------------------------------------------------------------------------------
Aclaraciones del Paso 0:
Claro, para analizar los intervalos estimados al indicador de tickets en paralelo usaremos tickets_report_times, posiblemente tickets_manual_updates no lo tomemos en cuenta para ese alcance porque no necesariamente representa la realidad, solo es un ajuste de tiempo para regularizar el tiempo total de ocupabilidad, mas no para ver los intervalos de tiempos de los tickets. 

El Resumen Ejecutivo Mensual sera un grafico.
Eje vertical (Y): el eje izquierdo mide la cantidad de Tickets
Eje horizontal (X): muestra la evolución temporal mensual
Series con leyenda interactiva: permite comparar ambas métricas por mes. 
Actualmente la serie (Incidentes evaluados y Incidentes en paralelo) (Requerimientos evaluados y Requerimientos en paralelo), no sera un componente hijo como tal, sera vendrá dentro del componente padre, después en la fase del fronted te pasare el ejm, aquí te pasare la imagen de ejemplo de como quedara.

La Representación visual que me diste de estos componentes están perfectos, esta aprobado:
- Tabla Resumen Mensual Tickets en Paralelo por Resolutor [app-parallel-resolver-monthly-table]
- Gráfico del Top de Resolutores con más Tickets en Paralelo por Mes [app-parallel-resolver-ranking-chart]
- Tabla Explorador de Tickets en Paralelo [app-parallel-ticket-explorer-table]
- Tabla Detalle de Tickets en Paralelo [app-parallel-ticket-detail-dialog]
- Tabla Resumen Mensual Tickets en Paralelo por Proyecto [app-parallel-project-monthly-table]
- Gráfico Tickets en Paralelo por Proyecto y Mes [app-parallel-project-monthly-chart]

Decisiones pendientes para el paso 2
- "Comparar intervalos de diferentes resolutores dentro de un proyecto" esto a que te refieres.
- "Incluir tareas como tickets independientes en el dashboard" No, solo Incidentes y requerimientos, recuerda que las tareas son tickets hijos de incidentes y requerimientos.
- "Atribuir tiempos de tareas al ticket padre", tu crees que deberíamos incluirlos?, ósea yo creo que si, porque que las tareas son hijas del padre y viene incluidas.
- "Generar intervalos estimados desde registros manuales", no, no creo que deberíamos incluirlos.
- "Si seleccionamos únicamente incidentes, propongo que un incidente que estuvo en paralelo con un requerimiento continúe apareciendo en los resultados, porque esa coincidencia existió.", puede ser , pero creo que seria mas tedioso.
- Lo demás esta bien

Los componentes propuestos están bien:
fronted-tickets/
└── src/app/
    ├── components/
    │   ├── pages/
    │   │   └── tickets-parallel-analysis/
    │   │
    │   └── charts/
    │       └── Paralelos/
    │           ├── parallel-executive-summary/
    │           ├── parallel-resolver-monthly-table/
    │           ├── parallel-resolver-ranking-chart/
    │           ├── parallel-ticket-explorer-table/
    │           ├── parallel-ticket-detail-dialog/
    │           ├── parallel-project-monthly-table/
    │           └── parallel-project-monthly-chart/
    │
    ├── models/
    │   └── tickets-manual-updates.ts
    │
    └── services/
        └── tickets-manual-updates.service.ts

dame los comandos para crearlos, ejemplo:
ng g c components/charts/Consolidated/requirement-categorization-report --skip-tests=true --standalone=false

Ya cree el archivo PRD y mi ticket en service aide sobre esta una nueva implementación, y la rama de git. Ya no me sugieras esto por ahora.

Vamos con el Paso 1, que info necesitas? o ya tienes lo suficiente?


--------------------------------------------------------------------------------------------------------------------

PASO 2.7
Filtros globales:
Fechas (desde) (hasta)
Grupo Resolutor [BASE DE DATOS Y EBS] por defecto.
Prioridad
Motivo
Proyectos [seleccionar uno o varios proyectos]
tipo de ticket (Ticket_type)

Filtros Locales:
- Tabla Resumen Mensual Tickets en paralelo por Resolutor, Filtro Local (Tipo de Ticket)
Un buscador, solo nivel fronted (Resolutor)
- Grafico del Top de Resolutores con mas tickets en Paralelo por Mes, Filtros Locales fronted (Tipo de Ticket, Meses), Un buscador, solo nivel fronted (Resolutor)
- Tabla de Explorador de Tickets en Paralelo, Filtro Local (Tipo de Ticket [Todos/Incidentes/Requerimientos])
- Tabla Detalle de Tickets en paralelo (no tiene filtro local)
- Tabla Resumen Mensual Tickets en paralelo por Proyecto, Filtros Locales (Tipo de Ticket, Proyectos)
- Grafico Tickets en paralelo por Proyecto y Mes, Filtros Locales (Tipo de Ticket), Un buscador nivel fronted (Proyecto o ALP)
