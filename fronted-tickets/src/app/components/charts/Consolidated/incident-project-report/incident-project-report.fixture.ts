import type { IncidentProjectReportFilters, IncidentProjectReportResponses } from '../../../../models/incident-project-report';

/** Datos sintéticos sin acceso a API ni bases de datos. */
export function proyectosFicticios(cantidad = 12, meses = 3) {
  const etiquetas = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const periodos = Array.from({ length: meses }, (_, i) => ({
    anio: 2025 + Math.floor(i / 12), mes: i % 12 + 1,
    periodo: `${etiquetas[i % 12]}-${String(2025 + Math.floor(i / 12)).slice(-2)}`,
  }));
  const series = Array.from({ length: cantidad }, (_, i) => {
    const proyecto = i === 3 ? 'Proyecto ficticio 04 Centro de Servicios Compartidos Regionales' : `Proyecto ficticio ${String(i + 1).padStart(2, '0')}`;
    const mensual = periodos.map((p, m) => ({ periodo: p.periodo, tickets: (cantidad - i) * 5 + (m + 1) * 3 }));
    return { proyecto, total_tickets: mensual.reduce((s, m) => s + m.tickets, 0), mensual };
  });
  const volumen = periodos.map((p, m) => ({ ...p, tickets: series.reduce((s, proyecto) => s + proyecto.mensual[m].tickets, 0) }));
  const total = volumen.reduce((s, m) => s + m.tickets, 0);
  const ultimo = periodos.at(-1)!;
  const hasta = new Date(Date.UTC(ultimo.anio, ultimo.mes, 0)).toISOString().slice(0, 10);
  const filtros: IncidentProjectReportFilters = { desde: '2025-01-01', hasta, grupo_resolutor: 'Grupo ficticio', proyectos_excluidos: ['Proyecto excluido ficticio'] };
  const respuestas: IncidentProjectReportResponses = {
    kpis: { total_tickets: total, total_proyectos: cantidad, alta_criticidad: 0, porcentaje_alta_criticidad: 0 },
    proyectos: series.map(p => ({ proyecto: p.proyecto, cantidad: p.total_tickets })),
    top: { periodos: cantidad > 0 ? periodos : [], proyectos: series.slice(0, 10) },
    volumen: cantidad > 0 ? volumen : [],
  };
  return { respuestas, filtros, disponibilidad: { fecha_min: filtros.desde!, fecha_max: hasta } };
}
