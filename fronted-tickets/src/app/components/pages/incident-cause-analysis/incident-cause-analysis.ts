
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';

import {
  MAT_DATE_LOCALE,
  MatDateFormats,
  provideNativeDateAdapter
} from '@angular/material/core';

import { Subscription } from 'rxjs';

import {
  IncidentConsolidatedFilters,
  IncidentConsolidatedDashboardFilters,
  IncidentConsolidatedKPI,
  IncidentConsolidatedAtribucionOut,
  IncidentConsolidatedTopServidoresOut,
  IncidentConsolidatedAnalisisCausasOut,
  IncidentConsolidatedDistribucionAjustadaOut,
  IncidentConsolidatedPrincipalesHallazgosOut,
  IncidentConsolidatedConclusionesOut
} from '../../../models/incident-consolidated';

import {
  IncidentConsolidatedService
} from '../../../services/incident-consolidated.service';


// ==========================================================
// FORMATOS DE FECHA - PERU
// ==========================================================

const FORMATOS_FECHA: MatDateFormats = {
  parse: {
    dateInput: null
  },
  display: {
    dateInput: {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    },
    monthYearLabel: {
      month: 'short',
      year: 'numeric'
    },
    dateA11yLabel: {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    },
    monthYearA11yLabel: {
      month: 'long',
      year: 'numeric'
    }
  }
};


@Component({
  selector: 'app-incident-cause-analysis',
  standalone: false,
  templateUrl: './incident-cause-analysis.html',
  styleUrl: './incident-cause-analysis.css',
  providers: [
    {
      provide: MAT_DATE_LOCALE,
      useValue: 'es-PE'
    },
    provideNativeDateAdapter(FORMATOS_FECHA)
  ]
})
export class IncidentCauseAnalysis implements OnInit, OnDestroy {

  // ========================================================
  // 1. FILTROS GLOBALES
  // ========================================================

  filtrosForm!: FormGroup;

  filtrosActuales: IncidentConsolidatedDashboardFilters = {};

  opcionesFiltros: IncidentConsolidatedFilters = {
    fecha_min: null,
    fecha_max: null,
    prioridades: [],
    motivos_estado: [],
    motivos_resolucion: [],
    grupos_resolutores: [],
    proyectos: [],
    nombres_resolutores: [],
    tipos_incidente: []
  };

  cargandoFiltros = false;
  errorFiltros: string | null = null;

  // ========================================================
  // 2. KPIS
  // ========================================================

  kpis: IncidentConsolidatedKPI | null = null;

  cargandoKpis = false;
  errorKpis: string | null = null;

  // ========================================================
  // 3. DATOS DE GRAFICOS Y TABLAS
  // Se conectaran cuando creemos los componentes hijos.
  // ========================================================

  atribucionIncidentes: IncidentConsolidatedAtribucionOut | null = null;

  distribucionAjustada: IncidentConsolidatedDistribucionAjustadaOut | null = null;

  analisisCausas: IncidentConsolidatedAnalisisCausasOut | null = null;

  topServidores: IncidentConsolidatedTopServidoresOut | null = null;




  // ========================================================
  // ANALISIS DE CAUSAS V3
  // ========================================================

  cargandoAnalisisCausas = false;
  errorAnalisisCausas: string | null = null;


  // ========================================================
  // TOP DE SERVIDORES
  // ========================================================

  cargandoTopServidores = false;
  errorTopServidores: string | null = null;

  limiteTopServidores = 5;

  private suscripcionTopServidores: Subscription | null = null;



  // ========================================================
  // GRAFICOS DE ATRIBUCION
  // ========================================================

  cargandoAtribucion = false;
  errorAtribucion: string | null = null;

  atribucionSeleccionada: string | null = null;


  // ========================================================
  // 4. PRINCIPALES HALLAZGOS - DENTRO DEL PADRE
  // ========================================================

  principalesHallazgos: IncidentConsolidatedPrincipalesHallazgosOut | null = null;

  cargandoHallazgos = false;
  errorHallazgos: string | null = null;

  // ========================================================
  // 5. CONCLUSIONES - DENTRO DEL PADRE
  // ========================================================

  conclusiones: IncidentConsolidatedConclusionesOut | null = null;

  cargandoConclusiones = false;
  errorConclusiones: string | null = null;

  // ========================================================
  // 6. CONTROL DE PETICIONES
  // ========================================================

