import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementActualizacionesManualesItem, RequirementActualizacionesManualesOut } from '../../../../../models/requirement-consolidated';


@Component({
  selector: 'app-requirement-manual-updates-chart',
  standalone: false,
  templateUrl: './requirement-manual-updates-chart.html',
  styleUrl: './requirement-manual-updates-chart.css'
})
export class RequirementManualUpdatesChart implements OnChanges {
  @Input() datos: RequirementActualizacionesManualesOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  readonly chartPlugins = [ChartDataLabels];
  registros: RequirementActualizacionesManualesItem[] = [];
  alturaGrafico = 440;

  private readonly colores = [
    '#FF620F', '#FFB184', '#16835B', '#63B891', '#D97706',
    '#F4C95D', '#12633F', '#A8DCC2', '#FF8A42', '#D95C4F'
  ];

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    layout: { padding: { top: 8, right: 44, bottom: 4, left: 4 } },
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: '#344054',
        anchor: 'end',
        align: 'end',
        offset: 5,
        clamp: true,
        font: { size: 10, weight: 'bold' },
        formatter: (valor: number) => valor > 0 ? valor.toLocaleString('es-PE') : ''
      },
      tooltip: {
        callbacks: {
          title: items => {
            const item = this.registros[items[0]?.dataIndex ?? -1];
            return item ? item.resolutor : '';
          },
          label: context => {
            const item = this.registros[context.dataIndex];
            if (!item) return '';
            return [
              `Grupo: ${item.grupo_resolutor}`,
              `Tickets: ${item.tickets.toLocaleString('es-PE')}`,
              `Proyectos: ${item.proyectos.toLocaleString('es-PE')}`,
              `Participación: ${item.porcentaje.toFixed(2)}%`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grace: '15%',
        grid: { color: '#EDF0F2' },
        ticks: { precision: 0 },
        title: { display: true, text: 'Requerimientos' }
      },
      y: {
        grid: { display: false },
        ticks: { autoSkip: false, color: '#475467', font: { size: 11 } }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) this.actualizarGrafico();
  }

  private actualizarGrafico(): void {
    this.registros = [...(this.datos?.grafico ?? [])].sort(
      (a, b) => b.tickets - a.tickets || a.resolutor.localeCompare(b.resolutor)
    );

    this.alturaGrafico = Math.max(300, this.registros.length * 45 + 68);
    this.chartData = {
      labels: this.registros.map(item => this.acortarNombre(item.resolutor)),
      datasets: [{
        label: 'Tickets',
        data: this.registros.map(item => item.tickets),
        backgroundColor: this.registros.map((_, indice) => this.colores[indice % this.colores.length]),
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 25,
        barPercentage: 0.78,
        categoryPercentage: 0.8
      }]
    };
  }

  private acortarNombre(nombre: string): string {
    const limite = 32;
    return nombre.length > limite ? `${nombre.substring(0, limite - 1)}…` : nombre;
  }
}
