import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { RequirementCategorizationReport } from './requirement-categorization-report';
import { reporteFicticio, reporteMesesFicticios, reporteResultadoFicticio } from './requirement-categorization-report.fixture';
import { analizarCategorizacion } from './requirement-categorization-report.utils';

describe('Categorización: resumen ejecutivo y render versionado', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] }); frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1200);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  async function pintar() { await Promise.resolve(); frames.splice(0).forEach(cb => cb(0)); frames.splice(0).forEach(cb => cb(0)); for (let i = 0; i < 4; i++) await Promise.resolve(); }
  it('mantiene tres KPI, cuatro gráficos en el orden 2x2 y análisis completo sin tablas ni controles', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport), d = reporteFicticio();
    fixture.componentRef.setInput('datos', d); fixture.detectChanges(); const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Resumen Ejecutivo Auditoría de Categorización');
    expect(el.querySelectorAll('.kpi')).toHaveLength(3); expect(el.querySelectorAll('.donut-chart')).toHaveLength(2);
    expect(Array.from(el.querySelectorAll('.charts-grid > article')).map(e => e.className)).toEqual(['report-panel categorization-panel','report-panel reasons-panel','report-panel collaborators-panel','report-panel monthly-panel']);
    expect(el.querySelectorAll('.resolver-bar-row')).toHaveLength(10); expect(el.querySelectorAll('.month-label')).toHaveLength(12);
    expect(el.querySelector('.month-label')?.textContent).toBe('Ene 2026');
    expect(el.querySelectorAll('.monthly-chart text[transform]')).toHaveLength(0);
    expect(el.querySelectorAll('.finding-row')).toHaveLength(3); expect(el.querySelectorAll('.executive-body li')).toHaveLength(3);
    expect(el.querySelector('.conclusion')?.textContent).toBe(analizarCategorizacion(d).conclusion);
    expect(el.querySelectorAll('table,canvas,button,select,input,mat-paginator')).toHaveLength(0);
    const emitir = vi.spyOn(fixture.componentInstance.renderizado, 'emit'); await pintar(); expect(emitir).toHaveBeenCalledWith(1); fixture.destroy();
  });
  it('prioriza incorrectas y desempata por total/nombre sin modificar los totales globales', async () => {
    const d = reporteFicticio(), errores = [6,5,5,5,3,3,3,2,1,1,1,1];
    d.resolutores.forEach((r,i) => { r.incorrect_count=errores[i]; r.correct_count=10-errores[i]; r.incorrect_percentage=errores[i]*10; r.correct_percentage=100-errores[i]*10; });
    d.resolutores[0].resolver_name='Primero'; d.resolutores[1].resolver_name='Beta'; d.resolutores[2].resolver_name='Alfa'; d.resolutores[3].resolver_name='Zeta';
    const original=structuredClone(d), fixture=TestBed.createComponent(RequirementCategorizationReport);
    fixture.componentRef.setInput('datos',d); fixture.detectChanges(); const el:HTMLElement=fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('.resolver-name')).slice(0,4).map(e=>e.textContent)).toEqual(['Primero','Alfa','Beta','Zeta']);
    expect(el.querySelector('.kpi strong')?.textContent).toBe('120'); expect(el.querySelector('.resolver-metrics small')?.textContent).toContain('60.00');
    expect(d).toEqual(original); await pintar(); fixture.destroy();
  });
  it('conserva nombres completos, todas las categorías recibidas y filtros visibles', async () => {
    const d=reporteFicticio(); d.filtros={...d.filtros,proyecto:'Proyecto completo '.repeat(15),resultado:'INCORRECT',motivo_resolucion:'Atribuible a Cliente',mes:'2026-01',nombre_resolutor:'Resolutor ficticio',ticket_id:'DEMO-1'};
    d.resolutores[1].resolver_name='Colaborador con nombre completo '.repeat(7).trim(); d.motivos.items[1].reason='Categoría adicional completa '.repeat(6);
    const original=structuredClone(d), fixture=TestBed.createComponent(RequirementCategorizationReport); fixture.componentRef.setInput('datos',d); fixture.detectChanges(); const el:HTMLElement=fixture.nativeElement;
    expect(el.querySelector('.project-name')?.textContent).toBe('Proyecto: '+d.filtros.proyecto);
    expect(Array.from(el.querySelectorAll('.resolver-name')).some(e=>e.textContent===d.resolutores[1].resolver_name)).toBe(true);
    expect(Array.from(el.querySelectorAll('.reasons-panel .reason-label')).map(e=>e.textContent)).toEqual(['Atribuible a Cliente',d.motivos.items[1].reason,'Sin dato']);
    for(const f of ['Resultado: Incorrectas','Motivo: Atribuible a Cliente','Colaborador: Resolutor ficticio','Ticket: DEMO-1']) expect(el.textContent).toContain(f);
    expect(el.querySelector('.month-scope')?.textContent).toContain('2026'); expect(d).toEqual(original); await pintar(); fixture.destroy();
  });
  it('usa el rango recibido como alternativa si no hay límites globales y omite proyecto general', async () => {
    const d=reporteFicticio(); d.filtros={}; d.meses.forEach(m=>m.month='2025-'+m.month.slice(5));
    const fixture=TestBed.createComponent(RequirementCategorizationReport); fixture.componentRef.setInput('datos',d);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.project-name')).toBeNull();expect(fixture.nativeElement.querySelector('.report-period').textContent).toContain('2025');await pintar();fixture.destroy();
  });
  it('conserva todos los períodos recibidos de rangos largos sin fragmentarlos', async () => {
    const d=reporteMesesFicticios(24), fixture=TestBed.createComponent(RequirementCategorizationReport);
    fixture.componentRef.setInput('datos',d);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.monthly-chart')).toHaveLength(1);expect(fixture.nativeElement.querySelectorAll('.month-label')).toHaveLength(24);
    expect(fixture.componentInstance.mesesEnDosLineas).toBe(true);expect(fixture.componentInstance.meses.at(-1)?.month).toBe('2027-12');
    expect(fixture.nativeElement.querySelectorAll('.monthly-chart text[transform]')).toHaveLength(0);await pintar();fixture.destroy();
  });
  it.each([10, 11, 12])('conserva etiquetas horizontales y cantidades amplias para %s meses', async cantidad => {
    const d = reporteMesesFicticios(cantidad);
    [d.resumen, ...d.resolutores, ...d.meses].forEach(f => {
      f.total_tickets *= 1000; f.correct_count *= 1000; f.incorrect_count *= 1000;
    });
    d.resumen.processed_tickets *= 1000; d.motivos.total *= 1000;
    d.motivos.items.forEach(m => m.total_tickets *= 1000); d.meses.reverse();
    const original = structuredClone(d), fixture = TestBed.createComponent(RequirementCategorizationReport);
    fixture.componentRef.setInput('datos', d); fixture.detectChanges(); const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.monthly-chart text[transform]')).toHaveLength(0);
    expect(el.querySelectorAll('.month-label')).toHaveLength(cantidad);
    expect(el.querySelector('.month-label')?.textContent).toBe('Ene 2026');
    expect(Array.from(el.querySelectorAll('.month-total')).every(t => t.textContent === (10000).toLocaleString('es-PE'))).toBe(true);
    for (const [selector, valor, color] of [['.month-correct-value', 7000, '#16835B'], ['.month-incorrect-value', 3000, '#B83F35']] as const) {
      const valores = Array.from(el.querySelectorAll(selector)); expect(valores).toHaveLength(cantidad);
      expect(valores.every(t => t.textContent === valor.toLocaleString('es-PE') && t.getAttribute('fill') === color)).toBe(true);
    }
    expect(fixture.componentInstance.valoresEnDosLineas).toBe(true);
    expect(fixture.componentInstance.fuenteMes).toBeGreaterThanOrEqual(10);
    expect(fixture.componentInstance.altoMensual).toBeLessThanOrEqual(300);
    expect(d).toEqual(original); await pintar(); fixture.destroy();
  });
  it('admite cero incorrectas sin ocultar colaboradores ni inventar segmentos', async () => {
    const d=reporteResultadoFicticio(true), fixture=TestBed.createComponent(RequirementCategorizationReport);
    fixture.componentRef.setInput('datos',d);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.resolver-bar-row')).toHaveLength(10);expect(fixture.nativeElement.querySelectorAll('.categorization-panel .donut-segment')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toMatch(/NaN|Infinity/);await pintar();fixture.destroy();
  });
  it('espera fuentes y dos frames y descarta revisiones anteriores o destruidas', async () => {
    const fixture=TestBed.createComponent(RequirementCategorizationReport), emitir=vi.spyOn(fixture.componentInstance.renderizado,'emit');
    fixture.componentRef.setInput('datos',reporteFicticio());fixture.detectChanges();await Promise.resolve();frames.splice(0).forEach(cb=>cb(0));expect(emitir).not.toHaveBeenCalled();
    fixture.componentRef.setInput('datos',{...reporteFicticio(),version:2});fixture.detectChanges();await pintar();expect(emitir.mock.calls).toEqual([[2]]);
    fixture.componentRef.setInput('datos',{...reporteFicticio(),version:3});fixture.detectChanges();fixture.destroy();await pintar();expect(emitir).toHaveBeenCalledOnce();
  });
  it('bloquea dimensiones inválidas y composición excesivamente alta', async () => {
    const fixture=TestBed.createComponent(RequirementCategorizationReport), emitir=vi.spyOn(fixture.componentInstance.errorRenderizado,'emit');
    vi.spyOn(HTMLElement.prototype,'scrollHeight','get').mockReturnValue(0);fixture.componentRef.setInput('datos',reporteFicticio());fixture.detectChanges();await pintar();expect(emitir).toHaveBeenLastCalledWith({version:1,motivo:'render'});
    vi.spyOn(HTMLElement.prototype,'scrollHeight','get').mockReturnValue(1400);fixture.componentRef.setInput('datos',{...reporteFicticio(),version:2});fixture.detectChanges();await pintar();expect(emitir).toHaveBeenLastCalledWith({version:2,motivo:'legibilidad'});fixture.destroy();
  });
  it('bloquea datos inconsistentes antes de confirmar el render', () => {
    const fixture=TestBed.createComponent(RequirementCategorizationReport), emitir=vi.spyOn(fixture.componentInstance.errorRenderizado,'emit'),d=reporteFicticio();d.resumen.correct_percentage=80;
    fixture.componentRef.setInput('datos',d);fixture.detectChanges();expect(emitir).toHaveBeenCalledWith({version:1,motivo:'render'});fixture.destroy();
  });
  it('limita la espera de fuentes a treinta segundos', async () => {
    vi.useFakeTimers();const descriptor=Object.getOwnPropertyDescriptor(document,'fonts');Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise(()=>{})}});
    try{const fixture=TestBed.createComponent(RequirementCategorizationReport),emitir=vi.spyOn(fixture.componentInstance.errorRenderizado,'emit');fixture.componentRef.setInput('datos',reporteFicticio());fixture.detectChanges();await vi.advanceTimersByTimeAsync(30000);expect(emitir).toHaveBeenCalledWith({version:1,motivo:'render'});fixture.destroy();}
    finally{if(descriptor)Object.defineProperty(document,'fonts',descriptor);else Reflect.deleteProperty(document,'fonts');}
  });
});
