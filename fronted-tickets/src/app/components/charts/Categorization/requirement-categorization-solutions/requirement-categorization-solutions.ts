
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { AuditSummary } from '../../../../models/requirement-categorization-audit';

interface EstadoSolucionItem {
  categoria: string;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

@Component({
  selector: 'app-requirement-categorization-solutions',
  standalone: false,
  templateUrl: './requirement-categorization-solutions.html',
  styleUrl: './requirement-categorization-solutions.css'
})
export class RequirementCategorizationSolutions implements OnChanges {

  @Input() datos: AuditSummary | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

  private readonly condiciones = [
    {
      categoria: 'Solución registrada',
      etiqueta: 'Registrada',
      color: '#16835B'
    },
    {
      categoria: 'Solución obligatoria faltante',
      etiqueta: 'Obligatoria',
      color: '#D95C4F'
    },
    {
      categoria: 'Solución opcional ausente',
      etiqueta: 'Opcional',
      color: '#FFB184'
    },
    {
      categoria: 'Estado por verificar',
      etiqueta: 'Por verificar',
      color: '#D97706'
    }
  ];

  resumen: EstadoSolucionItem[] = [];
  totalTickets = 0;
  datosInconsistentes = false;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = this.crearOpciones();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararGrafico();
    }
  }

  private prepararGrafico(): void {
    this.totalTickets = this.datos?.processed_tickets ?? 0;

    const obligatorias = this.datos?.missing_required_solution_count ?? 0;
    const opcionales = this.datos?.optional_missing_solution_count ?? 0;
    const porVerificar = this.datos?.review_solution_status_count ?? 0;

    const sinSolucion = obligatorias + opcionales + porVerificar;

    this.datosInconsistentes =
      this.totalTickets < 0 ||
      obligatorias < 0 ||
      opcionales < 0 ||
      porVerificar < 0 ||
      sinSolucion > this.totalTickets;

    if (this.datosInconsistentes) {
      this.resumen = [];
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }

    const registradas = this.totalTickets - sinSolucion;

    const cantidades = [
      registradas,
      obligatorias,
      opcionales,
      porVerificar
    ];

    this.resumen = this.condiciones.map((condicion, indice) => {
      const cantidad = cantidades[indice];

      return {
        categoria: condicion.categoria,
        etiqueta: condicion.etiqueta,
        cantidad,
        porcentaje: this.totalTickets > 0
          ? (cantidad / this.totalTickets) * 100
          : 0,
        color: condicion.color
      };
    });

    this.chartData = {
      labels: this.resumen.map(item => item.etiqueta),
      datasets: [
        {
          label: 'Tickets',
          data: this.resumen.map(item => item.cantidad),
          backgroundColor: this.resumen.map(item => item.color),
          borderColor: this.resumen.map(item => item.color),
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          maxBarThickness: 65,
          categoryPercentage: 0.8,
          barPercentage: 0.7
        }
      ]
    };
  }

  private crearOpciones(): ChartOptions<'bar'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      animation: {
        duration: 350
      },
      layout: {
        padding: {
          top: 28,
          right: 12,
          bottom: 4,
          left: 4
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
            title: (items) => {
              const indice = items[0]?.dataIndex ?? -1;
              return this.resumen[indice]?.categoria ?? '';
            },
            label: (context) => {
              const item = this.resumen[context.dataIndex];

              if (!item) {
                return '';
              }

              return `Tickets: ${item.cantidad.toLocaleString('es-PE')}`;
            },
            afterLabel: (context) => {
              const item = this.resumen[context.dataIndex];

              if (!item) {
                return '';
              }

              return `Participación: ${item.porcentaje.toFixed(2)}%`;
            }
          }
        },
        datalabels: {
          display: (context) => {
            const cantidad = Number(
              context.dataset.data[context.dataIndex] ?? 0
            );

            return cantidad > 0;
          },
          anchor: 'end',
          align: 'end',
          offset: 4,
          color: '#344054',
          font: {
            size: 12,
            weight: 'bold'
          },
          formatter: (valor: number) => {
            return valor.toLocaleString('es-PE');
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            color: '#475467',
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grace: '15%',
          grid: {
            color: '#EDF0F2'
          },
          border: {
            display: false
          },
          ticks: {
            color: '#667085',
            precision: 0,
            maxTicksLimit: 7,
            font: {
              size: 11
            },
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
        }
      }
    };
  }

  get tieneDatos(): boolean {
    return this.totalTickets > 0 && !this.datosInconsistentes;
  }
}
