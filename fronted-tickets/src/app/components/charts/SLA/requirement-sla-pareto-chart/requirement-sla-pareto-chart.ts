
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLAParetoGraficoItem, RequirementSLAParetoGraficoOut } from '../../../../models/requirement-sla';

@Component({
  selector: 'app-requirement-sla-pareto-chart',
  standalone: false,
  templateUrl: './requirement-sla-pareto-chart.html',
  styleUrl: './requirement-sla-pareto-chart.css'
})
export class RequirementSlaParetoChart implements OnChanges {

  @Input() datos: RequirementSLAParetoGraficoOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartType: 'bar' | 'line' = 'bar';
  readonly chartPlugins = [
    ChartDataLabels
  ];

  readonly colorBarras = '#275DDE';
  readonly colorBarrasSecundarias = '#A6BCD9';
  readonly colorLinea = '#D97706';
  readonly colorUmbral = '#FF620F';

  serie: RequirementSLAParetoGraficoItem[] = [];
  totalCategorias = 0;
  categoriasConIncumplimientos = 0;
  totalIncumplimientos = 0;
  categoriasPara80 = 0;
  porcentajeCategoriasPara80 = 0;
  porcentajeIncumplimientosCubiertos = 0;
  anchoGrafico = 900;
  readonly alturaGrafico = 440;

  chartData: ChartData<'bar' | 'line', number[], string> = {
    labels: [],
    datasets: []
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararGrafico();
    }
  }


  chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 350
    },

    layout: {
      padding: {
        top: 30,
        right: 12,
        left: 8,
        bottom: 8
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
          color: '#475467',
          autoSkip: false,
          minRotation: 35,
          maxRotation: 45,

          font: {
            size: 11,
            weight: 'bold'
          },

          callback: (_valor, index) => {
            const categoria = this.serie[index]?.categoria ?? '';
            return this.abreviarTexto(categoria, 17);
          }
        }
      },

      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        grace: '15%',

        title: {
          display: true,
          text: 'Req. no cumplidos',
          color: '#475467',
          font: {
            size: 11,
            weight: 'bold'
          }
        },

        grid: {
          color: '#EDF0F2'
        },

        border: {
          display: false
        },

        ticks: {
          color: '#667085',
          precision: 0,
          font: {
            size: 11
          },
          callback: (valor) => {
            return Number(valor).toLocaleString('es-PE');
          }
        }
      },

      y1: {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: '% acumulado',
          color: '#D97706',

          font: {
            size: 11,
            weight: 'bold'
          }
        },

        grid: {
          drawOnChartArea: false
        },

        border: {
          display: false
        },

        ticks: {
          color: '#D97706',
          stepSize: 20,
          font: {
            size: 11
          },
          callback: (valor) => {
            return `${Number(valor)}%`;
          }
        }
      }

    },

    interaction: {
      intersect: false,
      mode: 'index'
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
        filter: (context) => {
          return context.datasetIndex !== 2;
        },

        callbacks: {
          title: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            return this.serie[indice]?.categoria ?? '';
          },

          label: (context) => {
            const item = this.serie[context.dataIndex];
            if (!item) {
              return '';
            }

            if (context.datasetIndex === 0) {
              return (' No cumplidos: ' + item.incumplidos.toLocaleString('es-PE'));
            }
            return (' % Acumulado: ' + item.porcentaje_acumulado.toFixed(2) + '%');
          },

          afterBody: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            const item = this.serie[indice];
            if (!item) {
              return [];
            }

            return [
              'Ranking: ' + item.ranking,
              'Participación: ' +
              item.porcentaje_req.toFixed(2) + '%',
              'Incumplidos acumulados: ' +
              item.incumplidos_acumulados.toLocaleString('es-PE'),
              'Semáforo: ' + item.semaforo
            ];
          }

        }
      },


      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 3,
        clamp: true,
        clip: false,
        color: '#275DDE',
        font: {
          size: 10,
          weight: 'bold'
        },

        display: (context) => {
          if (context.datasetIndex !== 0) {
            return false;
          }
          const valor = Number(
            context.dataset.data[context.dataIndex] ?? 0
          );
          return valor > 0;
        },

        formatter: (valor: number) => {
          return Number(valor).toLocaleString('es-PE');
        }

      }

    }

  };


  private abreviarTexto(texto: string, longitudMaxima: number): string {
    if (texto.length <= longitudMaxima) {
      return texto;
    }
    return texto.substring(0, longitudMaxima - 1) + '…';
  }

  private prepararGrafico(): void {
    this.totalCategorias = this.datos?.total_categorias ?? 0;
    this.categoriasConIncumplimientos = this.datos?.categorias_con_incumplimientos ?? 0;
    this.totalIncumplimientos = this.datos?.total_incumplimientos ?? 0;
    this.categoriasPara80 = this.datos?.categorias_para_80 ?? 0;
    this.porcentajeCategoriasPara80 = this.datos?.porcentaje_categorias_para_80 ?? 0;
    this.porcentajeIncumplimientosCubiertos = this.datos?.porcentaje_incumplimientos_cubiertos ?? 0;

    this.serie = [
      ...(this.datos?.serie ?? [])
    ];

    this.anchoGrafico = Math.max(
      900,
      this.serie.length * 100
    );

    this.chartData = {

      labels: this.serie.map(
        item => item.categoria
      ),

      datasets: [
        {
          type: 'bar',
          label: 'Req. no cumplidos',
          data: this.serie.map(
            item => item.incumplidos
          ),

          yAxisID: 'y',
          backgroundColor: this.serie.map(
            (_, indice) => {

              return indice < this.categoriasPara80
                ? this.colorBarras
                : this.colorBarrasSecundarias;
            }
          ),
          hoverBackgroundColor: '#1F4EB9',
          borderRadius: 5,
          borderSkipped: false,
          maxBarThickness: 48,
          order: 1
        },

        {
          type: 'line',
          label: '% Acumulado',
          data: this.serie.map(
            item => item.porcentaje_acumulado
          ),
          yAxisID: 'y1',
          borderColor: this.colorLinea,
          backgroundColor: this.colorLinea,
          pointBackgroundColor: this.colorLinea,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.20,
          fill: false,
          order: 0
        },

        {
          type: 'line',
          label: 'Umbral 80%',
          data: this.serie.map(
            () => 80
          ),
          yAxisID: 'y1',
          borderColor: this.colorUmbral,
          backgroundColor: this.colorUmbral,
          borderWidth: 2,
          borderDash: [7, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          fill: false,
          order: 2
        }
      ]
    };
  }

  get tieneDatos(): boolean {
    return (
      this.totalIncumplimientos > 0 &&
      this.serie.length > 0
    );
  }

  get sinIncumplimientos(): boolean {
    return (
      this.datos !== null &&
      this.totalIncumplimientos === 0
    );
  }

}
