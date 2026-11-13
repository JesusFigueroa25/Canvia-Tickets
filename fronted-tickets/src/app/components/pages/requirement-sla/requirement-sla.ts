import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RequirementSLADashboardFilters, RequirementSLAFilters, RequirementSLAKPI, RequirementSLASolucionTendenciaItem, RequirementSLAVolumenItem, RequirementSLAProyectoItem, RequirementSLAParticipacionProyectoItem, RequirementSLAParetoItem, RequirementSLATendenciaItem, RequirementSLAResolutorItem, RequirementSLATicketsOut } from '../../../models/requirement-sla';
import { RequirementSlaService } from '../../../services/requirement-sla.service';
import { RequirementSLACondicionDia, RequirementSLASolucionCondicion, RequirementSLAExploradorTiposOut, RequirementSLACondicionDiaOut, RequirementSLACumplimientoOut, RequirementSLACumplimientoHorarioOut, RequirementSLACumplimientoPrioridadOut, RequirementSLATop10CategoriaOut, RequirementSLACumplimientoTipoOut, RequirementSLAParetoCategoriaOut, RequirementSLAParetoGraficoOut } from '../../../models/requirement-sla';
import { Observable } from 'rxjs';

type NuevoVisualSla =
  | 'exploradorTipos'
  | 'distribucionCondicionDia'
  | 'porcentajeCumplimientoSla'
  | 'cumplimientoSlaHorario'
  | 'cumplimientoSlaPrioridad'
  | 'top10CumplimientoSlaCategoria'
  | 'cumplimientoSlaTipo'
  | 'paretoSlaCategorias'
  | 'paretoSlaCategoriasGrafico';

@Component({
  selector: 'app-requirement-sla',
  standalone: false,
  templateUrl: './requirement-sla.html',
  styleUrl: './requirement-sla.css'
})

export class RequirementSla implements OnDestroy {


  filtrosForm!: FormGroup;
  opcionesFiltros: RequirementSLAFilters = {
    fecha_min: null,
    fecha_max: null,
    grupos_resolutores: [],
    prioridades: [],
    categorias: [],
    proyectos: [],
    tipos_requerimiento: [],
    condiciones_dia: []
  };


  // feat/mejoras-analisis-incidentes-gpt
  private readonly grupoResolutorPorDefecto = 'BASE DE DATOS Y EBS';
  filtrosActuales: RequirementSLADashboardFilters = {
    grupo_resolutor: this.grupoResolutorPorDefecto
  };

  periodoSeleccionado: string | null = null;
  slaSolucionSeleccionada: RequirementSLASolucionCondicion | null = null;
  cargandoFiltros: boolean = false;
  kpis: RequirementSLAKPI | null = null;
  cargandoKpis: boolean = false;
  cargandoSlaSolucionTendencia: boolean = false;
  slaSolucionTendencia: RequirementSLASolucionTendenciaItem[] = [];
  volumenRequerimientos: RequirementSLAVolumenItem[] = [];
  cargandoVolumenRequerimientos: boolean = false;
  proyectos: RequirementSLAProyectoItem[] = [];
  cargandoProyectos: boolean = false;
  participacionProyectos: RequirementSLAParticipacionProyectoItem[] = [];
  cargandoParticipacionProyectos: boolean = false;
  paretoRequerimientos: RequirementSLAParetoItem[] = [];
  cargandoParetoRequerimientos: boolean = false;
  tendenciaRequerimientos: RequirementSLATendenciaItem[] = [];
  cargandoTendenciaRequerimientos: boolean = false;
  resolutores: RequirementSLAResolutorItem[] = [];
  cargandoResolutores: boolean = false;

  //Tendencia de Requerimientos
  rankingTendenciaDesde: number = 1;
  rankingTendenciaHasta: number = 5;

  //Filtro Tipos de Requerimiento
  tiposRequerimientoSeleccionados: string[] = [];


