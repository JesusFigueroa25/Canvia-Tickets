import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { IncidentRecurringAlertsReport } from './incident-recurring-alerts-report';
import { crearReporteAlertas } from './incident-recurring-alerts-report.utils';
import { alertasFicticias } from './incident-recurring-alerts-report.fixture';

describe('R04: presentación de ambos modos y render versionado', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(950);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function datos(proyecto: string | null = null, version = 1) { const f = alertasFicticias(proyecto); return crearReporteAlertas(f.respuesta, f.filtros, version, '2026-11-24T20:00:00Z'); }
  async function pintar() { await Promise.resolve(); frames.splice(0).forEach(f => f(0)); frames.splice(0).forEach(f => f(0)); await Promise.resolve(); await Promise.resolve(); }
  it('muestra cinco barras, dona de dos segmentos y textos exactos sin controles en modo general', async () => {
    const fixture = TestBed.createComponent(IncidentRecurringAlertsReport), d = datos(), original = structuredClone(d);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', d); fixture.detectChanges(); const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.project-name')).toBeNull(); expect(el.querySelector('.scope-label')?.textContent).toContain('Análisis general');
    expect(el.querySelectorAll('.kpi')).toHaveLength(3); expect(el.querySelectorAll('.alert-bar')).toHaveLength(5);
    expect(Array.from(el.querySelectorAll('.alert-description')).map(e => e.textContent)).toEqual(d.alertas.map(a => a.descripcion));
    expect(el.querySelectorAll('.alerts-donut-segment')).toHaveLength(2); expect(el.querySelectorAll('.donut-legend-row')).toHaveLength(2);
    expect(el.querySelector('.alerts-donut')?.textContent).toContain(d.total.toLocaleString('es-PE'));
    expect(Array.from(el.querySelectorAll('.alerts-finding p')).map(e => e.textContent)).toEqual(d.hallazgos);
    expect(el.querySelector('.alerts-conclusion')?.textContent).toBe(d.conclusion);
    expect(Array.from(el.querySelectorAll('.alerts-recommendations li')).map(e => e.textContent)).toEqual(d.recomendaciones);
    expect(el.querySelectorAll('button,input,select,canvas,img')).toHaveLength(0);
    await pintar(); expect(listo).toHaveBeenCalledWith(1); expect(d).toEqual(original); fixture.destroy();
  });
  it('activa la composición por proyecto y conserva nombre y descripciones muy extensos', async () => {
    const proyecto = 'PRY-042 ' + 'Proyecto ficticio de servicios compartidos e infraestructura regional. '.repeat(4);
    const f = alertasFicticias(proyecto); f.respuesta.descripciones[0].descripcion = 'Descripción ficticia muy extensa de una alerta de infraestructura. '.repeat(5);
    const d = crearReporteAlertas(f.respuesta, f.filtros, 1, '2026-11-24T20:00:00Z');
    const fixture = TestBed.createComponent(IncidentRecurringAlertsReport); fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.alerts-document')?.classList.contains('project-mode')).toBe(true);
    expect(el.querySelector('.project-name')?.textContent).toBe(proyecto);
    expect(el.querySelector('.alert-description')?.textContent).toBe(f.respuesta.descripciones[0].descripcion);
    await pintar(); fixture.destroy();
  });
  it('con una categoría no inventa arco de Otros ni duplica la tasa como otro KPI', async () => {
    const f = alertasFicticias(null, [1], 1), fixture = TestBed.createComponent(IncidentRecurringAlertsReport);
    fixture.componentRef.setInput('datos', crearReporteAlertas(f.respuesta, f.filtros, 1, '2026-11-24T20:00:00Z')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.alerts-donut-segment')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.donut-legend-row')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.kpi.orange').textContent).toContain('Única descripción');
    expect(fixture.nativeElement.querySelector('.kpi.orange').textContent).not.toContain('100.00 %');
    await pintar(); fixture.destroy();
  });
  it('descarta render anterior y destrucción mientras espera fuentes', async () => {
    let liberar!: () => void; const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(r => { liberar = r; }) } });
    try {
      const fixture = TestBed.createComponent(IncidentRecurringAlertsReport), listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar(); expect(listo).not.toHaveBeenCalled();
      fixture.componentRef.setInput('datos', datos('Proyecto B', 2)); fixture.detectChanges(); liberar(); await pintar(); expect(listo.mock.calls).toEqual([[2]]);
      fixture.componentRef.setInput('datos', datos(null, 3)); fixture.detectChanges(); fixture.destroy(); await pintar(); expect(listo).toHaveBeenCalledOnce();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
  it('bloquea dimensiones inválidas o contenido que deja de ser horizontal', async () => {
    const fixture = TestBed.createComponent(IncidentRecurringAlertsReport), error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1500);
    fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar(); expect(error).toHaveBeenLastCalledWith({ version: 1, motivo: 'render' });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1500);
    fixture.componentRef.setInput('datos', datos(null, 2)); fixture.detectChanges(); await pintar(); expect(error).toHaveBeenLastCalledWith({ version: 2, motivo: 'legibilidad' }); fixture.destroy();
  });
  it('limita a treinta segundos la espera de fuentes', async () => {
    vi.useFakeTimers(); const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(() => {}) } });
    try {
      const fixture = TestBed.createComponent(IncidentRecurringAlertsReport), error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(30000);
      expect(error).toHaveBeenCalledWith({ version: 1, motivo: 'render' }); fixture.destroy();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
});
