
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentSLAVolumenItem } from '../../../models/incident-sla';
import { IncidentConsolidatedVolumenItem } from '../../../models/incident-consolidated';
import { RequirementSLAVolumenItem } from '../../../models/requirement-sla';

@Component({
  selector: 'app-volume-month',
  standalone: false,
  templateUrl: './volume-month.html',
  styleUrl: './volume-month.css'
})
export class VolumeMonth implements OnChanges {

  @Input() datos: (IncidentSLAVolumenItem | RequirementSLAVolumenItem)[] = [];
  @Input() datosConsolidados: IncidentConsolidatedVolumenItem[] = [];
  @Input() modo: 'sla' | 'consolidado' = 'sla';
  @Input() entidadConsolidado: 'incidentes' | 'requerimientos' = 'incidentes';
  @Input() entidadSla: 'incidentes' | 'requerimientos' = 'incidentes';

  // FILTRO DINAMICO - SOLO INCIDENTES CONSOLIDADOS
  @Input() habilitarFiltroMes = false;
  @Input() periodoSeleccionado: string | null = null;
  @Input() cargando = false;
  @Output() periodoChange = new EventEmitter<string | null>();

  // DATOS ORDENADOS
  private registrosConsolidados: IncidentConsolidatedVolumenItem[] = [];
  private registrosSla: IncidentSLAVolumenItem[] = [];

  // Registros originales de Requerimientos SLA
  private registrosRequerimientosSla: RequirementSLAVolumenItem[] = [];

  // CONFIGURACION CHART.JS
  chartData: ChartData<'bar' | 'line', (number | null)[], string> = {
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

  readonly chartPlugins = [ChartDataLabels];



  get filtroMesActivo(): boolean {

    if (!this.habilitarFiltroMes) {
      return false;
    }

    // Consolidados: incidentes y requerimientos
    if (this.modo === 'consolidado') {
      return (
        this.entidadConsolidado === 'incidentes' ||
        this.entidadConsolidado === 'requerimientos'
      );
    }

    // SLA: incidentes y requerimientos
    if (this.modo === 'sla') {
      return (
        this.entidadSla === 'incidentes' ||
        this.entidadSla === 'requerimientos'
      );
    }

    return false;
  }



  // OPCIONES DEL GRAFICO
  chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },

    // CLIC PARA SELECCIONAR O QUITAR UN MES
    onClick: (evento, _elementos, grafico) => {
      if (!this.filtroMesActivo || this.cargando) {
        return;
      }

      const eventoNativo = evento.native;

      if (!eventoNativo) {
        return;
      }

      // SOLO SELECCIONAR AL HACER CLIC EN UNA BARRA
      const elementos = grafico.getElementsAtEventForMode(eventoNativo, 'nearest', { intersect: true }, false);
      const barra = elementos.find(
        elemento => elemento.datasetIndex === 0
      );

      if (!barra) {
        return;
      }

      // TOMAR EL VALOR REAL DEL BACKEND: YYYY-MM

      // Obtener el mes correspondiente a la barra
      const periodo = this.obtenerPeriodoPorIndice(barra.index);


      if (!periodo) {
        return;
      }

      // SEGUNDO CLIC SOBRE EL MISMO MES: QUITAR FILTRO
      const nuevaSeleccion =
        this.periodoSeleccionado === periodo
          ? null
          : periodo;

      // NOTIFICAR AL COMPONENTE PADRE
      this.periodoChange.emit(nuevaSeleccion);
    },


    // CURSOR INTERACTIVO
    onHover: (evento, _elementos, grafico) => {

      if (!this.filtroMesActivo || this.cargando) {
        grafico.canvas.style.cursor = 'default';
        return;
      }

      const eventoNativo = evento.native;

      if (!eventoNativo) {
        grafico.canvas.style.cursor = 'default';
        return;
      }

      const elementos = grafico.getElementsAtEventForMode(
        eventoNativo,
        'nearest',
        { intersect: true },
        false
      );

      grafico.canvas.style.cursor = elementos.some(
        elemento => elemento.datasetIndex === 0
      )
        ? 'pointer'
        : 'default';
    },

