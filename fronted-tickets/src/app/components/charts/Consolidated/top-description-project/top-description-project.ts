import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentConsolidatedTopDescripcionProyectoOut } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-top-description-project',
  standalone: false,
  templateUrl: './top-description-project.html',
  styleUrl: './top-description-project.css'
})
export class TopDescriptionProject implements OnChanges {

  @Input() datos: IncidentConsolidatedTopDescripcionProyectoOut | null = null;
  @Input() cargando = false;

  readonly chartPlugins = [ChartDataLabels];
  readonly chartType: 'bar' = 'bar';
  anchoGrafico = 1600;
  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

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

  chartOptions: ChartOptions<'bar'> = {

    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,

    layout: {
      padding: {
        top: 22,
        right: 16,
        bottom: 8,
        left: 8
      }
    },

    interaction: {
      mode: 'nearest',
      intersect: true
    },

    scales: {

      x: {
        border: {
          display: false
        },

        grid: {
          display: false
        },

        ticks: {
          color: '#475467',
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          padding: 14,
          font: {
            size: 10,
            lineHeight: 1.35
          }
        }
      },

      y: {
        beginAtZero: true,
        grace: '12%',
        border: {
          display: false
        },
        grid: {
          color: '#edf0f2'
        },

        ticks: {
          color: '#667085',
          precision: 0,
          maxTicksLimit: 7,
          font: {
            size: 11
          }
        },

        title: {
          display: true,
          text: 'Número de tickets',
          color: '#667085',
          font: {
            size: 11,
            weight: 'normal'
          }
        }
      }
    },

    plugins: {

      legend: {
        display: false
      },

      tooltip: {
        enabled: true,
        backgroundColor: '#ffffff',
        titleColor: '#101828',
        bodyColor: '#475467',
        borderColor: '#e5e9ee',
        borderWidth: 1,
        padding: 12,
        displayColors: false,

        callbacks: {
          title: (items) => {
            const indice = items[0]?.dataIndex;
            if (indice === undefined) {
              return '';
            }
            const descripcion = this.datos?.combinaciones[indice]?.descripcion ?? '';
            return this.dividirTexto(descripcion, 65);
          },

          // PROYECTO COMPLETO
          afterTitle: (items) => {
            const indice = items[0]?.dataIndex;
            if (indice === undefined) {
              return '';
            }
            const proyecto = this.datos?.combinaciones[indice]?.proyecto ?? '';
            return [
              'Proyecto:',
              ...this.dividirTexto(proyecto, 65)
            ];
          },

          // CANTIDAD DE TICKETS
          label: (context) => {
            const item = this.datos?.combinaciones[context.dataIndex];
            const cantidad = item?.tickets ?? 0;
            return `Tickets: ${cantidad.toLocaleString('es-PE')}`;
          }
        }
      },

      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 5,
        clamp: true,
        color: '#475467',
        font: {
          size: 11,
          weight: 'bold'
        },
        formatter: (valor: number) => {
          return valor.toLocaleString('es-PE');
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    const items = this.datos?.combinaciones ?? [];
    this.anchoGrafico = Math.max(
      1100,
      items.length * 220
    );

    this.chartData = {

      labels: items.map(item => [
        ...this.dividirEtiqueta(item.descripcion, 24, 2),
        ...this.dividirEtiqueta(`Proyecto: ${item.proyecto}`, 24, 2)
      ]),

      datasets: [
        {
          label: 'Tickets',
          data: items.map(item => item.tickets),
          backgroundColor: items.map((_, index) => this.colores[index % this.colores.length]),
          borderColor: items.map((_, index) => this.colores[index % this.colores.length]),
          hoverBackgroundColor: items.map((_, index) => this.colores[index % this.colores.length] + 'D9'),
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 62,
          barPercentage: 0.76,
          categoryPercentage: 0.82
        }
      ]
    };
  }

  // ACORTAR ETIQUETAS DEL EJE X
  private dividirEtiqueta(texto: string, maximo: number = 24, maxLineas: number = 2): string[] {

    const palabras = texto
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const lineas: string[] = [];
    let lineaActual = '';

    for (const palabra of palabras) {
      const siguiente = lineaActual ? `${lineaActual} ${palabra}` : palabra;

      if (siguiente.length <= maximo) {
        lineaActual = siguiente;
        continue;
      }

      if (lineaActual) {
        lineas.push(lineaActual);
        lineaActual = '';
      }

      if (lineas.length >= maxLineas) {
        const ultima = maxLineas - 1;
        lineas[ultima] = lineas[ultima].slice(0, maximo - 1).trimEnd() + '…';
        return lineas;
      }

      lineaActual = palabra.length > maximo ? palabra.slice(0, maximo - 1) + '…' : palabra;
    }

    if (lineaActual && lineas.length < maxLineas) {
      lineas.push(lineaActual);
    }

    return lineas.length > 0 ? lineas : [''];
  }

  // DIVIDIR TEXTOS EXTENSOS DEL TOOLTIP
  private dividirTexto(texto: string, maximo: number): string[] {
    const palabras = texto.trim().split(/\s+/);
    const lineas: string[] = [];
    let linea = '';

    for (const palabra of palabras) {
      if ((linea + ' ' + palabra).trim().length > maximo && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = linea ? `${linea} ${palabra}` : palabra;
      }
    }

    if (linea) {
      lineas.push(linea);
    }

    return lineas;
  }
}