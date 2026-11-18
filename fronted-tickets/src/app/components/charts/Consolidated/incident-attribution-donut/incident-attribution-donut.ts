
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output
} from '@angular/core';

import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  IncidentConsolidatedAtribucionOut
} from '../../../../models/incident-consolidated';


interface SegmentoAtribucion {
  atribucion: string;
  nombre: string;
  tickets: number;
  porcentaje: number;
  color: string;
}


@Component({
  selector: 'app-incident-attribution-donut',
  standalone: false,
  templateUrl: './incident-attribution-donut.html',
  styleUrl: './incident-attribution-donut.css'
})
export class IncidentAttributionDonut implements OnChanges {

  @Input() datos: IncidentConsolidatedAtribucionOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Input() seleccion: string | null = null;

  @Output() atribucionChange = new EventEmitter<string | null>();

  readonly chartType: 'doughnut' = 'doughnut';
  readonly chartPlugins = [ChartDataLabels];

  // Colores de Canvia
  private readonly categorias = [
    {
      atribucion: 'Atribuible a Cliente',
      nombre: 'Cliente',
      color: '#FF620F'
    },
    {
      atribucion: 'Atribuible a Canvia',
      nombre: 'Canvia',
      color: '#16835B'
    }
  ];

  resumen: SegmentoAtribucion[] = [];

  totalAtribuidos = 0;
  totalIncidentes = 0;
  sinAtribucion = 0;

  chartData: ChartData<'doughnut', number[], string> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderColor: '#FFFFFF',
      borderWidth: 3,
      hoverOffset: 8
    }]
  };

  chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',

    animation: {
      duration: 350
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

        callbacks: {
          label: (context) => {
            const item = this.resumen[context.dataIndex];

            if (!item) {
              return '';
            }

            return (
              ` ${item.tickets.toLocaleString('es-PE')} ` +
              `incidentes (${item.porcentaje.toFixed(2)}%)`
            );
          }
        }
      },

      datalabels: {
        color: '#FFFFFF',
        font: {
          size: 12,
          weight: 'bold'
        },
        anchor: 'center',
        align: 'center',

        display: (context) => {
          const item = this.resumen[context.dataIndex];

          return Boolean(
            item &&
            item.tickets > 0 &&
            item.porcentaje >= 5
          );
        },

        formatter: (_valor, context) => {
          const item = this.resumen[context.dataIndex];

          return item
            ? `${item.porcentaje.toFixed(2)}%`
            : '';
        }
      }
    },

    onClick: (_evento, elementos) => {
      if (!elementos.length) {
        return;
      }

      const item = this.resumen[elementos[0].index];

      if (item?.tickets > 0) {
        this.cambiarSeleccion(item.atribucion);
      }
    },

    onHover: (_evento, elementos, chart) => {
      const item = elementos.length
        ? this.resumen[elementos[0].index]
        : null;

      chart.canvas.style.cursor =
        item && item.tickets > 0
          ? 'pointer'
          : 'default';
    }
  };


  ngOnChanges(): void {
    this.prepararGrafico();
  }


  private prepararGrafico(): void {

    this.totalIncidentes = this.datos?.total_tickets ?? 0;

    this.totalAtribuidos = this.datos?.total_atribuidos ?? 0;

    this.sinAtribucion = this.datos?.sin_atribucion ?? 0;

    this.resumen = this.categorias.map(categoria => {

      const registro = this.datos?.distribucion.find(
        item => item.atribucion === categoria.atribucion
      );

      return {
        atribucion: categoria.atribucion,
        nombre: categoria.nombre,
        tickets: registro?.tickets ?? 0,
        porcentaje: registro?.porcentaje ?? 0,
        color: categoria.color
      };
    });

    this.chartData = {
      labels: this.resumen.map(item => item.nombre),

      datasets: [{
        data: this.resumen.map(item => item.tickets),

        backgroundColor: this.resumen.map(
          item => item.color
        ),

        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 8
      }]
    };
  }


  cambiarSeleccion(atribucion: string): void {

    const item = this.resumen.find(
      registro => registro.atribucion === atribucion
    );

    if (!item || item.tickets === 0) {
      return;
    }

    this.atribucionChange.emit(
      this.seleccion === atribucion
        ? null
        : atribucion
    );
  }


  quitarSeleccion(): void {
    this.atribucionChange.emit(null);
  }


  get tieneDatos(): boolean {
    return this.totalAtribuidos > 0;
  }

}