    // PLUGINS
    plugins: {

      legend: {
        position: 'top',
        align: 'end'
      },

      tooltip: {
        callbacks: {

          label: (context) => {
            const valor = context.parsed.y;

            if (valor === null) {
              return '';
            }

            if (context.dataset.label === 'Tendencia') {
              return `Tendencia: ${valor.toLocaleString('es-PE', {
                maximumFractionDigits: 0
              })}`;
            }

            if (context.dataset.label === 'Media móvil 3M') {
              return `Media móvil 3M: ${valor.toLocaleString('es-PE')}`;
            }

            return `Tickets: ${valor.toLocaleString('es-PE')}`;
          },


          // MOSTRAR ESTADO DE SELECCION DEL MES
          afterLabel: (context) => {

            if (!this.filtroMesActivo || context.datasetIndex !== 0) {
              return '';
            }

            const periodo = this.obtenerPeriodoPorIndice(
              context.dataIndex
            );


            if (!periodo) {
              return '';
            }

            return this.periodoSeleccionado === periodo ? 'Mes seleccionado - clic para quitar' : 'Clic para filtrar por este mes';
          }
        }
      },

      // CANTIDADES ENCIMA DE LAS BARRAS
      datalabels: {

        display: (context) => {
          const valor = context.dataset.data[
            context.dataIndex
          ];
          return (
            context.dataset.type === 'bar' &&
            typeof valor === 'number' &&
            valor > 0
          );
        },

        anchor: 'end',
        align: 'end',
        offset: 4,
        clip: false,
        color: '#344054',

        font: {
          size: 11.5,
          weight: 'bold'
        },

        formatter: (value: number) => {
          return value.toLocaleString('es-PE');
        }
      }
    },


    // ESPACIADO

    layout: {
      padding: {
        top: 16
      }
    },

