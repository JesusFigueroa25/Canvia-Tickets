
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Subject, takeUntil } from 'rxjs';
import Chart from 'chart.js/auto';
import { TicketsReportTimesDashboardFilters, TicketsReportTimesFilters, TicketsReportTimesGrafico, TicketsReportTimesKPI, TicketsReportTimesProjectTabla, TicketsReportTimesResolverTabla, TicketsReportTimesVolumenItem } from '../../../models/tickets-report-times';
import { TicketsReportTimesService } from '../../../services/tickets-report-times.service';

@Component({
  selector: 'app-tickets-report-times',
  standalone: false,
  templateUrl: './tickets-report-times.html',
  styleUrl: './tickets-report-times.css'
})
export class TicketsReportTimes
  implements OnInit, AfterViewInit, OnDestroy {

  private readonly grupoPorDefecto = 'BASE DE DATOS Y EBS';
  readonly opcionTodosProyectos = '__TODOS_PROYECTOS__';


  @ViewChild('volumenCanvas')
  volumenCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild('buscadorProyectos')
  buscadorProyectosInput?: ElementRef<HTMLInputElement>;

  filtrosForm!: FormGroup;

  filtrosActuales: TicketsReportTimesDashboardFilters = {
    grupo_resolutor: this.grupoPorDefecto,
    todos_proyectos: false,
    proyectos: []
  };

  opcionesFiltros: TicketsReportTimesFilters = {
    fecha_min: null,
    fecha_max: null,
    grupos_resolutores: [],
    proyectos: [],
    proyectos_predeterminados: []
  };



  limpiarSeleccionProyectos(evento: MouseEvent): void {
    evento.preventDefault();
    evento.stopPropagation();

    this.filtrosForm.patchValue({
      proyectos: [],
      todos_proyectos: false
    }, { emitEvent: false });
  }



  proyectosDisponibles: string[] = [];

  periodoSeleccionado: string | null = null;

  kpis: TicketsReportTimesKPI | null = null;
  volumenMensual: TicketsReportTimesVolumenItem[] = [];

  cargandoFiltros = false;
  cargandoKpis = false;
  cargandoVolumenMensual = false;

  filtrosListos = false;

  errorFiltros: string | null = null;
  errorKpis: string | null = null;
  errorVolumen: string | null = null;

  graficoExpandido: string | null = null;

  private chartVolumen: Chart | null = null;
  private solicitudDashboard = 0;

  private readonly destruir$ = new Subject<void>();
  private readonly cancelarDashboard$ = new Subject<void>();
  private readonly cancelarFiltros$ = new Subject<void>();



  // ANÁLISIS DE TIEMPOS POR RESOLUTOR
  datosTablaResolutores: TicketsReportTimesResolverTabla | null = null;
  datosGraficoResolutores: TicketsReportTimesGrafico | null = null;

  cargandoTablaResolutores = false;
  cargandoGraficoResolutores = false;

  errorTablaResolutores: string | null = null;
  errorGraficoResolutores: string | null = null;

  paginaTablaResolutores = 1;
  tamanoTablaResolutores = 100;
  limiteGraficoResolutores = 10;


  // ANÁLISIS DE TIEMPOS POR PROYECTO
  datosTablaProyectos: TicketsReportTimesProjectTabla | null = null;
  datosGraficoProyectos: TicketsReportTimesGrafico | null = null;

  cargandoTablaProyectos = false;
  cargandoGraficoProyectos = false;

  errorTablaProyectos: string | null = null;
  errorGraficoProyectos: string | null = null;

  paginaTablaProyectos = 1;
  tamanoTablaProyectos = 100;
  limiteGraficoProyectos = 10;

  private readonly cancelarTablaProyectos$ =
    new Subject<void>();


  private readonly cancelarTablaResolutores$ =
    new Subject<void>();


  constructor(
    private formBuilder: FormBuilder,
    private reportTimesService: TicketsReportTimesService,
    private changeDetector: ChangeDetectorRef
  ) { }

  get cargandoDashboard(): boolean {
    return this.cargandoKpis || this.cargandoVolumenMensual;
  }

  get rangoInvalido(): boolean {
    if (!this.filtrosForm) {
      return false;
    }

    const { desde, hasta } = this.filtrosForm.getRawValue();

    return desde instanceof Date &&
      hasta instanceof Date &&
      desde.getTime() > hasta.getTime();
  }

  ngOnInit(): void {
    this.crearFormulario();
    this.cargarOpcionesFiltros(true);
  }

  ngAfterViewInit(): void {
    this.inicializarGrafico();
  }

  ngOnDestroy(): void {
    this.cancelarDashboard$.next();
    this.cancelarDashboard$.complete();

    this.cancelarFiltros$.next();
    this.cancelarFiltros$.complete();

    this.destruir$.next();
    this.destruir$.complete();

    this.cancelarTablaResolutores$.next();
    this.cancelarTablaResolutores$.complete();

    this.cancelarTablaProyectos$.next();
    this.cancelarTablaProyectos$.complete();

    this.chartVolumen?.destroy();
    this.chartVolumen = null;

  }

  private crearFormulario(): void {
    this.filtrosForm = this.formBuilder.group({
      desde: [null as Date | null, Validators.required],
      hasta: [null as Date | null, Validators.required],
      grupo_resolutor: [this.grupoPorDefecto],
      proyectos: [[] as string[]],
      todos_proyectos: [false]
    });
  }

  cargarOpcionesFiltros(inicial: boolean = false): void {
    this.cancelarFiltros$.next();

    this.cargandoFiltros = true;
    this.errorFiltros = null;

    if (inicial) {
      this.filtrosListos = false;
    }

    const grupo = this.filtrosForm.get('grupo_resolutor')?.value as string | null;

    this.reportTimesService
      .obtenerFiltros(grupo)
      .pipe(
        takeUntil(this.cancelarFiltros$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          this.opcionesFiltros = datos;

          this.proyectosDisponibles = [
            ...new Set([
              ...datos.proyectos,
              ...datos.proyectos_predeterminados
            ])
          ].sort((a, b) => a.localeCompare(b, 'es'));

          if (inicial) {
            this.restablecerFechas();

            const proyectos = [
              ...datos.proyectos_predeterminados
            ];

            this.filtrosForm.patchValue({
              proyectos,
              todos_proyectos: false
            }, { emitEvent: false });

            this.actualizarFiltrosActuales();
          }

          this.cargandoFiltros = false;
          this.filtrosListos = true;

          this.changeDetector.markForCheck();

          if (inicial) {
            this.cargarDashboard();
          }
        },
        error: error => {
          console.error(
            'Error obteniendo filtros de tickets report times:',
            error
          );

          this.cargandoFiltros = false;
          this.errorFiltros =
            'No se pudieron cargar las opciones de filtros.';

          if (inicial) {
            this.filtrosListos = false;
          }

          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarGrupoResolutor(grupo: string | null): void {
    if (grupo === this.grupoPorDefecto) {
      this.filtrosForm.patchValue({
        todos_proyectos: false,
        proyectos: [
          ...this.opcionesFiltros.proyectos_predeterminados
        ]
      }, { emitEvent: false });
    } else {
      this.filtrosForm.patchValue({
        todos_proyectos: true,
        proyectos: [this.opcionTodosProyectos]
      }, { emitEvent: false });
    }

    this.cargarOpcionesFiltros();
  }



  aplicarFiltros(): void {
    if (!this.filtrosListos || this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    if (this.rangoInvalido) {
      this.errorFiltros =
        'La fecha Desde no puede ser posterior a Hasta.';
      return;
    }

    const valores = this.filtrosForm.getRawValue();

    const todosProyectos = Boolean(
      valores.todos_proyectos
    );

    const proyectosSeleccionados = (
      (valores.proyectos ?? []) as string[]
    ).filter(
      proyecto =>
        proyecto !== this.opcionTodosProyectos &&
        proyecto.trim().length > 0
    );

    // Evitar aplicar filtros sin seleccionar
    // proyectos y sin activar "Todos".
    if (
      !todosProyectos &&
      proyectosSeleccionados.length === 0
    ) {
      this.errorFiltros =
        'Selecciona al menos un proyecto o la opción Todos los proyectos.';
      return;
    }

    this.errorFiltros = null;
    this.periodoSeleccionado = null;

    this.actualizarFiltrosActuales();

    // Diagnóstico temporal: verificar qué se envía.
    console.log(
      '[Tickets Report Times] Filtros aplicados:',
      this.filtrosActuales
    );

    this.cargarDashboard();
  }



  limpiarFiltros(): void {
    this.periodoSeleccionado = null;

    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      grupo_resolutor: this.grupoPorDefecto,
      proyectos: [],
      todos_proyectos: false
    });

    this.errorFiltros = null;
    this.errorKpis = null;
    this.errorVolumen = null;

    this.kpis = null;
    this.volumenMensual = [];

    this.actualizarGrafico();
    this.cargarOpcionesFiltros(true);
  }

  cambiarPeriodo(periodo: string | null): void {
    if (
      periodo !== null &&
      !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo)
    ) {
      return;
    }

    if (this.periodoSeleccionado === periodo) {
      return;
    }

    if (
      periodo &&
      !this.volumenMensual.some(item => item.periodo === periodo)
    ) {
      return;
    }

    this.periodoSeleccionado = periodo;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      periodo: periodo ?? undefined
    };

    this.actualizarGrafico();
    this.cargarDashboard();
  }


  private actualizarFiltrosActuales(): void {
    const valores = this.filtrosForm.getRawValue();

    const todosProyectos = Boolean(
      valores.todos_proyectos
    );

    const proyectos = todosProyectos
      ? []
      : [
        ...new Set(
          ((valores.proyectos ?? []) as string[])
            .map(proyecto => proyecto.trim())
            .filter(
              proyecto =>
                proyecto.length > 0 &&
                proyecto !== this.opcionTodosProyectos
            )
        )
      ];

    this.filtrosActuales = {
      desde: this.formatearFecha(valores.desde),
      hasta: this.formatearFecha(valores.hasta),
      grupo_resolutor: valores.grupo_resolutor,
      proyectos,
      todos_proyectos: todosProyectos,
      periodo: this.periodoSeleccionado ?? undefined
    };
  }


  private restablecerFechas(): void {
    const desde = this.convertirFecha(
      this.opcionesFiltros.fecha_min
    );

    const hasta = this.convertirFecha(
      this.opcionesFiltros.fecha_max
    );

    this.filtrosForm.patchValue({
      desde,
      hasta
    }, { emitEvent: false });
  }

  private convertirFecha(valor: string | null): Date | null {
    if (!valor) {
      return null;
    }

    const [anio, mes, dia] = valor.split('-').map(Number);

    return new Date(anio, mes - 1, dia);
  }

  private formatearFecha(fecha: Date | null): string | undefined {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) {
      return undefined;
    }

    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }



  cargarDashboard(): void {
    this.cancelarDashboard$.next();

    const solicitudActual = ++this.solicitudDashboard;

    // Reiniciar paginación al cambiar los filtros.
    this.paginaTablaResolutores = 1;
    this.paginaTablaProyectos = 1;

    // KPI y volumen mensual.
    this.cargarKpis(solicitudActual);
    this.cargarVolumenMensual(solicitudActual);

    // Análisis por resolutor.
    this.cargarTablaResolutores(solicitudActual);
    this.cargarGraficoResolutores(solicitudActual);

    // Análisis por proyecto.
    this.cargarTablaProyectos(solicitudActual);
    this.cargarGraficoProyectos(solicitudActual);
  }



  private cargarKpis(solicitudActual: number): void {
    this.cargandoKpis = true;
    this.errorKpis = null;
    this.kpis = null;

    this.reportTimesService
      .obtenerKpis({ ...this.filtrosActuales })
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.kpis = datos;
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        },
        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error('Error obteniendo KPIs:', error);

          this.errorKpis =
            'No se pudieron actualizar los indicadores.';

          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  private cargarVolumenMensual(
    solicitudActual: number
  ): void {

    this.cargandoVolumenMensual = true;
    this.errorVolumen = null;

    const filtrosVolumen: TicketsReportTimesDashboardFilters = {
      ...this.filtrosActuales,
      periodo: undefined
    };

    this.reportTimesService
      .obtenerVolumenMensual(filtrosVolumen)
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.volumenMensual = datos;
          this.cargandoVolumenMensual = false;

          this.actualizarGrafico();
          this.changeDetector.markForCheck();
        },
        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error('Error obteniendo volumen mensual:', error);

          this.volumenMensual = [];
          this.errorVolumen =
            'No se pudo cargar el volumen mensual.';

          this.cargandoVolumenMensual = false;

          this.actualizarGrafico();
          this.changeDetector.markForCheck();
        }
      });
  }



  private inicializarGrafico(): void {
    if (!this.volumenCanvas) {
      return;
    }

    this.chartVolumen?.destroy();

    this.chartVolumen = new Chart(
      this.volumenCanvas.nativeElement,
      {
        type: 'bar',

        data: {
          labels: [],
          datasets: [
            {
              label: 'Tickets',
              data: [],
              yAxisID: 'yTickets',
              backgroundColor: '#FF620F',
              borderRadius: 6,
              maxBarThickness: 42,
              categoryPercentage: 0.75,
              barPercentage: 0.85
            },
            {
              label: 'Horas',
              data: [],
              yAxisID: 'yHoras',
              backgroundColor: '#16835B',
              borderRadius: 6,
              maxBarThickness: 42,
              categoryPercentage: 0.75,
              barPercentage: 0.85
            }
          ]
        },

        plugins: [ChartDataLabels],

        options: {
          responsive: true,
          maintainAspectRatio: false,

          interaction: {
            mode: 'index',
            intersect: false
          },

          layout: {
            padding: {
              top: 30,
              right: 12,
              left: 12
            }
          },

          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 18,
                color: '#667085'
              }
            },

            // ETIQUETAS SOBRE LAS BARRAS
            datalabels: {
              display: contexto => {
                const valor = Number(
                  contexto.dataset.data[contexto.dataIndex] ?? 0
                );

                return valor > 0;
              },

              anchor: 'end',
              align: 'end',
              offset: 4,
              clamp: true,
              clip: false,
              color: '#344054',

              font: {
                size: 11,
                weight: 'bold'
              },

              formatter: (valor: number, contexto) => {
                const numero = Number(valor) || 0;

                if (numero <= 0) {
                  return '';
                }

                if (contexto.datasetIndex === 1) {
                  return (
                    numero.toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }) + ' h'
                  );
                }

                return numero.toLocaleString('es-PE', {
                  maximumFractionDigits: 0
                });
              }
            },

            tooltip: {
              callbacks: {
                label: contexto => {
                  const valor = Number(contexto.parsed.y ?? 0);

                  if (contexto.datasetIndex === 1) {
                    return (
                      'Horas: ' +
                      valor.toLocaleString('es-PE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) + ' h'
                    );
                  }

                  return (
                    'Tickets distintos: ' +
                    valor.toLocaleString('es-PE', {
                      maximumFractionDigits: 0
                    })
                  );
                }
              }
            }
          },

          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#667085',
                maxRotation: 0,
                autoSkip: true
              }
            },

            yTickets: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              grace: '15%',

              title: {
                display: true,
                text: 'Tickets',
                color: '#080808'
              },

              ticks: {
                color: '#000000',
                precision: 0
              },

              grid: {
                color: '#E5E9EE'
              }
            },

            yHoras: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grace: '15%',

              title: {
                display: true,
                text: 'Horas',
                color: '#080808'
              },

              ticks: {
                color: '#000000',
                callback: valor =>
                  Number(valor).toLocaleString('es-PE', {
                    maximumFractionDigits: 1
                  }) + ' h'
              },

              grid: {
                drawOnChartArea: false
              }
            }
          },

          // CONSERVAR FILTRO AL SELECCIONAR MES
          onClick: (_evento, elementos) => {
            const indice = elementos[0]?.index;

            if (indice === undefined) {
              return;
            }

            const periodo = this.volumenMensual[indice]?.periodo;

            if (!periodo) {
              return;
            }

            this.cambiarPeriodo(
              this.periodoSeleccionado === periodo
                ? null
                : periodo
            );
          }
        }
      }
    );

    this.actualizarGrafico();
  }



  private actualizarGrafico(): void {
    if (!this.chartVolumen) {
      return;
    }

    const seleccionado = this.periodoSeleccionado;

    this.chartVolumen.data.labels =
      this.volumenMensual.map(item =>
        this.etiquetaPeriodo(item.periodo)
      );

    // BARRAS NARANJAS: TICKETS
    this.chartVolumen.data.datasets[0].data =
      this.volumenMensual.map(item =>
        Number(item.tickets) || 0
      );

    // BARRAS VERDES: HORAS TOTALES
    this.chartVolumen.data.datasets[1].data =
      this.volumenMensual.map(item =>
        Number(item.horas_totales) || 0
      );

    // COLORES SEGÚN EL MES SELECCIONADO
    this.chartVolumen.data.datasets[0].backgroundColor =
      this.volumenMensual.map(item =>
        !seleccionado || item.periodo === seleccionado
          ? '#FF620F'
          : '#FFD3BC'
      );

    this.chartVolumen.data.datasets[1].backgroundColor =
      this.volumenMensual.map(item =>
        !seleccionado || item.periodo === seleccionado
          ? '#16835B'
          : '#B8DDCE'
      );

    this.chartVolumen.update();
  }



  private etiquetaPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    return new Intl.DateTimeFormat('es-PE', {
      month: 'short',
      year: 'numeric'
    }).format(new Date(anio, mes - 1, 1));
  }

  async alternarPantallaCompleta(
    elemento: HTMLElement
  ): Promise<void> {
    try {
      if (document.fullscreenElement === elemento) {
        await document.exitFullscreen();
      } else {
        await elemento.requestFullscreen();
      }
    } catch (error) {
      console.error('Error cambiando pantalla completa:', error);
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id ?? null;

    this.changeDetector.markForCheck();

    // Chart.js adapta el tamaño al nuevo contenedor.
    this.chartVolumen?.resize();
  }

  nombreMes(periodo: string): string {
    const coincidencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo);

    if (!coincidencia) {
      return periodo;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);

    const nombre = new Intl.DateTimeFormat('es-PE', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(anio, mes - 1, 1));

    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }


  // =============================================
  // TABLA DE TIEMPOS POR RESOLUTOR
  // =============================================

  cargarTablaResolutores(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cancelarTablaResolutores$.next();

    this.cargandoTablaResolutores = true;
    this.errorTablaResolutores = null;

    this.reportTimesService
      .obtenerTiemposResolutores(
        { ...this.filtrosActuales },
        this.paginaTablaResolutores,
        this.tamanoTablaResolutores
      )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarTablaResolutores$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.datosTablaResolutores = datos;
          this.cargandoTablaResolutores = false;

          this.changeDetector.markForCheck();
        },

        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error consultando tiempos por resolutor:',
            error
          );

          this.datosTablaResolutores = null;
          this.errorTablaResolutores =
            'No se pudo cargar la tabla de tiempos por resolutor.';

          this.cargandoTablaResolutores = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // GRÁFICO DE HORAS POR RESOLUTOR

  cargarGraficoResolutores(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cargandoGraficoResolutores = true;
    this.errorGraficoResolutores = null;

    this.reportTimesService
      .obtenerTiemposResolutoresGrafico(
        { ...this.filtrosActuales },
        this.limiteGraficoResolutores
      )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.datosGraficoResolutores = datos;
          this.cargandoGraficoResolutores = false;

          this.changeDetector.markForCheck();
        },

        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error consultando gráfico de resolutores:',
            error
          );

          this.datosGraficoResolutores = null;
          this.errorGraficoResolutores =
            'No se pudo cargar el gráfico de horas por resolutor.';

          this.cargandoGraficoResolutores = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // PAGINACIÓN DE TABLA

  cambiarPaginaResolutores(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaTablaResolutores === evento.pagina &&
      this.tamanoTablaResolutores === evento.tamano
    ) {
      return;
    }

    this.paginaTablaResolutores = evento.pagina;
    this.tamanoTablaResolutores = evento.tamano;

    // Recargar solamente la tabla, no todo el dashboard.
    this.cargarTablaResolutores();
  }


  // =============================================
  // TABLA DE TIEMPOS POR PROYECTO
  // =============================================

  cargarTablaProyectos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cancelarTablaProyectos$.next();

    this.cargandoTablaProyectos = true;
    this.errorTablaProyectos = null;

    this.reportTimesService
      .obtenerTiemposProyectos(
        { ...this.filtrosActuales },
        this.paginaTablaProyectos,
        this.tamanoTablaProyectos
      )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarTablaProyectos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.datosTablaProyectos = datos;
          this.cargandoTablaProyectos = false;

          this.changeDetector.markForCheck();
        },

        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error consultando tiempos por proyecto:',
            error
          );

          this.datosTablaProyectos = null;
          this.errorTablaProyectos =
            'No se pudo cargar la tabla de tiempos por proyecto.';

          this.cargandoTablaProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // GRÁFICO DE HORAS POR PROYECTO
  cargarGraficoProyectos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cargandoGraficoProyectos = true;
    this.errorGraficoProyectos = null;

    this.reportTimesService
      .obtenerTiemposProyectosGrafico(
        { ...this.filtrosActuales },
        this.limiteGraficoProyectos
      )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.datosGraficoProyectos = datos;
          this.cargandoGraficoProyectos = false;

          this.changeDetector.markForCheck();
        },

        error: error => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error consultando gráfico de proyectos:',
            error
          );

          this.datosGraficoProyectos = null;
          this.errorGraficoProyectos =
            'No se pudo cargar el gráfico de horas por proyecto.';

          this.cargandoGraficoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // PAGINACIÓN DE LA TABLA DE PROYECTOS
  cambiarPaginaProyectos(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaTablaProyectos === evento.pagina &&
      this.tamanoTablaProyectos === evento.tamano
    ) {
      return;
    }

    this.paginaTablaProyectos = evento.pagina;
    this.tamanoTablaProyectos = evento.tamano;

    // Consultar únicamente la tabla de proyectos.
    this.cargarTablaProyectos();
  }


  cambiarSeleccionProyectos(valores: string[]): void {
    const seleccion = [...new Set(valores ?? [])];

    const estabaEnTodos =
      this.filtrosForm.get('todos_proyectos')?.value === true;

    const incluyeTodos = seleccion.includes(
      this.opcionTodosProyectos
    );

    const proyectosIndividuales = seleccion.filter(
      proyecto =>
        proyecto !== this.opcionTodosProyectos &&
        proyecto.trim().length > 0
    );

    // Activar "Todos los proyectos".
    if (incluyeTodos && !estabaEnTodos) {
      this.filtrosForm.patchValue({
        todos_proyectos: true,
        proyectos: [this.opcionTodosProyectos]
      }, { emitEvent: false });

      return;
    }

    // Pasar de "Todos" a proyectos individuales.
    if (
      estabaEnTodos &&
      incluyeTodos &&
      proyectosIndividuales.length > 0
    ) {
      this.filtrosForm.patchValue({
        todos_proyectos: false,
        proyectos: proyectosIndividuales
      }, { emitEvent: false });

      return;
    }

    // Conservar "Todos" cuando siga siendo
    // la única opción seleccionada.
    if (
      estabaEnTodos &&
      incluyeTodos &&
      proyectosIndividuales.length === 0
    ) {
      return;
    }

    // Selección múltiple normal.
    this.filtrosForm.patchValue({
      todos_proyectos: false,
      proyectos: proyectosIndividuales
    }, { emitEvent: false });
  }


  // =============================================
  // BUSCADOR DE PROYECTOS
  // =============================================

  busquedaProyecto = '';

  buscarProyecto(evento: Event): void {
    this.busquedaProyecto =
      (evento.target as HTMLInputElement).value;
  }

  coincideBusquedaProyecto(proyecto: string): boolean {
    const normalizar = (texto: string): string =>
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .trim();

    const busqueda = normalizar(this.busquedaProyecto);

    return !busqueda || normalizar(proyecto).includes(busqueda);
  }

  get hayProyectosCoincidentes(): boolean {
    return this.proyectosDisponibles.some(
      proyecto => this.coincideBusquedaProyecto(proyecto)
    );
  }

  limpiarBusquedaProyecto(evento: MouseEvent): void {
    evento.stopPropagation();
    this.busquedaProyecto = '';
  }

  alAbrirComboProyecto(abierto: boolean): void {
    if (abierto) {
      this.busquedaProyecto = '';
    }
  }

  detenerTeclasBusqueda(evento: KeyboardEvent): void {
    if (evento.key !== 'Escape') {
      evento.stopPropagation();
    }
  }


  get horasTotalesKpi(): string {
    const registros = this.periodoSeleccionado
      ? this.volumenMensual.filter(
        item => item.periodo === this.periodoSeleccionado
      )
      : this.volumenMensual;

    const totalHoras = registros.reduce(
      (total, item) => total + (Number(item.horas_totales) || 0),
      0
    );

    return totalHoras.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' h';
  }


}
