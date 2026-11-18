
import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RequirementConsolidatedFilters, RequirementConsolidatedDashboardFilters, RequirementConsolidatedKPI, RequirementConsolidatedProyectoItem, RequirementConsolidatedVolumenItem, RequirementConsolidatedPrioridadItem, RequirementConsolidatedTipoItem, RequirementConsolidatedTopProyectos, RequirementConsolidatedPrioridadMensualItem, RequirementConsolidatedTicketsOut, RequirementProductividadGranularidad, RequirementProductividadOut, RequirementDotacionOut, RequirementAtencionParalelaOut, RequirementActualizacionesManualesOut } from '../../../models/requirement-consolidated';
import { RequirementConsolidatedService } from '../../../services/requirement-consolidated.service';

@Component({
  selector: 'app-requirement-consolidated',
  standalone: false,
  templateUrl: './requirement-consolidated.html',
  styleUrl: './requirement-consolidated.css'
})
export class RequirementConsolidated implements OnInit, OnDestroy {

  // feat/mejoras-analisis-incidentes-gpt
  private readonly grupoResolutorPorDefecto = 'BASE DE DATOS Y EBS';
  filtrosForm!: FormGroup;
  filtrosActuales: RequirementConsolidatedDashboardFilters = {
    grupo_resolutor: this.grupoResolutorPorDefecto
  };

  // Filtros dinámicos
  periodoSeleccionado: string | null = null;
  tiposRequerimientoSeleccionados: string[] = [];

  opcionesFiltros: RequirementConsolidatedFilters = {
    fecha_min: null,
    fecha_max: null,
    prioridades: [],
    motivos_estado: [],
    motivos_resolucion: [],
    grupos_resolutores: [],
  };


  // TABLA PAGINADA - EXPLORADOR DE TICKETS
  ticketsDetalle: RequirementConsolidatedTicketsOut | null = null;
  cargandoTickets = false;
  errorTickets: string | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;
  ticketIdSeleccionado: string | null = null;
  private readonly cancelarTickets$ = new Subject<void>();


  cargandoFiltros = false;
  kpis: RequirementConsolidatedKPI | null = null;
  filtrosListos = false;
  cargandoKpis = false;
  errorKpis: string | null = null;
  private solicitudKpis = 0;
  proyectos: RequirementConsolidatedProyectoItem[] = [];
  cargandoProyectos = false;
  errorDashboard: string | null = null;
  volumenMensual: RequirementConsolidatedVolumenItem[] = [];
  cargandoVolumenMensual = false;
  tipos: RequirementConsolidatedTipoItem[] = [];
  tiposGrafico: { categoria: string; cantidad: number; }[] = [];
  cargandoTipos = false;
  prioridades: RequirementConsolidatedPrioridadItem[] = [];
  prioridadesGrafico: { categoria: string; cantidad: number; }[] = [];
  cargandoPrioridades = false;
  cargandoTopProyectos = false;
  prioridadMensual: RequirementConsolidatedPrioridadMensualItem[] = [];
  cargandoPrioridadMensual = false;
  private solicitudDashboard = 0;

  // PRODUCTIVIDAD - ALCANCE 1
  productividad: RequirementProductividadOut | null = null;
  cargandoProductividad = false;
  errorProductividad: string | null = null;
  granularidadProductividad: RequirementProductividadGranularidad = 'mes';
  paginaProductividad = 1;
  tamanoProductividad = 10;
  limiteGraficoProductividad = 10;
  private readonly cancelarProductividad$ = new Subject<void>();

  // DOTACIÓN MENSUAL - ALCANCE 2
  dotacion: RequirementDotacionOut | null = null;
  cargandoDotacion = false;
  errorDotacion: string | null = null;
  paginaDotacion = 1;
  tamanoDotacion = 10;
  limiteGraficoDotacion = 10;
  private readonly cancelarDotacion$ = new Subject<void>();

  // ATENCIÓN PARALELA - ALCANCE 3
  atencionParalela: RequirementAtencionParalelaOut | null = null;
  cargandoAtencionParalela = false;
  errorAtencionParalela: string | null = null;
  paginaAtencionParalela = 1;
  tamanoAtencionParalela = 10;
  limiteGraficoAtencionParalela = 10;
  resolutorAtencionParalela: string | null = null;
  private readonly cancelarAtencionParalela$ = new Subject<void>();

