
import { ResolutorRendimientoOut, ResolutorTicketsPorResolutorOut } from '../../../models/resolutor-dashboard';
import {
  ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit
} from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup,
  ValidationErrors, ValidatorFn, Validators
} from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';

import {
  ChangeConsolidatedDashboardFilters,
  ChangeConsolidatedFilters,
  ChangeConsolidatedKPI,
  ChangeConsolidatedVolumenItem,
  ChangeConsolidatedProyectoItem,
  ChangeConsolidatedTipoItem,
  ChangeConsolidatedCategoriaItem,
  ChangeConsolidatedPrioridadItem,
  ChangeConsolidatedTopProyectos,
  ChangeConsolidatedPrioridadMensualItem,
  ChangeConsolidatedTicketsOut,
  ChangeConsolidatedActividadesBDOut,
  ChangeConsolidatedHorasCambioOut,
  ChangeConsolidatedHorasResolutorItem,
  ChangeConsolidatedHorasMensualesItem
} from '../../../models/change-consolidated';

import { ChangeConsolidatedService } from '../../../services/change-consolidated.service';

type RecursoDashboard =
  | 'kpis'
  | 'proyectos'
  | 'volumen'
  | 'tipos'
  | 'categorias'
  | 'prioridades'
  | 'topProyectos'
  | 'prioridadMensual'
  | 'horasResolutor'
  | 'horasMensuales';

@Component({
  selector: 'app-change-consolidated',
  standalone: false,
  templateUrl: './change-consolidated.html',
  styleUrl: './change-consolidated.css'
})
export class ChangeConsolidated implements OnInit, OnDestroy {

  private readonly grupoResolutorPorDefecto = 'BASE DE DATOS Y EBS';
  private readonly destruir$ = new Subject<void>();
  private readonly cancelarFiltros$ = new Subject<void>();
  private readonly cancelarDashboard$ = new Subject<void>();
  private readonly cancelarTickets$ = new Subject<void>();
  private readonly cancelarActividadesBD$ = new Subject<void>();
  private readonly cancelarHorasCambio$ = new Subject<void>();

  private solicitudActividadesBD = 0;
  private solicitudHorasCambio = 0;

  private solicitudDashboard = 0;
  private solicitudTickets = 0;


  // PRD 06: rendimiento y tickets mensuales por resolutor.
  rendimientoResolutores: ResolutorRendimientoOut | null = null;
  ticketsPorResolutor: ResolutorTicketsPorResolutorOut | null = null;
  cargandoRendimientoResolutores = false;
  cargandoTicketsPorResolutor = false;
  errorRendimientoResolutores: string | null = null;
  errorTicketsPorResolutor: string | null = null;
  paginaResolutores = 1;
  tamanoResolutores = 5;
  limiteTicketsPorResolutor = 5;
  resolutorSeleccionado: string | null = null;
  private readonly cancelarRendimientoResolutores$ = new Subject<void>();
  private readonly cancelarTicketsPorResolutor$ = new Subject<void>();

  filtrosForm!: FormGroup;
  filtrosActuales: ChangeConsolidatedDashboardFilters = {};

  opcionesFiltros: ChangeConsolidatedFilters = {
    fecha_min: null,
    fecha_max: null,
    prioridades: [],
    motivos: [],
    grupos_resolutores: [],
    estados: [],
    proyectos: [],
    tipos_cambio: [],
    nombres_resolutores: [],
  };

  fechaMinima: Date | null = null;
  fechaMaxima: Date | null = null;
  filtrosListos = false;
  cargandoFiltros = false;
  errorFiltros: string | null = null;
  busquedaProyecto = '';

  proyectoSeleccionado: string | null = null;
  proyectosExcluidos: string[] = [];
  periodoSeleccionado: string | null = null;
  tiposCambioSeleccionados: string[] = [];
  ticketIdSeleccionado: string | null = null;

  kpis: ChangeConsolidatedKPI | null = null;
  volumenMensual: ChangeConsolidatedVolumenItem[] = [];
  proyectos: ChangeConsolidatedProyectoItem[] = [];
  opcionesProyectos: string[] = [];

  tiposCambio: ChangeConsolidatedTipoItem[] = [];
  tiposCambioGrafico: { categoria: string; cantidad: number }[] = [];

  categorias: ChangeConsolidatedCategoriaItem[] = [];
  categoriasGrafico: { categoria: string; cantidad: number }[] = [];

