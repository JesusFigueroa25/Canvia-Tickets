import { IncidentConsolidatedDashboardFilters } from '../../../../models/incident-consolidated';
import { claveFiltrosProyectos, crearReporteProyectos, filtrosReporteProyectos, rangoProyectosValido } from './incident-project-report.utils';
import { proyectosFicticios } from './incident-project-report.fixture';

describe('R02: filtros, denominadores y análisis verificable', () => {
  const preparadoEn = '2026-11-24T12:00:00Z';
  function crear(f = proyectosFicticios()) { return crearReporteProyectos(f.respuestas, f.filtros, f.disponibilidad, 1, preparadoEn); }
  it('mantiene exclusivamente los siete filtros autorizados y copia exclusiones', () => {
    const f: IncidentConsolidatedDashboardFilters = { ...proyectosFicticios().filtros,
      prioridad: 'Alta', motivo_estado: 'Estado ficticio', motivo_resolucion: 'Motivo ficticio',
      proyecto: 'Proyecto individual', periodo: '2025-02', nombre_resolutor: 'Ficticio', descripcion: 'Ficticia', tipo_incidente: ['Tipo'], detalle_id: 'D-1', ticket_id: 'T-1' };
    const copia = structuredClone(f), filtros = filtrosReporteProyectos(f);
    expect(Object.keys(filtros)).toEqual(['desde', 'hasta', 'prioridad', 'motivo_estado', 'motivo_resolucion', 'grupo_resolutor', 'proyectos_excluidos']);
    expect(f).toEqual(copia);
    f.proyectos_excluidos!.push('Otra exclusión');
    expect(filtros.proyectos_excluidos).toEqual(copia.proyectos_excluidos);
    expect(claveFiltrosProyectos(copia)).toBe(claveFiltrosProyectos({ ...copia, proyecto: 'Otro', periodo: '2025-03', ticket_id: 'T-2' }));
  });
  it('reconcilia el total general y diferencia subtotal Top 10 de denominador de la dona', () => {
    const f = proyectosFicticios(), original = structuredClone(f), d = crear(f);
    expect(d.total).toBe(f.respuestas.kpis.total_tickets);
    expect(d.total).toBe(d.distribucion.reduce((s, p) => s + p.cantidad, 0));
    expect(d.total).toBe(d.mensual.total);
    expect(d.subtotalTop).toBeLessThan(d.total);
    expect(d.dona.reduce((s, p) => s + p.cantidad, 0)).toBe(d.total);
    expect(d.dona.reduce((s, p) => s + p.porcentaje, 0)).toBeCloseTo(100);
    expect(d.dona.at(-1)!.cantidad).toBe(d.distribucion.slice(5).reduce((s, p) => s + p.cantidad, 0));
    expect(f).toEqual(original);
  });
  it('produce exactamente tres hallazgos y tres recomendaciones sin inferir estabilidad', () => {
    const d = crear();
    expect(d.hallazgos).toHaveLength(3); expect(d.recomendaciones).toHaveLength(3);
    expect(d.hallazgos[2]).toContain('Último par completo consecutivo');
    expect(d.conclusion).toContain('no acredita una tendencia sostenida');
    expect(d.lideres[0].proyecto).toBe('Proyecto ficticio 01');
    expect(d.mensual.maximos[0].periodo).toBe('2025-03');
  });
  it('maneja uno o menos de cinco proyectos y Otros cero sin arco artificial', () => {
    for (const n of [1, 3, 5]) {
      const d = crear(proyectosFicticios(n));
      expect(d.dona).toHaveLength(n + 1);
      expect(d.dona.at(-1)!.cantidad).toBe(0);
      expect(d.recomendaciones[1]).toContain('no hay volumen adicional');
    }
  });
  it('permite cero tickets sin generar textos ni inventar meses', () => {
    const d = crear(proyectosFicticios(0));
    expect(d.total).toBe(0); expect(d.mensual.meses).toEqual([]);
    expect(d.hallazgos).toEqual([]); expect(d.recomendaciones).toEqual([]);
  });
  it('resuelve empates por nombre y máximos mensuales cronológicamente', () => {
    const f = proyectosFicticios(2, 2);
    f.respuestas.proyectos.forEach(p => p.cantidad = 20);
    f.respuestas.top.proyectos.forEach(p => { p.total_tickets = 20; p.mensual.forEach(m => m.tickets = 10); });
    f.respuestas.volumen.forEach(m => m.tickets = 20); f.respuestas.kpis.total_tickets = 40;
    const d = crear(f);
    expect(d.lideres).toHaveLength(2); expect(d.lideres[0].proyecto).toBe('Proyecto ficticio 01');
    expect(d.mensual.maximos).toHaveLength(2); expect(d.mensual.maximos[0].periodo).toBe('2025-01');
  });
  it('respeta meses parciales y no compara cuando falta cobertura confirmada', () => {
    const f = proyectosFicticios(); f.filtros.desde = '2025-01-15'; f.filtros.hasta = '2025-03-10';
    const d = crear(f);
    expect(d.mensual.meses.map(m => m.estado)).toEqual(['parcial', 'completo', 'parcial']);
    expect(d.hallazgos[2]).toContain('No hay dos meses');
    const sinCobertura = crearReporteProyectos(f.respuestas, f.filtros, { fecha_min: null, fecha_max: null }, 1, preparadoEn);
    expect(sinCobertura.mensual.variaciones).toEqual([]);
  });
  it('no divide por cero en la comparación mensual', () => {
    const f = proyectosFicticios(1, 2);
    f.respuestas.top.proyectos[0].mensual[0].tickets = 0; f.respuestas.top.proyectos[0].total_tickets = 11;
    f.respuestas.volumen[0].tickets = 0; f.respuestas.proyectos[0].cantidad = 11; f.respuestas.kpis.total_tickets = 11;
    expect(crear(f).hallazgos[2]).toContain('base cero');
  });
  it.each(['kpis', 'proyectos', 'volumen'] as const)('bloquea denominadores incompatibles en %s', origen => {
    const f = proyectosFicticios();
    if (origen === 'kpis') f.respuestas.kpis.total_tickets++;
    if (origen === 'proyectos') f.respuestas.proyectos[0].cantidad++;
    if (origen === 'volumen') f.respuestas.volumen[0].tickets++;
    expect(() => crear(f)).toThrow('no coinciden');
  });
  it('rechaza duplicados, proyectos excluidos y cantidades inválidas', () => {
    const f = proyectosFicticios(); f.respuestas.proyectos.push(f.respuestas.proyectos[0]);
    expect(() => crear(f)).toThrow('duplicados');
    const excluido = proyectosFicticios(); excluido.filtros.proyectos_excluidos = [excluido.respuestas.proyectos[0].proyecto];
    expect(() => crear(excluido)).toThrow('excluido');
    for (const v of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const invalido = proyectosFicticios(); invalido.respuestas.kpis.total_tickets = v;
      expect(() => crear(invalido)).toThrow('inválidas');
    }
  });
  it('rechaza ranking incompleto, detalle duplicado y totales individuales incompatibles', () => {
    const f = proyectosFicticios(); f.respuestas.top.proyectos.pop(); expect(() => crear(f)).toThrow('incompleto');
    const repetido = proyectosFicticios(); repetido.respuestas.top.proyectos[0].mensual.push(repetido.respuestas.top.proyectos[0].mensual[0]);
    expect(() => crear(repetido)).toThrow('duplicado');
    const distinto = proyectosFicticios(); distinto.respuestas.top.proyectos[0].total_tickets++;
    expect(() => crear(distinto)).toThrow('no coinciden');
    const mes = proyectosFicticios(); mes.respuestas.top.periodos.pop(); expect(() => crear(mes)).toThrow('todos los meses');
  });
  it('no mezcla el proyecto real llamado Otros con el segmento sintético', () => {
    const f = proyectosFicticios(); f.respuestas.proyectos[0].proyecto = 'Otros'; f.respuestas.top.proyectos[0].proyecto = 'Otros';
    const d = crear(f);
    expect(d.dona.filter(s => s.nombre === 'Otros')).toHaveLength(2);
    expect(new Set(d.dona.map(s => s.clave)).size).toBe(d.dona.length);
  });
  it('rechaza fechas incompletas o inválidas antes de consultar', () => {
    expect(rangoProyectosValido({})).toBe(false);
    expect(rangoProyectosValido({ desde: '2025-02-30', hasta: '2025-03-01' })).toBe(false);
    expect(rangoProyectosValido({ desde: '2025-03-01', hasta: '2025-01-01' })).toBe(false);
    const f = proyectosFicticios(); delete f.filtros.desde; expect(() => crear(f)).toThrow('rango');
  });
});
