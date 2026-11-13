-- SQL Server | Consulta de solo lectura | Referencia para validación del endpoint.
-- Grupo: BASE DE DATOS Y EBS
-- Proyecto: 103855 LA POSITIVA PROY CLOUD GEST TI
-- Desde: 01/10/2026 | Hasta: 26/10/2026 (ambos incluidos)
-- Atención: la fecha límite se maneja como < 27/10/2026 por ser DATETIME2.
SELECT COUNT(*) AS total_incidentes
FROM incident_consolidated AS i
WHERE i.Fecha_Apertura >= '20261001'
  AND i.Fecha_Apertura < '20261027'
  AND TRIM(i.Grupo_Resolutor) = N'BASE DE DATOS Y EBS'
  AND COALESCE(NULLIF(TRIM(i.Proyecto), N''), N'Sin especificar')
      = N'103855 LA POSITIVA PROY CLOUD GEST TI';

-- Cruce por motivo de resolución: NULL y espacios se consideran sin atribución.
SELECT
    COALESCE(NULLIF(TRIM(Motivo_Resolucion), N''), N'Sin atribución') AS atribucion,
    COUNT(*) AS tickets
FROM incident_consolidated
WHERE Fecha_Apertura >= '20261001'
  AND Fecha_Apertura < '20261027'
  AND TRIM(Grupo_Resolutor) = N'BASE DE DATOS Y EBS'
  AND COALESCE(NULLIF(TRIM(Proyecto), N''), N'Sin especificar')
      = N'103855 LA POSITIVA PROY CLOUD GEST TI'
GROUP BY COALESCE(NULLIF(TRIM(Motivo_Resolucion), N''), N'Sin atribución')
ORDER BY tickets DESC;
