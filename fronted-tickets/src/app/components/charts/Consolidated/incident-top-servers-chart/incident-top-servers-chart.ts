
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output
} from '@angular/core';

import {
  ChartData,
  ChartOptions
} from 'chart.js';

import ChartDataLabels from 'chartjs-plugin-datalabels';

import {
  IncidentConsolidatedTopServidoresOut,
  IncidentConsolidatedServidorItem
} from '../../../../models/incident-consolidated';


@Component({
  selector: 'app-incident-top-servers-chart',
  standalone: false,
  templateUrl: './incident-top-servers-chart.html',
  styleUrl: './incident-top-servers-chart.css'
})
export class IncidentTopServersChart implements OnChanges {

  @Input() datos: IncidentConsolidatedTopServidoresOut | null = null;

  @Input() cargando = false;
  @Input() error: string | null = null;

  @Input() limite = 5;

  @Output() limiteChange = new EventEmitter<number>();

  readonly chartType: 'bar' = 'bar';
  readonly chartPlugins = [ChartDataLabels];

  readonly opcionesLimite = [5, 10, 20, 50];

  servidoresVisibles: IncidentConsolidatedServidorItem[] = [];

  alturaGrafico = 350;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };


  chartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',

    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 350
    },

    layout: {
      padding: {
        right: 55
      }
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

          title: context => {
            const index = context[0]?.dataIndex;

            if (index === undefined) {
              return '';
            }

            return this.servidoresVisibles[index]?.servidor ?? '';
          },

          label: context => {

            const servidor = this.servidoresVisibles[
              context.dataIndex
            ];

            if (!servidor) {
              return '';
            }

            return (
              ` ${servidor.incidentes.toLocaleString('es-PE')} ` +
              `incidentes (${servidor.porcentaje.toFixed(2)}%)`
            );
          }
        }
      },

      datalabels: {
        color: '#344054',

        anchor: 'end',
        align: 'end',
        clamp: true,

        font: {
          size: 11,
          weight: 'bold'
        },

        display: context => {

          const servidor = this.servidoresVisibles[
            context.dataIndex
          ];

          return Boolean(
            servidor && servidor.incidentes > 0
          );
        },

        formatter: (_valor, context) => {

          const servidor = this.servidoresVisibles[
            context.dataIndex
          ];

          return servidor
            ? servidor.incidentes.toLocaleString('es-PE')
            : '';
        }
      }
    },

    scales: {

      x: {
        beginAtZero: true,

        grid: {
          color: '#eef2f6'
        },

        ticks: {
          color: '#667085',
          precision: 0
        }
      },

      y: {
        grid: {
          display: false
        },

        ticks: {
          color: '#344054',

          font: {
            size: 11
          },

          callback: (_valor, index) => {
            const nombre = this.servidoresVisibles[
              index
            ]?.servidor ?? '';

            return nombre.length > 30
              ? nombre.substring(0, 27) + '...'
              : nombre;
          }
        }
      }
    }
  };


  ngOnChanges(): void {
    this.prepararGrafico();
  }


  private prepararGrafico(): void {

    this.servidoresVisibles = [
      ...(this.datos?.servidores ?? [])
    ].sort((a, b) =>
      b.incidentes - a.incidentes ||
      a.servidor.localeCompare(b.servidor)
    );

    this.alturaGrafico = Math.max(
      350,
      Math.min(2300, this.servidoresVisibles.length * 45 + 90)
    );

    this.chartData = {
      labels: this.servidoresVisibles.map(
        item => item.servidor
      ),

      datasets: [{
        label: 'Incidentes',

        data: this.servidoresVisibles.map(
          item => item.incidentes
        ),

        backgroundColor: this.servidoresVisibles.map(
          (_item, index) =>
            index === 0 ? '#FF620F' : '#63B891'
        ),

        borderRadius: 6,
        maxBarThickness: 25
      }]
    };
  }


  cambiarLimite(evento: Event): void {

    const elemento = evento.target as HTMLSelectElement;

    const nuevoLimite = Number(elemento.value);

    if (
      !this.opcionesLimite.includes(nuevoLimite) ||
      nuevoLimite === this.limite
    ) {
      return;
    }

    this.limiteChange.emit(nuevoLimite);
  }


  get tieneDatos(): boolean {
    return this.servidoresVisibles.length > 0;
  }

}
