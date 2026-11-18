
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';

import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  TicketsReportTimesGrafico,
  TicketsReportTimesGraficoSerie
} from '../../../../models/tickets-report-times';

@Component({
  selector: 'app-report-times-resolver-chart',
  standalone: false,
  templateUrl: './report-times-resolver-chart.html',
  styleUrl: './report-times-resolver-chart.css'
})
export class ReportTimesResolverChart implements OnChanges {

  @Input() datos: TicketsReportTimesGrafico | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartPlugins = [ChartDataLabels];

  readonly colores = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2',
    '#FF8A42',
    '#667085'
  ];

  // Filtro local: no modifica los filtros del dashboard.
  mesActivo = '';

  registrosVisibles: TicketsReportTimesGraficoSerie[] = [];
  periodosMostrados: string[] = [];

  alturaGrafico = 420;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',

    interaction: {
      mode: 'nearest',
      intersect: true
    },

    layout: {
      padding: {
        top: 8,
        right: 55,
        bottom: 4,
        left: 6
      }
    },

    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#475467',
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 11,
          padding: 15,
          font: { size: 11 }
        }
      },

      datalabels: {
        display: context => {
          const valor = Number(
            context.dataset.data[context.dataIndex] ?? 0
          );

          return this.periodosMostrados.length === 1 && valor > 0;
        },

        color: '#344054',
        anchor: 'end',
        align: 'end',
        offset: 5,
        clamp: true,

        font: {
          size: 10,
          weight: 'bold'
        },

        formatter: (valor: number) =>
          valor > 0 ? this.formatearHoras(valor) : ''
      },

      tooltip: {
        enabled: true,
        backgroundColor: '#101828',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 12,
        cornerRadius: 8,

        callbacks: {
          title: items => {
            const indice = items[0]?.dataIndex ?? -1;

            return this.registrosVisibles[indice]?.nombre ?? '';
          },

          label: context => {
            const periodo = this.periodosMostrados[
              context.datasetIndex
            ];

            const horas = Number(context.parsed.x ?? 0);

            return `${this.nombreMes(periodo)}: ${this.formatearHoras(horas)} h`;
          },

          afterBody: items => {
            const indice = items[0]?.dataIndex ?? -1;
            const registro = this.registrosVisibles[indice];

            if (!registro || this.mesActivo) {
              return [];
            }

            return [
              `Total del resolutor: ${this.formatearHoras(registro.horas_totales)} h`
            ];
          }
        }
      }
    },

    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grace: '15%',

        grid: {
          color: '#EDF0F2'
        },

        ticks: {
          color: '#667085',
          callback: valor => `${valor} h`
        },

        title: {
          display: true,
          text: 'Horas registradas',
          color: '#667085',
          font: { size: 11 }
        }
      },

      y: {
        stacked: true,

        grid: {
          display: false
        },

        ticks: {
          autoSkip: false,
          color: '#475467',
          font: { size: 11 }
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      if (
        this.mesActivo &&
        !this.datos?.periodos.includes(this.mesActivo)
      ) {
        this.mesActivo = '';
      }
    }

    this.actualizarGrafico();
  }

  get sinDatos(): boolean {
    return (
      !this.datos ||
      this.datos.periodos.length === 0 ||
      this.registrosVisibles.length === 0
    );
  }

  get totalHorasMostradas(): number {
    return this.registrosVisibles.reduce(
      (total, registro) => {
        return total + (
          this.mesActivo
            ? this.horasEnPeriodo(registro, this.mesActivo)
            : registro.horas_totales
        );
      },
      0
    );
  }

  get totalMeses(): number {
    return this.datos?.periodos.length ?? 0;
  }

  seleccionarMes(evento: Event): void {
    const select = evento.target as HTMLSelectElement;

    this.mesActivo = select.value;
    this.actualizarGrafico();
  }

  private horasEnPeriodo(
    registro: TicketsReportTimesGraficoSerie,
    periodo: string
  ): number {

    return registro.mensual.find(
      item => item.periodo === periodo
    )?.horas ?? 0;
  }

  private actualizarGrafico(): void {
    const series = this.datos?.series ?? [];

    const periodos = this.mesActivo
      ? [this.mesActivo]
      : [...(this.datos?.periodos ?? [])];

    this.periodosMostrados = periodos;

    this.registrosVisibles = [...series]
      .filter(registro =>
        !this.mesActivo ||
        this.horasEnPeriodo(registro, this.mesActivo) > 0
      )
      .sort((a, b) => {
        const horasA = this.mesActivo
          ? this.horasEnPeriodo(a, this.mesActivo)
          : a.horas_totales;

        const horasB = this.mesActivo
          ? this.horasEnPeriodo(b, this.mesActivo)
          : b.horas_totales;

        return horasB - horasA ||
          a.nombre.localeCompare(b.nombre, 'es');
      });

    this.alturaGrafico = Math.max(
      320,
      this.registrosVisibles.length * 49 + 100
    );

    this.chartData = {
      labels: this.registrosVisibles.map(
        registro => this.acortarNombre(registro.nombre)
      ),

      datasets: periodos.map((periodo, indice) => ({
        label: this.nombreMes(periodo),

        data: this.registrosVisibles.map(
          registro => this.horasEnPeriodo(registro, periodo)
        ),

        backgroundColor: this.colores[
          indice % this.colores.length
        ],

        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 28,

        barPercentage: 0.78,
        categoryPercentage: 0.82,

        stack: 'horas'
      }))
    };
  }

  nombreMes(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    const nombre = new Intl.DateTimeFormat('es-PE', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(anio, mes - 1, 1));

    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  formatearHoras(valor: number): string {
    return valor.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  private acortarNombre(nombre: string): string {
    const limite = 32;

    return nombre.length > limite
      ? `${nombre.slice(0, limite - 1)}…`
      : nombre;
  }
}
