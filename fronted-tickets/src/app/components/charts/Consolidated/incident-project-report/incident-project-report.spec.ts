import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { IncidentProjectReport } from './incident-project-report';
import { crearReporteProyectos } from './incident-project-report.utils';
import { proyectosFicticios } from './incident-project-report.fixture';

describe('R02: documento ejecutivo, gráficos y render versionado', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1600);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function datos(n = 12, meses = 3, version = 1) {
    const f = proyectosFicticios(n, meses);
    return crearReporteProyectos(f.respuestas, f.filtros, f.disponibilidad, version, '2026-11-24T12:00:00Z');
  }
  async function pintar() {
    await Promise.resolve(); frames.splice(0).forEach(f => f(0)); frames.splice(0).forEach(f => f(0));
    await Promise.resolve(); await Promise.resolve();
  }
  it('presenta barras verticales agrupadas, dona completa y tres columnas sin controles', async () => {
    const fixture = TestBed.createComponent(IncidentProjectReport), d = datos(), original = structuredClone(d);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.kpi')).toHaveLength(3);
    expect(el.querySelectorAll('.project-month-bar')).toHaveLength(30);
    const grupos = fixture.componentInstance.graficoTop!.grupos;
    expect(grupos).toHaveLength(10);
    expect(grupos[0].barras[0].x).not.toBe(grupos[0].barras[1].x);
    expect(grupos[0].barras.every(b => b.y + b.alto === 240)).toBe(true);
    expect(el.querySelectorAll('.month-legend span')).toHaveLength(3);
    expect(el.querySelectorAll('.donut-legend-row')).toHaveLength(6);
    expect(el.querySelector('.project-donut')?.textContent).toContain(d.total.toLocaleString('es-PE'));
    expect(el.querySelectorAll('.project-lower-grid > article')).toHaveLength(3);
    expect(el.querySelectorAll('.project-finding p')).toHaveLength(3);
    expect(Array.from(el.querySelectorAll('.project-finding p')).map(p => p.textContent)).toEqual(d.hallazgos);
    expect(el.querySelector('.project-conclusion')?.textContent).toBe(d.conclusion);
    expect(Array.from(el.querySelectorAll('.project-recommendations li')).map(p => p.textContent)).toEqual(d.recomendaciones);
    expect(el.querySelectorAll('button,input,select,canvas,img')).toHaveLength(0);
    expect(el.textContent).toContain(d.distribucion.find(p => p.proyecto.includes('Compartidos'))!.proyecto);
    expect(el.querySelectorAll('.project-grouped-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.project-trend-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.trend-line')).toHaveLength(1);
    expect(el.querySelectorAll('.trend-month-point')).toHaveLength(3);
    expect(el.querySelectorAll('.trend-month-bar')).toHaveLength(0);
    expect(grupos.find(p => p.nombre.includes('Compartidos'))!.lineas.join(' ')).toBe('Proyecto ficticio 04 Centro de Servicios Compartidos Regionales');
    expect(listo).not.toHaveBeenCalled(); await pintar(); expect(listo).toHaveBeenCalledWith(1);
    expect(d).toEqual(original); fixture.destroy();
  });
  it('conserva todos los meses en un solo gráfico agrupado y una sola línea en rangos largos', async () => {
    const fixture = TestBed.createComponent(IncidentProjectReport), d = datos(12, 14);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.project-month-bar')).toHaveLength(140);
    expect(el.querySelectorAll('.trend-month-label')).toHaveLength(14);
    expect(el.querySelectorAll('.project-grouped-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.project-trend-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.trend-month-point')).toHaveLength(14);
    expect(el.querySelectorAll('.project-bar-value')).toHaveLength(140);
    expect(fixture.componentInstance.graficoTop!.etiquetasCompletas).toBe(false);
    const claves = fixture.componentInstance.graficoTop!.grupos.flatMap(p => p.barras.map(b => `${p.nombre}|${b.mes}`));
    expect(new Set(claves).size).toBe(140);
    expect(fixture.componentInstance.graficoTop!.grupos.every(p => p.lineas.length > 0)).toBe(true);
    expect(fixture.componentInstance.tendencia!.meses.map(m => m.valor)).toEqual(d.mensual.meses.map(m => m.tickets));
    expect(el.querySelector('.dense-label-note')?.textContent).toContain('máximo mensual');
    await pintar(); fixture.destroy();
  });
  it('mantiene una sola composición en rangos densos sin omitir puntos ni extremos del eje', async () => {
    const fixture = TestBed.createComponent(IncidentProjectReport), d = datos(12, 40);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.project-grouped-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.project-month-bar')).toHaveLength(400);
    expect(el.querySelectorAll('.project-trend-chart')).toHaveLength(1);
    expect(el.querySelectorAll('.trend-month-point')).toHaveLength(40);
    const puntos = fixture.componentInstance.tendencia!.meses;
    expect(puntos[0].mostrarMes && puntos.at(-1)!.mostrarMes).toBe(true);
    expect(puntos.filter(p => p.mostrarMes).length).toBeLessThan(40);
    expect(puntos.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(el.querySelectorAll('.project-finding')).toHaveLength(3);
    expect(el.querySelectorAll('.project-recommendations li')).toHaveLength(3);
    await pintar(); fixture.destroy();
  });
  it('representa correctamente dona de un solo proyecto y Otros cero', async () => {
    const fixture = TestBed.createComponent(IncidentProjectReport), d = datos(1, 1);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.donut-segment')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.donut-legend-row')).toHaveLength(2);
    expect(fixture.componentInstance.segmentos.at(-1)!.porcentaje).toBe(0);
    expect(fixture.componentInstance.tendencia!.linea).not.toContain('NaN');
    expect(fixture.nativeElement.querySelector('.project-donut').textContent).toContain(d.total.toLocaleString('es-PE'));
    await pintar(); fixture.destroy();
  });
  it('espera fuentes y pinturas, descarta renders obsoletos y respeta destrucción', async () => {
    let liberar!: () => void;
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(r => { liberar = r; }) } });
    try {
      const fixture = TestBed.createComponent(IncidentProjectReport);
      const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
      fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar();
      expect(listo).not.toHaveBeenCalled();
      fixture.componentRef.setInput('datos', datos(12, 3, 2)); fixture.detectChanges(); liberar(); await pintar();
      expect(listo.mock.calls).toEqual([[2]]);
      fixture.componentRef.setInput('datos', datos(12, 3, 3)); fixture.detectChanges(); fixture.destroy(); await pintar();
      expect(listo).toHaveBeenCalledOnce();
    } finally { if (descriptor) Object.defineProperty(document, 'fonts', descriptor); else Reflect.deleteProperty(document, 'fonts'); }
  });
  it('informa dimensiones inválidas en lugar de autorizar la captura', async () => {
    const fixture = TestBed.createComponent(IncidentProjectReport);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1600);
    const error = vi.spyOn(fixture.componentInstance.errorRenderizado, 'emit');
    fixture.componentRef.setInput('datos', datos()); fixture.detectChanges(); await pintar();
    expect(error).toHaveBeenCalledWith(1); fixture.destroy();
  });
});
