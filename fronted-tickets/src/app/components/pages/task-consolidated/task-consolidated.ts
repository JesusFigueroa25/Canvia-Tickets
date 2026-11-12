import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';

import {
  TaskConsolidatedDashboardFilters,
  TaskConsolidatedFilters,
  TaskConsolidatedKPI,
  TaskConsolidatedPrioridadItem,
  TaskConsolidatedPrioridadMensualItem,
  TaskConsolidatedProyectoItem,
  TaskConsolidatedTicketsOut,
  TaskConsolidatedTipoItem,
  TaskConsolidatedTopProyectos,
  TaskConsolidatedVolumenItem
} from '../../../models/task-consolidated';
import { TaskConsolidatedService } from '../../../services/task-consolidated.service';

type RecursoDashboard =
  | 'kpis'
  | 'proyectos'
  | 'volumen'
  | 'tipos'
  | 'prioridades'
  | 'topProyectos'
  | 'prioridadMensual';

@Component({
  selector: 'app-task-consolidated',
  standalone: false,
  templateUrl: './task-consolidated.html',
  styleUrl: './task-consolidated.css'
})
export class TaskConsolidated implements OnInit, OnDestroy {

  filtrosForm!: FormGroup;
  filtrosActuales: TaskConsolidatedDashboardFilters = {};

