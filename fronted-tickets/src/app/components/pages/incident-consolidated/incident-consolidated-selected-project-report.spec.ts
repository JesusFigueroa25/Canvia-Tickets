import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentConsolidated } from './incident-consolidated';
import { proyectoMensualFicticio } from '../../charts/Consolidated/incident-project-monthly-report/incident-project-monthly-report.fixture';
import { crearReporteProyectoMensual } from '../../charts/Consolidated/incident-project-monthly-report/incident-project-monthly-report.utils';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
type Metodo = 'obtenerKpis' | 'obtenerTopProyectos';
describe('R03: selección, filtros efectivos, invalidación y captura independiente', () => {
  let pagina: IncidentConsolidated, documento: HTMLElement;
  let peticiones: { metodo: Metodo; filtros: unknown; respuesta: Subject<unknown> }[];
  let click: ReturnType<typeof vi.spyOn>;
  const f = proyectoMensualFicticio();
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); peticiones = [];
    const servicio = Object.fromEntries((['obtenerKpis', 'obtenerTopProyectos'] as Metodo[]).map(metodo => [metodo,
      vi.fn((filtros: unknown) => { const respuesta = new Subject<unknown>(); peticiones.push({ metodo, filtros, respuesta }); return respuesta; })]));
    pagina = new IncidentConsolidated(new FormBuilder(), servicio as unknown as IncidentConsolidatedService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef, new ElementRef(document.createElement('div')));
    pagina.crearFormularioFiltros(); pagina.proyectoSeleccionado = f.proyecto;
    pagina.filtrosActuales = { ...structuredClone(f.filtros), proyecto: 'No usar esta identidad', periodo: '2025-02', nombre_resolutor: 'Ignorado', descripcion: 'Ignorada', tipo_incidente: ['Ignorado'], detalle_id: 'D', ticket_id: 'T' };
    pagina.opcionesFiltros.fecha_min = f.disponibilidad.fecha_min; pagina.opcionesFiltros.fecha_max = f.disponibilidad.fecha_max;
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    documento = document.createElement('section'); documento.className = 'report-document';
    Object.defineProperties(documento, { scrollWidth: { value: 1400, configurable: true }, scrollHeight: { value: 950, configurable: true } });
    const stage = document.createElement('div'); stage.appendChild(documento); pagina.reporteProyectoMensualImagen = new ElementRef(stage);
  });
  afterEach(() => { pagina.ngOnDestroy(); peticiones.forEach(p => p.respuesta.complete()); vi.useRealTimers(); vi.restoreAllMocks(); });
  function responder(respuestas = f.respuestas) {
    for (const p of peticiones.slice(-2)) { p.respuesta.next(structuredClone(p.metodo === 'obtenerKpis' ? respuestas.kpis : respuestas.top)); p.respuesta.complete(); }
  }
  async function resolver() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
  async function capturar() { pagina.confirmarRenderProyectoMensual(pagina.datosReporteProyectoMensual!.version); await resolver(); }
  function aislarConsultasDashboard() {
    const metodos = ['cargarKpis', 'cargarVolumenMensual', 'cargarProyectos', 'cargarTipos', 'cargarPrioridades', 'cargarTopProyectos', 'cargarPrioridadMensual',
      'cargarRendimientoResolutores', 'cargarExploradorDescripciones', 'cargarDetalleEventosTecnicos', 'cargarIncidentesPorcentajes', 'cargarTopDescripcionesProyectos', 'cargarTopDetalles', 'cargarTicketsPorResolutor', 'cargarTickets'] as const;
    metodos.forEach(m => vi.spyOn(pagina, m).mockImplementation(() => {}));
  }
  it('deshabilita sin selección, fechas válidas o con exclusión contradictoria', () => {
    pagina.proyectoSeleccionado = null; pagina.generarReporteProyectoMensual(); expect(peticiones).toHaveLength(0);
    pagina.proyectoSeleccionado = f.proyecto; pagina.filtrosActuales.desde = undefined; expect(pagina.puedeGenerarReporteProyectoMensual).toBe(false);
    pagina.filtrosActuales.desde = f.filtros.desde; pagina.filtrosActuales.proyectos_excluidos = [f.proyecto]; expect(pagina.puedeGenerarReporteProyectoMensual).toBe(false);
  });
  it('envía solo dos consultas con idénticos filtros y conserva dashboard, R01 y estado de R02', () => {
    const original = structuredClone(pagina.filtrosActuales);
    const mensual = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 8, '2026-11-24T12:00:00Z').mensual;
    pagina.datosReporteMensual = mensual; pagina.estadoReporteProyectos = 'listo';
    pagina.filtrosForm.patchValue({ grupo_resolutor: 'Pendiente sin aplicar' }); pagina.generarReporteProyectoMensual();
    expect(peticiones).toHaveLength(2); peticiones.forEach(p => expect(p.filtros).toEqual(f.filtros));
    expect(pagina.filtrosActuales).toEqual(original); expect(pagina.datosReporteMensual).toBe(mensual); expect(pagina.estadoReporteProyectos).toBe('listo');
    pagina.filtrosActuales.proyectos_excluidos!.push('Posterior'); expect((peticiones[0].filtros as typeof f.filtros).proyectos_excluidos).toEqual(f.filtros.proyectos_excluidos);
  });
  it('espera ambas respuestas y render vigente; captura a escala dos y limpia el enlace', async () => {
    pagina.generarReporteProyectoMensual(); peticiones[0].respuesta.next(f.respuestas.kpis); peticiones[0].respuesta.complete();
    expect(pagina.datosReporteProyectoMensual).toBeNull(); expect(toPng).not.toHaveBeenCalled();
    peticiones[1].respuesta.next(f.respuestas.top); peticiones[1].respuesta.complete();
    expect(pagina.estadoReporteProyectoMensual).toBe('preparando');
    pagina.confirmarRenderProyectoMensual(-1); expect(toPng).not.toHaveBeenCalled();
    await capturar(); expect(toPng).toHaveBeenCalledWith(documento, expect.objectContaining({ width: 1400, pixelRatio: 2, skipFonts: true, skipAutoScale: true }));
    expect(click).toHaveBeenCalledOnce(); expect(pagina.exportandoReporteProyectoMensual).toBe(false);
    const enlace = click.mock.instances[0] as HTMLAnchorElement;
    expect(enlace.download).toMatch(/^CANVIA-Tickets-Mes-Proyecto-Seleccionado-2025-01-01_2025-06-30-\d{4}-\d{2}-\d{2}\.png$/); expect(enlace.isConnected).toBe(false);
  });
  it('ignora los filtros dinámicos excluidos y la paginación', async () => {
    pagina.generarReporteProyectoMensual(); responder(); const datos = pagina.datosReporteProyectoMensual;
    pagina.filtrosActuales.periodo = '2025-04'; pagina.filtrosActuales.proyecto = 'Ignorado'; pagina.filtrosActuales.ticket_id = 'Otro'; pagina.paginaResolutores = 3;
    aislarConsultasDashboard(); pagina.cargarDashboard(); expect(pagina.datosReporteProyectoMensual).toBe(datos); await capturar(); expect(click).toHaveBeenCalledOnce();
  });
  it('invalida A→B→A inmediatamente sin aceptar respuestas o renders anteriores', () => {
    aislarConsultasDashboard(); pagina.generarReporteProyectoMensual(); const anteriores = [...peticiones];
    pagina.cambiarProyecto('Proyecto B'); pagina.cambiarProyecto(f.proyecto);
    anteriores.forEach(p => { p.respuesta.next(p.metodo === 'obtenerKpis' ? f.respuestas.kpis : f.respuestas.top); p.respuesta.complete(); });
    expect(pagina.datosReporteProyectoMensual).toBeNull(); pagina.generarReporteProyectoMensual(); responder();
    expect(pagina.datosReporteProyectoMensual?.proyecto).toBe(f.proyecto); pagina.confirmarRenderProyectoMensual(1); expect(toPng).not.toHaveBeenCalled();
  });
  it('invalida exclusiones antes del debounce y deshabilita al excluir el proyecto seleccionado', () => {
    vi.useFakeTimers(); pagina.generarReporteProyectoMensual(); responder();
    pagina.cambiarProyectosExcluidos([f.proyecto]);
    expect(pagina.proyectoSeleccionado).toBeNull(); expect(pagina.datosReporteProyectoMensual).toBeNull(); expect(pagina.puedeGenerarReporteProyectoMensual).toBe(false);
  });
  it('bloquea doble clic y confirmaciones de render repetidas', async () => {
    pagina.generarReporteProyectoMensual(); pagina.generarReporteProyectoMensual(); expect(peticiones).toHaveLength(2); responder();
    const version = pagina.datosReporteProyectoMensual!.version;
    pagina.confirmarRenderProyectoMensual(version); pagina.confirmarRenderProyectoMensual(version); await resolver();
    expect(toPng).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
  });
  it('bloquea identidad y denominadores incorrectos; no descarga cero tickets', () => {
    pagina.generarReporteProyectoMensual(); const incorrecto = structuredClone(f.respuestas); incorrecto.kpis.total_tickets++;
    responder(incorrecto); expect(pagina.estadoReporteProyectoMensual).toBe('error'); expect(toPng).not.toHaveBeenCalled();
    pagina.reintentarReporteProyectoMensual(); const otro = structuredClone(f.respuestas); otro.top.proyectos[0].proyecto = 'Otro'; responder(otro);
    expect(pagina.errorReporteProyectoMensual).toContain('no coincide');
    pagina.reintentarReporteProyectoMensual(); responder(proyectoMensualFicticio([0]).respuestas);
    expect(pagina.estadoReporteProyectoMensual).toBe('sin_datos'); expect(toPng).not.toHaveBeenCalled();
  });
  it('permite reintentar HTTP y controla consultas vacías y timeout', () => {
    pagina.generarReporteProyectoMensual(); peticiones[0].respuesta.error(new Error('HTTP ficticio'));
    expect(pagina.exportandoReporteProyectoMensual).toBe(false); pagina.reintentarReporteProyectoMensual(); expect(peticiones).toHaveLength(4);
    peticiones[2].respuesta.complete(); expect(pagina.estadoReporteProyectoMensual).toBe('error');
    vi.useFakeTimers(); pagina.reintentarReporteProyectoMensual(); vi.advanceTimersByTime(30000); expect(pagina.estadoReporteProyectoMensual).toBe('error');
  });
  it('comunica bloqueo por legibilidad y reintenta render o captura sin HTTP adicional', async () => {
    pagina.generarReporteProyectoMensual(); responder(); const version = pagina.datosReporteProyectoMensual!.version;
    pagina.fallarRenderProyectoMensual({ version, motivo: 'legibilidad' }); expect(pagina.errorReporteProyectoMensual).toContain('sin recortes');
    expect(toPng).not.toHaveBeenCalled(); pagina.reintentarReporteProyectoMensual();
    pagina.confirmarRenderProyectoMensual(version); expect(toPng).not.toHaveBeenCalled();
    vi.mocked(toPng).mockRejectedValueOnce(new Error('Captura ficticia')); await capturar();
    expect(pagina.estadoReporteProyectoMensual).toBe('error'); pagina.reintentarReporteProyectoMensual(); await capturar();
    expect(peticiones).toHaveLength(2); expect(click).toHaveBeenCalledOnce();
  });
  it('descarta captura si cambian filtros, se quita el proyecto o se abandona la página', async () => {
    aislarConsultasDashboard(); pagina.generarReporteProyectoMensual(); responder();
    let terminar!: (v: string) => void; vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    pagina.confirmarRenderProyectoMensual(pagina.datosReporteProyectoMensual!.version);
    pagina.filtrosActuales.prioridad = 'Otra'; pagina.cargarDashboard(); expect(pagina.puedeGenerarReporteProyectoMensual).toBe(false);
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
    pagina.generarReporteProyectoMensual(); responder(); pagina.confirmarRenderProyectoMensual(pagina.datosReporteProyectoMensual!.version);
    pagina.cambiarProyecto(null); pagina.ngOnDestroy(); terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
  });
  it('controla timeout de captura y descarta una imagen que termina después del límite', async () => {
    vi.useFakeTimers(); pagina.generarReporteProyectoMensual(); responder(); let terminar!: (v: string) => void;
    vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    pagina.confirmarRenderProyectoMensual(pagina.datosReporteProyectoMensual!.version);
    await vi.advanceTimersByTimeAsync(30000); expect(pagina.errorReporteProyectoMensual).toContain('tiempo'); expect(pagina.exportandoReporteProyectoMensual).toBe(false);
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
  });
  it('rechaza dimensiones e imágenes inválidas y conserva límites de captura', async () => {
    pagina.generarReporteProyectoMensual(); responder(); vi.mocked(toPng).mockResolvedValueOnce('data:,'); await capturar(); expect(click).not.toHaveBeenCalled();
    Object.defineProperty(documento, 'scrollWidth', { value: 1401, configurable: true }); pagina.reintentarReporteProyectoMensual(); await capturar(); expect(toPng).toHaveBeenCalledTimes(1);
    Object.defineProperty(documento, 'scrollWidth', { value: 1400, configurable: true }); Object.defineProperty(documento, 'scrollHeight', { value: 17000 });
    pagina.reintentarReporteProyectoMensual(); await capturar(); expect(pagina.errorReporteProyectoMensual).toContain('tamaño'); expect(toPng).toHaveBeenCalledTimes(1);
  });
});
