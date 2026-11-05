import { ChartData, ChartOptions } from 'chart.js';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLATendenciaItem } from '../../../../models/requirement-sla';
import { IncidentSLATendencia } from '../../../../models/incident-sla';

@Component({
  selector: 'app-tendencia-type-trend',
  standalone: false,
  templateUrl: './incident-type-trend.html',
  styleUrl: './incident-type-trend.css'
})
export class TendenciaTypeTrend implements OnChanges {

  @Input() datos: IncidentSLATendencia | RequirementSLATendenciaItem[] | null = null;
  @Input() entidad: 'incidentes' | 'requerimientos' = 'incidentes';
  @Output() rankingChange = new EventEmitter<{ desde: number; hasta: number; }>();
  readonly chartPlugins = [ChartDataLabels];

  rankingSeleccionado: string = '1-2';
  chartData: ChartData<'line', number[], string> = {
    labels: [],
    datasets: []
  };

  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {
      legend: {
        position: 'top',
        align: 'end'
      },

      datalabels: {
        display: (context) => {
          const valor = context.dataset.data[context.dataIndex];
          return typeof valor === 'number' && valor > 0;
        },

        anchor: 'center',
        align: 'top',
        offset: 6,

        color: (context) => {
          return String(context.dataset.borderColor ?? '#344054');
        },

        font: {
          size: 11,
          weight: 'bold'
        },

        formatter: (value: number) => {
          return value.toLocaleString('es-PE');
        },

        clamp: true
      },

      tooltip: {
        callbacks: {
          label: (context) => {
            const nombre = context.dataset.label ?? '';
            const cantidad = context.parsed.y ?? 0;
            return `${nombre}: ${cantidad.toLocaleString('es-PE')} tickets`;
          }
        }
      }
    },

    scales: {
      x: {
        offset: true,
        grid: {
          display: false
        }
      },

      y: {
        beginAtZero: true,
        grace: '15%',
        title: {
          display: true,
          text: 'Tickets'
        },
        ticks: {
          precision: 0
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['entidad']) {
      this.actualizarGrafico();
    }
  }

  private actualizarGrafico(): void {
    const datos = this.datos;

    // 1. REQUERIMIENTOS SLA
    if (this.entidad === 'requerimientos') {

      if (!Array.isArray(datos) || !datos.length) {
        this.chartData = {
          labels: [],
          datasets: []
        };
        return;
      }

      const registrosOrdenados = [...datos].sort(
        (a, b) =>
          (a.anio - b.anio) ||
          (a.mes - b.mes)
      );

      const periodos = [
        ...new Set(
          registrosOrdenados.map(item => item.periodo)
        )
      ];

      const rankings = [
        ...new Set(
          registrosOrdenados.map(item => item.ranking)
        )
      ].sort((a, b) => a - b);

      const colores = [
        {
          border: '#ff620f',
          background: 'rgba(248, 0, 0, 0)'
        },
        {
          border: '#16835b',
          background: 'rgba(255, 99, 15, 0)'
        },
        {
          border: '#275dde',
          background: 'rgba(255, 99, 15, 0)'
        },
        {
          border: '#8b5cf6',
          background: 'rgba(255, 99, 15, 0)'
        },
      ];

      const datasets: ChartData<'line', number[], string>['datasets'] = rankings.map((ranking, index) => {

        const registros = registrosOrdenados.filter(
          item => item.ranking === ranking
        );

        const nombre = registros[0]?.tipo_requerimiento ?? `Ranking ${ranking}`;
        const valores = periodos.map(periodo => {
          const registro = registros.find(
            item => item.periodo === periodo
          );
          return registro?.tickets ?? 0;
        });

        const color = colores[index % colores.length];

        return {
          label: this.acortarTexto(nombre),
          data: valores,
          borderColor: color.border,
          backgroundColor: color.background,
          pointBackgroundColor: color.border,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.3,
          fill: true
        };
      });

      this.chartData = {
        labels: periodos,
        datasets
      };

      return;
    }

    // 2. INCIDENTES SLA
    if (!datos || Array.isArray(datos) || !datos.series.length) {
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }

    const primeraSerie = datos.series[0];
    const labels = primeraSerie.puntos.map(
      punto => this.formatearMes(punto.mes)
    );
    const colores = [
      '#ff620f',
      '#16835b',
      '#275dde',
      '#8b5cf6'
    ];

    const datasets = datos.series.map(
      (serie, index) => {
        const color = colores[index % colores.length];

        return {
          label: serie.tipo_incidente ?? `Tipo ${serie.ranking}`,
          data: serie.puntos.map(
            punto => punto.tickets
          ),
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false
        };
      }
    );
    this.chartData = {
      labels,
      datasets
    };
  }

  private acortarTexto(texto: string): string {
    const limite = 28;
    if (texto.length <= limite) {
      return texto;
    }
    return texto.substring(0, limite) + '...';
  }


  private formatearMes(mes: string): string {
    const [, month] = mes.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses[
      Number(month) - 1
    ] ?? mes;
  }

  cambiarRanking(valor: string): void {
    this.rankingSeleccionado = valor;
    const [desde, hasta] = valor.split('-').map(Number);
    this.rankingChange.emit({
      desde: desde,
      hasta: hasta
    });
  }
}