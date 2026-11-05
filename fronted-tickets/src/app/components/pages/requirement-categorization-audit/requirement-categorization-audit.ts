
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, timer, switchMap, takeUntil } from 'rxjs';
import { AuditRunCreate, AuditRun, AuditSummary, AuditTicketList, AuditResolver, AUDIT_GROUP_ID, AuditMonthlyStat, AuditResolutionReasonList, AuditDashboardFilters, AuditFilterOptions, AuditResultStatus } from '../../../models/requirement-categorization-audit';
import { RequirementCategorizationAuditService } from '../../../services/requirement-categorization-audit.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-requirement-categorization-audit',
  standalone: false,
  templateUrl: './requirement-categorization-audit.html',
  styleUrl: './requirement-categorization-audit.css'
})
export class RequirementCategorizationAudit implements OnInit, OnDestroy {

  readonly gruposResolutores: string[] = ['BASE DE DATOS Y EBS'];
  grupoResolutor = 'BASE DE DATOS Y EBS';

  // CONTROL DE SECCIONES DESPLEGABLES
  filtrosDesplegados = true;
  ejecucionDesplegada = false;

  alternarFiltros(): void {
    this.filtrosDesplegados = !this.filtrosDesplegados;
  }

  alternarEjecucion(): void {
    this.ejecucionDesplegada = !this.ejecucionDesplegada;
  }

  // FILTROS DEL DASHBOARD
  filtrosForm!: FormGroup;

  filtrosActuales: AuditDashboardFilters = {
    grupo_resolutor: 'BASE DE DATOS Y EBS'
  };

  opcionesFiltros: AuditFilterOptions = {
    group_id: AUDIT_GROUP_ID,
    audit_year: 2026,
    fecha_min: null,
    fecha_max: null,
    grupos_resolutores: [],
    proyectos: [],
    nombres_resolutores: [],
    meses: [],
    ticket_ids: []
  };

  cargandoFiltros = false;
  filtrosListos = false;
  errorFiltros: string | null = null;
  errorFormularioFiltros: string | null = null;

  formEjecucion!: FormGroup;
  errorFormularioEjecucion: string | null = null;

  ejecuciones: AuditRun[] = [];
  ejecucionActual: AuditRun | null = null;

  resumen: AuditSummary | null = null;
  tickets: AuditTicketList | null = null;
  resolutores: AuditResolver[] = [];
  estadisticasMensuales: AuditMonthlyStat[] = [];
  motivosResolucion: AuditResolutionReasonList | null = null;

  paginaActual = 1;
  tamanoPagina = 25;

  cargandoEstado = false;
  creandoAuditoria = false;
  cargandoResumen = false;
  cargandoTickets = false;
  cargandoResolutores = false;
  cargandoEstadisticasMensuales = false;
  cargandoMotivosResolucion = false;

  errorEjecucion: string | null = null;
  errorResumen: string | null = null;
  errorTickets: string | null = null;
  errorResolutores: string | null = null;
  errorEstadisticasMensuales: string | null = null;
  errorMotivosResolucion: string | null = null;

  mensajeEjecucion: string | null = null;
  sinResultados = false;

  private readonly destruir$ = new Subject<void>();
  private readonly cancelarSeguimiento$ = new Subject<void>();
  private readonly cancelarConsultaEstado$ = new Subject<void>();
  private readonly cancelarDatos$ = new Subject<void>();
  private readonly cancelarTickets$ = new Subject<void>();

  get ejecucionEnCurso(): boolean {
    return this.ejecucionActual?.status === 'PENDING' ||
      this.ejecucionActual?.status === 'RUNNING';
  }

  get cargandoDashboard(): boolean {
    return this.cargandoResumen ||
      this.cargandoTickets ||
      this.cargandoResolutores ||
      this.cargandoEstadisticasMensuales ||
      this.cargandoMotivosResolucion;
  }

  get porcentajeProgreso(): number {
    if (!this.ejecucionActual || this.ejecucionActual.total_tickets <= 0) {
      return 0;
    }

    const porcentaje = (
      this.ejecucionActual.processed_tickets /
      this.ejecucionActual.total_tickets
    ) * 100;

    return Math.max(0, Math.min(100, porcentaje));
  }

