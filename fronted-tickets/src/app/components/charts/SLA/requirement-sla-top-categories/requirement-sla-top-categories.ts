
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLATop10CategoriaItem, RequirementSLATop10CategoriaOut } from '../../../../models/requirement-sla';

@Component({
  selector: 'app-requirement-sla-top-categories',
  standalone: false,
  templateUrl: './requirement-sla-top-categories.html',
  styleUrl: './requirement-sla-top-categories.css'
})
export class RequirementSlaTopCategories implements OnChanges {

  @Input() datos: RequirementSLATop10CategoriaOut | null = null;
  @Input() cargando: boolean = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';

  readonly chartPlugins = [
    ChartDataLabels
  ];

  readonly colorCumplidos = '#16835B';
  readonly colorIncumplidos = '#D95C4F';

  resumen: RequirementSLATop10CategoriaItem[] = [];
  totalTickets = 0;
  totalCumplidos = 0;
  totalIncumplidos = 0;
  totalCancelados = 0;

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };


  chartOptions: ChartOptions<'bar'> = {

    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 350
    },

    layout: {
      padding: {
        top: 35,
        right: 12,
        left: 8,
        bottom: 8
      }
    },

    datasets: {
      bar: {
        categoryPercentage: 0.72,
        barPercentage: 0.88,
        maxBarThickness: 65
      }
    },

    scales: {

      x: {

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
          minRotation: 30,
          maxRotation: 45,

          callback: (_valor, index) => {
            const categoria = this.resumen[index]?.categoria ?? '';
            if (categoria.length > 19) {
              return categoria.substring(0, 18) + '…';
            }
            return categoria;
          }
        }
      },


      y: {

        stacked: true,
        beginAtZero: true,
        grace: '15%',

        grid: { color: '#EDF0F2' },

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

          title: (items) => {
            const item = this.resumen[
              items[0]?.dataIndex ?? -1
            ];
            return item?.categoria ?? '';
          },

          label: (context) => {

            const item = this.resumen[
              context.dataIndex
            ];

            if (!item) {
              return '';
            }

            const cantidad = Number(
              context.parsed.y ?? 0
            );

            const porcentaje = item.total_tickets > 0 ? cantidad * 100 / item.total_tickets : 0;
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
          const valor = Number(
            context.dataset.data[
            context.dataIndex
            ] ?? 0
          );
          return valor > 0;
        },

        formatter: (valor: number) => {
          return Number(valor).toLocaleString('es-PE');
        }
      }
    }
  };


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararGrafico();
    }
  }


  private prepararGrafico(): void {

    this.totalTickets = this.datos?.total_tickets ?? 0;
    this.totalCumplidos = this.datos?.total_cumplidos ?? 0;
    this.totalIncumplidos = this.datos?.total_incumplidos ?? 0;
    this.totalCancelados = this.datos?.total_cancelados ?? 0;

    this.resumen = [
      ...(this.datos?.distribucion ?? [])
    ];

    this.chartData = {

      labels: this.resumen.map(
        item => item.categoria
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
    return this.totalTickets > 0
      && this.resumen.length > 0;
  }

  get tieneBarras(): boolean {
    return (
      this.totalCumplidos + this.totalIncumplidos
    ) > 0;
  }

}
