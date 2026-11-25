import { claveResumen, copiarFiltrosResumen, crearResumenEjecutivo, fechasResumenValidas } from './incident-executive-summary-report.utils';
import { resumenFicticio } from './incident-executive-summary-report.fixture';
import type { IncidentExecutiveSummarySources } from '../../../../models/incident-executive-summary-report';

describe('Resumen Ejecutivo: cantidades, prioridades públicas y filtros', () => {
  const crear = (f = resumenFicticio()) => crearResumenEjecutivo(f.fuentes, f.filtros, 7, '2026-11-25T13:00:00Z');
  it('reconcilia KPI y distingue los denominadores de atribución y servidores', () => {
    const d = crear(); expect([d.total, d.atribuidos, d.sinAtribucion]).toEqual([1000, 800, 200]);
    expect(d.ajustada.distribucion_original[0].porcentaje).toBe(75); expect(d.servidores[0].porcentaje).toBe(40);
    expect(d.servidores.reduce((s, i) => s + i.incidentes, 0)).toBeGreaterThan(d.total);
  });
  it('selecciona cruces/patrones y la conclusión prioritaria sin asumir el orden del array', () => {
    const f = resumenFicticio(), a = crear(f);
    expect(a.hallazgos.map(h => h.codigo)).toEqual(['H04', 'H05', 'H02', 'H03']); expect(a.conclusion!.codigo).toBe('C03');
    f.fuentes.analisis.hallazgos.hallazgos.reverse(); f.fuentes.analisis.conclusiones.conclusiones.reverse();
    expect(crear(f)).toEqual(a);
  });
  it('preserva todas las referencias de la pareja elegida dentro del máximo de cuatro', () => {
    const f = resumenFicticio(); f.fuentes.analisis.conclusiones.conclusiones[2].hallazgos_referencia = ['H01', 'H02', 'H04', 'H05'];
    const d = crear(f); expect(d.hallazgos).toHaveLength(4);
    expect(d.conclusion!.hallazgos_referencia.every(ref => d.hallazgos.some(h => h.codigo === ref))).toBe(true);
  });
  it('conserva cifras negativas y tasas de tendencia sin reinterpretar sus unidades', () => {
    const h = crear().hallazgos.find(i => i.tipo === 'tendencia')!;
    expect([h.valor, h.porcentaje, h.denominador]).toEqual([-30, -25, 120]);
  });
  it('admite respaldo identificado y ausencia exclusiva de servidores', () => {
    const d = crear(resumenFicticio(true, true)); expect(d.origen).toBe('reglas'); expect(d.advertencia).toContain('respaldo'); expect(d.servidores).toHaveLength(0); expect(d.total).toBe(1000);
  });
  it('copia la instantánea y todos los filtros efectivos sin tocar el original', () => {
    const f = resumenFicticio(); Object.assign(f.filtros, { proyecto: 'Proyecto completo', tipo_incidente: ['Tipo A'], proyectos_excluidos: ['Otro'], periodo: '2025-02', descripcion: 'Descripción', nombre_resolutor: 'Resolutor ficticio', detalle_id: 'D', ticket_id: 'T' });
    const original = structuredClone(f), d = crear(f); expect(f).toEqual(original); expect(d.filtros).toEqual(f.filtros);
    f.filtros.tipo_incidente!.push('Tipo B'); f.filtros.proyectos_excluidos!.push('Más'); f.fuentes.ajustada.comparacion[0].tickets_originales = 0;
    f.fuentes.analisis.hallazgos.hallazgos[3].descripcion = 'Mutación'; f.fuentes.analisis.conclusiones.conclusiones[2].hallazgos_referencia.push('H05');
    expect(d.filtros.tipo_incidente).toEqual(['Tipo A']); expect(d.ajustada.comparacion[0].tickets_originales).toBe(600);
    expect(d.hallazgos.find(h => h.codigo === 'H04')!.descripcion).not.toBe('Mutación'); expect(d.conclusion!.hallazgos_referencia).toEqual(['H04']);
  });
  it('mantiene el Top 5 aunque la consulta visible permita más servidores', () => {
    const f = resumenFicticio(); f.fuentes.servidores.limite = 20;
    f.fuentes.servidores.servidores.push(...[110, 90].map((incidentes, i) => ({ servidor: `OTRO-${i}`, incidentes, porcentaje: incidentes / 10, tickets_ejemplo: [] })));
    f.fuentes.servidores.servidores.sort((a, b) => b.incidentes - a.incidentes);
    expect(crear(f).servidores).toHaveLength(5);
  });
  it('permite total positivo sin atribución definida', () => {
    const f = resumenFicticio(), a = f.fuentes.ajustada;
    a.total_atribuidos_original = a.total_atribuidos_ajustado = 0; a.sin_atribucion_original = a.sin_atribucion_ajustado = a.total_tickets;
    for (const d of [a.distribucion_original, a.distribucion_ajustada]) d.forEach(i => { i.tickets = i.porcentaje = 0; });
    a.comparacion.forEach(i => { i.tickets_originales = i.tickets_ajustados = i.porcentaje_original = i.porcentaje_ajustado = 0; });
    expect(crear(f).atribuidos).toBe(0);
  });
  it('representa el conjunto vacío sin inventar hallazgos', () => {
    const f = resumenFicticio(true), a = f.fuentes.ajustada;
    a.total_tickets = a.total_atribuidos_original = a.total_atribuidos_ajustado = a.sin_atribucion_original = a.sin_atribucion_ajustado = 0;
    for (const d of [a.distribucion_original, a.distribucion_ajustada]) d.forEach(i => { i.tickets = i.porcentaje = 0; });
    a.comparacion.forEach(i => { i.tickets_originales = i.tickets_ajustados = i.porcentaje_original = i.porcentaje_ajustado = 0; });
    f.fuentes.servidores.total_incidentes = f.fuentes.servidores.incidentes_sin_servidor = 0;
    const ia = f.fuentes.analisis; ia.origen = 'sin_datos'; ia.hallazgos.total_incidentes = ia.hallazgos.total_hallazgos = ia.conclusiones.total_incidentes = ia.conclusiones.total_conclusiones = 0;
    ia.hallazgos.hallazgos = []; ia.conclusiones.conclusiones = [];
    expect(crear(f).total).toBe(0); expect(crear(f).conclusion).toBeNull();
  });
  it('valida fechas de calendario, conflicto de exclusiones y claves de todos los filtros', () => {
    const f = resumenFicticio().filtros;
    expect(fechasResumenValidas(f)).toBe(true); expect(fechasResumenValidas({ ...f, desde: '2025-02-30' })).toBe(false);
    expect(fechasResumenValidas({ ...f, desde: f.hasta, hasta: f.desde })).toBe(false);
    expect(fechasResumenValidas({ ...f, proyecto: ' A ', proyectos_excluidos: ['a'] })).toBe(false);
    expect(claveResumen({ ...f, periodo: '2025-02' })).not.toBe(claveResumen(f)); expect(copiarFiltrosResumen(f)).not.toBe(f);
  });
  const invalidas: [string, (s: IncidentExecutiveSummarySources) => void][] = [
    ['KPI incoherente', s => { s.ajustada.sin_atribucion_original++; }],
    ['entero inseguro', s => { s.ajustada.total_tickets = Number.MAX_SAFE_INTEGER + 1; }],
    ['porcentaje sobre base incorrecta', s => { s.ajustada.distribucion_original[0].porcentaje = 60; }],
    ['categoría duplicada', s => { s.ajustada.distribucion_original[1].atribucion = s.ajustada.distribucion_original[0].atribucion; }],
    ['comparación incongruente', s => { s.ajustada.comparacion[0].tickets_ajustados++; }],
    ['ajuste sin autorización', s => { s.ajustada.ajustes_aplicados = 1; }],
    ['servidores de otro total', s => { s.servidores.total_incidentes++; }],
    ['servidor duplicado', s => { s.servidores.servidores[1].servidor = s.servidores.servidores[0].servidor; }],
    ['tasa incorrecta de servidor', s => { s.servidores.servidores[0].porcentaje = 50; }],
    ['ranking insuficiente', s => { s.servidores.servidores.pop(); }],
    ['asociaciones insuficientes', s => { s.servidores.total_asociaciones = 900; }],
    ['análisis de otro alcance', s => { s.analisis.hallazgos.total_incidentes++; }],
    ['origen sin datos con total positivo', s => { s.analisis.origen = 'sin_datos'; }],
    ['hallazgo incompleto', s => { s.analisis.hallazgos.hallazgos[0].descripcion = ''; }],
    ['porcentaje incoherente en tendencia', s => { s.analisis.hallazgos.hallazgos[2].porcentaje = 25; }],
    ['conclusión sin recomendación', s => { s.analisis.conclusiones.conclusiones[0].recomendacion = ''; }],
    ['referencia inexistente', s => { s.analisis.conclusiones.conclusiones[0].hallazgos_referencia = ['H99']; }],
    ['narrativa incompleta', s => { s.analisis.conclusiones.total_conclusiones = 0; }],
  ];
  it.each(invalidas)('bloquea %s', (_, mutar) => { const f = resumenFicticio(); mutar(f.fuentes); expect(() => crear(f)).toThrow(); });
});
