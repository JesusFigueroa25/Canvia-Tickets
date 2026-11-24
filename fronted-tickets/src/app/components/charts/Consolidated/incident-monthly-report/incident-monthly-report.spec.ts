import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { crearReporteMensual } from './incident-monthly-report.utils';
import { IncidentMonthlyReport } from './incident-monthly-report';

describe('R01: documento ejecutivo y confirmación de render', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function datos(version = 1) {
    return crearReporteMensual([{ anio: 2025, mes: 1, periodo: '', tickets: 10 }, { anio: 2026, mes: 1, periodo: '', tickets: 20 }],
      { desde: '2025-01-01', hasta: '2026-01-31', descripcion: 'Descripción ficticia extensa '.repeat(20) },
      { fecha_min: '2025-01-01', fecha_max: '2026-01-31' }, version, 1, '2026-11-24T12:00:00Z');
  }
  async function pintar() {
    await Promise.resolve(); frames.splice(0).forEach(f => f(0)); frames.splice(0).forEach(f => f(0));
    await Promise.resolve(); await Promise.resolve();
  }
  it('presenta todos los meses, KPIs y textos sin controles, canvas ni fuentes remotas', async () => {
    const fixture = TestBed.createComponent(IncidentMonthlyReport);
    const d = datos(), original = structuredClone(d);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('svg.monthly-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.month-label')).toHaveLength(13);
    expect(el.querySelectorAll('.kpi')).toHaveLength(3);
    expect(el.querySelectorAll('canvas, button, input, select, img')).toHaveLength(0);
    expect(el.textContent).toContain('Análisis de Tickets Mensuales');
    expect(el.textContent).toContain(d.filtros.descripcion!);
    expect(el.textContent).toContain('no acredita exhaustividad');
    expect(el.querySelector('.report-header .report-period')?.textContent).toContain('Período: enero de 2025 a enero de 2026');
    expect(el.querySelector('.report-meta')?.textContent).not.toContain('Período');
    expect(el.querySelectorAll('.kpi-icon svg')).toHaveLength(3);
    expect(Array.from(el.querySelectorAll('.finding-row p')).map(e => e.textContent)).toEqual(d.hallazgos);
    expect(el.querySelectorAll('.finding-icon svg')).toHaveLength(d.hallazgos.length);
    expect(el.querySelector('.executive p')?.textContent).toBe(d.conclusion);
    expect(el.querySelector('.recommendation p')?.textContent).toBe(d.recomendacion);
    expect(new Set(Array.from(el.querySelectorAll('.month-bar')).map(e => e.getAttribute('fill'))).size).toBe(13);
    expect(el.querySelectorAll('linearGradient')).toHaveLength(13);
    expect(el.querySelectorAll('.finding-row strong').length).toBeGreaterThan(0);
    expect(listo).not.toHaveBeenCalled(); await pintar();
    expect(listo).toHaveBeenCalledWith(1);
    expect(d).toEqual(original); fixture.destroy();
  });
  it('distribuye rangos largos sin perder meses y presenta solo los hallazgos disponibles', async () => {
    const d = crearReporteMensual(Array.from({ length: 40 }, (_, i) => ({
      anio: 2023 + Math.floor(i / 12), mes: i % 12 + 1, periodo: '', tickets: 10,
    })), { desde: '2023-01-01', hasta: '2026-04-30' },
    { fecha_min: '2023-01-01', fecha_max: '2026-04-30' }, 3, 1, '2026-11-24T12:00:00Z');
    const fixture = TestBed.createComponent(IncidentMonthlyReport);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.month-label')).toHaveLength(40);
    expect(el.querySelectorAll('svg.monthly-chart').length).toBeGreaterThan(1);
    expect(fixture.componentInstance.bloques.every(b => b.meses.length <= 18)).toBe(true);
    expect(el.querySelectorAll('.finding-row')).toHaveLength(d.hallazgos.length);
    expect(el.querySelectorAll('.finding-row')).toHaveLength(1);
    expect(el.querySelector('.findings-panel')?.classList.contains('compact-findings')).toBe(true);
    expect(el.querySelector('.finding-row p')?.textContent).toBe(d.hallazgos[0]);
    await pintar(); fixture.destroy();
  });
  it('espera las fuentes y descarta versiones anteriores', async () => {
    let liberar!: () => void;
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(r => { liberar = r; }) } });
    try {
      const fixture = TestBed.createComponent(IncidentMonthlyReport);
      const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos(1)); fixture.detectChanges(); await pintar();
      expect(listo).not.toHaveBeenCalled();
      fixture.componentRef.setInput('datos', datos(2)); fixture.detectChanges(); liberar(); await pintar();
      expect(listo.mock.calls).toEqual([[2]]); fixture.destroy();
    } finally {
      if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts');
    }
  });
  it('informa dimensiones inválidas y no confirma después de destruir el componente', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(0);
    const fixture = TestBed.createComponent(IncidentMonthlyReport);
    const error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar();
    expect(error).toHaveBeenCalledWith(1);
    fixture.componentRef.setInput('datos', datos(2)); fixture.detectChanges(); fixture.destroy(); await pintar();
    expect(listo).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce();
  });
  it('termina la preparación con error si el navegador no completa las pinturas', async () => {
    vi.useFakeTimers();
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(() => {}) } });
    try {
      const fixture = TestBed.createComponent(IncidentMonthlyReport);
      const error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(30000);
      expect(error).toHaveBeenCalledWith(1); fixture.destroy();
    } finally {
      if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts');
    }
  });
});
