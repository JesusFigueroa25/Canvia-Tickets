
import { Component, Input, OnChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { AuditMonthlyStat } from '../../../../models/requirement-categorization-audit';

@Component({
  selector: 'app-requirement-categorization-monthly-chart',
  standalone: false,
  templateUrl: './requirement-categorization-monthly-chart.html',
  styleUrl: './requirement-categorization-monthly-chart.css'
})
export class RequirementCategorizationMonthlyChart implements OnChanges {

  @Input() datos: AuditMonthlyStat[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

  readonly colorCorrecto = '#16835B';
  readonly colorIncorrecto = '#D95C4F';

  resumen: AuditMonthlyStat[] = [];
  totalTickets = 0;
  totalCorrectos = 0;
  totalIncorrectos = 0;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = this.crearOpciones();

  ngOnChanges(): void {
    this.prepararGrafico();
  }

  private prepararGrafico(): void {

    this.resumen = [...(this.datos ?? [])]
      .filter(item => item.total_tickets > 0)
      .sort((a, b) => a.month.localeCompare(b.month));

    this.totalTickets = this.resumen.reduce(
      (total, item) => total + item.total_tickets, 0
    );

    this.totalCorrectos = this.resumen.reduce(
      (total, item) => total + item.correct_count, 0
    );

    this.totalIncorrectos = this.resumen.reduce(
      (total, item) => total + item.incorrect_count, 0
    );

    this.chartData = {
      labels: this.resumen.map(item => this.obtenerNombreMes(item.month)),
      datasets: [
        {
          label: 'Correctas',
          data: this.resumen.map(item => item.correct_count),
          backgroundColor: this.colorCorrecto,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 58,
          stack: 'auditoria'
        },
        {
          label: 'Incorrectas',
          data: this.resumen.map(item => item.incorrect_count),
          backgroundColor: this.colorIncorrecto,
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 58,
          stack: 'auditoria'
        }
      ]
    };
  }

  private obtenerNombreMes(codigo: string): string {
    const nombres = [
      'Ene', 'Feb', 'Mar', 'Abr',
      'May', 'Jun', 'Jul', 'Ago',
      'Sep', 'Oct', 'Nov', 'Dic'
    ];

    const numeroMes = Number(codigo.slice(5, 7));

    if (numeroMes < 1 || numeroMes > 12) {
      return codigo;
    }

    return `${nombres[numeroMes - 1]} ${codigo.slice(0, 4)}`;
  }

  private crearOpciones(): ChartOptions<'bar'> {

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 350
      },
      layout: {
        padding: {
          top: 14,
          bottom: 5,
          left: 4,
          right: 10
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          stacked: true,
          border: {
            display: false
          },
          grid: {
            display: false
          },
          ticks: {
            color: '#475467',
            autoSkip: true,
            maxRotation: 45,
            font: {
              size: 11
            }
          }
        },
        y: {
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
            precision: 0,
            font: {
              size: 11
            },
            callback: (valor) => Number(valor).toLocaleString('es-PE')
          },
          title: {
            display: true,
            text: 'Cantidad de tickets',
            color: '#667085',
            font: {
              size: 11
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
            title: contextos => {
              const indice = contextos[0]?.dataIndex;
              return indice === undefined
                ? ''
                : this.obtenerNombreMes(this.resumen[indice]?.month ?? '');
            },
            label: context => {
              const item = this.resumen[context.dataIndex];
              const cantidad = Number(context.parsed.y ?? 0);
              const total = item?.total_tickets ?? 0;
              const porcentaje = total > 0
                ? cantidad * 100 / total
                : 0;

              return ` ${context.dataset.label}: ${cantidad.toLocaleString('es-PE')} (${porcentaje.toFixed(2)}%)`;
            },
            afterBody: contextos => {
              const indice = contextos[0]?.dataIndex;

              if (indice === undefined) {
                return '';
              }

              const total = this.resumen[indice]?.total_tickets ?? 0;

              return `Total del mes: ${total.toLocaleString('es-PE')}`;
            }
          }
        },
        datalabels: {
          color: '#FFFFFF',
          font: {
            size: 11,
            weight: 'bold'
          },
          anchor: 'center',
          align: 'center',
          clamp: true,
          display: context => {
            const valor = Number(
              context.dataset.data[context.dataIndex] ?? 0
            );

            return valor >= 10;
          },
          formatter: valor => {
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
