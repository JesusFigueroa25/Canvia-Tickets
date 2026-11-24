import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { IncidentMonthlyMonth, IncidentMonthlyReportData } from '../../../../models/incident-monthly-report';
import { etiquetasFiltrosMensuales } from './incident-monthly-report.utils';

@Component({
  selector: 'app-incident-monthly-report',
  standalone: false,
  styleUrl: './incident-monthly-report.css',
  templateUrl: './incident-monthly-report.html',
})
export class IncidentMonthlyReport implements OnChanges, OnDestroy {
  @Input() datos!: IncidentMonthlyReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<number>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  filtros: string[] = [];
  periodoEncabezado = '';
  readonly coloresBarras = [
    '#FF620F', '#E8AD24', '#16835B', '#77A845', '#EE8C23', '#D6BA38',
    '#419F74', '#12633F', '#D97706', '#9EB64B', '#F1C450', '#55AE83',
    '#E2762F', '#C7A232', '#268C62', '#A1BF69', '#F2A14A', '#367D4C',
  ];
  hallazgosVisuales: { texto: string; partes: { texto: string; destacado: boolean }[] }[] = [];
  bloques: { meses: readonly IncidentMonthlyMonth[]; inicio: number }[] = [];
  maximo = 1;
  private revision = 0;
  private cancelarRender?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision;
    this.cancelarRender?.();
    if (!this.datos) return;
    this.filtros = etiquetasFiltrosMensuales(this.datos).filter(filtro => !filtro.startsWith('Grupo resolutor:'));
    const inicio = this.datos.filtros.desde?.slice(0, 7) ?? this.datos.meses[0]?.periodo;
    const fin = this.datos.filtros.hasta?.slice(0, 7) ?? this.datos.meses.at(-1)?.periodo;
    this.periodoEncabezado = `${this.nombreMes(inicio)} a ${this.nombreMes(fin)}`;
    this.maximo = Math.max(1, Math.ceil((this.datos.maximos[0]?.tickets ?? 0) / 4) * 4);
    this.hallazgosVisuales = this.datos.hallazgos.map(texto => ({
      texto,
      partes: texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g).filter(Boolean)
        .map(parte => ({ texto: parte, destacado: /\d/.test(parte) })),
    }));
    this.bloques = [];
    // Distribución visual equilibrada: evita un segundo gráfico de solo uno o dos meses.
    // Los conteos extensos necesitan más espacio para conservar todas sus cifras legibles.
    const caracteres = this.numero(this.datos.maximos[0]?.tickets ?? 0).length;
    const limite = Math.max(1, Math.min(18, Math.floor(888 / (18 * caracteres * 0.65 + 10))));
    const cantidadBloques = Math.max(1, Math.ceil(this.datos.meses.length / limite));
    const porBloque = Math.max(1, Math.ceil(this.datos.meses.length / cantidadBloques));
    for (let i = 0; i < this.datos.meses.length; i += porBloque) {
      this.bloques.push({ meses: this.datos.meses.slice(i, i + porBloque), inicio: i + 1 });
    }
    void this.esperarRender(revision, this.datos.version);
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let cancelar: (() => void) | undefined;
    try {
      await Promise.race([
        (async () => {
          await document.fonts?.ready;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        })(),
        new Promise<never>((_, reject) => {
          cancelar = () => reject(new Error('render-cancelado'));
          this.cancelarRender = cancelar;
          temporizador = setTimeout(() => reject(new Error('render-timeout')), 30000);
        }),
      ]);
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth !== 1400 || el.scrollHeight <= 0) throw new Error('dimensiones');
      this.renderizado.emit(version);
    } catch {
      if (revision === this.revision) this.errorRenderizado.emit(version);
    } finally {
      clearTimeout(temporizador);
      if (this.cancelarRender === cancelar) this.cancelarRender = undefined;
    }
  }

  ngOnDestroy(): void { ++this.revision; this.cancelarRender?.(); }
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  fecha(valor?: string | null): string { return valor ? valor.split('-').reverse().join('/') : 'Sin límite conocido'; }
  private nombreMes(periodo?: string): string {
    return periodo ? new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${periodo}-01T00:00:00Z`)) : 'Sin límite conocido';
  }
  colorBarra(indice: number): string { return this.coloresBarras[indice % this.coloresBarras.length]; }
  colorClaro(indice: number): string {
    const color = this.colorBarra(indice).slice(1);
    const canales = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16));
    return `rgb(${canales.map(canal => Math.round(canal + (255 - canal) * 0.38)).join(',')})`;
  }
  gradienteId(indice: number): string { return `r01-barra-${this.datos.version}-${indice}`; }
  tamanoValor(cantidad: number, valor: number): number {
    return Math.min(22, Math.max(14, (888 / cantidad - 6) / (this.numero(valor).length * 0.65)));
  }
  tipoHallazgo(texto: string): string {
    if (texto.startsWith('Mayor crecimiento')) return 'crecimiento';
    if (texto.startsWith('Mayor reducción')) return 'reduccion';
    if (texto.startsWith('Variación general')) return 'general';
    return 'maximo';
  }
  iconoHallazgo(texto: string): string {
    switch (this.tipoHallazgo(texto)) {
      case 'crecimiento': return 'M4 17l6-6 4 4 6-10M14 5h6v6';
      case 'reduccion': return 'M4 7l6 6 4-4 6 10M14 19h6v-6';
      case 'general': return 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4';
      default: return 'M8 3h8v7a4 4 0 0 1-8 0V3Zm8 2h4v3a4 4 0 0 1-4 4M8 5H4v3a4 4 0 0 0 4 4m4 2v6m-4 0h8';
    }
  }
  centro(i: number, cantidad: number): number { return 88 + (i + 0.5) * 888 / cantidad; }
  ancho(cantidad: number): number { return Math.min(76, 888 / cantidad * 0.76); }
  altura(n: number): number { return n / this.maximo * 230; }
}
