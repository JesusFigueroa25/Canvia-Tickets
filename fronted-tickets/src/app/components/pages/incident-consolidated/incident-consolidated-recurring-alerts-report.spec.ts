import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentConsolidated } from './incident-consolidated';
import { alertasFicticias } from '../../charts/Consolidated/incident-recurring-alerts-report/incident-recurring-alerts-report.fixture';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
describe('R04: consulta única, ambos modos y captura independiente', () => {
  let pagina: IncidentConsolidated, documento: HTMLElement;
  let peticiones: { filtros: unknown; limite: number; respuesta: Subject<unknown> }[];
  let click: ReturnType<typeof vi.spyOn>;
  const f = alertasFicticias();
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); peticiones = [];
    const servicio = { obtenerIncidentesPorcentajes: vi.fn((filtros: unknown, limite: number) => {
      const respuesta = new Subject<unknown>(); peticiones.push({ filtros, limite, respuesta }); return respuesta;
    }) };
    pagina = new IncidentConsolidated(new FormBuilder(), servicio as unknown as IncidentConsolidatedService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef, new ElementRef(document.createElement('div')));
    pagina.crearFormularioFiltros();
    pagina.filtrosActuales = { ...structuredClone(f.filtros), proyecto: 'Proyecto residual ignorado', periodo: '2025-02', nombre_resolutor: 'Ignorado', descripcion: 'Ignorada', tipo_incidente: ['Ignorado'], detalle_id: 'D', ticket_id: 'T' };
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    documento = document.createElement('section'); documento.className = 'report-document';
    Object.defineProperties(documento, { scrollWidth: { value: 1400, configurable: true }, scrollHeight: { value: 950, configurable: true } });
    const stage = document.createElement('div'); stage.appendChild(documento); pagina.reporteAlertasImagen = new ElementRef(stage);
  });
  afterEach(() => { pagina.ngOnDestroy(); peticiones.forEach(p => p.respuesta.complete()); vi.useRealTimers(); vi.restoreAllMocks(); });
  function responder(respuesta = f.respuesta) { peticiones.at(-1)!.respuesta.next(structuredClone(respuesta)); peticiones.at(-1)!.respuesta.complete(); }
  async function resolver() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
  async function capturar() { pagina.confirmarRenderAlertas(pagina.datosReporteAlertas!.version); await resolver(); }
  function aislarConsultasDashboard() {
    const metodos = ['cargarKpis', 'cargarVolumenMensual', 'cargarProyectos', 'cargarTipos', 'cargarPrioridades', 'cargarTopProyectos', 'cargarPrioridadMensual',
      'cargarRendimientoResolutores', 'cargarExploradorDescripciones', 'cargarDetalleEventosTecnicos', 'cargarIncidentesPorcentajes', 'cargarTopDescripcionesProyectos', 'cargarTopDetalles', 'cargarTicketsPorResolutor', 'cargarTickets'] as const;
    metodos.forEach(m => vi.spyOn(pagina, m).mockImplementation(() => {}));
  }
  it('permite ambos modos; no consulta con fechas inválidas o exclusiones contradictorias', () => {
    expect(pagina.puedeGenerarReporteAlertas).toBe(true);
    pagina.filtrosActuales.desde = undefined; pagina.generarReporteAlertas(); expect(peticiones).toHaveLength(0);
    pagina.filtrosActuales.desde = f.filtros.desde; pagina.proyectoSeleccionado = 'A';
    expect(pagina.puedeGenerarReporteAlertas).toBe(true);
    pagina.filtrosActuales.proyectos_excluidos = [' a ']; expect(pagina.puedeGenerarReporteAlertas).toBe(false);
  });
  it('hace una sola consulta con limite cinco e ignora formulario pendiente, límite y filtros dinámicos', () => {
    const original = structuredClone(pagina.filtrosActuales);
    pagina.filtrosForm.patchValue({ grupo_resolutor: 'Pendiente sin aplicar' }); pagina.limiteIncidentesPorcentajes = 50;
    pagina.estadoReporteProyectos = 'listo'; pagina.estadoReporteProyectoMensual = 'listo';
    pagina.generarReporteAlertas(); expect(peticiones).toHaveLength(1);
    expect(peticiones[0].limite).toBe(5); expect(peticiones[0].filtros).toEqual(f.filtros);
    expect(pagina.filtrosActuales).toEqual(original); expect(pagina.estadoReporteProyectos).toBe('listo'); expect(pagina.estadoReporteProyectoMensual).toBe('listo');
    pagina.filtrosActuales.proyectos_excluidos!.push('Posterior'); expect((peticiones[0].filtros as typeof f.filtros).proyectos_excluidos).toEqual(f.filtros.proyectos_excluidos);
  });
  it('usa únicamente proyectoSeleccionado como identidad del modo con proyecto', () => {
    pagina.proyectoSeleccionado = 'PRY-042 Proyecto ficticio completo'; pagina.generarReporteAlertas(); responder();
    expect(peticiones[0].filtros).toEqual({ ...f.filtros, proyecto: pagina.proyectoSeleccionado });
    expect(pagina.datosReporteAlertas?.modo).toBe('proyecto'); expect(pagina.datosReporteAlertas?.filtros.proyecto).toBe(pagina.proyectoSeleccionado);
  });
  it('espera respuesta completa y render vigente antes de capturar y limpia el enlace', async () => {
    pagina.generarReporteAlertas(); peticiones[0].respuesta.next(f.respuesta);
    expect(pagina.datosReporteAlertas).toBeNull(); peticiones[0].respuesta.complete(); expect(pagina.estadoReporteAlertas).toBe('preparando');
    pagina.confirmarRenderAlertas(-1); expect(toPng).not.toHaveBeenCalled(); await capturar();
    expect(toPng).toHaveBeenCalledWith(documento, expect.objectContaining({ width: 1400, pixelRatio: 2, skipFonts: true, skipAutoScale: true }));
    expect(click).toHaveBeenCalledOnce(); expect(pagina.exportandoReporteAlertas).toBe(false);
    const enlace = click.mock.instances[0] as HTMLAnchorElement;
    expect(enlace.download).toMatch(/^CANVIA-Alertas-Recurrentes-general-2025-01-01_2025-06-30-\d{4}-\d{2}-\d{2}\.png$/); expect(enlace.isConnected).toBe(false);
  });
  it('mantiene su instantánea ante cambios dinámicos, búsqueda y paginación', async () => {
    pagina.generarReporteAlertas(); responder(); const datos = pagina.datosReporteAlertas;
    pagina.filtrosActuales.periodo = '2025-04'; pagina.filtrosActuales.descripcion = 'Otra'; pagina.filtrosActuales.proyecto = 'Residual'; pagina.busquedaDescripcion = 'Otra';
    aislarConsultasDashboard(); pagina.cargarDashboard(); expect(pagina.datosReporteAlertas).toBe(datos); await capturar(); expect(click).toHaveBeenCalledOnce();
  });
  it('cancela general→A→general y no acepta respuestas o renders antiguos', () => {
    aislarConsultasDashboard(); pagina.generarReporteAlertas(); const anterior = peticiones[0];
    pagina.cambiarProyecto('A'); pagina.cambiarProyecto(null); anterior.respuesta.next(f.respuesta); anterior.respuesta.complete();
    expect(pagina.datosReporteAlertas).toBeNull(); pagina.generarReporteAlertas(); responder();
    expect(pagina.datosReporteAlertas?.modo).toBe('general'); pagina.confirmarRenderAlertas(1); expect(toPng).not.toHaveBeenCalled();
  });
  it('invalida exclusiones antes del debounce y vuelve al modo general al excluir el proyecto', () => {
    vi.useFakeTimers(); pagina.proyectoSeleccionado = 'A'; pagina.generarReporteAlertas(); responder();
    pagina.cambiarProyectosExcluidos(['A']); expect(pagina.proyectoSeleccionado).toBeNull(); expect(pagina.datosReporteAlertas).toBeNull();
    expect(pagina.puedeGenerarReporteAlertas).toBe(true); pagina.generarReporteAlertas();
    expect((peticiones.at(-1)!.filtros as typeof f.filtros).proyecto).toBeUndefined();
    expect((peticiones.at(-1)!.filtros as typeof f.filtros).proyectos_excluidos).toEqual(['A']);
  });
  it('bloquea doble clic y confirmaciones duplicadas', async () => {
    pagina.generarReporteAlertas(); pagina.generarReporteAlertas(); expect(peticiones).toHaveLength(1); responder();
    const version = pagina.datosReporteAlertas!.version;
    pagina.confirmarRenderAlertas(version); pagina.confirmarRenderAlertas(version); await resolver();
    expect(toPng).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
  });
  it('no descarga respuestas incoherentes ni datos vacíos', () => {
    pagina.generarReporteAlertas(); const invalido = structuredClone(f.respuesta); invalido.descripciones[0].porcentaje = 90; responder(invalido);
    expect(pagina.estadoReporteAlertas).toBe('error'); expect(toPng).not.toHaveBeenCalled();
    pagina.reintentarReporteAlertas(); responder(alertasFicticias(null, [], 0).respuesta);
    expect(pagina.estadoReporteAlertas).toBe('sin_datos'); expect(toPng).not.toHaveBeenCalled();
  });
  it('controla HTTP, respuesta sin emisión y timeout y permite reintentar la consulta', () => {
    pagina.generarReporteAlertas(); peticiones[0].respuesta.error(new Error('HTTP ficticio'));
    expect(pagina.exportandoReporteAlertas).toBe(false); pagina.reintentarReporteAlertas(); expect(peticiones).toHaveLength(2);
    peticiones[1].respuesta.complete(); expect(pagina.estadoReporteAlertas).toBe('error');
    vi.useFakeTimers(); pagina.reintentarReporteAlertas(); vi.advanceTimersByTime(30000); expect(pagina.estadoReporteAlertas).toBe('error');
  });
  it('comunica falta de legibilidad y reintenta render o captura sin nuevo HTTP', async () => {
    pagina.generarReporteAlertas(); responder(); const version = pagina.datosReporteAlertas!.version;
    pagina.fallarRenderAlertas({ version, motivo: 'legibilidad' }); expect(pagina.errorReporteAlertas).toContain('sin recortes');
    pagina.reintentarReporteAlertas(); pagina.confirmarRenderAlertas(version); expect(toPng).not.toHaveBeenCalled();
    vi.mocked(toPng).mockRejectedValueOnce(new Error('Captura ficticia')); await capturar(); expect(pagina.estadoReporteAlertas).toBe('error');
    pagina.reintentarReporteAlertas(); await capturar(); expect(peticiones).toHaveLength(1); expect(click).toHaveBeenCalledOnce();
  });
  it('descarta capturas tras cambio global o navegación', async () => {
    aislarConsultasDashboard(); pagina.generarReporteAlertas(); responder();
    let terminar!: (v: string) => void; vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    pagina.confirmarRenderAlertas(pagina.datosReporteAlertas!.version); pagina.filtrosActuales.prioridad = 'Otra'; pagina.cargarDashboard();
    expect(pagina.puedeGenerarReporteAlertas).toBe(false); terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
    pagina.generarReporteAlertas(); responder(); pagina.confirmarRenderAlertas(pagina.datosReporteAlertas!.version);
    pagina.ngOnDestroy(); terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
  });
  it('limita la captura y descarta un resultado tardío', async () => {
    vi.useFakeTimers(); pagina.generarReporteAlertas(); responder(); let terminar!: (v: string) => void;
    vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    pagina.confirmarRenderAlertas(pagina.datosReporteAlertas!.version); await vi.advanceTimersByTimeAsync(30000);
    expect(pagina.errorReporteAlertas).toContain('tiempo'); expect(pagina.exportandoReporteAlertas).toBe(false);
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await resolver(); expect(click).not.toHaveBeenCalled();
  });
  it('protege dimensiones e imágenes inválidas', async () => {
    pagina.generarReporteAlertas(); responder(); vi.mocked(toPng).mockResolvedValueOnce('data:,'); await capturar(); expect(click).not.toHaveBeenCalled();
    Object.defineProperty(documento, 'scrollWidth', { value: 1401, configurable: true }); pagina.reintentarReporteAlertas(); await capturar(); expect(toPng).toHaveBeenCalledTimes(1);
    Object.defineProperty(documento, 'scrollWidth', { value: 1400 }); Object.defineProperty(documento, 'scrollHeight', { value: 17000 });
    pagina.reintentarReporteAlertas(); await capturar(); expect(pagina.errorReporteAlertas).toContain('tamaño'); expect(toPng).toHaveBeenCalledTimes(1);
  });
});
