
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
  selector: 'app-report-times-project-chart',
  standalone: false,
  templateUrl: './report-times-project-chart.html',
  styleUrl: './report-times-project-chart.css'
})
export class ReportTimesProjectChart implements OnChanges {

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
    '#B54708',
    '#667085'
  ];

  proyectoActivo = '';

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    animation: {
      duration: 250
    },

    layout: {
      padding: {
        top: 20,
        right: 15,
        bottom: 6,
        left: 8
      }
    },

    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        align: 'start',

        labels: {
          color: '#475467',
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 11,
          boxHeight: 11,
          padding: 15,

          font: {
            size: 11
          }
        }
      },

      datalabels: {
        display: context => {
          const valor = Number(
            context.dataset.data[context.dataIndex] ?? 0
          );

          return this.seriesVisibles.length === 1 && valor > 0;
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
        displayColors: true,

        callbacks: {
          title: items => {
            const indice = items[0]?.dataIndex ?? -1;
            const periodo = this.datos?.periodos[indice] ?? '';

            return this.nombreMes(periodo);
          },

          label: context => {
            const proyecto = this.seriesVisibles[
              context.datasetIndex
            ];

            const horas = Number(context.parsed.y ?? 0);

            return [
              `Proyecto: ${this.nombreVisibleProyecto(proyecto?.nombre ?? '')}`,
              `Horas: ${this.formatearHoras(horas)} h`
            ];
          },

          afterLabel: context => {
            const proyecto = this.seriesVisibles[
              context.datasetIndex
            ];

            if (!proyecto || this.proyectoActivo) {
              return '';
            }

            return `Total del proyecto: ${this.formatearHoras(proyecto.horas_totales)} h`;
          }
        }
      }
    },

    scales: {
      x: {
        stacked: false,

        grid: {
          display: false
        },

        border: {
          display: false
        },

        ticks: {
          color: '#667085',
          maxRotation: 0,
          autoSkip: false,

          font: {
            size: 11
          }
        }
      },

      y: {
        stacked: false,
        beginAtZero: true,
        grace: '15%',

        grid: {
          color: '#EEF1F5'
        },

        border: {
          display: false
        },

        ticks: {
          color: '#667085',

          callback: valor =>
            `${Number(valor).toLocaleString('es-PE')} h`,

          font: {
            size: 11
          }
        },

        title: {
          display: true,
          text: 'Horas registradas',
          color: '#667085',

          font: {
            size: 11
          }
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      const existeProyecto = this.datos?.series.some(
        serie => serie.nombre === this.proyectoActivo
      );

      if (this.proyectoActivo && !existeProyecto) {
        this.proyectoActivo = '';
      }
    }

    this.actualizarGrafico();
  }

  get seriesVisibles(): TicketsReportTimesGraficoSerie[] {
    const series = this.datos?.series ?? [];

    if (!this.proyectoActivo) {
      return series;
    }

    return series.filter(
      serie => serie.nombre === this.proyectoActivo
    );
  }

  get sinDatos(): boolean {
    return (
      !this.datos ||
      this.datos.periodos.length === 0 ||
      this.seriesVisibles.length === 0
    );
  }

  get anchoMinimoGrafico(): number {
    const cantidadMeses = this.datos?.periodos.length ?? 0;
    const cantidadProyectos = this.seriesVisibles.length;

    const anchoPorMes = Math.max(
      180,
      cantidadProyectos * 65 + 100
    );

    return Math.max(
      780,
      cantidadMeses * anchoPorMes
    );
  }

  get totalHorasVisibles(): number {
    return this.seriesVisibles.reduce(
      (total, serie) => total + serie.horas_totales,
      0
    );
  }

  get totalProyectosVisibles(): number {
    return this.seriesVisibles.length;
  }

  get totalMeses(): number {
    return this.datos?.periodos.length ?? 0;
  }

  get textoPeriodo(): string {
    const periodos = this.datos?.periodos ?? [];

    if (!periodos.length) {
      return 'Sin período';
    }

    const primero = this.nombreMes(periodos[0]);

    const ultimo = this.nombreMes(
      periodos[periodos.length - 1]
    );

    return primero === ultimo
      ? primero
      : `${primero} - ${ultimo}`;
  }

  seleccionarProyecto(evento: Event): void {
    const select = evento.target as HTMLSelectElement;

    this.proyectoActivo = select.value;
    this.actualizarGrafico();
  }

  private actualizarGrafico(): void {
    const periodos = this.datos?.periodos ?? [];

    const datasets = this.seriesVisibles.map(serie => {
      const indiceOriginal =
        this.datos?.series.findIndex(
          item => item.nombre === serie.nombre
        ) ?? 0;

      const indiceColor = Math.max(0, indiceOriginal);

      const color = this.colores[
        indiceColor % this.colores.length
      ];

      const horasPorPeriodo = new Map(
        serie.mensual.map(
          punto => [punto.periodo, punto.horas] as const
        )
      );

      return {
        label: this.nombreCortoProyecto(serie.nombre),

        data: periodos.map(
          periodo => horasPorPeriodo.get(periodo) ?? 0
        ),

        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        borderRadius: 5,
        borderSkipped: false,

        maxBarThickness: 38,
        categoryPercentage: 0.8,
        barPercentage: 0.85
      };
    });

    this.chartData = {
      labels: periodos.map(
        periodo => this.formatearPeriodo(periodo)
      ),
      datasets
    };
  }

  nombreVisibleProyecto(proyecto: string): string {
    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  nombreCortoProyecto(proyecto: string): string {
    const nombre = this.nombreVisibleProyecto(proyecto);
    const limite = 34;

    return nombre.length > limite
      ? `${nombre.slice(0, limite - 1)}…`
      : nombre;
  }

  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    const meses = [
      'ENE', 'FEB', 'MAR', 'ABR',
      'MAY', 'JUN', 'JUL', 'AGO',
      'SEP', 'OCT', 'NOV', 'DIC'
    ];

    return `${meses[mes - 1]} ${anio}`;
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
}
