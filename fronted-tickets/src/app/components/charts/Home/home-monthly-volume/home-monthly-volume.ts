
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { HomeVolumenMensualItem } from '../../../../models/home';

@Component({
  selector: 'app-home-monthly-volume',
  standalone: false,
  templateUrl: './home-monthly-volume.html',
  styleUrl: './home-monthly-volume.css'
})
export class HomeMonthlyVolume implements OnChanges {

  @Input() datos: HomeVolumenMensualItem[] = [];
  chartData: ChartData<'bar', (number | null)[], string> = { labels: [], datasets: [] };

  chartOptions: ChartOptions<'bar'> = {
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
            return (
              `${context.dataset.label}: ` +
              valor.toLocaleString('es-PE') +
              ' tickets'
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
        beginAtZero: true,
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

    const registros = [...this.datos].sort(
      (a, b) => a.anio - b.anio || a.mes - b.mes
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
          backgroundColor: '#FFB184',
          borderColor: '#FF620F',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 34
        },
        {
          label: 'Requerimientos',
          data: registros.map(
            item => item.requerimientos
          ),
          backgroundColor: '#63B891',
          borderColor: '#16835B',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 34
        },
        {
          label: 'Tareas',
          data: registros.map(
            item => item.tareas
          ),
          backgroundColor: '#F4C95D',
          borderColor: '#D97706',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 34
        }
      ]
    };




  }
}
