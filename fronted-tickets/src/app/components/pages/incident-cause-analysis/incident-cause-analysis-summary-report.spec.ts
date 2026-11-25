import { ChangeDetectorRef, ComponentRef, ElementRef, ViewContainerRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../app-module';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { IncidentCauseAnalysis } from './incident-cause-analysis';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentExecutiveSummaryReport } from '../../charts/Consolidated/incident-executive-summary-report/incident-executive-summary-report';
import { resumenFicticio } from '../../charts/Consolidated/incident-executive-summary-report/incident-executive-summary-report.fixture';
import type { IncidentConsolidatedDashboardFilters } from '../../../models/incident-consolidated';
import type { ExecutiveSummarySource, IncidentExecutiveSummaryData, IncidentExecutiveSummarySources } from '../../../models/incident-executive-summary-report';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
type Privados = {
  iniciarContextoResumen(f: IncidentConsolidatedDashboardFilters): void;
  cargarAtribucion(f: IncidentConsolidatedDashboardFilters): void;
  cargarTopServidores(f: IncidentConsolidatedDashboardFilters): void;
  cargarAnalisisEjecutivoIA(f: IncidentConsolidatedDashboardFilters): void;
  cargarComponenteResumen(): Promise<typeof IncidentExecutiveSummaryReport>;
};
describe('Resumen Ejecutivo: fuentes vigentes y descarga independiente', () => {
  let pagina: IncidentCauseAnalysis, internos: Privados, documento: HTMLElement;
  let solicitudes: { tipo: ExecutiveSummarySource; filtros: IncidentConsolidatedDashboardFilters; extra?: number | boolean; respuesta: Subject<unknown> }[];
  let hijos: { instance: IncidentExecutiveSummaryReport; datos: IncidentExecutiveSummaryData; destroy: ReturnType<typeof vi.fn> }[];
  let click: ReturnType<typeof vi.spyOn>;
  const f = resumenFicticio();
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    solicitudes = []; hijos = [];
    const pedir = (tipo: ExecutiveSummarySource, filtros: IncidentConsolidatedDashboardFilters, extra?: number | boolean) => {
      const respuesta = new Subject<unknown>(); solicitudes.push({ tipo, filtros, extra, respuesta }); return respuesta;
    };
    const servicio = { obtenerDistribucionAjustadaCausas: vi.fn((f: IncidentConsolidatedDashboardFilters) => pedir('ajustada', f)),
      obtenerTopServidores: vi.fn((f: IncidentConsolidatedDashboardFilters, n: number) => pedir('servidores', f, n)),
      generarAnalisisEjecutivoIA: vi.fn((f: IncidentConsolidatedDashboardFilters, b: boolean) => pedir('analisis', f, b)) };
    pagina = new IncidentCauseAnalysis(new FormBuilder(), servicio as unknown as IncidentConsolidatedService, { markForCheck: vi.fn(), detectChanges: vi.fn() } as unknown as ChangeDetectorRef, new ElementRef(document.createElement('div')));
    internos = pagina as unknown as Privados; pagina.crearFormularioFiltros(); pagina.filtrosActuales = structuredClone(f.filtros);
    vi.spyOn(internos, 'cargarComponenteResumen').mockResolvedValue(IncidentExecutiveSummaryReport);
    documento = document.createElement('section'); documento.className = 'report-document';
    Object.defineProperties(documento, { scrollWidth: { value: 1400, configurable: true }, scrollHeight: { value: 1100, configurable: true } });
    const host = document.createElement('div'); host.appendChild(documento);
    pagina.resumenHost = { createComponent: vi.fn(() => {
      const instance = new IncidentExecutiveSummaryReport(), callbacks: (() => void)[] = [];
      const hijo = { instance, datos: null as unknown as IncidentExecutiveSummaryData, destroy: vi.fn(() => callbacks.forEach(cb => cb())) }; hijos.push(hijo);
      return { instance, destroy: hijo.destroy, onDestroy: (cb: () => void) => callbacks.push(cb), location: new ElementRef(host),
        setInput: (_: string, valor: IncidentExecutiveSummaryData) => { hijo.datos = valor; }, changeDetectorRef: { detectChanges: vi.fn() } } as unknown as ComponentRef<IncidentExecutiveSummaryReport>;
    }) } as unknown as ViewContainerRef;
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,' + 'a'.repeat(200));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => { pagina.ngOnDestroy(); solicitudes.forEach(p => p.respuesta.complete()); vi.useRealTimers(); vi.restoreAllMocks(); });
  function cargar() { internos.iniciarContextoResumen(pagina.filtrosActuales); internos.cargarAtribucion(pagina.filtrosActuales); internos.cargarTopServidores(pagina.filtrosActuales); internos.cargarAnalisisEjecutivoIA(pagina.filtrosActuales); }
  function responder(tipo: ExecutiveSummarySource, fuentes: IncidentExecutiveSummarySources = f.fuentes) { const p = solicitudes.filter(p => p.tipo === tipo).at(-1)!; p.respuesta.next(structuredClone(fuentes[tipo])); p.respuesta.complete(); }
  function listo(fuentes = f.fuentes) { cargar(); responder('ajustada', fuentes); responder('servidores', fuentes); responder('analisis', fuentes); }
  async function resolver() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
  async function capturar() { await pagina.descargarResumen(); hijos.at(-1)!.instance.renderizado.emit(hijos.at(-1)!.datos.version); await resolver(); }
  it('espera las tres fuentes y no genera IA adicional al descargar', async () => {
    cargar(); responder('ajustada'); responder('servidores'); expect(pagina.puedeDescargarResumen).toBe(false); await pagina.descargarResumen(); expect(hijos).toHaveLength(0);
    responder('analisis'); expect(pagina.puedeDescargarResumen).toBe(true); await capturar(); expect(solicitudes).toHaveLength(3); expect(solicitudes[2].extra).toBe(true); expect(click).toHaveBeenCalledOnce();
  });
  it('captura solo tras el render vigente y usa el protocolo PNG aprobado', async () => {
    listo(); await pagina.descargarResumen(); expect(toPng).not.toHaveBeenCalled(); const h = hijos[0];
    h.instance.renderizado.emit(-1); expect(toPng).not.toHaveBeenCalled(); h.instance.renderizado.emit(h.datos.version); h.instance.renderizado.emit(h.datos.version); await resolver();
    expect(toPng).toHaveBeenCalledOnce(); expect(toPng).toHaveBeenCalledWith(documento, expect.objectContaining({ width: 1400, height: 1100, pixelRatio: 2, skipFonts: true, skipAutoScale: true }));
    const enlace = click.mock.instances[0] as HTMLAnchorElement; expect(enlace.download).toMatch(/^CANVIA-Resumen-Ejecutivo-Incidentes-2025-01-01_2025-06-30-\d{4}-\d{2}-\d{2}\.png$/); expect(enlace.isConnected).toBe(false);
  });
  it('conserva filtros efectivos completos e ignora ediciones pendientes; no depende del reporte largo', async () => {
    Object.assign(pagina.filtrosActuales, { proyecto: 'Nombre completo PROY regional', tipo_incidente: ['Tipo ficticio'], periodo: '2025-02', nombre_resolutor: 'Resolutor ficticio', proyectos_excluidos: ['Otro'] });
    pagina.filtrosForm.patchValue({ proyecto: 'Pendiente' }); pagina.errorAnalisisCausas = 'Error independiente'; pagina.cargandoProyectos = true; pagina.exportandoReporte = true;
    const original = structuredClone(pagina.filtrosActuales); listo(); expect(pagina.reporteListo).toBe(false); await capturar();
    expect(hijos[0].datos.filtros).toEqual(original); expect(pagina.filtrosActuales).toEqual(original); expect(pagina.exportandoReporte).toBe(true); expect(pagina.errorExportacion).toBeNull();
  });
  it('acepta reglas y un conjunto válido sin servidores', async () => {
    listo(resumenFicticio(true, true).fuentes); expect(pagina.puedeDescargarResumen).toBe(true); await capturar(); expect(hijos[0].datos.origen).toBe('reglas'); expect(hijos[0].datos.servidores).toHaveLength(0);
  });
  it('descarta instantáneas y callbacks de una generación anterior incluso A→B→A', async () => {
    cargar(); const viejas = [...solicitudes]; pagina.filtrosActuales.proyecto = 'B'; cargar(); pagina.filtrosActuales.proyecto = undefined; cargar();
    for (const p of viejas) p.respuesta.next(structuredClone(f.fuentes[p.tipo])); expect(pagina.puedeDescargarResumen).toBe(false);
    responder('ajustada'); responder('servidores'); responder('analisis'); await capturar(); expect(click).toHaveBeenCalledOnce();
  });
  it('invalidar un ranking por cambio de límite no vuelve a generar análisis', async () => {
    listo(); pagina.cambiarLimiteTopServidores(10); expect(pagina.puedeDescargarResumen).toBe(false);
    expect(solicitudes.filter(p => p.tipo === 'analisis')).toHaveLength(1); responder('servidores'); expect(pagina.puedeDescargarResumen).toBe(true); await capturar(); expect(hijos[0].datos.servidores).toHaveLength(5);
  });
  it('evita doble clic mientras carga el componente, renderiza o captura', async () => {
    listo(); const a = pagina.descargarResumen(), b = pagina.descargarResumen(); await Promise.all([a, b]); expect(hijos).toHaveLength(1);
    let liberar!: (s: string) => void; vi.mocked(toPng).mockReturnValueOnce(new Promise(r => { liberar = r; })); hijos[0].instance.renderizado.emit(hijos[0].datos.version); await pagina.descargarResumen(); expect(hijos).toHaveLength(1);
    liberar('data:image/png;base64,' + 'a'.repeat(200)); await resolver(); expect(click).toHaveBeenCalledOnce();
  });
  it('bloquea errores HTTP e inconsistencias sin tocar el reporte largo', () => {
    cargar(); solicitudes[2].respuesta.error(new Error('HTTP ficticio')); expect(pagina.estadoResumen).toBe('error'); expect(pagina.puedeDescargarResumen).toBe(false);
    const mal = structuredClone(f.fuentes); mal.analisis.hallazgos.total_incidentes++;
    listo(mal); expect(pagina.puedeDescargarResumen).toBe(false); expect(pagina.errorResumen).toContain('no coincide'); expect(pagina.errorExportacion).toBeNull();
  });
  it('bloquea respuestas HTTP vacías y no las confunde con un conjunto válido sin servidores', () => {
    cargar(); responder('ajustada'); solicitudes.find(p => p.tipo === 'servidores')!.respuesta.next(null);
    responder('analisis'); expect(pagina.estadoResumen).toBe('error'); expect(pagina.puedeDescargarResumen).toBe(false);
  });
  it('permite reintentar render/captura con la misma instantánea sin HTTP', async () => {
    listo(); await pagina.descargarResumen(); hijos[0].instance.errorRenderizado.emit({ version: hijos[0].datos.version, motivo: 'legibilidad' }); expect(pagina.errorResumen).toContain('no se recortó');
    vi.mocked(toPng).mockRejectedValueOnce(new Error('captura')); await capturar(); expect(pagina.estadoResumen).toBe('error'); await capturar(); expect(click).toHaveBeenCalledOnce(); expect(solicitudes).toHaveLength(3);
  });
  it('rechaza PNG y dimensiones inválidas', async () => {
    listo(); vi.mocked(toPng).mockResolvedValueOnce('data:,'); await capturar(); expect(click).not.toHaveBeenCalled();
    Object.defineProperty(documento, 'scrollWidth', { value: 1500 }); await capturar(); expect(click).not.toHaveBeenCalled(); expect(pagina.estadoResumen).toBe('error');
  });
  it('descarta la captura si cambian filtros o se destruye la página', async () => {
    listo(); let liberar!: (s: string) => void; vi.mocked(toPng).mockReturnValueOnce(new Promise(r => { liberar = r; })); await pagina.descargarResumen(); hijos[0].instance.renderizado.emit(hijos[0].datos.version);
    pagina.filtrosActuales.proyecto = 'Otro'; cargar(); expect(pagina.exportandoResumen).toBe(true); liberar('data:image/png;base64,' + 'a'.repeat(200)); await resolver(); expect(click).not.toHaveBeenCalled(); expect(pagina.errorResumen).toContain('cambiaron');
    listo(); vi.mocked(toPng).mockReturnValueOnce(new Promise(r => { liberar = r; })); await pagina.descargarResumen(); hijos.at(-1)!.instance.renderizado.emit(hijos.at(-1)!.datos.version); pagina.ngOnDestroy(); liberar('data:image/png;base64,' + 'a'.repeat(200)); await resolver(); expect(click).not.toHaveBeenCalled();
  });
  it('descarta la carga diferida obsoleta y limita a treinta segundos la carga/captura', async () => {
    listo(); let liberar!: (c: typeof IncidentExecutiveSummaryReport) => void; vi.mocked(internos.cargarComponenteResumen).mockReturnValueOnce(new Promise(r => { liberar = r; }));
    const descarga = pagina.descargarResumen(); cargar(); liberar(IncidentExecutiveSummaryReport); await descarga; expect(hijos).toHaveLength(0);
    listo(); vi.useFakeTimers(); vi.mocked(internos.cargarComponenteResumen).mockReturnValueOnce(new Promise(() => {})); const tardia = pagina.descargarResumen(); await vi.advanceTimersByTimeAsync(30000); await tardia; expect(pagina.estadoResumen).toBe('error');
    vi.mocked(toPng).mockReturnValueOnce(new Promise(() => {})); await pagina.descargarResumen(); hijos.at(-1)!.instance.renderizado.emit(hijos.at(-1)!.datos.version); await vi.advanceTimersByTimeAsync(30000); expect(pagina.exportandoResumen).toBe(false); expect(pagina.errorResumen).toContain('tiempo');
  });
  it('cargarDashboard utiliza los mismos filtros y solo sus consultas originales', () => {
    type Otros = 'cargarAnalisisCausas' | 'cargarTipos' | 'cargarOpcionesProyectos' | 'cargarProyectos' | 'cargarTopProyectos' | 'cargarRendimientoResolutores' | 'cargarTicketsPorResolutor' | 'cargarRendimientoReporte';
    const otros: Otros[] = ['cargarAnalisisCausas', 'cargarTipos', 'cargarOpcionesProyectos', 'cargarProyectos', 'cargarTopProyectos', 'cargarRendimientoResolutores', 'cargarTicketsPorResolutor', 'cargarRendimientoReporte'];
    otros.forEach(m => vi.spyOn(pagina as unknown as Record<Otros, () => void>, m).mockImplementation(() => {}));
    pagina.cargarDashboard(); expect(solicitudes).toHaveLength(3); solicitudes.forEach(p => expect(p.filtros).toEqual(pagina.filtrosActuales));
    responder('ajustada'); responder('servidores'); responder('analisis'); expect(pagina.puedeDescargarResumen).toBe(true);
  });
});
