
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

import Chart from 'chart.js/auto';
import type { ChartDataset, ChartOptions } from 'chart.js';
import 'chartjs-plugin-datalabels';

import {
  RequirementProductividadGrafico,
  RequirementProductividadResumen,
  RequirementProductividadGranularidad,
  RequirementProductividadSerie
} from '../../../../../models/requirement-consolidated';


@Component({
  selector: 'app-requirement-productivity-evolution',
  standalone: false,
  templateUrl: './requirement-productivity-evolution.html',
  styleUrl: './requirement-productivity-evolution.css'
})
export class RequirementProductivityEvolution
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('productivityCanvas')
  productivityCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() datos: RequirementProductividadGrafico | null = null;
  @Input() resumen: RequirementProductividadResumen | null = null;
  @Input() granularidad: RequirementProductividadGranularidad = 'mes';
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() granularidadChange =
    new EventEmitter<RequirementProductividadGranularidad>();

  proyectoActivo = '';

  private chart: Chart<'line', number[], string> | null = null;

  readonly colores: string[] = [
    '#FF620F',
    '#16835B',
    '#D97706',
    '#12633F',
    '#FFB184',
    '#63B891',
    '#F4C95D',
    '#A8DCC2',
    '#B54708',
    '#667085'
  ];

  private readonly meses = [
    'ENE', 'FEB', 'MAR', 'ABR',
    'MAY', 'JUN', 'JUL', 'AGO',
    'SEP', 'OCT', 'NOV', 'DIC'
  ];


  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  ngAfterViewInit(): void {
    this.crearGrafico();
  }

  ngOnChanges(): void {

    // Restaurar la selección si el proyecto desapareció
    // por cambios en los filtros globales.
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


  // ============================================================
  // PROYECTOS VISIBLES
  // ============================================================

  get seriesVisibles(): RequirementProductividadSerie[] {

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


  // ============================================================
  // FILTROS LOCALES DEL GRÁFICO
  // ============================================================

  seleccionarGranularidad(
    valor: RequirementProductividadGranularidad
  ): void {

    if (
      this.cargando ||
      this.granularidad === valor
    ) {
      return;
    }

    this.granularidadChange.emit(valor);
  }

  seleccionarProyecto(evento: Event): void {

    const select = evento.target as HTMLSelectElement;

    this.proyectoActivo = select.value;

    // Es un filtro visual.
    // No modifica los filtros globales del dashboard.
    this.actualizarGrafico();
  }


  // ============================================================
  // CREACIÓN CHART.JS
  // ============================================================

  private crearGrafico(): void {

    if (!this.productivityCanvas) {
      return;
    }

    const opciones: ChartOptions<'line'> = {

      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 250
      },

      interaction: {
        mode: 'index',
        intersect: false
      },

      elements: {
        line: {
          tension: 0.25,
          borderWidth: 2
        },
        point: {
          radius: 2,
          hoverRadius: 5,
          hitRadius: 9
        }
      },

      scales: {

        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#667085',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
            font: {
              size: 11
            }
          },
          border: {
            display: false
          }
        },

        y: {
          beginAtZero: true,

          ticks: {
            color: '#667085',
            precision: 0,
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
            text: 'Cantidad de requerimientos',
            color: '#667085',
            font: {
              size: 11
            }
          }
        }
      },

      plugins: {

        // Evitar etiquetas sobre todas las líneas.
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
            pointStyle: 'circle',
            boxWidth: 9,
            boxHeight: 9,
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
          padding: 12,
          cornerRadius: 8,
          displayColors: true,

          callbacks: {

            title: (items) => {

              const indice = items[0]?.dataIndex ?? -1;

              const periodo =
                this.datos?.periodos[indice] ?? '';

              return this.formatearPeriodoCompleto(periodo);
            },

            label: (context) => {

              const serie =
                this.seriesVisibles[context.datasetIndex];

              const proyecto =
                serie?.proyecto ??
                context.dataset.label ??
                'Sin especificar';

              const cantidad = context.parsed.y ?? 0;

              return `${proyecto}: ${this.formatearNumero(cantidad)} tickets`;
            }
          }
        }
      }
    };

    this.chart = new Chart<'line', number[], string>(
      this.productivityCanvas.nativeElement,
      {
        type: 'line',

        data: {
          labels: [],
          datasets: []
        },

        options: opciones
      }
    );

    this.actualizarGrafico();
  }


  // ============================================================
  // ACTUALIZACIÓN DEL GRÁFICO
  // ============================================================

  private actualizarGrafico(): void {

    if (!this.chart) {
      return;
    }

    const periodos = this.datos?.periodos ?? [];

    const series = this.seriesVisibles;

    const datasets: ChartDataset<'line', number[]>[] =
      series.map(serie => {

        const indiceColor =
          this.datos?.proyectos.findIndex(
            item => item.proyecto === serie.proyecto
          ) ?? 0;

        const color = this.colores[
          Math.max(0, indiceColor) % this.colores.length
        ];

        const mapaTickets = new Map(
          serie.puntos.map(
            punto => [punto.periodo, punto.tickets] as const
          )
        );

        return {
          label: this.nombreCortoProyecto(serie.proyecto),

          data: periodos.map(
            periodo => mapaTickets.get(periodo) ?? 0
          ),

          borderColor: color,
          backgroundColor: color,

          pointBackgroundColor: color,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1,

          pointRadius: periodos.length > 35 ? 0 : 2,
          pointHoverRadius: 5,

          borderWidth: 2,
          tension: 0.25,
          fill: false,
          spanGaps: false
        };
      });

    this.chart.data.labels = periodos.map(
      periodo => this.formatearEtiquetaPeriodo(periodo)
    );

    this.chart.data.datasets = datasets;

    this.chart.update();
  }


  // ============================================================
  // FORMATEO DE PERÍODOS
  // ============================================================

  formatearEtiquetaPeriodo(periodo: string): string {

    if (!periodo) {
      return '';
    }

    const partes = periodo.split('-').map(Number);

    const anio = partes[0];
    const mes = partes[1];
    const dia = partes[2];

    if (!anio || !mes) {
      return periodo;
    }

    if (this.granularidad === 'mes') {
      return `${this.meses[mes - 1]} ${String(anio).slice(-2)}`;
    }

    if (!dia) {
      return periodo;
    }

    if (this.granularidad === 'semana') {
      return `Sem. ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
    }

    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(anio).slice(-2)}`;
  }


  private formatearPeriodoCompleto(periodo: string): string {

    if (!periodo) {
      return '';
    }

    if (this.granularidad === 'semana') {
      return `Semana que inicia el ${periodo}`;
    }

    if (this.granularidad === 'dia') {
      return `Fecha: ${periodo}`;
    }

    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes) {
      return periodo;
    }

    return `${this.meses[mes - 1]} ${anio}`;
  }


  // ============================================================
  // FORMATEO DE PROYECTOS
  // ============================================================

  nombreVisibleProyecto(proyecto: string): string {

    // Ocultar código ALP inicial en la etiqueta visual,
    // sin modificar el nombre original del backend.
    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  nombreCortoProyecto(proyecto: string): string {

    const nombre = this.nombreVisibleProyecto(proyecto);

    if (nombre.length <= 30) {
      return nombre;
    }

    return `${nombre.substring(0, 30)}…`;
  }


  // ============================================================
  // UTILIDADES
  // ============================================================

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  get textoRango(): string {

    const desde = this.resumen?.fecha_desde;
    const hasta = this.resumen?.fecha_hasta;

    if (!desde || !hasta) {
      return 'Sin período disponible';
    }

    return `${desde} al ${hasta}`;
  }

}
