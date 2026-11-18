
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { IncidentConsolidatedTopProyectos } from '../../../../models/incident-consolidated';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { DailyReportTopProyectos } from '../../../../models/daily-report';

@Component({
  selector: 'app-project-monthly-top',
  standalone: false,
  templateUrl: './project-monthly-top.html',
  styleUrl: './project-monthly-top.css'
})
export class ProjectMonthlyTop implements OnChanges {

  anchoGrafico = 900;
  readonly chartPlugins = [ChartDataLabels];

  @Input() proyectoSeleccionado: string | null = null;
  @Input() periodoSeleccionado: string | null = null;
  @Input() datos: IncidentConsolidatedTopProyectos | DailyReportTopProyectos = { periodos: [], proyectos: [] };
  @Input() entidadConsolidado: 'incidentes' | 'requerimientos' | 'diario' | 'tareas' = 'incidentes';
  @Input() tituloPersonalizado: string | null = null;

  vistaMensual = false;
  proyectoVistaMensual: string | null = null;
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
        //09/11/2026
        offset: true,
        //Fin
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: false,
          font: {
            size: 10
          },

          //09/11/2026
          callback: function (value) {
            const etiqueta = this.getLabelForValue(Number(value));

            const palabras = etiqueta.split(' ');
            const lineas: string[] = [];
            let linea = '';

            for (const palabra of palabras) {
              const siguiente = linea ? `${linea} ${palabra}` : palabra;

              if (siguiente.length > 22 && linea) {
                lineas.push(linea);
                linea = palabra;
              } else {
                linea = siguiente;
              }
            }

            if (linea) {
              lineas.push(linea);
            }

            return lineas;
          }
          //Fin
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
    if (
      changes['datos'] ||
      changes['proyectoSeleccionado'] ||
      changes['periodoSeleccionado']
    ) {
      this.actualizarGrafico();
    }
  }



  private actualizarGrafico(): void {

    const proyectos = this.datos.proyectos ?? [];
    const periodos = this.datos.periodos ?? [];

    // FILTRO DINAMICO MENSUAL
    const periodosVisibles = this.periodoSeleccionado
      ? periodos.filter(periodo => {

        const codigoPeriodo =
          `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;

        return codigoPeriodo === this.periodoSeleccionado;
      })
      : periodos;

    this.chartOptions = {
      ...this.chartOptions,
      plugins: {
        ...this.chartOptions.plugins,
        legend: {
          ...this.chartOptions.plugins?.legend,
          display: periodosVisibles.length > 1
        }
      }
    };

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
      const periodosOrdenados = [...periodosVisibles].sort(
        (a, b) =>
          (a.anio - b.anio) ||
          (a.mes - b.mes)
      );

      this.periodosVistaMensual = periodosOrdenados.map(item => item.periodo);
      //09/11/2026
      this.anchoGrafico = Math.max(
        900,
        periodosOrdenados.length * 85
      );

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
            backgroundColor: periodosOrdenados.map(
              (_, index) => this.colores[index % this.colores.length]
            ),

            borderColor: periodosOrdenados.map(
              (_, index) => this.colores[index % this.colores.length]
            ),

            borderRadius: 4,
            maxBarThickness: 42
            //Fin
          }
        ]
      };
      return;
    }

    this.vistaMensual = false;
    this.proyectoVistaMensual = null;
    this.periodosVistaMensual = [];

    // IDENTIFICAR SI SOLO EXISTE UN MES VISIBLE
    const unSoloMes = periodosVisibles.length === 1;

    // ANCHO ADAPTABLE POR PROYECTO
    const anchoPorProyecto = unSoloMes
      ? 160
      : Math.max(220, periodosVisibles.length * 30 + 50);

    this.anchoGrafico = Math.max(
      900,
      proyectos.length * anchoPorProyecto
    );

    // COLORES POR PROYECTO CUANDO SOLO HAY UN MES
    const coloresPorProyecto = proyectos.map(
      (_, index) => this.colores[index % this.colores.length]
    );

    // CONFIGURACIÓN DEL GRÁFICO
    this.chartData = {

      labels: proyectos.map(
        item => this.limpiarNombreProyecto(item.proyecto)
      ),

      datasets: periodosVisibles.map((periodo, indice) => ({

        label: periodo.periodo,

        data: proyectos.map(proyecto => {

          const registro = proyecto.mensual.find(
            mes => mes.periodo === periodo.periodo
          );

          return registro?.tickets ?? 0;
        }),

        // UN MES: COLOR POR PROYECTO
        // VARIOS MESES: COLOR POR PERIODO
        backgroundColor: unSoloMes
          ? coloresPorProyecto
          : this.colores[indice % this.colores.length],

        borderRadius: 5,

        // BARRAS MÁS ANCHAS CUANDO HAY UN SOLO MES
        maxBarThickness: unSoloMes ? 70 : 24,

        // CENTRADO Y SEPARACIÓN
        barPercentage: unSoloMes ? 0.90 : 0.88,
        categoryPercentage: unSoloMes ? 0.72 : 0.78

      }))
    };




  }
  //09/11/2026
  private limpiarNombreProyecto(nombre: string): string {
    return nombre.replace(/^\s*\d{6}\s*[-–:]?\s*/, '').trim();
  }
  //FIN

}
