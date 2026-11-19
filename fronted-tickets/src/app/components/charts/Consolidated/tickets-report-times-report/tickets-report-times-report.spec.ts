import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { TicketsReportTimesReport } from './tickets-report-times-report';
import { reporteTiemposFicticio } from './tickets-report-times-report.fixture';

describe('Presentación del reporte PNG de tiempos', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(3500);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function pintar(): Promise<void> {
    await Promise.resolve();
    frames.splice(0).forEach((f) => f(0));
    frames.splice(0).forEach((f) => f(0));
    await Promise.resolve();
  }
  it('renderiza seis secciones, matrices completas y rankings limitados sin canvas ni controles', async () => {
    const fixture = TestBed.createComponent(TicketsReportTimesReport),
      datos = reporteTiemposFicticio();
    const original = structuredClone(datos);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('h2')).toHaveLength(6);
    expect(el.querySelectorAll('table')).toHaveLength(4);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(48);
    expect(el.querySelectorAll('canvas,select,input,button')).toHaveLength(0);
    expect(fixture.componentInstance.bloquesResolutores[0].series).toHaveLength(10);
    expect(el.textContent).toContain('Total del período');
    expect(listo).not.toHaveBeenCalled();
    await pintar();
    expect(listo).toHaveBeenCalledWith(1);
    expect(datos).toEqual(original);
  });
  it('espera las fuentes antes de confirmar y descarta revisiones obsoletas', async () => {
    let liberar!: () => void;
    vi.stubGlobal('document', document);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>((r) => (liberar = r)) },
    });
    const fixture = TestBed.createComponent(TicketsReportTimesReport);
    const listo = vi.spyOn(fixture.componentInstance.renderizado, 'emit');
    fixture.componentRef.setInput('datos', reporteTiemposFicticio());
    fixture.detectChanges();
    await pintar();
    expect(listo).not.toHaveBeenCalled();
    fixture.componentRef.setInput('datos', { ...reporteTiemposFicticio(), version: 2 });
    fixture.detectChanges();
    liberar();
    await pintar();
    expect(listo.mock.calls).toEqual([[2]]);
    Reflect.deleteProperty(document, 'fonts');
  });
  it('conserva rango ejecutivo, mes efectivo, colores y nombres largos completos', async () => {
    const datos = reporteTiemposFicticio();
    datos.filtros.periodo = '2026-02';
    datos.graficoResolutores.series[0].nombre = 'Nombre ficticio extenso '.repeat(8);
    const fixture = TestBed.createComponent(TicketsReportTimesReport);
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.horasTotales).toBe(15);
    expect(c.volumen.flatMap((g) => g.periodos)).toHaveLength(12);
    expect(c.volumen[0].barras[0].color).toBe('#FFD3BC');
    expect(c.volumen[0].barras[2].color).toBe('#FF620F');
    expect(c.lineas(datos.graficoResolutores.series[0].nombre).join(' ')).toBe(
      datos.graficoResolutores.series[0].nombre.trim(),
    );
    await pintar();
  });
  it('notifica dimensiones inválidas y no confirma después de destruirse', async () => {
    const fixture = TestBed.createComponent(TicketsReportTimesReport),
      c = fixture.componentInstance;
    const fallo = vi.spyOn(c.errorRenderizado, 'emit'),
      listo = vi.spyOn(c.renderizado, 'emit');
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(0);
    fixture.componentRef.setInput('datos', reporteTiemposFicticio());
    fixture.detectChanges();
    await pintar();
    expect(fallo).toHaveBeenCalledWith(1);
    fixture.componentRef.setInput('datos', { ...reporteTiemposFicticio(), version: 2 });
    fixture.detectChanges();
    fixture.destroy();
    await pintar();
    expect(listo).not.toHaveBeenCalled();
  });
});
