import { crearReporteAlertas, filtrosReporteAlertas, filtrosReporteAlertasValidos } from './incident-recurring-alerts-report.utils';
import { alertasFicticias } from './incident-recurring-alerts-report.fixture';

const preparado = '2026-11-24T20:00:00Z';
const crear = (proyecto: string | null = null, cantidades?: number[], total?: number) => {
  const f = alertasFicticias(proyecto, cantidades, total); return crearReporteAlertas(f.respuesta, f.filtros, 1, preparado);
};
describe('R04: filtros, denominadores y análisis determinístico', () => {
  it('omite los filtros dinámicos y el proyecto residual cuando no existe selección', () => {
    const f = alertasFicticias('Proyecto residual');
    const entrada = { ...f.filtros, periodo: '2025-02', nombre_resolutor: 'Ignorado', descripcion: 'Ignorada', tipo_incidente: ['Ignorado'], detalle_id: 'D', ticket_id: 'T' };
    const copia = filtrosReporteAlertas(entrada, null);
    expect(copia).toEqual({ ...f.filtros, proyecto: undefined });
    expect(Object.keys(copia)).toHaveLength(8);
    copia.proyectos_excluidos!.push('Otro'); expect(entrada.proyectos_excluidos).toHaveLength(1);
    expect(filtrosReporteAlertas(entrada, 'Proyecto explícito').proyecto).toBe('Proyecto explícito');
  });
  it('admite modo general y rechaza fechas o exclusiones contradictorias', () => {
    const f = alertasFicticias().filtros;
    expect(filtrosReporteAlertasValidos(f)).toBe(true);
    for (const desde of [undefined, '2025-02-29', '2025-13-01', '2026-01-01']) expect(filtrosReporteAlertasValidos({ ...f, desde })).toBe(false);
    expect(filtrosReporteAlertasValidos({ ...f, proyecto: 'A', proyectos_excluidos: [' a '] })).toBe(false);
  });
  it('usa el total completo como denominador y preserva el ranking, sin mutar entradas', () => {
    const f = alertasFicticias(), original = structuredClone(f);
    const d = crearReporteAlertas(f.respuesta, f.filtros, 8, preparado);
    expect(d.total).toBe(1200); expect(d.topTotal).toBe(900); expect(d.otros).toBe(300);
    expect(d.participacionTop).toBe(75); expect(d.participacionOtros).toBe(25);
    expect(d.alertas.map(a => a.descripcion)).toEqual(f.respuesta.descripciones.map(a => a.descripcion));
    expect(d.alertas[0].porcentaje).toBeCloseTo(100 * 320 / 1200);
    expect(d.hallazgos).toHaveLength(3); expect(d.recomendaciones).toHaveLength(3); expect(d.conclusion).toContain('900 de 1,200');
    expect(f).toEqual(original);
    f.respuesta.descripciones[0].cantidad = 1; f.filtros.proyectos_excluidos!.push('Posterior');
    expect(d.alertas[0].cantidad).toBe(320); expect(d.filtros.proyectos_excluidos).toHaveLength(1);
  });
  it('identifica ambos modos y conserva el nombre completo del proyecto', () => {
    const proyecto = 'PRY-042 Proyecto ficticio regional de infraestructura y servicios compartidos';
    expect(crear().modo).toBe('general');
    const d = crear(proyecto); expect(d.modo).toBe('proyecto'); expect(d.filtros.proyecto).toBe(proyecto);
    expect(d.conclusion).toContain('del proyecto seleccionado');
  });
  it('no impone mínimo de recurrencia y mantiene Sin especificar con aclaración', () => {
    const f = alertasFicticias(null, [1], 1); f.respuesta.descripciones[0].descripcion = 'Sin especificar';
    const d = crearReporteAlertas(f.respuesta, f.filtros, 1, preparado);
    expect(d.alertas[0].cantidad).toBe(1); expect(d.topTotal).toBe(1); expect(d.otros).toBe(0);
    expect(d.avisoSinEspecificar).toContain('sin identificación específica'); expect(d.hallazgos[2]).toBe(d.avisoSinEspecificar);
    expect(d.recomendaciones[2]).toContain('Completar o verificar');
  });
  it('no suma porcentajes redondeados para calcular la participación acumulada', () => {
    const d = crear(null, [1, 1, 1], 3);
    expect(d.participacionTop).toBe(100); expect(d.otros).toBe(0); expect(d.alertas.map(a => a.porcentaje)).toEqual([100 / 3, 100 / 3, 100 / 3]);
  });
  it('valida cobertura completa con menos de cinco filas según el contrato SQL revisado', () => {
    expect(crear(null, [8, 2], 10).otros).toBe(0);
    const f = alertasFicticias(null, [8, 2], 20);
    expect(() => crearReporteAlertas(f.respuesta, f.filtros, 1, preparado)).toThrow('no cubre el universo');
  });
  it('no afirma conocer empates fuera del corte ni reordena los empates recibidos', () => {
    const d = crear(null, [10, 10, 10, 10, 10], 100);
    expect(d.lideresVisibles).toHaveLength(5); expect(d.hallazgos[0]).toContain('No se infieren empates fuera del corte');
    expect(d.alertas[0].descripcion).toContain('disponibilidad');
  });
  it('completa exactamente tres hallazgos con una o dos categorías sin inventar persistencia', () => {
    for (const d of [crear(null, [5], 5), crear(null, [8, 2], 10)]) {
      expect(d.hallazgos).toHaveLength(3); expect(new Set(d.hallazgos).size).toBe(3); expect(d.recomendaciones).toHaveLength(3);
      expect(d.hallazgos[2]).toContain('no demuestran persistencia');
    }
  });
  it('trata total cero como ausencia de reporte, sin líder ni porcentajes inventados', () => {
    const d = crear(null, [], 0);
    expect(d.alertas).toHaveLength(0); expect(d.hallazgos).toHaveLength(0); expect(d.recomendaciones).toHaveLength(0);
    expect(d.participacionTop).toBe(0); expect(d.participacionOtros).toBe(0);
  });
  it.each(['limite', 'filas', 'duplicadas', 'vacia', 'negativa', 'fraccionaria', 'orden', 'porcentaje', 'suma', 'total cero', 'sin filas', 'precision'])(
    'bloquea respuestas incoherentes: %s', caso => {
      const f = alertasFicticias(); const r = f.respuesta;
      if (caso === 'limite') r.limite = 20;
      if (caso === 'filas') r.descripciones.push({ descripcion: 'Extra', cantidad: 1, porcentaje: 0.08 });
      if (caso === 'duplicadas') r.descripciones[1].descripcion = r.descripciones[0].descripcion;
      if (caso === 'vacia') r.descripciones[0].descripcion = ' ';
      if (caso === 'negativa') r.descripciones[0].cantidad = -1;
      if (caso === 'fraccionaria') r.descripciones[0].cantidad = 1.5;
      if (caso === 'orden') r.descripciones.reverse();
      if (caso === 'porcentaje') r.descripciones[0].porcentaje = 50;
      if (caso === 'suma') { r.total_general = 800; r.descripciones.forEach(a => a.porcentaje = a.cantidad * 100 / 800); }
      if (caso === 'total cero') r.total_general = 0;
      if (caso === 'sin filas') r.descripciones = [];
      if (caso === 'precision') r.total_general = Number.MAX_SAFE_INTEGER + 1;
      expect(() => crearReporteAlertas(r, f.filtros, 1, preparado)).toThrow();
    });
});
