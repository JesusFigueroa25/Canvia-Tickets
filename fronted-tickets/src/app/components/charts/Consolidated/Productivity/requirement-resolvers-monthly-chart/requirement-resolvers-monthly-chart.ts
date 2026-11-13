
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import type { Plugin } from 'chart.js';
import Chart from 'chart.js/auto';
import type { ChartDataset, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  RequirementDotacionGrafico,
  RequirementDotacionResumen,
  RequirementDotacionSerie
} from '../../../../../models/requirement-consolidated';

@Component({
  selector: 'app-requirement-resolvers-monthly-chart',
  standalone: false,
  templateUrl: './requirement-resolvers-monthly-chart.html',
  styleUrl: './requirement-resolvers-monthly-chart.css'
})
export class RequirementResolversMonthlyChart
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('resolversCanvas')
  resolversCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() datos: RequirementDotacionGrafico | null = null;
  @Input() resumen: RequirementDotacionResumen | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  proyectoActivo = '';

  private chart: Chart<'bar', number[], string> | null = null;

  readonly colores = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2',
    '#B54708',
    '#667085'
  ];

  private readonly meses = [
    'ENE', 'FEB', 'MAR', 'ABR',
    'MAY', 'JUN', 'JUL', 'AGO',
    'SEP', 'OCT', 'NOV', 'DIC'
  ];

  // ======================================================
  // CICLO DE VIDA
  // ======================================================

  ngAfterViewInit(): void {
    this.crearGrafico();
  }

  ngOnChanges(): void {

    if (
      this.proyectoActivo &&
      !this.datos?.proyectos.some(
        item => item.proyecto === this.proyectoActivo
      )
    ) {
      this.proyectoActivo = '';
    }

    this.actualizarGrafico();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  // ======================================================
  // DATOS VISIBLES
  // ======================================================

  get seriesVisibles(): RequirementDotacionSerie[] {

    const proyectos = this.datos?.proyectos ?? [];

    if (!this.proyectoActivo) {
      return proyectos;
    }

    return proyectos.filter(
      item => item.proyecto === this.proyectoActivo
    );
  }

  get sinDatos(): boolean {
    return (
      !this.datos ||
      this.datos.periodos.length === 0 ||
      this.datos.proyectos.length === 0
    );
  }

  get anchoMinimoGrafico(): number {

    const cantidadMeses = this.datos?.periodos.length ?? 0;

    const espacioPorMes = this.proyectoActivo ? 105 : 155;

    return Math.max(760, cantidadMeses * espacioPorMes);
  }

  // ======================================================
  // FILTRO VISUAL
  // ======================================================

  seleccionarProyecto(evento: Event): void {

    const select = evento.target as HTMLSelectElement;

    this.proyectoActivo = select.value;

    // Solo cambia las series visibles.
    // No altera los filtros globales ni solicita nuevos datos.
    this.actualizarGrafico();
  }

  // ======================================================
  // CREAR CHART.JS
  // ======================================================

  private crearGrafico(): void {

    if (!this.resolversCanvas || this.chart) {
      return;
    }

    const opciones: ChartOptions<'bar'> = {

      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 250
      },

      interaction: {
        mode: 'index',
        intersect: false
      },

      layout: {
        padding: {
          top: 12,
          right: 12,
          bottom: 6,
          left: 6
        }
      },

      scales: {

        x: {
          stacked: false,

          grid: {
            display: false
          },

          border: {
            display: false
          },

          ticks: {
            color: '#667085',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15,

            font: {
              size: 11
            }
          }
        },

        y: {
          stacked: false,
          beginAtZero: true,

          ticks: {
            precision: 0,
            color: '#667085',

            font: {
              size: 11
            },

            callback: (valor) =>
              this.formatearNumero(Number(valor))
          },

          grid: {
            color: '#EEF1F5'
          },

          border: {
            display: false,
            dash: [4, 4]
          },

          title: {
            display: true,
            text: 'Resolutores distintos',
            color: '#667085',

            font: {
              size: 11
            }
          }
        }
      },

      plugins: {

        datalabels: {
          display: false
        },

        legend: {
          display: true,
          position: 'bottom',
          align: 'start',

          labels: {
            color: '#475467',
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 11,
            boxHeight: 11,
            padding: 16,

            font: {
              size: 11
            }
          }
        },

        tooltip: {
          enabled: true,
          backgroundColor: '#101828',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          cornerRadius: 8,
          padding: 12,
          displayColors: true,

          callbacks: {

            title: (items) => {

              const indice = items[0]?.dataIndex ?? -1;

              const periodo =
                this.datos?.periodos[indice] ?? '';

              return this.formatearPeriodoCompleto(periodo);
            },

            label: (context) => {

              const proyecto =
                this.seriesVisibles[context.datasetIndex]
                  ?.proyecto ?? 'Sin especificar';

              const cantidad = context.parsed.y ?? 0;

              return [
                `Proyecto: ${this.nombreVisibleProyecto(proyecto)}`,
                `Resolutores distintos: ${this.formatearNumero(cantidad)}`
              ];
            }
          }
        }
      }
    };

    this.chart = new Chart<'bar', number[], string>(
      this.resolversCanvas.nativeElement,
      {
        type: 'bar',

        data: {
          labels: [],
          datasets: []
        },

        options: opciones,

        plugins: [ChartDataLabels as unknown as Plugin<'bar'>]
      }
    );

    this.actualizarGrafico();
  }

  // ======================================================
  // ACTUALIZAR GRÁFICO
  // ======================================================

  private actualizarGrafico(): void {

    if (!this.chart) {
      return;
    }

    const periodos = this.datos?.periodos ?? [];

    const series = this.seriesVisibles;

    const datasets: ChartDataset<'bar', number[]>[] =
      series.map(serie => {

        const indiceOriginal =
          this.datos?.proyectos.findIndex(
            item => item.proyecto === serie.proyecto
          ) ?? 0;

        const color = this.colores[
          Math.max(0, indiceOriginal) % this.colores.length
        ];

        const valoresPorMes = new Map(
          serie.puntos.map(
            punto => [punto.periodo, punto.resolutores] as const
          )
        );

        return {
          label: this.nombreCortoProyecto(serie.proyecto),

          data: periodos.map(
            periodo => valoresPorMes.get(periodo) ?? 0
          ),

          backgroundColor: color,
          borderColor: color,
          borderWidth: 0,

          borderRadius: 4,
          borderSkipped: false,

          maxBarThickness: 34,
          categoryPercentage: 0.78,
          barPercentage: 0.86
        };
      });

    this.chart.data.labels = periodos.map(
      periodo => this.formatearPeriodo(periodo)
    );

    this.chart.data.datasets = datasets;

    this.chart.update();
  }

  // ======================================================
  // FORMATEO DE MESES
  // ======================================================

  formatearPeriodo(periodo: string): string {

    if (!periodo) {
      return '';
    }

    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    return `${this.meses[mes - 1]} ${String(anio).slice(-2)}`;
  }

  private formatearPeriodoCompleto(periodo: string): string {

    if (!periodo) {
      return '';
    }

    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    return `${this.meses[mes - 1]} ${anio}`;
  }

  // ======================================================
  // FORMATEO DE PROYECTOS
  // ======================================================

  nombreVisibleProyecto(proyecto: string): string {

    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  nombreCortoProyecto(proyecto: string): string {

    const nombre = this.nombreVisibleProyecto(proyecto);

    return nombre.length > 28
      ? `${nombre.slice(0, 28)}…`
      : nombre;
  }

  // ======================================================
  // UTILIDADES
  // ======================================================

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  get textoPeriodo(): string {

    const periodos = this.datos?.periodos ?? [];

    if (!periodos.length) {
      return 'Sin período';
    }

    const primero = this.formatearPeriodo(periodos[0]);

    const ultimo = this.formatearPeriodo(
      periodos[periodos.length - 1]
    );

    return primero === ultimo
      ? primero
      : `${primero} - ${ultimo}`;
  }
}
