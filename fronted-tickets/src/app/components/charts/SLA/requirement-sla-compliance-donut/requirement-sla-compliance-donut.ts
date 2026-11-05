
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { RequirementSLACumplimientoOut, RequirementSLASolucionCondicion, RequirementSLACondicionDia, RequirementSLACondicionDiaOut } from '../../../../models/requirement-sla';

type ModoDona = 'cumplimiento-sla' | 'condicion-dia';

interface SegmentoDona {
  condicion: string;
  tickets: number;
  porcentaje: number;
  color: string;
  seleccionable: boolean;
}

@Component({
  selector: 'app-requirement-sla-compliance-donut',
  standalone: false,
  templateUrl: './requirement-sla-compliance-donut.html',
  styleUrl: './requirement-sla-compliance-donut.css'
})
export class RequirementSlaComplianceDonut implements OnChanges {

  // Modo predeterminado: comportamiento original
  @Input() modo: ModoDona = 'cumplimiento-sla';

  // Datos del cumplimiento SLA
  @Input() datos: RequirementSLACumplimientoOut | null = null;

  // Datos de distribución por condición día
  @Input() datosCondicionDia: RequirementSLACondicionDiaOut | null = null;

  // Estados comunes
  @Input() cargando = false;
  @Input() error: string | null = null;

  // Filtro dinámico exclusivo de cumplimiento SLA
  @Input() seleccion: RequirementSLASolucionCondicion | null = null;

  @Output() seleccionChange = new EventEmitter<RequirementSLASolucionCondicion | null>();

  readonly chartType: 'doughnut' = 'doughnut';
  readonly chartPlugins = [ChartDataLabels];

  // Categorías originales de Cumplimiento SLA
  private readonly condicionesCumplimiento: { nombre: string; color: string; seleccionable: boolean; }[] = [
    {
      nombre: 'Cumplido',
      color: '#16835B',
      seleccionable: true
    },
    {
      nombre: 'No cumplido',
      color: '#D95C4F',
      seleccionable: true
    },
    {
      nombre: 'Medición cancelada',
      color: '#98A2B3',
      seleccionable: false
    }
  ];

  // Categorías originales de Condición Día
  private readonly condicionesDia: { nombre: RequirementSLACondicionDia; color: string; }[] = [
    {
      nombre: 'Lun-Vie',
      color: '#FF620F'
    },
    {
      nombre: 'Fuera Horario',
      color: '#16835B'
    },
    {
      nombre: 'Fin Sem.',
      color: '#63B891'
    }
  ];

  // Datos preparados para Chart.js
  resumen: SegmentoDona[] = [];
  totalTickets = 0;

  // Valores originales de Cumplimiento SLA
  porcentajeCumplimiento = 0;
  cumplidos = 0;
  incumplidos = 0;
  cancelados = 0;

