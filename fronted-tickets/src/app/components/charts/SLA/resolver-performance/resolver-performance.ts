
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentSLAResolutorItem } from '../../../../models/incident-sla';
import { RequirementSLAResolutorItem } from '../../../../models/requirement-sla';

interface ResolverVisible {
  resolutor: string;
  tickets: number;
  sla: number | null;
}

@Component({
  selector: 'app-resolutor-performance',
  standalone: false,
  templateUrl: './resolver-performance.html',
  styleUrl: './resolver-performance.css'
})
export class ResolverPerformance implements OnChanges {

  @Input() datos: IncidentSLAResolutorItem[] | RequirementSLAResolutorItem[] = [];
  @Input() entidad: 'incidentes' | 'requerimientos' = 'incidentes';

  datosVisibles: ResolverVisible[] = [];
  totalTickets = 0;

  readonly chartPlugins = [ChartDataLabels];

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = this.crearOpciones(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['entidad']) {
      this.actualizarGrafico();
    }
  }

  private crearOpciones(esRequerimientos: boolean): ChartOptions<'bar'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',

      layout: {
        padding: {
          right: 75
        }
      },

      interaction: {
        mode: 'nearest',
        intersect: true
      },

      plugins: {

        datalabels: {
          display: (context) => {
            const valor = context.dataset.data[context.dataIndex];
            return typeof valor === 'number' && valor > 0;
          },

          anchor: 'end',
          align: 'end',
          offset: 5,

          color: '#344054',

          font: {
            size: 11,
            weight: 'bold'
          },

          formatter: (value: number) => {
            return value.toLocaleString('es-PE');
          }
        },

        legend: {
          display: false
        },

        tooltip: {
          callbacks: {

            // Nombre completo del resolutor
            title: (items) => {
              const index = items[0]?.dataIndex ?? -1;
              return this.datosVisibles[index]?.resolutor
                ?? 'Sin resolutor';
            },

            label: (context) => {

              const item = this.datosVisibles[context.dataIndex];

              if (!item) {
                return '';
              }

              // REQUERIMIENTOS SLA
              if (esRequerimientos) {

                const participacion = this.totalTickets > 0
                  ? item.tickets * 100 / this.totalTickets
                  : 0;

                return [
                  `Requerimientos: ${item.tickets.toLocaleString('es-PE')}`,
                  `Participación: ${participacion.toFixed(1)}%`
                ];
              }

              // INCIDENTES SLA
              return [
                `Tickets: ${item.tickets.toLocaleString('es-PE')}`,
                `SLA: ${(item.sla ?? 0).toFixed(1)}%`
              ];
            }
          }
        }
      },

      scales: {

        x: esRequerimientos
          ? {
            // REQUERIMIENTOS SLA
            type: 'linear' as const,
            min: 0,
            beginAtZero: true,

            title: {
              display: true,
              text: 'Requerimientos'
            },

            ticks: {
              color: '#667085',
              precision: 0,

              callback: (value) => {
                const numero = Number(value);
                if (numero >= 1000) {
                  return (numero / 1000).toFixed(
                    numero >= 10000 ? 0 : 1
                  ) + 'k';
                }
                return numero;
              }
            },

            grid: {
              color: '#edf0f2'
            }
          }

          : {
            // INCIDENTES SLA
            type: 'logarithmic' as const,
            min: 1,

            title: {
              display: true,
              text: 'Tickets · escala logarítmica'
            },

            ticks: {
              color: '#667085',
              callback: (value) => {
                const numero = Number(value);
                if (numero >= 1000) {
                  return (numero / 1000).toFixed(
                    numero >= 10000 ? 0 : 1
                  ) + 'k';
                }
                return numero;
              }
            },

            grid: {
              color: '#edf0f2'
            }
          },

        y: {
          grid: {
            display: false
          },

          ticks: {
            autoSkip: false,
            color: '#667085',
            font: {
              size: esRequerimientos ? 10 : 11
            }
          }
        }
      }
    };
  }

  private actualizarGrafico(): void {
    const esRequerimientos = this.entidad === 'requerimientos';
    this.chartOptions = this.crearOpciones(esRequerimientos);
    if (!this.datos.length) {
      this.datosVisibles = [];
      this.totalTickets = 0;
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }


    // NORMALIZAR DATOS
    const registros: ResolverVisible[] = this.datos.map(item => {
      if ('cantidad' in item) {
        return {
          resolutor: item.resolutor ?? 'Sin resolutor',
          tickets: item.cantidad,
          sla: null
        };
      }
      return {
        resolutor: item.resolutor ?? 'Sin resolutor',
        tickets: item.tickets,
        sla: item.sla
      };
    });


    // Total global antes de aplicar Top 10
    this.totalTickets = registros.reduce(
      (total, item) => total + item.tickets,
      0
    );

    // Top 10 ordenado por cantidad
    this.datosVisibles = [...registros]
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 10);

    const colores = this.datosVisibles.map(item => {

      if (esRequerimientos) {
        return '#ffb184';
      }

      return this.obtenerColorSla(item.sla ?? 0);
    });

    const coloresBorde = this.datosVisibles.map(item => {

      if (esRequerimientos) {
        return '#ff620f';
      }

      return this.obtenerColorSla(item.sla ?? 0);
    });


    this.chartData = {

      labels: this.datosVisibles.map(
        item => this.acortarTexto(
          item.resolutor,
          esRequerimientos ? 22 : 25
        )
      ),

      datasets: [
        {
          label: esRequerimientos ? 'Requerimientos' : 'Tickets',
          data: this.datosVisibles.map(
            item => item.tickets
          ),
          backgroundColor: colores,
          borderColor: coloresBorde,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: esRequerimientos ? 15 : 16
        }
      ]
    };
  }

  private obtenerColorSla(sla: number): string {
    if (sla >= 95) {
      return '#16835b';
    }
    if (sla >= 90) {
      return '#ff8a42';
    }
    return '#d95c4f';
  }


  private acortarTexto(texto: string, limite: number): string {
    if (texto.length <= limite) {
      return texto;
    }
    return texto.substring(0, limite) + '...';
  }

}