  prioridades: ChangeConsolidatedPrioridadItem[] = [];
  prioridadesGrafico: { categoria: string; cantidad: number }[] = [];

  topProyectos: ChangeConsolidatedTopProyectos = {
    periodos: [],
    proyectos: []
  };

  prioridadMensual: ChangeConsolidatedPrioridadMensualItem[] = [];

  ticketsDetalle: ChangeConsolidatedTicketsOut | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;
  cargandoTickets = false;
  errorTickets: string | null = null;
  graficoExpandido: string | null = null;

  // PRD 05 - ACTIVIDADES Y HORAS DE CAMBIOS
  incluirSoloValidacion = true;
  actividadesBD: ChangeConsolidatedActividadesBDOut | null = null;
  paginaActividadesBD = 1;
  tamanoActividadesBD = 10;
  cargandoActividadesBD = false;
  errorActividadesBD: string | null = null;
  horasPorCambio: ChangeConsolidatedHorasCambioOut | null = null;
  paginaHorasCambio = 1;
  tamanoHorasCambio = 10;
  cargandoHorasCambio = false;
  errorHorasCambio: string | null = null;
  horasPorResolutor: ChangeConsolidatedHorasResolutorItem[] = [];
  horasMensuales: ChangeConsolidatedHorasMensualesItem[] = [];

  readonly cargas: Record<RecursoDashboard, boolean> = {
    kpis: false,
    proyectos: false,
    volumen: false,
    tipos: false,
    categorias: false,
    prioridades: false,
    topProyectos: false,
    prioridadMensual: false,
    horasResolutor: false,
    horasMensuales: false
  };

  readonly errores: Record<RecursoDashboard, string | null> = {
    kpis: null,
    proyectos: null,
    volumen: null,
    tipos: null,
    categorias: null,
    prioridades: null,
    topProyectos: null,
    prioridadMensual: null,
    horasResolutor: null,
    horasMensuales: null
  };

  private readonly validarRangoFechas: ValidatorFn = (
    control: AbstractControl
  ): ValidationErrors | null => {
    const desde = control.get('desde')?.value;
    const hasta = control.get('hasta')?.value;

    if (!(desde instanceof Date) || !(hasta instanceof Date)) {
      return null;
    }

    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      return null;
    }

