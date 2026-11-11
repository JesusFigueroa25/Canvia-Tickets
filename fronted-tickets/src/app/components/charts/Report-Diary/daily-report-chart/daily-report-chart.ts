import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { DailyReportDiaItem } from '../../../../models/daily-report';

@Component({
  selector: 'app-daily-report-chart',
  standalone: false,
  templateUrl: './daily-report-chart.html',
  styleUrl: './daily-report-chart.css'
})
export class DailyReportChart implements OnChanges {

  @Input() datos: DailyReportDiaItem[] = [];
  @Input() cargando = false;

  // Pantalla completa: el componente padre ejecuta la Fullscreen API.
  @Input() habilitarPantallaCompleta = false;
  @Input() pantallaCompletaActiva = false;
  @Output() pantallaCompletaSolicitada = new EventEmitter<void>();

  readonly chartPlugins = [ChartDataLabels];

  // Colores equivalentes al gráfico de Home y a la paleta CANVIA.
  private readonly colores = {
    incidentes: { relleno: '#FFB184', borde: '#FF620F' },
    requerimientos: { relleno: '#63B891', borde: '#16835B' },
    tareas: { relleno: '#F4C95D', borde: '#D97706' }
  };

  registrosOrdenados: DailyReportDiaItem[] = [];
  anchoMinimoGrafico = 660;

  chartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    layout: {
      padding: { top: 19, bottom: 3 }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          color: '#475467',
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            return this.formatearFechaCompleta(
              this.registrosOrdenados[indice]?.fecha_accion ?? ''
            );
          },
          label: (context) => {
            const cantidad = Number(context.parsed.y ?? 0);
            return `${context.dataset.label}: ${cantidad.toLocaleString('es-PE')} tickets`;
          },
          footer: (items) => {
            const indice = items[0]?.dataIndex ?? -1;
            const total = this.registrosOrdenados[indice]?.total_tickets ?? 0;
            return `Total del día: ${total.toLocaleString('es-PE')} tickets`;
          }
        }
      },
      datalabels: {
        // Para rangos extensos, los valores detallados siguen en el tooltip.
        display: (context) => {
          const valor = context.dataset.data[context.dataIndex];
          return (
            this.registrosOrdenados.length <= 12 &&
            typeof valor === 'number' &&
            valor > 0
          );
        },
        anchor: 'end',
        align: 'end',
        offset: 3,
        clip: false,
        color: '#344054',
        font: { size: 10, weight: 'bold' },
        formatter: (valor: number) => valor.toLocaleString('es-PE')
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#667085',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: { size: 10 }
        }
      },
      y: {
        beginAtZero: true,
        grace: '16%',
        title: { display: true, text: 'Tickets', color: '#667085' },
        ticks: {
          color: '#667085',
          precision: 0,
          callback: (valor) => {
            const numero = Number(valor);
            if (numero >= 1000) {
              return `${(numero / 1000).toFixed(numero >= 10000 ? 0 : 1)}k`;
            }
            return numero.toLocaleString('es-PE');
          }
        },
        grid: { color: '#EDF0F2' }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    this.registrosOrdenados = [...(this.datos ?? [])].sort(
      (a, b) => a.fecha_accion.localeCompare(b.fecha_accion)
    );

    // Preservar legibilidad cuando el rango incluye muchas fechas.
    this.anchoMinimoGrafico = Math.max(
      660,
      Math.min(18000, this.registrosOrdenados.length * 64)
    );

    this.chartData = {
      labels: this.registrosOrdenados.map(
        item => this.formatearFechaCorta(item.fecha_accion)
      ),
      datasets: [
        {
          label: 'Incidentes',
          data: this.registrosOrdenados.map(item => item.incidentes),
          backgroundColor: this.colores.incidentes.relleno,
          borderColor: this.colores.incidentes.borde,
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 32
        },
        {
          label: 'Requerimientos',
          data: this.registrosOrdenados.map(item => item.requerimientos),
          backgroundColor: this.colores.requerimientos.relleno,
          borderColor: this.colores.requerimientos.borde,
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 32
        },
        {
          label: 'Tareas',
          data: this.registrosOrdenados.map(item => item.tareas),
          backgroundColor: this.colores.tareas.relleno,
          borderColor: this.colores.tareas.borde,
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.75,
          maxBarThickness: 32
        }
      ]
    };
  }

  private formatearFechaCorta(fechaISO: string): string {
    const partes = fechaISO.split('-');
    if (partes.length !== 3) {
      return fechaISO;
    }

    const meses = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
    ];

    const mes = Number(partes[1]);
    return `${partes[2]} ${meses[mes - 1] ?? ''}`.trim();
  }

  private formatearFechaCompleta(fechaISO: string): string {
    const partes = fechaISO.split('-').map(Number);
    if (partes.length !== 3 || partes.some(valor => !Number.isInteger(valor))) {
      return fechaISO;
    }

    const [anio, mes, dia] = partes;
    const fechaLocal = new Date(anio, mes - 1, dia);

    return fechaLocal.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
