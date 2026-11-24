import { crearReporteProyectoMensual, filtrosReporteProyectoMensual, seleccionProyectoMensualValida } from './incident-project-monthly-report.utils';
import { proyectoMensualFicticio } from './incident-project-monthly-report.fixture';

const preparado = '2026-11-24T12:00:00Z';
const crear = (valores?: number[]) => { const f = proyectoMensualFicticio(valores); return crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado); };

describe('R03: identidad, reconciliación y análisis puro por proyecto', () => {
  it('usa la selección explícita y una copia de solo los filtros globales permitidos', () => {
    const f = proyectoMensualFicticio();
    const entrada = { ...f.filtros, proyecto: 'Ignorado', periodo: '2025-02', nombre_resolutor: 'Ignorado', descripcion: 'Ignorada', tipo_incidente: ['Ignorado'], detalle_id: 'D', ticket_id: 'T' };
    const copia = filtrosReporteProyectoMensual(entrada, f.proyecto);
    expect(copia).toEqual(f.filtros);
    copia.proyectos_excluidos!.push('Otro'); expect(entrada.proyectos_excluidos).toHaveLength(1);
    expect(filtrosReporteProyectoMensual(entrada, null).proyecto).toBe('');
  });
  it('rechaza selección vacía, exclusiones contradictorias y fechas inválidas', () => {
    const f = proyectoMensualFicticio().filtros;
    expect(seleccionProyectoMensualValida(f)).toBe(true);
    expect(seleccionProyectoMensualValida({ ...f, proyecto: ' ' })).toBe(false);
    expect(seleccionProyectoMensualValida({ ...f, proyectos_excluidos: [f.proyecto.toUpperCase()] })).toBe(false);
    for (const desde of [undefined, '2025-02-29', '2025-13-01', '2026-01-01']) expect(seleccionProyectoMensualValida({ ...f, desde })).toBe(false);
  });
  it('reconcilia el proyecto filtrado aunque no figure en el Top 10 general y no muta entradas', () => {
    const f = proyectoMensualFicticio(), copia = structuredClone(f);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 8, preparado);
    expect(d.proyecto).toBe(f.proyecto); expect(d.mensual.total).toBe(910);
    expect(d.mensual.maximos[0].tickets).toBe(210);
    expect(d.variacionPeriodo?.diferencia).toBe(40);
    expect(d.variacionPeriodo?.porcentaje).toBeCloseTo(100 / 3);
    expect(d.hallazgos).toHaveLength(3); expect(d.recomendaciones).toHaveLength(3);
    expect(f).toEqual(copia);
    f.filtros.proyectos_excluidos!.push('Cambio'); f.respuestas.top.proyectos[0].mensual[0].tickets = 1;
    expect(d.filtros.proyectos_excluidos).toHaveLength(1); expect(d.mensual.meses[0].tickets).toBe(120);
  });
  it('incluye parciales en KPI pero identifica febrero y mayo como extremos completos', () => {
    const f = proyectoMensualFicticio(); f.filtros.desde = '2025-01-15'; f.filtros.hasta = '2025-06-12';
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado);
    expect(d.mensual.total).toBe(910); expect(d.mensual.meses).toHaveLength(6);
    expect(d.variacionPeriodo?.desde.periodo).toBe('2025-02'); expect(d.variacionPeriodo?.hasta.periodo).toBe('2025-05');
    expect(d.variacionPeriodo?.diferencia).toBe(30);
    expect(d.mensual.variaciones.every(v => v.desde.estado === 'completo' && v.hasta.estado === 'completo')).toBe(true);
  });
  it('conserva ceros y diferencia absoluta con base cero, sin infinito ni porcentaje ficticio', () => {
    const d = crear([0, 10, 20]);
    expect(d.mensual.meses[0].tickets).toBe(0); expect(d.variacionPeriodo?.diferencia).toBe(20);
    expect(d.variacionPeriodo?.porcentaje).toBeNull(); expect(d.hallazgos[0]).toContain('base cero');
    expect(JSON.stringify(d)).not.toContain('Infinity');
  });
  it.each([[12], [12, 15]])('no inventa comparaciones sin cobertura confirmada (%j)', (...valores) => {
    const f = proyectoMensualFicticio(valores);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, { fecha_min: null, fecha_max: null }, 1, preparado);
    expect(d.variacionPeriodo).toBeNull(); expect(d.mensual.variaciones).toHaveLength(0);
    expect(d.hallazgos).toHaveLength(3); expect(new Set(d.hallazgos).size).toBe(3);
    expect(d.hallazgos[0]).toContain('No hay');
  });
  it('no compara el mes actual ni meses futuros y admite un único mes sin variación', () => {
    const f = proyectoMensualFicticio([10, 20, 30]);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, '2025-02-20T12:00:00Z');
    expect(d.variacionPeriodo).toBeNull(); expect(d.mensual.meses.map(m => m.estado)).toEqual(['completo', 'parcial', 'parcial']);
    expect(crear([10]).variacionPeriodo).toBeNull();
  });
  it('distingue repunte parcial de recuperación del nivel previo', () => {
    expect(crear([200, 100, 150, 250]).hallazgos[2]).toContain('repunte parcial');
    expect(crear([200, 100, 220, 250]).hallazgos[2]).toContain('recupera el nivel previo');
    expect(crear([200, 100, 220, 250]).hallazgos[2]).toContain('sin acreditar continuidad');
  });
  it('excluye del seguimiento posterior un mes parcial y no repite el único par en dos hallazgos', () => {
    const f = proyectoMensualFicticio([200, 100, 220]); f.filtros.hasta = '2025-03-15';
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado);
    expect(d.hallazgos.join(' ')).not.toContain('recupera');
    const dos = crear([10, 20]);
    expect(dos.hallazgos.filter(h => h.includes('ene. 2025 → feb. 2025'))).toHaveLength(1);
  });
  it('resuelve empates cronológicamente sin afirmar estabilidad al igualar extremos', () => {
    const d = crear([100, 200, 400]); expect(d.hallazgos[1]).toContain('ene. 2025 → feb. 2025');
    const iguales = crear([10, 10, 10]); expect(iguales.mensual.maximos).toHaveLength(3);
    expect(iguales.hallazgos).toHaveLength(3); expect(iguales.recomendaciones[1]).toContain('no demuestra estabilidad');
  });
  it('ordena cruces de año aunque el servidor entregue períodos desordenados', () => {
    const f = proyectoMensualFicticio(Array.from({ length: 14 }, (_, i) => i));
    f.respuestas.top.periodos.reverse(); f.respuestas.top.proyectos[0].mensual.reverse();
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado);
    expect(d.mensual.meses[0].periodo).toBe('2025-01'); expect(d.mensual.meses.at(-1)?.periodo).toBe('2026-02');
    expect(d.mensual.meses.map(m => m.tickets)).toEqual(Array.from({ length: 14 }, (_, i) => i));
  });
  it('trata cero tickets como ausencia de reporte, sin inventar una serie', () => {
    const d = crear([0, 0]); expect(d.mensual.total).toBe(0); expect(d.mensual.meses).toHaveLength(0);
    expect(d.hallazgos).toHaveLength(0); expect(d.recomendaciones).toHaveLength(0);
  });
  it.each(['kpi', 'identidad', 'ranking', 'mes duplicado', 'mes faltante', 'periodo duplicado', 'cantidad', 'rango'])(
    'bloquea datos incoherentes: %s', caso => {
      const f = proyectoMensualFicticio(); const top = f.respuestas.top;
      if (caso === 'kpi') f.respuestas.kpis.total_tickets++;
      if (caso === 'identidad') top.proyectos[0].proyecto = 'Proyecto incorrecto';
      if (caso === 'ranking') top.proyectos.push(structuredClone(top.proyectos[0]));
      if (caso === 'mes duplicado') top.proyectos[0].mensual.push(top.proyectos[0].mensual[0]);
      if (caso === 'mes faltante') { top.periodos.shift(); top.proyectos[0].mensual.shift(); }
      if (caso === 'periodo duplicado') top.periodos.push(top.periodos[0]);
      if (caso === 'cantidad') top.proyectos[0].mensual[0].tickets = -1;
      if (caso === 'rango') top.periodos[0].anio = 2024;
      expect(() => crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado)).toThrow();
    });
  it('admite la identidad normalizada Sin especificar sin exigir un proyecto no nulo en KPI', () => {
    const f = proyectoMensualFicticio(); f.filtros.proyecto = 'Sin especificar'; f.respuestas.top.proyectos[0].proyecto = 'Sin especificar'; f.respuestas.kpis.total_proyectos = 0;
    expect(crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, preparado).mensual.total).toBe(910);
  });
  it('rechaza cantidades fraccionarias y totales fuera de la precisión segura', () => {
    expect(() => crear([1.5, 2])).toThrow();
    expect(() => crear([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
});
