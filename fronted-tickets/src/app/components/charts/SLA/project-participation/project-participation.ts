import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLAParticipacionProyectoItem } from '../../../../models/requirement-sla';

@Component({
  selector: 'app-project-participation',
  standalone: false,
  templateUrl: './project-participation.html',
  styleUrl: './project-participation.css'
})
export class ProjectParticipation

  implements OnChanges {
  @Input() datos: RequirementSLAParticipacionProyectoItem[] = [];
  readonly chartPlugins = [ChartDataLabels];
  chartData: ChartData<'doughnut', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions:
    ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      interaction: {
        mode: 'nearest',
        intersect: true
      },

      plugins: {
        
        datalabels: {
          display: (context) => {
            const valor = Number(
              context.dataset.data[context.dataIndex] ?? 0
            );
            return valor >= 5;
          },
          anchor: 'center',
          align: 'center',
          offset: 0,
          color: (context) => {
            const indice = context.dataIndex;
            return [0, 4, 6, 7].includes(indice)
              ? '#ffffff'
              : '#101828';
          },

          font: {
            size: 11,
            weight: 'bold'
          },

          formatter: (value: number) => {
            return `${value.toLocaleString('es-PE', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1
            })}%`;
          }
        },
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            color: '#475467',
            font: {
              size: 11
            },

            generateLabels: (chart) => {
              const data = chart.data;
              if (!data.labels || !data.datasets.length) {
                return [];
              }
              const dataset = data.datasets[0];
              return data.labels.map(
                (label, index) => {
                  const background = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[index] : dataset.backgroundColor;
                  return {
                    text: this.acortarTexto(String(label), 28),
                    fillStyle: String(background),
                    strokeStyle: String(background),
                    lineWidth: 0,
                    hidden: false,
                    index,
                    pointStyle: 'circle'
                  };
                }
              );
            }
          }
        },

        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items.length) {
                return '';
              }
              const index = items[0].dataIndex;
              return (this.datos[index]?.proyecto ?? 'Sin proyecto');
            },

            label: (context) => {
              const item = this.datos[context.dataIndex];
              if (!item) {
                return '';
              }
              return [
                `Participación: ${item.participacion.toFixed(1)}%`,
                `Tickets: ${item.tickets.toLocaleString('es-PE')}`
              ];
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
    if (!this.datos.length) {
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }

    this.chartData = {
      labels: this.datos.map(item => item.proyecto ?? 'Sin proyecto'),
      datasets: [
        {
          label: 'Participación',
          data: this.datos.map(item => item.participacion),
          backgroundColor: [
            '#16835b',
            '#ff620f',
            '#63b891',
            '#f59a5b',
            '#3f6f8f',
            '#82c8aa',
            '#d9773f',
            '#6f8fa6',
            '#a5d8c1',
            '#98a2b3'
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverBorderWidth: 3,
          hoverOffset: 5
        }
      ]
    };
  }
  private acortarTexto(
    texto: string,
    limite: number
  ): string {
    if (texto.length <= limite) {
      return texto;
    }
    return (
      texto.substring(
        0,
        limite
      ) + '...'
    );

  }

}