  // ALCANCE 4 - ACTUALIZACIONES MANUALES
  actualizacionesManuales: RequirementActualizacionesManualesOut | null = null;
  cargandoActualizacionesManuales = false;
  errorActualizacionesManuales: string | null = null;
  paginaActualizacionesManuales = 1;
  tamanoActualizacionesManuales = 25;
  limiteGraficoActualizacionesManuales = 10;
  resolutorActualizacionesManuales: string | null = null;
  private readonly cancelarActualizacionesManuales$ = new Subject<void>();


  //FIltro Proyectos
  opcionesProyectos: string[] = [];
  proyectoSeleccionado: string | null = null;
  proyectosExcluidos: string[] = [];
  private solicitudOpcionesProyectos = 0;
  private temporizadorExclusiones: ReturnType<typeof setTimeout> | null = null;


  private readonly cancelarDashboard$ = new Subject<void>();

  get cargandoDashboard(): boolean {
    return (
      this.cargandoKpis ||
      this.cargandoProyectos ||
      this.cargandoVolumenMensual ||
      this.cargandoTipos ||
      this.cargandoPrioridades ||
      this.cargandoTopProyectos ||
      this.cargandoPrioridadMensual ||
      this.cargandoTickets ||
      this.cargandoProductividad ||
      this.cargandoDotacion ||
      this.cargandoAtencionParalela ||
      this.cargandoActualizacionesManuales
    );
  }

  topProyectos: RequirementConsolidatedTopProyectos = {
    periodos: [],
    proyectos: []
  };

  constructor(
    private formBuilder: FormBuilder,
    private requirementConsolidatedService: RequirementConsolidatedService,
    private changeDetector: ChangeDetectorRef
  ) { }