  constructor(
    private formBuilder: FormBuilder,
    private auditService: RequirementCategorizationAuditService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.crearFormularioEjecucion();
    this.crearFormularioFiltros();
    this.cargarEstadoEjecucion();
    this.cargarOpcionesFiltros(true);
  }

  crearFormularioEjecucion(): void {
    this.formEjecucion = this.formBuilder.group({
      grupo_resolutor: [this.grupoResolutor, Validators.required],
      desde: [null, Validators.required],
      hasta: [null, Validators.required]
    });
  }


  crearFormularioFiltros(): void {

    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],
      grupo_resolutor: [
        this.grupoResolutor,
        Validators.required
      ],
      proyecto: ['']
    });
  }


  // OBTENER OPCIONES COMPLETAS DEL BACKEND
  cargarOpcionesFiltros(inicial = false): void {

    this.cargandoFiltros = true;
    this.errorFiltros = null;

    this.auditService.obtenerOpcionesFiltrosAgrupados()
      .pipe(takeUntil(this.destruir$))
      .subscribe({

        next: (data) => {

          this.opcionesFiltros = data;
          this.cargandoFiltros = false;
          this.filtrosListos = true;

          if (inicial) {
            this.establecerFechasPorDefecto();
            this.cargarDashboard();
          }

          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            'Error obteniendo opciones de filtros:',
            error
          );

          this.cargandoFiltros = false;

          this.errorFiltros =
            'No se pudieron consultar las opciones de filtros.';

          // El dashboard puede funcionar sin cargar los buscadores.
          if (inicial) {
            this.cargarDashboard();
          }

          this.changeDetector.markForCheck();
        }
      });
  }


  // CONVERTIR YYYY-MM-DD A DATE
  private convertirFechaFiltro(
    valor: string | null
  ): Date | null {

    if (!valor) {
      return null;
    }

    const [anio, mes, dia] = valor.split('-').map(Number);

    if (!anio || !mes || !dia) {
      return null;
    }

    const fecha = new Date(anio, mes - 1, dia);

    return Number.isNaN(fecha.getTime())
      ? null
      : fecha;
  }


  // ESTABLECER RANGO COMPLETO DISPONIBLE
  private establecerFechasPorDefecto(): void {

    const desde = this.convertirFechaFiltro(
      this.opcionesFiltros.fecha_min
    );

    const hasta = this.convertirFechaFiltro(
      this.opcionesFiltros.fecha_max
    );

    this.filtrosForm.patchValue({
      desde,
      hasta,
      grupo_resolutor: this.grupoResolutor,
      proyecto: ''
    }, { emitEvent: false });

    this.filtrosActuales = {
      ...this.filtrosActuales,
      desde: desde
        ? this.formatearFechaEjecucion(desde)
        : undefined,
      hasta: hasta
        ? this.formatearFechaEjecucion(hasta)
        : undefined,
      grupo_resolutor: this.grupoResolutor,
      proyecto: undefined
    };
  }


  // APLICAR FILTROS GLOBALES
  aplicarFiltros(): void {

    this.errorFormularioFiltros = null;

    if (!this.filtrosListos || this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const valores = this.filtrosForm.getRawValue();

    const desde = valores.desde as Date | null;
    const hasta = valores.hasta as Date | null;

    const grupo = String(
      valores.grupo_resolutor ?? ''
    ).trim();

    const proyecto = String(
      valores.proyecto ?? ''
    ).trim();

    if (
      !desde ||
      !hasta ||
      !(desde instanceof Date) ||
      !(hasta instanceof Date) ||
      Number.isNaN(desde.getTime()) ||
      Number.isNaN(hasta.getTime())
    ) {
      this.errorFormularioFiltros =
        'Selecciona un rango de fechas válido.';
      return;
    }

    if (desde.getTime() > hasta.getTime()) {
      this.errorFormularioFiltros =
        'La fecha inicial no puede superar la fecha final.';
      return;
    }

    // Solo aceptar grupos existentes en la agrupación.
    if (!this.opcionesFiltros.grupos_resolutores.includes(grupo)) {
      this.errorFormularioFiltros =
        'Selecciona un grupo resolutor de la lista.';
      return;
    }

    // Evitar consultas por proyectos escritos incorrectamente.
    if (
      proyecto &&
      !this.opcionesFiltros.proyectos.includes(proyecto)
    ) {
      this.errorFormularioFiltros =
        'Selecciona un proyecto de la lista de opciones.';
      return;
    }

    // Conservamos los filtros dinámicos existentes.
    this.filtrosActuales = {
      ...this.filtrosActuales,
      desde: this.formatearFechaEjecucion(desde),
      hasta: this.formatearFechaEjecucion(hasta),
      grupo_resolutor: grupo,
      proyecto: proyecto || undefined
    };

    this.cargarDashboard();
    this.changeDetector.markForCheck();
  }


  // LIMPIAR FILTROS GLOBALES Y DINÁMICOS
  limpiarFiltrosDashboard(): void {

    this.errorFormularioFiltros = null;
    this.filtrosActuales = {};

    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      grupo_resolutor: this.grupoResolutor,
      proyecto: ''
    }, { emitEvent: false });

    this.establecerFechasPorDefecto();

    this.cargarDashboard();
    this.changeDetector.markForCheck();
  }



  // DONA: CORRECTAS / INCORRECTAS
  seleccionarResultado(
    resultado: AuditResultStatus | null
  ): void {

    const actual = this.filtrosActuales.resultado;

    const siguiente =
      resultado && actual !== resultado
        ? resultado
        : undefined;

    if (actual === siguiente) return;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      resultado: siguiente
    };

    this.cargarDashboard();
  }


  // DONA: MOTIVO RESOLUCIÓN
  seleccionarMotivoResolucion(
    motivo: AuditDashboardFilters['motivo_resolucion'] | null
  ): void {

    const actual = this.filtrosActuales.motivo_resolucion;

    const siguiente =
      motivo && actual !== motivo
        ? motivo
        : undefined;

    if (actual === siguiente) return;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      motivo_resolucion: siguiente
    };

    this.cargarDashboard();
  }


  // TABLA: MES
  seleccionarMes(mes: string | null): void {

    if (
      mes &&
      !this.opcionesFiltros.meses.includes(mes)
    ) return;

    const actual = this.filtrosActuales.mes;

    const siguiente =
      mes && actual !== mes ? mes : undefined;

    if (actual === siguiente) return;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      mes: siguiente
    };

    this.cargarDashboard();
  }


  // TABLA: COLABORADOR
  seleccionarResolutor(nombre: string | null): void {

    if (
      nombre &&
      !this.opcionesFiltros.nombres_resolutores.includes(nombre)
    ) return;

    const actual = this.filtrosActuales.nombre_resolutor;

    const siguiente =
      nombre && actual !== nombre
        ? nombre
        : undefined;

    if (actual === siguiente) return;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      nombre_resolutor: siguiente
    };

    this.cargarDashboard();
  }


  // TABLA: TICKET
  seleccionarTicket(ticketId: string | null): void {

    if (
      ticketId &&
      !this.opcionesFiltros.ticket_ids.includes(ticketId)
    ) return;

    const actual = this.filtrosActuales.ticket_id;

    const siguiente =
      ticketId && actual !== ticketId
        ? ticketId
        : undefined;

    if (actual === siguiente) return;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      ticket_id: siguiente
    };

    this.cargarDashboard();
  }


  ngOnDestroy(): void {
    this.cancelarSeguimiento$.next();
    this.cancelarSeguimiento$.complete();

    this.cancelarConsultaEstado$.next();
    this.cancelarConsultaEstado$.complete();

    this.cancelarDatos$.next();
    this.cancelarDatos$.complete();

    this.cancelarTickets$.next();
    this.cancelarTickets$.complete();

    this.destruir$.next();
    this.destruir$.complete();
  }

  cambiarGrupo(grupo: string): void {

    if (
      !this.gruposResolutores.includes(grupo) ||
      grupo === this.grupoResolutor
    ) {
      return;
    }

    this.cancelarSeguimiento$.next();
    this.cancelarConsultaEstado$.next();
    this.cancelarDatos$.next();
    this.cancelarTickets$.next();

    this.grupoResolutor = grupo;
    this.ejecuciones = [];
    this.ejecucionActual = null;

    this.formEjecucion.patchValue({
      grupo_resolutor: grupo
    });

    this.mensajeEjecucion = null;
    this.errorEjecucion = null;

    this.cargarDashboard();
    this.cargarEstadoEjecucion();
  }



  cargarEstadoEjecucion(): void {

    this.cancelarSeguimiento$.next();
    this.cancelarConsultaEstado$.next();

    this.cargandoEstado = true;
    this.errorEjecucion = null;

    this.auditService.obtenerEjecucionesAgrupadas(
      this.grupoResolutor
    )
      .pipe(
        takeUntil(this.cancelarConsultaEstado$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          const historial = [...data].sort(
            (a, b) => b.run_id - a.run_id
          );

          this.ejecuciones = historial;

          const activa = historial.find(
            item =>
              item.status === 'PENDING' ||
              item.status === 'RUNNING'
          );

          // La ejecución más reciente solo se utiliza
          // para mostrar su estado, nunca para filtrar KPIs.
          this.ejecucionActual =
            activa ?? historial[0] ?? null;

          this.cargandoEstado = false;

          if (
            this.ejecucionEnCurso &&
            this.ejecucionActual
          ) {
            this.iniciarSeguimiento(
              this.ejecucionActual.run_id
            );
          }

          this.changeDetector.markForCheck();
        },
        error: (error) => {

          console.error(
            'Error consultando ejecuciones agrupadas:',
            error
          );

          this.cargandoEstado = false;

          this.errorEjecucion = this.obtenerMensajeError(
            error,
            'No se pudo consultar el historial de auditorías.'
          );

          this.changeDetector.markForCheck();
        }
      });
  }



  ejecutarAuditoria(): void {
    if (this.creandoAuditoria || this.cargandoEstado || this.ejecucionEnCurso) {
      return;
    }

    this.errorFormularioEjecucion = null;
    this.errorEjecucion = null;
    this.mensajeEjecucion = null;

    if (this.formEjecucion.invalid) {
      this.formEjecucion.markAllAsTouched();
      this.errorFormularioEjecucion =
        'Selecciona el grupo resolutor y ambas fechas para ejecutar la auditoría.';
      this.changeDetector.markForCheck();
      return;
    }

    const valores = this.formEjecucion.getRawValue();

    const grupo = String(valores.grupo_resolutor ?? '').trim();
    const desde = valores.desde as Date | null;
    const hasta = valores.hasta as Date | null;

    if (!grupo || !this.gruposResolutores.includes(grupo)) {
      this.errorFormularioEjecucion = 'El grupo resolutor seleccionado no está habilitado.';
      this.changeDetector.markForCheck();
      return;
    }

    if (!desde || !hasta) {
      this.errorFormularioEjecucion = 'Selecciona ambas fechas o deja el rango vacío.';
      this.changeDetector.markForCheck();
      return;
    }

    if (
      (desde && (!(desde instanceof Date) || Number.isNaN(desde.getTime()))) ||
      (hasta && (!(hasta instanceof Date) || Number.isNaN(hasta.getTime())))
    ) {
      this.errorFormularioEjecucion = 'El rango de fechas contiene un valor inválido.';
      this.changeDetector.markForCheck();
      return;
    }

    if (desde && hasta && desde.getTime() > hasta.getTime()) {
      this.errorFormularioEjecucion = 'La fecha inicial no puede ser posterior a la fecha final.';
      this.changeDetector.markForCheck();
      return;
    }

    const datos: AuditRunCreate = {
      grupo_resolutor: grupo,
      group_id: AUDIT_GROUP_ID,
      period_from: this.formatearFechaEjecucion(desde),
      period_to: this.formatearFechaEjecucion(hasta)
    };

    this.creandoAuditoria = true;

    this.auditService.crearEjecucion(datos)
      .pipe(takeUntil(this.destruir$))
      .subscribe({
        next: (ejecucion) => {
          this.cancelarSeguimiento$.next();
          this.cancelarConsultaEstado$.next();

          this.ejecucionActual = ejecucion;
          this.creandoAuditoria = false;

          this.mensajeEjecucion = `La auditoría #${ejecucion.run_id} fue creada correctamente.`;

          if (ejecucion.status === 'PENDING' || ejecucion.status === 'RUNNING') {
            this.iniciarSeguimiento(ejecucion.run_id);
          } else if (ejecucion.status === 'COMPLETED') {
            this.cargarEstadoEjecucion();
            this.cargarDashboard();
            this.cargarOpcionesFiltros();
          }

          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error creando auditoría:', error);

          this.creandoAuditoria = false;

          this.errorEjecucion = this.obtenerMensajeError(
            error,
            'No fue posible crear la auditoría.'
          );

          this.changeDetector.markForCheck();
        }
      });
  }


  private formatearFechaEjecucion(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private iniciarSeguimiento(runId: number): void {
    this.cancelarSeguimiento$.next();
    this.errorEjecucion = null;

    timer(0, 5000)
      .pipe(
        switchMap(() =>
          this.auditService.obtenerEjecucion(runId, this.grupoResolutor)
        ),
        takeUntil(this.cancelarSeguimiento$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (ejecucion) => {
          this.ejecucionActual = ejecucion;

          if (ejecucion.status === 'COMPLETED') {
            this.cancelarSeguimiento$.next();

            this.mensajeEjecucion =
              `La auditoría #${runId} finalizó y sus resultados se incorporaron al acumulado.`;

            this.cargarEstadoEjecucion();
            this.cargarDashboard();
          }

          if (ejecucion.status === 'PARTIAL' || ejecucion.status === 'FAILED') {
            this.cancelarSeguimiento$.next();
            this.mensajeEjecucion = null;
            this.errorEjecucion = ejecucion.error_message ||
              `La auditoría #${runId} terminó con estado ${ejecucion.status}.`;
          }

          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error consultando progreso de auditoría:', error);
          this.errorEjecucion = this.obtenerMensajeError(
            error,
            'No se pudo actualizar el progreso. Puedes volver a consultar el estado.'
          );
          this.changeDetector.markForCheck();
        }
      });
  }

  actualizarEstado(): void {
    if (this.creandoAuditoria || this.cargandoEstado) {
      return;
    }

    this.cargarEstadoEjecucion();
    this.cargarOpcionesFiltros();
    this.cargarDashboard();
  }




  cargarDashboard(): void {

    // Cancelar consultas anteriores.
    this.cancelarDatos$.next();
    this.cancelarTickets$.next();

    // Reiniciar paginación.
    this.paginaActual = 1;

    // Limpiar resultados anteriores.
    this.resumen = null;
    this.tickets = null;
    this.resolutores = [];
    this.estadisticasMensuales = [];
    this.motivosResolucion = null;

    // Estados de carga.
    this.cargandoResumen = false;
    this.cargandoTickets = false;
    this.cargandoResolutores = false;
    this.cargandoEstadisticasMensuales = false;
    this.cargandoMotivosResolucion = false;

    // Errores.
    this.errorResumen = null;
    this.errorTickets = null;
    this.errorResolutores = null;
    this.errorEstadisticasMensuales = null;
    this.errorMotivosResolucion = null;

    this.sinResultados = false;

    // Consultar todos los reportes con los filtros actuales.
    this.cargarResumen();
    this.cargarResolutores();
    this.cargarTickets();
    this.cargarEstadisticasMensuales();
    this.cargarMotivosResolucion();

    this.changeDetector.markForCheck();
  }


  cargarEstadisticasMensuales(): void {

    this.cargandoEstadisticasMensuales = true;
    this.errorEstadisticasMensuales = null;
    this.estadisticasMensuales = [];

    this.auditService.obtenerEstadisticasMensualesAgrupadas(
      this.grupoResolutor,
      { ...this.filtrosActuales }
    )
      .pipe(
        takeUntil(this.cancelarDatos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          this.estadisticasMensuales = [...data.items].sort(
            (a, b) => a.month.localeCompare(b.month)
          );

          this.cargandoEstadisticasMensuales = false;

          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          this.cargandoEstadisticasMensuales = false;
          this.estadisticasMensuales = [];

          if (error.status !== 404) {

            console.error(
              'Error obteniendo estadísticas mensuales:',
              error
            );

            this.errorEstadisticasMensuales =
              'No se pudieron cargar las estadísticas mensuales.';
          }

          this.changeDetector.markForCheck();
        }
      });
  }



  cargarResumen(): void {

    this.cargandoResumen = true;
    this.errorResumen = null;
    this.resumen = null;

    this.auditService.obtenerResumenAgrupado(
      this.grupoResolutor,
      { ...this.filtrosActuales }
    )
      .pipe(
        takeUntil(this.cancelarDatos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          this.resumen = data;
          this.sinResultados = data.processed_tickets === 0;
          this.cargandoResumen = false;

          this.changeDetector.markForCheck();
        },
        error: (error: HttpErrorResponse) => {

          this.resumen = null;
          this.cargandoResumen = false;

          if (error.status === 404) {
            this.sinResultados = true;
          } else {
            console.error(
              'Error obteniendo resumen acumulado:',
              error
            );

            this.errorResumen =
              'No se pudieron cargar los indicadores acumulados.';
          }

          this.changeDetector.markForCheck();
        }
      });
  }


  cargarResolutores(): void {

    this.cargandoResolutores = true;
    this.errorResolutores = null;
    this.resolutores = [];

    this.auditService.obtenerResolutoresAgrupados(
      this.grupoResolutor,
      { ...this.filtrosActuales }
    )
      .pipe(
        takeUntil(this.cancelarDatos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          this.resolutores = [...data.items].sort(
            (a, b) =>
              (a.resolver_name ?? '').localeCompare(
                b.resolver_name ?? ''
              )
          );

          this.cargandoResolutores = false;
          this.changeDetector.markForCheck();
        },
        error: (error: HttpErrorResponse) => {

          this.cargandoResolutores = false;

          if (error.status !== 404) {
            console.error(
              'Error obteniendo resolutores acumulados:',
              error
            );

            this.errorResolutores =
              'No se pudieron cargar los resolutores acumulados.';
          }

          this.changeDetector.markForCheck();
        }
      });
  }



  cargarTickets(): void {

    this.cancelarTickets$.next();

    this.cargandoTickets = true;
    this.errorTickets = null;
    this.tickets = null;

    this.auditService.obtenerTicketsAgrupados({
      ...this.filtrosActuales,
      page: this.paginaActual,
      page_size: this.tamanoPagina
    })
      .pipe(
        takeUntil(this.cancelarTickets$),
        takeUntil(this.cancelarDatos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          this.tickets = data;
          this.cargandoTickets = false;

          this.changeDetector.markForCheck();
        },
        error: (error: HttpErrorResponse) => {

          this.cargandoTickets = false;

          if (error.status !== 404) {
            console.error(
              'Error obteniendo tickets acumulados:',
              error
            );

            this.errorTickets =
              'No se pudieron cargar los tickets acumulados.';
          }

          this.changeDetector.markForCheck();
        }
      });
  }



  cambiarPagina(
    pagina: number,
    tamano: number = 25
  ): void {

    if (
      pagina < 1 ||
      tamano < 1 ||
      tamano > 200
    ) {
      return;
    }

    this.paginaActual = pagina;
    this.tamanoPagina = tamano;

    this.cargarTickets();
  }


  // OBTENER MENSAJE DE ERROR DEL BACKEND
  private obtenerMensajeError(
    error: unknown,
    mensaje: string
  ): string {

    const respuesta = error as HttpErrorResponse;
    const detalle = respuesta?.error?.detail;

    if (typeof detalle === 'string' && detalle.trim()) {
      return detalle;
    }

    if (Array.isArray(detalle) && detalle.length > 0) {
      return detalle
        .map((item: { msg?: string }) => item.msg ?? 'Error de validación')
        .join('. ');
    }

    return mensaje;
  }




  cargarMotivosResolucion(): void {

    this.cargandoMotivosResolucion = true;
    this.errorMotivosResolucion = null;
    this.motivosResolucion = null;

    this.auditService.obtenerMotivosResolucionAgrupados(
      this.grupoResolutor,
      { ...this.filtrosActuales }
    )
      .pipe(
        takeUntil(this.cancelarDatos$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (data) => {

          this.motivosResolucion = data;
          this.cargandoMotivosResolucion = false;

          this.changeDetector.markForCheck();
        },

        error: (error: HttpErrorResponse) => {

          this.cargandoMotivosResolucion = false;
          this.motivosResolucion = null;

          console.error(
            'Error obteniendo motivos de resolución:',
            error
          );

          this.errorMotivosResolucion =
            'No se pudo cargar la distribución por motivo resolución.';

          this.changeDetector.markForCheck();
        }
      });
  }


}
