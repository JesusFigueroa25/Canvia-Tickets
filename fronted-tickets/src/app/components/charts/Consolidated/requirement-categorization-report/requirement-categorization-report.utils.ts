import type { AuditResolver, RequirementCategorizationReportData } from '../../../../models/requirement-categorization-audit';

export interface AuditReportRenderError { version: number; motivo: 'render' | 'legibilidad'; }
export interface AuditExecutiveFinding { titulo: string; texto: string; }
export interface AuditExecutiveAnalysis { hallazgos: AuditExecutiveFinding[]; conclusion: string; recomendaciones: string[]; }
export const nombreColaborador = (s: string | null) => s?.trim() || 'Sin asignar';
const numero = (n: number) => n.toLocaleString('es-PE');
const porcentaje = (n: number, base: number) => (base ? n * 100 / base : 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function exigir(ok: boolean, mensaje: string): void { if (!ok) throw new Error(mensaje); }
function entero(n: number): boolean { return Number.isSafeInteger(n) && n >= 0; }
function tasa(n: number, base: number, recibida: number): boolean {
  return Number.isFinite(recibida) && recibida >= 0 && recibida <= 100 && Math.abs(recibida - (base ? n * 100 / base : 0)) <= 0.005000001;
}
export function etiquetaMes(codigo: string, largo = false): string {
  return new Intl.DateTimeFormat('es-PE', { month: largo ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(codigo + '-01T00:00:00Z'));
}
export function topIncorrectas(filas: readonly AuditResolver[]): AuditResolver[] {
  return filas.filter(f => f.total_tickets > 0).map(f => ({ ...f })).sort((a, b) =>
    b.incorrect_count - a.incorrect_count || b.total_tickets - a.total_tickets || nombreColaborador(a.resolver_name).localeCompare(nombreColaborador(b.resolver_name), 'es')).slice(0, 10);
}

/** Los agregados de grupo usan la última evaluación vigente por ticket de runs
 * COMPLETED. El contador error_count de ejecuciones y los contadores de filas de
 * las listas no son denominadores. No se exige continuidad/calendario mensual. */
export function validarReporteCategorizacion(d: RequirementCategorizationReportData): void {
  const r = d.resumen, total = r.processed_tickets;
  exigir(entero(total) && r.total_tickets === total && entero(r.correct_count) && entero(r.incorrect_count) && r.correct_count + r.incorrect_count === total,
    'Los agregados no son consistentes: correctas e incorrectas deben coincidir con el total evaluado.');
  const validarFila = (f: { total_tickets: number; correct_count: number; incorrect_count: number; correct_percentage: number; incorrect_percentage: number }) => {
    exigir([f.total_tickets, f.correct_count, f.incorrect_count].every(entero) && f.correct_count + f.incorrect_count === f.total_tickets,
      'Los agregados no son consistentes: hay cantidades inválidas.');
    exigir(tasa(f.correct_count, f.total_tickets, f.correct_percentage) && tasa(f.incorrect_count, f.total_tickets, f.incorrect_percentage),
      'Los porcentajes no son consistentes con sus cantidades y denominadores.');
  };
  validarFila({ ...r, total_tickets: total });
  exigir(Array.isArray(d.resolutores) && Array.isArray(d.meses) && Array.isArray(d.motivos.items), 'Los agregados están incompletos.');
  for (const filas of [d.resolutores, d.meses]) {
    filas.forEach(validarFila);
    exigir(filas.reduce((s, f) => s + f.total_tickets, 0) === total && filas.reduce((s, f) => s + f.correct_count, 0) === r.correct_count &&
      filas.reduce((s, f) => s + f.incorrect_count, 0) === r.incorrect_count, 'Los agregados no son consistentes entre resumen, meses y colaboradores.');
  }
  exigir(d.motivos.total === total && d.motivos.items.every(i => typeof i.reason === 'string' && !!i.reason.trim() && entero(i.total_tickets) && tasa(i.total_tickets, total, i.percentage)) &&
    d.motivos.items.reduce((s, i) => s + i.total_tickets, 0) === total, 'Los motivos o sus porcentajes no son consistentes con el total evaluado.');
  exigir(new Set(d.motivos.items.map(i => i.reason)).size === d.motivos.items.length, 'Se recibieron motivos duplicados.');
  exigir(d.meses.every(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m.month) && m.month.slice(0, 4) !== '0000') && new Set(d.meses.map(m => m.month)).size === d.meses.length,
    'Los meses recibidos son inválidos o están duplicados.');
}

export function analizarCategorizacion(d: RequirementCategorizationReportData): AuditExecutiveAnalysis {
  const r = d.resumen, total = r.processed_tickets, incorrectas = r.incorrect_count;
  if (!total) return { hallazgos: [], conclusion: '', recomendaciones: [] };
  const colaboradores = d.resolutores.filter(f => f.total_tickets > 0), top = topIncorrectas(colaboradores), lider = top[0];
  const empatados = colaboradores.filter(f => f.incorrect_count === lider.incorrect_count);
  const meses = [...d.meses].sort((a, b) => b.incorrect_count - a.incorrect_count || a.month.localeCompare(b.month)), mes = meses[0];
  const mesesEmpatados = meses.filter(m => m.incorrect_count === mes.incorrect_count).length;
  const motivos = [...d.motivos.items].sort((a, b) => b.total_tickets - a.total_tickets || a.reason.localeCompare(b.reason, 'es'));
  const sinDato = motivos.find(m => m.reason === 'SIN_DATO' && m.total_tickets > 0), motivo = sinDato ?? motivos[0];
  const motivoNombre = motivo.reason === 'SIN_DATO' ? 'Sin dato' : motivo.reason;
  const hallazgos: AuditExecutiveFinding[] = [
    { titulo: 'Incorrectas por colaborador', texto: !incorrectas
      ? 'Los ' + numero(colaboradores.length) + ' colaboradores con tickets no registran categorizaciones incorrectas en el alcance filtrado.'
      : colaboradores.length === 1 ? 'El único colaborador del alcance reúne ' + numero(incorrectas) + ' incorrectas. Este filtro no permite comparar colaboradores.'
        : empatados.length > 1 ? 'Máximo individual: ' + numero(lider.incorrect_count) + ' incorrectas (' + porcentaje(lider.incorrect_count, incorrectas) + ' % de las ' + numero(incorrectas) + ' globales), compartido por ' + numero(empatados.length) + ' colaboradores. No equivale a su tasa individual.'
          : nombreColaborador(lider.resolver_name) + ' reúne ' + numero(lider.incorrect_count) + ' de ' + numero(incorrectas) + ' incorrectas (' + porcentaje(lider.incorrect_count, incorrectas) + ' % global). Su tasa individual es ' + porcentaje(lider.incorrect_count, lider.total_tickets) + ' % sobre ' + numero(lider.total_tickets) + ' tickets.' },
    { titulo: 'Distribución mensual', texto: !incorrectas
      ? 'Los ' + numero(meses.length) + ' meses recibidos reúnen ' + numero(r.correct_count) + ' categorizaciones correctas. No se infiere cobertura de meses ausentes.'
      : etiquetaMes(mes.month, true) + ': ' + numero(mes.incorrect_count) + ' incorrectas sobre ' + numero(mes.total_tickets) + ' evaluadas (' + porcentaje(mes.incorrect_count, mes.total_tickets) + ' %). ' +
        (mesesEmpatados > 1 ? 'Hay empate de cantidad en ' + numero(mesesEmpatados) + ' meses; se muestra el primero cronológicamente.' : 'Es la mayor cantidad mensual recibida; no demuestra una tendencia.') },
    { titulo: sinDato ? 'Motivos sin dato' : 'Motivo de mayor volumen', texto: motivoNombre + ': ' + numero(motivo.total_tickets) + ' de ' + numero(total) + ' tickets (' + porcentaje(motivo.total_tickets, total) + ' %). Esta distribución no cruza motivo con resultado de categorización.' },
  ];
  return { hallazgos,
    conclusion: 'En el alcance filtrado se evaluaron ' + numero(total) + ' tickets: ' + numero(r.correct_count) + ' correctas (' + porcentaje(r.correct_count, total) + ' %) y ' + numero(incorrectas) + ' incorrectas (' + porcentaje(incorrectas, total) + ' %). ' +
      (incorrectas ? 'Los conteos permiten focalizar la revisión de registros; no acreditan causas ni responsabilidades.' : 'No hay incorrectas registradas en este conjunto; el resultado no certifica tickets fuera de su cobertura.'),
    recomendaciones: [
      incorrectas ? 'Contrastar una muestra de las ' + numero(incorrectas) + ' incorrectas con el catálogo y la evidencia del ticket; documentar discrepancias antes de proponer correcciones.'
        : 'Mantener un muestreo de las ' + numero(r.correct_count) + ' categorizaciones correctas y documentar su concordancia con el catálogo y la evidencia del ticket.',
      incorrectas ? 'Revisar las ' + numero(mes.incorrect_count) + ' incorrectas de ' + etiquetaMes(mes.month, true) + ' y agrupar diferencias de criterio en una lista verificable de casos a contrastar.'
        : 'Verificar los criterios aplicados en los ' + numero(meses.length) + ' meses recibidos y registrar la cobertura revisada sin extrapolarla a meses ausentes.',
      sinDato ? 'Completar o verificar el motivo de resolución de los ' + numero(sinDato.total_tickets) + ' tickets sin dato antes de interpretar su distribución.'
        : 'Verificar una muestra de los ' + numero(motivo.total_tickets) + ' tickets del motivo ' + motivoNombre + ' y documentar la consistencia de ese campo, sin atribuirle errores de categorización.',
    ] };
}
