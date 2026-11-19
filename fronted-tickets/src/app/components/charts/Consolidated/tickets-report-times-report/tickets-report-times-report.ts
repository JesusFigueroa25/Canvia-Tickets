import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import {
  TicketsReportTimesGrafico,
  TicketsReportTimesReportData,
} from '../../../../models/tickets-report-times';
import { bloques, FilaTiempo, matrizTiempos } from './tickets-report-times-report.utils';

interface Barra {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  color: string;
  texto: string;
}
interface Grafico {
  periodos: string[];
  barras: Barra[];
  maximo: number;
  maximoSecundario?: number;
  leyenda: { nombre: string; color: string }[];
  compacto?: boolean;
}

@Component({
  selector: 'app-tickets-report-times-report',
  standalone: false,
  styleUrl: './tickets-report-times-report.css',
  templateUrl: './tickets-report-times-report.html',
})
export class TicketsReportTimesReport implements OnChanges, OnDestroy {
  @Input() datos!: TicketsReportTimesReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<number>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  private revision = 0;
  readonly coloresResolutores = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2',
    '#FF8A42',
    '#667085',
  ];
  readonly coloresProyectos = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2',
    '#B54708',
    '#667085',
  ];
  filtros: string[] = [];
  horasTotales = 0;
  resolutores: FilaTiempo[] = [];
  proyectos: FilaTiempo[] = [];
  mesesResolutores: string[][] = [];
  mesesProyectos: string[][] = [];
  volumen: Grafico[] = [];
  graficosProyectos: Grafico[] = [];
  bloquesResolutores: {
    periodos: string[];
    series: TicketsReportTimesGrafico['series'];
    maximo: number;
  }[] = [];

  ngOnChanges(): void {
    const revision = ++this.revision;
    if (!this.datos) return;
    try {
      const d = this.datos,
        f = d.filtros;
      this.filtros = [
        `Desde: ${this.fecha(f.desde)} · Hasta: ${this.fecha(f.hasta)}`,
        `Grupo: ${f.grupo_resolutor || 'Todos los grupos'}`,
        `Proyectos: ${f.todos_proyectos ? 'Todos los proyectos' : (f.proyectos ?? []).join(' · ')}`,
        `Mes de análisis: ${f.periodo ? this.mes(f.periodo) : 'Todos los meses'}`,
      ];
      this.horasTotales = d.volumenMensual
        .filter((m) => !f.periodo || m.periodo === f.periodo)
        .reduce((s, m) => s + m.horas_totales, 0);
      const r = matrizTiempos(d.detalleResolutores.items),
        p = matrizTiempos(d.detalleProyectos.items);
      this.resolutores = r.filas;
      this.proyectos = p.filas;
      this.mesesResolutores = bloques(r.periodos);
      this.mesesProyectos = bloques(p.periodos);
      this.volumen = bloques(d.volumenMensual).map((items) => {
        const maximo = Math.max(1, ...items.map((m) => m.tickets));
        const maximoSecundario = Math.max(1, ...items.map((m) => m.horas_totales));
        const paso = 1080 / items.length;
        return {
          periodos: items.map((m) => m.periodo),
          maximo,
          maximoSecundario,
          leyenda: [
            { nombre: 'Tickets', color: '#FF620F' },
            { nombre: 'Horas', color: '#16835B' },
          ],
          barras: items.flatMap((m, i) => [
            {
              x: 90 + paso * (i + 0.5) - 36,
              y: 330 - (m.tickets / maximo) * 230,
              ancho: 32,
              alto: (m.tickets / maximo) * 230,
              color: !f.periodo || m.periodo === f.periodo ? '#FF620F' : '#FFD3BC',
              texto: this.numero(m.tickets),
            },
            {
              x: 90 + paso * (i + 0.5) + 4,
              y: 330 - (m.horas_totales / maximoSecundario) * 230,
              ancho: 32,
              alto: (m.horas_totales / maximoSecundario) * 230,
              color: !f.periodo || m.periodo === f.periodo ? '#16835B' : '#B8DDCE',
              texto: this.horas(m.horas_totales),
            },
          ]),
        };
      });
      const series = [...d.graficoResolutores.series].sort(
        (a, b) => b.horas_totales - a.horas_totales || a.nombre.localeCompare(b.nombre, 'es'),
      );
      this.bloquesResolutores = bloques(d.graficoResolutores.periodos).map((periodos) => ({
        periodos,
        series,
        maximo: Math.max(1, ...series.map((s) => this.totalBloque(s, periodos))),
      }));
      this.graficosProyectos = bloques(d.graficoProyectos.periodos).map((periodos) =>
        this.graficoProyecto(d.graficoProyectos, periodos),
      );
      void this.esperarRender(revision, d.version);
    } catch {
      this.errorRenderizado.emit(this.datos.version);
    }
  }

  private graficoProyecto(g: TicketsReportTimesGrafico, periodos: string[]): Grafico {
    const maximo = Math.max(
      1,
      ...g.series.flatMap((s) => periodos.map((p) => this.horasMes(s, p))),
    );
    const paso = 1080 / periodos.length;
    const ancho = Math.min(36, (paso * 0.8) / Math.max(1, g.series.length));
    return {
      periodos,
      maximo,
      compacto: g.series.length > 3,
      leyenda: g.series.map((s, i) => ({
        nombre: this.proyecto(s.nombre),
        color: this.coloresProyectos[i % 10],
      })),
      barras: periodos.flatMap((p, i) =>
        g.series.map((s, j) => {
          const valor = this.horasMes(s, p);
          return {
            x: 90 + paso * (i + 0.5) - (ancho * g.series.length) / 2 + j * ancho,
            y: 330 - (valor / maximo) * 230,
            ancho: ancho * 0.85,
            alto: (valor / maximo) * 230,
            color: this.coloresProyectos[j % 10],
            texto: valor > 0 ? this.horas(valor) : '',
          };
        }),
      ),
    };
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    try {
      await document.fonts?.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth <= 0 || el.scrollHeight <= 0) throw new Error('dimensiones');
      this.renderizado.emit(version);
    } catch {
      if (revision === this.revision) this.errorRenderizado.emit(version);
    }
  }
  ngOnDestroy(): void {
    ++this.revision;
  }
  numero(n: number): string {
    return n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
  }
  horas(n: number): string {
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  }
  fecha(f?: string): string {
    return f ? f.split('-').reverse().join('/') : 'Sin límite';
  }
  mes(p: string): string {
    const [anio, mes] = p.split('-').map(Number);
    return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(
      new Date(anio, mes - 1, 1),
    );
  }
  proyecto(p: string): string {
    return p.replace(/^\d{6}\s+/, '').trim();
  }
  horasMes(s: TicketsReportTimesGrafico['series'][number], p: string): number {
    return s.mensual.find((m) => m.periodo === p)?.horas ?? 0;
  }
  totalBloque(s: TicketsReportTimesGrafico['series'][number], periodos: string[]): number {
    return periodos.reduce((t, p) => t + this.horasMes(s, p), 0);
  }
  inicioSegmento(
    s: TicketsReportTimesGrafico['series'][number],
    periodos: string[],
    indice: number,
  ): number {
    return periodos.slice(0, indice).reduce((t, p) => t + this.horasMes(s, p), 0);
  }
  lineas(nombre: string): string[] {
    const palabras = nombre
        .trim()
        .split(/\s+/)
        .flatMap((p) => p.match(/.{1,40}/gu) ?? []),
      resultado: string[] = [];
    let linea = '';
    for (const palabra of palabras) {
      if ((linea + ' ' + palabra).length > 40 && linea) {
        resultado.push(linea);
        linea = '';
      }
      linea = (linea ? linea + ' ' : '') + palabra;
    }
    if (linea) resultado.push(linea);
    return resultado;
  }
  altoFila(nombre: string): number {
    return Math.max(52, this.lineas(nombre).length * 17 + 14);
  }
  inicioFila(series: TicketsReportTimesGrafico['series'], indice: number): number {
    return series.slice(0, indice).reduce((t, s) => t + this.altoFila(s.nombre), 0);
  }
  altoResolutores(series: TicketsReportTimesGrafico['series']): number {
    return this.inicioFila(series, series.length) + 20;
  }
  totalMes(filas: FilaTiempo[], p: string): number {
    return filas.reduce((t, f) => t + (f.mensual[p] ?? 0), 0);
  }
  totalFilas(filas: FilaTiempo[]): number {
    return filas.reduce((t, f) => t + f.total, 0);
  }
}
