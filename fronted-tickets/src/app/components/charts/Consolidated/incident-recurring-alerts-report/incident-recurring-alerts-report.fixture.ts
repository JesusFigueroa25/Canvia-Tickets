import type { IncidentConsolidatedIncidentesPorcentajesOut } from '../../../../models/incident-consolidated';
import type { IncidentRecurringAlertsFilters } from '../../../../models/incident-recurring-alerts-report';

/** Datos exclusivamente ficticios, sin HTTP ni bases de datos. */
export function alertasFicticias(proyecto: string | null = null, cantidades = [320, 240, 160, 120, 60], total = 1200) {
  const descripciones = [
    'Alerta ficticia de disponibilidad de servicios de infraestructura regional',
    'Alerta ficticia de capacidad de almacenamiento en la plataforma compartida',
    'Alerta ficticia de conectividad de los servicios del proyecto',
    'Alerta ficticia de ejecución de tareas de respaldo',
    'Sin especificar',
  ];
  const filtros: IncidentRecurringAlertsFilters = { desde: '2025-01-01', hasta: '2025-06-30', grupo_resolutor: 'Grupo ficticio de Infraestructura',
    proyectos_excluidos: ['PRY-999 Proyecto excluido ficticio'], proyecto: proyecto ?? undefined };
  const respuesta: IncidentConsolidatedIncidentesPorcentajesOut = { total_general: total, limite: 5,
    descripciones: cantidades.map((cantidad, i) => ({ descripcion: descripciones[i], cantidad, porcentaje: total > 0 ? Math.round(cantidad * 10000 / total) / 100 : 0 })) };
  return { respuesta, filtros, proyecto };
}
