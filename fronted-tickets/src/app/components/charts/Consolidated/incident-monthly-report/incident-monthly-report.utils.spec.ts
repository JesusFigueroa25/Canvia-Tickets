import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedVolumenItem } from '../../../../models/incident-consolidated';
import { crearReporteMensual, etiquetasFiltrosMensuales, fechaLima, filtrosReporteMensual } from './incident-monthly-report.utils';

describe('R01: cálculos y análisis mensual', () => {
  const fecha = '2026-11-24T12:00:00Z';
  const disponibilidad = { fecha_min: '2025-01-01', fecha_max: '2026-11-20' };
  function reporte(valores: number[], filtros: IncidentConsolidatedDashboardFilters = {}, inicio = 1) {
    return crearReporteMensual(valores.map((tickets, i) => ({ anio: 2026, mes: inicio + i, periodo: 'etiqueta no canónica', tickets })),
      filtros, disponibilidad, 1, 1, fecha);
  }
  it('suma todos los meses, ordena por año/mes y completa ceros sin mutar la respuesta', () => {
    const filas = [{ anio: 2026, mes: 2, periodo: 'FEB-26', tickets: 30 }, { anio: 2025, mes: 12, periodo: 'DIC-25', tickets: 10 }];
    const original = structuredClone(filas);
    const d = crearReporteMensual(filas, { desde: '2025-12-01', hasta: '2026-02-28' }, disponibilidad, 1, 1, fecha);
    expect(d.meses.map(m => [m.periodo, m.tickets])).toEqual([['2025-12', 10], ['2026-01', 0], ['2026-02', 30]]);
    expect(d.total).toBe(40);
    expect(d.minimos[0].periodo).toBe('2026-01');
    expect(d.meses[1].sinRegistros).toBe(true);
    expect(filas).toEqual(original);
  });
  it('resuelve empates cronológicamente y reconoce el registro uniforme', () => {
    const d = reporte([10, 10, 10]);
    expect(d.maximos).toHaveLength(3);
    expect(d.minimos[0].periodo).toBe('2026-01');
    expect(d.hallazgos).toHaveLength(1);
    expect(d.hallazgos[0]).toContain('uniforme');
    expect(d.conclusion).toContain('iguala');
  });
  it('distingue ceros válidos de una respuesta completamente vacía', () => {
    expect(reporte([0, 0]).total).toBe(0);
    const vacio = reporte([], { desde: '2026-01-01', hasta: '2026-03-31' });
    expect(vacio.meses).toEqual([]);
    expect(vacio.hallazgos).toEqual([]);
  });
  it('incluye los meses parciales en KPIs, pero no los compara', () => {
    const d = reporte([1000, 10, 20, 500], { desde: '2026-01-15', hasta: '2026-04-10' });
    expect(d.total).toBe(1530);
    expect(d.maximos[0].periodo).toBe('2026-01');
    expect(d.meses.map(m => m.estado)).toEqual(['parcial', 'completo', 'completo', 'parcial']);
    expect(d.variaciones.map(v => [v.desde.periodo, v.hasta.periodo])).toEqual([['2026-02', '2026-03']]);
    expect(d.hallazgos).toHaveLength(2); // La variación general no duplica el único par.
  });
  it('usa la disponibilidad de registros y no solo los extremos del filtro', () => {
    const d = crearReporteMensual([{ anio: 2026, mes: 2, periodo: '', tickets: 20 }],
      { desde: '2026-01-01', hasta: '2026-04-30' }, { fecha_min: '2026-01-15', fecha_max: '2026-04-10' }, 1, 1, fecha);
    expect(d.meses.map(m => m.estado)).toEqual(['parcial', 'completo', 'completo', 'parcial']);
    expect(d.variaciones).toHaveLength(1);
  });
  it('no afirma cobertura cuando faltan las fechas de disponibilidad', () => {
    const d = crearReporteMensual([{ anio: 2026, mes: 1, periodo: '', tickets: 10 }], {},
      { fecha_min: null, fecha_max: null }, 1, 1, fecha);
    expect(d.meses[0].estado).toBe('no_confirmado');
    expect(d.variaciones).toEqual([]);
    expect(d.conclusion).toContain('No hay al menos dos');
  });
  it('excluye meses actuales/futuros aunque el rango y la disponibilidad lleguen al fin del mes', () => {
    const d = crearReporteMensual([{ anio: 2026, mes: 11, periodo: '', tickets: 10 }], {},
      { fecha_min: '2026-01-01', fecha_max: '2026-12-31' }, 1, 1, '2026-12-01T03:00:00Z');
    expect(d.meses[0].estado).toBe('parcial'); // Sigue siendo 30/11 en Lima.
    expect(fechaLima(new Date('2026-12-01T03:00:00Z'))).toBe('2026-11-30');
  });
  it('considera febrero bisiesto y solo pares consecutivos completos', () => {
    const d = crearReporteMensual([1, 2, 3].map((tickets, i) => ({ anio: 2024, mes: i + 1, periodo: '', tickets })),
      { desde: '2024-01-01', hasta: '2024-03-31' }, { fecha_min: '2024-01-01', fecha_max: '2024-03-31' }, 1, 1, fecha);
    expect(d.meses.every(m => m.estado === 'completo')).toBe(true);
    expect(d.variaciones).toHaveLength(2);
  });
  it('controla base cero, diferencias absolutas y precisión de porcentajes', () => {
    const d = reporte([0, 3, 4]);
    expect(d.variaciones[0].porcentaje).toBeNull();
    expect(d.variaciones[0].diferencia).toBe(3);
    expect(d.variaciones[1].porcentaje).toBeCloseTo(33.333333);
    expect(d.hallazgos.join(' ')).toContain('33.33');
    expect(d.hallazgos.join(' ')).not.toMatch(/Infinity|NaN/);
  });
  it('prioriza máximo, crecimiento, reducción y variación general sin exceder cuatro', () => {
    const d = reporte([10, 30, 15, 20]);
    expect(d.hallazgos).toHaveLength(4);
    expect(d.hallazgos.map(h => h.split(':')[0])).toEqual([
      'Mayor registro', 'Mayor crecimiento mensual comparable', 'Mayor reducción mensual comparable',
      'Variación general del tramo de meses completos consecutivos',
    ]);
    expect(d.recomendacion).toContain('capacidad');
    expect(reporte([20, 10]).recomendacion).toContain('descenso');
  });
  it('un solo mes no genera una tendencia ni recomendaciones causales', () => {
    const d = reporte([10]);
    expect(d.variaciones).toEqual([]);
    expect(d.hallazgos).toHaveLength(1);
    expect(d.conclusion).toContain('No hay al menos dos');
  });
  it('omite la variación general si repite el mismo cambio ya descrito y desempata tasas cronológicamente', () => {
    expect(reporte([10, 10, 20]).hallazgos).toHaveLength(2);
    const d = reporte([10, 20, 40]);
    expect(d.hallazgos[1]).toContain('ene. 2026 → feb. 2026');
  });
  it('copia todos los filtros aplicables, excluye periodo e incluye etiquetas completas', () => {
    const filtros: IncidentConsolidatedDashboardFilters = {
      desde: '2026-01-01', hasta: '2026-03-31', periodo: '2026-02', grupo_resolutor: 'Grupo ficticio',
      proyecto: 'Proyecto ficticio', proyectos_excluidos: ['Excluido'], tipo_incidente: ['Tipo'], nombre_resolutor: 'Resolutor ficticio',
      descripcion: 'Descripción ficticia', detalle_id: 'REF-1', ticket_id: 'TICKET-1', prioridad: 'Alta', motivo_estado: 'Estado', motivo_resolucion: 'Motivo',
    };
    const original = structuredClone(filtros);
    const d = reporte([1, 2, 3], filtros);
    expect(d.filtros).toEqual(filtrosReporteMensual(original));
    expect(d.filtros).not.toHaveProperty('periodo');
    filtros.tipo_incidente!.push('Otro');
    filtros.proyectos_excluidos!.push('Otro excluido');
    expect(d.filtros.tipo_incidente).toEqual(['Tipo']);
    expect(etiquetasFiltrosMensuales(d).join(' ')).toContain('Proyectos excluidos: Excluido');
    expect(etiquetasFiltrosMensuales(d)).toHaveLength(11);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rechaza cantidades inválidas: %s', tickets => {
    expect(() => reporte([tickets])).toThrow('inválidos');
  });
  it('rechaza duplicados, fechas inválidas, desbordes y filas fuera del rango', () => {
    const fila: IncidentConsolidatedVolumenItem = { anio: 2026, mes: 1, periodo: '', tickets: 1 };
    expect(() => crearReporteMensual([fila, fila], {}, disponibilidad, 1, 1, fecha)).toThrow('duplicados');
    expect(() => reporte([1], { desde: '2026-02-30' })).toThrow('fecha inválida');
    expect(() => reporte([1], { desde: '2026-02-01', hasta: '2026-01-01' })).toThrow('rango');
    expect(() => reporte([1], { desde: '2026-02-01' })).toThrow('fuera del rango');
    expect(() => reporte([Number.MAX_SAFE_INTEGER, 1])).toThrow('precisión');
    expect(() => reporte([1], {}, 13)).toThrow('inválidos');
  });
});
