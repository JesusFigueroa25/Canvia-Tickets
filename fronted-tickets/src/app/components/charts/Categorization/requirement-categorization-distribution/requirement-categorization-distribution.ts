
import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { AuditResolutionReasonList, AuditSummary, AuditResultStatus } from '../../../../models/requirement-categorization-audit';

interface SegmentoCategorizacion {
  nombre: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

@Component({
  selector: 'app-requirement-categorization-distribution',
  standalone: false,
  templateUrl: './requirement-categorization-distribution.html',
  styleUrl: './requirement-categorization-distribution.css'
})
export class RequirementCategorizationDistribution implements OnChanges {

  @Input() datos: AuditSummary | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;


  @Input() modo: 'categorizacion' | 'motivo_resolucion' = 'categorizacion';
  @Input() datosMotivos: AuditResolutionReasonList | null = null;

  // FILTRO DINÁMICO: CORRECTAS / INCORRECTAS
  @Input() resultadoSeleccionado: AuditResultStatus | null = null;
  @Output() resultadoChange = new EventEmitter<AuditResultStatus>();

  // FILTRO DINÁMICO: MOTIVO DE RESOLUCIÓN
  @Input() motivoSeleccionado:
    | 'Atribuible a Cliente'
    | 'Atribuible a Canvia'
    | null = null;

  @Output() motivoChange = new EventEmitter<
    'Atribuible a Cliente' | 'Atribuible a Canvia'
  >();

  readonly chartType: 'doughnut' = 'doughnut';
  readonly chartPlugins = [ChartDataLabels];

  private readonly condiciones = [
    {
      nombre: 'Correctas',
      color: '#16835B'
    },
    {
      nombre: 'Incorrectas',
      color: '#D95C4F'
    }
  ];

  resumen: SegmentoCategorizacion[] = [];
  totalTickets = 0;

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

  ngOnChanges(): void {
    this.prepararGrafico();
  }



  seleccionarDesdeLeyenda(nombre: string): void {

    if (this.cargando || this.error || !this.tieneDatos) {
      return;
    }

    // FILTRO 1: CATEGORIZACIONES
    if (this.modo === 'categorizacion') {

      if (nombre === 'Correctas') {
        this.resultadoChange.emit('CORRECT');
      }

      else if (nombre === 'Incorrectas') {
        this.resultadoChange.emit('INCORRECT');
      }

      return;
    }

    // FILTRO 2: MOTIVO DE RESOLUCIÓN
    if (this.modo === 'motivo_resolucion') {

      if (
        nombre === 'Atribuible a Cliente' ||
        nombre === 'Atribuible a Canvia'
      ) {
        this.motivoChange.emit(nombre);
      }

      // SIN_DATO no activa ningún filtro.
    }
  }



  seleccionarDesdeGrafico(
    evento: { active?: object[] }
  ): void {

    if (this.cargando || this.error) {
      return;
    }

    const segmento = evento.active?.[0] as
      { index?: number } | undefined;

    const indice = segmento?.index;

    if (
      indice === undefined ||
      !Number.isInteger(indice)
    ) {
      return;
    }

    const item = this.resumen[indice];

    if (!item || item.cantidad <= 0) {
      return;
    }

    // Reutiliza la lógica según el modo de la dona.
    this.seleccionarDesdeLeyenda(item.nombre);
  }


  // Identificar el elemento seleccionado.
  esResultadoSeleccionado(nombre: string): boolean {

    if (this.modo !== 'categorizacion') {
      return false;
    }

    if (nombre === 'Correctas') {
      return this.resultadoSeleccionado === 'CORRECT';
    }

    if (nombre === 'Incorrectas') {
      return this.resultadoSeleccionado === 'INCORRECT';
    }

    return false;
  }



  // Comprobar si una categoría permite filtrado.
  esSegmentoFiltrable(nombre: string): boolean {

    if (this.modo === 'categorizacion') {
      return nombre === 'Correctas' ||
        nombre === 'Incorrectas';
    }

    return nombre === 'Atribuible a Cliente' ||
      nombre === 'Atribuible a Canvia';
  }


  // Identificar el motivo seleccionado.
  esMotivoSeleccionado(nombre: string): boolean {
    return this.modo === 'motivo_resolucion' &&
      this.motivoSeleccionado === nombre;
  }



