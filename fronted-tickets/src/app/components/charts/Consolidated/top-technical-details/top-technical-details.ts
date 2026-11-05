import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentConsolidatedTopDetallesOut } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-top-technical-details',
  standalone: false,
  templateUrl: './top-technical-details.html',
  styleUrl: './top-technical-details.css'
})
export class TopTechnicalDetails implements OnChanges {

  @Input() datos: IncidentConsolidatedTopDetallesOut | null = null;
  @Input() cargando = false;

  readonly chartPlugins = [ChartDataLabels];
  readonly chartType: 'bar' = 'bar';

  anchoGrafico = 2200;

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  // PALETA DE COLORES CANVIA
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

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
        grace: '15%',

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
            const detalle = this.datos?.detalles[indice]?.detalle ?? '';
            return [
              'Detalle técnico:',
              ...this.dividirTextoTooltip(detalle, 60)
            ];
          },

          label: (context) => {
            const item = this.datos?.detalles[context.dataIndex];
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



  private actualizarGrafico(): void {

    const items = this.datos?.detalles ?? [];
    this.anchoGrafico = Math.max(
      1100,
      items.length * 220
    );

    this.chartData = {
      labels: items.map(item => this.obtenerEtiquetaDetalle(item.detalle)),
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

  // ETIQUETAS COMPACTAS DEL EJE X
  private obtenerEtiquetaDetalle(detalle: string): string[] {
    const segmentos = detalle.split(/\r?\n/).map(linea => linea.replace(/\s+/g, ' ').trim()).filter(Boolean);

    const lineas = segmentos.slice(0, 4).map(linea => {
      const maximo = 26;
      return linea.length > maximo
        ? linea.slice(0, maximo - 1).trimEnd() + '…'
        : linea;
    });

    if (segmentos.length > 4 && lineas.length === 4) {
      const ultima = lineas[3];
      if (!ultima.endsWith('…')) {
        lineas[3] =
          ultima.slice(0, 25).trimEnd() + '…';
      }
    }

    return lineas.length > 0 ? lineas : ['Sin detalle'];
  }

  // CONSERVAR TODO EL MENSAJE EN EL TOOLTIP
  private dividirTextoTooltip(texto: string, maximo: number): string[] {

    const lineas: string[] = [];
    const parrafos = texto.split(/\r?\n/);

    for (const parrafo of parrafos) {
      let restante = parrafo.replace(/\t/g, ' ').trim();

      if (!restante) {
        continue;
      }

      while (restante.length > maximo) {
        let corte = restante.lastIndexOf(' ', maximo);
        if (corte < maximo / 2) {
          corte = maximo;
        }
        lineas.push(
          restante.slice(0, corte).trim()
        );
        restante = restante.slice(corte).trim();
      }

      if (restante) {
        lineas.push(restante);
      }
    }
    return lineas;
  }
}