  opcionesFiltros: TaskConsolidatedFilters = {
    fecha_min: null,
    fecha_max: null,
    prioridades: [],
    motivos_estado: [],
    grupos_resolutores: [],
    proyectos: [],
    tipos_tarea: []
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
  tiposTareaSeleccionados: string[] = [];
  ticketIdSeleccionado: string | null = null;

  kpis: TaskConsolidatedKPI | null = null;
  volumenMensual: TaskConsolidatedVolumenItem[] = [];
  proyectos: TaskConsolidatedProyectoItem[] = [];
  opcionesProyectos: string[] = [];
  tipos: TaskConsolidatedTipoItem[] = [];
  tiposGrafico: { categoria: string; cantidad: number }[] = [];
  prioridades: TaskConsolidatedPrioridadItem[] = [];
  prioridadesGrafico: { categoria: string; cantidad: number }[] = [];
  topProyectos: TaskConsolidatedTopProyectos = { periodos: [], proyectos: [] };
  prioridadMensual: TaskConsolidatedPrioridadMensualItem[] = [];

  ticketsDetalle: TaskConsolidatedTicketsOut | null = null;
  cargandoTickets = false;
  errorTickets: string | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;

  graficoExpandido: string | null = null;

  readonly cargas: Record<RecursoDashboard, boolean> = {
    kpis: false,
    proyectos: false,
    volumen: false,
    tipos: false,
    prioridades: false,
    topProyectos: false,
    prioridadMensual: false
  };

  readonly errores: Record<RecursoDashboard, string | null> = {
    kpis: null,
    proyectos: null,
    volumen: null,
    tipos: null,
    prioridades: null,
    topProyectos: null,
    prioridadMensual: null
  };

  private solicitudDashboard = 0;
  private solicitudTickets = 0;
  private readonly cancelarDashboard$ = new Subject<void>();
  private readonly cancelarTickets$ = new Subject<void>();
  private readonly destruir$ = new Subject<void>();

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
    private readonly taskConsolidatedService: TaskConsolidatedService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  get proyectosFiltrados(): string[] {
    const busqueda = this.busquedaProyecto.trim().toLocaleLowerCase();
    return busqueda
      ? this.opcionesFiltros.proyectos.filter(
          proyecto => proyecto.toLocaleLowerCase().includes(busqueda)
        )
      : this.opcionesFiltros.proyectos;
  }

  get cargandoKpis(): boolean { return this.cargas.kpis; }
  get cargandoProyectos(): boolean { return this.cargas.proyectos; }
  get cargandoVolumenMensual(): boolean { return this.cargas.volumen; }
  get cargandoTipos(): boolean { return this.cargas.tipos; }
  get cargandoPrioridades(): boolean { return this.cargas.prioridades; }
  get cargandoTopProyectos(): boolean { return this.cargas.topProyectos; }
  get cargandoPrioridadMensual(): boolean { return this.cargas.prioridadMensual; }

  get cargandoDashboard(): boolean {
    return Object.values(this.cargas).some(Boolean) || this.cargandoTickets;
  }

  get mensajesErrores(): string[] {
    return [
      ...Object.values(this.errores).filter((error): error is string => !!error),
      ...(this.errorTickets ? [this.errorTickets] : [])
    ];
  }

  ngOnInit(): void {
    this.filtrosForm = this.formBuilder.group(
      {
        desde: [null, Validators.required],
        hasta: [null, Validators.required],
        prioridad: [null],
        motivo_estado: [null],
        grupo_resolutor: [null],
        proyecto: [null]
      },
      { validators: this.validarRangoFechas }
    );
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.cancelarDashboard$.next();
    this.cancelarDashboard$.complete();
    this.cancelarTickets$.next();
    this.cancelarTickets$.complete();
    this.destruir$.next();
    this.destruir$.complete();
  }

  cargarOpcionesFiltros(): void {
    this.cargandoFiltros = true;
    this.filtrosListos = false;
    this.errorFiltros = null;

    this.taskConsolidatedService.obtenerFiltros()
      .pipe(takeUntil(this.destruir$))
      .subscribe({
        next: opciones => {
          this.opcionesFiltros = opciones;
          this.fechaMinima = this.convertirFecha(opciones.fecha_min);
          this.fechaMaxima = this.convertirFecha(opciones.fecha_max);
          this.cargandoFiltros = false;
          this.filtrosListos = !!this.fechaMinima && !!this.fechaMaxima;
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
          console.error('Error al obtener filtros de Tareas:', error);
          this.cargandoFiltros = false;
          this.errorFiltros = 'No se pudieron cargar los filtros de Tareas Consolidadas.';
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
    this.proyectoSeleccionado = proyecto;
    this.periodoSeleccionado = null;
    this.tiposTareaSeleccionados = [];
    this.ticketIdSeleccionado = null;

    this.proyectosExcluidos = this.proyectosExcluidos.filter(
      nombre => nombre.toLocaleLowerCase() !== proyecto?.toLocaleLowerCase()
    );

    this.filtrosActuales = {
      desde: this.formatearFecha(valores.desde),
      hasta: this.formatearFecha(valores.hasta),
      prioridad: valores.prioridad || undefined,
      motivo_estado: valores.motivo_estado || undefined,
      grupo_resolutor: valores.grupo_resolutor || undefined,
      proyecto: proyecto ?? undefined,
      proyectos_excluidos: this.proyectosExcluidos.length
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.cargarDashboard();
  }

  limpiarFiltros(): void {
    if (this.cargandoFiltros) {
      return;
    }

    this.proyectosExcluidos = [];
    this.proyectoSeleccionado = null;
    this.periodoSeleccionado = null;
    this.tiposTareaSeleccionados = [];
    this.ticketIdSeleccionado = null;
    this.busquedaProyecto = '';
    this.restablecerFormulario();

    if (this.filtrosListos) {
      this.aplicarFiltros();
    }
  }

  private restablecerFormulario(): void {
    this.filtrosForm.reset(
      {
        desde: this.fechaMinima,
        hasta: this.fechaMaxima,
        prioridad: null,
        motivo_estado: null,
        grupo_resolutor: null,
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
    this.paginaTickets = 1;
    this.cargarKpis(solicitud);
    this.cargarProyectos(solicitud);
    this.cargarVolumenMensual(solicitud);
    this.cargarTipos(solicitud);
    this.cargarPrioridades(solicitud);
    this.cargarTopProyectos(solicitud);
    this.cargarPrioridadMensual(solicitud);
    this.cargarTickets(solicitud);
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
      this.taskConsolidatedService.obtenerKpis({ ...this.filtrosActuales }),
      datos => { this.kpis = datos; },
      'No se pudieron actualizar los indicadores de Tareas.'
    );
  }

  cargarProyectos(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: TaskConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      ticket_id: undefined
    };

    this.consultar(
      'proyectos',
      solicitud,
      this.taskConsolidatedService.obtenerProyectos(filtrosBase),
      datos => {
        this.proyectos = datos;
        this.opcionesProyectos = datos.map(item => item.proyecto);
      },
      'No se pudo actualizar el Explorador de Proyectos de Tareas.'
    );
  }

  cargarVolumenMensual(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: TaskConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      periodo: undefined
    };

    this.consultar(
      'volumen',
      solicitud,
      this.taskConsolidatedService.obtenerVolumenMensual(filtrosBase),
      datos => { this.volumenMensual = datos; },
      'No se pudo actualizar el volumen mensual de Tareas.'
    );
  }

  cargarTipos(solicitud: number = this.solicitudDashboard): void {
    const filtrosBase: TaskConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      tipo_tarea: undefined
    };

    this.consultar(
      'tipos',
      solicitud,
      this.taskConsolidatedService.obtenerTipos(filtrosBase),
      datos => {
        this.tipos = datos;
        this.tiposGrafico = datos.map(item => ({
          categoria: item.tipo_tarea,
          cantidad: item.cantidad
        }));
      },
      'No se pudo actualizar la distribución por tipo de tarea.'
    );
  }

  cargarPrioridades(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'prioridades',
      solicitud,
      this.taskConsolidatedService.obtenerPrioridades({ ...this.filtrosActuales }),
      datos => {
        this.prioridades = datos;
        this.prioridadesGrafico = datos.map(item => ({
          categoria: item.prioridad,
          cantidad: item.cantidad
        }));
      },
      'No se pudo actualizar la distribución por prioridad de Tareas.'
    );
  }

  cargarTopProyectos(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'topProyectos',
      solicitud,
      this.taskConsolidatedService.obtenerTopProyectos({ ...this.filtrosActuales }),
      datos => { this.topProyectos = datos; },
      'No se pudo actualizar el Top 10 de proyectos de Tareas.'
    );
  }

  cargarPrioridadMensual(solicitud: number = this.solicitudDashboard): void {
    this.consultar(
      'prioridadMensual',
      solicitud,
      this.taskConsolidatedService.obtenerPrioridadMensual({ ...this.filtrosActuales }),
      datos => { this.prioridadMensual = datos; },
      'No se pudo actualizar el gráfico mensual por prioridad de Tareas.'
    );
  }

  cargarTickets(solicitud: number = this.solicitudDashboard): void {
    this.cancelarTickets$.next();
    const solicitudTickets = ++this.solicitudTickets;
    this.cargandoTickets = true;
    this.errorTickets = null;

    this.taskConsolidatedService.obtenerTickets(
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
        console.error('Error al consultar tickets de Tareas:', error);
        this.errorTickets = 'No se pudo actualizar la tabla de tickets de Tareas.';
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
      excluido => excluido.toLocaleLowerCase() !== seleccion?.toLocaleLowerCase()
    );
    this.filtrosForm.patchValue({ proyecto: seleccion }, { emitEvent: false });
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
    const vistos = new Set<string>();
    const seleccion: string[] = [];

    for (const proyecto of proyectos) {
      const nombre = proyecto.trim();
      const clave = nombre.toLocaleLowerCase();
      if (nombre && !vistos.has(clave)) {
        vistos.add(clave);
        seleccion.push(nombre);
      }
    }

    const anterior = this.proyectosExcluidos.map(item => item.toLocaleLowerCase()).sort();
    const siguiente = seleccion.map(item => item.toLocaleLowerCase()).sort();
    if (anterior.join('\u0000') === siguiente.join('\u0000')) {
      return;
    }

    this.proyectosExcluidos = seleccion;
    if (
      this.proyectoSeleccionado &&
      vistos.has(this.proyectoSeleccionado.toLocaleLowerCase())
    ) {
      this.proyectoSeleccionado = null;
      this.filtrosForm.patchValue({ proyecto: null }, { emitEvent: false });
    }

    this.filtrosActuales = {
      ...this.filtrosActuales,
      proyecto: this.proyectoSeleccionado ?? undefined,
      proyectos_excluidos: seleccion.length ? [...seleccion] : undefined
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

  cambiarTiposTarea(tipos: string[]): void {
    const vistos = new Set<string>();
    const seleccion = tipos.map(tipo => tipo.trim()).filter(tipo => {
      const clave = tipo.toLocaleLowerCase();
      if (!tipo || vistos.has(clave)) {
        return false;
      }
      vistos.add(clave);
      return true;
    });

    const anterior = [...this.tiposTareaSeleccionados].sort();
    const siguiente = [...seleccion].sort();
    if (anterior.join('\u0000') === siguiente.join('\u0000')) {
      return;
    }

    this.tiposTareaSeleccionados = seleccion;
    this.filtrosActuales = {
      ...this.filtrosActuales,
      tipo_tarea: seleccion.length ? [...seleccion] : undefined
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

  cambiarPaginaTickets(evento: { pagina: number; tamano: number }): void {
    if (
      this.paginaTickets === evento.pagina &&
      this.tamanoTickets === evento.tamano
    ) {
      return;
    }
    if (
      !Number.isInteger(evento.pagina) || evento.pagina < 1 ||
      !Number.isInteger(evento.tamano) || evento.tamano < 1 || evento.tamano > 100
    ) {
      return;
    }

    this.paginaTickets = evento.pagina;
    this.tamanoTickets = evento.tamano;
    this.cargarTickets();
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
      console.error('Error al cambiar pantalla completa de Tareas:', error);
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
}
