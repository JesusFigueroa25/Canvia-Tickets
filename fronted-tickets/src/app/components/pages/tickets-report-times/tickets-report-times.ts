
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Observable, Subject, from, map, mergeMap, takeUntil, timeout } from 'rxjs';
import { toPng } from 'html-to-image';
import { TicketsReportTimesReportData, TicketsReportTimesTabla } from '../../../models/tickets-report-times';
import { RegistroTiempo, resumenesIguales, validarPagina, validarReporte } from '../../charts/Consolidated/tickets-report-times-report/tickets-report-times-report.utils';
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

  @ViewChild('reporteImagen') reporteImagen?: ElementRef<HTMLElement>;
  datosReporte: TicketsReportTimesReportData | null = null;
  reporteRenderizado = false;
  preparandoReporte = false;
  exportandoReporte = false;
  errorPreparacionReporte: string | null = null;
  errorExportacion: string | null = null;
  private destruido = false;
  private versionReporte = 0;
  private readonly cancelarReporte$ = new Subject<void>();
  private respuestasReporte = new Set<string>();
  private filtrosReporte: TicketsReportTimesDashboardFilters = {};
  private fuentesReporte: Partial<TicketsReportTimesReportData> = {};
  private paginasReporte = {
    resolutores: new Map<number, TicketsReportTimesTabla<RegistroTiempo>>(),
    proyectos: new Map<number, TicketsReportTimesTabla<RegistroTiempo>>(),
  };
  private basesReporte: Partial<Record<'resolutores' | 'proyectos', TicketsReportTimesTabla<RegistroTiempo>>> = {};

  get reporteListo(): boolean {
    return !this.destruido && this.filtrosListos && !this.cargandoFiltros &&
      this.respuestasReporte.size === 6 && !this.preparandoReporte &&
      !this.errorPreparacionReporte && this.reporteRenderizado &&
      this.datosReporte?.version === this.versionReporte;
  }

  get errorConsultasReporte(): boolean {
    return !!(this.errorKpis || this.errorVolumen || this.errorTablaResolutores ||
      this.errorGraficoResolutores || this.errorTablaProyectos || this.errorGraficoProyectos);
  }

  private invalidarReporte(): void {
    ++this.versionReporte;
    this.respuestasReporte.clear();
    this.datosReporte = null;
    this.reporteRenderizado = false;
    this.preparandoReporte = false;
    this.errorPreparacionReporte = null;
    this.errorExportacion = null;
    this.fuentesReporte = {};
    this.basesReporte = {};
    this.paginasReporte.resolutores.clear();
    this.paginasReporte.proyectos.clear();
    this.cancelarReporte$.next();
  }

  private registrarRespuestaReporte(clave: string, version: number): void {
    if (this.destruido || version !== this.solicitudDashboard || this.respuestasReporte.has(clave)) return;
    try {
      if (clave === 'kpis') this.fuentesReporte.kpis = structuredClone(this.kpis!);
      if (clave === 'volumen') this.fuentesReporte.volumenMensual = structuredClone(this.volumenMensual);
      if (clave === 'graficoResolutores') this.fuentesReporte.graficoResolutores = structuredClone(this.datosGraficoResolutores!);
      if (clave === 'graficoProyectos') this.fuentesReporte.graficoProyectos = structuredClone(this.datosGraficoProyectos!);
      if (clave === 'tablaResolutores' || clave === 'tablaProyectos') {
        const dimension = clave === 'tablaResolutores' ? 'resolutores' : 'proyectos';
        const tabla = structuredClone(clave === 'tablaResolutores' ? this.datosTablaResolutores! : this.datosTablaProyectos!);
        this.basesReporte[dimension] = tabla;
        if (tabla.tamano === 100) this.paginasReporte[dimension].set(tabla.pagina, tabla);
      }
      this.respuestasReporte.add(clave);
      if (this.respuestasReporte.size === 6) this.prepararReporte();
    } catch (error) { this.fallarPreparacionReporte(error); }
  }

  reintentarReporte(): void {
    if (this.preparandoReporte || this.exportandoReporte || this.cargandoDashboard || this.destruido) return;
    if (this.respuestasReporte.size !== 6) this.cargarDashboard();
    else this.prepararReporte();
  }

  prepararReporte(): void {
    if (this.destruido || this.preparandoReporte || this.respuestasReporte.size !== 6) return;
    const version = this.solicitudDashboard;
    const versionRender = ++this.versionReporte;
    this.preparandoReporte = true;
    this.reporteRenderizado = false;
    this.datosReporte = null;
    this.errorPreparacionReporte = null;
    this.errorExportacion = null;
    const trabajos: { dimension: 'resolutores' | 'proyectos'; pagina: number }[] = [];
    try {
      for (const dimension of ['resolutores', 'proyectos'] as const) {
        const base = this.basesReporte[dimension]!;
        validarPagina(base, base.pagina, base.tamano);
        for (let pagina = 1; pagina <= Math.ceil(base.total / 100); pagina++) {
          if (!this.paginasReporte[dimension].has(pagina)) trabajos.push({ dimension, pagina });
        }
        // Validate even an empty cached first page.
        for (const pagina of this.paginasReporte[dimension].values()) validarPagina(pagina, pagina.pagina, 100);
      }
    } catch (error) {
      this.fallarPreparacionReporte(error);
      return;
    }
    from(trabajos).pipe(
      mergeMap(trabajo => {
        const respuesta: Observable<TicketsReportTimesTabla<RegistroTiempo>> = trabajo.dimension === 'resolutores'
          ? this.reportTimesService.obtenerTiemposResolutores(this.filtrosReporte, trabajo.pagina, 100)
          : this.reportTimesService.obtenerTiemposProyectos(this.filtrosReporte, trabajo.pagina, 100);
        return respuesta.pipe(timeout(30000), map(pagina => {
          validarPagina(pagina, trabajo.pagina, 100);
          const base = this.basesReporte[trabajo.dimension]!;
          if (pagina.total !== base.total || !resumenesIguales(pagina.resumen, base.resumen)) {
            throw new Error('Los datos cambiaron entre páginas. Vuelve a aplicar los filtros.');
          }
          return { trabajo, pagina };
        }));
      }, 2),
      takeUntil(this.cancelarReporte$),
      takeUntil(this.destruir$),
    ).subscribe({
      next: ({ trabajo, pagina }) => {
        if (version === this.solicitudDashboard && !this.destruido) this.paginasReporte[trabajo.dimension].set(trabajo.pagina, pagina);
      },
      error: error => { if (version === this.solicitudDashboard && !this.destruido) this.fallarPreparacionReporte(error); },
      complete: () => {
        if (version !== this.solicitudDashboard || this.destruido || this.respuestasReporte.size !== 6) return;
        try {
          const items = (dimension: 'resolutores' | 'proyectos') =>
            [...this.paginasReporte[dimension].entries()].sort(([a], [b]) => a - b).flatMap(([, p]) => p.items);
          const reporte: TicketsReportTimesReportData = {
            kpis: this.fuentesReporte.kpis!, volumenMensual: this.fuentesReporte.volumenMensual!,
            graficoResolutores: this.fuentesReporte.graficoResolutores!, graficoProyectos: this.fuentesReporte.graficoProyectos!,
            version: versionRender, preparadoEn: new Date().toISOString(), filtros: structuredClone(this.filtrosReporte),
            detalleResolutores: { resumen: this.basesReporte.resolutores!.resumen,
              items: items('resolutores') as TicketsReportTimesReportData['detalleResolutores']['items'],
              totalRegistros: this.basesReporte.resolutores!.total },
            detalleProyectos: { resumen: this.basesReporte.proyectos!.resumen,
              items: items('proyectos') as TicketsReportTimesReportData['detalleProyectos']['items'],
              totalRegistros: this.basesReporte.proyectos!.total },
          };
          validarReporte(reporte);
          this.datosReporte = reporte.kpis.total_tickets > 0 ? structuredClone(reporte) : null;
          this.preparandoReporte = false;
          this.changeDetector.markForCheck();
        } catch (error) { this.fallarPreparacionReporte(error); }
      },
    });
  }

  private fallarPreparacionReporte(error: unknown): void {
    this.preparandoReporte = false;
    this.datosReporte = null;
    this.reporteRenderizado = false;
    this.errorPreparacionReporte = error instanceof Error && error.name === 'TimeoutError'
      ? 'La consulta de una página tardó demasiado. Reintenta la preparación.'
      : error instanceof Error && !(error instanceof TypeError)
      ? error.message : 'No se pudo completar el reporte. Reintenta o actualiza los filtros.';
    this.changeDetector.markForCheck();
  }

  confirmarRenderReporte(version: number): void {
    if (!this.destruido && this.datosReporte?.version === version && version === this.versionReporte) {
      this.reporteRenderizado = true;
      this.changeDetector.markForCheck();
    }
  }

  fallarRenderReporte(version: number): void {
    if (version === this.versionReporte && !this.destruido) {
      this.fallarPreparacionReporte(new Error('No se pudo renderizar el reporte. Reintenta la preparación.'));
    }
  }

  async descargarReporte(): Promise<void> {
    if (!this.reporteListo || this.exportandoReporte || !this.datosReporte) return;
    const datos = this.datosReporte;
    this.exportandoReporte = true;
    this.errorExportacion = null;
    this.changeDetector.markForCheck();
    let enlace: HTMLAnchorElement | undefined;
    try {
      await document.fonts?.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!this.reporteListo || this.datosReporte !== datos) throw new Error('obsoleto');
      const elemento = this.reporteImagen?.nativeElement.querySelector<HTMLElement>('.report-document');
      if (!elemento) throw new Error('documento');
      const width = Math.ceil(elemento.scrollWidth), height = Math.ceil(elemento.scrollHeight);
      const pixelRatio = height > 4000 ? 1 : 2;
      if (width <= 0 || height <= 0) throw new Error('dimensiones');
      if (width * pixelRatio > 16384 || height * pixelRatio > 16384 || width * height * pixelRatio ** 2 > 32000000) {
        throw new Error('limite');
      }
      const imagen = await toPng(elemento, {
        backgroundColor: '#F7F9FB', width, height, pixelRatio, skipFonts: true, skipAutoScale: true,
        style: { position: 'static', left: 'auto', top: 'auto', transform: 'none', margin: '0' },
      });
      if (this.destruido) return;
      if (!this.reporteListo || this.datosReporte !== datos) throw new Error('obsoleto');
      if (!imagen.startsWith('data:image/png') || imagen.length < 100) throw new Error('imagen');
      enlace = document.createElement('a');
      enlace.href = imagen;
      enlace.download = `CANVIA-Tiempos-Informes-Mensuales-${datos.filtros.desde ?? 'inicio'}_${datos.filtros.hasta ?? 'fin'}-${datos.filtros.periodo ?? 'todos'}-${this.formatearFecha(new Date())}.png`;
      document.body.appendChild(enlace);
      enlace.click();
    } catch (error) {
      if (!this.destruido) this.errorExportacion = error instanceof Error && error.message === 'obsoleto'
        ? 'Los datos cambiaron durante la captura. Descarga el reporte actualizado.'
        : error instanceof Error && error.message === 'limite'
          ? 'El reporte supera el tamaño de imagen permitido. Reduce el rango de fechas o los proyectos.'
          : 'No fue posible generar el PNG completo. Puedes reintentar la descarga.';
    } finally {
      enlace?.remove();
      this.exportandoReporte = false;
      if (!this.destruido) this.changeDetector.markForCheck();
    }
  }


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
    this.destruido = true;
    this.invalidarReporte();
    this.cancelarReporte$.complete();
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
    this.cancelarDashboard$.next();
    ++this.solicitudDashboard;
    this.invalidarReporte();
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
    this.invalidarReporte();
    this.filtrosReporte = structuredClone(this.filtrosActuales);

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
          this.registrarRespuestaReporte('kpis', solicitudActual);
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
          this.registrarRespuestaReporte('volumen', solicitudActual);

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
          this.registrarRespuestaReporte('tablaResolutores', solicitudActual);

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
          this.registrarRespuestaReporte('graficoResolutores', solicitudActual);

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
          this.registrarRespuestaReporte('tablaProyectos', solicitudActual);

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
          this.registrarRespuestaReporte('graficoProyectos', solicitudActual);

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
