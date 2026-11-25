import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IncidentExecutiveSummaryReport } from './incident-executive-summary-report';
import { crearResumenEjecutivo } from './incident-executive-summary-report.utils';
import { resumenFicticio } from './incident-executive-summary-report.fixture';

describe('Resumen Ejecutivo: composición y render versionado', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IncidentExecutiveSummaryReport] }); frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400); vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1100);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const datos = (sin = false, respaldo = false, version = 1) => { const f = resumenFicticio(sin, respaldo); return crearResumenEjecutivo(f.fuentes, f.filtros, version, '2026-11-25T13:00:00Z'); };
  async function pintar() { await Promise.resolve(); frames.splice(0).forEach(f => f(0)); frames.splice(0).forEach(f => f(0)); await Promise.resolve(); await Promise.resolve(); }
  it('mantiene servidores, dona y comparación en ese orden; preserva los textos originales', async () => {
    const fixture = TestBed.createComponent(IncidentExecutiveSummaryReport), d = datos(), original = structuredClone(d);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges(); const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('.chart-card')).map(e => e.className)).toEqual(['report-panel chart-card servers-panel', 'report-panel chart-card distribution-panel', 'report-panel chart-card comparison-panel']);
    expect(el.querySelectorAll('.server-row')).toHaveLength(5); expect(el.querySelectorAll('.donut-segment')).toHaveLength(2); expect(el.querySelectorAll('.kpi')).toHaveLength(3);
    expect(Array.from(el.querySelectorAll('.finding-copy p')).map(e => e.textContent)).toEqual(d.hallazgos.map(h => h.descripcion));
    expect(el.querySelector('.conclusion-text')?.textContent).toBe(d.conclusion!.conclusion);
    expect(el.querySelector('.summary-recommendation p')?.textContent).toBe(d.conclusion!.recomendacion);
    expect(el.querySelectorAll('canvas,button,select,input,img')).toHaveLength(0); expect(el.querySelector('.project-name')).toBeNull(); expect(el.querySelector('.incident-types')).toBeNull();
    const emit = vi.spyOn(fixture.componentInstance.renderizado, 'emit'); await pintar(); expect(emit).toHaveBeenCalledWith(1); expect(d).toEqual(original); fixture.destroy();
  });
  it('omite servidores, redistribuye dos gráficos y muestra el respaldo sin afirmar origen IA', async () => {
    const fixture = TestBed.createComponent(IncidentExecutiveSummaryReport); fixture.componentRef.setInput('datos', datos(true, true)); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.servers-panel')).toBeNull(); expect(el.querySelector('.summary-charts')?.classList.contains('without-servers')).toBe(true);
    expect(el.querySelectorAll('.chart-card')).toHaveLength(2); expect(el.querySelector('.analysis-origin')?.textContent).toContain('Respaldo basado en reglas');
    expect(el.querySelector('.analysis-origin')?.textContent).toContain('hechos operativos de respaldo'); await pintar(); fixture.destroy();
  });
  it('conserva nombres, tipos y textos largos, filtros completos y estado metodológico', async () => {
    const f = resumenFicticio(); Object.assign(f.filtros, { proyecto: 'Proyecto completo '.repeat(18), tipo_incidente: ['Categoría completa '.repeat(7)], periodo: '2025-02', descripcion: 'Descripción filtrada', proyectos_excluidos: ['Otro proyecto'] });
    f.fuentes.analisis.hallazgos.hallazgos[3].descripcion = 'Texto completo '.repeat(45);
    const d = crearResumenEjecutivo(f.fuentes, f.filtros, 1, ''), fixture = TestBed.createComponent(IncidentExecutiveSummaryReport);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges(); const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.project-name')?.textContent).toBe('Proyecto: ' + f.filtros.proyecto);
    expect(el.querySelector('.incident-types')?.textContent).toContain(f.filtros.tipo_incidente![0]);
    expect(el.querySelector('.finding-copy p')?.textContent).toBe(f.fuentes.analisis.hallazgos.hallazgos[3].descripcion);
    expect(el.querySelector('.report-meta')?.textContent).toContain('Mes: 2025-02'); expect(el.querySelector('.adjustment-state')?.textContent).toContain('Ajustes deshabilitados'); await pintar(); fixture.destroy();
  });
  it('descarta cambios de versión y destrucción durante la espera de fuentes', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts'); let liberar!: () => void;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(r => { liberar = r; }) } });
    try {
      const fixture = TestBed.createComponent(IncidentExecutiveSummaryReport), emit = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); fixture.componentRef.setInput('datos', datos(false, false, 2)); fixture.detectChanges(); liberar(); await pintar(); expect(emit.mock.calls).toEqual([[2]]);
      fixture.componentRef.setInput('datos', datos(false, false, 3)); fixture.detectChanges(); fixture.destroy(); await pintar(); expect(emit).toHaveBeenCalledOnce();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
  it('bloquea dimensiones y altura que impiden una imagen horizontal', async () => {
    const fixture = TestBed.createComponent(IncidentExecutiveSummaryReport), emit = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1500); fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar(); expect(emit).toHaveBeenLastCalledWith({ version: 1, motivo: 'render' });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400); vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1400);
    fixture.componentRef.setInput('datos', datos(false, false, 2)); fixture.detectChanges(); await pintar(); expect(emit).toHaveBeenLastCalledWith({ version: 2, motivo: 'legibilidad' }); fixture.destroy();
  });
  it('limita la espera de fuentes a treinta segundos', async () => {
    vi.useFakeTimers(); const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts'); Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => { }) } });
    try { const fixture = TestBed.createComponent(IncidentExecutiveSummaryReport), emit = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit'); fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(30000); expect(emit).toHaveBeenCalledWith({ version: 1, motivo: 'render' }); fixture.destroy(); }
    finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
});