  private suscripcionFiltros: Subscription | null = null;
  private solicitudesDashboard = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private incidentConsolidatedService: IncidentConsolidatedService,
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>
  ) { }


  // ========================================================
  // 7. CICLO DE VIDA
  // ========================================================

  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.suscripcionFiltros?.unsubscribe();
    this.solicitudesDashboard.unsubscribe();
  }


  // ========================================================
  // 8. CREAR FORMULARIO
  // ========================================================

  crearFormularioFiltros(): void {

    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],

      prioridad: [null],
      motivo_estado: [null],
      motivo_resolucion: [null],
      grupo_resolutor: [null],

      proyecto: [null],
      nombre_resolutor: [null],

      tipo_incidente: [[]],

      ticket_id: ['']
    });
  }


  // ========================================================
  // 9. OBTENER OPCIONES DE FILTROS
  // ========================================================

  cargarOpcionesFiltros(): void {

    this.suscripcionFiltros?.unsubscribe();

    this.cargandoFiltros = true;
    this.errorFiltros = null;

    this.suscripcionFiltros = this.incidentConsolidatedService
      .obtenerFiltros()
      .subscribe({

        next: (data) => {

          this.opcionesFiltros = data;

          this.cargandoFiltros = false;

          this.establecerFechasPorDefecto();


          this.cargarDashboard();

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo filtros de análisis de incidentes:',
            error
          );

          this.cargandoFiltros = false;

          this.errorFiltros =
            'No se pudieron cargar las opciones de filtros.';

          this.changeDetector.markForCheck();
        }
      });
  }


  // ========================================================
  // 10. FECHAS POR DEFECTO
  // ========================================================

  private convertirFecha(fecha: string | null): Date | null {

    if (!fecha) {
      return null;
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);

    return new Date(anio, mes - 1, dia);
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
      {
        emitEvent: false
      }
    );

    this.filtrosActuales = {
      ...this.filtrosActuales,

      desde: this.formatearFecha(desde),
      hasta: this.formatearFecha(hasta)
    };
  }


  // ========================================================
  // 11. APLICAR FILTROS
  // ========================================================

  aplicarFiltros(): void {

    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const valores = this.filtrosForm.getRawValue();

    const desde = this.formatearFecha(valores.desde);
    const hasta = this.formatearFecha(valores.hasta);

    if (desde && hasta && desde > hasta) {

      this.errorFiltros =
        'La fecha Desde no puede ser posterior a la fecha Hasta.';

      return;
    }

    this.errorFiltros = null;

    const tipos = Array.isArray(valores.tipo_incidente)
      ? [...new Set(
        (valores.tipo_incidente as string[])
          .map(tipo => tipo.trim())
          .filter(tipo => tipo.length > 0)
      )]
      : [];

    this.filtrosActuales = {
      desde,
      hasta,

      prioridad: valores.prioridad || undefined,
      motivo_estado: valores.motivo_estado || undefined,
      motivo_resolucion: valores.motivo_resolucion || undefined,
      grupo_resolutor: valores.grupo_resolutor || undefined,

      proyecto: valores.proyecto || undefined,
      nombre_resolutor: valores.nombre_resolutor || undefined,

      tipo_incidente: tipos.length ? tipos : undefined,

      ticket_id: valores.ticket_id?.trim() || undefined
    };



    const motivoSeleccionado = valores.motivo_resolucion;

    this.atribucionSeleccionada =
      motivoSeleccionado === 'Atribuible a Cliente' ||
        motivoSeleccionado === 'Atribuible a Canvia'
        ? motivoSeleccionado
        : null;


    this.cargarDashboard();
  }


  // ========================================================
  // 12. LIMPIAR FILTROS
  // ========================================================

  limpiarFiltros(): void {

    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      prioridad: null,
      motivo_estado: null,
      motivo_resolucion: null,
      grupo_resolutor: null,
      proyecto: null,
      nombre_resolutor: null,
      tipo_incidente: [],
      ticket_id: ''
    });

    this.filtrosActuales = {};
    this.errorFiltros = null;

    this.establecerFechasPorDefecto();


    this.atribucionSeleccionada = null;

    this.cargarDashboard();
  }


  // ========================================================
  // 13. CARGAR DASHBOARD
  // ========================================================

  cargarDashboard(): void {

    // Cancelar respuestas anteriores cuando cambian filtros.
    this.solicitudesDashboard.unsubscribe();
    this.solicitudesDashboard = new Subscription();

    // Copia de filtros aplicada a todas las consultas.
    const filtros: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      tipo_incidente: this.filtrosActuales.tipo_incidente
        ? [...this.filtrosActuales.tipo_incidente]
        : undefined
    };

    // Limpiar los resultados anteriores.
    this.kpis = null;
    this.principalesHallazgos = null;
    this.conclusiones = null;

    // Invalidar datos de futuros gráficos y tablas.
    this.atribucionIncidentes = null;
    this.distribucionAjustada = null;
    this.analisisCausas = null;
    this.topServidores = null;

    this.errorKpis = null;
    this.errorHallazgos = null;
    this.errorConclusiones = null;



    //this.cargarKpis(filtros);

    // Atribución original y ajustada
    this.cargarAtribucion(filtros);

    // Análisis de causas V3
    this.cargarAnalisisCausas(filtros);

    // Top de servidores
    this.cargarTopServidores(filtros);

    // Insights dentro del padre
    this.cargarPrincipalesHallazgos(filtros);
    this.cargarConclusiones(filtros);



    this.changeDetector.markForCheck();
  }


  // ========================================================
  // 14. CARGAR KPIS
  // ========================================================

  private cargarKpis(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoKpis = true;

    const solicitud = this.incidentConsolidatedService
      .obtenerKpis(filtros)
      .subscribe({

        next: (data) => {

          this.kpis = data;
          this.cargandoKpis = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error('Error cargando KPIs:', error);

          this.kpis = null;
          this.cargandoKpis = false;

          this.errorKpis =
            'No se pudieron cargar los indicadores.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // 15. CARGAR PRINCIPALES HALLAZGOS
  // ========================================================

  private cargarPrincipalesHallazgos(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoHallazgos = true;

    const solicitud = this.incidentConsolidatedService
      .obtenerPrincipalesHallazgos(filtros, false)
      .subscribe({

        next: (data) => {

          this.principalesHallazgos = data;
          this.cargandoHallazgos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error cargando principales hallazgos:',
            error
          );

          this.principalesHallazgos = null;
          this.cargandoHallazgos = false;

          this.errorHallazgos =
            'No se pudieron cargar los principales hallazgos.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // 16. CARGAR CONCLUSIONES
  // ========================================================

  private cargarConclusiones(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoConclusiones = true;

    const solicitud = this.incidentConsolidatedService
      .obtenerConclusiones(filtros, false)
      .subscribe({

        next: (data) => {

          this.conclusiones = data;
          this.cargandoConclusiones = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error cargando conclusiones:',
            error
          );

          this.conclusiones = null;
          this.cargandoConclusiones = false;

          this.errorConclusiones =
            'No se pudieron cargar las conclusiones.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // 17. VALOR DE UN HALLAZGO PARA LOS KPIS
  // ========================================================


  obtenerValorHallazgo(codigo: string): number | string {

    // El backend todavía está procesando
    if (this.cargandoHallazgos) {
      return '...';
    }

    // La petición falló
    if (this.errorHallazgos) {
      return 'Error';
    }

    // Aún no se han obtenido resultados
    if (!this.principalesHallazgos) {
      return '—';
    }

    const hallazgo = this.principalesHallazgos.hallazgos.find(
      item => item.codigo === codigo
    );

    // Algunos hallazgos se omiten cuando su conteo es cero
    return hallazgo?.valor ?? 0;
  }



  // ========================================================
  // 18. ESTADO DE AJUSTES
  // ========================================================

  get estadoAjuste(): string | null {

    return (
      this.principalesHallazgos?.estado_ajuste ??
      this.conclusiones?.estado_ajuste ??
      null
    );
  }


  get descripcionEstadoAjuste(): string {

    if (this.estadoAjuste === 'PENDIENTE_REGLAS_APROBADAS') {
      return 'Ajustes pendientes de reglas aprobadas';
    }

    return this.estadoAjuste ?? 'Sin información de ajustes';
  }


  // ========================================================
  // 19. NAVEGACION INTERNA
  // ========================================================

  irASeccion(idSeccion: string): void {

    const contenedor = this.elementRef.nativeElement;

    const seccion = contenedor.querySelector<HTMLElement>(
      `#${idSeccion}`
    );

    const headerMaster = contenedor.querySelector<HTMLElement>(
      '.header-master'
    );

    if (!seccion) {
      return;
    }

    const alturaHeader = headerMaster
      ? Math.ceil(
        headerMaster.getBoundingClientRect().height
      )
      : 0;

    seccion.style.scrollMarginTop =
      `${alturaHeader + 20}px`;

    seccion.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  }



  // ========================================================
  // CARGAR DISTRIBUCION ORIGINAL Y AJUSTADA
  // ========================================================

  private cargarAtribucion(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoAtribucion = true;
    this.errorAtribucion = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerDistribucionAjustadaCausas(filtros)
      .subscribe({

        next: (data) => {

          // Datos para el grafico comparativo
          this.distribucionAjustada = data;

          // Reutilizar los datos originales de la
          // misma respuesta, sin otra consulta HTTP.
          this.atribucionIncidentes = {
            total_tickets: data.total_tickets,

            total_atribuidos:
              data.total_atribuidos_original,

            sin_atribucion:
              data.sin_atribucion_original,

            distribucion: data.distribucion_original.map(
              item => ({ ...item })
            )
          };

          this.cargandoAtribucion = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo distribución de atribución:',
            error
          );

          this.atribucionIncidentes = null;
          this.distribucionAjustada = null;

          this.cargandoAtribucion = false;

          this.errorAtribucion =
            'No se pudo cargar la distribución de atribución.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // FILTRO DINAMICO POR ATRIBUCION
  // ========================================================

  cambiarAtribucion(atribucion: string | null): void {

    // Solo permitir las dos atribuciones reconocidas
    // por el backend.
    if (
      atribucion !== null &&
      atribucion !== 'Atribuible a Cliente' &&
      atribucion !== 'Atribuible a Canvia'
    ) {
      return;
    }

    if (this.atribucionSeleccionada === atribucion) {
      return;
    }

    this.atribucionSeleccionada = atribucion;

    // Sincronizar con el formulario de filtros
    this.filtrosForm.patchValue(
      {
        motivo_resolucion: atribucion
      },
      {
        emitEvent: false
      }
    );

    // Conservar todas las otras dimensiones filtradas.
    this.filtrosActuales = {
      ...this.filtrosActuales,
      motivo_resolucion: atribucion ?? undefined
    };

    this.cargarDashboard();
  }




  // ========================================================
  // CARGAR ANALISIS DE CAUSAS V3
  // ========================================================

  private cargarAnalisisCausas(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoAnalisisCausas = true;
    this.errorAnalisisCausas = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerAnalisisCausas(filtros)
      .subscribe({

        next: (data) => {

          this.analisisCausas = data;
          this.cargandoAnalisisCausas = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo análisis de causas:',
            error
          );

          this.analisisCausas = null;
          this.cargandoAnalisisCausas = false;

          this.errorAnalisisCausas =
            'No se pudo cargar el análisis de causas.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // CARGAR TOP DE SERVIDORES
  // ========================================================

  private cargarTopServidores(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    // Cancelar la consulta anterior del ranking,
    // por ejemplo al cambiar Top 5 por Top 20.
    this.suscripcionTopServidores?.unsubscribe();

    this.cargandoTopServidores = true;
    this.errorTopServidores = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerTopServidores(
        filtros,
        this.limiteTopServidores
      )
      .subscribe({

        next: (data) => {

          this.topServidores = data;
          this.cargandoTopServidores = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error obteniendo top de servidores:',
            error
          );

          this.topServidores = null;
          this.cargandoTopServidores = false;

          this.errorTopServidores =
            'No se pudo cargar el ranking de servidores.';

          this.changeDetector.markForCheck();
        }
      });

    this.suscripcionTopServidores = solicitud;

    this.solicitudesDashboard.add(solicitud);
  }


  // ========================================================
  // CAMBIAR LIMITE TOP SERVIDORES
  // ========================================================

  cambiarLimiteTopServidores(limite: number): void {

    if (
      ![5, 10, 20, 50].includes(limite) ||
      limite === this.limiteTopServidores
    ) {
      return;
    }

    this.limiteTopServidores = limite;

    // Solo recargar servidores.
    // No volver a consultar KPIs, causas ni insights.
    this.cargarTopServidores({
      ...this.filtrosActuales
    });
  }



  // ========================================================
  // TITULO DINAMICO - PROYECTO SELECCIONADO
  // ========================================================

  get proyectoTitulo(): string | null {

    const proyecto = this.filtrosActuales.proyecto?.trim();

    if (!proyecto) {
      return null;
    }

    // Ejemplo:
    // 105932 UNACEM PROY CL SERV INFRAESTR -> UNACEM
    // 106255 SEDAPAL PROY CLOUD SERV HOSTING -> SEDAPAL

    const sinCodigo = proyecto.replace(/^\d+\s+/, '');

    const coincidencia = sinCodigo.match(
      /^(.+?)\s+PROY\b/i
    );

    return coincidencia
      ? coincidencia[1].trim()
      : sinCodigo;
  }


  // ========================================================
  // SUBTITULO DINAMICO - TIPOS DE INCIDENTE
  // ========================================================

  get tiposIncidenteTitulo(): string | null {

    const tipos = this.filtrosActuales.tipo_incidente ?? [];

    if (tipos.length === 0) {
      return null;
    }

    return tipos
      .map(tipo => tipo.trim())
      .filter(tipo => tipo.length > 0)
      .join(' · ') || null;
  }




  // ========================================================
  // BUSCADORES DE FILTROS - PROYECTO Y TIPO DE INCIDENTE
  // ========================================================

  @ViewChild('buscadorProyecto')
  buscadorProyecto?: ElementRef<HTMLInputElement>;

  @ViewChild('buscadorTipoIncidente')
  buscadorTipoIncidente?: ElementRef<HTMLInputElement>;

  busquedaProyecto = '';
  busquedaTipoIncidente = '';


  // ========================================================
  // NORMALIZAR TEXTO PARA BUSQUEDA
  // ========================================================

  private normalizarBusqueda(texto: string): string {

    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }


  // ========================================================
  // FILTRAR OPCIONES DE PROYECTO
  // ========================================================

  get proyectosFiltrados(): string[] {

    const busqueda = this.normalizarBusqueda(
      this.busquedaProyecto
    );

    const seleccionado = this.filtrosForm
      ?.get('proyecto')?.value;

    return this.opcionesFiltros.proyectos.filter(
      proyecto => {

        // Mantener visible el proyecto seleccionado.
        if (proyecto === seleccionado) {
          return true;
        }

        return this.normalizarBusqueda(proyecto)
          .includes(busqueda);
      }
    );
  }


  // ========================================================
  // FILTRAR OPCIONES DE TIPO DE INCIDENTE
  // ========================================================

  get tiposIncidenteFiltrados(): string[] {

    const busqueda = this.normalizarBusqueda(
      this.busquedaTipoIncidente
    );

    const seleccion = this.filtrosForm
      ?.get('tipo_incidente')?.value;

    const seleccionados = new Set<string>(
      Array.isArray(seleccion) ? seleccion : []
    );

    return (
      this.opcionesFiltros.tipos_incidente ?? []
    ).filter(tipo => {

      // Conservar siempre las opciones seleccionadas
      // para no perder la seleccion multiple.
      if (seleccionados.has(tipo)) {
        return true;
      }

      return this.normalizarBusqueda(tipo)
        .includes(busqueda);
    });
  }


  // ========================================================
  // ACTUALIZAR BUSQUEDA
  // ========================================================

  buscarEnCombo(
    evento: Event,
    campo: 'proyecto' | 'tipo_incidente'
  ): void {

    const valor = (
      evento.target as HTMLInputElement
    ).value;

    if (campo === 'proyecto') {
      this.busquedaProyecto = valor;
    } else {
      this.busquedaTipoIncidente = valor;
    }
  }


  // ========================================================
  // ABRIR COMBO Y ENFOCAR BUSCADOR
  // ========================================================

  alAbrirCombo(
    campo: 'proyecto' | 'tipo_incidente',
    abierto: boolean
  ): void {

    if (!abierto) {
      return;
    }

    // Empezar con todas las opciones visibles.
    if (campo === 'proyecto') {
      this.busquedaProyecto = '';
    } else {
      this.busquedaTipoIncidente = '';
    }

    setTimeout(() => {

      const buscador = campo === 'proyecto'
        ? this.buscadorProyecto
        : this.buscadorTipoIncidente;

      buscador?.nativeElement.focus();

    }, 0);
  }


  // ========================================================
  // EVITAR QUE MAT-SELECT INTERCEPTE LA ESCRITURA
  // ========================================================

  detenerTeclasBusqueda(evento: KeyboardEvent): void {

    // Permitir cerrar el combo con Escape o Tab.
    if (
      evento.key !== 'Escape' &&
      evento.key !== 'Tab'
    ) {
      evento.stopPropagation();
    }
  }




}
