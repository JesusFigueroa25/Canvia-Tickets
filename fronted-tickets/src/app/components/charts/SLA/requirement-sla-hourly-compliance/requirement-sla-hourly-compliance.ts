
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLACondicionDia, RequirementSLACumplimientoHorarioOut } from '../../../../models/requirement-sla';

interface CumplimientoHorarioVista {
  condicion_dia: RequirementSLACondicionDia;
  total_tickets: number;
  cumplidos: number;
  incumplidos: number;
  cancelados: number;
  porcentaje_cumplimiento: number;
}

@Component({
  selector: 'app-requirement-sla-hourly-compliance',
  standalone: false,
  templateUrl: './requirement-sla-hourly-compliance.html',
  styleUrl: './requirement-sla-hourly-compliance.css'
})
export class RequirementSlaHourlyCompliance implements OnChanges {

  @Input() datos: RequirementSLACumplimientoHorarioOut | null = null;
  @Input() cargando: boolean = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [
    ChartDataLabels
  ];

  readonly colorCumplidos = '#16835B';
  readonly colorIncumplidos = '#D95C4F';
  private readonly condiciones: RequirementSLACondicionDia[] = [
    'Lun-Vie',
    'Fuera Horario',
    'Fin Sem.'
  ];


  resumen: CumplimientoHorarioVista[] = [];
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
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 350
    },

    layout: {
      padding: {
        top: 26,
        right: 10,
        left: 4,
        bottom: 4
      }
    },

    datasets: {
      bar: {
        categoryPercentage: 0.66,
        barPercentage: 0.85,
        maxBarThickness: 58
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
          color: '#475467',
          font: {
            size: 11,
            weight: 'bold'
          },
          maxRotation: 0,
          minRotation: 0
        }
      },

      y: {
        stacked: false,
        beginAtZero: true,
        grace: '12%',
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
          label: (context) => {
            const item = this.resumen[context.dataIndex];
            if (!item) {
              return '';
            }
            const cantidad = Number(
              context.parsed.y ?? 0
            );

            const porcentaje = item.total_tickets > 0 ? (cantidad / item.total_tickets) * 100 : 0;
            return (
              ` ${context.dataset.label}: ` +
              `${cantidad.toLocaleString('es-PE')} ` +
              `(${porcentaje.toFixed(2)}%)`
            );

          },

          afterBody: (context) => {

            const item = this.resumen[
              context[0]?.dataIndex ?? -1
            ];

            if (!item) {
              return '';
            }

            return (
              `Mediciones canceladas: ` +
              item.cancelados.toLocaleString('es-PE')
            );
          }
        }
      },

      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 3,
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

    this.resumen = this.condiciones.map(
      condicion => {
        const registro = this.datos?.distribucion.find(
          item => item.condicion_dia === condicion
        );
        const total = registro?.total_tickets ?? 0;
        const cumplidos = registro?.cumplidos ?? 0;
        const incumplidos = registro?.incumplidos ?? 0;
        const cancelados = registro?.cancelados ?? 0;
        const porcentaje = total > 0 ? (cumplidos / total) * 100 : 0;
        return {
          condicion_dia: condicion,
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
        item => item.condicion_dia
      ),
      datasets: [
        {
          label: 'Cumplidos',
          data: this.resumen.map(
            item => item.cumplidos
          ),
          backgroundColor: this.colorCumplidos,
          hoverBackgroundColor: '#12633F',
          borderRadius: 6,
          borderSkipped: false
        },

        {
          label: 'No cumplidos',
          data: this.resumen.map(
            item => item.incumplidos
          ),
          backgroundColor: this.colorIncumplidos,
          hoverBackgroundColor: '#B42318',
          borderRadius: 6,
          borderSkipped: false
        }

      ]
    };

  }

  get tieneDatos(): boolean {
    return this.totalTickets > 0;
  }

}
