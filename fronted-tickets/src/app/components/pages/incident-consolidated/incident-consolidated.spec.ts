import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentConsolidated } from './incident-consolidated';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

describe('R01: filtros, solicitudes y exportación PNG', () => {
  let pagina: IncidentConsolidated;
  let peticiones: { filtros: Record<string, unknown>; respuesta: Subject<unknown> }[];
  let click: ReturnType<typeof vi.spyOn>;
  let documento: HTMLElement;
  const filas = [10, 20, 15].map((tickets, i) => ({ anio: 2024, mes: i + 1, periodo: '', tickets }));
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    peticiones = [];
    const servicio = {
      obtenerVolumenMensual: vi.fn((filtros: Record<string, unknown>) => {
        const respuesta = new Subject<unknown>();
        peticiones.push({ filtros, respuesta });
        return respuesta;
      }),
    };
    pagina = new IncidentConsolidated(new FormBuilder(), servicio as unknown as IncidentConsolidatedService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef, new ElementRef(document.createElement('div')));
    pagina.crearFormularioFiltros();
    pagina.filtrosActuales = { desde: '2024-01-01', hasta: '2024-03-31', periodo: '2024-02',
      grupo_resolutor: 'Grupo ficticio', proyectos_excluidos: ['Excluido'], tipo_incidente: ['Tipo ficticio'] };
    pagina.opcionesFiltros.fecha_min = '2024-01-01';
    pagina.opcionesFiltros.fecha_max = '2024-03-31';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    documento = document.createElement('section');
    documento.className = 'report-document';
    Object.defineProperties(documento, {
      scrollWidth: { value: 1400, configurable: true }, scrollHeight: { value: 2500, configurable: true },
    });
    const stage = document.createElement('div'); stage.appendChild(documento);
    pagina.reporteMensualImagen = new ElementRef(stage);
    pagina.cargarVolumenMensual();
  });
  afterEach(() => {
    pagina.ngOnDestroy();
    peticiones.forEach(p => p.respuesta.complete());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  function preparar(): void {
    peticiones.at(-1)!.respuesta.next(structuredClone(filas));
    pagina.confirmarRenderMensual(pagina.datosReporteMensual!.version);
  }
  it('conserva los filtros exactos de la solicitud sin periodo ni cambios posteriores del formulario o arrays', () => {
    expect(peticiones[0].filtros).not.toHaveProperty('periodo');
    pagina.filtrosForm.patchValue({ grupo_resolutor: 'Pendiente de aplicar' });
    pagina.filtrosActuales.tipo_incidente!.push('Cambio posterior');
    pagina.filtrosActuales.proyectos_excluidos!.push('Otra exclusión');
    pagina.opcionesFiltros.fecha_max = '2024-01-10';
    preparar();
    expect(pagina.datosReporteMensual!.filtros).toEqual(peticiones[0].filtros);
    expect(pagina.datosReporteMensual!.filtros.tipo_incidente).toEqual(['Tipo ficticio']);
    expect(pagina.datosReporteMensual!.disponibilidad.fecha_max).toBe('2024-03-31');
    expect(pagina.datosReporteMensual!.total).toBe(45);
  });
  it('espera fuente y render válidos y no depende de otras consultas del dashboard', async () => {
    expect(pagina.reporteMensualListo).toBe(false);
    await pagina.descargarReporteMensual();
    expect(toPng).not.toHaveBeenCalled();
    peticiones[0].respuesta.next(filas);
    expect(pagina.estadoReporteMensual).toBe('preparando');
    pagina.confirmarRenderMensual(-1);
    expect(pagina.reporteMensualListo).toBe(false);
    pagina.cargandoProyectos = true;
    pagina.errorKpis = 'Fallo de una consulta ajena';
    pagina.confirmarRenderMensual(pagina.datosReporteMensual!.version);
    expect(pagina.reporteMensualListo).toBe(true);
  });
  it('descarta respuestas y confirmaciones obsoletas, incluso al reintentar la misma solicitud de dashboard', () => {
    preparar();
    const anterior = pagina.datosReporteMensual!.version;
    pagina.cargarVolumenMensual();
    expect(pagina.datosReporteMensual).toBeNull();
    peticiones[0].respuesta.next(filas);
    pagina.confirmarRenderMensual(anterior);
    expect(pagina.reporteMensualListo).toBe(false);
    preparar();
    expect(pagina.datosReporteMensual!.version).not.toBe(anterior);
    expect(pagina.reporteMensualListo).toBe(true);
  });
  it('invalida inmediatamente al excluir proyectos antes del debounce y bloquea respuestas previas', () => {
    vi.useFakeTimers();
    preparar();
    const cargar = vi.spyOn(pagina, 'cargarDashboard').mockImplementation(() => {});
    pagina.cambiarProyectosExcluidos(['Excluido nuevo']);
    expect(pagina.datosReporteMensual).toBeNull();
    expect(pagina.reporteMensualListo).toBe(false);
    expect(cargar).not.toHaveBeenCalled();
    peticiones[0].respuesta.next(filas);
    expect(pagina.datosReporteMensual).toBeNull();
    vi.advanceTimersByTime(300);
    expect(cargar).toHaveBeenCalledOnce();
  });
  it('seleccionar un mes conserva el rango mensual y descarta el snapshot de la recarga anterior', () => {
    preparar();
    const version = pagina.datosReporteMensual!.version;
    const otros = ['cargarOpcionesProyectos', 'cargarKpis', 'cargarProyectos', 'cargarTipos', 'cargarPrioridades',
      'cargarTopProyectos', 'cargarPrioridadMensual', 'cargarRendimientoResolutores', 'cargarExploradorDescripciones',
      'cargarDetalleEventosTecnicos', 'cargarIncidentesPorcentajes', 'cargarTopDescripcionesProyectos', 'cargarTopDetalles',
      'cargarTicketsPorResolutor', 'cargarTickets'] as const;
    otros.forEach(metodo => vi.spyOn(pagina, metodo).mockImplementation(() => {}));
    pagina.cambiarPeriodo('2024-03');
    expect(pagina.datosReporteMensual).toBeNull();
    expect(peticiones.at(-1)!.filtros).not.toHaveProperty('periodo');
    expect(peticiones.at(-1)!.filtros['desde']).toBe('2024-01-01');
    pagina.confirmarRenderMensual(version); expect(pagina.reporteMensualListo).toBe(false);
    preparar(); expect(pagina.datosReporteMensual!.total).toBe(45);
    expect(pagina.datosReporteMensual!.meses).toHaveLength(3);
  });
  it('un HTTP fallido bloquea datos previos y permite reconsultar solo el volumen', () => {
    preparar(); pagina.cargarVolumenMensual();
    peticiones[1].respuesta.error(new Error('HTTP ficticio'));
    expect(pagina.reporteMensualListo).toBe(false);
    expect(pagina.datosReporteMensual).toBeNull();
    expect(pagina.estadoReporteMensual).toBe('error');
    pagina.reintentarReporteMensual();
    expect(peticiones).toHaveLength(3);
    preparar();
    expect(pagina.errorReporteMensual).toBeNull();
    expect(pagina.reporteMensualListo).toBe(true);
  });
  it('gestiona timeout sin habilitar una descarga con datos antiguos', () => {
    vi.useFakeTimers(); pagina.cargarVolumenMensual();
    vi.advanceTimersByTime(30000);
    expect(pagina.estadoReporteMensual).toBe('error');
    expect(pagina.reporteMensualListo).toBe(false);
  });
  it.each([{ respuesta: [] }, { respuesta: filas.map(f => ({ ...f, tickets: 0 })) }])('deshabilita respuestas vacías o con total cero', ({ respuesta }) => {
    peticiones[0].respuesta.next(respuesta);
    expect(pagina.estadoReporteMensual).toBe('sin_datos');
    expect(pagina.datosReporteMensual).toBeNull();
  });
  it('rechaza respuestas inválidas y reintenta un fallo de render sin realizar HTTP adicional', () => {
    peticiones[0].respuesta.next([{ ...filas[0], tickets: -1 }]);
    expect(pagina.estadoReporteMensual).toBe('error');
    pagina.cargarVolumenMensual(); preparar();
    const version = pagina.datosReporteMensual!.version;
    pagina.fallarRenderMensual(version);
    expect(pagina.reporteMensualListo).toBe(false);
    pagina.reintentarReporteMensual();
    expect(peticiones).toHaveLength(2);
    pagina.confirmarRenderMensual(version);
    expect(pagina.reporteMensualListo).toBe(false);
    pagina.confirmarRenderMensual(pagina.datosReporteMensual!.version);
    expect(pagina.reporteMensualListo).toBe(true);
  });
  it('captura solo el documento a escala alta, nombra el PNG y limpia el enlace en descargas sucesivas', async () => {
    preparar();
    await pagina.descargarReporteMensual();
    expect(toPng).toHaveBeenCalledWith(documento, expect.objectContaining({ width: 1400, pixelRatio: 2, skipFonts: true, skipAutoScale: true }));
    const enlace = click.mock.instances[0] as HTMLAnchorElement;
    expect(enlace.download).toMatch(/^CANVIA-Incidentes-Mensuales-2024-01-01_2024-03-31-\d{4}-\d{2}-\d{2}\.png$/);
    expect(enlace.isConnected).toBe(false);
    await pagina.descargarReporteMensual();
    expect(click).toHaveBeenCalledTimes(2);
    expect(peticiones).toHaveLength(1);
  });
  it('controla doble clic y descarta la captura si cambian filtros antes de terminar', async () => {
    preparar();
    let terminar!: (imagen: string) => void;
    vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    const descarga = pagina.descargarReporteMensual();
    await pagina.descargarReporteMensual();
    expect(toPng).toHaveBeenCalledOnce();
    pagina.filtrosActuales.proyecto = 'Otro proyecto'; pagina.cargarVolumenMensual();
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await descarga;
    expect(click).not.toHaveBeenCalled();
    expect(pagina.errorExportacionMensual).toContain('cambiaron');
    expect(pagina.exportandoReporteMensual).toBe(false);
  });
  it('no entrega capturas tras abandonar la página', async () => {
    preparar();
    let terminar!: (imagen: string) => void;
    vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    const descarga = pagina.descargarReporteMensual(); pagina.ngOnDestroy();
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await descarga;
    expect(click).not.toHaveBeenCalled();
    expect(pagina.reporteMensualListo).toBe(false);
  });
  it('permite reintentar fallos de captura sin HTTP y rechaza imágenes inválidas', async () => {
    preparar(); vi.mocked(toPng).mockRejectedValueOnce(new Error('Captura ficticia'));
    await pagina.descargarReporteMensual();
    expect(pagina.errorExportacionMensual).toBeTruthy();
    expect(pagina.exportandoReporteMensual).toBe(false);
    vi.mocked(toPng).mockResolvedValueOnce('data:,');
    await pagina.descargarReporteMensual(); expect(click).not.toHaveBeenCalled();
    await pagina.descargarReporteMensual(); expect(click).toHaveBeenCalledOnce();
    expect(pagina.errorExportacionMensual).toBeNull();
  });
  it('reduce escala en documentos largos y rechaza dimensiones excesivas sin capturar', async () => {
    preparar(); Object.defineProperty(documento, 'scrollHeight', { value: 5000, configurable: true });
    await pagina.descargarReporteMensual();
    expect(toPng).toHaveBeenLastCalledWith(documento, expect.objectContaining({ pixelRatio: 1 }));
    Object.defineProperty(documento, 'scrollHeight', { value: 17000, configurable: true });
    await pagina.descargarReporteMensual(); expect(toPng).toHaveBeenCalledOnce();
    expect(pagina.errorExportacionMensual).toContain('tamaño');
    Object.defineProperty(documento, 'scrollWidth', { value: 0 });
    await pagina.descargarReporteMensual(); expect(toPng).toHaveBeenCalledOnce();
  });
});
