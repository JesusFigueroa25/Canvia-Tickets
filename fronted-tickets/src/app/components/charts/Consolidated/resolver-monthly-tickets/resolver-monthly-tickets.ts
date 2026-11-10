
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions, Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentConsolidatedTicketsPorResolutorOut } from '../../../../models/incident-consolidated';

interface GrupoResolutor {
  nombre: string;
  inicio: number;
  fin: number;
}

interface DetalleBarra {
  nombre: string;
  periodo: string;
  tickets: number;
  total: number;
}

@Component({
  selector: 'app-resolver-monthly-tickets',
  standalone: false,
  templateUrl: './resolver-monthly-tickets.html',
  styleUrl: './resolver-monthly-tickets.css'
})
export class ResolverMonthlyTickets implements OnChanges {

  @Input() datos: IncidentConsolidatedTicketsPorResolutorOut | null = null;
  @Input() cargando = false;
  @Input() limite = 5;

  // Controlado desde el padre
  @Input() mostrarMesesEnEjeX = false;

  @Output() limiteChange = new EventEmitter<number>();

  readonly chartType: 'bar' = 'bar';
  readonly opcionesLimite = [5, 10, 15, 20];

  //09/11/2026
  private readonly coloresMeses: string[] = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2'
  ];
  //Fin

  anchoGrafico = 600;

  gruposResolutores: GrupoResolutor[] = [];

  private detalleBarras: (DetalleBarra | null)[] = [];

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  // PLUGIN: NOMBRE CENTRADO POR RESOLUTOR

  private readonly etiquetasResolutoresPlugin: Plugin<'bar'> = {
    id: 'etiquetasResolutores',

    afterDraw: (chart) => {

      if (
        !this.mostrarMesesEnEjeX ||
        this.gruposResolutores.length === 0
      ) {
        return;
      }

      const escalaX = chart.scales['x'];

      if (!escalaX) {
        return;
      }

      const ctx = chart.ctx;

      ctx.save();

      ctx.fillStyle = '#475467';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      this.gruposResolutores.forEach(grupo => {

        const xInicio = escalaX.getPixelForValue(
          grupo.inicio
        );

        const xFin = escalaX.getPixelForValue(
          grupo.fin
        );

        const centro = (xInicio + xFin) / 2;

        const lineas = this.dividirEtiqueta(
          grupo.nombre,
          24,
          2
        );

        lineas.forEach((linea, i) => {
          ctx.fillText(
            linea,
            centro,
            escalaX.bottom + 13 + (i * 14)
          );
        });

      });

      ctx.restore();
    }
  };

  readonly chartPlugins = [
    ChartDataLabels,
    this.etiquetasResolutoresPlugin
  ];

  // CONFIGURACIÓN CHART.JS
  chartOptions: ChartOptions<'bar'> = {

    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,

    layout: {
      padding: {
        top: 25,
        right: 16,
        bottom: 12,
        left: 8
      }
    },

    interaction: {
      mode: 'index',
      intersect: false
    },

    scales: {

      x: {
        stacked: false,

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
          padding: 12,

          font: {
            size: 10,
            lineHeight: 1.35
          },

          callback: (_value, index) => {

            const etiqueta = this.chartData.labels?.[index];

            if (Array.isArray(etiqueta)) {
              return etiqueta;
            }

            return etiqueta ? String(etiqueta) : '';
          }
        }
      },

      y: {
        stacked: false,
        beginAtZero: true,
        grace: '15%',

        border: {
          display: false
        },

        grid: {
          color: '#EDF0F2'
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
        mode: 'index',
        intersect: false,

        backgroundColor: '#FFFFFF',
        titleColor: '#101828',
        bodyColor: '#475467',
        borderColor: '#E5E9EE',
        borderWidth: 1,
        padding: 12,
        displayColors: false,

        callbacks: {

          title: (items) => {

            const indice = items[0]?.dataIndex;

            if (indice === undefined) {
              return '';
            }

            // SIN FILTROS
            if (!this.mostrarMesesEnEjeX) {

              const nombre =
                this.datos?.resolutores[indice]
                  ?.nombre_resolutor ?? '';

              return this.dividirTextoTooltip(
                nombre,
                55
              );
            }

            // CON FILTROS
            const barra = this.detalleBarras[indice];

            if (!barra) {
              return '';
            }

            return this.dividirTextoTooltip(
              barra.nombre,
              55
            );
          },


          label: (context) => {

            const tickets = Number(context.parsed.y ?? 0);

            if (this.mostrarMesesEnEjeX) {

              const barra = this.detalleBarras[context.dataIndex];

              return (
                `${barra?.periodo ?? ''}: ` +
                `${tickets.toLocaleString('es-PE')} tickets`
              );
            }

            // Sin filtros: cada dataset representa un mes
            const periodo = context.dataset.label ?? '';

            return (
              `${periodo}: ` +
              `${tickets.toLocaleString('es-PE')} tickets`
            );
          },


          footer: (items) => {

            const indice = items[0]?.dataIndex;

            if (indice === undefined) {
              return '';
            }

            const total = this.mostrarMesesEnEjeX
              ? this.detalleBarras[indice]?.total ?? 0
              : this.datos?.resolutores[indice]
                ?.total_tickets ?? 0;

            return (
              `Total del resolutor: ` +
              total.toLocaleString('es-PE')
            );
          }
        }
      },

      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 3,
        clamp: true,
        color: '#344054',

        font: {
          size: 10,
          weight: 'bold'
        },

        display: (context) => {

          const valor = context.dataset.data[
            context.dataIndex
          ];

          return (
            typeof valor === 'number' &&
            valor > 0
          );
        },

        formatter: (valor: number | null) => {
          return typeof valor === 'number'
            ? valor.toLocaleString('es-PE')
            : '';
        }
      }
    }
  };

  // DETECTAR CAMBIOS
  ngOnChanges(changes: SimpleChanges): void {

    if (
      changes['datos'] ||
      changes['mostrarMesesEnEjeX']
    ) {
      this.actualizarGrafico();
    }
  }

  // CONSTRUIR GRÁFICO
  private actualizarGrafico(): void {

    const periodos = this.datos?.periodos ?? [];
    const resolutores = this.datos?.resolutores ?? [];

    // Limpiar información anterior
    this.gruposResolutores = [];
    this.detalleBarras = [];

    if (!resolutores.length || !periodos.length) {
      this.anchoGrafico = 600;

      this.chartData = {
        labels: [],
        datasets: []
      };

      return;
    }

    if (!this.mostrarMesesEnEjeX) {

      this.anchoGrafico = Math.max(
        1050,
        resolutores.length * 270
      );

      this.chartData = {

        labels: resolutores.map(item =>
          this.dividirEtiqueta(
            item.nombre_resolutor || 'Sin especificar',
            22,
            3
          )
        ),

        datasets: periodos.map((periodo, indice) => {

          const color = this.colorPeriodo(indice);

          return {
            label: periodo.periodo,

            data: resolutores.map(resolutor => {

              const mes = resolutor.mensual.find(
                item => item.periodo === periodo.periodo
              );

              return mes?.tickets ?? 0;
            }),

            backgroundColor: color,
            borderColor: color,
            hoverBackgroundColor: color,

            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: 28,
            barPercentage: 0.9,
            categoryPercentage: 0.82
          };
        })
      };

      this.actualizarEspacioInferior();
      return;
    }


    const etiquetas: string[] = [];
    const valores: (number | null)[] = [];
    const colores: string[] = [];

    resolutores.forEach((resolutor, indiceResolutor) => {

      const inicio = etiquetas.length;

      // Barras mensuales juntas dentro del grupo
      periodos.forEach((periodo, indiceMes) => {

        const registro = resolutor.mensual.find(
          item => item.periodo === periodo.periodo
        );

        const tickets = registro?.tickets ?? 0;

        etiquetas.push(
          periodo.periodo.replace('-', '/')
        );

        valores.push(tickets);
        //09/11/2026
        colores.push(
          periodos.length === 1
            ? this.colorPeriodo(indiceResolutor)
            : this.colorPeriodo(indiceMes)
        );
        //Fin

        this.detalleBarras.push({
          nombre: resolutor.nombre_resolutor || 'Sin especificar',
          periodo: periodo.periodo,
          tickets,
          total: resolutor.total_tickets
        });
      });

      const fin = etiquetas.length - 1;

      this.gruposResolutores.push({
        nombre: resolutor.nombre_resolutor || 'Sin especificar',
        inicio,
        fin
      });

      if (indiceResolutor < resolutores.length - 1) {

        etiquetas.push('');
        valores.push(null);
        colores.push('rgba(0,0,0,0)');

        this.detalleBarras.push(null);
      }
    });

    //09/11/2026
    this.anchoGrafico = Math.max(
      620,
      etiquetas.length * 85
    );
    //Fin

    this.chartData = {

      labels: etiquetas,

      datasets: [
        {
          label: 'Tickets',

          data: valores,

          backgroundColor: colores,
          borderColor: colores,
          hoverBackgroundColor: colores,

          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,

          // Mantener las barras delgadas
          maxBarThickness: 18,
          barPercentage: 0.86,
          categoryPercentage: 0.92
        }
      ]
    };

    this.actualizarEspacioInferior();
  }

  // ESPACIO PARA NOMBRES DE RESOLUTORES
  private actualizarEspacioInferior(): void {

    this.chartOptions = {
      ...this.chartOptions,

      layout: {
        padding: {
          top: 25,
          right: 16,
          left: 8,
          bottom: this.mostrarMesesEnEjeX ? 65 : 12
        }
      }
    };
  }

  // DIVIDIR NOMBRE PARA EJE X
  private dividirEtiqueta(
    texto: string,
    maximo = 22,
    maxLineas = 3
  ): string[] {

    const palabras = texto
      .replace(/,/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const lineas: string[] = [];

    let actual = '';

    for (const palabra of palabras) {

      const siguiente = actual
        ? `${actual} ${palabra}`
        : palabra;

      if (siguiente.length <= maximo) {
        actual = siguiente;
        continue;
      }

      if (actual) {
        lineas.push(actual);
      }

      actual = palabra;

      if (lineas.length >= maxLineas - 1) {
        break;
      }
    }

    if (actual && lineas.length < maxLineas) {
      lineas.push(actual);
    }

    return lineas.length
      ? lineas
      : ['Sin especificar'];
  }

  // TOOLTIP: NOMBRE COMPLETO
  private dividirTextoTooltip(
    texto: string,
    maximo: number
  ): string[] {

    const palabras = texto.trim().split(/\s+/);

    const lineas: string[] = [];
    let actual = '';

    for (const palabra of palabras) {

      const siguiente = actual
        ? `${actual} ${palabra}`
        : palabra;

      if (siguiente.length > maximo && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = siguiente;
      }
    }

    if (actual) {
      lineas.push(actual);
    }

    return lineas;
  }

  // SELECTOR TOP
  cambiarLimite(valor: number): void {

    if (this.cargando || this.limite === valor) {
      return;
    }

    this.limiteChange.emit(valor);
  }

  colorPeriodo(indice: number): string {

    return this.coloresMeses[
      indice % this.coloresMeses.length
    ];
  }
}
