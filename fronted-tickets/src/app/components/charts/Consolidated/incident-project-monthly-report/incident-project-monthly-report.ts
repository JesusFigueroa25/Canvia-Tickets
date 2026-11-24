import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { IncidentProjectMonthlyRenderError, IncidentProjectMonthlyReportData } from '../../../../models/incident-project-monthly-report';

interface BarraMensual { x: number; y: number; ancho: number; alto: number; centro: number; valor: number; mes: string; anio: string; estado: string; }
interface VariacionMensualVisual {
  mes: string;
  referencia: string;
  tipo: 'aumento' | 'reduccion' | 'cero' | 'no_comparable';
  valor: string;
  noCalculable: boolean;
}

@Component({
  selector: 'app-incident-project-monthly-report', standalone: false,
  templateUrl: './incident-project-monthly-report.html', styleUrl: './incident-project-monthly-report.css',
})
export class IncidentProjectMonthlyReport implements OnChanges, OnDestroy {
  @Input() datos!: IncidentProjectMonthlyReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<IncidentProjectMonthlyRenderError>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  readonly colores = ['#FF620F', '#E8AD24', '#16835B', '#63B891', '#D97706', '#12633F', '#F1C450', '#419F74', '#EE8C23', '#9EB64B', '#268C62', '#C7A232', '#E2762F', '#77A845', '#F2A14A', '#367D4C', '#D6BA38', '#55AE83'];
  readonly fracciones = [0, 0.25, 0.5, 0.75, 1];
  variacionesVisuales: VariacionMensualVisual[] = [];
  barras: BarraMensual[] = [];
  hallazgos: { partes: { texto: string; destacado: boolean }[] }[] = [];
  filtros: string[] = [];
  periodo = '';
  maximo = 4;
  izquierda = 90;
  base = 310;
  altoSvg = 400;
  valoresVerticales = false;
  mesesVerticales = false;
  fuenteValor = 18;
  legible = false;
  private revision = 0;
  private cancelarRender?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision;
    this.cancelarRender?.();
    if (!this.datos) return;
    const d = this.datos, meses = d.mensual.meses, f = d.filtros;
    // Presentación de todos los meses; las tasas provienen del análisis aprobado.
    // El primer mes no tiene referencia previa dentro del rango.
    const variaciones = new Map(d.mensual.variaciones.map(v => [`${v.desde.periodo}/${v.hasta.periodo}`, v]));
    this.variacionesVisuales = meses.map((m, i): VariacionMensualVisual => {
      const anterior = meses[i - 1];
      const v = anterior ? variaciones.get(`${anterior.periodo}/${m.periodo}`) : undefined;
      return { mes: m.etiqueta,
        referencia: anterior ? `${anterior.etiqueta} → ${m.etiqueta}` : 'Sin mes anterior dentro del rango',
        tipo: !v ? 'no_comparable' : v.diferencia > 0 ? 'aumento' : v.diferencia < 0 ? 'reduccion' : 'cero',
        valor: !v ? 'No comparable' : v.porcentaje === null ? 'No calculable' : `${this.porcentaje(v.porcentaje)} %`,
        noCalculable: !v || v.porcentaje === null };
    });
    const mes = (fecha: string) => new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha.slice(0, 7)}-01T00:00:00Z`));
    this.periodo = `${mes(f.desde!)} a ${mes(f.hasta!)}`;
    this.filtros = [
      `Fechas: ${f.desde} — ${f.hasta}`,
      ...([['Prioridad', f.prioridad], ['Motivo de estado', f.motivo_estado], ['Motivo de resolución', f.motivo_resolucion],
        ['Proyectos excluidos', f.proyectos_excluidos?.join(', ')]] as const).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`),
    ];
    this.hallazgos = d.hallazgos.map(texto => ({ partes: texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g).filter(Boolean)
      .map(parte => ({ texto: parte, destacado: /\d/.test(parte) })) }));
    this.maximo = Math.max(4, Math.ceil((d.mensual.maximos[0]?.tickets ?? 0) / 4) * 4);
    this.izquierda = Math.max(90, this.numero(this.maximo).length * 9 + 18);
    const espacio = (980 - this.izquierda) / Math.max(1, meses.length);
    const caracteres = this.numero(d.mensual.maximos[0]?.tickets ?? 0).length;
    this.valoresVerticales = caracteres * 18 * 0.62 + 8 > espacio;
    this.mesesVerticales = espacio < 43;
    this.fuenteValor = this.valoresVerticales ? 14 : 18;
    const techo = this.valoresVerticales ? Math.max(70, caracteres * this.fuenteValor * 0.65 + 24) : 55;
    this.base = techo + 240;
    this.altoSvg = this.base + (this.mesesVerticales ? 120 : 85);
    // 20 unidades del SVG dejan separación con fuente mínima de 14 (≈12 px CSS).
    this.legible = meses.length > 0 && espacio >= 20;
    this.barras = this.legible ? meses.map((m, i) => {
      const centro = this.izquierda + (i + 0.5) * espacio, alto = m.tickets / this.maximo * 240;
      const ancho = Math.min(76, espacio * 0.7);
      return { x: centro - ancho / 2, y: this.base - alto, ancho, alto, centro, valor: m.tickets,
        mes: m.etiqueta.split(' ')[0], anio: m.periodo.slice(0, 4), estado: m.estado };
    }) : [];
    void this.esperarRender(revision, d.version);
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let cancelar: (() => void) | undefined;
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
      if (!this.legible || el.scrollHeight >= 1400 || !this.textosLegibles(el)) throw new Error('legibilidad');
      this.renderizado.emit(version);
    } catch (error) {
      if (revision === this.revision) this.errorRenderizado.emit({ version, motivo: error instanceof Error && error.message === 'legibilidad' ? 'legibilidad' : 'render' });
    } finally {
      clearTimeout(temporizador); if (this.cancelarRender === cancelar) this.cancelarRender = undefined;
    }
  }

  /** En navegador se comprueban cajas reales, incluidas las etiquetas giradas 90°. */
  private textosLegibles(el: HTMLElement): boolean {
    const svg = el.querySelector<SVGSVGElement>('.project-monthly-chart');
    if (!svg || typeof svg.getBBox !== 'function') return true; // DOM de pruebas sin métricas SVG.
    const marco = svg.getBoundingClientRect();
    const cajas = Array.from(svg.querySelectorAll('text')).filter(t => !!t.textContent?.trim()).map(t => t.getBoundingClientRect());
    for (let i = 0; i < cajas.length; i++) {
      const a = cajas[i];
      if (a.left < marco.left - 1 || a.right > marco.right + 1 || a.top < marco.top - 1 || a.bottom > marco.bottom + 1) return false;
      for (let j = i + 1; j < cajas.length; j++) {
        const b = cajas[j];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) return false;
      }
    }
    return !Array.from(el.querySelectorAll<HTMLElement>('.kpi,.report-panel,.header-copy,.project-name')).some(e => e.scrollWidth > e.clientWidth + 1);
  }

  ngOnDestroy(): void { ++this.revision; this.cancelarRender?.(); }
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  porcentaje(n: number): string { return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  color(i: number): string { return this.colores[i % this.colores.length]; }
  gradiente(i: number): string { return `r03-${this.datos.version}-${i}`; }
}