  //Filtro Proyectos
  opcionesProyectos: string[] = [];
  proyectoSeleccionado: string | null = null;
  proyectosExcluidos: string[] = [];
  private solicitudOpcionesProyectos = 0;
  private temporizadorExclusiones: ReturnType<typeof setTimeout> | null = null;

  exploradorTipos: RequirementSLAExploradorTiposOut | null = null;
  distribucionCondicionDia: RequirementSLACondicionDiaOut | null = null;
  porcentajeCumplimientoSla: RequirementSLACumplimientoOut | null = null;
  cumplimientoSlaHorario: RequirementSLACumplimientoHorarioOut | null = null;
  cumplimientoSlaPrioridad: RequirementSLACumplimientoPrioridadOut | null = null;
  top10CumplimientoSlaCategoria: RequirementSLATop10CategoriaOut | null = null;
  cumplimientoSlaTipo: RequirementSLACumplimientoTipoOut | null = null;
  paretoSlaCategorias: RequirementSLAParetoCategoriaOut | null = null;
  paretoSlaCategoriasGrafico: RequirementSLAParetoGraficoOut | null = null;

  // CONTROL DE PETICIONES NUEVOS GRAFICOS
  cargandoNuevosGraficos: Partial<Record<NuevoVisualSla, boolean>> = {};
  erroresNuevosGraficos: Partial<Record<NuevoVisualSla, string>> = {};

  private versionDashboard = 0;


  ticketsDetalle: RequirementSLATicketsOut | null = null;
  cargandoTickets = false;
  errorTickets: string | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;
  ticketIdSeleccionado: string | null = null;
  private solicitudTickets = 0;

  // PANTALLA COMPLETA DE GRÁFICOS
  graficoExpandido: string | null = null;

  async alternarPantallaCompleta(
    elemento: HTMLElement
  ): Promise<void> {
    try {
      if (document.fullscreenElement === elemento) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
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
    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id ?? null;

    this.changeDetector.markForCheck();
  }

  constructor(
    private formBuilder: FormBuilder,
    private requirementSlaService: RequirementSlaService,
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>
  ) { }


  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }



