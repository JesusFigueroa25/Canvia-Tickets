import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentConsolidatedIncidentesPorcentajesOut } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-incident-percentage-bars',
  standalone: false,
  templateUrl: './incident-percentage-bars.html',
  styleUrl: './incident-percentage-bars.css'
})
export class IncidentPercentageBars implements OnChanges {

  @Input() datos: IncidentConsolidatedIncidentesPorcentajesOut | null = null;
  @Input() cargando = false;
  @Input() limite = 20;
  @Output() limiteChange = new EventEmitter<number>();

  readonly chartPlugins = [ChartDataLabels];
  readonly chartType: 'bar' = 'bar';
  readonly opcionesLimite = [10, 20, 30, 50];

  alturaGrafico = 360;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 12,
        right: 30,
        bottom: 8,
        left: 4
      }
    },

    interaction: {
      mode: 'nearest',
      intersect: false
    },

    scales: {
      x: {
        beginAtZero: true,
        grace: '12%',
        border: {
          display: false
        },

        grid: {
          color: '#edf0f2'
        },

        ticks: {
          color: '#667085',
          font: { size: 11 },
          precision: 0,
          maxTicksLimit: 7
        },

        title: {
          display: true,
          text: 'Número de incidentes',
          color: '#667085',
          font: { size: 11, weight: 'normal' }
        }
      },

      y: {
        border: {
          display: false
        },

        grid: {
          display: false
        },

        ticks: {
          color: '#475467',
          font: { size: 11 },
          autoSkip: false,
          padding: 8,
          callback: (valor) => {
            const indice = Number(valor);
            const descripcion = this.datos?.descripciones[indice]?.descripcion ?? '';
            return descripcion.length > 42 ? descripcion.slice(0, 42) + '...' : descripcion;
          }
        }
      }
    },

    plugins: {

      legend: {
        display: false
      },

      tooltip: {
        enabled: true,
        backgroundColor: '#ffffff',
        titleColor: '#101828',
        bodyColor: '#475467',
        borderColor: '#e5e9ee',
        borderWidth: 1,
        padding: 12,
        displayColors: false,

        callbacks: {

          title: (items) => {
            const indice = items[0]?.dataIndex;
            if (indice === undefined) {
              return '';
            }
            const descripcion = this.datos?.descripciones[indice]?.descripcion ?? '';
            return descripcion.match(/.{1,65}/g) ?? [descripcion];
          },

          label: (context) => {
            const item = this.datos?.descripciones[context.dataIndex];
            return `Incidentes: ${(item?.cantidad ?? 0).toLocaleString('es-PE')}`;
          },

          afterLabel: (context) => {
            const item = this.datos?.descripciones[context.dataIndex];
            return `Participación: ${(item?.porcentaje ?? 0).toFixed(2)} %`;
          }
        }
      },

      datalabels: {
        
        labels: {
          
          cantidad: {
            color: '#667085',
            anchor: 'end',
            align: 'end',
            offset: 5,
            clamp: true,
            font: {
              size: 11,
              weight: 'bold'
            },
            formatter: (valor: number) => {
              return valor.toLocaleString('es-PE');
            }
          },

          porcentaje: {
            color: '#7a3109',
            anchor: 'end',
            align: 'start',
            offset: 5,
            clamp: true,
            font: {
              size: 10,
              weight: 'bold'
            },
            formatter: (_valor, contexto) => {
              const item = this.datos?.descripciones[contexto.dataIndex];
              return item ? `${item.porcentaje.toFixed(2)} %` : '';
            }
          }
        }
      }
    }
  };



  private actualizarGrafico(): void {
    const items = this.datos?.descripciones ?? [];
    this.alturaGrafico = Math.max(
      360,
      items.length * 38 + 95
    );

    this.chartData = {
      labels: items.map(item => item.descripcion),
      datasets: [
        {
          label: 'N.º de incidentes',
          data: items.map(item => item.cantidad),
          backgroundColor: '#ffb184',
          borderColor: '#ff620f',
          hoverBackgroundColor: '#ff9656',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 24,
          barPercentage: 0.78,
          categoryPercentage: 0.9
        }
      ]
    };
  }

  cambiarLimite(valor: number): void {
    if (this.cargando || this.limite === valor) {
      return;
    }
    this.limiteChange.emit(valor);
  }
}