    return desde.getTime() <= hasta.getTime()
      ? null
      : { rangoFechasInvalido: true };
  };

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly changeConsolidatedService: ChangeConsolidatedService,
    private readonly changeDetector: ChangeDetectorRef
  ) { }

  get proyectosFiltrados(): string[] {
    const busqueda = this.busquedaProyecto.trim().toLocaleLowerCase();
    return busqueda
      ? this.opcionesFiltros.proyectos.filter(
        proyecto => proyecto.toLocaleLowerCase().includes(busqueda)
      )
      : this.opcionesFiltros.proyectos;
  }

  get cargandoKpis(): boolean {
    return this.cargas.kpis;
  }

  get errorKpis(): string | null {
    return this.errores.kpis;
  }

  get cargandoVolumenMensual(): boolean {
    return this.cargas.volumen;
  }

  get cargandoTipos(): boolean {
    return this.cargas.tipos;
  }

  get cargandoCategorias(): boolean {
    return this.cargas.categorias;
  }

  get cargandoPrioridades(): boolean {
    return this.cargas.prioridades;
  }

  get cargandoDashboard(): boolean {
    return Object.values(this.cargas).some(Boolean)
      || this.cargandoTickets
      || this.cargandoActividadesBD
      || this.cargandoHorasCambio
      || this.cargandoRendimientoResolutores
      || this.cargandoTicketsPorResolutor;
  }

  get mensajesErrores(): string[] {
    return [
      ...Object.entries(this.errores)
        .filter(([recurso, mensaje]) =>
          recurso !== 'kpis' && !!mensaje
        )
        .map(([, mensaje]) => mensaje as string),

      ...(this.errorTickets
        ? [this.errorTickets]
        : []),

      ...(this.errorActividadesBD
        ? [this.errorActividadesBD]
        : []),

      ...(this.errorHorasCambio
        ? [this.errorHorasCambio]
        : [])
    ];
  }

  get cargandoHorasResolutor(): boolean {
    return this.cargas.horasResolutor;
  }

  get cargandoHorasMensuales(): boolean {
    return this.cargas.horasMensuales;
  }

  get cargandoAnalisis(): boolean {
    return this.cargandoActividadesBD
      || this.cargandoHorasCambio
      || this.cargandoHorasResolutor
      || this.cargandoHorasMensuales;
  }

  ngOnInit(): void {
    this.filtrosForm = this.formBuilder.group(
      {
        desde: [null, Validators.required],
        hasta: [null, Validators.required],
        prioridad: [null],
        motivo: [null],
        grupo_resolutor: [this.grupoResolutorPorDefecto],
        estado: [null],
        tipo_cambio: [null],
        proyecto: [null]
      },
      { validators: this.validarRangoFechas }
    );

    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.cancelarFiltros$.next();
    this.cancelarFiltros$.complete();
    this.cancelarDashboard$.next();
    this.cancelarDashboard$.complete();
    this.cancelarTickets$.next();
    this.cancelarTickets$.complete();
    this.cancelarActividadesBD$.next();
    this.cancelarActividadesBD$.complete();
    this.cancelarHorasCambio$.next();
    this.cancelarHorasCambio$.complete();
    this.destruir$.next();
    this.destruir$.complete();

    this.cancelarRendimientoResolutores$.next();
    this.cancelarRendimientoResolutores$.complete();
    this.cancelarTicketsPorResolutor$.next();
    this.cancelarTicketsPorResolutor$.complete();
  }

  cargarOpcionesFiltros(): void {
    this.cancelarFiltros$.next();
    this.cancelarDashboard$.next();
    this.cancelarTickets$.next();
    this.cancelarActividadesBD$.next();
    this.cancelarHorasCambio$.next();
    ++this.solicitudActividadesBD;
    ++this.solicitudHorasCambio;
    this.cargandoActividadesBD = false;
    this.cargandoHorasCambio = false;
    this.errorActividadesBD = null;
    this.errorHorasCambio = null;
    this.actividadesBD = null;
    this.horasPorCambio = null;
    this.horasPorResolutor = [];
    this.horasMensuales = [];
    this.incluirSoloValidacion = true;

    ++this.solicitudDashboard;
    ++this.solicitudTickets;

    this.cargandoFiltros = true;
    this.filtrosListos = false;
    this.errorFiltros = null;
    this.cargandoTickets = false;
    this.errorTickets = null;

    for (const recurso of Object.keys(this.cargas) as RecursoDashboard[]) {
      this.cargas[recurso] = false;
      this.errores[recurso] = null;
    }

    this.changeConsolidatedService.obtenerFiltros()
      .pipe(
        takeUntil(this.cancelarFiltros$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: opciones => {
          this.opcionesFiltros = opciones;
          this.fechaMinima = this.convertirFecha(opciones.fecha_min);
          this.fechaMaxima = this.convertirFecha(opciones.fecha_max);
          this.cargandoFiltros = false;
          this.filtrosListos = !!this.fechaMinima && !!this.fechaMaxima;

          this.proyectosExcluidos = [];
          this.proyectoSeleccionado = null;
          this.periodoSeleccionado = null;
          this.tiposCambioSeleccionados = [];
          this.ticketIdSeleccionado = null;

          this.restablecerFormulario();

          if (this.filtrosListos) {
            this.aplicarFiltros();
          } else {
            this.kpis = {
              total_tickets: 0,
              total_proyectos: 0,
              alta_criticidad: 0,
              porcentaje_alta_criticidad: 0
            };
          }

          this.changeDetector.markForCheck();
        },
        error: error => {
          console.error('Error al cargar filtros de Cambios:', error);
          this.cargandoFiltros = false;
          this.errorFiltros =
            'No se pudieron cargar los filtros de Cambios Consolidados.';
          this.changeDetector.markForCheck();
        }
      });
  }

  aplicarFiltros(): void {
    if (!this.filtrosListos || this.cargandoFiltros || this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      this.changeDetector.markForCheck();
      return;
    }

    const valores = this.filtrosForm.getRawValue();
    const proyecto = (valores.proyecto as string | null)?.trim() || null;
    const tipoCambio = (valores.tipo_cambio as string | null)?.trim() || null;

    this.proyectoSeleccionado = proyecto;
    this.periodoSeleccionado = null;
    this.tiposCambioSeleccionados = tipoCambio ? [tipoCambio] : [];
    this.ticketIdSeleccionado = null;

    this.proyectosExcluidos = this.proyectosExcluidos.filter(
      nombre => nombre.toLocaleLowerCase() !== proyecto?.toLocaleLowerCase()
    );

    this.filtrosActuales = {
      desde: this.formatearFecha(valores.desde),
      hasta: this.formatearFecha(valores.hasta),
      prioridad: valores.prioridad || undefined,
      motivo: valores.motivo || undefined,
      grupo_resolutor: valores.grupo_resolutor || undefined,
      estado: valores.estado || undefined,
      proyecto: proyecto ?? undefined,
      tipo_cambio: this.tiposCambioSeleccionados.length
        ? [...this.tiposCambioSeleccionados]
        : undefined,
      proyectos_excluidos: this.proyectosExcluidos.length
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.resolutorSeleccionado = null;
    this.cargarDashboard();
  }

  limpiarFiltros(): void {
    if (this.cargandoFiltros || !this.filtrosListos) {
      return;
    }

    this.proyectosExcluidos = [];
    this.proyectoSeleccionado = null;
    this.periodoSeleccionado = null;
    this.tiposCambioSeleccionados = [];
    this.ticketIdSeleccionado = null;
    this.busquedaProyecto = '';

    this.incluirSoloValidacion = true;

    this.restablecerFormulario();
    this.resolutorSeleccionado = null;
    this.aplicarFiltros();
  }

  private restablecerFormulario(): void {
    const grupoPredeterminado = this.opcionesFiltros.grupos_resolutores.find(
      grupo =>
        grupo.toLocaleLowerCase() ===
        this.grupoResolutorPorDefecto.toLocaleLowerCase()
    ) ?? null;

    this.filtrosForm.reset(
      {
        desde: this.fechaMinima,
        hasta: this.fechaMaxima,
        prioridad: null,
        motivo: null,
        grupo_resolutor: grupoPredeterminado,
        estado: null,
        tipo_cambio: null,
        proyecto: null
      },
      { emitEvent: false }
    );

    this.filtrosForm.markAsPristine();
    this.filtrosForm.markAsUntouched();
    this.filtrosForm.updateValueAndValidity({ emitEvent: false });
    this.busquedaProyecto = '';
  }

  cargarDashboard(): void {
    this.cancelarDashboard$.next();

    const solicitud = ++this.solicitudDashboard;

    // Reiniciar paginaciones al modificar filtros
    this.paginaTickets = 1;
    this.paginaResolutores = 1;
    this.paginaActividadesBD = 1;
    this.paginaHorasCambio = 1;

    // Dashboard existente
    this.cargarKpis(solicitud);
    this.cargarProyectos(solicitud);
    this.cargarVolumenMensual(solicitud);
    this.cargarTiposCambio(solicitud);
    this.cargarCategorias(solicitud);
    this.cargarPrioridades(solicitud);
    this.cargarTopProyectos(solicitud);
    this.cargarPrioridadMensual(solicitud);
    this.cargarTickets(solicitud);
    this.cargarRendimientoResolutores();
    this.cargarTicketsPorResolutor();

    // PRD 05 - Nuevas tablas
    this.cargarActividadesBD(solicitud);
    this.cargarHorasPorCambio(solicitud);

    // PRD 05 - Nuevos gráficos
    this.cargarHorasPorResolutor(solicitud);
    this.cargarHorasMensuales(solicitud);

    this.changeDetector.markForCheck();
  }

  private consultar<T>(
    recurso: RecursoDashboard,
    solicitud: number,
    peticion: Observable<T>,
    recibir: (datos: T) => void,
    mensajeError: string
  ): void {
    this.cargas[recurso] = true;
    this.errores[recurso] = null;

    peticion.pipe(
      takeUntil(this.cancelarDashboard$),
      takeUntil(this.destruir$)
    ).subscribe({
      next: datos => {
        if (solicitud !== this.solicitudDashboard) {
          return;
        }

        recibir(datos);
        this.cargas[recurso] = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        if (solicitud !== this.solicitudDashboard) {
          return;
        }

        console.error(mensajeError, error);
        this.errores[recurso] = mensajeError;
        this.cargas[recurso] = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  cargarKpis(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'kpis',
      solicitud,
      this.changeConsolidatedService.obtenerKpis({ ...this.filtrosActuales }),
      datos => { this.kpis = datos; },
      'No se pudieron actualizar los indicadores de Cambios.'
    );
  }

  cargarProyectos(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: ChangeConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      ticket_id: undefined
    };

    this.consultar(
      'proyectos',
      solicitud,
      this.changeConsolidatedService.obtenerProyectos(filtrosBase),
      datos => {
        this.proyectos = datos;
        this.opcionesProyectos = datos.map(item => item.proyecto);
      },
      'No se pudo actualizar el explorador de proyectos.'
    );
  }

  cargarVolumenMensual(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: ChangeConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      periodo: undefined
    };

    this.consultar(
      'volumen',
      solicitud,
      this.changeConsolidatedService.obtenerVolumenMensual(filtrosBase),
      datos => { this.volumenMensual = datos; },
      'No se pudo actualizar el volumen mensual de Cambios.'
    );
  }

  cargarTiposCambio(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: ChangeConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      tipo_cambio: undefined
    };

    this.consultar(
      'tipos',
      solicitud,
      this.changeConsolidatedService.obtenerTiposCambio(filtrosBase),
      datos => {
        this.tiposCambio = datos;
        this.tiposCambioGrafico = datos.map(item => ({
          categoria: item.tipo_cambio,
          cantidad: item.cantidad
        }));
      },
      'No se pudo actualizar la distribución por tipo de cambio.'
    );
  }

  cargarCategorias(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'categorias',
      solicitud,
      this.changeConsolidatedService.obtenerCategorias({
        ...this.filtrosActuales
      }),
      datos => {
        this.categorias = datos;
        this.categoriasGrafico = datos.map(item => ({
          categoria: item.categoria,
          cantidad: item.cantidad
        }));
      },
      'No se pudo actualizar la distribución por categoría.'
    );
  }

  cargarPrioridades(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'prioridades',
      solicitud,
      this.changeConsolidatedService.obtenerPrioridades({
        ...this.filtrosActuales
      }),
      datos => {
        this.prioridades = datos;
        this.prioridadesGrafico = datos.map(item => ({
          categoria: item.prioridad,
          cantidad: item.cantidad
        }));
      },
      'No se pudo actualizar la distribución por prioridad.'
    );
  }

  cargarTopProyectos(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'topProyectos',
      solicitud,
      this.changeConsolidatedService.obtenerTopProyectos({
        ...this.filtrosActuales
      }),
      datos => { this.topProyectos = datos; },
      'No se pudo actualizar el Top 10 de proyectos.'
    );
  }

  cargarPrioridadMensual(
    solicitud: number = this.solicitudDashboard
  ): void {
    this.consultar(
      'prioridadMensual',
      solicitud,
      this.changeConsolidatedService.obtenerPrioridadMensual({
        ...this.filtrosActuales
      }),
      datos => { this.prioridadMensual = datos; },
      'No se pudo actualizar la prioridad mensual.'
    );
  }

  cargarTickets(solicitud: number = this.solicitudDashboard): void {
    this.cancelarTickets$.next();
    const solicitudTickets = ++this.solicitudTickets;

    this.cargandoTickets = true;
    this.errorTickets = null;

    this.changeConsolidatedService.obtenerTickets(
      { ...this.filtrosActuales },
      this.paginaTickets,
      this.tamanoTickets
    ).pipe(
      takeUntil(this.cancelarDashboard$),
      takeUntil(this.cancelarTickets$),
      takeUntil(this.destruir$)
    ).subscribe({
      next: datos => {
        if (
          solicitud !== this.solicitudDashboard ||
          solicitudTickets !== this.solicitudTickets
        ) {
          return;
        }

        this.ticketsDetalle = datos;
        this.cargandoTickets = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        if (
          solicitud !== this.solicitudDashboard ||
          solicitudTickets !== this.solicitudTickets
        ) {
          return;
        }

        console.error('Error al consultar tickets de Cambios:', error);
        this.errorTickets =
          'No se pudo actualizar el explorador de tickets.';
        this.cargandoTickets = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  cambiarProyecto(proyecto: string | null): void {
    const seleccion = proyecto?.trim() || null;

    if (this.proyectoSeleccionado === seleccion) {
      return;
    }

    this.proyectoSeleccionado = seleccion;
    this.proyectosExcluidos = this.proyectosExcluidos.filter(
      nombre => nombre.toLocaleLowerCase() !== seleccion?.toLocaleLowerCase()
    );

    this.filtrosForm.patchValue(
      { proyecto: seleccion },
      { emitEvent: false }
    );

    this.filtrosActuales = {
      ...this.filtrosActuales,
      proyecto: seleccion ?? undefined,
      proyectos_excluidos: this.proyectosExcluidos.length
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.cargarDashboard();
  }

  cambiarProyectosExcluidos(proyectos: string[]): void {
    const seleccion = this.normalizarLista(proyectos);

    const anterior = [...this.proyectosExcluidos]
      .map(item => item.toLocaleLowerCase()).sort();
    const siguiente = [...seleccion]
      .map(item => item.toLocaleLowerCase()).sort();

    if (anterior.join('\u0000') === siguiente.join('\u0000')) {
      return;
    }

    this.proyectosExcluidos = seleccion;

    if (
      this.proyectoSeleccionado &&
      seleccion.some(
        item => item.toLocaleLowerCase() ===
          this.proyectoSeleccionado!.toLocaleLowerCase()
      )
    ) {
      this.proyectoSeleccionado = null;
      this.filtrosForm.patchValue(
        { proyecto: null },
        { emitEvent: false }
      );
    }

    this.filtrosActuales = {
      ...this.filtrosActuales,
      proyecto: this.proyectoSeleccionado ?? undefined,
      proyectos_excluidos: seleccion.length
        ? [...seleccion]
        : undefined
    };

    this.cargarDashboard();
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

    this.periodoSeleccionado = periodo;
    this.filtrosActuales = {
      ...this.filtrosActuales,
      periodo: periodo ?? undefined
    };

    this.cargarDashboard();
  }

  cambiarTiposCambio(tipos: string[]): void {
    const seleccion = this.normalizarLista(tipos);

    const anterior = [...this.tiposCambioSeleccionados]
      .map(item => item.toLocaleLowerCase()).sort();
    const siguiente = [...seleccion]
      .map(item => item.toLocaleLowerCase()).sort();

    if (anterior.join('\u0000') === siguiente.join('\u0000')) {
      return;
    }

    this.tiposCambioSeleccionados = seleccion;

    this.filtrosForm.patchValue(
      { tipo_cambio: seleccion.length === 1 ? seleccion[0] : null },
      { emitEvent: false }
    );

    this.filtrosActuales = {
      ...this.filtrosActuales,
      tipo_cambio: seleccion.length ? [...seleccion] : undefined
    };

    this.cargarDashboard();
  }

  cambiarTicketId(ticketId: string | null): void {
    const seleccion = ticketId?.trim() || null;

    if (this.ticketIdSeleccionado === seleccion) {
      return;
    }

    this.ticketIdSeleccionado = seleccion;
    this.filtrosActuales = {
      ...this.filtrosActuales,
      ticket_id: seleccion ?? undefined
    };

    this.cargarDashboard();
  }

  cambiarPaginaTickets(evento: {
    pagina: number;
    tamano: number;
  }): void {
    if (
      !Number.isInteger(evento.pagina) ||
      evento.pagina < 1 ||
      !Number.isInteger(evento.tamano) ||
      evento.tamano < 1 ||
      evento.tamano > 100
    ) {
      return;
    }

    if (
      this.paginaTickets === evento.pagina &&
      this.tamanoTickets === evento.tamano
    ) {
      return;
    }

    this.paginaTickets = evento.pagina;
    this.tamanoTickets = evento.tamano;
    this.cargarTickets();
  }

  private normalizarLista(valores: string[]): string[] {
    const vistos = new Set<string>();
    const resultado: string[] = [];

    for (const valor of valores) {
      const limpio = valor?.trim();
      const clave = limpio?.toLocaleLowerCase();

      if (limpio && clave && !vistos.has(clave)) {
        vistos.add(clave);
        resultado.push(limpio);
      }
    }

    return resultado;
  }

  buscarProyecto(evento: Event): void {
    this.busquedaProyecto = (evento.target as HTMLInputElement).value;
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

  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    try {
      if (document.fullscreenElement === elemento) {
        await document.exitFullscreen();
      } else {
        await elemento.requestFullscreen();
      }
    } catch (error) {
      console.error('Error en pantalla completa de Cambios:', error);
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id ?? null;

    this.changeDetector.markForCheck();
  }

  private convertirFecha(valor: string | null): Date | null {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return null;
    }

    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);

    return fecha.getFullYear() === anio &&
      fecha.getMonth() === mes - 1 &&
      fecha.getDate() === dia
      ? fecha
      : null;
  }

  private formatearFecha(valor: Date | null): string | undefined {
    if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
      return undefined;
    }

    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }


  // PRD 05 - NUEVAS CONSULTAS DEL DASHBOARD

  // BLOQUE 1: ACTIVIDADES DE BASES DE DATOS
  cargarActividadesBD(
    solicitud: number = this.solicitudDashboard
  ): void {

    this.cancelarActividadesBD$.next();

    const solicitudActual = ++this.solicitudActividadesBD;

    this.cargandoActividadesBD = true;
    this.errorActividadesBD = null;
    this.actividadesBD = null;

    this.changeConsolidatedService.obtenerActividadesBD(
      { ...this.filtrosActuales },
      this.paginaActividadesBD,
      this.tamanoActividadesBD,
      this.incluirSoloValidacion
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarActividadesBD$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {

          if (
            solicitud !== this.solicitudDashboard ||
            solicitudActual !== this.solicitudActividadesBD
          ) {
            return;
          }
          this.actividadesBD = datos;
          this.cargandoActividadesBD = false;
          this.changeDetector.markForCheck();
        },

        error: error => {

          if (
            solicitud !== this.solicitudDashboard ||
            solicitudActual !== this.solicitudActividadesBD
          ) {
            return;
          }

          console.error(
            'Error al consultar actividades BD:',
            error
          );

          this.errorActividadesBD = 'No se pudo actualizar la tabla de actividades BD.';

          this.cargandoActividadesBD = false;
          this.changeDetector.markForCheck();
        }
      });
  }


  // BLOQUE 2: HORAS TOTALES POR CAMBIO
  cargarHorasPorCambio(
    solicitud: number = this.solicitudDashboard
  ): void {

    this.cancelarHorasCambio$.next();

    const solicitudActual = ++this.solicitudHorasCambio;

    this.cargandoHorasCambio = true;
    this.errorHorasCambio = null;
    this.horasPorCambio = null;

    this.changeConsolidatedService.obtenerHorasPorCambio(
      { ...this.filtrosActuales },
      this.paginaHorasCambio,
      this.tamanoHorasCambio,
      this.incluirSoloValidacion
    )
      .pipe(
        takeUntil(this.cancelarDashboard$),
        takeUntil(this.cancelarHorasCambio$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: datos => {

          if (
            solicitud !== this.solicitudDashboard ||
            solicitudActual !== this.solicitudHorasCambio
          ) {
            return;
          }

          this.horasPorCambio = datos;
          this.cargandoHorasCambio = false;

          this.changeDetector.markForCheck();
        },

        error: error => {

          if (
            solicitud !== this.solicitudDashboard ||
            solicitudActual !== this.solicitudHorasCambio
          ) {
            return;
          }

          console.error(
            'Error al consultar horas por cambio:',
            error
          );

          this.errorHorasCambio =
            'No se pudo actualizar la tabla de horas por cambio.';

          this.cargandoHorasCambio = false;
          this.changeDetector.markForCheck();
        }
      });
  }


  // BLOQUE 3: HORAS TOTALES POR RESOLUTOR
  cargarHorasPorResolutor(
    solicitud: number = this.solicitudDashboard
  ): void {

    this.consultar(
      'horasResolutor',
      solicitud,

      this.changeConsolidatedService.obtenerHorasPorResolutor(
        { ...this.filtrosActuales },
        this.incluirSoloValidacion
      ),

      datos => {
        this.horasPorResolutor = datos;
      },
      'No se pudo actualizar el gráfico de horas por resolutor.'
    );
  }


  // BLOQUE 4: HORAS TOTALES POR MES
  cargarHorasMensuales(
    solicitud: number = this.solicitudDashboard
  ): void {

    this.consultar(
      'horasMensuales',
      solicitud,

      this.changeConsolidatedService.obtenerHorasMensuales(
        { ...this.filtrosActuales },
        this.incluirSoloValidacion
      ),

      datos => {
        this.horasMensuales = datos;
      },

      'No se pudo actualizar el gráfico de horas mensuales.'
    );
  }

  // =====================================================
  // PAGINACIÓN DE LAS NUEVAS TABLAS
  // =====================================================

  private paginacionAnalisisValida(evento: {
    pagina: number;
    tamano: number;
  }): boolean {

    return Number.isInteger(evento.pagina)
      && evento.pagina >= 1
      && Number.isInteger(evento.tamano)
      && evento.tamano >= 1
      && evento.tamano <= 100;
  }


  cambiarPaginaActividadesBD(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (!this.paginacionAnalisisValida(evento)) {
      return;
    }

    if (
      this.paginaActividadesBD === evento.pagina &&
      this.tamanoActividadesBD === evento.tamano
    ) {
      return;
    }

    this.paginaActividadesBD = evento.pagina;
    this.tamanoActividadesBD = evento.tamano;

    this.cargarActividadesBD();
  }


  cambiarPaginaHorasCambio(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (!this.paginacionAnalisisValida(evento)) {
      return;
    }

    if (
      this.paginaHorasCambio === evento.pagina &&
      this.tamanoHorasCambio === evento.tamano
    ) {
      return;
    }

    this.paginaHorasCambio = evento.pagina;
    this.tamanoHorasCambio = evento.tamano;

    this.cargarHorasPorCambio();
  }
  cambiarIncluirSoloValidacion(incluir: boolean): void {

    if (this.incluirSoloValidacion === incluir) {
      return;
    }

    this.incluirSoloValidacion = incluir;

    if (this.filtrosListos && !this.cargandoFiltros) {
      this.cargarDashboard();
    }
  }


  // PRD 06: tabla paginada. La cancelación es independiente del gráfico.
  cargarRendimientoResolutores(): void {
    this.cancelarRendimientoResolutores$.next();
    this.cargandoRendimientoResolutores = true;
    this.errorRendimientoResolutores = null;

    this.changeConsolidatedService.obtenerRendimientoResolutores(
      { ...this.filtrosActuales },
      this.paginaResolutores,
      this.tamanoResolutores
    ).pipe(takeUntil(this.cancelarRendimientoResolutores$))
      .subscribe({
        next: datos => {
          this.rendimientoResolutores = datos;
          this.cargandoRendimientoResolutores = false;
          this.changeDetector.markForCheck();
        },
        error: error => {
          console.error('Error cargando rendimiento por resolutor:', error);
          this.rendimientoResolutores = null;
          this.cargandoRendimientoResolutores = false;
          this.errorRendimientoResolutores =
            'No se pudo cargar el rendimiento por resolutor.';
          this.changeDetector.markForCheck();
        }
      });
  }

  // PRD 06: gráfico Top independiente de la paginación de la tabla.
  cargarTicketsPorResolutor(): void {
    this.cancelarTicketsPorResolutor$.next();
    this.cargandoTicketsPorResolutor = true;
    this.errorTicketsPorResolutor = null;

    this.changeConsolidatedService.obtenerTicketsPorResolutor(
      { ...this.filtrosActuales },
      this.limiteTicketsPorResolutor
    ).pipe(takeUntil(this.cancelarTicketsPorResolutor$))
      .subscribe({
        next: datos => {
          this.ticketsPorResolutor = datos;
          this.cargandoTicketsPorResolutor = false;
          this.changeDetector.markForCheck();
        },
        error: error => {
          console.error('Error cargando tickets por resolutor:', error);
          this.ticketsPorResolutor = null;
          this.cargandoTicketsPorResolutor = false;
          this.errorTicketsPorResolutor =
            'No se pudo cargar el gráfico de tickets por resolutor.';
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaResolutores(evento: { pagina: number; tamano: number }): void {
    if (!Number.isInteger(evento.pagina) || evento.pagina < 1 ||
        ![5, 10, 20, 50, 100].includes(evento.tamano) ||
        (this.paginaResolutores === evento.pagina && this.tamanoResolutores === evento.tamano)) {
      return;
    }
    this.paginaResolutores = evento.pagina;
    this.tamanoResolutores = evento.tamano;
    this.cargarRendimientoResolutores();
  }

  cambiarLimiteTicketsPorResolutor(limite: number): void {
    if (![5, 10, 15, 20].includes(limite) ||
        this.limiteTicketsPorResolutor === limite) {
      return;
    }
    this.limiteTicketsPorResolutor = limite;
    this.cargarTicketsPorResolutor();
  }

  cambiarResolutor(resolutor: string | null): void {
    const seleccion = resolutor?.trim() || null;
    if (this.resolutorSeleccionado === seleccion) {
      return;
    }
    this.resolutorSeleccionado = seleccion;
    this.filtrosActuales = {
      ...this.filtrosActuales,
      nombre_resolutor: seleccion ?? undefined
    };
    this.cargarDashboard();
  }

  get mostrarMesesEnEjeXResolutores(): boolean {
    const f = this.filtrosActuales;
    const fechasPersonalizadas =
      (!!f.desde && f.desde !== this.opcionesFiltros.fecha_min) ||
      (!!f.hasta && f.hasta !== this.opcionesFiltros.fecha_max);
    return Boolean(
      fechasPersonalizadas ||
      f.grupo_resolutor ||
      f.prioridad ||
      f.proyecto ||
      f.periodo ||
      f.proyectos_excluidos?.length ||
      f.ticket_id ||
      f.nombre_resolutor ||
      f.motivo ||
      f.estado ||
      f.tipo_cambio?.length
    );
  }


}

