import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ChangeConsolidatedHorasMensualesItem } from '../../../../models/change-consolidated';

type Metrica = 'horas' | 'promedio';

@Component({
  selector: 'app-change-monthly-hours-chart',
  standalone: false,
  templateUrl: './change-monthly-hours-chart.html',
  styleUrl: './change-monthly-hours-chart.css'
})
export class ChangeMonthlyHoursChart implements OnChanges {
  @Input() datos: ChangeConsolidatedHorasMensualesItem[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartPlugins = [ChartDataLabels];
  readonly colores = [
    '#FF620F', '#16835B', '#FFB184', '#63B891', '#D97706',
    '#F4C95D', '#12633F', '#A8DCC2', '#FF8A42', '#667085'
  ];

  metrica: Metrica = 'horas';
  registros: ChangeConsolidatedHorasMensualesItem[] = [];

  chartData: ChartData<'bar', number[], string> = { labels: [], datasets: [] };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 35, right: 16, bottom: 7, left: 8 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        display: contexto => Number(contexto.dataset.data[contexto.dataIndex] ?? 0) > 0,
        anchor: 'end', align: 'end', offset: 4, clamp: true, clip: false,
        color: '#344054', font: { size: 10, weight: 'bold' },
        formatter: (valor: number) => `${this.horas(valor)} h`
      },
      tooltip: {
        backgroundColor: '#101828', titleColor: '#FFFFFF', bodyColor: '#FFFFFF',
        padding: 12, cornerRadius: 8,
        callbacks: {
          title: items => this.nombreMes(this.registros[items[0]?.dataIndex ?? -1]?.Periodo ?? ''),
          label: contexto => this.metrica === 'horas'
            ? `Horas totales: ${this.horas(Number(contexto.parsed.y ?? 0))} h`
            : `Promedio por cambio: ${this.horas(Number(contexto.parsed.y ?? 0))} h`,
          afterBody: items => {
            const item = this.registros[items[0]?.dataIndex ?? -1];
            return item ? [
              `Cambios: ${this.numero(item.Total_Cambios)}`,
              `Tareas: ${this.numero(item.Total_Tareas)}`,
              `Resolutores: ${this.numero(item.Total_Resolutores)}`,
              ...(this.metrica === 'horas'
                ? [`Promedio por cambio: ${this.horas(item.Promedio_Horas_Por_Cambio)} h`]
                : [`Horas totales: ${this.horas(item.Horas_Totales)} h`])
            ] : [];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#667085', autoSkip: false, maxRotation: 0, font: { size: 11 } }
      },
      y: {
        beginAtZero: true, grace: '22%',
        grid: { color: '#EEF1F5' },
        ticks: { color: '#667085', callback: valor => `${valor} h` },
        title: { display: true, text: 'Horas', color: '#667085', font: { size: 11 } }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) this.actualizarGrafico();
  }

  get sinDatos(): boolean { return this.registros.length === 0; }
  get anchoMinimoGrafico(): number {
    return Math.max(620, this.registros.length * 92);
  }
  get totalHorasMeses(): number {
    // Las horas del bloque mensual vienen redondeadas por mes; NO es el total general exacto.
    return this.registros.reduce((suma, item) => suma + item.Horas_Totales, 0);
  }
  get totalMeses(): number { return this.registros.length; }
  get totalCambiosPorMes(): number {
    return this.registros.reduce((suma, item) => suma + item.Total_Cambios, 0);
  }

  cambiarMetrica(evento: Event): void {
    const metrica = (evento.target as HTMLSelectElement).value;
    if (metrica === 'horas' || metrica === 'promedio') {
      this.metrica = metrica;
      this.actualizarGrafico();
    }
  }
  horas(valor: number): string {
    return valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  numero(valor: number): string { return valor.toLocaleString('es-PE'); }
  nombreMes(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    if (!anio || !mes || mes < 1 || mes > 12) return periodo;
    const nombre = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })
      .format(new Date(anio, mes - 1, 1));
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    if (!anio || !mes || mes < 1 || mes > 12) return periodo;
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
      'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${meses[mes - 1]}-${String(anio).slice(-2)}`;
  }
  get textoPeriodo(): string {
    if (!this.registros.length) return 'Sin período';
    const primero = this.nombreMes(this.registros[0].Periodo);
    const ultimo = this.nombreMes(this.registros[this.registros.length - 1].Periodo);
    return primero === ultimo ? primero : `${primero} — ${ultimo}`;
  }

  private actualizarGrafico(): void {
    this.registros = [...(this.datos ?? [])].sort((a, b) =>
      a.Anio - b.Anio || a.Mes - b.Mes);
    this.chartData = {
      labels: this.registros.map(item => this.formatearPeriodo(item.Periodo)),
      datasets: [{
        label: this.metrica === 'horas' ? 'Horas totales' : 'Promedio horas/cambio',
        data: this.registros.map(item =>
          this.metrica === 'horas' ? item.Horas_Totales : item.Promedio_Horas_Por_Cambio),
        backgroundColor: this.registros.map((_, i) => this.colores[i % this.colores.length]),
        borderRadius: 5, borderSkipped: false, maxBarThickness: 50,
        barPercentage: .78, categoryPercentage: .84
      }]
    };
  }
}
