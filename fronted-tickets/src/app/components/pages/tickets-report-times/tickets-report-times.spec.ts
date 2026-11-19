import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { TicketsReportTimesService } from '../../../services/tickets-report-times.service';
import { TicketsReportTimesReportData } from '../../../models/tickets-report-times';
import { TicketsReportTimes } from './tickets-report-times';
import { reporteTiemposFicticio } from '../../charts/Consolidated/tickets-report-times-report/tickets-report-times-report.fixture';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
type Peticion = { metodo: string; args: unknown[]; respuesta: Subject<unknown> };

describe('Tiempos: preparación y descarga PNG', () => {
  let pagina: TicketsReportTimes;
  let datos: TicketsReportTimesReportData;
  let peticiones: Peticion[];
  let servicio: Record<string, ReturnType<typeof vi.fn>>;
  let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    datos = reporteTiemposFicticio();
    peticiones = [];
    servicio = Object.fromEntries(
      [
        'obtenerKpis',
        'obtenerVolumenMensual',
        'obtenerTiemposResolutores',
        'obtenerTiemposResolutoresGrafico',
        'obtenerTiemposProyectos',
        'obtenerTiemposProyectosGrafico',
        'obtenerFiltros',
      ].map((metodo) => [
        metodo,
        vi.fn((...args: unknown[]) => {
          const respuesta = new Subject<unknown>();
          peticiones.push({ metodo, args, respuesta });
          return respuesta;
        }),
      ]),
    );
    pagina = new TicketsReportTimes(
      new FormBuilder(),
      servicio as unknown as TicketsReportTimesService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    pagina.filtrosActuales = structuredClone(datos.filtros);
    pagina.filtrosListos = true;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.mocked(toPng)
      .mockReset()
      .mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
    const documento = document.createElement('section');
    documento.className = 'report-document';
    Object.defineProperties(documento, {
      scrollWidth: { value: 1400 },
      scrollHeight: { value: 3500, configurable: true },
    });
    const stage = document.createElement('div');
    stage.appendChild(documento);
    pagina.reporteImagen = new ElementRef(stage);
    pagina.cargarDashboard();
  });
  afterEach(() => {
    pagina.ngOnDestroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function responder(p: Peticion): void {
    let valor: unknown;
    switch (p.metodo) {
      case 'obtenerKpis':
        valor = datos.kpis;
        break;
      case 'obtenerVolumenMensual':
        valor = datos.volumenMensual;
        break;
      case 'obtenerTiemposResolutoresGrafico':
        valor = datos.graficoResolutores;
        break;
      case 'obtenerTiemposProyectosGrafico':
        valor = datos.graficoProyectos;
        break;
      default: {
        const d =
          p.metodo === 'obtenerTiemposResolutores'
            ? datos.detalleResolutores
            : datos.detalleProyectos;
        const numero = p.args[1] as number,
          tamano = p.args[2] as number;
        valor = {
          resumen: d.resumen,
          items: d.items.slice((numero - 1) * tamano, numero * tamano),
          total: d.totalRegistros,
          pagina: numero,
          tamano,
          total_paginas: Math.ceil(d.totalRegistros / tamano),
        };
      }
    }
    p.respuesta.next(structuredClone(valor));
    p.respuesta.complete();
  }
  function completar(): void {
    for (let i = 0; i < peticiones.length; i++) responder(peticiones[i]);
  }
  function listo(): void {
    completar();
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
  }

  it('espera seis consultas, dos páginas faltantes y confirmación de renderizado', () => {
    for (const p of peticiones.slice(0, 5).reverse()) responder(p);
    expect(pagina.reporteListo).toBe(false);
    expect(peticiones).toHaveLength(6);
    responder(peticiones[5]);
    expect(peticiones).toHaveLength(8);
    expect(pagina.preparandoReporte).toBe(true);
    responder(peticiones[6]);
    expect(pagina.datosReporte).toBeNull();
    responder(peticiones[7]);
    expect(pagina.datosReporte?.detalleResolutores.items).toHaveLength(144);
    expect(pagina.datosReporte?.detalleProyectos.items).toHaveLength(144);
    expect(pagina.reporteListo).toBe(false);
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
    expect(pagina.reporteListo).toBe(true);
    expect(pagina.datosTablaResolutores?.items).toHaveLength(100);
  });
  it.each([0, 1, 2, 3, 4, 5])('bloquea si falla la consulta inicial %i', (indice) => {
    peticiones[indice].respuesta.error(new Error('Fallo ficticio'));
    peticiones
      .slice(0, 6)
      .filter((_, i) => i !== indice)
      .forEach(responder);
    expect(pagina.reporteListo).toBe(false);
    expect(pagina.datosReporte).toBeNull();
    expect(peticiones).toHaveLength(6);
  });
  it('conserva páginas correctas y reintenta solo las faltantes', () => {
    peticiones.slice(0, 6).forEach(responder);
    responder(peticiones[6]);
    peticiones[7].respuesta.error(new Error('Fallo ficticio de página'));
    expect(pagina.errorPreparacionReporte).toBeTruthy();
    expect(pagina.reporteListo).toBe(false);
    pagina.reintentarReporte();
    expect(peticiones).toHaveLength(9);
    expect(peticiones[8].metodo).toBe('obtenerTiemposProyectos');
    responder(peticiones[8]);
    expect(pagina.datosReporte).not.toBeNull();
  });
  it('permite recuperar una página que supera el tiempo de espera', () => {
    vi.useFakeTimers();
    try {
      peticiones.slice(0, 6).forEach(responder);
      responder(peticiones[6]);
      vi.advanceTimersByTime(30001);
      expect(pagina.errorPreparacionReporte).toContain('tardó demasiado');
      expect(pagina.preparandoReporte).toBe(false);
      pagina.reintentarReporte();
      responder(peticiones[8]);
      expect(pagina.datosReporte).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('limita la concurrencia a dos solicitudes de páginas', () => {
    // Multiple missing pages in both dimensions share a two-request queue.
    datos = reporteTiemposFicticio(12, 30);
    peticiones.slice(0, 6).forEach(responder);
    expect(peticiones).toHaveLength(8);
    responder(peticiones[6]);
    expect(peticiones).toHaveLength(9);
    for (let i = 7; i < peticiones.length; i++) responder(peticiones[i]);
    expect(pagina.datosReporte?.detalleResolutores.items).toHaveLength(360);
  });
  it('cancela páginas y rechaza renderizados de filtros anteriores', () => {
    peticiones.slice(0, 6).forEach(responder);
    const anteriores = peticiones.slice(6);
    pagina.filtrosActuales = { ...pagina.filtrosActuales, grupo_resolutor: 'OTRO GRUPO FICTICIO' };
    pagina.cargarDashboard();
    anteriores.forEach(responder);
    pagina.confirmarRenderReporte(1);
    expect(pagina.reporteListo).toBe(false);
    expect(pagina.datosReporte).toBeNull();
    peticiones.slice(8, 14).forEach(responder);
    peticiones.slice(14).forEach(responder);
    expect(pagina.datosReporte?.filtros.grupo_resolutor).toBe('OTRO GRUPO FICTICIO');
  });
  it('no deja que paginación o errores visuales posteriores bloqueen un snapshot completo', () => {
    listo();
    const reporte = pagina.datosReporte;
    pagina.cambiarPaginaResolutores({ pagina: 2, tamano: 25 });
    expect(pagina.reporteListo).toBe(true);
    peticiones.at(-1)!.respuesta.error(new Error('Fallo visual ficticio'));
    expect(pagina.reporteListo).toBe(true);
    expect(pagina.datosReporte).toBe(reporte);
  });
  it('exporta copias independientes de los filtros efectivos y mantiene el rango ejecutivo', () => {
    listo();
    pagina.filtrosActuales.proyectos!.push('Edición no aplicada');
    pagina.datosTablaResolutores!.items[0].horas_totales = 999;
    expect(pagina.datosReporte!.filtros.proyectos).toEqual([]);
    expect(pagina.datosReporte!.detalleResolutores.items[0].horas_totales).toBe(1.25);
    expect(peticiones[1].args[0]).toMatchObject({ periodo: undefined });
  });
  it('no habilita un reporte sin datos', () => {
    datos = reporteTiemposFicticio(0, 0);
    completar();
    expect(pagina.preparandoReporte).toBe(false);
    expect(pagina.datosReporte).toBeNull();
    expect(pagina.reporteListo).toBe(false);
    expect(pagina.errorPreparacionReporte).toBeNull();
  });
  it('reutiliza respuestas de una sola página sin solicitudes extra', () => {
    datos = reporteTiemposFicticio(1, 3);
    completar();
    expect(peticiones).toHaveLength(6);
    expect(pagina.datosReporte?.detalleProyectos.items).toHaveLength(3);
  });
  it('rechaza cambios entre páginas y duplicados entre páginas', () => {
    peticiones.slice(0, 6).forEach(responder);
    const p = peticiones[6];
    p.respuesta.next({
      resumen: datos.detalleResolutores.resumen,
      items: datos.detalleResolutores.items.slice(0, 44),
      total: 144,
      pagina: 2,
      tamano: 100,
      total_paginas: 2,
    });
    p.respuesta.complete();
    responder(peticiones[7]);
    expect(pagina.errorPreparacionReporte).toContain('completo');
    pagina.cargarDashboard();
    peticiones.slice(8, 14).forEach(responder);
    peticiones[14].respuesta.next({
      resumen: { ...datos.detalleResolutores.resumen, acciones: 999 },
      items: datos.detalleResolutores.items.slice(100),
      total: 144,
      pagina: 2,
      tamano: 100,
      total_paginas: 2,
    });
    expect(pagina.errorPreparacionReporte).toContain('cambiaron');
    expect(pagina.reporteListo).toBe(false);
  });
  it('aplica el mes dinámico a detalle y rankings conservando volumen completo', () => {
    listo();
    const versionAnterior = pagina.datosReporte!.version;
    datos.detalleResolutores.items = datos.detalleResolutores.items.filter(
      (r) => r.periodo === '2026-02',
    );
    datos.detalleProyectos.items = datos.detalleProyectos.items.filter(
      (r) => r.periodo === '2026-02',
    );
    for (const detalle of [datos.detalleResolutores, datos.detalleProyectos]) {
      detalle.totalRegistros = 12;
      detalle.resumen = {
        ...detalle.resumen,
        tickets_distintos: 12,
        acciones: 24,
        horas_totales: 15,
        segundos_totales: 54000,
      };
    }
    datos.kpis.total_tickets = 12;
    datos.kpis.horas_totales = 15;
    datos.kpis.segundos_totales = 54000;
    datos.kpis.promedio_horas = 15;
    datos.kpis.promedio_segundos = 54000;
    datos.kpis.promedio_tickets = 12;
    for (const g of [datos.graficoResolutores, datos.graficoProyectos]) {
      g.periodos = ['2026-02'];
      g.series = g.series.map((s) => ({
        ...s,
        horas_totales: 1.25,
        segundos_totales: 4500,
        mensual: [{
          periodo: '2026-02',
          horas: 1.25,
          segundos: 4500
        }]
      })
      );
    }
    pagina.cambiarPeriodo('2026-02');
    expect(pagina.reporteListo).toBe(false);
    peticiones.slice(8).forEach(responder);
    expect(pagina.datosReporte?.filtros.periodo).toBe('2026-02');
    expect(pagina.datosReporte?.volumenMensual).toHaveLength(12);
    expect(pagina.datosReporte?.detalleResolutores.items).toHaveLength(12);
    pagina.confirmarRenderReporte(versionAnterior);
    expect(pagina.reporteListo).toBe(false);
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
    expect(pagina.reporteListo).toBe(true);
  });
  it('limpiar invalida de inmediato y no acepta respuestas de la carga anterior', () => {
    pagina.ngOnInit(); // Initializes the existing form and filter-options request.
    const anteriores = peticiones.slice(0, 6);
    pagina.limpiarFiltros();
    anteriores.forEach(responder);
    expect(pagina.datosReporte).toBeNull();
    expect(pagina.reporteListo).toBe(false);
    expect(pagina.filtrosListos).toBe(false);
  });
  it('el reintento del render tiene una versión nueva', () => {
    listo();
    const anterior = pagina.datosReporte!.version;
    pagina.fallarRenderReporte(anterior);
    pagina.reintentarReporte();
    expect(pagina.datosReporte!.version).toBeGreaterThan(anterior);
    pagina.confirmarRenderReporte(anterior);
    expect(pagina.reporteListo).toBe(false);
  });
  it('descarga una vez por clic, limpia el enlace y reutiliza los datos para descargas sucesivas', async () => {
    listo();
    const total = peticiones.length;
    const a = pagina.descargarReporte(),
      b = pagina.descargarReporte();
    await Promise.all([a, b]);
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0].download).toMatch(
      /^CANVIA-Tiempos-Informes-Mensuales-2026-01-01_2026-12-31-todos-.*\.png$/,
    );
    expect(document.querySelector('a[download]')).toBeNull();
    await pagina.descargarReporte();
    expect(toPng).toHaveBeenCalledTimes(2);
    expect(peticiones).toHaveLength(total);
    expect(vi.mocked(toPng).mock.calls[0][1]).toMatchObject({
      pixelRatio: 2,
      skipFonts: true,
      skipAutoScale: true,
    });
  });
  it('recupera errores de captura y renderizado sin repetir consultas', async () => {
    listo();
    const cantidad = peticiones.length;
    vi.mocked(toPng).mockRejectedValueOnce(new Error('Captura ficticia'));
    await pagina.descargarReporte();
    expect(pagina.exportandoReporte).toBe(false);
    expect(pagina.errorExportacion).toBeTruthy();
    await pagina.descargarReporte();
    expect(click).toHaveBeenCalledTimes(1);
    pagina.fallarRenderReporte(pagina.datosReporte!.version);
    expect(pagina.reporteListo).toBe(false);
    pagina.reintentarReporte();
    expect(pagina.datosReporte).not.toBeNull();
    expect(peticiones).toHaveLength(cantidad);
  });
  it('descarta el PNG si cambian los datos durante la captura', async () => {
    listo();
    let liberar!: (imagen: string) => void;
    vi.mocked(toPng).mockImplementationOnce(() => new Promise((r) => (liberar = r)));
    const descarga = pagina.descargarReporte();
    await vi.waitFor(() => expect(toPng).toHaveBeenCalled());
    pagina.cargarDashboard();
    liberar('data:image/png;base64,' + 'a'.repeat(150));
    await descarga;
    expect(click).not.toHaveBeenCalled();
    expect(pagina.errorExportacion).toContain('cambiaron');
  });
  it('protege límites de imagen y usa escala uno para reportes largos', async () => {
    listo();
    const documento = pagina.reporteImagen!.nativeElement.firstChild!;
    Object.defineProperty(documento, 'scrollHeight', { value: 5000, configurable: true });
    await pagina.descargarReporte();
    expect(vi.mocked(toPng).mock.calls[0][1]?.pixelRatio).toBe(1);
    Object.defineProperty(documento, 'scrollHeight', { value: 17000 });
    await pagina.descargarReporte();
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(pagina.errorExportacion).toContain('Reduce');
  });
  it('rechaza dimensiones cero e imágenes inválidas sin descargar', async () => {
    listo();
    vi.mocked(toPng).mockResolvedValueOnce('data:,');
    await pagina.descargarReporte();
    expect(click).not.toHaveBeenCalled();
    expect(pagina.errorExportacion).toBeTruthy();
    Object.defineProperty(pagina.reporteImagen!.nativeElement.firstChild, 'scrollHeight', {
      value: 0,
    });
    await pagina.descargarReporte();
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(pagina.exportandoReporte).toBe(false);
  });
  it('descarta capturas después de abandonar la página', async () => {
    listo();
    const descarga = pagina.descargarReporte();
    pagina.ngOnDestroy();
    await descarga;
    expect(click).not.toHaveBeenCalled();
    expect(pagina.reporteListo).toBe(false);
  });
});
