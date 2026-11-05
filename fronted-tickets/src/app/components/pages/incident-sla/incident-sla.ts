import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IncidentSLADashboardFilters, IncidentSLAFilters, IncidentSLAKPI, IncidentSLAInsights, IncidentSLATrendItem, IncidentSLAVolumenItem, IncidentSLAProyectoItem, IncidentSLAParetoItem, IncidentSLATendencia, IncidentSLAResolutorItem, IncidentSLATicketsOut } from '../../../models/incident-sla';
import { IncidentSlaService } from '../../../services/incident-sla.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-incident-sla',
  standalone: false,
  templateUrl: './incident-sla.html',
  styleUrl: './incident-sla.css'
})
export class IncidentSla {

  filtrosForm!: FormGroup;
  opcionesFiltros: IncidentSLAFilters = {
    fecha_min: null,
    fecha_max: null,
    grupos_resolutores: [],
    prioridades: []
  };

  filtrosActuales: IncidentSLADashboardFilters = {};

  // Filtro dinámico por mes
  periodoSeleccionado: string | null = null;

  kpis: IncidentSLAKPI | null = null;
  cargandoKpis: boolean = false;
  cargandoInsights: boolean = false;
  insights: IncidentSLAInsights | null = null;
  slaSolucionTendencia: IncidentSLATrendItem[] = [];
  cargandoSlaSolucionTendencia: boolean = false;
  volumenIncidentes: IncidentSLAVolumenItem[] = [];
  cargandoVolumenIncidentes: boolean = false;
  proyectos: IncidentSLAProyectoItem[] = [];
  cargandoProyectos: boolean = false;
  paretoTipos: IncidentSLAParetoItem[] = [];
  cargandoParetoTipos: boolean = false;
  tendenciaIncidentes: IncidentSLATendencia | null = null;
  cargandoTendenciaIncidentes: boolean = false;
  resolutores: IncidentSLAResolutorItem[] = [];
  cargandoResolutores: boolean = false;


  // TABLA PAGINADA - EXPLORADOR DE TICKETS
  ticketsDetalle: IncidentSLATicketsOut | null = null;
  cargandoTickets = false;
  errorTickets: string | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;
  ticketIdSeleccionado: string | null = null;

  // CANCELACIÓN DE CONSULTAS DE PAGINACIÓN ANTERIORES
  private readonly cancelarTickets$ = new Subject<void>();


  //FIltro Proyectos
  opcionesProyectos: string[] = [];
  proyectoSeleccionado: string | null = null;
  proyectosExcluidos: string[] = [];
  private solicitudOpcionesProyectos = 0;
  private temporizadorExclusiones: ReturnType<typeof setTimeout> | null = null;


  //Control HTTP
  private readonly cancelarDashboard$ = new Subject<void>();

  // FILTRO DINÁMICO DE TIPOS DE INCIDENTE
  tiposIncidenteSeleccionados: string[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private incidentSlaService: IncidentSlaService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }



  cargarDashboard(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    // CANCELAR CONSULTAS ANTERIORES
    this.cancelarDashboard$.next();

    // REINICIAR PAGINACIÓN DE LA TABLA DE TICKETS
    this.paginaTickets = 1;

    // KPIs Y GRÁFICOS EXISTENTES
    this.cargarKpis();
    this.cargarInsights();
    this.cargarSlaSolucionTendencia();
    this.cargarVolumenIncidentes();
    this.cargarProyectos();
    this.cargarParetoTipos();
    this.cargarTendenciaIncidentes();
    this.cargarResolutores();

    // NUEVA TABLA PAGINADA
    this.cargarTickets();

    this.changeDetector.markForCheck();
  }



  ngOnDestroy(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    // CANCELAR CONSULTAS DEL DASHBOARD
    this.cancelarDashboard$.next();
    this.cancelarDashboard$.complete();

    // CANCELAR CONSULTAS DE LA TABLA DE TICKETS
    this.cancelarTickets$.next();
    this.cancelarTickets$.complete();
  }


