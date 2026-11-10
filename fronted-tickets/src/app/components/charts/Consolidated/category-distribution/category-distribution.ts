
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

export interface CategoryDistributionItem {
  categoria: string;
  cantidad: number;
}

@Component({
  selector: 'app-category-distribution',
  standalone: false,
  templateUrl: './category-distribution.html',
  styleUrl: './category-distribution.css'
})
export class CategoryDistribution implements OnChanges {

  @Input() datos: CategoryDistributionItem[] = [];
  @Input() titulo = 'Distribución por Categoría';
  @Input() descripcion = '';
  @Input() orientacion: 'horizontal' | 'vertical' = 'vertical';
  @Input() coloresPorPrioridad = false;
  @Input() seleccionMultiple = false;

  // Texto del filtro según la entidad
  @Input() textoSeleccionMultiple = 'tipos de incidente';

  @Input() tiposSeleccionados: string[] = [];
  @Input() cargando = false;
  @Output() tiposChange = new EventEmitter<string[]>();

  readonly chartPlugins = [ChartDataLabels];
  alturaGrafico = 330;
  datosOrdenados: CategoryDistributionItem[] = [];

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  //09/11/2026
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

  chartOptions: ChartOptions<'bar'> = {};

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos'] || changes['orientacion'] || changes['coloresPorPrioridad'] ||
      changes['seleccionMultiple'] || changes['tiposSeleccionados']) {
      this.actualizarGrafico();
    }
  }

  private obtenerColor(categoria: string): string {
    const colores: Record<string, string> = {
      '1-Critical': '#D95C4F',
      '2-High': '#FF8A42',
      '3-Medium': '#F4C95D',
      '4-Low': '#63B891'
    };
    return colores[categoria] ?? '#98A2B3';
  }


  private actualizarGrafico(): void {
    const horizontal = this.orientacion === 'horizontal';
    this.datosOrdenados = [...this.datos].sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.categoria.localeCompare(b.categoria)
    );

    this.alturaGrafico = horizontal
      ? Math.max(
        290,
        this.datosOrdenados.length * 34 + 45
      )
      : 330;

    const haySeleccion = this.seleccionMultiple && this.tiposSeleccionados.length > 0;

    //09/11/2026
    const coloresBarras = this.datosOrdenados.map((item, index) => {

      if (this.coloresPorPrioridad) {
        return this.obtenerColor(item.categoria);
      }

      if (!haySeleccion) {
        return this.colores[index % this.colores.length];
      }

      if (this.tiposSeleccionados.includes(item.categoria)) {
        return this.colores[index % this.colores.length];
      }

      return '#FFE4D4';

    });

    const coloresBordes = this.datosOrdenados.map((item, index) => {

      if (this.coloresPorPrioridad) {
        return this.obtenerColor(item.categoria);
      }
      if (haySeleccion && !this.tiposSeleccionados.includes(item.categoria)) {
        return '#FFE4D4';
      }
      return this.colores[index % this.colores.length];
    });
    //Fin


    this.chartData = {
      labels: this.datosOrdenados.map(item => item.categoria),
      datasets: [
        {
          label: 'Tickets',
          data: this.datosOrdenados.map(item => item.cantidad),
          backgroundColor: coloresBarras,
          borderColor: coloresBordes,
          borderWidth: 1,
          borderRadius: 5,
          maxBarThickness: horizontal ? 21 : 55
        }
      ]
    };

    this.chartOptions = {

      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',

      onClick: (evento, _elementos, grafico) => {
        if (!this.seleccionMultiple || this.cargando) {
          return;
        }

        const eventoNativo = evento.native;

        if (!eventoNativo) {
          return;
        }

        const elementos = grafico.getElementsAtEventForMode(
          eventoNativo,
          'nearest',
          { intersect: true },
          false
        );

        const barra = elementos.find(
          elemento => elemento.datasetIndex === 0
        );

        if (!barra) {
          return;
        }

        const tipo = this.datosOrdenados[barra.index]?.categoria;

        if (!tipo) {
          return;
        }

        const seleccion = new Set(
          this.tiposSeleccionados
        );

        if (seleccion.has(tipo)) {
          seleccion.delete(tipo);
        } else {
          seleccion.add(tipo);
        }

        this.tiposChange.emit([...seleccion]);
      },

      onHover: (evento, _elementos, grafico) => {

        if (!this.seleccionMultiple || this.cargando) {
          grafico.canvas.style.cursor = 'default';
          return;
        }

        const eventoNativo = evento.native;

        if (!eventoNativo) {
          grafico.canvas.style.cursor = 'default';
          return;
        }

        const elementos = grafico.getElementsAtEventForMode(eventoNativo, 'nearest', { intersect: true }, false);
        grafico.canvas.style.cursor = elementos.some(elemento => elemento.datasetIndex === 0) ? 'pointer' : 'default';
      },

      layout: {
        padding: horizontal
          ? { right: 65, top: 28, bottom: 8 }
          : { right: 8, top: 28, bottom: 12 }
      },


      plugins: {
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'end',
          offset: 4,
          color: '#344054',
          font: { size: 13, weight: 'bold' },
          formatter: (value: number) => {
            return value.toLocaleString('es-PE');
          }
        },

        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const indice = items[0]?.dataIndex ?? -1;
              return this.datosOrdenados[indice]?.categoria ?? '';
            },

            label: (context) => {
              const cantidad = this.datosOrdenados[context.dataIndex]?.cantidad ?? 0;
              return (
                `Tickets: ${cantidad.toLocaleString('es-PE')}`
              );
            },

            afterLabel: (context) => {
              if (!this.seleccionMultiple || context.datasetIndex !== 0) {
                return '';
              }

              const tipo = this.datosOrdenados[context.dataIndex]?.categoria;

              if (!tipo) {
                return '';
              }

              return this.tiposSeleccionados.includes(tipo)
                ? 'Seleccionado - clic para quitar'
                : 'Clic para seleccionar';
            }
          }
        }
      },


      scales: {

        x: {
          beginAtZero: horizontal,

          grid: {
            display: horizontal,
            color: '#EDF0F2'
          },

          ticks: horizontal ? { precision: 0 } : {
            autoSkip: false,
            minRotation: 45,
            maxRotation: 45,
            align: 'end',
            font: { size: 10 },
            padding: 8,
            callback: function (value) {
              const etiqueta = this.getLabelForValue(
                Number(value)
              );
              return etiqueta.length > 25 ? etiqueta.slice(0, 22) + '...' : etiqueta;
            }
          }
        },

        y: {
          beginAtZero: !horizontal,

          grid: {
            display: !horizontal,
            color: '#EDF0F2'
          },

          ticks: horizontal ? {
            autoSkip: false,
            font: {
              size: 10
            },

            callback: function (value) {
              const etiqueta = this.getLabelForValue(
                Number(value)
              );
              return etiqueta.length > 31 ? etiqueta.slice(0, 28) + '...' : etiqueta;
            }

          } : { precision: 0 }
        }
      }
    };
  }
}
