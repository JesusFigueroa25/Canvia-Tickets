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

/** Rango sintético coherente para verificar densidad y cambios de año. */
export function reporteMesesFicticios(cantidad = 12): RequirementCategorizationReportData {
  const d = reporteFicticio(), total = cantidad * 10, correctas = cantidad * 7, incorrectas = cantidad * 3;
  d.meses = Array.from({ length: cantidad }, (_, i) => ({ month: (2026 + Math.floor(i / 12)) + '-' + String(i % 12 + 1).padStart(2, '0'),
    total_tickets: 10, correct_count: 7, incorrect_count: 3, correct_percentage: 70, incorrect_percentage: 30 }));
  Object.assign(d.resumen, { total_tickets: total, processed_tickets: total, correct_count: correctas, incorrect_count: incorrectas });
  const filas = Math.min(12, total);
  d.resolutores = Array.from({ length: filas }, (_, i) => {
    const c = Math.floor(correctas / filas) + (i < correctas % filas ? 1 : 0), e = Math.floor(incorrectas / filas) + (i < incorrectas % filas ? 1 : 0), t = c + e;
    return { resolver_name: i ? 'Colaborador demo ' + String(i).padStart(2, '0') : null, total_tickets: t, correct_count: c, incorrect_count: e,
      correct_percentage: t ? Math.round(c * 10000 / t) / 100 : 0, incorrect_percentage: t ? Math.round(e * 10000 / t) / 100 : 0, missing_required_solution_count: 0 };
  }).filter(i => i.total_tickets > 0);
  d.motivos.total = total; d.motivos.items.forEach((m, i) => { m.total_tickets = total * [0.5, 0.4, 0.1][i]; });
  if (cantidad) d.filtros.hasta = new Date(Date.UTC(2026, cantidad, 0)).toISOString().slice(0, 10);
  return d;
}

export function reporteResultadoFicticio(correcto: boolean): RequirementCategorizationReportData {
  const d = reporteFicticio();
  [d.resumen, ...d.resolutores, ...d.meses].forEach(f => { const total = 'processed_tickets' in f ? f.processed_tickets : f.total_tickets;
    f.correct_count = correcto ? total : 0; f.incorrect_count = correcto ? 0 : total; f.correct_percentage = correcto ? 100 : 0; f.incorrect_percentage = correcto ? 0 : 100; });
  return d;
}
