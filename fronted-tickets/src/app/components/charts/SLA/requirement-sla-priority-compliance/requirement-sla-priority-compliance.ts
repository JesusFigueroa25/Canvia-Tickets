
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLACumplimientoPrioridadOut } from '../../../../models/requirement-sla';

type NivelPrioridad = 'P1' | 'P2' | 'P3' | 'P4';

interface CumplimientoPrioridadVista {
  prioridad: NivelPrioridad;
  descripcion: string;
  total_tickets: number;
  cumplidos: number;
  incumplidos: number;
  cancelados: number;
  porcentaje_cumplimiento: number;
}

@Component({
  selector: 'app-requirement-sla-priority-compliance',
  standalone: false,
  templateUrl: './requirement-sla-priority-compliance.html',
  styleUrl: './requirement-sla-priority-compliance.css'
})
export class RequirementSlaPriorityCompliance implements OnChanges {

  @Input() datos: RequirementSLACumplimientoPrioridadOut | null = null;
  @Input() cargando: boolean = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [
    ChartDataLabels
  ];

  readonly colorCumplidos = '#16835B';
  readonly colorIncumplidos = '#D95C4F';

  private readonly prioridades: {
    codigo: NivelPrioridad;
    descripcion: string;
  }[] = [
      {
        codigo: 'P1',
        descripcion: 'Crítica'
      },
      {
        codigo: 'P2',
        descripcion: 'Alta'
      },
      {
        codigo: 'P3',
        descripcion: 'Media'
      },
      {
        codigo: 'P4',
        descripcion: 'Baja'
      }
    ];

  resumen: CumplimientoPrioridadVista[] = [];
  totalTickets: number = 0;
  totalCumplidos: number = 0;
  totalIncumplidos: number = 0;
  totalCancelados: number = 0;


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
        right: 42,
        left: 6,
        bottom: 8
      }
    },

    datasets: {
      bar: {
        categoryPercentage: 0.70,
        barPercentage: 0.85,
        maxBarThickness: 22
      }
    },

    scales: {

      x: {
        stacked: false,
        beginAtZero: true,
        grace: '15%',

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
        stacked: false,
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: '#475467',
          font: {
            size: 12,
            weight: 'bold'
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
            const item = this.resumen[
              items[0]?.dataIndex ?? -1
            ];
            if (!item) {
              return '';
            }
            return `${item.prioridad} - ${item.descripcion}`;
          },

          label: (context) => {
            const item = this.resumen[context.dataIndex];

            if (!item) {
              return '';
            }

            const cantidad = Number(context.parsed.x ?? 0);
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
              return '';
            }

            return [
              `Total tickets: ${item.total_tickets.toLocaleString('es-PE')}`,
              `Mediciones canceladas: ${item.cancelados.toLocaleString('es-PE')}`
            ];
          }

        }

      },

      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 4,
        clamp: true,
        clip: false,
        color: (context) => {
          return context.datasetIndex === 0 ? this.colorCumplidos : this.colorIncumplidos;
        },

        font: {
          size: 11,
          weight: 'bold'
        },

        display: (context) => {
          const valor = Number(
            context.dataset.data[
            context.dataIndex
            ] ?? 0
          );
          return valor > 0;
        },

        formatter: (valor: number) => {
          return valor.toLocaleString('es-PE');
        }

      }
    }
  };

  private prepararGrafico(): void {

    this.totalTickets = this.datos?.total_tickets ?? 0;
    this.totalCumplidos = this.datos?.total_cumplidos ?? 0;
    this.totalIncumplidos = this.datos?.total_incumplidos ?? 0;
    this.totalCancelados = this.datos?.total_cancelados ?? 0;

    this.resumen = this.prioridades.map(
      prioridad => {

        const registro = this.datos?.distribucion.find(
          item => item.prioridad === prioridad.codigo
        );

        const total = registro?.total_tickets ?? 0;
        const cumplidos = registro?.cumplidos ?? 0;
        const incumplidos = registro?.incumplidos ?? 0;
        const cancelados = registro?.cancelados ?? 0;
        const porcentaje = total > 0 ? (cumplidos / total) * 100 : 0;

        return {
          prioridad: prioridad.codigo,
          descripcion: prioridad.descripcion,
          total_tickets: total,
          cumplidos,
          incumplidos,
          cancelados,
          porcentaje_cumplimiento: porcentaje
        };
      }
    );


    this.chartData = {

      labels: this.resumen.map(
        item => item.prioridad
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
          borderSkipped: false
        },


        {
          label: 'No cumplidos',
          data: this.resumen.map(
            item => item.incumplidos
          ),
          backgroundColor: this.colorIncumplidos,
          hoverBackgroundColor: '#B42318',
          borderRadius: 5,
          borderSkipped: false
        }
      ]
    };
  }


  obtenerClaseCumplimiento(porcentaje: number): string {
    if (porcentaje >= 95) {
      return 'sla-good';
    }
    if (porcentaje >= 90) {
      return 'sla-warning';
    }
    return 'sla-danger';
  }


  get tieneDatos(): boolean {
    return this.totalTickets > 0;
  }

}
