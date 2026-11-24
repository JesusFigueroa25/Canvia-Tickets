import type { IncidentProjectMonthlyFilters, IncidentProjectMonthlyResponses } from '../../../../models/incident-project-monthly-report';

/** Identidad sintética ajena al Top 10 general; sin HTTP ni bases de datos. */
export function proyectoMensualFicticio(valores: number[] = [120, 180, 90, 150, 210, 160]) {
  const proyecto = 'PRY-042 Centro de Servicios Compartidos e Infraestructura Regional del Proyecto Ficticio';
  const etiquetas = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const periodos = valores.map((_, i) => ({ anio: 2025 + Math.floor(i / 12), mes: i % 12 + 1, periodo: `${etiquetas[i % 12]}-${25 + Math.floor(i / 12)}` }));
  const ultimo = periodos.at(-1) ?? { anio: 2025, mes: 1 };
  const hasta = new Date(Date.UTC(ultimo.anio, ultimo.mes, 0)).toISOString().slice(0, 10);
  const total = valores.reduce((s, n) => s + n, 0);
  const filtros: IncidentProjectMonthlyFilters = { desde: '2025-01-01', hasta, grupo_resolutor: 'Grupo ficticio de Infraestructura', proyecto, proyectos_excluidos: ['PRY-999 Proyecto excluido ficticio'] };
  const respuestas: IncidentProjectMonthlyResponses = {
    kpis: { total_tickets: total, total_proyectos: total > 0 ? 1 : 0, alta_criticidad: 0, porcentaje_alta_criticidad: 0 },
    top: { periodos: total > 0 ? periodos : [], proyectos: total > 0 ? [{ proyecto, total_tickets: total, mensual: periodos.map((p, i) => ({ periodo: p.periodo, tickets: valores[i] })) }] : [] },
  };
  return { proyecto, filtros, respuestas, disponibilidad: { fecha_min: filtros.desde!, fecha_max: hasta } };
}
