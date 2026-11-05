import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentSLATrendItem } from '../../../../models/incident-sla';

@Component({
  selector: 'app-sla-solution-trend',
  standalone: false,
  templateUrl: './sla-solution-trend.html',
  styleUrl: './sla-solution-trend.css'
})
export class SlaSolutionTrend implements OnChanges {

  @Input() datos: IncidentSLATrendItem[] = [];
  readonly chartPlugins = [ChartDataLabels];

  chartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      legend: {
        position: 'top',
        align: 'end'
      },

      datalabels: {
        display: (context) => context.datasetIndex === 0,
        anchor: 'center',
        align: (context) => {
          const valor = this.datos[context.dataIndex]?.cumplimiento ?? 0;
          return valor >= 97 ? 'bottom' : 'top';
        },
        offset: 6,
        color: '#16835B',
        font: { size: 12, weight: 'bold' },
        formatter: (value: number) => {
          return `${value.toLocaleString('es-PE', { maximumFractionDigits: 2 })}%`;
        }
      },

      tooltip: {
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: ${context.parsed.y}%`;
          }
        }
      }
    },

    scales: {
      x: {
        offset: true,
        grid: {
          display: false
        }
      },
      y: {
        min: 80,
        max: 100,
        ticks: {
          stepSize: 5,
          callback: (value) => {
            return value + '%';
          }
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
    const labels = this.datos.map(
      item => this.formatearMes(item.mes)
    );

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Cumplimiento SLA',
          data: this.datos.map(
            item => item.cumplimiento
          ),
          borderColor: '#16835b',
          backgroundColor: '#16835b',
          pointBackgroundColor: '#16835b',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3
        },

        {
          label: 'Objetivo',
          data: this.datos.map(
            item => item.objetivo
          ),
          borderColor: '#ff620f',
          backgroundColor: '#ff620f',
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 5],
          tension: 0
        }
      ]
    };
  }

  private formatearMes(mes: string): string {
    const [year, month] = mes.split('-');
    const meses = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic'
    ];
    const index = Number(month) - 1;
    return meses[index] ?? mes;
  }
}