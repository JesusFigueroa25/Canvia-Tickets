import { analizarCategorizacion, etiquetaMes, nombreColaborador, topIncorrectas, validarReporteCategorizacion } from './requirement-categorization-report.utils';
import { reporteFicticio, reporteResultadoFicticio } from './requirement-categorization-report.fixture';
import type { RequirementCategorizationReportData } from '../../../../models/requirement-categorization-audit';

describe('Categorización ejecutiva: contratos y reglas descriptivas', () => {
  it('valida el universo completo sin utilizar error_count ni la cantidad de filas como denominadores', () => {
    const d = reporteFicticio(); d.resumen.error_count = 999; d.resumen.completed_runs = 100;
    expect(() => validarReporteCategorizacion(d)).not.toThrow(); expect(d.resolutores.length).toBe(12); expect(d.resumen.processed_tickets).toBe(120);
  });
  it('ordena incorrectas, total y nombre; conserva cero incorrectas y no confunde tasa con cantidad', () => {
    const fila = reporteFicticio().resolutores[0];
    const filas = [{ ...fila, resolver_name: 'Volumen', total_tickets: 100, incorrect_count: 10 }, { ...fila, resolver_name: 'Tasa', total_tickets: 5, incorrect_count: 5 },
      { ...fila, resolver_name: 'Zeta', total_tickets: 20, incorrect_count: 10 }, { ...fila, resolver_name: 'Alfa', total_tickets: 20, incorrect_count: 10 }, { ...fila, resolver_name: null, incorrect_count: 0 }];
    const original = structuredClone(filas);
    expect(topIncorrectas(filas).map(f => nombreColaborador(f.resolver_name))).toEqual(['Volumen', 'Alfa', 'Zeta', 'Tasa', 'Sin asignar']); expect(filas).toEqual(original);
  });
  it('limita a diez sin cambiar los totales de los doce colaboradores', () => {
    const d = reporteFicticio(), top = topIncorrectas(d.resolutores); expect(top).toHaveLength(10);
    expect(top.reduce((s, r) => s + r.total_tickets, 0)).toBe(100); expect(d.resumen.processed_tickets).toBe(120);
  });
  it('acepta meses dispersos y cruces de año sin inventar continuidad', () => {
    const d = reporteFicticio(); d.meses = [{ month: '2025-12', total_tickets: 60, correct_count: 42, incorrect_count: 18, correct_percentage: 70, incorrect_percentage: 30 },
      { month: '2026-03', total_tickets: 60, correct_count: 42, incorrect_count: 18, correct_percentage: 70, incorrect_percentage: 30 }];
    expect(() => validarReporteCategorizacion(d)).not.toThrow(); expect(etiquetaMes('2025-12')).toContain('2025');
  });
  it('conserva todas las categorías y acepta redondeo que no suma cien', () => {
    const d = reporteFicticio(); d.motivos.items = [37, 37, 46].map((n, i) => ({ reason: ['Categoría adicional', 'Otra categoría', 'SIN_DATO'][i], total_tickets: n, percentage: Math.round(n * 10000 / 120) / 100 }));
    expect(d.motivos.items.reduce((s, i) => s + i.percentage, 0)).toBeCloseTo(99.99); expect(() => validarReporteCategorizacion(d)).not.toThrow();
  });
  it('genera tres hallazgos y recomendaciones sin modificar la instantánea', () => {
    const d = reporteFicticio(), original = structuredClone(d), a = analizarCategorizacion(d);
    expect(a.hallazgos).toHaveLength(3); expect(a.recomendaciones).toHaveLength(3); expect(a.conclusion).toContain('120');
    expect(a.hallazgos[0].texto).toContain('8.33 %'); expect(a.hallazgos[2].texto).toContain('12 de 120'); expect(d).toEqual(original);
  });
  it('distingue participación global y tasa individual de un líder', () => {
    const d = reporteFicticio(); d.resolutores[0].incorrect_count = 6; d.resolutores[0].correct_count = 4;
    d.resolutores[1].incorrect_count = 0; d.resolutores[1].correct_count = 10;
    const a = analizarCategorizacion(d); expect(a.hallazgos[0].texto).toContain('16.67 % global'); expect(a.hallazgos[0].texto).toContain('60.00 % sobre 10');
  });
  it.each([true, false])('resuelve el extremo correcto=%s sin división cero ni afirmaciones de mejora', correcto => {
    const d = reporteResultadoFicticio(correcto); validarReporteCategorizacion(d); const a = analizarCategorizacion(d);
    expect(a.hallazgos).toHaveLength(3); expect(a.recomendaciones).toHaveLength(3); expect(JSON.stringify(a)).not.toMatch(/NaN|Infinity/);
    if (correcto) expect(a.conclusion).toContain('No hay incorrectas');
  });
  it('da seguimiento al motivo predominante cuando no hay SIN_DATO', () => {
    const d = reporteFicticio(); d.motivos.items[2].reason = 'Categoría nueva completa'; const a = analizarCategorizacion(d);
    expect(a.hallazgos[2].texto).toContain('Atribuible a Cliente'); expect(a.recomendaciones[2]).toContain('sin atribuirle errores');
  });
  const invalidos: [string, (d: RequirementCategorizationReportData) => void][] = [
    ['cantidades inconsistentes', d => { d.resumen.correct_count++; }],
    ['entero inseguro', d => { d.resumen.processed_tickets = Number.MAX_SAFE_INTEGER + 1; }],
    ['tasa general incorrecta', d => { d.resumen.correct_percentage = 80; }],
    ['tasa local incorrecta', d => { d.resolutores[0].incorrect_percentage = 90; }],
    ['cobertura incompleta de colaboradores', d => { d.resolutores.pop(); }],
    ['cobertura incompleta mensual', d => { d.meses.pop(); }],
    ['motivos con otro denominador', d => { d.motivos.total = 100; }],
    ['tasa de motivo incorrecta', d => { d.motivos.items[0].percentage = 40; }],
    ['motivo duplicado', d => { d.motivos.items[1].reason = d.motivos.items[0].reason; }],
    ['mes duplicado', d => { d.meses[1].month = d.meses[0].month; }],
    ['mes inválido', d => { d.meses[0].month = '2026-13'; }],
  ];
  it.each(invalidos)('rechaza %s', (_, mutar) => { const d = reporteFicticio(); mutar(d); expect(() => validarReporteCategorizacion(d)).toThrow(); });
});
