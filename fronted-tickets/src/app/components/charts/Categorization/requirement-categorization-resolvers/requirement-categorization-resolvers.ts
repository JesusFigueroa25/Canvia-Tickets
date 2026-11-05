
import { Component, Input, OnChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { AuditResolver } from '../../../../models/requirement-categorization-audit';

interface ResolutorGrafico {
  nombre: string;
  total: number;
  correctos: number;
  incorrectos: number;
}

@Component({
  selector: 'app-requirement-categorization-resolvers',
  standalone: false,
  templateUrl: './requirement-categorization-resolvers.html',
  styleUrl: './requirement-categorization-resolvers.css'
})
export class RequirementCategorizationResolvers implements OnChanges {

  @Input() datos: AuditResolver[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

  readonly colorCorrecto = '#16835B';
  readonly colorIncorrecto = '#D95C4F';

  resumen: ResolutorGrafico[] = [];
  totalTickets = 0;
  totalResolutores = 0;
  alturaGrafico = 280;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = this.crearOpciones();

  ngOnChanges(): void {
    this.prepararGrafico();
  }

  private prepararGrafico(): void {
    this.resumen = (this.datos ?? [])
      .map(item => {
        const correctos = Math.max(0, item.correct_count);
        const incorrectos = Math.max(0, item.incorrect_count);

        return {
          nombre: item.resolver_name?.trim() || 'Sin asignar',
          total: correctos + incorrectos,
          correctos,
          incorrectos
        };
      })
      .filter(item => item.total > 0)
      .sort((a, b) => {
        if (b.incorrectos !== a.incorrectos) {
          return b.incorrectos - a.incorrectos;
        }

        if (b.total !== a.total) {
          return b.total - a.total;
        }

        return a.nombre.localeCompare(b.nombre);
      })
      .slice(0, 10);

    this.totalResolutores = this.resumen.length;

    this.totalTickets = this.resumen.reduce(
      (acumulado, item) => acumulado + item.total,
      0
    );

    this.alturaGrafico = Math.max(
      280,
      this.totalResolutores * 44 + 60
    );

    this.chartData = {
      labels: this.resumen.map(item => item.nombre),
      datasets: [
        {
          label: 'Correctas',
          data: this.resumen.map(item => item.correctos),
          backgroundColor: this.colorCorrecto,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
          stack: 'auditoria'
        },
        {
          label: 'Incorrectas',
          data: this.resumen.map(item => item.incorrectos),
          backgroundColor: this.colorIncorrecto,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
          stack: 'auditoria'
        }
      ]
    };
  }

  private crearOpciones(): ChartOptions<'bar'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: {
        duration: 350
      },
      layout: {
        padding: {
          top: 8,
          bottom: 4,
          left: 4,
          right: 14
        }
      },
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          border: {
            display: false
          },
          grid: {
            color: '#EDF0F2'
          },
          ticks: {
            color: '#667085',
            font: {
              size: 11
            },
            precision: 0,
            maxTicksLimit: 7,
            callback: (valor) => {
              return Number(valor).toLocaleString('es-PE');
            }
          },
          title: {
            display: true,
            text: 'Cantidad de tickets',
            color: '#667085',
            font: {
              size: 11,
              weight: 'normal'
            }
          }
        },
        y: {
          stacked: true,
          border: {
            display: false
          },
          grid: {
            display: false
          },
          ticks: {
            color: '#475467',
            autoSkip: false,
            font: {
              size: 11
            },
            callback: (valor) => {
              const nombre = this.resumen[Number(valor)]?.nombre ?? '';

              return nombre.length > 24
                ? `${nombre.slice(0, 24)}...`
                : nombre;
            }
          }
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
          displayColors: true,
          callbacks: {
            title: (contextos) => {
              const indice = contextos[0]?.dataIndex;

              if (indice === undefined) {
                return '';
              }

              return this.resumen[indice]?.nombre ?? '';
            },
            label: (context) => {
              const item = this.resumen[context.dataIndex];
              const cantidad = Number(context.parsed.x ?? 0);
              const total = item?.total ?? 0;

              const porcentaje = total > 0
                ? (cantidad / total) * 100
                : 0;

              const nombre = context.dataset.label ?? '';

              return ` ${nombre}: ${cantidad.toLocaleString('es-PE')} tickets (${porcentaje.toFixed(1)}%)`;
            },
            afterBody: (contextos) => {
              const indice = contextos[0]?.dataIndex;

              if (indice === undefined) {
                return '';
              }

              const total = this.resumen[indice]?.total ?? 0;

              return `Total del resolutor: ${total.toLocaleString('es-PE')}`;
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: {
            size: 10,
            weight: 'bold'
          },
          anchor: 'center',
          align: 'center',
          clamp: true,
          display: (context) => {
            const valor = Number(
              context.dataset.data[context.dataIndex] ?? 0
            );

            return valor >= 3;
          },
          formatter: (valor) => {
            const cantidad = Number(valor);

            return cantidad > 0
              ? cantidad.toLocaleString('es-PE')
              : '';
          }
        }
      }
    };
  }

  get tieneDatos(): boolean {
    return this.totalTickets > 0;
  }
}
