
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IncidentSLAParetoItem } from '../../../../models/incident-sla';
import { RequirementSLAParetoItem } from '../../../../models/requirement-sla';

@Component({
  selector: 'app-sla-pareto',
  standalone: false,
  templateUrl: './sla-pareto.html',
  styleUrl: './sla-pareto.css'
})
export class SLAPareto implements OnChanges {

  //Inputs
  @Input() datos: (IncidentSLAParetoItem | RequirementSLAParetoItem)[] = [];
  @Input() entidad: 'incidentes' | 'requerimientos' = 'incidentes';
  @Input() titulo = 'Pareto de Tipos de Incidente';
  @Input() descripcion = 'Tipos con mayor volumen y porcentaje acumulado de tickets.';
  @Input() seleccionMultiple = false;
  @Input() tiposSeleccionados: string[] = [];
  @Output() tiposChange = new EventEmitter<string[]>();

  //Variables
  categoriasSeleccionables: (string | null)[] = [];
  readonly chartPlugins = [ChartDataLabels];
  categoriasCompletas: string[] = [];
  participaciones: number[] = [];

  //Char
  chartData: ChartData<'bar' | 'line', number[], string> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'bar' | 'line'> = this.crearOpciones(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['entidad'] || changes['seleccionMultiple'] || changes['tiposSeleccionados']) {
      this.actualizarGrafico();
    }
  }

  // CONFIGURACIÓN DEL GRÁFICO
  private crearOpciones(esRequerimientos: boolean): ChartOptions<'bar' | 'line'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },

      // CLIC SOBRE UNA BARRA
      onClick: (evento, _elementos, grafico) => {

        // No permitir selección en Requerimientos SLA
        if (!this.seleccionMultiple) {
          return;
        }

        const eventoNativo = evento.native;
        if (!eventoNativo) {
          return;
        }

        //Detecta qué elementos están bajo el cursor
        const elementos = grafico.getElementsAtEventForMode(
          eventoNativo,
          'nearest',
          { intersect: true },
          false
        );

        //Filtra la lista para buscar ÚNICAMENTE si se tocó una barra
        const barra = elementos.find(
          elemento => grafico.data.datasets[elemento.datasetIndex]?.type === 'bar'
        );

        if (!barra) {
          return;
        }

        // Obtener el tipo real - Alto Consumo de CPU
        const tipo = this.categoriasSeleccionables[barra.index];

        // Ignorar "Otros" y categorías sin tipo
        if (!tipo) {
          return;
        }

        // Alternar selección
        const seleccion = new Set(this.tiposSeleccionados);

        if (seleccion.has(tipo)) {
          seleccion.delete(tipo);
        } else {
          seleccion.add(tipo);
        }

        // Comunicar al componente padre
        this.tiposChange.emit([...seleccion]);
      },

      // CAMBIAR CURSOR SOBRE BARRAS SELECCIONABLES
      onHover: (evento, _elementos, grafico) => {

        if (!this.seleccionMultiple) {
          grafico.canvas.style.cursor = 'default';
          return;
        }

        // Obtener el evento nativo
        const eventoNativo = evento.native;

        if (!eventoNativo) {
          grafico.canvas.style.cursor = 'default';
          return;
        }

        // Detectar la barra sobre la que está el cursor
        const elementos = grafico.getElementsAtEventForMode(
          eventoNativo,
          'nearest',
          { intersect: true },
          false
        );

        const barra = elementos.find(
          elemento => grafico.data.datasets[elemento.datasetIndex]?.type === 'bar'
        );

        const tipo = barra ? this.categoriasSeleccionables[barra.index] : null;
        grafico.canvas.style.cursor = tipo ? 'pointer' : 'default';
      },


      plugins: {

        // Cantidades encima de las barras
        datalabels: {

          display: (context) => {
            const valor = Number(
              context.dataset.data[context.dataIndex]
            );
            return context.dataset.type === 'bar' && valor > 0;
          },

          anchor: 'end',
          align: 'end',
          offset: 4,
          color: '#544834',

          font: {
            size: 12,
            weight: 'bold'
          },

          formatter: (value: number) => {
            return value.toLocaleString('es-PE');
          }
        },

        // Leyenda solo para incidentes
        legend: {
          display: !esRequerimientos,
          position: 'top',
          align: 'end'
        },


        tooltip: {
          callbacks: {
            // TÍTULO DEL TOOLTIP
            title: (items) => {
              const indice = items[0]?.dataIndex ?? -1;
              return this.categoriasCompletas[indice] ?? '';
            },

            // INFORMACIÓN DEL TOOLTIP
            label: (context) => {

              const valor = context.parsed.y ?? 0;
              if (context.dataset.label === '% acumulado') {
                return `Acumulado: ${valor.toFixed(2)}%`;
              }

              const cantidad = valor.toLocaleString('es-PE');
              if (esRequerimientos) {
                const participacion = this.participaciones[context.dataIndex] ?? 0;
                return [
                  `Cantidad: ${cantidad}`,
                  `Participación: ${participacion.toFixed(1)}%`
                ];
              }
              return `Tickets: ${cantidad}`;
            },

            // ESTADO DE SELECCIÓN DE LA BARRA
            afterLabel: (context) => {

              // Solo habilitado en Incidentes SLA
              if (!this.seleccionMultiple || context.dataset.type !== 'bar') {
                return '';
              }
              const tipo = this.categoriasSeleccionables[context.dataIndex];

              // Otros no es seleccionable
              if (!tipo) {
                return 'No disponible para filtrar';
              }

              // Mostrar estado del filtro
              return this.tiposSeleccionados.includes(tipo)
                ? 'Seleccionado - clic para quitar'
                : 'Clic para seleccionar';
            }
          }
        }
      },

      // EJES
      scales: {
        x: {
          grid: {
            display: false
          },

          ticks: {
            maxRotation: 35,
            minRotation: 0
          }
        },

        // Eje izquierdo: cantidad
        y: {
          type: 'linear',
          beginAtZero: true,
          grace: '12%',
          position: 'left',

          title: {
            display: true,
            text: esRequerimientos ? 'Cantidad' : 'Tickets'
          },

          ticks: {
            precision: 0
          }
        },

        // Eje derecho: solo incidentes
        y1: {
          type: 'linear',
          display: !esRequerimientos,
          beginAtZero: true,
          min: 0,
          max: 100,
          position: 'right',

          title: {
            display: true,
            text: 'Acumulado'
          },

          ticks: {
            stepSize: 20,
            callback: (value) => {
              return value + '%';
            }
          },

          grid: {
            drawOnChartArea: false
          }
        }
      }
    };
  }

  // ACTUALIZAR GRÁFICO
  private actualizarGrafico(): void {
    const esRequerimientos = this.entidad === 'requerimientos';
    this.chartOptions = this.crearOpciones(esRequerimientos);

    if (!this.datos.length) {
      this.categoriasCompletas = [];
      this.participaciones = [];
      this.categoriasSeleccionables = [];
      this.chartData = {
        labels: [],
        datasets: []
      };
      return;
    }

    let categorias: { nombre: string; tickets: number; porcentaje: number; acumulado: number; }[] = [];

    // REQUERIMIENTOS SLA
    if (esRequerimientos) {
      const requerimientos = this.datos
        .filter((item): item is RequirementSLAParetoItem => 'tipo_requerimiento' in item)
        .sort((a, b) => a.ranking - b.ranking);

      // Respetar la información del backend
      categorias = requerimientos.map(item => ({
        nombre: item.tipo_requerimiento || 'Sin tipo',
        tickets: item.cantidad,
        porcentaje: item.porcentaje,
        acumulado: item.porcentaje_acumulado
      }));

      this.categoriasSeleccionables = requerimientos.map(
        item => item.tipo_requerimiento?.trim() || null
      );

    }
    // INCIDENTES SLA
    else {
      const incidentes = this.datos.filter((item): item is IncidentSLAParetoItem => 'tipo_incidente' in item);

      // Top 10 individual
      const top = incidentes.slice(0, 10);

      // Tipos restantes agrupados
      const restantes = incidentes.slice(10);
      const totalTickets = incidentes.reduce((total, item) => total + item.tickets, 0);
      const ticketsOtros = restantes.reduce((total, item) => total + item.tickets, 0);

      // TIPOS INDIVIDUALES
      const registros = top.map(item => ({
        nombre: item.tipo_incidente || 'Sin tipo',
        tickets: item.tickets,
        tipoSeleccionable: item.tipo_incidente?.trim() || null
      }));

      // AGRUPACIÓN "OTROS"
      if (ticketsOtros > 0) {

        registros.push({
          nombre: 'Otros',
          tickets: ticketsOtros,
          tipoSeleccionable: null
        });

      }

      // GUARDAR LOS TIPOS QUE SÍ SE PUEDEN SELECCIONAR
      this.categoriasSeleccionables = registros.map(
        item => {

          if (
            !item.tipoSeleccionable ||
            item.tipoSeleccionable === 'Otros'
          ) {
            return null;
          }

          return item.tipoSeleccionable;
        }
      );

      // CALCULAR PORCENTAJES Y ACUMULADO
      let acumuladoTickets = 0;

      categorias = registros.map(item => {

        acumuladoTickets += item.tickets;

        return {

          nombre: item.nombre,

          tickets: item.tickets,

          porcentaje: totalTickets > 0
            ? (item.tickets / totalTickets) * 100
            : 0,

          acumulado: totalTickets > 0
            ? Number(
              (
                acumuladoTickets / totalTickets * 100
              ).toFixed(2)
            )
            : 0

        };

      });

    }

    // DATOS PARA EL TOOLTIP
    this.categoriasCompletas = categorias.map(
      item => item.nombre
    );
    this.participaciones = categorias.map(
      item => item.porcentaje
    );


    // COLORES DINÁMICOS DE LAS BARRAS
    const coloresBarras = categorias.map((_, indice) => {

      if (!this.seleccionMultiple) {
        return '#ffb184';
      }

      const tipo = this.categoriasSeleccionables[indice];

      // "Otros" y categorías no seleccionables
      if (!tipo) {
        return '#d0d5dd';
      }

      // Sin filtros: todas las barras usan naranja suave
      if (this.tiposSeleccionados.length === 0) {
        return '#ffb184';
      }

      // Seleccionado: naranja Canvia
      if (this.tiposSeleccionados.includes(tipo)) {
        return '#ff620f';
      }

      // No seleccionado: naranja claro
      return '#ffe4d4';

    });

    const bordesBarras = categorias.map((_, indice) => {

      if (!this.seleccionMultiple) {
        return '#ff620f';
      }

      const tipo = this.categoriasSeleccionables[indice];

      if (!tipo) {
        return '#98a2b3';
      }

      return this.tiposSeleccionados.includes(tipo)
        ? '#d84a00'
        : '#ff620f';

    });


    // DATASET DE BARRAS

    const datasets: ChartData<
      'bar' | 'line',
      number[],
      string
    >['datasets'] = [
        {
          type: 'bar',
          label: esRequerimientos ? 'Cantidad' : 'Tickets',
          data: categorias.map(item => item.tickets),
          backgroundColor: coloresBarras,
          borderColor: bordesBarras,
          borderWidth: 1,
          borderRadius: 5,
          maxBarThickness: 45,
          yAxisID: 'y',
          order: 2
        }
      ];


    // LÍNEA VERDE: SOLO INCIDENTES
    if (!esRequerimientos) {
      datasets.push({
        type: 'line',
        label: '% acumulado',
        data: categorias.map(item => item.acumulado),
        borderColor: '#16835b',
        backgroundColor: '#16835b',
        pointBackgroundColor: '#16835b',
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        borderDash: [3, 3],
        tension: 0.25,
        yAxisID: 'y1',
        order: 1
      });
    }

    // ASIGNAR DATOS AL GRÁFICO
    this.chartData = {
      labels: categorias.map(
        item => this.acortarTexto(item.nombre)
      ),
      datasets: datasets
    };
  }


  // ACORTAR ETIQUETAS
  private acortarTexto(texto: string): string {
    const limite = 20;
    if (texto.length <= limite) {
      return texto;
    }
    return texto.substring(0, limite) + '...';
  }

}
