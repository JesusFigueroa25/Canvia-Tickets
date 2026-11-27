import { ChangeDetectorRef, Component, HostListener, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { BaseChartDirective } from 'ng2-charts';
import { TicketsParallelResolverItem } from '../../../../models/tickets-manual-updates';
import { construirFilasResolutores, FilaResolutorParalelo, nombreMesParalelo, ordenarFilasResolutores, periodosResolutores, TipoLocalParalelo } from '../parallel-resolver-view.utils';

@Component({
  selector: 'app-parallel-resolver-ranking-chart',
  standalone: false,
  templateUrl: './parallel-resolver-ranking-chart.html',
  styleUrl: './parallel-resolver-ranking-chart.css'
})
export class ParallelResolverRankingChart implements OnChanges {
  @Input() datos: readonly TicketsParallelResolverItem[] = [];
  @Input() desde: string | null = null;
  @Input() hasta: string | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @ViewChild(BaseChartDirective) private directivaGrafico?: BaseChartDirective;

  readonly chartPlugins = [ChartDataLabels];
  readonly limiteRanking = 10;
  private readonly colores = ['#FF620F', '#16835B', '#FFB184', '#63B891', '#D97706', '#F4C95D', '#12633F', '#A8DCC2', '#FF8A42', '#667085', '#C08457', '#437D70'];
  tipo: TipoLocalParalelo = '';
  mesActivo = '';
  busquedaResolutor = '';
  periodos: string[] = [];
  periodosMostrados: string[] = [];
  registrosVisibles: FilaResolutorParalelo[] = [];
  totalCoincidentes = 0;
  alturaGrafico = 420;
  expandido = false;
  errorPantallaCompleta: string | null = null;
  private elementoExpandido?: HTMLElement;

  chartData: ChartData<'bar', number[], string> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
    interaction: { mode: 'nearest', intersect: true },
    layout: { padding: { top: 8, right: 65, bottom: 4, left: 6 } },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#475467', usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 11, padding: 15, font: { size: 11 } } },
      datalabels: {
        display: context => {
          const valor = Number(context.dataset.data[context.dataIndex] ?? 0);
          return valor > 0 && context.chart.isDatasetVisible(context.datasetIndex) && !context.chart.data.datasets.some((d, i) => i > context.datasetIndex && context.chart.isDatasetVisible(i) && Number(d.data[context.dataIndex] ?? 0) > 0);
        },
        color: '#344054', anchor: 'end', align: 'end', offset: 5, clamp: true, clip: false,
        font: { size: 11, weight: 'bold' },
        formatter: (_valor: number, context) => context.chart.data.datasets.reduce((s, d, i) => s + (context.chart.isDatasetVisible(i) ? Number(d.data[context.dataIndex] ?? 0) : 0), 0).toLocaleString('es-PE')
      },
      tooltip: {
        backgroundColor: '#101828', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', padding: 12, cornerRadius: 8,
        callbacks: {
          title: items => this.registrosVisibles[items[0]?.dataIndex ?? -1]?.nombre ?? '',
          label: c => `${c.dataset.label}: ${Number(c.parsed.x ?? 0).toLocaleString('es-PE')} tickets`,
          afterBody: items => {
            const item = items[0];
            if (!item) return [];
            const total = item.chart.data.datasets.reduce((s, d, i) => s + (item.chart.isDatasetVisible(i) ? Number(d.data[item.dataIndex] ?? 0) : 0), 0);
            return [`Total de meses visibles: ${total.toLocaleString('es-PE')}`];
          }
        }
      }
    },
    scales: {
      x: { stacked: true, beginAtZero: true, grace: '15%', grid: { color: '#EDF0F2' }, ticks: { color: '#667085', precision: 0 }, title: { display: true, text: 'Tickets en paralelo (acumulado mensual)', color: '#667085', font: { size: 11 } } },
      y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, color: '#475467', font: { size: 11 } } }
    }
  };

  constructor(private cdr: ChangeDetectorRef) {}
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['desde'] || changes['hasta']) {
      this.periodos = periodosResolutores(this.datos, this.desde, this.hasta);
      if (this.mesActivo && !this.periodos.includes(this.mesActivo)) this.mesActivo = '';
      this.actualizarGrafico();
    }
  }
  get sinDatos(): boolean { return !this.registrosVisibles.length; }
  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'Incident' || valor === 'Service Request') { this.tipo = valor; this.actualizarGrafico(); }
  }
  seleccionarMes(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor && !this.periodos.includes(valor)) return;
    this.mesActivo = valor; this.actualizarGrafico();
  }
  buscarResolutor(evento: Event): void { this.busquedaResolutor = (evento.target as HTMLInputElement).value; this.actualizarGrafico(); }
  limpiarBusquedaResolutor(): void { this.busquedaResolutor = ''; this.actualizarGrafico(); }
  private actualizarGrafico(): void {
    const periodos = this.mesActivo ? [this.mesActivo] : this.periodos;
    // Chart.js conserva visibilidad por índice; restablecer al cambiar la lista de meses.
    if (this.periodosMostrados.join('|') !== periodos.join('|')) {
      const chart = this.directivaGrafico?.chart;
      chart?.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, true));
    }
    this.periodosMostrados = [...periodos];
    const ordenadas = ordenarFilasResolutores(construirFilasResolutores(this.datos, periodos, this.tipo, this.busquedaResolutor), 'total', true);
    this.totalCoincidentes = ordenadas.length;
    this.registrosVisibles = ordenadas.slice(0, this.limiteRanking);
    this.alturaGrafico = Math.max(320, this.registrosVisibles.length * 45 + 110);
    this.chartData = {
      labels: this.registrosVisibles.map(r => r.nombre.length > 32 ? `${r.nombre.slice(0, 31)}…` : r.nombre),
      datasets: periodos.map(p => ({
        label: this.nombreMes(p), data: this.registrosVisibles.map(r => r.mensual[p] ?? 0),
        backgroundColor: this.colores[Math.max(0, this.periodos.indexOf(p)) % this.colores.length],
        borderRadius: 4, borderSkipped: false, maxBarThickness: 28, barPercentage: .78, categoryPercentage: .82, stack: 'tickets'
      }))
    };
  }
  nombreMes(periodo: string): string { return nombreMesParalelo(periodo); }
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
