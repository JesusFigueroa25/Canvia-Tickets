import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ChangeConsolidatedHorasResolutorItem } from '../../../../models/change-consolidated';

type Limite = 'todos' | '5' | '10';

@Component({
  selector: 'app-change-resolver-hours-chart',
  standalone: false,
  templateUrl: './change-resolver-hours-chart.html',
  styleUrl: './change-resolver-hours-chart.css'
})
export class ChangeResolverHoursChart implements OnChanges {
  @Input() datos: ChangeConsolidatedHorasResolutorItem[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartPlugins = [ChartDataLabels];
  readonly colores = [
    '#FF620F', '#FFB184', '#16835B', '#63B891',
    '#D97706', '#F4C95D', '#12633F', '#A8DCC2',
    '#FF8A42', '#667085'
  ];

  busqueda = '';
  limite: Limite = 'todos';
  registrosVisibles: ChangeConsolidatedHorasResolutorItem[] = [];
  alturaGrafico = 350;

  chartData: ChartData<'bar', number[], string> = { labels: [], datasets: [] };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: { duration: 220 },
    interaction: { mode: 'nearest', intersect: false },
    layout: { padding: { top: 8, right: 75, bottom: 4, left: 6 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        display: contexto => Number(contexto.dataset.data[contexto.dataIndex] ?? 0) > 0,
        anchor: 'end', align: 'end', offset: 5, clamp: true, clip: false,
        color: '#344054', font: { size: 10, weight: 'bold' },
        formatter: (valor: number) => `${this.horas(valor)} h`
      },
      tooltip: {
        backgroundColor: '#101828', titleColor: '#FFFFFF', bodyColor: '#FFFFFF',
        padding: 12, cornerRadius: 8,
        callbacks: {
          title: items => this.registrosVisibles[items[0]?.dataIndex ?? -1]?.Resolutor ?? '',
          label: contexto => `Horas trabajadas: ${this.horas(Number(contexto.parsed.x ?? 0))} h`,
          afterBody: items => {
            const item = this.registrosVisibles[items[0]?.dataIndex ?? -1];
            return item ? [
              `Tareas distintas: ${this.numero(item.Total_Tareas)}`,
              `Registros de tiempo: ${this.numero(item.Total_Registros)}`
            ] : [];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true, grace: '18%',
        grid: { color: '#EEF1F5' },
        ticks: { color: '#667085', callback: value => `${value} h` },
        title: { display: true, text: 'Horas trabajadas', color: '#667085', font: { size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { autoSkip: false, color: '#475467', font: { size: 11 } }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) this.actualizarGrafico();
  }

  get registrosSinTotal(): ChangeConsolidatedHorasResolutorItem[] {
    // La fila GROUPING SETS 'TOTAL GENERAL' no representa un resolutor.
    return (this.datos ?? []).filter(item =>
      item.Resolutor?.trim().toLocaleUpperCase('es-PE') !== 'TOTAL GENERAL'
    );
  }

  get totalGeneral(): number {
    const resumen = (this.datos ?? []).find(item =>
      item.Resolutor?.trim().toLocaleUpperCase('es-PE') === 'TOTAL GENERAL'
    );
    return resumen?.Horas_Totales ?? this.registrosSinTotal.reduce(
      (suma, item) => suma + (item.Horas_Totales ?? 0), 0
    );
  }

  get totalResolutores(): number { return this.registrosSinTotal.length; }
  get horasRanking(): number {
    return this.registrosVisibles.reduce(
      (suma, item) => suma + (item.Horas_Totales ?? 0), 0
    );
  }
  get sinDatos(): boolean { return this.registrosVisibles.length === 0; }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-PE').trim();
  }

  buscar(evento: Event): void {
    this.busqueda = (evento.target as HTMLInputElement).value;
    this.actualizarGrafico();
  }
  limpiarBusqueda(): void {
    this.busqueda = '';
    this.actualizarGrafico();
  }
  cambiarLimite(evento: Event): void {
    const limite = (evento.target as HTMLSelectElement).value;
    if (limite === 'todos' || limite === '5' || limite === '10') {
      this.limite = limite;
      this.actualizarGrafico();
    }
  }

  horas(valor: number): string {
    return valor.toLocaleString('es-PE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  numero(valor: number): string { return valor.toLocaleString('es-PE'); }

  private acortarNombre(valor: string): string {
    return valor.length > 30 ? `${valor.slice(0, 29)}…` : valor;
  }

  private actualizarGrafico(): void {
    const termino = this.normalizar(this.busqueda);
    const registros = this.registrosSinTotal
      .filter(item => this.normalizar(item.Resolutor ?? 'SIN RESOLUTOR').includes(termino))
      .sort((a, b) => (b.Horas_Totales ?? 0) - (a.Horas_Totales ?? 0)
        || a.Resolutor.localeCompare(b.Resolutor, 'es'));

    this.registrosVisibles = this.limite === 'todos'
      ? registros : registros.slice(0, Number(this.limite));
    this.alturaGrafico = Math.max(320, this.registrosVisibles.length * 48 + 90);

    this.chartData = {
      labels: this.registrosVisibles.map(item => this.acortarNombre(item.Resolutor)),
      datasets: [{
        label: 'Horas trabajadas',
        data: this.registrosVisibles.map(item => item.Horas_Totales ?? 0),
        backgroundColor: this.registrosVisibles.map((_, i) =>
          this.colores[i % this.colores.length]),
        borderRadius: 5, borderSkipped: false, maxBarThickness: 27,
        barPercentage: .8, categoryPercentage: .86
      }]
    };
  }
}
