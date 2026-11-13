
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';

import Chart from 'chart.js/auto';
import type { ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  RequirementAtencionParalelaGraficoItem,
  RequirementAtencionParalelaResumen
} from '../../../../../models/requirement-consolidated';

type MetricaParalela =
  | 'eventos'
  | 'tickets_con_superposicion'
  | 'maximo_simultaneos';

@Component({
  selector: 'app-requirement-parallel-attention-chart',
  standalone: false,
  templateUrl: './requirement-parallel-attention-chart.html',
  styleUrl: './requirement-parallel-attention-chart.css'
})
export class RequirementParallelAttentionChart
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('parallelCanvas')
  parallelCanvas?: ElementRef<HTMLCanvasElement>;

  @Input()
  datos: RequirementAtencionParalelaGraficoItem[] = [];

  @Input()
  resumen: RequirementAtencionParalelaResumen | null = null;

  @Input()
  cargando = false;

  @Input()
  error: string | null = null;

  metrica: MetricaParalela = 'eventos';

  private chart: Chart<'bar', number[], string> | null = null;

  readonly colorPrincipal = '#FF620F';
  readonly colorSecundario = '#16835B';
  readonly colorTerciario = '#D97706';

  // ==========================================================
  // CICLO DE VIDA
  // ==========================================================

  ngAfterViewInit(): void {
    this.crearGrafico();
  }

  ngOnChanges(): void {
    this.actualizarGrafico();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  // ==========================================================
  // MÉTRICA Y DATOS
  // ==========================================================

  get datosOrdenados(): RequirementAtencionParalelaGraficoItem[] {

    return [...(this.datos ?? [])].sort((a, b) => {

      const diferencia = b[this.metrica] - a[this.metrica];

      if (diferencia !== 0) {
        return diferencia;
      }

      return a.resolutor.localeCompare(
        b.resolutor,
        'es',
        { sensitivity: 'base' }
      );
    });
  }

  get sinDatos(): boolean {
    return !this.datos || this.datos.length === 0;
  }

  get etiquetaMetrica(): string {

    switch (this.metrica) {
      case 'eventos':
        return 'Eventos de superposición';

      case 'tickets_con_superposicion':
        return 'Tickets con superposición';

      case 'maximo_simultaneos':
        return 'Máximo de tickets simultáneos';
    }
  }

  get descripcionMetrica(): string {

    switch (this.metrica) {
      case 'eventos':
        return 'Cantidad de eventos de coincidencia detectados por resolutor.';

      case 'tickets_con_superposicion':
        return 'Tickets cuyos intervalos se superponen con otros tickets del mismo resolutor.';

      case 'maximo_simultaneos':
        return 'Mayor cantidad de tickets con intervalos coincidentes por resolutor.';
    }
  }

  get colorMetrica(): string {

    switch (this.metrica) {
      case 'eventos':
        return this.colorPrincipal;

      case 'tickets_con_superposicion':
        return this.colorSecundario;

      case 'maximo_simultaneos':
        return this.colorTerciario;
    }
  }

  get alturaGrafico(): number {

    const cantidad = this.datosOrdenados.length;

    return Math.max(360, cantidad * 43 + 90);
  }

  cambiarMetrica(evento: Event): void {

    const select = evento.target as HTMLSelectElement;

    const valor = select.value;

    if (
      valor !== 'eventos' &&
      valor !== 'tickets_con_superposicion' &&
      valor !== 'maximo_simultaneos'
    ) {
      return;
    }

    if (this.metrica === valor) {
      return;
    }

    this.metrica = valor;

    // La selección modifica solamente el gráfico.
    // No requiere una nueva petición HTTP.
    this.actualizarGrafico();
  }

  // ==========================================================
  // CREAR GRÁFICO CHART.JS
  // ==========================================================

  private crearGrafico(): void {

    if (!this.parallelCanvas || this.chart) {
      return;
    }

    const opciones: ChartOptions<'bar'> = {

      indexAxis: 'y',

      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 250
      },

      interaction: {
        mode: 'nearest',
        intersect: false
      },

      layout: {
        padding: {
          top: 10,
          right: 36,
          bottom: 6,
          left: 6
        }
      },

      scales: {

        x: {
          beginAtZero: true,

          ticks: {
            precision: 0,
            color: '#667085',

            font: {
              size: 11
            },

            callback: valor =>
              this.formatearNumero(Number(valor))
          },

          grid: {
            color: '#EEF1F5'
          },

          border: {
            display: false
          },

          title: {
            display: true,
            text: 'Cantidad',
            color: '#667085',

            font: {
              size: 11
            }
          }
        },

        y: {
          grid: {
            display: false
          },

          border: {
            display: false
          },

          ticks: {
            color: '#475467',
            autoSkip: false,

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

        datalabels: {
          display: context => {

            const valor = Number(
              context.dataset.data[context.dataIndex] ?? 0
            );

            return valor > 0;
          },

          anchor: 'end',
          align: 'end',
          offset: 4,

          color: '#344054',

          font: {
            size: 11,
            weight: 'bold'
          },

          formatter: valor =>
            this.formatearNumero(Number(valor))
        },

        tooltip: {
          enabled: true,
          backgroundColor: '#101828',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          cornerRadius: 8,
          padding: 12,
          displayColors: false,

          callbacks: {

            title: items => {

              const indice = items[0]?.dataIndex ?? -1;

              return this.datosOrdenados[indice]?.resolutor ?? '';
            },

            label: context => {

              const item = this.datosOrdenados[
                context.dataIndex
              ];

              if (!item) {
                return '';
              }

              return [
                `Eventos de superposición: ${this.formatearNumero(item.eventos)}`,
                `Tickets con superposición: ${this.formatearNumero(item.tickets_con_superposicion)}`,
                `Máximo simultáneo: ${this.formatearNumero(item.maximo_simultaneos)}`
              ];
            }
          }
        }
      }
    };

    this.chart = new Chart<'bar', number[], string>(
      this.parallelCanvas.nativeElement,
      {
        type: 'bar',

        data: {
          labels: [],
          datasets: []
        },

        options: opciones,

        plugins: [ChartDataLabels]
      }
    );

    this.actualizarGrafico();
  }

  // ==========================================================
  // ACTUALIZAR GRÁFICO
  // ==========================================================

  private actualizarGrafico(): void {

    if (!this.chart) {
      return;
    }

    const items = this.datosOrdenados;

    this.chart.data.labels = items.map(
      item => this.nombreCortoResolutor(item.resolutor)
    );

    this.chart.data.datasets = [
      {
        label: this.etiquetaMetrica,

        data: items.map(
          item => item[this.metrica]
        ),

        backgroundColor: this.colorMetrica,
        borderColor: this.colorMetrica,

        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,

        maxBarThickness: 25,
        categoryPercentage: 0.78,
        barPercentage: 0.84
      }
    ];

    this.chart.update();
  }

  // ==========================================================
  // FORMATEO
  // ==========================================================

  nombreCortoResolutor(nombre: string): string {

    const texto = nombre?.trim() || 'Sin especificar';

    return texto.length > 29
      ? `${texto.substring(0, 29)}…`
      : texto;
  }

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }
}