  // PANTALLA COMPLETA DE GRÁFICOS
  graficoExpandido: string | null = null;
  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    try {
      if (document.fullscreenElement === elemento) {
        await document.exitFullscreen();
      } else {
        await elemento.requestFullscreen();
      }
    } catch (error) {
      console.error(
        'Error al cambiar pantalla completa:',
        error
      );
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.graficoExpandido = (document.fullscreenElement as HTMLElement | null)?.id ?? null;
    this.changeDetector.markForCheck();
  }



  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }


  ngOnDestroy(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }
    this.cancelarDashboard$.next();
    this.cancelarDashboard$.complete();
    this.cancelarTickets$.next();
    this.cancelarTickets$.complete();
    this.cancelarProductividad$.next();
    this.cancelarProductividad$.complete();
    this.cancelarDotacion$.next();
    this.cancelarDotacion$.complete();
    this.cancelarAtencionParalela$.next();
    this.cancelarAtencionParalela$.complete();
    this.cancelarActualizacionesManuales$.next();
    this.cancelarActualizacionesManuales$.complete();
  }



  crearFormularioFiltros(): void {
    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],
      prioridad: [null],
      motivo_estado: [null],
      motivo_resolucion: [null],

      // feat/mejoras-analisis-incidentes-gpt
      grupo_resolutor: [this.grupoResolutorPorDefecto]
    });
  }

  cargarOpcionesFiltros(): void {
    this.cargandoFiltros = true;
    this.filtrosListos = false;
    this.requirementConsolidatedService
      .obtenerFiltros()
      .subscribe({
        next: (data) => {
          this.opcionesFiltros = data;
          this.cargandoFiltros = false;
          this.filtrosListos = true;

          // 2. ESTABLECER FECHAS POR DEFECTO
          this.establecerFechasPorDefecto();
          // 3. ACTUALIZAR OPCIONES DE PROYECTOS
          this.cargarOpcionesProyectos();

          this.changeDetector.markForCheck();
          this.cargarDashboard();
        },

        error: (error) => {
          this.cargandoFiltros = false;
          this.filtrosListos = false;
          this.changeDetector.markForCheck();
          this.cargarDashboard();
        }
      });
  }



  aplicarFiltros(): void {

    if (!this.filtrosListos || this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const valores = this.filtrosForm.getRawValue();

    this.filtrosActuales = {
      desde: this.formatearFecha(valores.desde),
      hasta: this.formatearFecha(valores.hasta),
      prioridad: valores.prioridad || undefined,
      motivo_estado: valores.motivo_estado || undefined,
      motivo_resolucion: valores.motivo_resolucion || undefined,
      grupo_resolutor: valores.grupo_resolutor || undefined,

      // Conservar proyectos excluidos
      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    // Restablecer filtros dinámicos
    this.proyectoSeleccionado = null;
    this.periodoSeleccionado = null;
    this.tiposRequerimientoSeleccionados = [];

    // LIMPIAR FILTRO POR TICKET ID
    this.ticketIdSeleccionado = null;
    // Restablecer el filtro local de atención paralela
    this.resolutorAtencionParalela = null;
    this.resolutorActualizacionesManuales = null;

    // Actualizar proyectos y dashboard
    this.cargarOpcionesProyectos();
    this.cargarDashboard();

    this.changeDetector.markForCheck();
  }




  limpiarFiltros(): void {

    // feat/mejoras-analisis-incidentes-gpt
    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      prioridad: null,
      motivo_estado: null,
      motivo_resolucion: null,
      grupo_resolutor: this.grupoResolutorPorDefecto
    });
    this.filtrosActuales = {
      grupo_resolutor: this.grupoResolutorPorDefecto
    };

    this.proyectosExcluidos = [];
    this.establecerFechasPorDefecto();
    this.proyectoSeleccionado = null;
    this.periodoSeleccionado = null;
    this.tiposRequerimientoSeleccionados = [];
    this.ticketIdSeleccionado = null;
    this.resolutorAtencionParalela = null;
    this.resolutorActualizacionesManuales = null;
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
    this.changeDetector.markForCheck();

  }




  private formatearFecha(fecha: Date | null): string | undefined {
    if (!fecha) {
      return undefined;
    }
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }




  cargarDashboard(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    // CANCELAR SOLICITUDES ANTERIORES
    this.cancelarDashboard$.next();

    const solicitudActual = ++this.solicitudDashboard;

    this.errorDashboard = null;
    this.errorKpis = null;

    // REINICIAR PAGINACIÓN DEL DASHBOARD
    this.paginaTickets = 1;
    this.paginaProductividad = 1;
    this.paginaDotacion = 1;
    this.paginaAtencionParalela = 1;
    this.paginaActualizacionesManuales = 1;

    // KPIs Y GRÁFICOS EXISTENTES
    this.cargarKpis(solicitudActual);
    this.cargarProyectos(solicitudActual);
    this.cargarVolumenMensual(solicitudActual);
    this.cargarTipos(solicitudActual);
    this.cargarPrioridades(solicitudActual);
    this.cargarTopProyectos(solicitudActual);
    this.cargarPrioridadMensual(solicitudActual);

    // NUEVA TABLA PAGINADA
    this.cargarTickets(solicitudActual);

    // TRES INDICADORES DE PRODUCTIVIDAD (gráfico + tabla)
    this.cargarProductividad(solicitudActual);
    this.cargarDotacion(solicitudActual);
    this.cargarAtencionParalela(solicitudActual);
    this.cargarActualizacionesManuales(solicitudActual);

    this.changeDetector.markForCheck();
  }




  cargarKpis(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoKpis = true;
    this.requirementConsolidatedService
      .obtenerKpis({ ...this.filtrosActuales })
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.kpis = data;
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          console.error('Error obteniendo KPIs de Requerimientos:', error);
          console.error('Error obteniendo KPIs de Requerimientos:', error);
          this.errorKpis = 'No se pudieron actualizar los KPIs.';
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarProyectos(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoProyectos = true;
    this.requirementConsolidatedService
      .obtenerProyectos({ ...this.filtrosActuales })
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.proyectos = data;
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          console.error('Error obteniendo proyectos de Requerimientos:', error);
          this.errorDashboard = 'No se pudo actualizar el Explorador de Proyectos.';
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }



  cargarVolumenMensual(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cargandoVolumenMensual = true;

    // Evitar autofiltro mensual
    const filtrosBase: RequirementConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      periodo: undefined
    };

    this.requirementConsolidatedService
      .obtenerVolumenMensual(filtrosBase)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.volumenMensual = data;
          this.cargandoVolumenMensual = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error obteniendo Volumen Mensual de Requerimientos:',
            error
          );

          this.errorDashboard =
            'No se pudo actualizar el Volumen Mensual de Requerimientos.';

          this.cargandoVolumenMensual = false;

          this.changeDetector.markForCheck();
        }
      });
  }


  cargarTipos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cargandoTipos = true;

    // Evitar autofiltro por tipo
    const filtrosBase: RequirementConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      tipo_requerimiento: undefined
    };

    this.requirementConsolidatedService
      .obtenerTipos(filtrosBase)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.tipos = data;

          this.tiposGrafico = data.map(item => ({
            categoria: item.tipo_requerimiento,
            cantidad: item.cantidad
          }));

          this.cargandoTipos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error obteniendo tipos de requerimientos:',
            error
          );

          this.errorDashboard =
            'No se pudo actualizar la Distribución por Tipo de Requerimiento.';

          this.cargandoTipos = false;

          this.changeDetector.markForCheck();
        }
      });
  }

  cargarPrioridades(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoPrioridades = true;
    this.requirementConsolidatedService
      .obtenerPrioridades({ ...this.filtrosActuales })
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.prioridades = data;
          this.prioridadesGrafico = data.map(item => ({
            categoria: item.prioridad,
            cantidad: item.cantidad
          }));
          this.cargandoPrioridades = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          console.error(
            'Error obteniendo prioridades de requerimientos:',
            error
          );

          this.errorDashboard = 'No se pudo actualizar la Distribución por Prioridad.';
          this.cargandoPrioridades = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarTopProyectos(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoTopProyectos = true;
    this.requirementConsolidatedService
      .obtenerTopProyectos({ ...this.filtrosActuales })
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) { return; }
          this.topProyectos = data;
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) { return; }
          console.error('Error obteniendo Top 10 Proyectos de Requerimientos:', error);
          this.errorDashboard = 'No se pudo actualizar el Top 10 Proyectos.';
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarPrioridadMensual(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoPrioridadMensual = true;
    this.requirementConsolidatedService
      .obtenerPrioridadMensual({ ...this.filtrosActuales })
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.prioridadMensual = data;
          this.cargandoPrioridadMensual = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          console.error('Error obteniendo Prioridad Mensual de Requerimientos:', error);
          this.errorDashboard = 'No se pudo actualizar la Prioridad Mensual.';
          this.cargandoPrioridadMensual = false;
          this.changeDetector.markForCheck();
        }
      });
  }


  //Filtro Proyectos
  cargarOpcionesProyectos(): void {

    const solicitudActual = ++this.solicitudOpcionesProyectos;


    const filtrosBase: RequirementConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      proyectos_excluidos: undefined,
      ticket_id: undefined
    };


    this.requirementConsolidatedService
      .obtenerProyectos(filtrosBase)
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudOpcionesProyectos) {
            return;
          }

          this.opcionesProyectos = [
            ...new Set(
              data.map(item => item.proyecto)
            )
          ];

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudOpcionesProyectos) {
            return;
          }

          console.error('Error obteniendo opciones de proyectos:', error);

          this.opcionesProyectos = [];

          this.changeDetector.markForCheck();
        }
      });
  }



  cambiarProyecto(proyecto: string | null): void {

    if (this.proyectoSeleccionado === proyecto) {
      return;
    }

    // Si seleccionamos un proyecto excluido,
    // volver a incluirlo en el análisis.
    if (proyecto) {

      const claveProyecto = proyecto.trim().toLocaleLowerCase();

      this.proyectosExcluidos = this.proyectosExcluidos.filter(
        excluido =>
          excluido.trim().toLocaleLowerCase() !== claveProyecto
      );
    }

    this.proyectoSeleccionado = proyecto;

    this.filtrosActuales = {
      ...this.filtrosActuales,

      proyecto: proyecto ?? undefined,

      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.cargarDashboard();
  }



  // Filtro dinámico por múltiples tipos
  cambiarTiposRequerimiento(tipos: string[]): void {

    // Permitir tipos visibles y previamente seleccionados
    const tiposPermitidos = new Set([
      ...this.tiposGrafico.map(item => item.categoria),
      ...this.tiposRequerimientoSeleccionados
    ]);

    // Normalizar y eliminar duplicados
    const seleccion = [
      ...new Set(
        tipos
          .map(tipo => tipo.trim())
          .filter(tipo =>
            tipo.length > 0 &&
            tiposPermitidos.has(tipo)
          )
      )
    ];

    // Evitar consultas innecesarias
    const anteriores = new Set(
      this.tiposRequerimientoSeleccionados
    );

    const mismaSeleccion =
      anteriores.size === seleccion.length &&
      seleccion.every(tipo => anteriores.has(tipo));

    if (mismaSeleccion) {
      return;
    }

    // Actualizar selección
    this.tiposRequerimientoSeleccionados = seleccion;

    // Conservar mes, proyecto y demás filtros
    this.filtrosActuales = {
      ...this.filtrosActuales,
      tipo_requerimiento: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };

    // Actualizar opciones de proyectos
    this.cargarOpcionesProyectos();

    // Actualizar gráficos y KPIs
    this.cargarDashboard();

    this.changeDetector.markForCheck();
  }


  // Quitar un solo tipo seleccionado
  quitarTipoRequerimiento(tipo: string): void {

    this.cambiarTiposRequerimiento(
      this.tiposRequerimientoSeleccionados.filter(
        seleccionado => seleccionado !== tipo
      )
    );
  }


  // Filtro dinámico por mes
  cambiarPeriodo(periodo: string | null): void {

    // Validar formato YYYY-MM
    if (
      periodo !== null &&
      !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo)
    ) {
      console.error(
        'Formato de período inválido:',
        periodo
      );

      return;
    }

    // Evitar consultas innecesarias
    if (this.periodoSeleccionado === periodo) {
      return;
    }

    // Actualizar selección
    this.periodoSeleccionado = periodo;

    // Conservar tipos, proyecto y filtros generales
    this.filtrosActuales = {
      ...this.filtrosActuales,
      periodo: periodo ?? undefined
    };

    // Actualizar opciones de proyectos
    this.cargarOpcionesProyectos();

    // Actualizar todos los gráficos y KPIs
    this.cargarDashboard();

    this.changeDetector.markForCheck();
  }


  //Fechas por defecto
  private convertirFecha(fecha: string | null): Date | null {
    if (!fecha) {
      return null;
    }
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }


  // ESTABLECER FECHAS MINIMA Y MAXIMA POR DEFECTO
  private establecerFechasPorDefecto(): void {
    const desde = this.convertirFecha(
      this.opcionesFiltros.fecha_min
    );
    const hasta = this.convertirFecha(
      this.opcionesFiltros.fecha_max
    );
    this.filtrosForm.patchValue(
      {
        desde,
        hasta
      },
      { emitEvent: false }
    );
    this.filtrosActuales = {
      ...this.filtrosActuales,
      desde: desde
        ? this.formatearFecha(desde)
        : undefined,
      hasta: hasta
        ? this.formatearFecha(hasta)
        : undefined
    };
  }




  // ====================================================
  // FILTRO GLOBAL - EXCLUSION MULTIPLE DE PROYECTOS
  // ====================================================

  cambiarProyectosExcluidos(proyectos: string[]): void {

    // Normalizar y eliminar duplicados
    const vistos = new Set<string>();
    const seleccion: string[] = [];

    for (const proyecto of proyectos) {

      const nombre = proyecto.trim();
      const clave = nombre.toLocaleLowerCase();

      if (!nombre || vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);
      seleccion.push(nombre);
    }

    // Evitar consultas innecesarias
    const anteriores = new Set(
      this.proyectosExcluidos.map(
        proyecto => proyecto.trim().toLocaleLowerCase()
      )
    );

    const mismaSeleccion =
      anteriores.size === seleccion.length &&
      seleccion.every(
        proyecto =>
          anteriores.has(proyecto.toLocaleLowerCase())
      );

    if (mismaSeleccion) {
      return;
    }

    this.proyectosExcluidos = seleccion;

    // Evitar conflicto con el proyecto individual
    if (this.proyectoSeleccionado) {

      const proyectoActual = this.proyectoSeleccionado
        .trim()
        .toLocaleLowerCase();

      const proyectoExcluido = seleccion.some(
        proyecto =>
          proyecto.toLocaleLowerCase() === proyectoActual
      );

      if (proyectoExcluido) {
        this.proyectoSeleccionado = null;
      }
    }

    // Actualizar filtros globales
    this.filtrosActuales = {
      ...this.filtrosActuales,

      proyecto: this.proyectoSeleccionado ?? undefined,

      proyectos_excluidos: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };

    // Cancelar solicitudes con filtros anteriores
    this.cancelarDashboard$.next();

    // Evitar recargas repetidas por cambios rápidos
    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
    }

    this.temporizadorExclusiones = setTimeout(() => {

      this.temporizadorExclusiones = null;

      this.cargarDashboard();

    }, 300);

    this.changeDetector.markForCheck();
  }




  // CARGAR TABLA PAGINADA - REQUERIMIENTOS CONSOLIDADOS
  cargarTickets(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    // CANCELAR PAGINACIÓN ANTERIOR
    this.cancelarTickets$.next();

    this.cargandoTickets = true;
    this.errorTickets = null;

    this.requirementConsolidatedService
      .obtenerTickets(
        { ...this.filtrosActuales },
        this.paginaTickets,
        this.tamanoTickets
      )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarTickets$)
      )
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          this.ticketsDetalle = data;
          this.cargandoTickets = false;
          this.errorTickets = null;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }

          console.error(
            'Error obteniendo tabla de Requerimientos Consolidados:',
            error
          );

          this.ticketsDetalle = null;
          this.cargandoTickets = false;

          this.errorTickets =
            'No se pudieron cargar los tickets de Requerimientos Consolidados.';

          this.changeDetector.markForCheck();
        }

      });
  }



  // PAGINACIÓN - EXPLORADOR DE TICKETS
  cambiarPaginaTickets(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaTickets === evento.pagina &&
      this.tamanoTickets === evento.tamano
    ) {
      return;
    }

    this.paginaTickets = evento.pagina;
    this.tamanoTickets = evento.tamano;

    // SOLO RECARGAR LA TABLA
    this.cargarTickets();
  }


  // FILTRO DINÁMICO POR TICKET ID
  cambiarTicketId(ticketId: string | null): void {
    const nuevoTicketId = ticketId?.trim() || null;
    if (this.ticketIdSeleccionado === nuevoTicketId) {
      return;
    }
    this.ticketIdSeleccionado = nuevoTicketId;
    this.filtrosActuales = {
      ...this.filtrosActuales,
      ticket_id: nuevoTicketId ?? undefined
    };
    this.cargarDashboard();
  }



  // ALCANCE 1 - EVOLUCIÓN Y PRODUCTIVIDAD POR PROYECTO
  cargarProductividad(solicitudActual: number = this.solicitudDashboard): void {
    this.cancelarProductividad$.next();
    this.cargandoProductividad = true;
    this.errorProductividad = null;

    this.requirementConsolidatedService.obtenerProductividadProyectos(
      { ...this.filtrosActuales },
      this.granularidadProductividad,
      this.paginaProductividad,
      this.tamanoProductividad,
      this.limiteGraficoProductividad
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarProductividad$)
      )
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          this.productividad = data;
          this.cargandoProductividad = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          console.error('Error obteniendo productividad de requerimientos:', error);
          this.productividad = null;
          this.errorProductividad = 'No se pudo actualizar la productividad por proyecto.';
          this.cargandoProductividad = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarGranularidadProductividad(granularidad: RequirementProductividadGranularidad): void {
    if (this.granularidadProductividad === granularidad) return;
    this.granularidadProductividad = granularidad;
    // Solo este indicador; la tabla mantiene su paginación.
    this.cargarProductividad();
  }

  cambiarPaginaProductividad(evento: { pagina: number; tamano: number }): void {
    if (this.paginaProductividad === evento.pagina &&
      this.tamanoProductividad === evento.tamano) return;
    this.paginaProductividad = evento.pagina;
    this.tamanoProductividad = evento.tamano;
    this.cargarProductividad();
  }


  // ALCANCE 2 - RESOLUTORES POR PROYECTO Y MES
  cargarDotacion(solicitudActual: number = this.solicitudDashboard): void {
    this.cancelarDotacion$.next();
    this.cargandoDotacion = true;
    this.errorDotacion = null;

    this.requirementConsolidatedService.obtenerDotacionResolutores(
      { ...this.filtrosActuales },
      this.paginaDotacion,
      this.tamanoDotacion,
      this.limiteGraficoDotacion
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarDotacion$)
      )
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          this.dotacion = data;
          this.cargandoDotacion = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          console.error('Error obteniendo dotación mensual:', error);
          this.dotacion = null;
          this.errorDotacion = 'No se pudo actualizar la dotación mensual de resolutores.';
          this.cargandoDotacion = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaDotacion(evento: { pagina: number; tamano: number }): void {
    if (this.paginaDotacion === evento.pagina &&
      this.tamanoDotacion === evento.tamano) return;
    this.paginaDotacion = evento.pagina;
    this.tamanoDotacion = evento.tamano;
    this.cargarDotacion();
  }

  // ALCANCE 3 - ATENCIÓN PARALELA DE REQUERIMIENTOS
  cargarAtencionParalela(solicitudActual: number = this.solicitudDashboard): void {
    this.cancelarAtencionParalela$.next();
    this.cargandoAtencionParalela = true;
    this.errorAtencionParalela = null;

    this.requirementConsolidatedService.obtenerAtencionParalela(
      { ...this.filtrosActuales },
      this.paginaAtencionParalela,
      this.tamanoAtencionParalela,
      this.limiteGraficoAtencionParalela,
      this.resolutorAtencionParalela || undefined
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarAtencionParalela$)
      )
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          this.atencionParalela = data;
          this.cargandoAtencionParalela = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) return;
          console.error('Error obteniendo atención paralela:', error);
          this.atencionParalela = null;
          this.errorAtencionParalela = 'No se pudo actualizar la atención paralela.';
          this.cargandoAtencionParalela = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaAtencionParalela(evento: { pagina: number; tamano: number }): void {
    if (this.paginaAtencionParalela === evento.pagina &&
      this.tamanoAtencionParalela === evento.tamano) return;
    this.paginaAtencionParalela = evento.pagina;
    this.tamanoAtencionParalela = evento.tamano;
    this.cargarAtencionParalela();
  }

  cambiarResolutorAtencionParalela(resolutor: string | null): void {
    const nuevo = resolutor?.trim() || null;
    if (this.resolutorAtencionParalela === nuevo) return;
    this.resolutorAtencionParalela = nuevo;
    this.paginaAtencionParalela = 1;
    this.cargarAtencionParalela();
  }

  // ALCANCE 4 - TICKETS CON REGISTROS DE ACTUALIZACIÓN MANUAL
  cargarActualizacionesManuales(
    solicitudActual: number = this.solicitudDashboard
  ): void {
    this.cancelarActualizacionesManuales$.next();
    this.cargandoActualizacionesManuales = true;
    this.errorActualizacionesManuales = null;

    this.requirementConsolidatedService.obtenerActualizacionesManuales(
      { ...this.filtrosActuales },
      this.paginaActualizacionesManuales,
      this.tamanoActualizacionesManuales,
      this.limiteGraficoActualizacionesManuales,
      this.resolutorActualizacionesManuales ?? undefined
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarActualizacionesManuales$)
      )
      .subscribe({
        next: data => {
          if (solicitudActual !== this.solicitudDashboard) return;
          this.actualizacionesManuales = data;
          this.cargandoActualizacionesManuales = false;
          this.changeDetector.markForCheck();
        },
        error: error => {
          if (solicitudActual !== this.solicitudDashboard) return;
          console.error('Error obteniendo actualizaciones manuales:', error);
          this.actualizacionesManuales = null;
          this.errorActualizacionesManuales =
            'No se pudieron consultar los requerimientos con registros de actualización manual.';
          this.cargandoActualizacionesManuales = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaActualizacionesManuales(evento: { pagina: number; tamano: number }): void {
    if (
      this.paginaActualizacionesManuales === evento.pagina &&
      this.tamanoActualizacionesManuales === evento.tamano
    ) return;

    this.paginaActualizacionesManuales = evento.pagina;
    this.tamanoActualizacionesManuales = evento.tamano;
    this.cargarActualizacionesManuales();
  }

  cambiarResolutorActualizacionesManuales(resolutor: string | null): void {
    const nuevo = resolutor?.trim() || null;
    if (this.resolutorActualizacionesManuales === nuevo) return;

    this.resolutorActualizacionesManuales = nuevo;
    this.paginaActualizacionesManuales = 1;
    this.cargarActualizacionesManuales();
  }
}
