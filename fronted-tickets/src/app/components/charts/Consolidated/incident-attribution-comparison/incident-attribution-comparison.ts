
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
  IncidentConsolidatedDistribucionAjustadaOut
} from '../../../../models/incident-consolidated';


@Component({
  selector: 'app-incident-attribution-comparison',
  standalone: false,
  templateUrl: './incident-attribution-comparison.html',
  styleUrl: './incident-attribution-comparison.css'
})
export class IncidentAttributionComparison implements OnChanges {

  @Input() datos: IncidentConsolidatedDistribucionAjustadaOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

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
        right: 30
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
          label: context => {
            const valor = Number(context.raw ?? 0);

            return (
              ` ${context.dataset.label}: ` +
              valor.toLocaleString('es-PE') +
              ' incidentes'
            );
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
          const valor = Number(
            context.dataset.data[context.dataIndex] ?? 0
          );

          return valor > 0;
        },

        formatter: valor =>
          Number(valor).toLocaleString('es-PE')
      }
    },

    scales: {
      x: {
        beginAtZero: true,

        grid: {
          color: '#eef2f6'
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
            size: 12
          }
        }
      }
    }
  };


  ngOnChanges(): void {
    this.prepararGrafico();
  }


  private prepararGrafico(): void {

    const comparacion = this.datos?.comparacion ?? [];

    this.chartData = {
      labels: comparacion.map(item =>
        item.atribucion === 'Atribuible a Cliente'
          ? 'Cliente'
          : item.atribucion === 'Atribuible a Canvia'
            ? 'Canvia'
            : item.atribucion
      ),

      datasets: [
        {
          label: 'Original',

          data: comparacion.map(
            item => item.tickets_originales
          ),

          backgroundColor: '#FF620F',
          borderRadius: 6,
          maxBarThickness: 28
        },
        {
          label: 'Ajustada',

          data: comparacion.map(
            item => item.tickets_ajustados
          ),

          backgroundColor: '#16835B',
          borderRadius: 6,
          maxBarThickness: 28
        }
      ]
    };
  }


  get tieneDatos(): boolean {
    return Boolean(
      this.datos &&
      this.datos.total_atribuidos_original > 0
    );
  }


  get ajustesPendientes(): boolean {
    return this.datos?.estado_ajuste ===
      'PENDIENTE_REGLAS_APROBADAS';
  }

}