  crearFormularioFiltros() {
    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],
      grupo_resolutor: [null],
      prioridad: [null]
    });
  }

  cargarOpcionesFiltros() {
    this.incidentSlaService
      .obtenerFiltros().subscribe({
        next: (data) => {
          this.opcionesFiltros = data;

          // 2. ESTABLECER FECHAS POR DEFECTO
          this.establecerFechasPorDefecto();
          // 3. ACTUALIZAR OPCIONES DE PROYECTOS
          this.cargarOpcionesProyectos();

          this.cargarDashboard();
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error(
            'Error obteniendo filtros:',
            error
          );
          this.cargarOpcionesProyectos();
          this.cargarDashboard();
          this.changeDetector.markForCheck();
        }

      });
  }


  aplicarFiltros() {
    //Agregar esta validacion
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const valores = this.filtrosForm.value;

    this.filtrosActuales = {
      desde: valores.desde
        ? this.formatearFecha(valores.desde)
        : undefined,
      hasta: valores.hasta
        ? this.formatearFecha(valores.hasta)
        : undefined,
      grupo_resolutor:
        valores.grupo_resolutor || undefined,
      prioridad:
        valores.prioridad || undefined,

      // CONSERVAR PROYECTOS EXCLUIDOS
      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.proyectoSeleccionado = null;
    this.tiposIncidenteSeleccionados = [];
    this.periodoSeleccionado = null;

    // LIMPIAR FILTRO DINÁMICO DE TICKETS
    this.ticketIdSeleccionado = null;

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }



  limpiarFiltros() {
    this.filtrosForm.reset();
    this.filtrosActuales = {};
    this.proyectosExcluidos = [];

    //RESTABLECER FECHA MINIMA Y MAXIMA
    this.establecerFechasPorDefecto();

    this.proyectoSeleccionado = null;
    this.tiposIncidenteSeleccionados = [];
    this.periodoSeleccionado = null;
    this.ticketIdSeleccionado = null;

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(
      fecha.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      fecha.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  cargarKpis() {
    this.cargandoKpis = true;

    this.incidentSlaService
      .obtenerKpis(this.filtrosActuales)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.kpis = data;
          this.cargandoKpis = false;
          console.log('KPIs cargados:', data);
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error(
            'Error obteniendo KPIs:',
            error
          );
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        }

      });
  }

  cargarInsights() {
    this.cargandoInsights = true;
    this.incidentSlaService
      .obtenerInsights(this.filtrosActuales)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({

        next: (data) => {
          this.insights = data;
          this.cargandoInsights = false;
          console.log('Insights cargados:', data);
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error(
            'Error obteniendo insights:',
            error
          );
          this.cargandoInsights = false;
          this.changeDetector.markForCheck();
        }

      });

  }

  cargarSlaSolucionTendencia() {
    this.cargandoSlaSolucionTendencia = true;
    this.incidentSlaService
      .obtenerSlaSolucionTendencia(this.filtrosActuales)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.slaSolucionTendencia = data;
          this.cargandoSlaSolucionTendencia = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo tendencia SLA:', error);
          this.cargandoSlaSolucionTendencia = false;
          this.changeDetector.markForCheck();
        }
      });

  }

  cargarVolumenIncidentes() {
    this.cargandoVolumenIncidentes = true;

    this.incidentSlaService
      .obtenerVolumenIncidentes({
        ...this.filtrosActuales,
        periodo: undefined
      })

      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.volumenIncidentes = data;
          this.cargandoVolumenIncidentes = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo volumen de incidentes:', error);
          this.cargandoVolumenIncidentes = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarProyectos() {
    this.cargandoProyectos = true;
    this.incidentSlaService
      .obtenerProyectos(this.filtrosActuales)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.proyectos = data;
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo proyectos:', error);
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarParetoTipos() {
    this.cargandoParetoTipos = true;
    this.incidentSlaService
      .obtenerParetoTipos({
        ...this.filtrosActuales,
        tipo_incidente: undefined
      }).pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.paretoTipos = data;
          this.cargandoParetoTipos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo Pareto de tipos:', error);
          this.cargandoParetoTipos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarTendenciaIncidentes(): void {

    this.cargandoTendenciaIncidentes = true;

    this.incidentSlaService
      .obtenerTendenciaIncidentes(
        this.filtrosActuales
      )
      .pipe(
        takeUntil(this.cancelarDashboard$)
      )
      .subscribe({

        next: (data) => {
          this.tendenciaIncidentes = data;
          this.cargandoTendenciaIncidentes = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo tendencia de incidentes:',
            error
          );

          this.cargandoTendenciaIncidentes = false;

          this.changeDetector.markForCheck();
        }

      });

  }


  cargarResolutores() {
    this.cargandoResolutores = true;
    this.incidentSlaService
      .obtenerResolutores(this.filtrosActuales)
      .pipe(takeUntil(this.cancelarDashboard$))
      .subscribe({
        next: (data) => {
          this.resolutores = data;
          this.cargandoResolutores = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo resolutores:', error);
          this.cargandoResolutores = false;
          this.changeDetector.markForCheck();
        }
      });
  }



  // Filtro de Proyectos
  cargarOpcionesProyectos(): void {

    const solicitudActual = ++this.solicitudOpcionesProyectos;


    const filtrosBase: IncidentSLADashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      tipo_incidente: undefined,
      proyectos_excluidos: undefined,
      ticket_id: undefined
    };


    this.incidentSlaService
      .obtenerProyectos(filtrosBase).subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudOpcionesProyectos) {
            return;
          }

          // Eliminar valores nulos, vacíos y duplicados
          const proyectosValidos = data
            .map(item => item.proyecto?.trim())
            .filter(
              (proyecto): proyecto is string =>
                typeof proyecto === 'string' &&
                proyecto.length > 0
            );

          this.opcionesProyectos = [
            ...new Set(proyectosValidos)
          ];

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudOpcionesProyectos) {
            return;
          }

          console.error('Error obteniendo proyectos:', error);

          this.opcionesProyectos = [];

          this.changeDetector.markForCheck();
        }

      });
  }


  cambiarProyecto(proyecto: string | null): void {

    if (this.proyectoSeleccionado === proyecto) {
      return;
    }
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


  // Filtro dinámico mensual
  cambiarPeriodo(periodo: string | null): void {

    // Validar formato YYYY-MM
    if (
      periodo !== null &&
      !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo)
    ) {
      console.error('Período inválido:', periodo);
      return;
    }

    // Evitar consultas innecesarias
    if (this.periodoSeleccionado === periodo) {
      return;
    }

    // Actualizar selección
    this.periodoSeleccionado = periodo;

    // Conservar filtros existentes
    this.filtrosActuales = {
      ...this.filtrosActuales,
      periodo: periodo ?? undefined
    };

    // Actualizar opciones de proyectos
    this.cargarOpcionesProyectos();

    // Actualizar el dashboard
    this.cargarDashboard();
  }


  cambiarTiposIncidente(tipos: string[]): void {

    // Tipos individuales visibles en el Top 10
    const tiposPermitidos = new Set(
      this.paretoTipos
        .slice(0, 10)
        .map(item => item.tipo_incidente?.trim())
        .filter(
          (tipo): tipo is string =>
            !!tipo && tipo !== 'Otros'
        )
    );

    // Normalizar y evitar duplicados
    const seleccion = [
      ...new Set(
        tipos
          .map(tipo => tipo.trim())
          .filter(tipo => tiposPermitidos.has(tipo))
      )
    ];

    // Evitar consultas si la selección no cambió
    const anteriores = new Set(this.tiposIncidenteSeleccionados);

    if (
      anteriores.size === seleccion.length &&
      seleccion.every(tipo => anteriores.has(tipo))) {
      return;
    }

    this.tiposIncidenteSeleccionados = seleccion;

    // Conservar proyecto y filtros generales
    this.filtrosActuales = {
      ...this.filtrosActuales,
      tipo_incidente: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };

    // Actualizar los ocho elementos
    this.cargarDashboard();

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
    const desde = this.convertirFecha(this.opcionesFiltros.fecha_min);
    const hasta = this.convertirFecha(this.opcionesFiltros.fecha_max);
    this.filtrosForm.patchValue({ desde, hasta }, { emitEvent: false });
    this.filtrosActuales = {
      ...this.filtrosActuales,
      desde: desde ? this.formatearFecha(desde) : undefined,
      hasta: hasta ? this.formatearFecha(hasta) : undefined
    };
  }



  // ====================================================
  // FILTRO GLOBAL - EXCLUSION MULTIPLE DE PROYECTOS
  // ====================================================

  cambiarProyectosExcluidos(proyectos: string[]): void {

    // NORMALIZAR Y ELIMINAR DUPLICADOS
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

    // EVITAR CONSULTAS INNECESARIAS
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

    // EVITAR CONFLICTO CON PROYECTO INDIVIDUAL
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

    // ACTUALIZAR FILTROS GLOBALES
    this.filtrosActuales = {
      ...this.filtrosActuales,

      proyecto: this.proyectoSeleccionado ?? undefined,

      proyectos_excluidos: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };

    // CANCELAR SOLICITUDES CON FILTROS ANTERIORES
    this.cancelarDashboard$.next();

    // AGRUPAR CAMBIOS RAPIDOS DE CHECKBOXES
    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
    }

    this.temporizadorExclusiones = setTimeout(() => {

      this.temporizadorExclusiones = null;

      this.cargarDashboard();

    }, 300);

    this.changeDetector.markForCheck();
  }




  // ====================================================
  // CARGAR TABLA PAGINADA - EXPLORADOR DE TICKETS
  // ====================================================

  cargarTickets(): void {

    // CANCELAR CONSULTA ANTERIOR DE LA TABLA
    this.cancelarTickets$.next();

    this.cargandoTickets = true;
    this.errorTickets = null;

    this.incidentSlaService
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

          this.ticketsDetalle = data;
          this.cargandoTickets = false;
          this.errorTickets = null;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo tabla de tickets SLA:',
            error
          );

          this.ticketsDetalle = null;
          this.cargandoTickets = false;

          this.errorTickets =
            'No se pudieron cargar los tickets de Incidentes SLA.';

          this.changeDetector.markForCheck();
        }

      });
  }


  
  // ====================================================
  // PAGINACIÓN - EXPLORADOR DE TICKETS
  // ====================================================

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


  
  // ====================================================
  // FILTRO DINÁMICO POR TICKET ID
  // ====================================================

  cambiarTicketId(ticketId: string | null): void {

    const nuevoTicketId = ticketId?.trim() || null;

    if (this.ticketIdSeleccionado === nuevoTicketId) {
      return;
    }

    // ACTUALIZAR SELECCIÓN
    this.ticketIdSeleccionado = nuevoTicketId;

    // CONSERVAR LOS DEMÁS FILTROS
    this.filtrosActuales = {
      ...this.filtrosActuales,
      ticket_id: nuevoTicketId ?? undefined
    };

    // RECARGAR KPIs, INSIGHTS, GRÁFICOS Y TABLA
    this.cargarDashboard();
  }







}