import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../../app-module';
import { RequirementCategorizationReport } from './requirement-categorization-report';
import { reporteFicticio } from './requirement-categorization-report.fixture';

describe('Reporte agregado de categorización', () => {
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2300);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function pintar(): Promise<void> {
    await Promise.resolve();
    frames.splice(0).forEach((cb) => cb(0));
    frames.splice(0).forEach((cb) => cb(0));
    await Promise.resolve();
  }

  it('renderiza siete secciones, meses completos y Top 10, sin explorador ni paginadores', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const datos = reporteFicticio();
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('h2')).toHaveLength(7);
    expect(el.querySelectorAll('.monthly-table tbody tr')).toHaveLength(12);
    expect(el.querySelectorAll('.resolver-table tbody tr')).toHaveLength(10);
    expect(el.querySelectorAll('.resolver-bar-row')).toHaveLength(10);
    expect(el.querySelector('mat-paginator')).toBeNull();
    expect(el.textContent).not.toContain('Explorador de Tickets');
    expect(fixture.componentInstance.nombre(null)).toBe('Sin asignar');
    expect(el.textContent).toContain('Sin dato');
    expect(el.textContent).toContain('70.0%');
    await pintar();
    fixture.destroy();
  });

  it('comparte selección y desempates con el gráfico y conserva los totales generales', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const datos = reporteFicticio();
    Object.assign(datos.resolutores[0], { resolver_name: 'Zeta', incorrect_count: 5, total_tickets: 12 });
    Object.assign(datos.resolutores[1], { resolver_name: 'Beta', incorrect_count: 5, total_tickets: 15 });
    Object.assign(datos.resolutores[2], { resolver_name: 'Alfa', incorrect_count: 5, total_tickets: 15 });
    Object.assign(datos.resolutores[3], { resolver_name: 'Primero', incorrect_count: 6, total_tickets: 10 });
    const original = structuredClone(datos);
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const nombres = Array.from(el.querySelectorAll('.resolver-table tbody tr td:first-child'), e => e.textContent!.trim());
    expect(nombres.slice(0, 4)).toEqual(['Primero', 'Alfa', 'Beta', 'Zeta']);
    expect(nombres).toEqual(Array.from(el.querySelectorAll('.resolver-name'), e => e.textContent!.trim()));
    expect(nombres).toHaveLength(10);
    expect(el.querySelector('.resolver-table h2')!.textContent).toContain('07 Top 10 Estadístico por Colaborador');
    expect(el.querySelectorAll('.resolver-table th')).toHaveLength(6);
    expect(el.querySelector('.monthly-table tfoot')!.textContent).toContain('120');
    expect(el.querySelector('.kpis strong')!.textContent).toBe('120');
    expect(datos).toEqual(original);
    await pintar(); fixture.destroy();
  });

  it('calcula Subtotal Top 10 solo con filas visibles, con porcentajes ponderados', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const datos = reporteFicticio();
    fixture.componentRef.setInput('datos', datos); fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const celdas = () => Array.from(el.querySelectorAll('.resolver-table tfoot td'), e => e.textContent!.trim());
    expect(celdas()).toEqual(['Subtotal Top 10', '100', '70', '30', '70.0%', '30.0%']);
    const pocos = reporteFicticio();
    pocos.resolutores = [
      { ...datos.resolutores[0], total_tickets: 100, correct_count: 95, incorrect_count: 5, correct_percentage: 95, incorrect_percentage: 5 },
      { ...datos.resolutores[1], total_tickets: 10, correct_count: 0, incorrect_count: 10, correct_percentage: 0, incorrect_percentage: 100 },
    ];
    fixture.componentRef.setInput('datos', pocos); fixture.detectChanges();
    expect(el.querySelectorAll('.resolver-table tbody tr')).toHaveLength(2);
    expect(celdas()).toEqual(['Subtotal Top 10', '110', '95', '15', '86.4%', '13.6%']);
    const vacio = { ...pocos, resolutores: [] };
    fixture.componentRef.setInput('datos', vacio); fixture.detectChanges();
    expect(celdas()).toEqual(['Subtotal Top 10', '0', '0', '0', '0.0%', '0.0%']);
    await pintar(); fixture.destroy();
  });

  it('espera fuentes y dos frames antes de confirmar la versión renderizada', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const listo = vi.fn();
    fixture.componentInstance.renderizado.subscribe(listo);
    fixture.componentRef.setInput('datos', reporteFicticio());
    fixture.detectChanges();
    expect(listo).not.toHaveBeenCalled();
    await Promise.resolve();
    frames.splice(0).forEach((cb) => cb(0));
    expect(listo).not.toHaveBeenCalled();
    frames.splice(0).forEach((cb) => cb(0));
    await Promise.resolve();
    expect(listo).toHaveBeenCalledWith(1);
    fixture.destroy();
  });

  it('no confirma el reporte mientras las fuentes siguen pendientes', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    let resolverFuentes!: () => void;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>(resolve => resolverFuentes = resolve) },
    });
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    try {
      const listo = vi.fn();
      fixture.componentInstance.renderizado.subscribe(listo);
      fixture.componentRef.setInput('datos', reporteFicticio());
      fixture.detectChanges();
      await pintar();
      expect(listo).not.toHaveBeenCalled();
      resolverFuentes();
      await pintar();
      expect(listo).toHaveBeenCalledWith(1);
    } finally {
      fixture.destroy();
      if (descriptor) Object.defineProperty(document, 'fonts', descriptor);
      else Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('descarta confirmaciones de versiones previas y al destruirse', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const listo = vi.fn();
    fixture.componentInstance.renderizado.subscribe(listo);
    fixture.componentRef.setInput('datos', reporteFicticio());
    fixture.detectChanges();
    fixture.componentRef.setInput('datos', { ...reporteFicticio(), version: 2 });
    fixture.detectChanges();
    await pintar();
    expect(listo.mock.calls).toEqual([[2]]);
    fixture.componentRef.setInput('datos', { ...reporteFicticio(), version: 3 });
    fixture.detectChanges();
    fixture.destroy();
    await pintar();
    expect(listo.mock.calls).toEqual([[2]]);
  });

  it('comunica fallo de renderizado sin habilitar una exportación vacía', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(0);
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const error = vi.fn();
    fixture.componentInstance.errorRenderizado.subscribe(error);
    fixture.componentRef.setInput('datos', reporteFicticio());
    fixture.detectChanges();
    await pintar();
    expect(error).toHaveBeenCalledWith(1);
    fixture.destroy();
  });

  it('mantiene filtros efectivos, orden y datos originales; muestra nombres largos', async () => {
    const fixture = TestBed.createComponent(RequirementCategorizationReport);
    const datos = reporteFicticio();
    datos.filtros = {
      ...datos.filtros,
      resultado: 'INCORRECT',
      motivo_resolucion: 'Atribuible a Cliente',
      mes: '2026-01',
      nombre_resolutor: 'Demo',
      ticket_id: 'DEMO-1',
    };
    datos.resolutores[1].resolver_name =
      'Colaborador ficticio con un nombre muy extenso para comprobar ajuste de texto';
    datos.resolutores[1].incorrect_count = 4;
    datos.resolutores[1].correct_count = 6;
    datos.meses.reverse();
    const original = structuredClone(datos);
    fixture.componentRef.setInput('datos', datos);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    [
      'Resultado: Incorrectas',
      'Motivo: Atribuible a Cliente',
      'Mes: Ene 2026',
      'Colaborador: Demo',
      'Ticket: DEMO-1',
    ].forEach((t) => expect(texto).toContain(t));
    expect(texto).toContain(datos.resolutores[1].resolver_name);
    expect(fixture.componentInstance.meses[0].month).toBe('2026-01');
    expect(datos).toEqual(original);
    await pintar();
    fixture.destroy();
  });
});
