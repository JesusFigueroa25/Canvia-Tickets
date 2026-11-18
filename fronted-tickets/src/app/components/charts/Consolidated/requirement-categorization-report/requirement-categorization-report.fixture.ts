import type { RequirementCategorizationReportData } from '../../../../models/requirement-categorization-audit';

/** Datos ficticios para pruebas; sin información de tickets reales. */
export function reporteFicticio(): RequirementCategorizationReportData {
  return {
    version: 1,
    preparadoEn: '2026-11-18T18:00:00Z',
    filtros: {
      desde: '2026-01-01',
      hasta: '2026-12-31',
      grupo_resolutor: 'GRUPO DEMO',
      proyecto: 'Proyecto demo',
    },
    resumen: {
      group_id: 1,
      group_name: 'Auditoría demo',
      audit_year: 2026,
      completed_runs: 2,
      grupo_resolutor: 'GRUPO DEMO',
      total_tickets: 120,
      processed_tickets: 120,
      correct_count: 84,
      incorrect_count: 36,
      error_count: 0,
      correct_percentage: 70,
      incorrect_percentage: 30,
      missing_required_solution_count: 0,
      optional_missing_solution_count: 0,
      review_solution_status_count: 0,
    },
    motivos: {
      group_id: 1,
      grupo_resolutor: 'GRUPO DEMO',
      audit_year: 2026,
      total: 120,
      items: [
        { reason: 'Atribuible a Cliente', total_tickets: 60, percentage: 50 },
        { reason: 'Atribuible a Canvia', total_tickets: 48, percentage: 40 },
        { reason: 'SIN_DATO', total_tickets: 12, percentage: 10 },
      ],
    },
    resolutores: Array.from({ length: 12 }, (_, i) => ({
      resolver_name: i === 0 ? null : `Colaborador demo ${String(i).padStart(2, '0')}`,
      total_tickets: 10,
      correct_count: 7,
      incorrect_count: 3,
      correct_percentage: 70,
      incorrect_percentage: 30,
      missing_required_solution_count: 0,
    })),
    meses: Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, '0')}`,
      total_tickets: 10,
      correct_count: 7,
      incorrect_count: 3,
      correct_percentage: 70,
      incorrect_percentage: 30,
    })),
  };
}
