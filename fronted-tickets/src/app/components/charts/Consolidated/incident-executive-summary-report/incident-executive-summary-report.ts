import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import type { ExecutiveSummaryRenderError, IncidentExecutiveSummaryData } from '../../../../models/incident-executive-summary-report';

@Component({
  selector: 'app-incident-executive-summary-report', standalone: true, imports: [CommonModule],
  templateUrl: './incident-executive-summary-report.html', styleUrl: './incident-executive-summary-report.css'
})
export class IncidentExecutiveSummaryReport implements OnChanges, OnDestroy {
  @Input() datos!: IncidentExecutiveSummaryData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<ExecutiveSummaryRenderError>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  readonly iconos = {
    servidores: 'M5 3h18v6H5zm0 10h18v6H5zm4-7h1m-1 10h1M14 6h6m-6 10h6M14 19v6m-6 0h12',
    dona: 'M13 3a11 11 0 1 0 11 12H13V3Zm4 0v8h8a10 10 0 0 0-8-8Z', comparacion: 'M4 3v22h21M8 7h14M8 11h10M8 17h14M8 21h10',
    hallazgos: 'M10 21h8m-7 4h6M9 17c-7-7-2-14 5-14s12 7 5 14l-1 3h-8l-1-3Z', ejecutivo: 'M7 3h12v21H4V6h3m0-3v3h9V3M8 12l3 3 6-6M8 20h8'
  };
  maxServidor = 1;
  maxComparacion = 1;
  fuenteTotal = 26;
  filtros: string[] = [];
  segmentos: { nombre: string; cantidad: number; porcentaje: number; color: string; trazo: string; offset: number }[] = [];
  private revision = 0;
  private cancelar?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision; this.cancelar?.(); if (!this.datos) return;
    const d = this.datos, f = d.filtros;
    this.maxServidor = Math.max(1, ...d.servidores.map(i => i.incidentes));
    this.maxComparacion = Math.max(1, ...d.ajustada.comparacion.flatMap(i => [i.tickets_originales, i.tickets_ajustados]));
    this.fuenteTotal = Math.min(26, 160 / this.numero(d.atribuidos).length);
    this.filtros = ([['Prioridad', f.prioridad], ['Motivo de estado', f.motivo_estado], ['Motivo de resolución', f.motivo_resolucion],
    ['Resolutor', f.nombre_resolutor], ['Descripción', f.descripcion], ['Mes', f.periodo], ['Detalle', f.detalle_id], ['Ticket', f.ticket_id],
    ['Proyectos excluidos', f.proyectos_excluidos?.join(', ')]] as const).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`);
    let acumulado = 0; const circunferencia = Math.PI * 2 * 62;
    this.segmentos = d.ajustada.distribucion_original.map(i => {
      const longitud = d.atribuidos ? i.tickets / d.atribuidos * circunferencia : 0;
      const segmento = { nombre: this.nombre(i.atribucion), cantidad: i.tickets, porcentaje: i.porcentaje, color: i.atribucion === 'Atribuible a Cliente' ? '#FF620F' : '#16835B', trazo: `${longitud} ${circunferencia}`, offset: -acumulado };
      acumulado += longitud; return segmento;
    });
    void this.esperarRender(revision, d.version);
  }
  partes(texto: string): { texto: string; destacado: boolean }[] {
    return texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g).filter(Boolean).map(t => ({ texto: t, destacado: /\d/.test(t) }));
  }
  nombre(s: string): string { return s === 'Atribuible a Cliente' ? 'Cliente' : s === 'Atribuible a Canvia' ? 'Canvia' : s; }
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  porcentaje(n: number): string { return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fecha(s?: string): string { return s ? s.split('-').reverse().join('/') : '—'; }
  private async esperarRender(revision: number, version: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined, cancelar: (() => void) | undefined;
    try {
      await Promise.race([
        (async () => { await document.fonts?.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); })(),
        new Promise<never>((_, reject) => { cancelar = () => reject(new Error('cancelado')); this.cancelar = cancelar; timer = setTimeout(() => reject(new Error('render')), 30000); }),
      ]);
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth !== 1400 || el.scrollHeight <= 0) throw new Error('render');
      if (el.scrollHeight >= 1400 || this.fuenteTotal < 14 || !this.legible(el)) throw new Error('legibilidad');
      this.renderizado.emit(version);
    } catch (e) { if (revision === this.revision) this.errorRenderizado.emit({ version, motivo: e instanceof Error && e.message === 'legibilidad' ? 'legibilidad' : 'render' }); }
    finally { clearTimeout(timer); if (this.cancelar === cancelar) this.cancelar = undefined; }
  }
  private legible(el: HTMLElement): boolean {
    const svg = el.querySelector<SVGSVGElement>('.summary-donut');
    if (!svg || typeof svg.getBBox !== 'function') return true; // DOM unitario sin métricas reales.
    const tarjetas = Array.from(el.querySelectorAll<HTMLElement>('.chart-card'));
    if (tarjetas.some(t => Math.abs(t.getBoundingClientRect().y - tarjetas[0].getBoundingClientRect().y) > 1)) return false;
    const marco = svg.getBoundingClientRect(), textos = Array.from(svg.querySelectorAll('text')).map(t => t.getBoundingClientRect());
    if (textos.some(t => t.left < marco.left || t.right > marco.right || t.top < marco.top || t.bottom > marco.bottom)) return false;
    for (let i = 0; i < textos.length; i++) for (let j = i + 1; j < textos.length; j++) {
      if (Math.min(textos[i].right, textos[j].right) - Math.max(textos[i].left, textos[j].left) > 1 && Math.min(textos[i].bottom, textos[j].bottom) - Math.max(textos[i].top, textos[j].top) > 1) return false;
    }
    return !Array.from(el.querySelectorAll<HTMLElement>('.report-panel,.kpi,.header-copy,.server-caption,.finding-copy,.summary-conclusion'))
      .some(e => e.scrollWidth > e.clientWidth + 1);
  }
  ngOnDestroy(): void { ++this.revision; this.cancelar?.(); }
}