  ngOnDestroy(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }
    this.versionDashboard++;
    this.solicitudOpcionesProyectos++;
    this.solicitudTickets++;
  }



  cargarDashboard(): void {

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    this.versionDashboard++;
    this.paginaTickets = 1;

    this.cargarKpis();
    this.cargarSlaSolucionTendencia();
    this.cargarVolumenRequerimientos();
    this.cargarProyectos();
    this.cargarParticipacionProyectos();
    this.cargarParetoRequerimientos();
    this.cargarTendenciaRequerimientos();
    this.cargarResolutores();

    this.cargarExploradorTipos();
    this.cargarDistribucionCondicionDia();
    this.cargarPorcentajeCumplimientoSla();
    this.cargarCumplimientoSlaHorario();
    this.cargarCumplimientoSlaPrioridad();
    this.cargarTop10CumplimientoSlaCategoria();
    this.cargarCumplimientoSlaTipo();
    this.cargarParetoSlaCategorias();
    this.cargarParetoSlaCategoriasGrafico();
    this.cargarTickets();

  }


  crearFormularioFiltros(): void {

    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],
      //feat/mejoras-analisis-incidentes-gpt
      grupo_resolutor: [this.grupoResolutorPorDefecto],
      prioridad: [null],
      categoria: [null],
      condicion_dia: [null]
    });

  }

  cargarOpcionesFiltros(): void {
    this.cargandoFiltros = true;
    this.requirementSlaService
      .obtenerFiltros()
      .subscribe({
        next: (data) => {
          this.opcionesFiltros = data;
          this.cargandoFiltros = false;
          this.establecerFechasPorDefecto();
          this.cargarOpcionesProyectos();
          this.cargarDashboard();
          this.changeDetector.markForCheck();

        },
        error: (error) => {
          console.error('Error obteniendo filtros de requerimientos:', error);
          this.cargandoFiltros = false;
          this.changeDetector.markForCheck();
          this.cargarDashboard();

        }
      });
  }



  aplicarFiltros(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const valores = this.filtrosForm.value;

    this.filtrosActuales = {
      ...this.filtrosActuales,

      desde: valores.desde
        ? this.formatearFecha(valores.desde)
        : undefined,

      hasta: valores.hasta
        ? this.formatearFecha(valores.hasta)
        : undefined,

      grupo_resolutor: valores.grupo_resolutor || undefined,
      prioridad: valores.prioridad || undefined,
      categoria: valores.categoria || undefined,
      condicion_dia: (valores.condicion_dia as RequirementSLACondicionDia | null) ?? undefined,

      proyecto: undefined,
      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined,

      sla_solucion_condicion: this.slaSolucionSeleccionada ?? undefined,
      periodo: undefined,
      ticket_id: undefined
    };

    this.proyectoSeleccionado = null;
    this.periodoSeleccionado = null;
    this.ticketIdSeleccionado = null;

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  limpiarFiltros(): void {

    // feat/mejoras-analisis-incidentes-gpt
    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      grupo_resolutor: this.grupoResolutorPorDefecto,
      prioridad: null,
      categoria: null,
      condicion_dia: null
    });

    // feat/mejoras-analisis-incidentes-gpt
    this.filtrosActuales = {
      grupo_resolutor: this.grupoResolutorPorDefecto
    };

    this.proyectosExcluidos = [];
    this.establecerFechasPorDefecto();
    this.proyectoSeleccionado = null;
    this.slaSolucionSeleccionada = null;
    this.tiposRequerimientoSeleccionados = [];
    this.periodoSeleccionado = null;
    this.ticketIdSeleccionado = null;
    this.cargarOpcionesProyectos();
    this.cargarDashboard();

  }


  cargarKpis(): void {
    const versionActual = this.versionDashboard;
    this.cargandoKpis = true;
    this.requirementSlaService
      .obtenerKpis(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.kpis = data;
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo KPIs de requerimientos:', error);
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  cargarSlaSolucionTendencia(): void {
    const versionActual = this.versionDashboard;
    this.cargandoSlaSolucionTendencia = true;
    this.requirementSlaService.obtenerSlaSolucionTendencia(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.slaSolucionTendencia = data;
          this.cargandoSlaSolucionTendencia = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo SLA Solución:', error);
          this.cargandoSlaSolucionTendencia = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarVolumenRequerimientos(): void {

    const versionActual = this.versionDashboard;

    this.cargandoVolumenRequerimientos = true;

    // Conservar todos los filtros excepto el mes
    const filtrosBase: RequirementSLADashboardFilters = {
      ...this.filtrosActuales,
      periodo: undefined
    };

    this.requirementSlaService
      .obtenerVolumenRequerimientos(filtrosBase)
      .subscribe({

        next: (data) => {

          if (versionActual !== this.versionDashboard) {
            return;
          }

          this.volumenRequerimientos = data;
          this.cargandoVolumenRequerimientos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (versionActual !== this.versionDashboard) {
            return;
          }

          console.error(
            'Error obteniendo volumen de requerimientos:',
            error
          );

          this.volumenRequerimientos = [];
          this.cargandoVolumenRequerimientos = false;

          this.changeDetector.markForCheck();
        }
      });
  }


  cargarProyectos(): void {
    const versionActual = this.versionDashboard;
    this.cargandoProyectos = true;
    this.requirementSlaService.obtenerProyectos(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.proyectos = data;
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo proyectos de requerimientos:', error);
          this.proyectos = [];
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarParticipacionProyectos(): void {
    const versionActual = this.versionDashboard;
    this.cargandoParticipacionProyectos = true;
    this.requirementSlaService.obtenerParticipacionProyectos(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.participacionProyectos = data;
          this.cargandoParticipacionProyectos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo participación por proyecto:', error);
          this.participacionProyectos = [];
          this.cargandoParticipacionProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarParetoRequerimientos(): void {
    const versionActual = this.versionDashboard;
    this.cargandoParetoRequerimientos = true;
    this.requirementSlaService.obtenerParetoRequerimientos(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.paretoRequerimientos = data;
          this.cargandoParetoRequerimientos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo Pareto de requerimientos:', error);
          this.paretoRequerimientos = [];
          this.cargandoParetoRequerimientos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarTendenciaRequerimientos(): void {
    const versionActual = this.versionDashboard;
    this.cargandoTendenciaRequerimientos = true;
    this.requirementSlaService.obtenerTendenciaRequerimientos(
      this.rankingTendenciaDesde,
      this.rankingTendenciaHasta,
      this.filtrosActuales
    )
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.tendenciaRequerimientos = data;
          this.cargandoTendenciaRequerimientos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo tendencia de requerimientos:', error);
          this.tendenciaRequerimientos = [];
          this.cargandoTendenciaRequerimientos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarRankingTendencia(rango: { desde: number; hasta: number; }): void {
    this.rankingTendenciaDesde = rango.desde;
    this.rankingTendenciaHasta = rango.hasta;
    this.cargarTendenciaRequerimientos();
  }

  cargarResolutores(): void {
    const versionActual = this.versionDashboard;
    this.cargandoResolutores = true;
    this.requirementSlaService.obtenerResolutores(this.filtrosActuales)
      .subscribe({
        next: (data) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          this.resolutores = data;
          this.cargandoResolutores = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (versionActual !== this.versionDashboard) {
            return;
          }
          console.error('Error obteniendo resolutores de requerimientos:', error);
          this.resolutores = [];
          this.cargandoResolutores = false;
          this.changeDetector.markForCheck();
        }
      });
  }



  // Filtro de Proyectos
  cargarOpcionesProyectos(): void {

    const solicitudActual = ++this.solicitudOpcionesProyectos;


    const filtrosBase: RequirementSLADashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      proyectos_excluidos: undefined,
      ticket_id: undefined
    };


    this.requirementSlaService
      .obtenerProyectos(filtrosBase)
      .subscribe({

        next: (data) => {

          if (solicitudActual !== this.solicitudOpcionesProyectos) {
            return;
          }

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

    // SI EL PROYECTO SELECCIONADO ESTABA EXCLUIDO,
    // VOLVER A INCLUIRLO.
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

    // Validar el período YYYY-MM
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

    // Actualizar el mes seleccionado
    this.periodoSeleccionado = periodo;

    // Conservar los demás filtros activos
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


  // FILTRO DINAMICO - SLA SOLUCION CONDICION
  seleccionarSlaSolucion(condicion: RequirementSLASolucionCondicion | null): void {
    const nuevaSeleccion =
      this.slaSolucionSeleccionada === condicion
        ? null
        : condicion;

    if (this.slaSolucionSeleccionada === nuevaSeleccion) {
      return;
    }
    this.slaSolucionSeleccionada = nuevaSeleccion;
    this.filtrosActuales = {
      ...this.filtrosActuales,

      sla_solucion_condicion:
        nuevaSeleccion ?? undefined
    };

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  // LIMPIAR SOLAMENTE EL FILTRO DINAMICO SLA
  limpiarSeleccionSla(): void {
    if (this.slaSolucionSeleccionada === null) {
      return;
    }
    this.seleccionarSlaSolucion(null);
  }

  // METODO GENERICO PARA CARGAR NUEVOS GRAFICOS
  private cargarVisualNuevo<T>(
    clave: NuevoVisualSla,
    peticion: Observable<T>,
    asignar: (datos: T | null) => void
  ): void {
    const versionActual = this.versionDashboard;
    this.cargandoNuevosGraficos[clave] = true;
    delete this.erroresNuevosGraficos[clave];
    peticion.subscribe({
      next: (datos) => {
        // IGNORAR RESPUESTAS DE FILTROS ANTERIORES
        if (versionActual !== this.versionDashboard) {
          return;
        }
        asignar(datos);
        this.cargandoNuevosGraficos[clave] = false;
        this.changeDetector.markForCheck();
      },

      error: (error) => {
        if (versionActual !== this.versionDashboard) {
          return;
        }
        console.error(`Error cargando ${clave}:`, error);
        asignar(null);
        this.erroresNuevosGraficos[clave] = `No se pudieron cargar los datos de ${clave}.`;
        this.cargandoNuevosGraficos[clave] = false;
        this.changeDetector.markForCheck();
      }

    });
  }

  // GRAFICO 1 - EXPLORADOR DE TIPOS
  cargarExploradorTipos(): void {
    this.cargarVisualNuevo(
      'exploradorTipos',
      this.requirementSlaService.obtenerExploradorTipos(
        this.filtrosActuales
      ),
      datos => this.exploradorTipos = datos
    );
  }

  // GRAFICO 2 - DISTRIBUCION CONDICION DIA
  cargarDistribucionCondicionDia(): void {
    this.cargarVisualNuevo(
      'distribucionCondicionDia',

      this.requirementSlaService.obtenerDistribucionCondicionDia(
        this.filtrosActuales
      ),

      datos => this.distribucionCondicionDia = datos
    );
  }

  // GRAFICO 3 - PORCENTAJE CUMPLIMIENTO SLA
  cargarPorcentajeCumplimientoSla(): void {
    this.cargarVisualNuevo(
      'porcentajeCumplimientoSla',
      this.requirementSlaService.obtenerPorcentajeCumplimientoSla(
        this.filtrosActuales
      ),
      datos => this.porcentajeCumplimientoSla = datos
    );
  }

  // GRAFICO 4 - CUMPLIMIENTO SLA HORARIO
  cargarCumplimientoSlaHorario(): void {
    this.cargarVisualNuevo(
      'cumplimientoSlaHorario',
      this.requirementSlaService.obtenerCumplimientoSlaHorario(
        this.filtrosActuales
      ),
      datos => this.cumplimientoSlaHorario = datos
    );
  }
  // GRAFICO 5 - CUMPLIMIENTO SLA PRIORIDAD
  cargarCumplimientoSlaPrioridad(): void {
    this.cargarVisualNuevo(
      'cumplimientoSlaPrioridad',
      this.requirementSlaService.obtenerCumplimientoSlaPrioridad(
        this.filtrosActuales
      ),
      datos => this.cumplimientoSlaPrioridad = datos
    );
  }

  // GRAFICO 6 - TOP 10 CATEGORIAS
  cargarTop10CumplimientoSlaCategoria(): void {
    this.cargarVisualNuevo(
      'top10CumplimientoSlaCategoria',
      this.requirementSlaService.obtenerTop10CumplimientoSlaCategoria(
        this.filtrosActuales
      ),
      datos => this.top10CumplimientoSlaCategoria = datos
    );
  }
  // GRAFICO 7 - CUMPLIMIENTO SLA POR TIPO
  cargarCumplimientoSlaTipo(): void {
    this.cargarVisualNuevo(
      'cumplimientoSlaTipo',
      this.requirementSlaService.obtenerCumplimientoSlaTipo(
        this.filtrosActuales,
        5
      ),
      datos => this.cumplimientoSlaTipo = datos
    );
  }
  // GRAFICO 8 - TABLA ANALITICA PARETO
  cargarParetoSlaCategorias(): void {
    this.cargarVisualNuevo(
      'paretoSlaCategorias',
      this.requirementSlaService.obtenerParetoSlaCategorias(
        this.filtrosActuales
      ),
      datos => this.paretoSlaCategorias = datos
    );
  }
  // GRAFICO 9 - PARETO COMBINADO
  cargarParetoSlaCategoriasGrafico(): void {
    this.cargarVisualNuevo(
      'paretoSlaCategoriasGrafico',
      this.requirementSlaService.obtenerParetoSlaCategoriasGrafico(
        this.filtrosActuales
      ),
      datos => this.paretoSlaCategoriasGrafico = datos
    );
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
      { desde, hasta }, { emitEvent: false }
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



  irASeccion(idSeccion: string): void {
    const contenedor = this.elementRef.nativeElement;
    const seccion = contenedor.querySelector<HTMLElement>(
      `#${idSeccion}`
    );
    const headerMaster = contenedor.querySelector<HTMLElement>(
      '.header-master'
    );
    if (!seccion || !headerMaster) {
      return;
    }
    const alturaHeader = Math.ceil(
      headerMaster.getBoundingClientRect().height
    );
    seccion.style.scrollMarginTop =
      `${alturaHeader + 20}px`;

    seccion.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  }



  seleccionarTiposRequerimiento(tipos: string[]): void {
    const nuevosTipos = [
      ...new Set(
        tipos
          .map(tipo => tipo.trim())
          .filter(tipo => tipo.length > 0)
      )
    ];

    if (
      nuevosTipos.length === this.tiposRequerimientoSeleccionados.length &&
      nuevosTipos.every(tipo => this.tiposRequerimientoSeleccionados.includes(tipo))
    ) {
      return;
    }

    this.tiposRequerimientoSeleccionados = nuevosTipos;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      tipo_requerimiento: nuevosTipos.length
        ? [...nuevosTipos]
        : undefined
    };

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
    this.changeDetector.markForCheck();
  }

  limpiarSeleccionTiposRequerimiento(): void {
    if (!this.tiposRequerimientoSeleccionados.length) {
      return;
    }

    this.seleccionarTiposRequerimiento([]);
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

    // EVITAR CONFLICTO CON EL PROYECTO INDIVIDUAL
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

    // INVALIDAR RESPUESTAS CON FILTROS ANTERIORES
    this.versionDashboard++;

    // AGRUPAR CAMBIOS RAPIDOS DE LOS CHECKBOXES
    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
    }

    this.temporizadorExclusiones = setTimeout(() => {

      this.temporizadorExclusiones = null;

      // ACTUALIZAR LOS 17 ELEMENTOS DEL DASHBOARD
      this.cargarDashboard();

    }, 300);

    this.changeDetector.markForCheck();
  }





  // ====================================================
  // CARGAR TABLA PAGINADA - REQUERIMIENTOS SLA
  // ====================================================

  cargarTickets(): void {

    const versionActual = this.versionDashboard;
    const solicitudActual = ++this.solicitudTickets;

    this.cargandoTickets = true;
    this.errorTickets = null;

    this.requirementSlaService
      .obtenerTickets(
        { ...this.filtrosActuales },
        this.paginaTickets,
        this.tamanoTickets
      )
      .subscribe({

        next: (data) => {

          // IGNORAR RESPUESTAS DE FILTROS O PÁGINAS ANTERIORES
          if (
            versionActual !== this.versionDashboard ||
            solicitudActual !== this.solicitudTickets
          ) {
            return;
          }

          this.ticketsDetalle = data;
          this.cargandoTickets = false;
          this.errorTickets = null;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            versionActual !== this.versionDashboard ||
            solicitudActual !== this.solicitudTickets
          ) {
            return;
          }

          console.error(
            'Error obteniendo tabla de Requerimientos SLA:',
            error
          );

          this.ticketsDetalle = null;
          this.cargandoTickets = false;

          this.errorTickets =
            'No se pudieron cargar los tickets de Requerimientos SLA.';

          this.changeDetector.markForCheck();
        }

      });
  }


  // PAGINACIÓN - EXPLORADOR DE TICKETS
  cambiarPaginaTickets(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (this.paginaTickets === evento.pagina && this.tamanoTickets === evento.tamano) {
      return;
    }

    this.paginaTickets = evento.pagina;
    this.tamanoTickets = evento.tamano;
    this.cargarTickets();
  }

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



}