  private prepararGrafico(): void {

    const elementos: {
      nombre: string;
      cantidad: number;
      color: string;
    }[] = [];

    if (this.modo === 'motivo_resolucion') {

      const motivos = this.datosMotivos?.items ?? [];

      for (const motivo of motivos) {

        const razon = motivo.reason.trim();

        let color = '#98A2B3';
        let nombre = razon;

        if (razon === 'Atribuible a Cliente') {
          color = '#FF620F';
        } else if (razon === 'Atribuible a Canvia') {
          color = '#16835B';
        } else if (razon === 'SIN_DATO') {
          nombre = 'Sin dato';
        }

        elementos.push({
          nombre,
          cantidad: Math.max(0, motivo.total_tickets),
          color
        });
      }

    } else {

      const correctos = Math.max(
        0,
        this.datos?.correct_count ?? 0
      );

      const incorrectos = Math.max(
        0,
        this.datos?.incorrect_count ?? 0
      );

      elementos.push(
        {
          nombre: 'Correctas',
          cantidad: correctos,
          color: '#16835B'
        },
        {
          nombre: 'Incorrectas',
          cantidad: incorrectos,
          color: '#D95C4F'
        }
      );
    }

    this.totalTickets = elementos.reduce(
      (total, item) => total + item.cantidad,
      0
    );

    this.resumen = elementos.map(item => ({
      ...item,
      porcentaje: this.totalTickets > 0
        ? (item.cantidad / this.totalTickets) * 100
        : 0
    }));

    this.chartData = {
      labels: this.resumen.map(item => item.nombre),
      datasets: [
        {
          data: this.resumen.map(item => item.cantidad),
          backgroundColor: this.resumen.map(item => item.color),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    };
  }


  private crearOpciones(): ChartOptions<'doughnut'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: {
        duration: 350
      },
      layout: {
        padding: 8
      },
      // CAMBIAR CURSOR AL PASAR SOBRE SEGMENTOS FILTRABLES
      onHover: (_evento, elementosActivos, grafico) => {

        const indice = elementosActivos[0]?.index;

        const item = indice !== undefined
          ? this.resumen[indice]
          : undefined;

        const esFiltrable =
          !this.cargando &&
          !this.error &&
          !!item &&
          item.cantidad > 0 &&
          this.esSegmentoFiltrable(item.nombre);

        grafico.canvas.style.cursor = esFiltrable
          ? 'pointer'
          : 'default';
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
          displayColors: true,
          callbacks: {
            label: (context) => {
              const item = this.resumen[context.dataIndex];

              if (!item) {
                return '';
              }

              const cantidad = item.cantidad.toLocaleString('es-PE');
              const porcentaje = item.porcentaje.toFixed(2);

              return ` ${cantidad} requerimientos (${porcentaje}%)`;
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

            return !!item &&
              item.cantidad > 0 &&
              item.porcentaje >= 5;
          },
          formatter: (_valor, context) => {
            const item = this.resumen[context.dataIndex];

            if (!item || item.cantidad === 0) {
              return '';
            }

            return `${item.porcentaje.toFixed(1)}%`;
          }
        }
      }
    };
  }

  get tieneDatos(): boolean {
    return this.totalTickets > 0;
  }

  get tituloGrafico(): string {
    return this.modo === 'motivo_resolucion'
      ? 'Distribución por Motivo Resolución'
      : 'Distribución de Categorizaciones';
  }

  get descripcionGrafico(): string {
    return this.modo === 'motivo_resolucion'
      ? 'Distribución de requerimientos según el motivo de resolución registrado.'
      : 'Proporción de requerimientos con categorización correcta e incorrecta según la evaluación semántica.';
  }

  get mensajeActualizando(): string {
    return this.modo === 'motivo_resolucion'
      ? 'Actualizando distribución por motivo resolución...'
      : 'Actualizando distribución de categorizaciones...';
  }

  get etiquetaCentro(): string {
    return this.modo === 'motivo_resolucion'
      ? 'Total de tickets'
      : 'Tickets evaluados';
  }

  get mensajeVacio(): string {
    return this.modo === 'motivo_resolucion'
      ? 'No hay motivos de resolución disponibles.'
      : 'No hay resultados de categorización disponibles.';
  }

  get descripcionAccesible(): string {
    return this.modo === 'motivo_resolucion'
      ? 'Distribución de requerimientos por motivo de resolución'
      : 'Distribución de categorizaciones correctas e incorrectas';
  }


}
