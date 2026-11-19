import {
  bloques,
  matrizTiempos,
  validarPagina,
  validarReporte,
} from './tickets-report-times-report.utils';
import { reporteTiemposFicticio } from './tickets-report-times-report.fixture';

describe('Tiempos: integridad de los agregados del PNG', () => {
  it('acepta todas las filas y conserva los datos originales', () => {
    const d = reporteTiemposFicticio(),
      original = structuredClone(d);
    validarReporte(d);
    const m = matrizTiempos(d.detalleResolutores.items);
    expect(m.filas).toHaveLength(12);
    expect(m.periodos).toHaveLength(12);
    expect(m.filas[0].nombre).toBe('Especialista ficticio 11');
    expect(m.filas[0].total).toBe(15);
    expect(bloques(m.periodos).map((b) => b.length)).toEqual([6, 6]);
    expect(d).toEqual(original);
  });
  it('rechaza páginas incompletas, metadatos inválidos y registros duplicados', () => {
    const d = reporteTiemposFicticio();
    const pagina = {
      resumen: d.detalleResolutores.resumen,
      items: d.detalleResolutores.items.slice(100),
      pagina: 2,
      tamano: 100,
      total: 144,
      total_paginas: 2,
    };
    expect(() => validarPagina(pagina, 2, 100)).not.toThrow();
    expect(() => validarPagina({ ...pagina, items: pagina.items.slice(1) }, 2, 100)).toThrow();
    expect(() => validarPagina({ ...pagina, total_paginas: 3 }, 2, 100)).toThrow();
    pagina.items[1] = pagina.items[0];
    expect(() => validarPagina(pagina, 2, 100)).toThrow(/duplicados/);
  });
  it('no confunde suma por resolutor con tickets únicos', () => {
    const d = reporteTiemposFicticio(1, 2);
    d.kpis.total_tickets = 1;
    d.volumenMensual[0].tickets = 1;
    d.detalleResolutores.resumen.tickets_distintos = 1;
    d.detalleProyectos.resumen.tickets_distintos = 1;
    expect(() => validarReporte(d)).not.toThrow();
  });
  it('no reconstruye tickets únicos sumando meses', () => {
    const d = reporteTiemposFicticio(2, 1);
    d.kpis.total_tickets = 1;
    d.detalleResolutores.resumen.tickets_distintos = 1;
    d.detalleProyectos.resumen.tickets_distintos = 1;
    expect(() => validarReporte(d)).not.toThrow();
  });
  it('acepta diferencias de redondeo acumuladas y rechaza sumas incoherentes', () => {
    const d = reporteTiemposFicticio();
    d.detalleResolutores.items[0].horas_totales += 0.01;
    expect(() => validarReporte(d)).not.toThrow();
    d.detalleResolutores.items[0].horas_totales += 10;
    expect(() => validarReporte(d)).toThrow(/sumas/);
  });
  it('rechaza agregados incompatibles, filas faltantes y series inválidas', () => {
    let d = reporteTiemposFicticio();
    d.kpis.total_tickets++;
    expect(() => validarReporte(d)).toThrow(/agregados/);
    d = reporteTiemposFicticio();
    d.detalleResolutores.items.pop();
    expect(() => validarReporte(d)).toThrow(/completo/);
    d = reporteTiemposFicticio();
    d.graficoProyectos.series[0].mensual[0].horas = NaN;
    expect(() => validarReporte(d)).toThrow(/Serie/);
  });
});