    // EJES
    scales: {
      x: {
        grid: {
          display: false
        }
      },

      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        grace: '12%'
      }
    }
  };

  // DETECTAR CAMBIOS
  ngOnChanges(changes: SimpleChanges): void {

    if (
      changes['datos'] ||
      changes['datosConsolidados'] ||
      changes['modo'] ||
      changes['entidadConsolidado'] ||
      changes['entidadSla'] ||
      changes['habilitarFiltroMes'] ||
      changes['periodoSeleccionado']
    ) {
      this.actualizarGrafico();
    }

  }

  // ACTUALIZAR GRAFICO
  private actualizarGrafico(): void {

    // 1. CONSOLIDADOS
    if (this.modo === 'consolidado') {
      const registros = [...this.datosConsolidados].sort(
        (a, b) =>
          (a.anio - b.anio) ||
          (a.mes - b.mes)
      );
      this.registrosConsolidados = registros;

      // COLORES DE BARRAS SEGUN EL MES SELECCIONADO
      //09/11/2026
      const colores = registros.map((item, index) => {

        if (!this.filtroMesActivo || !this.periodoSeleccionado) {
          return this.colores[index % this.colores.length];
        }

        return this.obtenerPeriodoApi(item) === this.periodoSeleccionado
          ? '#FF620F'
          : '#FFE4D4';
      });
      //Fin


      const bordes = registros.map(item => {
        if (this.filtroMesActivo && this.obtenerPeriodoApi(item) === this.periodoSeleccionado) {
          return '#D84A00';
        }
        return '#FF620F';
      });


      this.chartData = {

        labels: registros.map(
          item => item.periodo
        ),

        datasets: [
          {
            type: 'bar',
            label: 'Tickets',

            data: registros.map(
              item => item.tickets
            ),

            backgroundColor: colores,
            borderColor: bordes,
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 42
          }
        ]
      };

      return;
    }


    // 2. REQUERIMIENTOS SLA
    if (this.entidadSla === 'requerimientos') {

      const registros = this.datos.filter(
        (item): item is RequirementSLAVolumenItem =>
          'periodo' in item && 'tendencia' in item
      );

      // Guardar registros para identificar las barras
      this.registrosRequerimientosSla = registros;

      // COLORES DE BARRAS - REQUERIMIENTOS SLA
      const colores = registros.map((item, index) => {

        const colorOriginal = this.colores[index % this.colores.length];

        if (!this.filtroMesActivo || !this.periodoSeleccionado) {
          return colorOriginal;
        }

        const periodo = this.obtenerPeriodoRequerimientoSla(item);

        return periodo === this.periodoSeleccionado
          ? '#FF620F'
          : '#FFE4D4';
      });

      // COLORES DE BORDES
      const bordes = registros.map((item, index) => {

        const periodo = this.obtenerPeriodoRequerimientoSla(item);

        if (this.filtroMesActivo && this.periodoSeleccionado) {
          return periodo === this.periodoSeleccionado
            ? '#D84A00'
            : '#FFE4D4';
        }

        return this.colores[index % this.colores.length];
      });

      // Gráfico combinado: barras y tendencia
      this.chartData = {

        labels: registros.map(
          item => item.periodo
        ),

        datasets: [
          {
            type: 'bar',
            label: 'Tickets',

            data: registros.map(
              item => item.tickets
            ),

            backgroundColor: colores,
            borderColor: bordes,

            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.7,
            order: 2
          },

          {
            type: 'line',
            label: 'Tendencia',

            data: registros.map(
              item => item.tendencia
            ),

            borderColor: '#16835B',
            backgroundColor: '#16835B',

            pointBackgroundColor: '#16835B',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,

            pointRadius: 4,
            pointHoverRadius: 6,

            borderWidth: 2,
            tension: 0.35,

            fill: false,
            order: 1
          }
        ]
      };

      return;
    }


    // 3. INCIDENTES SLA

    // 3. INCIDENTES SLA
    const registros = this.datos.filter(
      (item): item is IncidentSLAVolumenItem =>
        'mes' in item
    );

    // Guardar los registros originales
    this.registrosSla = registros;

    // COLORES DE BARRAS - INCIDENTES SLA
    const colores = registros.map((item, index) => {

      const colorOriginal = this.colores[index % this.colores.length];

      if (!this.filtroMesActivo || !this.periodoSeleccionado) {
        return colorOriginal;
      }

      return item.mes === this.periodoSeleccionado
        ? '#FF620F'
        : '#FFE4D4';
    });

    // COLORES DE BORDES
    const bordes = registros.map((item, index) => {

      if (this.filtroMesActivo && this.periodoSeleccionado) {
        return item.mes === this.periodoSeleccionado
          ? '#D84A00'
          : '#FFE4D4';
      }

      return this.colores[index % this.colores.length];
    });

    // Actualizar Chart.js
    this.chartData = {
      labels: registros.map(
        item => this.formatearMes(item.mes)
      ),

      datasets: [
        {
          type: 'bar',
          label: 'Tickets',
          data: registros.map(item => item.tickets),
          backgroundColor: colores,
          borderColor: bordes,
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 42
        }
      ]
    };



  }


  // FORMATEAR MES - INCIDENTES SLA
  private formatearMes(mes: string): string {
    const [, month] = mes.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses[Number(month) - 1] ?? mes;
  }

  // CONSTRUIR PERIODO YYYY-MM PARA FASTAPI
  private obtenerPeriodoApi(item: IncidentConsolidatedVolumenItem | undefined): string | null {

    if (!item) {
      return null;
    }

    const anio = Number(item.anio);
    const mes = Number(item.mes);

    if (!Number.isInteger(anio) || !Number.isInteger(mes) || anio < 1900 || anio > 2099 || mes < 1 || mes > 12) {
      return null;
    }

    return `${anio}-${String(mes).padStart(2, '0')}`;
  }


  // Obtener período YYYY-MM de Requerimientos SLA
  private obtenerPeriodoRequerimientoSla(
    item: RequirementSLAVolumenItem | undefined
  ): string | null {

    if (!item) {
      return null;
    }

    const anio = Number(item.anio);
    const mes = Number(item.mes);

    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(mes) ||
      anio < 1900 ||
      anio > 2099 ||
      mes < 1 ||
      mes > 12
    ) {
      return null;
    }

    return `${anio}-${String(mes).padStart(2, '0')}`;
  }



  // Obtener el período real según el modo del gráfico

  // Obtener el período según el tipo de gráfico
  private obtenerPeriodoPorIndice(indice: number): string | null {

    // Incidentes Consolidados
    if (this.modo === 'consolidado') {
      return this.obtenerPeriodoApi(
        this.registrosConsolidados[indice]
      );
    }

    // Requerimientos SLA
    if (
      this.modo === 'sla' &&
      this.entidadSla === 'requerimientos'
    ) {
      return this.obtenerPeriodoRequerimientoSla(
        this.registrosRequerimientosSla[indice]
      );
    }

    // Incidentes SLA
    if (
      this.modo === 'sla' &&
      this.entidadSla === 'incidentes'
    ) {

      const periodo = this.registrosSla[indice]?.mes?.trim();

      if (
        !periodo ||
        !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo)
      ) {
        return null;
      }

      return periodo;
    }

    return null;
  }



}
