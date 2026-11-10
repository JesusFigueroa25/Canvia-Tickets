
import {
  Component,
  Input,
  OnChanges
} from '@angular/core';

import {
  ChartData,
  ChartOptions
} from 'chart.js';

import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  IncidentConsolidatedAnalisisCausasOut,
  IncidentConsolidatedCausaAnalisisItem
} from '../../../../models/incident-consolidated';


@Component({
  selector: 'app-incident-cause-distribution-chart',
  standalone: false,
  templateUrl: './incident-cause-distribution-chart.html',
  styleUrl: './incident-cause-distribution-chart.css'
})
export class IncidentCauseDistributionChart implements OnChanges {

  @Input() datos: IncidentConsolidatedAnalisisCausasOut | null = null;

  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

  readonly naranja = '#FF620F';
  readonly verde = '#16835B';
  readonly gris = '#98A2B3';

  categoriasVisibles: IncidentConsolidatedCausaAnalisisItem[] = [];

  alturaGrafico = 330;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 350
    },

    layout: {
      padding: {
        right: 62
      }
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

        callbacks: {

          title: context => {
            const indice = context[0]?.dataIndex;

            if (indice === undefined) {
              return '';
            }

            return this.categoriasVisibles[indice]?.categoria ?? '';
          },

          label: context => {
            const item = this.categoriasVisibles[
              context.dataIndex
            ];

            if (!item) {
              return '';
            }

            return (
              ` ${item.incidentes.toLocaleString('es-PE')} ` +
              `incidentes (${item.porcentaje.toFixed(2)}%)`
            );
          },

          afterLabel: context => {
            const item = this.categoriasVisibles[
              context.dataIndex
            ];

            return item?.es_causa_identificada
              ? 'Factor técnico preliminar'
              : 'Pendiente de determinación';
          }
        }
      },

      datalabels: {
        color: '#344054',
        anchor: 'end',
        align: 'end',
        clamp: true,

        font: {
          size: 11,
          weight: 'bold'
        },

        display: context => {
          const item = this.categoriasVisibles[
            context.dataIndex
          ];

          return !!item && item.incidentes > 0;
        },

        formatter: (_valor, context) => {
          const item = this.categoriasVisibles[
            context.dataIndex
          ];

          if (!item) {
            return '';
          }

          return (
            `${item.incidentes.toLocaleString('es-PE')} ` +
            `(${item.porcentaje.toFixed(2)}%)`
          );
        }
      }
    },

    scales: {

      x: {
        beginAtZero: true,

        grid: {
          color: '#EEF2F6'
        },

        ticks: {
          color: '#667085',
          precision: 0
        }
      },

      y: {
        grid: {
          display: false
        },

        ticks: {
          color: '#344054',

          font: {
            size: 11
          },

          callback: (_valor, index) => {
            const categoria = this.categoriasVisibles[
              index
            ]?.categoria ?? '';

            return categoria.length > 30
              ? categoria.substring(0, 27) + '...'
              : categoria;
          }
        }
      }
    }
  };


  ngOnChanges(): void {
    this.prepararGrafico();
  }


  private prepararGrafico(): void {

    const causas = this.datos?.causas ?? [];

    // Mostrar categorías con casos, ordenadas por volumen.
    // El conjunto completo continúa disponible en la tabla.
    this.categoriasVisibles = causas
      .filter(item => item.incidentes > 0)
      .sort((a, b) =>
        b.incidentes - a.incidentes ||
        a.categoria.localeCompare(b.categoria)
      );

    this.alturaGrafico = Math.max(
      330,
      Math.min(800, this.categoriasVisibles.length * 57 + 85)
    );

    this.chartData = {
      labels: this.categoriasVisibles.map(
        item => item.categoria
      ),

      datasets: [{
        label: 'Incidentes',

        data: this.categoriasVisibles.map(
          item => item.incidentes
        ),

        backgroundColor: this.categoriasVisibles.map(
          item => this.obtenerColor(item)
        ),

        borderRadius: 6,
        maxBarThickness: 29
      }]
    };
  }


  obtenerColor(
    item: IncidentConsolidatedCausaAnalisisItem
  ): string {

    if (item.es_causa_identificada) {
      return this.naranja;
    }

    if (item.categoria.toLowerCase().includes('múltiples factores')) {
      return this.verde;
    }

    return this.gris;
  }


  get tieneDatos(): boolean {
    return Boolean(
      this.datos &&
      this.datos.total_incidentes > 0 &&
      this.categoriasVisibles.length > 0
    );
  }


  get sinEvidencia(): number {

    if (!this.datos) {
      return 0;
    }

    return Math.max(
      0,
      this.datos.sin_causa_determinada -
      this.datos.casos_multifactor
    );
  }

}
