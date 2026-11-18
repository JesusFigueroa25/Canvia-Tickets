import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { RequirementCategorizationAudit } from './requirement-categorization-audit';
import { RequirementCategorizationAuditService } from '../../../services/requirement-categorization-audit.service';
import {
  AuditMonthlyStats,
  AuditResolverList,
  RequirementCategorizationReportData,
} from '../../../models/requirement-categorization-audit';
import { reporteFicticio } from '../../charts/Consolidated/requirement-categorization-report/requirement-categorization-report.fixture';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

describe('Auditoría: disponibilidad y exportación PNG', () => {
  let pagina: RequirementCategorizationAudit;
  let datos: RequirementCategorizationReportData;
  let resumen$: Subject<RequirementCategorizationReportData['resumen']>;
  let motivos$: Subject<RequirementCategorizationReportData['motivos']>;
  let resolutores$: Subject<AuditResolverList>;
  let meses$: Subject<AuditMonthlyStats>;
  let tickets$: Subject<never>;
  let servicio: Record<string, ReturnType<typeof vi.fn>>;
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    datos = reporteFicticio();
    resumen$ = new Subject();
    motivos$ = new Subject();
    resolutores$ = new Subject();
    meses$ = new Subject();
    tickets$ = new Subject();
    servicio = {
      obtenerResumenAgrupado: vi.fn(() => resumen$),
      obtenerMotivosResolucionAgrupados: vi.fn(() => motivos$),
      obtenerResolutoresAgrupados: vi.fn(() => resolutores$),
      obtenerEstadisticasMensualesAgrupadas: vi.fn(() => meses$),
      obtenerTicketsAgrupados: vi.fn(() => tickets$),
    };
    pagina = new RequirementCategorizationAudit(
      new FormBuilder(),
      servicio as unknown as RequirementCategorizationAuditService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );
    pagina.filtrosActuales = { ...datos.filtros };
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.mocked(toPng)
      .mockReset()
      .mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const documento = document.createElement('section');
    documento.className = 'report-document';
    Object.defineProperties(documento, {
      scrollWidth: { value: 1400 },
      scrollHeight: { value: 2200, configurable: true },
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

  function responder(): void {
    motivos$.next(datos.motivos);
    meses$.next({
      group_id: 1,
      grupo_resolutor: 'GRUPO DEMO',
      audit_year: 2026,
      total: datos.meses.length,
      items: datos.meses,
    });
    resolutores$.next({
      grupo_resolutor: 'GRUPO DEMO',
      total: datos.resolutores.length,
      items: datos.resolutores,
    });
    resumen$.next(datos.resumen);
  }
  function preparar(): void {
    responder();
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
  }

  it('espera las cuatro respuestas y el render, sin esperar tickets', () => {
    motivos$.next(datos.motivos);
    expect(pagina.datosReporte).toBeNull();
    responder();
    expect(pagina.reporteListo).toBe(false);
    pagina.confirmarRenderReporte(999);
    expect(pagina.reporteListo).toBe(false);
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
    expect(pagina.cargandoTickets).toBe(true);
    expect(pagina.reporteListo).toBe(true);
  });

  it('no depende de errores de tickets, filtros o historial y no hace HTTP al descargar', async () => {
    preparar();
    pagina.errorTickets = 'Error de tickets';
    pagina.errorFiltros = 'Error de opciones';
    pagina.errorEjecucion = 'Error de historial';
    expect(pagina.reporteListo).toBe(true);
    await pagina.descargarReporte();
    expect(click).toHaveBeenCalledOnce();
    Object.values(servicio).forEach((fn) => expect(fn).toHaveBeenCalledOnce());
    expect(pagina.exportandoReporte).toBe(false);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it.each(['resumen', 'motivos', 'resolutores', 'meses'])(
    'bloquea errores 404 de %s aunque la vista los silencie',
    (clave) => {
      const consultas = {
        resumen: resumen$,
        motivos: motivos$,
        resolutores: resolutores$,
        meses: meses$,
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});
      consultas[clave as keyof typeof consultas].error({ status: 404 });
      responder();
      expect(pagina.datosReporte).toBeNull();
      expect(pagina.reporteListo).toBe(false);
    },
  );

  it('no exporta sin datos ni cuando faltan registros agregados', () => {
    datos.resumen.processed_tickets = 0;
    responder();
    expect(pagina.datosReporte).toBeNull();
    datos = reporteFicticio();
    datos.resolutores.pop();
    responder();
    expect(pagina.reporteListo).toBe(false);
    expect(pagina.errorPreparacionReporte).toContain('consistentes');
  });

  it('conserva todos los filtros efectivos y crea copias independientes', () => {
    pagina.filtrosActuales = {
      ...datos.filtros,
      resultado: 'INCORRECT',
      motivo_resolucion: 'Atribuible a Cliente',
      mes: '2026-01',
      nombre_resolutor: 'Demo',
      ticket_id: 'DEMO-1',
    };
    pagina.cargarDashboard();
    preparar();
    expect(pagina.datosReporte!.filtros).toEqual(pagina.filtrosActuales);
    pagina.resolutores[0].correct_count = 0;
    pagina.filtrosActuales.proyecto = 'Sin aplicar';
    expect(pagina.datosReporte!.resolutores[0].correct_count).toBe(7);
    expect(pagina.datosReporte!.filtros.proyecto).toBe('Proyecto demo');
  });

  it('paginación de tickets no invalida ni cambia el reporte', () => {
    preparar();
    const snapshot = pagina.datosReporte;
    pagina.cambiarPagina(2, 50);
    expect(pagina.reporteListo).toBe(true);
    expect(pagina.datosReporte).toBe(snapshot);
    expect(servicio['obtenerResumenAgrupado']).toHaveBeenCalledOnce();
    expect(servicio['obtenerTicketsAgrupados']).toHaveBeenCalledTimes(2);
  });

  it('cancela respuestas previas al cambiar filtros y exige otro render', () => {
    preparar();
    const anterior = pagina.datosReporte!.version;
    const previo = resumen$;
    resumen$ = new Subject();
    servicio['obtenerResumenAgrupado'].mockImplementation(() => resumen$);
    pagina.seleccionarResultado('INCORRECT');
    expect(pagina.reporteListo).toBe(false);
    previo.next(datos.resumen);
    motivos$.next(datos.motivos);
    meses$.next({
      group_id: 1,
      grupo_resolutor: '',
      audit_year: 2026,
      total: 12,
      items: datos.meses,
    });
    resolutores$.next({ grupo_resolutor: '', total: 12, items: datos.resolutores });
    expect(pagina.datosReporte).toBeNull();
    resumen$.next(datos.resumen);
    pagina.confirmarRenderReporte(anterior);
    expect(pagina.reporteListo).toBe(false);
    pagina.confirmarRenderReporte(pagina.datosReporte!.version);
    expect(pagina.reporteListo).toBe(true);
  });

  it('evita doble clic, permite descargas sucesivas y sanea el nombre', async () => {
    preparar();
    let terminar!: (s: string) => void;
    vi.mocked(toPng).mockReturnValueOnce(new Promise((resolve) => (terminar = resolve)));
    const primera = pagina.descargarReporte();
    await Promise.resolve();
    await Promise.resolve();
    await pagina.descargarReporte();
    expect(toPng).toHaveBeenCalledOnce();
    terminar('data:image/png;base64,' + 'b'.repeat(150));
    await primera;
    await pagina.descargarReporte();
    expect(click).toHaveBeenCalledTimes(2);
    expect(click.mock.instances[0].download).toMatch(
      /^CANVIA-Auditoria-Categorizacion-Proyecto-demo-\d{4}-\d{2}-\d{2}\.png$/,
    );
  });

  it('descarta una captura que termina después de cambiar los agregados', async () => {
    preparar();
    let terminar!: (s: string) => void;
    vi.mocked(toPng).mockReturnValueOnce(new Promise((resolve) => (terminar = resolve)));
    const descarga = pagina.descargarReporte();
    await Promise.resolve();
    await Promise.resolve();
    pagina.cargarDashboard();
    terminar('data:image/png;base64,' + 'c'.repeat(150));
    await descarga;
    expect(click).not.toHaveBeenCalled();
    expect(pagina.errorExportacion).toContain('cambiaron');
  });

  it('recupera el estado tras fallo de captura y permite reintentar', async () => {
    preparar();
    vi.mocked(toPng).mockRejectedValueOnce(new Error('canvas'));
    await pagina.descargarReporte();
    expect(pagina.errorExportacion).toContain('PNG completo');
    expect(pagina.exportandoReporte).toBe(false);
    await pagina.descargarReporte();
    expect(click).toHaveBeenCalledOnce();
    expect(pagina.errorExportacion).toBeNull();
  });

  it('no descarga al abandonar la página durante la captura', async () => {
    preparar();
    vi.mocked(toPng).mockImplementationOnce(async () => {
      pagina.ngOnDestroy();
      return 'data:image/png;base64,' + 'a'.repeat(150);
    });
    await pagina.descargarReporte();
    expect(click).not.toHaveBeenCalled();
  });

  it('reduce escala para tablas extensas y rechaza dimensiones vacías', async () => {
    preparar();
    const el = pagina.reporteImagen!.nativeElement.firstElementChild!;
    Object.defineProperty(el, 'scrollHeight', { value: 5000, configurable: true });
    await pagina.descargarReporte();
    expect(toPng).toHaveBeenLastCalledWith(
      el,
      expect.objectContaining({ pixelRatio: 1, height: 5000, skipAutoScale: true }),
    );
    Object.defineProperty(el, 'scrollHeight', { value: 0 });
    await pagina.descargarReporte();
    expect(click).toHaveBeenCalledOnce();
  });

  it('rechaza documentos que exceden el límite sin recortar filas', async () => {
    preparar();
    const el = pagina.reporteImagen!.nativeElement.firstElementChild!;
    Object.defineProperty(el, 'scrollHeight', { value: 18000 });
    await pagina.descargarReporte();
    expect(toPng).not.toHaveBeenCalled();
    expect(pagina.errorExportacion).toContain('reduce el alcance');
  });

  it('bloquea cantidades no finitas o porcentajes fuera de rango', () => {
    datos.motivos.items[0].total_tickets = Number.NaN;
    responder();
    expect(pagina.datosReporte).toBeNull();
    datos = reporteFicticio();
    datos.resumen.correct_percentage = 101;
    responder();
    expect(pagina.datosReporte).toBeNull();
  });
});
