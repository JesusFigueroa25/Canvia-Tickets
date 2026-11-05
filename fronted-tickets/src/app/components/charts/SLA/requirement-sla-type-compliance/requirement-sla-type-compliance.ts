
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLACumplimientoTipoItem, RequirementSLACumplimientoTipoOut } from '../../../../models/requirement-sla';


@Component({
  selector: 'app-requirement-sla-type-compliance',
  standalone: false,
  templateUrl: './requirement-sla-type-compliance.html',
  styleUrl: './requirement-sla-type-compliance.css'
})
export class RequirementSlaTypeCompliance implements OnChanges {

  @Input() datos: RequirementSLACumplimientoTipoOut | null = null;
  @Input() cargando: boolean = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [
    ChartDataLabels
  ];
  readonly colorCumplidos = '#16835B';
  readonly colorIncumplidos = '#D95C4F';

  resumen: RequirementSLACumplimientoTipoItem[] = [];
  totalTickets: number = 0;
  totalCumplidos: number = 0;
  totalIncumplidos: number = 0;
  totalCancelados: number = 0;
  alturaGrafico: number = 420;

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararGrafico();
    }
  }



  chartOptions: ChartOptions<'bar'> = {

    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 350
    },

    layout: {
      padding: {
        top: 8,
        right: 65,
        left: 8,
        bottom: 8
      }
    },

    datasets: {
      bar: {
        categoryPercentage: 0.74,
        barPercentage: 0.88,
        maxBarThickness: 28
      }
    },

    scales: {

      x: {
        stacked: true,
        beginAtZero: true,
        grace: '18%',

        grid: {
          color: '#EDF0F2'
        },

        border: {
          display: false,
          dash: [4, 4]
        },

        ticks: {
          color: '#667085',
          precision: 0,
          font: {
            size: 11
          },
          callback: (valor) => {
            return Number(valor).toLocaleString('es-PE');
          }
        }
      },

      y: {

        stacked: true,
        grid: {
          display: false
        },
        border: {
          display: false
        },

        ticks: {
          color: '#475467',
          font: {
            size: 11,
            weight: 'bold'
          },
          autoSkip: false,

          callback: (valor) => {
            const indice = Number(valor);
            const tipo = this.resumen[indice]?.tipo_requerimiento ?? '';
            return this.abreviarTexto(tipo, 34);
          }
        }
      }

    },

    interaction: {
      intersect: false,
      mode: 'index'
    },

    plugins: {

      legend: {
        display: false
      },

      tooltip: {
        backgroundColor: '#101828',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 12,
        displayColors: true,
        callbacks: {

          title: (items) => {
            const item = this.resumen[items[0]?.dataIndex ?? -1];
            return item?.tipo_requerimiento ?? '';
          },

          label: (context) => {

            const item = this.resumen[
              context.dataIndex
            ];

            if (!item) {
              return '';
            }

            const cantidad = Number(
              context.parsed.x ?? 0
            );

            const porcentaje = item.total_tickets > 0 ? (cantidad / item.total_tickets) * 100 : 0;

            return (
              ` ${context.dataset.label}: ` +
              `${cantidad.toLocaleString('es-PE')} ` +
              `(${porcentaje.toFixed(2)}%)`
            );
          },

          afterBody: (items) => {

            const item = this.resumen[
              items[0]?.dataIndex ?? -1
            ];

            if (!item) {
              return [];
            }

            return [
              `Total tickets: ${item.total_tickets.toLocaleString('es-PE')}`,
              `Cancelados: ${item.cancelados.toLocaleString('es-PE')}`
            ];
          }

        }
      },

      datalabels: {
        anchor: (context): 'center' | 'end' => {
          return context.datasetIndex === 0 ? 'center' : 'end';
        },

        align: (context): 'center' | 'end' => {
          return context.datasetIndex === 0 ? 'center' : 'end';
        },

        offset: 4,
        clamp: true,
        clip: false,

        color: (context) => {
          return context.datasetIndex === 0 ? '#FFFFFF' : this.colorIncumplidos;
        },

        font: {
          size: 11,
          weight: 'bold'
        },

        display: (context) => {
          const valor = Number(context.dataset.data[context.dataIndex] ?? 0);
          return valor > 0;
        },

        formatter: (valor: number) => {
          return Number(valor).toLocaleString('es-PE');
        }
      }
    }
  };

  private abreviarTexto(texto: string, longitudMaxima: number): string {
    if (texto.length <= longitudMaxima) {
      return texto;
    }
    return texto.substring(
      0,
      longitudMaxima - 1
    ) + '…';
  }


  private prepararGrafico(): void {

    this.totalTickets = this.datos?.total_tickets ?? 0;
    this.totalCumplidos = this.datos?.total_cumplidos ?? 0;
    this.totalIncumplidos = this.datos?.total_incumplidos ?? 0;
    this.totalCancelados = this.datos?.total_cancelados ?? 0;

    this.resumen = [
      ...(this.datos?.distribucion ?? [])
    ];

    this.alturaGrafico = Math.max(
      420,
      this.resumen.length * 48 + 120
    );

    this.chartData = {
      labels: this.resumen.map(
        item => item.tipo_requerimiento
      ),

      datasets: [
        {
          label: 'Cumplidos',
          data: this.resumen.map(
            item => item.cumplidos
          ),
          backgroundColor: this.colorCumplidos,
          hoverBackgroundColor: '#12633F',
          borderRadius: 5,
          borderSkipped: false,
          stack: 'sla'
        },

        {
          label: 'No cumplidos',
          data: this.resumen.map(
            item => item.incumplidos
          ),
          backgroundColor: this.colorIncumplidos,
          hoverBackgroundColor: '#B42318',
          borderRadius: 5,
          borderSkipped: false,
          stack: 'sla'
        }
      ]
    };
  }


  get tieneDatos(): boolean {
    return (
      this.totalTickets > 0 &&
      this.resumen.length > 0
    );
  }

  get tieneBarras(): boolean {
    return (
      this.totalCumplidos +
      this.totalIncumplidos
    ) > 0;
  }

}
