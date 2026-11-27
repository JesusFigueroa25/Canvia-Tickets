"""SQL Server: extracción, identificación del padre y consolidación temporal."""

SQL_BASE = r"""
DECLARE @Desde datetime2(0) = CAST(:desde AS datetime2(0));
DECLARE @Hasta datetime2(0) = CAST(:hasta_exclusiva AS datetime2(0));
DECLARE @Grupo nvarchar(150) = :grupo;
DECLARE @IncluirDirectosSinConsolidado bit = 1;


-- ============================================================
-- ETAPA 1. EXTRACCION Y NORMALIZACION INICIAL
-- ============================================================

SELECT
    r.Report_Time_ID,
    r.Ticket_ID AS Ticket_Origen,
    r.Ticket_type AS Tipo_Origen,
    r.Grupo_Resolutor,
    r.Nombre_Resolutor AS Resolutor_Original,

    CAST(
        LTRIM(RTRIM(
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                r.Nombre_Resolutor COLLATE Latin1_General_100_BIN2,
                NCHAR(8203), N''),
                NCHAR(8204), N''),
                NCHAR(8205), N''),
                NCHAR(65279), N''),
                NCHAR(160), N' ')
        ))
        AS nvarchar(300)
    ) COLLATE DATABASE_DEFAULT AS Resolutor,

    r.Proyecto AS Proyecto_Origen,
    r.Prioridad AS Prioridad_Origen,
    r.Motivo AS Motivo_Origen,
    r.Descripcion AS Descripcion_Origen,
    r.Estado AS Estado_Origen,

    r.Action_Start_Date AS Inicio_Original,
    r.Action_End_Date AS Fin_Original,

    CASE
        WHEN r.Action_Start_Date < @Desde THEN @Desde
        ELSE r.Action_Start_Date
    END AS Inicio,

    CASE
        WHEN r.Action_End_Date > @Hasta THEN @Hasta
        ELSE r.Action_End_Date
    END AS Fin

INTO #canvia_pa_Base

FROM dbo.tickets_report_times r

WHERE (@Grupo IS NULL OR r.Grupo_Resolutor = @Grupo)
  AND r.Ticket_type IN (
      N'Incident',
      N'Service Request',
      N'Task Ticket'
  )
  AND r.Action_Start_Date < @Hasta
  AND r.Action_End_Date > @Desde
  AND r.Action_End_Date > r.Action_Start_Date

OPTION (RECOMPILE);


WHILE EXISTS (
    SELECT 1
    FROM #canvia_pa_Base
    WHERE CHARINDEX(
        N'  ',
        Resolutor COLLATE Latin1_General_100_BIN2
    ) > 0
)
BEGIN
    UPDATE #canvia_pa_Base
    SET Resolutor = REPLACE(
        Resolutor COLLATE Latin1_General_100_BIN2,
        N'  ',
        N' '
    )
    WHERE CHARINDEX(
        N'  ',
        Resolutor COLLATE Latin1_General_100_BIN2
    ) > 0;
END;


DELETE FROM #canvia_pa_Base
WHERE NULLIF(Resolutor, N'') IS NULL;





-- ============================================================
-- ETAPA 2. NORMALIZACION DE ACTORES
-- ============================================================

SELECT
    MIN(
        Resolutor COLLATE Latin1_General_100_BIN2
    ) COLLATE DATABASE_DEFAULT AS Resolutor_Canonico

INTO #canvia_pa_Actores
FROM #canvia_pa_Base
GROUP BY Resolutor;


UPDATE b
SET Resolutor = a.Resolutor_Canonico
FROM #canvia_pa_Base b
INNER JOIN #canvia_pa_Actores a
    ON b.Resolutor = a.Resolutor_Canonico;


CREATE INDEX IX_Base_Origen
ON #canvia_pa_Base (
    Ticket_Origen,
    Tipo_Origen
);





-- ============================================================
-- ETAPA 3. IDENTIFICACION DE TICKETS AMBIGUOS
-- ============================================================

SELECT Ticket_Origen
INTO #canvia_pa_DirectosAmbiguos
FROM #canvia_pa_Base

WHERE Tipo_Origen IN (
    N'Incident',
    N'Service Request'
)

GROUP BY Ticket_Origen
HAVING COUNT(DISTINCT Tipo_Origen) > 1;


CREATE UNIQUE INDEX IX_DirectosAmbiguos
ON #canvia_pa_DirectosAmbiguos (
    Ticket_Origen
);





-- ============================================================
-- ETAPA 4. MAPEO DE TICKETS PADRE
-- ============================================================

SELECT
    b.*,
    p.Ticket_Padre,

    CASE
        WHEN i.Ticket_ID IS NOT NULL
             AND q.Ticket_ID IS NULL
             AND b.Tipo_Origen IN (
                 N'Incident',
                 N'Task Ticket'
             )
        THEN N'Incident'

        WHEN q.Ticket_ID IS NOT NULL
             AND i.Ticket_ID IS NULL
             AND b.Tipo_Origen IN (
                 N'Service Request',
                 N'Task Ticket'
             )
        THEN N'Service Request'

        WHEN @IncluirDirectosSinConsolidado = 1
             AND b.Tipo_Origen IN (
                 N'Incident',
                 N'Service Request'
             )
             AND i.Ticket_ID IS NULL
             AND q.Ticket_ID IS NULL
             AND da.Ticket_Origen IS NULL
        THEN b.Tipo_Origen

    END AS Tipo_Padre,

    CASE
        WHEN i.Ticket_ID IS NOT NULL
             AND q.Ticket_ID IS NULL
             AND b.Tipo_Origen IN (
                 N'Incident',
                 N'Task Ticket'
             )
        THEN N'Consolidado'

        WHEN q.Ticket_ID IS NOT NULL
             AND i.Ticket_ID IS NULL
             AND b.Tipo_Origen IN (
                 N'Service Request',
                 N'Task Ticket'
             )
        THEN N'Consolidado'

        WHEN b.Tipo_Origen = N'Task Ticket'
             AND t.Ticket_ID IS NULL
        THEN N'Tarea no encontrada'

        WHEN b.Tipo_Origen = N'Task Ticket'
             AND NULLIF(
                 LTRIM(RTRIM(t.Ticket_Padre)),
                 ''
             ) IS NULL
        THEN N'Tarea sin padre'

        WHEN i.Ticket_ID IS NOT NULL
             OR q.Ticket_ID IS NOT NULL
        THEN N'Padre ambiguo o tipo incompatible'

        WHEN b.Tipo_Origen = N'Task Ticket'
        THEN N'Tarea con padre no confirmado'

        WHEN da.Ticket_Origen IS NOT NULL
        THEN N'Directo con tipo ambiguo'

        WHEN @IncluirDirectosSinConsolidado = 1
        THEN N'Report Times (respaldo)'

        ELSE N'Directo sin consolidado (excluido)'

    END AS Fuente_Clasificacion

INTO #canvia_pa_Mapeo

FROM #canvia_pa_Base b

LEFT JOIN dbo.task_consolidated t
    ON b.Tipo_Origen = N'Task Ticket'
    AND t.Ticket_ID = b.Ticket_Origen

CROSS APPLY (
    VALUES (
        CASE
            WHEN b.Tipo_Origen = N'Task Ticket'
            THEN t.Ticket_Padre
            ELSE b.Ticket_Origen
        END
    )
) p(Ticket_Padre)

LEFT JOIN dbo.incident_consolidated i
    ON i.Ticket_ID = p.Ticket_Padre

LEFT JOIN dbo.requirement_consolidated q
    ON q.Ticket_ID = p.Ticket_Padre

LEFT JOIN #canvia_pa_DirectosAmbiguos da
    ON da.Ticket_Origen = b.Ticket_Origen;


CREATE INDEX IX_Mapeo_Padre
ON #canvia_pa_Mapeo (
    Ticket_Padre,
    Tipo_Padre
);





-- ============================================================
-- ETAPA 5. METADATOS Y NORMALIZACION DE PROYECTOS
-- ============================================================

WITH Claves AS (

    SELECT DISTINCT
        Ticket_Padre,
        Tipo_Padre
    FROM #canvia_pa_Mapeo
    WHERE Tipo_Padre IS NOT NULL

),

UltimoDirecto AS (

    SELECT
        Ticket_Padre,
        Tipo_Padre,
        Proyecto_Origen,
        Prioridad_Origen,
        Motivo_Origen,
        Descripcion_Origen,

        ROW_NUMBER() OVER (
            PARTITION BY Ticket_Padre, Tipo_Padre
            ORDER BY
                Fin_Original DESC,
                Inicio_Original DESC,
                Report_Time_ID DESC
        ) AS rn

    FROM #canvia_pa_Mapeo

    WHERE Fuente_Clasificacion = N'Report Times (respaldo)'
      AND Tipo_Padre IS NOT NULL
)

SELECT
    c.Ticket_Padre,
    c.Tipo_Padre,

    NULLIF(
        LTRIM(RTRIM(
            CASE
                WHEN i.Ticket_ID IS NOT NULL THEN i.Proyecto
                WHEN q.Ticket_ID IS NOT NULL THEN q.Proyecto
                ELSE u.Proyecto_Origen
            END
        )),
        N''
    ) AS Proyecto,

    CASE
        WHEN i.Ticket_ID IS NOT NULL THEN i.ALP
        WHEN q.Ticket_ID IS NOT NULL THEN q.ALP
        ELSE NULL
    END AS ALP,

    NULLIF(
        LTRIM(RTRIM(
            CASE
                WHEN i.Ticket_ID IS NOT NULL THEN i.Prioridad
                WHEN q.Ticket_ID IS NOT NULL THEN q.Prioridad
                ELSE u.Prioridad_Origen
            END
        )),
        N''
    ) AS Prioridad,

    NULLIF(
        LTRIM(RTRIM(
            CASE
                WHEN i.Ticket_ID IS NOT NULL THEN i.Motivo_Estado
                WHEN q.Ticket_ID IS NOT NULL THEN q.Motivo_Estado
                ELSE u.Motivo_Origen
            END
        )),
        N''
    ) AS Motivo,

    CASE
        WHEN i.Ticket_ID IS NOT NULL THEN i.Descripcion
        WHEN q.Ticket_ID IS NOT NULL THEN q.Descripcion
        ELSE u.Descripcion_Origen
    END AS Descripcion,

    CASE
        WHEN i.Ticket_ID IS NOT NULL
             OR q.Ticket_ID IS NOT NULL
        THEN N'Consolidado'
        ELSE N'Report Times (respaldo)'
    END AS Fuente_Metadatos

INTO #canvia_pa_Padres

FROM Claves c

LEFT JOIN dbo.incident_consolidated i
    ON c.Tipo_Padre = N'Incident'
    AND i.Ticket_ID = c.Ticket_Padre

LEFT JOIN dbo.requirement_consolidated q
    ON c.Tipo_Padre = N'Service Request'
    AND q.Ticket_ID = c.Ticket_Padre

LEFT JOIN UltimoDirecto u
    ON u.Ticket_Padre = c.Ticket_Padre
    AND u.Tipo_Padre = c.Tipo_Padre
    AND u.rn = 1;


-- Canonicalizar proyectos por denominacion completa, no por ALP.

SELECT
    MIN(
        Proyecto COLLATE Latin1_General_100_BIN2
    ) COLLATE DATABASE_DEFAULT AS Proyecto_Canonico

INTO #canvia_pa_Clientes

FROM #canvia_pa_Padres

WHERE Proyecto IS NOT NULL

GROUP BY Proyecto;


UPDATE p
SET Proyecto = c.Proyecto_Canonico

FROM #canvia_pa_Padres p

INNER JOIN #canvia_pa_Clientes c
    ON p.Proyecto = c.Proyecto_Canonico;


CREATE UNIQUE INDEX IX_Padres
ON #canvia_pa_Padres (
    Ticket_Padre,
    Tipo_Padre
);





-- ============================================================
-- ETAPA 6. PREPARACION DE INTERVALOS
-- ============================================================

SELECT
    m.Report_Time_ID,
    m.Ticket_Origen,
    m.Tipo_Origen,
    m.Ticket_Padre,
    m.Tipo_Padre,
    m.Resolutor,
    m.Resolutor_Original,
    m.Grupo_Resolutor,
    m.Inicio,
    m.Fin,
    m.Inicio_Original,
    m.Fin_Original,
    m.Descripcion_Origen,
    m.Estado_Origen,
    m.Motivo_Origen

INTO #canvia_pa_Intervalos

FROM #canvia_pa_Mapeo m

INNER JOIN #canvia_pa_Padres p
    ON p.Ticket_Padre = m.Ticket_Padre
    AND p.Tipo_Padre = m.Tipo_Padre;


CREATE INDEX IX_Intervalos_Padre
ON #canvia_pa_Intervalos (
    Ticket_Padre,
    Tipo_Padre,
    Resolutor,
    Inicio,
    Fin,
    Report_Time_ID
);





-- ============================================================
-- ETAPA 7. CONSOLIDACION DE INTERVALOS
-- ============================================================

WITH Ordenados AS (

    SELECT
        Ticket_Padre,
        Tipo_Padre,
        Resolutor,
        Inicio,
        Fin,
        Report_Time_ID,

        MAX(Fin) OVER (
            PARTITION BY
                Ticket_Padre,
                Tipo_Padre,
                Resolutor

            ORDER BY
                Inicio,
                Fin,
                Report_Time_ID

            ROWS BETWEEN
                UNBOUNDED PRECEDING
                AND 1 PRECEDING

        ) AS Fin_Max_Anterior

    FROM #canvia_pa_Intervalos

),

Marcados AS (

    SELECT
        Ticket_Padre,
        Tipo_Padre,
        Resolutor,
        Inicio,
        Fin,
        Report_Time_ID,

        CASE
            WHEN Fin_Max_Anterior IS NULL
                 OR Inicio > Fin_Max_Anterior
            THEN 1
            ELSE 0
        END AS Nuevo_Bloque

    FROM Ordenados

),

Agrupados AS (

    SELECT
        Ticket_Padre,
        Tipo_Padre,
        Resolutor,
        Inicio,
        Fin,

        SUM(Nuevo_Bloque) OVER (
            PARTITION BY
                Ticket_Padre,
                Tipo_Padre,
                Resolutor

            ORDER BY
                Inicio,
                Fin,
                Report_Time_ID

            ROWS UNBOUNDED PRECEDING

        ) AS Bloque

    FROM Marcados

)

SELECT
    Ticket_Padre,
    Tipo_Padre,
    Resolutor,
    MIN(Inicio) AS Inicio,
    MAX(Fin) AS Fin,
    COUNT_BIG(*) AS Intervalos_Origen

INTO #canvia_pa_IntervalosConsolidados

FROM Agrupados

GROUP BY
    Ticket_Padre,
    Tipo_Padre,
    Resolutor,
    Bloque;



"""


TEMP_TABLES = (
    '#canvia_pa_Base',
    '#canvia_pa_Actores',
    '#canvia_pa_DirectosAmbiguos',
    '#canvia_pa_Mapeo',
    '#canvia_pa_Padres',
    '#canvia_pa_Clientes',
    '#canvia_pa_Intervalos',
    '#canvia_pa_IntervalosConsolidados'
)
