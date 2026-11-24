import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { IncidentRecurringAlertsRenderError, IncidentRecurringAlertsReportData } from '../../../../models/incident-recurring-alerts-report';

@Component({
  selector: 'app-incident-recurring-alerts-report', standalone: false,
  templateUrl: './incident-recurring-alerts-report.html', styleUrl: './incident-recurring-alerts-report.css',
})
export class IncidentRecurringAlertsReport implements OnChanges, OnDestroy {
  @Input() datos!: IncidentRecurringAlertsReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<IncidentRecurringAlertsRenderError>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  readonly colores = ['#FF620F', '#16835B', '#E8AD24', '#63B891', '#D97706'];
  readonly iconos = {
    barras: 'M4 3v22h21M8 8h14M8 14h10M8 20h6',
    dona: 'M13 3a11 11 0 1 0 11 12H13V3Zm4 0v8h8a10 10 0 0 0-8-8Z',
    hallazgos: 'M10 21h8m-7 4h6M9 17c-7-7-2-14 5-14s12 7 5 14l-1 3h-8l-1-3Z',
    ejecutivo: 'M7 3h12v21H4V6h3m0-3v3h9V3M8 12l3 3 6-6M8 20h8',
  };
  periodo = '';
  filtros: string[] = [];
  maximo = 1;
  fuenteTotal = 28;
  hallazgos: { partes: { texto: string; destacado: boolean }[] }[] = [];
  segmentos: { nombre: string; cantidad: number; porcentaje: number; color: string; trazo: string; offset: number }[] = [];
  private revision = 0;
  private cancelarRender?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision;
    this.cancelarRender?.();
    if (!this.datos) return;
    const d = this.datos, f = d.filtros;
    const mes = (fecha: string) => new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha.slice(0, 7)}-01T00:00:00Z`));
    this.periodo = `${mes(f.desde!)} a ${mes(f.hasta!)}`;
    this.filtros = [`Fechas: ${f.desde} — ${f.hasta}`,
      ...([['Prioridad', f.prioridad], ['Motivo de estado', f.motivo_estado], ['Motivo de resolución', f.motivo_resolucion],
        ['Proyectos excluidos', f.proyectos_excluidos?.join(', ')]] as const).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`)];
    this.maximo = Math.max(1, d.alertas[0]?.cantidad ?? 0);
    this.fuenteTotal = Math.min(28, 170 / this.numero(d.total).length);
    const circunferencia = Math.PI * 2 * 65;
    let acumulado = 0;
    this.segmentos = [
      { nombre: 'Top 5 acumulado', cantidad: d.topTotal, porcentaje: d.participacionTop, color: '#FF620F' },
      { nombre: 'Otros incidentes', cantidad: d.otros, porcentaje: d.participacionOtros, color: '#16835B' },
    ].map(s => {
      const longitud = d.total > 0 ? s.cantidad / d.total * circunferencia : 0;
      const segmento = { ...s, trazo: `${longitud} ${circunferencia}`, offset: -acumulado };
      acumulado += longitud; return segmento;
    });
    this.hallazgos = d.hallazgos.map(texto => ({ partes: texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g).filter(Boolean)
      .map(parte => ({ texto: parte, destacado: /\d/.test(parte) })) }));
    void this.esperarRender(revision, d.version);
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined, cancelar: (() => void) | undefined;
    try {
      await Promise.race([
        (async () => { await document.fonts?.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); })(),
        new Promise<never>((_, reject) => {
          cancelar = () => reject(new Error('cancelado')); this.cancelarRender = cancelar;
          temporizador = setTimeout(() => reject(new Error('render')), 30000);
        }),
      ]);
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth !== 1400 || el.scrollHeight <= 0) throw new Error('render');
      if (el.scrollHeight >= 1400 || this.fuenteTotal < 14 || !this.textosLegibles(el)) throw new Error('legibilidad');
      this.renderizado.emit(version);
    } catch (error) {
      if (revision === this.revision) this.errorRenderizado.emit({ version, motivo: error instanceof Error && error.message === 'legibilidad' ? 'legibilidad' : 'render' });
    } finally { clearTimeout(temporizador); if (this.cancelarRender === cancelar) this.cancelarRender = undefined; }
  }

  private textosLegibles(el: HTMLElement): boolean {
    const svg = el.querySelector<SVGSVGElement>('.alerts-donut');
    if (!svg || typeof svg.getBBox !== 'function') return true; // DOM de pruebas sin métricas SVG.
    const marco = svg.getBoundingClientRect();
    const cajas = Array.from(svg.querySelectorAll('text')).map(t => t.getBoundingClientRect());
    if (cajas.some(a => a.left < marco.left - 1 || a.right > marco.right + 1 || a.top < marco.top - 1 || a.bottom > marco.bottom + 1)) return false;
    for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) return false;
    }
    return !Array.from(el.querySelectorAll<HTMLElement>('.kpi,.report-panel,.header-copy,.alert-description,.alert-amounts'))
      .some(e => e.scrollWidth > e.clientWidth + 1);
  }

  ngOnDestroy(): void { ++this.revision; this.cancelarRender?.(); }
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  porcentaje(n: number): string { return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
}
