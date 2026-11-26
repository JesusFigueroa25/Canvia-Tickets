import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { RequirementCategorizationReportData } from '../../../../models/requirement-categorization-audit';
import { analizarCategorizacion, AuditExecutiveAnalysis, AuditReportRenderError, etiquetaMes, nombreColaborador, topIncorrectas, validarReporteCategorizacion } from './requirement-categorization-report.utils';

interface Segmento { nombre: string; cantidad: number; porcentaje: number; color: string; trazo: string; offset: number; }
interface BarraMes { codigo: string; etiqueta: string; x: number; ancho: number; y: number; altoCorrectas: number; altoIncorrectas: number; total: number; correctas: number; incorrectas: number; }

@Component({ selector: 'app-requirement-categorization-report', standalone: false,
  styleUrl: './requirement-categorization-report.css', templateUrl: './requirement-categorization-report.html' })
export class RequirementCategorizationReport implements OnChanges, OnDestroy {
  @Input() datos!: RequirementCategorizationReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<AuditReportRenderError>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  readonly iconos = { dona: 'M13 3a11 11 0 1 0 11 12H13V3Zm4 0v8h8a10 10 0 0 0-8-8Z',
    barras: 'M4 3v22h21M8 7h14M8 11h10M8 17h14M8 21h10', mensual: 'M4 3v22h21M8 21V9h4v12m5 0V5h4v16',
    hallazgos: 'M10 21h8m-7 4h6M9 17c-7-7-2-14 5-14s12 7 5 14l-1 3h-8l-1-3Z', ejecutivo: 'M7 3h12v21H4V6h3m0-3v3h9V3M8 12l3 3 6-6M8 20h8' };
  categorizaciones: Segmento[] = [];
  motivos: Segmento[] = [];
  filtros: string[] = [];
  periodo = '';
  meses: RequirementCategorizationReportData['meses'] = [];
  top: RequirementCategorizationReportData['resolutores'] = [];
  analisis: AuditExecutiveAnalysis = { hallazgos: [], conclusion: '', recomendaciones: [] };
  maxTop = 1;
  maxMes = 1;
  fuenteTotal = 26;
  barras: BarraMes[] = [];
  marcas: { valor: number; y: number }[] = [];
  altoMensual = 320;
  sueloMensual = 220;
  yMes = 240;
  yValores = 280;
  fuenteMes = 12;
  fuenteTotales = 12;
  fuenteValores = 12;
  mesesEnDosLineas = false;
  valoresEnDosLineas = false;
  private legibilidadMeses = true;
  private revision = 0;
  private cancelarRender?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision; this.cancelarRender?.(); if (!this.datos) return;
    try {
      validarReporteCategorizacion(this.datos);
      const { resumen: r, filtros: f } = this.datos;
      this.meses = [...this.datos.meses].sort((a, b) => a.month.localeCompare(b.month));
      this.top = topIncorrectas(this.datos.resolutores);
      this.analisis = analizarCategorizacion(this.datos);
      const inicio = f.desde?.slice(0, 7) || this.meses[0]?.month, fin = f.hasta?.slice(0, 7) || this.meses.at(-1)?.month;
      this.periodo = inicio && fin ? etiquetaMes(inicio, true) + ' a ' + etiquetaMes(fin, true) : 'Sin períodos evaluados';
      this.filtros = ['Fechas: ' + this.fecha(f.desde) + ' — ' + this.fecha(f.hasta),
        ...(f.resultado ? ['Resultado: ' + (f.resultado === 'CORRECT' ? 'Correctas' : 'Incorrectas')] : []),
        ...(f.motivo_resolucion ? ['Motivo: ' + f.motivo_resolucion] : []),
        ...(f.mes ? ['Mes aplicado: ' + this.mes(f.mes)] : []),
        ...(f.nombre_resolutor ? ['Colaborador: ' + f.nombre_resolutor] : []), ...(f.ticket_id ? ['Ticket: ' + f.ticket_id] : [])];
      this.categorizaciones = this.segmentos([
        { nombre: 'Correctas', cantidad: r.correct_count, porcentaje: r.correct_percentage, color: '#16835B' },
        { nombre: 'Incorrectas', cantidad: r.incorrect_count, porcentaje: r.incorrect_percentage, color: '#D95C4F' }], r.processed_tickets);
      const paleta = ['#E8AD24', '#63B891', '#9467BD', '#3B89AC', '#D97706'];
      this.motivos = this.segmentos(this.datos.motivos.items.map((m, i) => ({ nombre: m.reason === 'SIN_DATO' ? 'Sin dato' : m.reason,
        cantidad: m.total_tickets, porcentaje: m.percentage,
        color: m.reason === 'Atribuible a Cliente' ? '#FF620F' : m.reason === 'Atribuible a Canvia' ? '#16835B' : m.reason === 'SIN_DATO' ? '#98A2B3' : paleta[i % paleta.length] })), r.processed_tickets);
      this.fuenteTotal = Math.min(26, 160 / this.numero(r.processed_tickets).length);
      this.maxTop = Math.max(1, ...this.top.map(i => i.total_tickets));
      this.prepararMensual();
      void this.esperarRender(revision, this.datos.version);
    } catch { this.errorRenderizado.emit({ version: this.datos.version, motivo: 'render' }); }
  }
  private segmentos(items: Omit<Segmento, 'trazo' | 'offset'>[], total: number): Segmento[] {
    let acumulado = 0; const circunferencia = Math.PI * 2 * 60;
    return items.map(s => { const largo = total ? s.cantidad / total * circunferencia : 0;
      const item = { ...s, trazo: largo + ' ' + circunferencia, offset: -acumulado }; acumulado += largo; return item; });
  }
  private prepararMensual(): void {
    this.maxMes = Math.max(1, ...this.meses.map(m => m.total_tickets));
    const espacio = 568 / Math.max(1, this.meses.length);
    const largoValores = Math.max(1, ...this.meses.map(m => (this.numero(m.correct_count) + ' / ' + this.numero(m.incorrect_count)).length));
    const largoTotal = Math.max(1, ...this.meses.map(m => this.numero(m.total_tickets).length));
    const largoCantidad = Math.max(1, ...this.meses.flatMap(m => [this.numero(m.correct_count).length, this.numero(m.incorrect_count).length]));
    const ajustarFuente = (caracteres: number) => Math.max(10, Math.min(12, (espacio - 4) / (caracteres * 0.62)));
    this.mesesEnDosLineas = espacio < 44;
    this.valoresEnDosLineas = largoValores * 7.2 > espacio - 6;
    this.fuenteMes = this.mesesEnDosLineas ? 10 : Math.max(10, Math.min(12, (espacio - 3) / 4.5));
    this.fuenteTotales = ajustarFuente(largoTotal);
    this.fuenteValores = ajustarFuente(this.valoresEnDosLineas ? largoCantidad : largoValores);
    this.sueloMensual = 35 + 180; this.yMes = this.sueloMensual + 22;
    this.yValores = this.yMes + (this.mesesEnDosLineas ? 34 : 22);
    this.altoMensual = this.yValores + (this.valoresEnDosLineas ? 32 : 20);
    this.legibilidadMeses = espacio >= 15;
    this.barras = this.meses.map((m, i) => ({ codigo: m.month, etiqueta: this.mes(m.month).replace('.', '').replace(/^./, c => c.toUpperCase()), x: 58 + espacio * (i + 0.5), ancho: Math.min(30, espacio * 0.65),
      y: this.sueloMensual - m.total_tickets / this.maxMes * 180, altoCorrectas: m.correct_count / this.maxMes * 180,
      altoIncorrectas: m.incorrect_count / this.maxMes * 180, total: m.total_tickets, correctas: m.correct_count, incorrectas: m.incorrect_count }));
    this.marcas = [...new Set([0, 1, 2, 3, 4].map(i => Math.round(this.maxMes * i / 4)))].map(valor => ({ valor, y: this.sueloMensual - valor / this.maxMes * 180 }));
  }
  private async esperarRender(revision: number, version: number): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined, cancelar: (() => void) | undefined;
    try {
      await Promise.race([(async () => { await document.fonts?.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); })(),
        new Promise<never>((_, reject) => { cancelar = () => reject(new Error('cancelado')); this.cancelarRender = cancelar; temporizador = setTimeout(() => reject(new Error('render')), 30000); })]);
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth !== 1400 || el.scrollHeight <= 0) throw new Error('render');
      if (el.scrollHeight >= 1400 || !this.legibilidadMeses || this.fuenteTotal < 14 || !this.textosLegibles(el)) throw new Error('legibilidad');
      this.renderizado.emit(version);
    } catch (e) { if (revision === this.revision) this.errorRenderizado.emit({ version, motivo: e instanceof Error && e.message === 'legibilidad' ? 'legibilidad' : 'render' }); }
    finally { clearTimeout(temporizador); if (this.cancelarRender === cancelar) this.cancelarRender = undefined; }
  }
  private textosLegibles(el: HTMLElement): boolean {
    const grafico = el.querySelector<SVGSVGElement>('.monthly-chart');
    if (!grafico || typeof grafico.getBBox !== 'function') return true;
    const paneles = Array.from(el.querySelectorAll<HTMLElement>('.charts-grid > .report-panel')).map(p => p.getBoundingClientRect());
    if (paneles.length !== 4 || Math.abs(paneles[0].y - paneles[1].y) > 1 || Math.abs(paneles[2].y - paneles[3].y) > 1 || paneles[2].y < paneles[0].bottom) return false;
    for (const svg of Array.from(el.querySelectorAll<SVGSVGElement>('svg.data-chart'))) {
      const marco = svg.getBoundingClientRect(), cajas = Array.from(svg.querySelectorAll('text')).map(t => t.getBoundingClientRect());
      if (cajas.some(c => c.left < marco.left - 1 || c.right > marco.right + 1 || c.top < marco.top - 1 || c.bottom > marco.bottom + 1)) return false;
      for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
        if (Math.min(cajas[i].right, cajas[j].right) - Math.max(cajas[i].left, cajas[j].left) > 1 && Math.min(cajas[i].bottom, cajas[j].bottom) - Math.max(cajas[i].top, cajas[j].top) > 1) return false;
      }
    }
    return !Array.from(el.querySelectorAll<HTMLElement>('.report-panel,.kpi,.header-copy,.resolver-name,.reason-label,.finding-copy')).some(e => e.scrollWidth > e.clientWidth + 1);
  }
  partes(texto: string): { texto: string; destacado: boolean }[] { return texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g).filter(Boolean).map(texto => ({ texto, destacado: /\d/.test(texto) })); }
  ngOnDestroy(): void { ++this.revision; this.cancelarRender?.(); }
  nombre = nombreColaborador;
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  porcentaje(n: number): string { return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fecha(s?: string): string { return s ? s.split('-').reverse().join('/') : 'Sin límite'; }
  mes(s: string): string { return etiquetaMes(s); }
}
