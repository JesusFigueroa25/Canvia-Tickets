import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { RequirementSLASolucionTendenciaItem } from '../../../../models/requirement-sla';
import ChartDataLabels from 'chartjs-plugin-datalabels';

@Component({
  selector: 'app-requirement-sla-solution-trend',
  standalone: false,
  templateUrl: './requirement-sla-solution-trend.html',
  styleUrl: './requirement-sla-solution-trend.css'
})

export class RequirementSlaSolutionTrend
  implements OnChanges {
  @Input() datos: RequirementSLASolucionTendenciaItem[] = [];
  readonly chartPlugins = [ChartDataLabels];
  chartData: ChartData<'line', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 15,
        bottom: 10
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      datalabels: {
        display: (context) => {
          const valor = Number(
            context.dataset.data[context.dataIndex] ?? 0
          );
          return valor > 0;
        },
        anchor: 'center',
        align: 'top',
        offset: 7,
        color: (context) => {
          return context.datasetIndex === 0
            ? '#16835b'
            : '#d95c4f';
        },
        font: {
          size: 11,
          weight: 'bold'
        },
        formatter: (value: number) => {
          return value.toLocaleString('es-PE');
        },
        clip: false
      },

      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },

      tooltip: {
        callbacks: {
          label: (context) => {
            const valor = context.parsed.y;
            return (
              `${context.dataset.label}: ` +
              valor!.toLocaleString('es-PE')
            );
          }
        }
      }
    },


    scales: {
      x: {
        offset: true,

        grid: {
          display: false
        },

        ticks: {
          color: '#667085'
        }
      },

      y: {
        beginAtZero: true,

        grace: '15%',

        title: {
          display: true,
          text: 'Tickets'
        },
        ticks: {
          color: '#667085',
          precision: 0,
          callback: (value) => {
            const numero = Number(value);
            if (numero >= 1000) {
              return (numero / 1000).toFixed(numero >= 10000 ? 0 : 1) + 'k';
            }
            return numero;
          }
        },
        grid: {
          color: '#edf0f2'
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    if (!this.datos.length) {
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }

    this.chartData = {
      labels: this.datos.map(item => item.periodo),
      datasets: [
        {
          label: 'Cumplidos',
          data: this.datos.map(item => item.cumplidos),
          borderColor: '#16835b',
          backgroundColor: 'rgba(22, 131, 91, 0.12)',
          pointBackgroundColor: '#16835b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },

        {
          label: 'Incumplidos',
          data: this.datos.map(item => item.incumplidos),
          borderColor: '#d95c4f',
          backgroundColor: 'rgba(217, 92, 79, 0.08)',
          pointBackgroundColor: '#d95c4f',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }
      ]
    };
  }
}