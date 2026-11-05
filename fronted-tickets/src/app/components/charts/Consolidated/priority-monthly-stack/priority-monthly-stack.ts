
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { BarElement, ChartData, ChartOptions, Plugin } from 'chart.js';
import { IncidentConsolidatedPrioridadMensualItem } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-priority-monthly-stack',
  standalone: false,
  templateUrl: './priority-monthly-stack.html',
  styleUrl: './priority-monthly-stack.css'
})
export class PriorityMonthlyStack implements OnChanges {

  @Input() datos: IncidentConsolidatedPrioridadMensualItem[] = [];
  @Input() entidadConsolidado: 'incidentes' | 'requerimientos' = 'incidentes';
  registros: IncidentConsolidatedPrioridadMensualItem[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

  private readonly prioridadesBase = [
    '1-Critical',
    '2-High',
    '3-Medium',
    '4-Low'
  ];

  private readonly colores: Record<string, string> = {
    '1-Critical': '#D95C4F',
    '2-High': '#FF8A42',
    '3-Medium': '#F4C95D',
    '4-Low': '#63B891'
  };


  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };


  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 27
      }
    },

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          font: {
            size: 11
          }
        }
      },

      tooltip: {
        callbacks: {
          title: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            const registro = this.registros[indice];
            if (!registro) {
              return '';
            }

            return `${registro.periodo} · Total: ${registro.total_tickets.toLocaleString('es-PE')}`;
          },

          label: (context) => {
            const prioridad = context.dataset.label ?? '';
            const registro = this.registros[context.dataIndex];
            const detalle = registro?.prioridades.find(
              item => item.prioridad === prioridad
            );
            const cantidad = detalle?.cantidad ?? 0;
            const porcentaje = detalle?.porcentaje ?? 0;
            return `${prioridad}: ${cantidad.toLocaleString('es-PE')} tickets (${porcentaje.toFixed(2)}%)`;
          }
        }
      }
    },

    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        }
      },

      y: {
        stacked: true,
        min: 0,
        max: 100,
        grid: {
          color: '#EDF0F2'
        },
        ticks: {
          stepSize: 20,
          callback: value => `${value}%`
        }
      }
    }
  };


  private readonly etiquetasPlugin: Plugin<'bar'> = {

    id: 'priorityMonthlyLabels',

    afterDatasetsDraw: chart => {
      const ctx = chart.ctx;
      const escalaX = chart.scales['x'];
      const escalaY = chart.scales['y'];
      if (!escalaX || !escalaY) {
        return;
      }

      ctx.save();
      ctx.fillStyle = '#475467';
      ctx.font = '600 11px Arial';
      ctx.textAlign = 'center';
      this.registros.forEach((registro, indice) => {
        const x = escalaX.getPixelForValue(indice);
        const y = escalaY.getPixelForValue(100) - 8;
        ctx.fillText(registro.total_tickets.toLocaleString('es-PE'), x, y);
      });

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) {
          return;
        }
        const prioridad = dataset.label ?? '';

        meta.data.forEach((elemento, indice) => {
          const detalle = this.registros[indice]?.prioridades.find(item => item.prioridad === prioridad);
          if (!detalle || detalle.cantidad === 0) {
            return;
          }
          const barra = elemento as BarElement;
          const { x, y, base } = barra.getProps(['x', 'y', 'base'], true);

          const alto = Math.abs(base - y!);

          if (alto < 34) {
            return;
          }

          const centroY = (base + y!) / 2;
          ctx.fillStyle = prioridad === '1-Critical' ? '#FFFFFF' : '#253047';
          ctx.textAlign = 'center';
          ctx.font = '600 10px Arial';
          ctx.fillText(detalle.cantidad.toLocaleString('es-PE'), x!, centroY - 4);
          ctx.font = '9px Arial';
          ctx.fillText(`${detalle.porcentaje.toFixed(1)}%`, x!, centroY + 9);

        });
      });
      ctx.restore();
    }
  };

  chartPlugins: Plugin<'bar'>[] = [
    this.etiquetasPlugin
  ];


  private actualizarGrafico(): void {

    this.registros = [...this.datos].sort(
      (a, b) =>
        (a.anio - b.anio) ||
        (a.mes - b.mes)
    );

    // Incluimos categorías adicionales del backend, por ejemplo "Sin especificar", si existen.
    const prioridadesEncontradas = new Set(
      this.registros.flatMap(
        item => item.prioridades.map(
          detalle => detalle.prioridad
        )
      )
    );

    const prioridades = [
      ...this.prioridadesBase,
      ...Array.from(prioridadesEncontradas)
        .filter(item => !this.prioridadesBase.includes(item)).sort()
    ];


    this.chartData = {

      labels: this.registros.map(
        item => item.periodo
      ),

      datasets: prioridades.map(prioridad => ({
        label: prioridad,
        data: this.registros.map(registro => {
          const detalle = registro.prioridades.find(
            item => item.prioridad === prioridad
          );
          return detalle?.porcentaje ?? 0;
        }),
        backgroundColor: this.colores[prioridad] ?? '#98A2B3',
        borderWidth: 0,
        maxBarThickness: 64
      }))
    };
  }
}
