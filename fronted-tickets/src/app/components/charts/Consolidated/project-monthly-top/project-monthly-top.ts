
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { IncidentConsolidatedTopProyectos } from '../../../../models/incident-consolidated';
import ChartDataLabels from 'chartjs-plugin-datalabels';

@Component({
  selector: 'app-project-monthly-top',
  standalone: false,
  templateUrl: './project-monthly-top.html',
  styleUrl: './project-monthly-top.css'
})
export class ProjectMonthlyTop implements OnChanges {

  @Input() datos: IncidentConsolidatedTopProyectos = { periodos: [], proyectos: [] };
  @Input() entidadConsolidado: 'incidentes' | 'requerimientos' = 'incidentes';
  anchoGrafico = 900;
  readonly chartPlugins = [ChartDataLabels];

  @Input() proyectoSeleccionado: string | null = null;

  // Indica qué representación está mostrando el gráfico.
  vistaMensual = false;
  // Nombre del proyecto que aparece en la vista mensual.
  proyectoVistaMensual: string | null = null;
  // Meses utilizados por los tooltips de la vista mensual.
  periodosVistaMensual: string[] = [];


  private readonly colores = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2'
  ];

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };


  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 25
      }
    },

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 3,

        color: '#344054',

        font: {
          size: 10.5,
          weight: 'bold'
        },

        formatter: (value: number) => {
          return value > 0
            ? value.toLocaleString('es-PE')
            : '';
        }
      },

      legend: {
        display: true,
        position: 'top',
        align: 'end',

        labels: {
          boxWidth: 12,
          font: {
            size: 11
          }
        }
      },


      tooltip: {
        callbacks: {
          title: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            if (this.vistaMensual) {
              return this.periodosVistaMensual[indice] ?? '';
            }
            return this.datos.proyectos[indice]?.proyecto ?? '';
          },
          label: (context) => {
            const cantidad = context.parsed.y ?? 0;
            if (this.vistaMensual) {
              return `Tickets: ${cantidad.toLocaleString('es-PE')}`;
            }
            const periodo = context.dataset.label ?? '';
            return `${periodo}: ${cantidad.toLocaleString('es-PE')} tickets`;
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
          maxRotation: 0,
          autoSkip: false,
          font: {
            size: 10
          },

          callback: function (value) {
            const etiqueta = this.getLabelForValue(Number(value));
            return etiqueta.length > 19
              ? etiqueta.slice(0, 16) + '...'
              : etiqueta;
          }
        }
      },

      y: {

        beginAtZero: true,
        grace: '12%',
        grid: {
          color: '#EDF0F2'
        },
        ticks: {
          precision: 0
        }

      }
    }
  };



  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['proyectoSeleccionado']) {
      this.actualizarGrafico();
    }
  }



  private actualizarGrafico(): void {

    const proyectos = this.datos.proyectos ?? [];
    const periodos = this.datos.periodos ?? [];
    const nombreSeleccionado = this.proyectoSeleccionado?.trim().toLowerCase();
    const proyectoFiltrado = nombreSeleccionado
      ? proyectos.find(
        item =>
          item.proyecto.trim().toLowerCase() ===
          nombreSeleccionado
      )
      : undefined;

    if (proyectoFiltrado) {
      this.vistaMensual = true;
      this.proyectoVistaMensual = proyectoFiltrado.proyecto;
      const periodosOrdenados = [...periodos].sort(
        (a, b) =>
          (a.anio - b.anio) ||
          (a.mes - b.mes)
      );

      this.periodosVistaMensual = periodosOrdenados.map(item => item.periodo);
      this.chartData = {
        labels: this.periodosVistaMensual,
        datasets: [
          {
            label: 'Tickets',
            data: periodosOrdenados.map(periodo => {
              const registro = proyectoFiltrado.mensual.find(
                mes => mes.periodo === periodo.periodo
              );
              return registro?.tickets ?? 0;
            }),

            backgroundColor: this.colores[0],
            borderRadius: 4,
            maxBarThickness: 42
          }
        ]
      };
      return;
    }

    this.vistaMensual = false;
    this.proyectoVistaMensual = null;
    this.periodosVistaMensual = [];
    this.anchoGrafico = Math.max(
      900,
      proyectos.length * 110
    );
    this.chartData = {
      labels: proyectos.map(
        item => item.proyecto
      ),
      datasets: periodos.map((periodo, indice) => ({
        label: periodo.periodo,
        data: proyectos.map(proyecto => {
          const registro = proyecto.mensual.find(
            mes => mes.periodo === periodo.periodo
          );
          return registro?.tickets ?? 0;
        }),
        backgroundColor: this.colores[indice % this.colores.length],
        borderRadius: 4,
        maxBarThickness: 22
      }))

    };

  }

}
