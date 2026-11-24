Quiero hacer una nueva implementación. 
En todos los dashboards, ya sea:
1. Incidentes SLA [app-incident-sla]
2. Requerimientos SLA [app-requirement-sla]
3. Requerimientos Consolidados [app-requirement-consolidated]
4. Tareas Consolidadas [app-task-consolidated]
5. Cambios Consolidados [app-change-consolidated]

Agregarle la tabla y grafico de Resolutores, y colocarle en una sección en cada dashboard correspondiente.
El único dashboard que tiene la tabla y grafico de Resolutor es el modulo de Incidentes Consolidados.
Con estos endpoints:
- Rendimiento por Resolutor "/rendimiento-resolutores"
- Número de Tickets por Resolutor "/tickets-por-resolutor"

Pasos:
0. Analizar la información y entender el alcance, tendrás este contexto inicial:
- Backend de Incidentes Consolidados.
- Fronted, comp padre de Incidentes Consolidados [app-incident-consolidated]
- Fronted, componentes de tabla y grafico de resolutores [app-resolutor-performance-table] [app-resolver-monthly-tickets]
- Estructura del proyecto completo

Me darás el PRD de esta nueva implementación, solo dame el texto y el nombre de archivo, no me generes el archivo. Y además de toda esta información lo guardare en una carpeta de docs/desicions, dime el nombre del archivo.

1. Comenzaremos con el backend:
Primero te pasare todos los backends:
- Backend de Incidentes SLA, Requerimientos SLA, Requerimientos Consolidados, Tareas Consolidadas y Cambios Consolidados.

Luego, Aquí me generaras los archivos de los backends de:
Incidentes SLA 
Requerimientos SLA 
Requerimientos Consolidados 
Tareas Consolidadas 
Cambios Consolidados

Con los endpoints de :
- Rendimiento por Resolutor "/rendimiento-resolutores"
- Número de Tickets por Resolutor "/tickets-por-resolutor"
Con sus respectivos filtros.

2. Una vez que validemos que el backend este correcto, comenzaremos con el fronted.
Te pasare como contexto:
- Services y models:
Incidentes SLA 
Requerimientos SLA 
Requerimientos Consolidados 
Tareas Consolidadas 
Cambios Consolidados

Aquí en esta fase solo me indicaras los cambios y bloques de código para colocar o reemplazar.

4. Aquí reciclaremos los componentes de Rendimiento por Resolutor [app-resolutor-performance-table] y Número de Tickets por Resolutor  [app-resolver-monthly-tickets], para los dashboards.

3. Una vez que la fase anterior este completa, comenzaremos con los componentes padre, aquí te pasare los componentes de:
Incidentes SLA [app-incident-sla]
Requerimientos SLA [app-requirement-sla]
Requerimientos Consolidados [app-requirement-consolidated]
Tareas Consolidadas [app-task-consolidated]
Cambios Consolidados [app-change-consolidated]

Aquí integraremos para los componentes de Rendimiento por Resolutor y Número de Tickets por Resolutor.


