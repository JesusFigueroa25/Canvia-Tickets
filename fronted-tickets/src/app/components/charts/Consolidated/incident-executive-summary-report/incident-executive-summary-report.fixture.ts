import type { IncidentExecutiveSummarySources } from '../../../../models/incident-executive-summary-report';
import type { IncidentConsolidatedDashboardFilters } from '../../../../models/incident-consolidated';

/** Datos sintéticos exclusivos de pruebas; no contienen registros de negocio. */
export function resumenFicticio(sinServidores = false, respaldo = false) {
  const estado = 'PENDIENTE_REGLAS_APROBADAS';
  const filtros: IncidentConsolidatedDashboardFilters = { desde: '2025-01-01', hasta: '2025-06-30', grupo_resolutor: 'BASE DE DATOS Y EBS' };
  const original = [{ atribucion: 'Atribuible a Cliente', tickets: 600, porcentaje: 75 }, { atribucion: 'Atribuible a Canvia', tickets: 200, porcentaje: 25 }];
  const hallazgos = [
    { codigo: 'H01', tipo: 'atribucion', titulo: 'Concentración de atribución registrada', descripcion: 'La atribución registrada al cliente reúne 600 de 800 incidentes atribuidos. Este registro no demuestra causalidad.', valor: 600, porcentaje: 75, denominador: 800, requiere_validacion: true },
    { codigo: 'H02', tipo: 'tipos', titulo: 'Categoría de mayor volumen', descripcion: 'Una categoría ficticia concentra 350 de 1000 incidentes. Conviene contrastar sus síntomas y soluciones antes de establecer un patrón técnico.', valor: 350, porcentaje: 35, denominador: 1000, requiere_validacion: true },
    { codigo: 'H03', tipo: 'tendencia', titulo: 'Cambio entre meses completos', descripcion: 'El volumen de dos meses completos pasó de 120 a 90 incidentes. La reducción no acredita una mejora de la calidad del servicio.', valor: -30, porcentaje: -25, denominador: 120, requiere_validacion: true },
    { codigo: 'H04', tipo: 'cruces', titulo: 'Cruce de categoría y prioridad', descripcion: 'De 200 incidentes de una categoría ficticia, 80 tienen prioridad alta. El cruce delimita registros para revisión y no confirma una causa común.', valor: 80, porcentaje: 40, denominador: 200, requiere_validacion: true },
    { codigo: 'H05', tipo: 'patrones', titulo: 'Menciones técnicas por contrastar', descripcion: 'Se identificaron menciones de una señal ficticia en 150 de 1000 incidentes. Las menciones requieren contraste con el detalle original.', valor: 150, porcentaje: 15, denominador: 1000, requiere_validacion: true },
  ];
  const fuentes: IncidentExecutiveSummarySources = {
    ajustada: {
      total_tickets: 1000, total_atribuidos_original: 800, total_atribuidos_ajustado: 800, sin_atribucion_original: 200, sin_atribucion_ajustado: 200,
      reglas_aprobadas: 0, ajustes_aplicados: 0, ajustes_habilitados: false, estado_ajuste: estado,
      metodologia: 'Comparación de atribución original y ajustada. Ajustes pendientes de reglas aprobadas; no se han realizado reasignaciones.',
      distribucion_original: original.map(i => ({ ...i })), distribucion_ajustada: original.map(i => ({ ...i })),
      comparacion: original.map(i => ({ atribucion: i.atribucion, tickets_originales: i.tickets, tickets_ajustados: i.tickets, variacion_tickets: 0, porcentaje_original: i.porcentaje, porcentaje_ajustado: i.porcentaje }))
    },
    servidores: {
      total_incidentes: 1000, incidentes_con_servidor: sinServidores ? 0 : 700, incidentes_sin_servidor: sinServidores ? 1000 : 300,
      total_servidores_identificados: sinServidores ? 0 : 7, total_asociaciones: sinServidores ? 0 : 1400, limite: 5,
      servidores: sinServidores ? [] : [400, 300, 250, 150, 100].map((incidentes, i) => ({ servidor: `SRV-FICTICIO-INFRAESTRUCTURA-REGIONAL-${i + 1}`, incidentes, porcentaje: incidentes / 10, tickets_ejemplo: [] }))
    },
    analisis: {
      origen: respaldo ? 'reglas' : 'ia', modelo: respaldo ? null : 'modelo-ficticio', advertencia: respaldo ? 'Se muestran hechos operativos de respaldo; la interpretación IA no está disponible en esta prueba ficticia.' : null,
      hallazgos: { total_incidentes: 1000, total_hallazgos: hallazgos.length, estado_ajuste: estado, metodologia: 'Indicadores operativos verificados; las asociaciones no acreditan causalidad.', hallazgos },
      conclusiones: {
        total_incidentes: 1000, total_conclusiones: 3, estado_ajuste: estado, metodologia: 'Indicadores operativos verificados; las asociaciones no acreditan causalidad.', conclusiones: [
          { codigo: 'C01', tipo: 'atribucion', titulo: 'Registro de atribución', conclusion: 'La atribución constituye un registro administrativo que debe contrastarse con evidencia técnica.', recomendacion: 'Revisar una muestra de registros y documentar las discrepancias observadas.', hallazgos_referencia: ['H01'], requiere_validacion: true },
          { codigo: 'C02', tipo: 'tipos', titulo: 'Revisión de la categoría principal', conclusion: 'El volumen delimita una categoría para revisar, sin probar repetición de la misma falla.', recomendacion: 'Contrastar síntomas y soluciones y preparar una lista de eventos comprobados.', hallazgos_referencia: ['H02'], requiere_validacion: true },
          { codigo: 'C03', tipo: 'cruces', titulo: 'Revisión focalizada del cruce', conclusion: 'El cruce de categoría y prioridad delimita 80 registros para una revisión diferenciada. No identifica por sí mismo una causa técnica común.', recomendacion: 'Contrastar el detalle y la solución de los registros del cruce, agrupar síntomas documentados y entregar una relación de recurrencias comprobadas antes de proponer acciones.', hallazgos_referencia: ['H04'], requiere_validacion: true },
        ]
      }
    },
  };
  return { fuentes, filtros };
}
