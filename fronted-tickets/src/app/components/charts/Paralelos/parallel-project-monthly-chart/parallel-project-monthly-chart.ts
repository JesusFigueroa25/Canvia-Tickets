import { ChangeDetectorRef, Component, HostListener, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { BaseChartDirective } from 'ng2-charts';
import { TicketsParallelProjectItem } from '../../../../models/tickets-manual-updates';
import { construirFilasProyectos, FilaProyectoParalelo, nombreMesProyecto, ordenarFilasProyectos, periodosProyectos, TipoLocalProyecto } from '../parallel-project-view.utils';

@Component({
  selector: 'app-parallel-project-monthly-chart',
  standalone: false,
  styleUrl: './parallel-project-monthly-chart.css',
  templateUrl: './parallel-project-monthly-chart.html'
})
export class ParallelProjectMonthlyChart implements OnChanges {
  @Input() datos: readonly TicketsParallelProjectItem[] = [];
  @Input() desde: string | null = null;
  @Input() hasta: string | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @ViewChild(BaseChartDirective) private directivaGrafico?: BaseChartDirective;

  readonly chartPlugins = [ChartDataLabels];
  readonly limiteRanking = 10;
  private readonly colores = ['#FF620F', '#16835B', '#FFB184', '#63B891', '#D97706', '#F4C95D', '#12633F', '#A8DCC2', '#B54708', '#667085'];
  private coloresProyecto = new Map<string, string>();
  tipo: TipoLocalProyecto = '';
  busqueda = '';
  periodos: string[] = [];
  seriesVisibles: FilaProyectoParalelo[] = [];
  totalCoincidentes = 0;
  expandido = false;
  errorPantallaCompleta: string | null = null;
  private elementoExpandido?: HTMLElement;

  chartData: ChartData<'bar', number[], string> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: true },
    animation: { duration: 200 },
    layout: { padding: { top: 28, right: 12, bottom: 6, left: 8 } },
    plugins: {
      legend: { display: true, position: 'bottom', align: 'start', labels: { color: '#475467', usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 11, padding: 15, font: { size: 11 } } },
      datalabels: {
        display: c => Number(c.dataset.data[c.dataIndex] ?? 0) > 0 ? 'auto' : false,
        color: '#344054', anchor: 'end', align: 'end', offset: 2, clamp: true, clip: false,
        font: { size: 10, weight: 'bold' }, formatter: (v: number) => v.toLocaleString('es-PE')
      },
      tooltip: {
        backgroundColor: '#101828', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', padding: 12, cornerRadius: 8,
        callbacks: {
          title: items => nombreMesProyecto(this.periodos[items[0]?.dataIndex ?? -1] ?? ''),
          label: c => {
            const fila = this.seriesVisibles[c.datasetIndex];
            return [`Proyecto: ${fila?.nombre ?? ''}`, `ALP: ${fila?.alp ?? 'Sin especificar'}`, `Tickets en paralelo: ${Number(c.parsed.y ?? 0).toLocaleString('es-PE')}`];
          },
          afterLabel: c => `Acumulado mensual del proyecto: ${(this.seriesVisibles[c.datasetIndex]?.total ?? 0).toLocaleString('es-PE')}`
        }
      }
    },
    scales: {
      x: { stacked: false, grid: { display: false }, border: { display: false }, ticks: { color: '#667085', maxRotation: 0, autoSkip: false, font: { size: 11 } } },
      y: { stacked: false, beginAtZero: true, grace: '20%', grid: { color: '#EEF1F5' }, border: { display: false }, ticks: { color: '#667085', precision: 0 }, title: { display: true, text: 'Tickets en paralelo', color: '#667085', font: { size: 11 } } }
    }
  };

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['desde'] || changes['hasta']) {
      this.periodos = periodosProyectos(this.datos, this.desde, this.hasta);
      this.coloresProyecto = new Map();
      const nombres = ordenarFilasProyectos(construirFilasProyectos(this.datos, this.periodos, ''), 'total', true);
      nombres.forEach((fila, i) => this.coloresProyecto.set(fila.nombre, this.colores[i % this.colores.length]));
      this.actualizarGrafico();
    }
  }
  get sinDatos(): boolean { return !this.seriesVisibles.length || !this.periodos.length; }
  get anchoMinimoGrafico(): number { return Math.max(780, this.periodos.length * Math.max(180, this.seriesVisibles.length * 32 + 55) + 75); }
  get textoPeriodo(): string {
    if (!this.periodos.length) return 'Sin período';
    const inicio = nombreMesProyecto(this.periodos[0]);
    const fin = nombreMesProyecto(this.periodos[this.periodos.length - 1]);
    return inicio === fin ? inicio : `${inicio} - ${fin}`;
  }
  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'Incident' || valor === 'Service Request') { this.tipo = valor; this.actualizarGrafico(); }
  }
  buscar(evento: Event): void { this.busqueda = (evento.target as HTMLInputElement).value; this.actualizarGrafico(); }
  limpiarBusqueda(): void { this.busqueda = ''; this.actualizarGrafico(); }
  private actualizarGrafico(): void {
    const filas = ordenarFilasProyectos(construirFilasProyectos(this.datos, this.periodos, this.tipo, this.busqueda), 'total', true);
    this.totalCoincidentes = filas.length;
    const nuevas = filas.slice(0, this.limiteRanking);
    if (JSON.stringify(this.seriesVisibles.map(f => f.nombre)) !== JSON.stringify(nuevas.map(f => f.nombre))) {
      const chart = this.directivaGrafico?.chart;
      chart?.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, true));
    }
    this.seriesVisibles = nuevas;
    // Evitar colores repetidos entre los diez proyectos mostrados, incluso al buscar.
    const usados = new Set<string>();
    const datasets = nuevas.map(fila => {
      let color = this.coloresProyecto.get(fila.nombre) ?? this.colores[0];
      if (usados.has(color)) color = this.colores.find(c => !usados.has(c)) ?? color;
      usados.add(color);
      return { label: fila.nombre, data: this.periodos.map(p => fila.mensual[p] ?? 0), backgroundColor: color, borderColor: color, borderWidth: 0, borderRadius: 4, borderSkipped: false as const, maxBarThickness: 38, categoryPercentage: 0.85, barPercentage: 0.88 };
    });
    this.chartData = { labels: this.periodos.map(p => nombreMesProyecto(p, true)), datasets };
  }
  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    this.elementoExpandido = elemento; this.errorPantallaCompleta = null;
    try { if (document.fullscreenElement === elemento) await document.exitFullscreen(); else await elemento.requestFullscreen(); }
    catch { this.errorPantallaCompleta = 'No se pudo activar la pantalla completa.'; this.cdr.markForCheck(); }
  }
  @HostListener('document:fullscreenchange') actualizarPantallaCompleta(): void {
    this.expandido = !!this.elementoExpandido && document.fullscreenElement === this.elementoExpandido;
    this.directivaGrafico?.chart?.resize(); this.cdr.markForCheck();
  }
}