  chartData: ChartData<'doughnut', number[], string> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 8
      }
    ]
  };
  chartOptions: ChartOptions<'doughnut'> = this.crearOpciones();

  // Detectar cambios del componente padre
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modo']) {
      this.chartOptions = this.crearOpciones();
    }
    if (changes['modo'] || changes['datos'] || changes['datosCondicionDia']) {
      this.prepararGrafico();
    }
  }


  // Configuración compartida de Chart.js
  private crearOpciones(): ChartOptions<'doughnut'> {
    const esCondicionDia = this.modo === 'condicion-dia';
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: esCondicionDia ? '66%' : '68%',

      animation: {
        duration: 350
      },

      layout: {
        padding: esCondicionDia ? 6 : 8
      },

      // Selección exclusiva del cumplimiento SLA
      onClick: (_evento, elementos) => {

        if (this.modo !== 'cumplimiento-sla') {
          return;
        }

        if (elementos.length === 0) {
          return;
        }

        this.seleccionarSegmento(elementos[0].index);
      },

      // Cursor interactivo solo en estados seleccionables
      onHover: (_evento, elementos, chart) => {

        if (this.modo !== 'cumplimiento-sla') {
          chart.canvas.style.cursor = 'default';
          return;
        }

        const indice = elementos[0]?.index;

        const item = indice !== undefined
          ? this.resumen[indice]
          : null;

        chart.canvas.style.cursor =
          item?.seleccionable ? 'pointer' : 'default';
      },

      plugins: {

        // Las leyendas se construyen desde HTML
        legend: {
          display: false
        },

        // Tooltip compartido
        tooltip: {
          backgroundColor: '#101828',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          padding: 12,
          displayColors: true,

          callbacks: {
            label: (context) => {
              const item = this.resumen[context.dataIndex];
              if (!item) {
                return '';
              }
              const cantidad = item.tickets.toLocaleString('es-PE');
              const porcentaje = item.porcentaje.toFixed(2);
              return ` ${cantidad} requerimientos (${porcentaje}%)`;
            }
          }
        },

        // Porcentajes dentro de los segmentos
        datalabels: {
          color: '#FFFFFF',

          font: {
            size: 12,
            weight: 'bold'
          },

          anchor: 'center',
          align: 'center',

          // Ocultar porcentajes de segmentos menores al 5%
          display: (context) => {
            const item = this.resumen[context.dataIndex];
            return !!item && item.tickets > 0 && item.porcentaje >= 5;
          },

          formatter: (_valor, context) => {
            const item = this.resumen[context.dataIndex];
            if (!item || item.tickets === 0) {
              return '';
            }
            return `${item.porcentaje.toFixed(2)}%`;
          }
        }
      }
    };
  }


  // Preparar datos según el modo
  private prepararGrafico(): void {
    if (this.modo === 'condicion-dia') {
      this.prepararCondicionDia();
    } else {
      this.prepararCumplimientoSla();
    }
    this.actualizarChartData();
  }


  // Modo 1: Cumplimiento SLA (lógica original)
  private prepararCumplimientoSla(): void {
    this.totalTickets = this.datos?.total_tickets ?? 0;
    this.porcentajeCumplimiento = this.datos?.porcentaje_cumpl_req ?? 0;
    this.cumplidos = this.datos?.cumplidos ?? 0;
    this.incumplidos = this.datos?.incumplidos ?? 0;
    this.cancelados = this.datos?.cancelados ?? 0;
    // Conservar orden y colores originales
    this.resumen = this.condicionesCumplimiento.map(
      condicion => {

        const registro = this.datos?.distribucion.find(
          item => item.condicion === condicion.nombre
        );

        return {
          condicion: condicion.nombre,
          tickets: registro?.tickets ?? 0,
          porcentaje: registro?.porcentaje ?? 0,
          color: condicion.color,
          seleccionable: condicion.seleccionable
        };
      }
    );

    // Estados adicionales
    if ((this.datos?.otros ?? 0) > 0) {

      const registro = this.datos?.distribucion.find(
        item => item.condicion === 'Otros / Sin medición'
      );

      this.resumen.push({
        condicion: 'Otros / Sin medición',
        tickets: this.datos?.otros ?? 0,
        porcentaje: registro?.porcentaje ?? 0,
        color: '#D97706',
        seleccionable: false
      });
    }
  }


  // Modo 2: Distribución por Condición Día
  private prepararCondicionDia(): void {

    this.totalTickets =
      this.datosCondicionDia?.total_tickets ?? 0;

    // Valores exclusivos del otro modo
    this.porcentajeCumplimiento = 0;
    this.cumplidos = 0;
    this.incumplidos = 0;
    this.cancelados = 0;

    // Respetar el orden del componente original
    this.resumen = this.condicionesDia.map(
      condicion => {

        const registro = this.datosCondicionDia?.distribucion.find(
          item => item.condicion_dia === condicion.nombre
        );

        return {
          condicion: condicion.nombre,
          tickets: registro?.tickets ?? 0,
          porcentaje: registro?.porcentaje ?? 0,
          color: condicion.color,

          // Condición Día no tiene filtro dinámico
          seleccionable: false
        };
      }
    );
  }


  // Construcción única del gráfico
  private actualizarChartData(): void {

    this.chartData = {
      labels: this.resumen.map(
        item => item.condicion
      ),

      datasets: [
        {
          data: this.resumen.map(
            item => item.tickets
          ),

          backgroundColor: this.resumen.map(
            item => item.color
          ),

          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    };
  }


  // Seleccionar segmento de Cumplimiento SLA
  private seleccionarSegmento(indice: number): void {

    if (this.modo !== 'cumplimiento-sla') {
      return;
    }

    const item = this.resumen[indice];

    if (!item || !item.seleccionable) {
      return;
    }

    this.emitirSeleccion(item.condicion);
  }


  // Seleccionar desde la leyenda
  seleccionarCondicion(condicion: string): void {
    this.emitirSeleccion(condicion);
  }


  // Validar y notificar el filtro al padre
  private emitirSeleccion(condicion: string): void {

    if (this.modo !== 'cumplimiento-sla') {
      return;
    }

    if (condicion !== 'Cumplido' && condicion !== 'No cumplido') {
      return;
    }

    // El padre mantiene la lógica de alternancia
    this.seleccionChange.emit(
      condicion as RequirementSLASolucionCondicion
    );
  }


  // Limpiar selección de Cumplimiento SLA
  quitarSeleccion(): void {
    if (this.modo !== 'cumplimiento-sla' || this.seleccion === null) {
      return;
    }
    this.seleccionChange.emit(null);
  }


  // Verificar si existen tickets
  get tieneDatos(): boolean {
    return this.totalTickets > 0;
  }


  // Conservar cálculo semántico de Cumplimiento SLA
  obtenerClaseCumplimiento(): string {
    if (this.porcentajeCumplimiento >= 95) {
      return 'sla-good';
    }
    if (this.porcentajeCumplimiento >= 90) {
      return 'sla-warning';
    }
    return 'sla-danger';
  }

}
