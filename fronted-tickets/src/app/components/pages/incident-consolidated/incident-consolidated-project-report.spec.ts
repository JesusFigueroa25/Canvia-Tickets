import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { toPng } from 'html-to-image';
import { AppModule } from '../../../app-module';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentConsolidated } from './incident-consolidated';
import { proyectosFicticios } from '../../charts/Consolidated/incident-project-report/incident-project-report.fixture';
import { crearReporteMensual } from '../../charts/Consolidated/incident-monthly-report/incident-monthly-report.utils';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
type Metodo = 'obtenerKpis' | 'obtenerProyectos' | 'obtenerTopProyectos' | 'obtenerVolumenMensual';

describe('R02: consultas, filtros y captura independiente', () => {
  let pagina: IncidentConsolidated;
  let peticiones: { metodo: Metodo; filtros: unknown; respuesta: Subject<unknown> }[];
  let click: ReturnType<typeof vi.spyOn>;
  let documento: HTMLElement;
  const f = proyectosFicticios();
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); peticiones = [];
    const servicio = Object.fromEntries((['obtenerKpis', 'obtenerProyectos', 'obtenerTopProyectos', 'obtenerVolumenMensual'] as Metodo[]).map(metodo =>
      [metodo, vi.fn((filtros: unknown) => { const respuesta = new Subject<unknown>(); peticiones.push({ metodo, filtros, respuesta }); return respuesta; })]));
    pagina = new IncidentConsolidated(new FormBuilder(), servicio as unknown as IncidentConsolidatedService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef, new ElementRef(document.createElement('div')));
    pagina.crearFormularioFiltros();
    pagina.filtrosActuales = { ...structuredClone(f.filtros), proyecto: 'Selección ignorada', periodo: '2025-02', nombre_resolutor: 'Ficticio',
      descripcion: 'Descripción ignorada', tipo_incidente: ['Tipo ficticio'], detalle_id: 'D-1', ticket_id: 'T-1' };
    pagina.opcionesFiltros.fecha_min = f.disponibilidad.fecha_min; pagina.opcionesFiltros.fecha_max = f.disponibilidad.fecha_max;
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,' + 'a'.repeat(150));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    documento = document.createElement('section'); documento.className = 'report-document';
    Object.defineProperties(documento, { scrollWidth: { value: 1400, configurable: true }, scrollHeight: { value: 1600, configurable: true } });
    const stage = document.createElement('div'); stage.appendChild(documento); pagina.reporteProyectosImagen = new ElementRef(stage);
  });
  afterEach(() => { pagina.ngOnDestroy(); peticiones.forEach(p => p.respuesta.complete()); vi.useRealTimers(); vi.restoreAllMocks(); });
  const claves: Record<Metodo, keyof typeof f.respuestas> = { obtenerKpis: 'kpis', obtenerProyectos: 'proyectos', obtenerTopProyectos: 'top', obtenerVolumenMensual: 'volumen' };
  function responder() {
    for (const p of peticiones.slice(-4)) { p.respuesta.next(structuredClone(f.respuestas[claves[p.metodo]])); p.respuesta.complete(); }
  }
  async function capturar() { pagina.confirmarRenderProyectos(pagina.datosReporteProyectos!.version); await Promise.resolve(); }
  function simularRecargaDashboard() {
    const metodos = ['cargarKpis', 'cargarVolumenMensual', 'cargarProyectos', 'cargarTipos', 'cargarPrioridades', 'cargarTopProyectos',
      'cargarPrioridadMensual', 'cargarRendimientoResolutores', 'cargarExploradorDescripciones', 'cargarDetalleEventosTecnicos',
      'cargarIncidentesPorcentajes', 'cargarTopDescripcionesProyectos', 'cargarTopDetalles', 'cargarTicketsPorResolutor', 'cargarTickets'] as const;
    metodos.forEach(m => vi.spyOn(pagina, m).mockImplementation(() => {}));
    pagina.cargarDashboard();
  }
  it('envía la misma copia de los siete filtros a las cuatro consultas sin mutar el dashboard ni R01', () => {
    const original = structuredClone(pagina.filtrosActuales);
    const mensual = crearReporteMensual(f.respuestas.volumen, original, f.disponibilidad, 1, 1, '2026-11-24T12:00:00Z');
    pagina.datosReporteMensual = mensual;
    pagina.generarReporteProyectos();
    expect(peticiones).toHaveLength(4);
    peticiones.forEach(p => expect(p.filtros).toEqual(f.filtros));
    expect(pagina.filtrosActuales).toEqual(original);
    pagina.filtrosForm.patchValue({ grupo_resolutor: 'Pendiente de aplicar' });
    pagina.filtrosActuales.proyectos_excluidos!.push('Cambio posterior');
    expect((peticiones[0].filtros as typeof f.filtros).proyectos_excluidos).toEqual(f.filtros.proyectos_excluidos);
    expect(pagina.datosReporteMensual).toBe(mensual);
  });
  it('espera las cuatro respuestas y render vigente antes de capturar automáticamente', async () => {
    pagina.generarReporteProyectos();
    const ultimo = peticiones.at(-1)!;
    peticiones.slice(0, 3).forEach(p => { p.respuesta.next(structuredClone(f.respuestas[claves[p.metodo]])); p.respuesta.complete(); });
    expect(pagina.datosReporteProyectos).toBeNull(); expect(toPng).not.toHaveBeenCalled();
    ultimo.respuesta.next(f.respuestas.volumen); ultimo.respuesta.complete();
    expect(pagina.estadoReporteProyectos).toBe('preparando');
    pagina.confirmarRenderProyectos(-1); expect(toPng).not.toHaveBeenCalled();
    await capturar(); expect(toPng).toHaveBeenCalledWith(documento, expect.objectContaining({ width: 1400, pixelRatio: 2, skipFonts: true, skipAutoScale: true }));
    expect(click).toHaveBeenCalledOnce(); expect(pagina.exportandoReporteProyectos).toBe(false);
    const enlace = click.mock.instances[0] as HTMLAnchorElement;
    expect(enlace.download).toMatch(/^CANVIA-Tickets-Proyecto-2025-01-01_2025-03-31-\d{4}-\d{2}-\d{2}\.png$/);
    expect(enlace.isConnected).toBe(false);
  });
  it('ignora cambios dinámicos y conserva su instantánea mientras los globales no cambien', async () => {
    pagina.generarReporteProyectos(); responder(); const datos = pagina.datosReporteProyectos;
    pagina.filtrosActuales.proyecto = 'Otro'; pagina.filtrosActuales.periodo = '2025-03'; simularRecargaDashboard();
    expect(pagina.datosReporteProyectos).toBe(datos); await capturar(); expect(click).toHaveBeenCalledOnce();
  });
  it('cancela por cambio global y descarta respuestas antiguas', () => {
    pagina.generarReporteProyectos(); pagina.filtrosActuales.prioridad = 'Otra'; simularRecargaDashboard();
    responder(); expect(pagina.datosReporteProyectos).toBeNull(); expect(toPng).not.toHaveBeenCalled();
    expect(pagina.exportandoReporteProyectos).toBe(false);
  });
  it('invalida exclusiones antes del debounce', () => {
    vi.useFakeTimers(); pagina.generarReporteProyectos(); responder();
    pagina.cambiarProyectosExcluidos(['Nueva exclusión ficticia']);
    expect(pagina.datosReporteProyectos).toBeNull(); expect(pagina.exportandoReporteProyectos).toBe(false);
  });
  it('bloquea doble clic y confirmaciones de render repetidas', async () => {
    pagina.generarReporteProyectos(); pagina.generarReporteProyectos(); expect(peticiones).toHaveLength(4);
    responder(); const version = pagina.datosReporteProyectos!.version;
    pagina.confirmarRenderProyectos(version); pagina.confirmarRenderProyectos(version); await Promise.resolve();
    expect(toPng).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
  });
  it('rechaza denominadores diferentes sin preparar documento', () => {
    pagina.generarReporteProyectos();
    for (const p of peticiones) {
      const valor = structuredClone(f.respuestas[claves[p.metodo]]);
      if (p.metodo === 'obtenerKpis') (valor as typeof f.respuestas.kpis).total_tickets++;
      p.respuesta.next(valor); p.respuesta.complete();
    }
    expect(pagina.datosReporteProyectos).toBeNull(); expect(pagina.errorReporteProyectos).toContain('no coinciden');
    expect(toPng).not.toHaveBeenCalled();
  });
  it('reintenta las cuatro consultas tras fallo HTTP y maneja timeout', () => {
    pagina.generarReporteProyectos(); peticiones[1].respuesta.error(new Error('HTTP ficticio'));
    expect(pagina.estadoReporteProyectos).toBe('error'); expect(pagina.exportandoReporteProyectos).toBe(false);
    vi.useFakeTimers(); pagina.reintentarReporteProyectos(); expect(peticiones).toHaveLength(8);
    vi.advanceTimersByTime(30000); expect(pagina.estadoReporteProyectos).toBe('error'); expect(pagina.exportandoReporteProyectos).toBe(false);
  });
  it('permite reintentar render y captura sin consultas adicionales', async () => {
    pagina.generarReporteProyectos(); responder();
    const version = pagina.datosReporteProyectos!.version; pagina.fallarRenderProyectos(version);
    pagina.reintentarReporteProyectos(); expect(peticiones).toHaveLength(4);
    pagina.confirmarRenderProyectos(version); expect(toPng).not.toHaveBeenCalled();
    vi.mocked(toPng).mockRejectedValueOnce(new Error('Captura ficticia')); await capturar();
    expect(pagina.errorReporteProyectos).toBeTruthy(); expect(pagina.exportandoReporteProyectos).toBe(false);
    pagina.reintentarReporteProyectos(); await capturar(); expect(click).toHaveBeenCalledOnce(); expect(peticiones).toHaveLength(4);
  });
  it('descarta una captura obsoleta y no entrega imágenes al abandonar la página', async () => {
    pagina.generarReporteProyectos(); responder();
    let terminar!: (v: string) => void;
    vi.mocked(toPng).mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    pagina.confirmarRenderProyectos(pagina.datosReporteProyectos!.version);
    pagina.filtrosActuales.grupo_resolutor = 'Otro grupo'; simularRecargaDashboard();
    expect(pagina.puedeGenerarReporteProyectos).toBe(false);
    terminar('data:image/png;base64,' + 'a'.repeat(150)); await Promise.resolve();
    expect(click).not.toHaveBeenCalled(); expect(pagina.exportandoReporteProyectos).toBe(false);
    pagina.generarReporteProyectos(); responder(); pagina.confirmarRenderProyectos(pagina.datosReporteProyectos!.version);
    pagina.ngOnDestroy(); terminar('data:image/png;base64,' + 'a'.repeat(150)); await Promise.resolve();
    expect(click).not.toHaveBeenCalled();
  });
  it('rechaza imágenes inválidas y dimensiones excesivas; escala uno para documentos largos', async () => {
    pagina.generarReporteProyectos(); responder();
    vi.mocked(toPng).mockResolvedValueOnce('data:,'); await capturar(); expect(click).not.toHaveBeenCalled();
    Object.defineProperty(documento, 'scrollHeight', { value: 5000, configurable: true });
    pagina.reintentarReporteProyectos(); await capturar(); expect(toPng).toHaveBeenLastCalledWith(documento, expect.objectContaining({ pixelRatio: 1 }));
    Object.defineProperty(documento, 'scrollHeight', { value: 17000 });
    pagina.generarReporteProyectos(); responder(); await capturar(); expect(pagina.errorReporteProyectos).toContain('tamaño');
    expect(toPng).toHaveBeenCalledTimes(2);
  });
  it('no consulta con fechas inválidas ni captura un resultado sin tickets', () => {
    pagina.filtrosActuales.desde = undefined; pagina.generarReporteProyectos(); expect(peticiones).toHaveLength(0);
    pagina.filtrosActuales.desde = f.filtros.desde; pagina.generarReporteProyectos(); const vacio = proyectosFicticios(0);
    for (const p of peticiones) { p.respuesta.next(vacio.respuestas[claves[p.metodo]]); p.respuesta.complete(); }
    expect(pagina.estadoReporteProyectos).toBe('sin_datos'); expect(toPng).not.toHaveBeenCalled();
  });
});
