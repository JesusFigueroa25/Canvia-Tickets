import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { IncidentProjectMonthlyReport } from './incident-project-monthly-report';
import { crearReporteProyectoMensual } from './incident-project-monthly-report.utils';
import { proyectoMensualFicticio } from './incident-project-monthly-report.fixture';

describe('R03: documento compacto, identidad completa y confirmación de render', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(950);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const datos = (n = 6, version = 1) => { const f = proyectoMensualFicticio(Array.from({ length: n }, (_, i) => i * 15)); return crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, version, '2026-11-24T12:00:00Z'); };
  async function pintar() { await Promise.resolve(); frames.splice(0).forEach(f => f(0)); frames.splice(0).forEach(f => f(0)); await Promise.resolve(); await Promise.resolve(); }
  it('conserva identidad completa, ceros, textos y referencias de comparación sin controles', async () => {
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport), d = datos(), original = structuredClone(d);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.project-name')?.textContent).toContain(d.proyecto);
    expect(el.querySelectorAll('.kpi')).toHaveLength(3);
    expect(el.querySelectorAll('.project-monthly-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.month-project-bar')).toHaveLength(6);
    expect(el.querySelectorAll('.month-project-value')).toHaveLength(6);
    expect(el.querySelector('.month-project-value')?.textContent).toBe('0');
    expect(el.querySelector('.reference-months')?.textContent).toBe(`${d.variacionPeriodo!.desde.etiqueta} → ${d.variacionPeriodo!.hasta.etiqueta}`);
    expect(Array.from(el.querySelectorAll('.project-finding p')).map(p => p.textContent)).toEqual(d.hallazgos);
    expect(el.querySelector('.project-conclusion')?.textContent).toBe(d.conclusion);
    expect(Array.from(el.querySelectorAll('.project-recommendations li')).map(p => p.textContent)).toEqual(d.recomendaciones);
    expect(el.querySelectorAll('button,input,select,canvas,img')).toHaveLength(0);
    await pintar(); expect(listo).toHaveBeenCalledWith(1); expect(d).toEqual(original); fixture.destroy();
  });
  it('conserva 40 meses y valores en un solo SVG con etiquetas giradas legibles', async () => {
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
    fixture.componentRef.setInput('datos', datos(40)); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.project-monthly-chart')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.month-project-value')).toHaveLength(40);
    expect(fixture.nativeElement.querySelectorAll('.month-project-label')).toHaveLength(40);
    expect(fixture.nativeElement.querySelectorAll('.chart-panel .variation-item')).toHaveLength(40);
    expect(fixture.nativeElement.querySelector('.selected-project-executive .variation-summary')).toBeNull();
    expect(fixture.componentInstance.mesesVerticales).toBe(true); expect(fixture.componentInstance.valoresVerticales).toBe(true);
    await pintar(); fixture.destroy();
  });
  it('muestra todos los indicadores dentro de la tarjeta izquierda, con aumento, reducción y cero', async () => {
    const f = proyectoMensualFicticio([100, 150, 75, 75]);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, '2026-11-24T12:00:00Z');
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const indicadores = Array.from(el.querySelectorAll('.chart-panel .variation-item'));
    expect(indicadores).toHaveLength(4);
    expect(indicadores.map(e => e.querySelector('.variation-value')?.textContent)).toEqual(['No comparable', '50.00 %', '-50.00 %', '0.00 %']);
    expect(indicadores[1].classList.contains('aumento')).toBe(true);
    expect(indicadores[2].classList.contains('reduccion')).toBe(true);
    expect(indicadores[3].classList.contains('cero')).toBe(true);
    expect(indicadores.every(e => !!e.querySelector('svg'))).toBe(true);
    expect(el.querySelector('.variation-summary')?.closest('.chart-panel')).not.toBeNull();
    expect(el.querySelector('.variation-summary')?.textContent).not.toContain('Últimas');
    await pintar(); fixture.destroy();
  });
  it('distingue base cero de tasa cero sin inventar porcentajes', async () => {
    const f = proyectoMensualFicticio([0, 25, 25, 0, 0, 40]);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, '2026-11-24T12:00:00Z');
    const original = structuredClone(d), fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const indicadores: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.variation-item'));
    expect(indicadores.map(e => e.querySelector('.variation-value')?.textContent)).toEqual(['No comparable', 'No calculable', '0.00 %', '-100.00 %', 'No calculable', 'No calculable']);
    expect(indicadores[1].classList.contains('aumento')).toBe(true);
    expect(indicadores[4].classList.contains('cero')).toBe(true);
    expect(d).toEqual(original); await pintar(); fixture.destroy();
  });
  it('conserva los meses parciales y sin cobertura como No comparable', async () => {
    const f = proyectoMensualFicticio(); f.filtros.desde = '2025-01-15'; f.filtros.hasta = '2025-06-12';
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
    const d = crearReporteProyectoMensual(f.respuestas, f.filtros, f.disponibilidad, 1, '2026-11-24T12:00:00Z');
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    expect(fixture.componentInstance.variacionesVisuales.map(v => v.valor)).toEqual(['No comparable', 'No comparable', '-50.00 %', '66.67 %', '40.00 %', 'No comparable']);
    await pintar();
    const sinCobertura = crearReporteProyectoMensual(f.respuestas, f.filtros, { fecha_min: null, fecha_max: null }, 2, '2026-11-24T12:00:00Z');
    fixture.componentRef.setInput('datos', sinCobertura); fixture.detectChanges();
    expect(fixture.componentInstance.variacionesVisuales.every(v => v.tipo === 'no_comparable')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.variation-item')).toHaveLength(6);
    await pintar(); fixture.destroy();
  });
  it('bloquea el render exportable cuando el rango no cabe, en lugar de recortar o fragmentar', async () => {
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
    const error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit'), listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', datos(60)); fixture.detectChanges(); await pintar();
    expect(error).toHaveBeenCalledWith({ version: 1, motivo: 'legibilidad' }); expect(listo).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('espera fuentes y pinturas e ignora versiones anteriores y destrucción', async () => {
    let liberar!: () => void;
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(r => { liberar = r; }) } });
    try {
      const fixture = TestBed.createComponent(IncidentProjectMonthlyReport), listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar(); expect(listo).not.toHaveBeenCalled();
      fixture.componentRef.setInput('datos', datos(6, 2)); fixture.detectChanges(); liberar(); await pintar(); expect(listo.mock.calls).toEqual([[2]]);
      fixture.componentRef.setInput('datos', datos(6, 3)); fixture.detectChanges(); fixture.destroy(); await pintar(); expect(listo).toHaveBeenCalledOnce();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
  it('bloquea dimensiones inválidas y documentos verticales extensos', async () => {
    const fixture = TestBed.createComponent(IncidentProjectMonthlyReport), error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1500);
    fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar(); expect(error).toHaveBeenLastCalledWith({ version: 1, motivo: 'render' });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1500);
    fixture.componentRef.setInput('datos', datos(6, 2)); fixture.detectChanges(); await pintar(); expect(error).toHaveBeenLastCalledWith({ version: 2, motivo: 'legibilidad' }); fixture.destroy();
  });
  it('termina la espera de fuentes a los 30 segundos sin autorizar captura', async () => {
    vi.useFakeTimers();
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(() => {}) } });
    try {
      const fixture = TestBed.createComponent(IncidentProjectMonthlyReport);
      const error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit'), listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(30000);
      expect(error).toHaveBeenCalledWith({ version: 1, motivo: 'render' }); expect(listo).not.toHaveBeenCalled(); fixture.destroy();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
});
