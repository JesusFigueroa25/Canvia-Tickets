
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { HomeEvolucionSLAItem } from '../../../../models/home';

@Component({
  selector: 'app-home-sla-evolution',
  standalone: false,
  templateUrl: './home-sla-evolution.html',
  styleUrl: './home-sla-evolution.css'
})
export class HomeSlaEvolution implements OnChanges {
  @Input() datos: HomeEvolucionSLAItem[] = [];

  chartData: ChartData<'line', (number | null)[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          color: '#475467',
          font: {
            size: 11
          }
        }
      },

      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.raw == null) {
              return `${context.dataset.label}: Sin datos`;
            }
            const valor = Number(context.raw);
            return (`${context.dataset.label}: ` +
              valor.toLocaleString(
                'es-PE',
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }
              ) +
              '%'
            );
          }
        }
      }
    },

    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#667085',
          maxRotation: 0,
          autoSkip: true,
          font: {
            size: 11
          }
        }
      },

      y: {
        suggestedMin: 80,
        max: 100,
        title: {
          display: true,
          text: 'Cumplimiento SLA (%)'
        },
        ticks: {
          color: '#667085',
          callback: (value) => `${value}%`
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

    const registros = [...this.datos].sort(
      (a, b) =>
        a.anio - b.anio ||
        a.mes - b.mes
    );

    this.chartData = {
      labels: registros.map(
        item => item.periodo
      ),
      datasets: [
        {
          label: 'Incidentes',
          data: registros.map(
            item => item.incidentes
          ),
          borderColor: '#ff620f',
          backgroundColor: '#ff620f',
          pointBackgroundColor: '#ff620f',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          spanGaps: false
        },

        {
          label: 'Requerimientos',
          data: registros.map(
            item => item.requerimientos
          ),
          borderColor: '#16835b',
          backgroundColor: '#16835b',
          pointBackgroundColor: '#16835b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          spanGaps: false
        }
      ]
    };
  }
}
