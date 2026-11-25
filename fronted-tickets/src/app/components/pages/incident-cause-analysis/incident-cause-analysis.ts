
import { Component, ComponentRef, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, ViewContainerRef, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DATE_LOCALE, MatDateFormats, provideNativeDateAdapter } from '@angular/material/core';
import { Subscription } from 'rxjs';
import { IncidentConsolidatedFilters, IncidentConsolidatedDashboardFilters, IncidentConsolidatedKPI, IncidentConsolidatedAtribucionOut, IncidentConsolidatedTopServidoresOut, IncidentConsolidatedAnalisisCausasOut, IncidentConsolidatedDistribucionAjustadaOut, IncidentConsolidatedPrincipalesHallazgosOut, IncidentConsolidatedConclusionesOut, IncidentConsolidatedTicketsPorResolutorOut, IncidentConsolidatedRendimientoOut, IncidentConsolidatedTopProyectos, IncidentConsolidatedProyectoItem, IncidentConsolidatedAnalisisEjecutivoIAOut, IncidentConsolidatedTipoItem } from '../../../models/incident-consolidated';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { toPng } from 'html-to-image';
import type { ExecutiveSummarySource, ExecutiveSummaryToken, ExecutiveSummaryRenderError, IncidentExecutiveSummaryData, IncidentExecutiveSummarySources } from '../../../models/incident-executive-summary-report';
import type { IncidentExecutiveSummaryReport } from '../../charts/Consolidated/incident-executive-summary-report/incident-executive-summary-report';
import { claveResumen, copiarFiltrosResumen, crearResumenEjecutivo } from '../../charts/Consolidated/incident-executive-summary-report/incident-executive-summary-report.utils';


// FORMATOS DE FECHA - PERU
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

  // feat/mejoras-analisis-incidentes-gpt
  private readonly grupoResolutorPorDefecto = 'BASE DE DATOS Y EBS';
  filtrosForm!: FormGroup;
  filtrosActuales: IncidentConsolidatedDashboardFilters = {
    grupo_resolutor: this.grupoResolutorPorDefecto
  };

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

  // 2. KPIS
  kpis: IncidentConsolidatedKPI | null = null;
  cargandoKpis = false;
  errorKpis: string | null = null;

  // 3. DATOS DE GRAFICOS Y TABLAS
  atribucionIncidentes: IncidentConsolidatedAtribucionOut | null = null;
  distribucionAjustada: IncidentConsolidatedDistribucionAjustadaOut | null = null;
  analisisCausas: IncidentConsolidatedAnalisisCausasOut | null = null;

  // CAUSAS PREPARADAS SOLO PARA VISUALIZACIÓN
  analisisCausasVisual: IncidentConsolidatedAnalisisCausasOut | null = null;

  // DISTRIBUCIÓN POR TIPO DE INCIDENTE
  tiposIncidenteDistribucion: IncidentConsolidatedTipoItem[] | null = null;
  tiposGrafico: { categoria: string; cantidad: number }[] = [];
  cargandoTipos = false;
  errorTipos: string | null = null;
  topServidores: IncidentConsolidatedTopServidoresOut | null = null;

  // VERIFICAR SI EXISTEN SERVIDORES CON INCIDENTES
  get hayServidores(): boolean {
    return (this.topServidores?.servidores ?? []).some(
      item =>
        typeof item.servidor === 'string' &&
        item.servidor.trim().length > 0 &&
        item.incidentes > 0
    );
  }

  // ANALISIS DE CAUSAS V3
  cargandoAnalisisCausas = false;
  errorAnalisisCausas: string | null = null;


  // TOP DE SERVIDORES
  cargandoTopServidores = false;
  errorTopServidores: string | null = null;
  limiteTopServidores = 5;
  private suscripcionTopServidores: Subscription | null = null;

  // GRAFICOS DE ATRIBUCION
  cargandoAtribucion = false;
  errorAtribucion: string | null = null;
  atribucionSeleccionada: string | null = null;

  // 4. PRINCIPALES HALLAZGOS - DENTRO DEL PADRE
  principalesHallazgos: IncidentConsolidatedPrincipalesHallazgosOut | null = null;
  cargandoHallazgos = false;
  errorHallazgos: string | null = null;

  // 5. CONCLUSIONES - DENTRO DEL PADRE
  conclusiones: IncidentConsolidatedConclusionesOut | null = null;
  cargandoConclusiones = false;
  errorConclusiones: string | null = null;


  // ANÁLISIS EJECUTIVO CON INTELIGENCIA ARTIFICIAL
  resultadoAnalisisIA: IncidentConsolidatedAnalisisEjecutivoIAOut | null = null;
  cargandoAnalisisIA = false;
  errorAnalisisIA: string | null = null;


  // 6. CONTROL DE PETICIONES
  private suscripcionFiltros: Subscription | null = null;
  private solicitudesDashboard = new Subscription();

  // CLIENTE - PROYECTOS
  proyectos: IncidentConsolidatedProyectoItem[] = [];
  cargandoProyectos = false;
  errorProyectos: string | null = null;

  topProyectos: IncidentConsolidatedTopProyectos = {
    periodos: [],
    proyectos: []
  };

  cargandoTopProyectos = false;
  errorTopProyectos: string | null = null;

  opcionesProyectos: string[] = [];
  proyectosExcluidos: string[] = [];

  private suscripcionOpcionesProyectos: Subscription | null = null;


  // RESOLUTOR
  rendimientoResolutores: IncidentConsolidatedRendimientoOut | null = null;

  rendimientoReporte: IncidentConsolidatedRendimientoOut | null = null;
  cargandoRendimientoReporte = false;
  errorRendimientoReporte: string | null = null;

  cargandoRendimientoResolutores = false;
  errorRendimientoResolutores: string | null = null;
  paginaResolutores = 1;
  tamanoResolutores = 5;
  private suscripcionRendimientoResolutores: Subscription | null = null;
  ticketsPorResolutor: IncidentConsolidatedTicketsPorResolutorOut | null = null;
  cargandoTicketsPorResolutor = false;
  errorTicketsPorResolutor: string | null = null;
  limiteTicketsPorResolutor = 5;
  private suscripcionTicketsPorResolutor: Subscription | null = null;


  // PANTALLA COMPLETA
  graficoExpandido: string | null = null;

  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    try {
      if (document.fullscreenElement === elemento) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await elemento.requestFullscreen();
      }
    } catch (error) {
      console.error('Error al cambiar pantalla completa:', error);
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id ?? null;

    this.changeDetector.markForCheck();
  }


  // MISMO CRITERIO UTILIZADO EN INCIDENTES CONSOLIDADOS
  get mostrarMesesEnEjeXResolutores(): boolean {
    const f = this.filtrosActuales;

    const fechasPersonalizadas =
      (!!f.desde && f.desde !== this.opcionesFiltros.fecha_min) ||
      (!!f.hasta && f.hasta !== this.opcionesFiltros.fecha_max);

    return Boolean(
      fechasPersonalizadas ||
      f.prioridad ||
      f.motivo_estado ||
      f.motivo_resolucion ||
      f.grupo_resolutor ||
      f.proyecto ||
      f.nombre_resolutor ||
      f.descripcion ||
      f.periodo ||
      f.tipo_incidente?.length ||
      f.detalle_id ||
      f.proyectos_excluidos?.length ||
      f.ticket_id
    );
  }

  constructor(
    private formBuilder: FormBuilder,
    private incidentConsolidatedService: IncidentConsolidatedService,
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>
  ) { }


  // Resumen independiente. El reporte completo conserva su protocolo y estado.
  @ViewChild('resumenHost', { read: ViewContainerRef }) resumenHost?: ViewContainerRef;
  exportandoResumen = false;
  estadoResumen: 'esperando' | 'preparando' | 'listo' | 'sin_datos' | 'error' = 'esperando';
  errorResumen: string | null = null;
  private fuentesResumen: Partial<IncidentExecutiveSummarySources> = {};
  private revisionesResumen = { ajustada: 0, servidores: 0, analisis: 0 };
  private generacionResumen = 0;
  private versionResumen = 0;
  private filtrosResumen: IncidentConsolidatedDashboardFilters = {};
  private claveContextoResumen: string | null = null;
  private preparadoResumen: IncidentExecutiveSummaryData | null = null;
  private documentoResumen?: ComponentRef<IncidentExecutiveSummaryReport>;
  private capturaResumenActiva = false;
  private resumenDestruido = false;

  get puedeDescargarResumen(): boolean {
    return !this.resumenDestruido && !this.cargandoFiltros && !this.exportandoResumen && !!this.preparadoResumen?.total &&
      this.claveContextoResumen === claveResumen(this.filtrosActuales);
  }
  private invalidarResumen(): void {
    ++this.versionResumen; this.documentoResumen?.destroy(); this.documentoResumen = undefined;
    this.preparadoResumen = null; this.errorResumen = null; this.estadoResumen = 'esperando'; this.exportandoResumen = this.capturaResumenActiva;
  }
  private iniciarContextoResumen(filtros: IncidentConsolidatedDashboardFilters): void {
    this.invalidarResumen(); ++this.generacionResumen; this.fuentesResumen = {};
    this.filtrosResumen = copiarFiltrosResumen(filtros); this.claveContextoResumen = claveResumen(filtros);
  }
  private solicitarFuenteResumen(tipo: ExecutiveSummarySource, filtros: IncidentConsolidatedDashboardFilters): ExecutiveSummaryToken {
    this.invalidarResumen(); delete this.fuentesResumen[tipo];
    return { generacion: this.generacionResumen, revision: ++this.revisionesResumen[tipo], clave: claveResumen(filtros) };
  }
  private tokenResumenVigente(tipo: ExecutiveSummarySource, token: ExecutiveSummaryToken): boolean {
    return !this.resumenDestruido && token.generacion === this.generacionResumen && token.revision === this.revisionesResumen[tipo] &&
      token.clave === this.claveContextoResumen && token.clave === claveResumen(this.filtrosActuales);
  }
  private recibirFuenteResumen<K extends ExecutiveSummarySource>(tipo: K, token: ExecutiveSummaryToken, valor: IncidentExecutiveSummarySources[K]): void {
    if (!this.tokenResumenVigente(tipo, token)) return;
    if (!valor || typeof valor !== 'object') { this.fallarFuenteResumen(tipo, token); return; }
    this.fuentesResumen[tipo] = valor;
    const { ajustada, servidores, analisis } = this.fuentesResumen;
    if (!ajustada || !servidores || !analisis) return;
    try {
      this.preparadoResumen = crearResumenEjecutivo({ ajustada, servidores, analisis }, this.filtrosResumen, 0, '');
      this.estadoResumen = this.preparadoResumen.total ? 'listo' : 'sin_datos'; this.errorResumen = null;
    } catch (e) { this.errorResumen = e instanceof Error && !(e instanceof TypeError) ? e.message : 'No se pudieron validar los datos del resumen.'; this.estadoResumen = 'error'; }
    this.changeDetector.markForCheck();
  }
  private fallarFuenteResumen(tipo: ExecutiveSummarySource, token: ExecutiveSummaryToken): void {
    if (!this.tokenResumenVigente(tipo, token)) return;
    this.errorResumen = 'Reporte 1 requiere atribución, servidores y análisis vigente correctos. Espera o vuelve a aplicar los filtros para actualizar los datos.';
    this.estadoResumen = 'error'; this.changeDetector.markForCheck();
  }
  private cargarComponenteResumen(): Promise<typeof IncidentExecutiveSummaryReport> {
    return import('../../charts/Consolidated/incident-executive-summary-report/incident-executive-summary-report').then(m => m.IncidentExecutiveSummaryReport);
  }
  async descargarResumen(): Promise<void> {
    if (!this.puedeDescargarResumen || !this.preparadoResumen) return;
    const datos = { ...this.preparadoResumen, version: ++this.versionResumen, preparadoEn: new Date().toISOString() };
    this.exportandoResumen = true; this.errorResumen = null; this.estadoResumen = 'preparando';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const componente = await Promise.race([this.cargarComponenteResumen(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('render')), 30000); })]);
      if (!this.resumenVigente(datos.version)) return;
      if (!this.resumenHost) throw new Error('contenedor');
      this.documentoResumen?.destroy(); this.documentoResumen = this.resumenHost.createComponent(componente);
      const render = this.documentoResumen.instance.renderizado.subscribe(version => this.confirmarResumen(version, datos));
      const error = this.documentoResumen.instance.errorRenderizado.subscribe(e => this.fallarRenderResumen(e));
      this.documentoResumen.onDestroy(() => { render.unsubscribe(); error.unsubscribe(); });
      this.documentoResumen.setInput('datos', datos); this.documentoResumen.changeDetectorRef.detectChanges();
    } catch { if (this.resumenVigente(datos.version)) this.fallarRenderResumen({ version: datos.version, motivo: 'render' }); }
    finally { clearTimeout(timer); if (!this.resumenDestruido) this.changeDetector.markForCheck(); }
  }
  private resumenVigente(version: number): boolean {
    return !this.resumenDestruido && version === this.versionResumen && this.claveContextoResumen === claveResumen(this.filtrosActuales);
  }
  private fallarRenderResumen(error: ExecutiveSummaryRenderError): void {
    if (!this.resumenVigente(error.version)) return;
    this.errorResumen = error.motivo === 'legibilidad'
      ? 'El resumen no cabe en una composición horizontal legible con los textos completos. Ajusta los filtros o utiliza el reporte completo; no se recortó contenido.'
      : 'No se pudo preparar el resumen. Puedes reintentar sin generar un nuevo análisis.';
    this.estadoResumen = 'error'; this.exportandoResumen = false; this.changeDetector.markForCheck();
  }
  private confirmarResumen(version: number, datos: IncidentExecutiveSummaryData): void {
    if (!this.resumenVigente(version) || datos.version !== version || this.estadoResumen !== 'preparando') return;
    this.estadoResumen = 'listo'; void this.capturarResumen(datos);
  }
  private async capturarResumen(datos: IncidentExecutiveSummaryData): Promise<void> {
    if (this.capturaResumenActiva || !this.resumenVigente(datos.version)) return;
    this.capturaResumenActiva = true; let timer: ReturnType<typeof setTimeout> | undefined, enlace: HTMLAnchorElement | undefined;
    try {
      const el = this.documentoResumen?.location.nativeElement.querySelector('.report-document') as HTMLElement | null;
      if (!el) throw new Error('documento');
      const width = Math.ceil(el.scrollWidth), height = Math.ceil(el.scrollHeight), pixelRatio = 2;
      if (width !== 1400 || !Number.isFinite(height) || height <= 0 || height >= 1400 || width * pixelRatio > 16384 || height * pixelRatio > 16384 || width * height * pixelRatio ** 2 > 32000000) throw new Error('dimensiones');
      const imagen = await Promise.race([toPng(el, { width, height, pixelRatio, backgroundColor: '#F7F9FB', skipFonts: true, skipAutoScale: true,
        style: { position: 'static', left: 'auto', top: 'auto', transform: 'none', margin: '0' } }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 30000); })]);
      if (!this.resumenVigente(datos.version)) throw new Error('obsoleto');
      if (!imagen.startsWith('data:image/png;base64,') || imagen.length < 100) throw new Error('imagen');
      const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      enlace = document.createElement('a'); enlace.href = imagen;
      enlace.download = `CANVIA-Resumen-Ejecutivo-Incidentes-${datos.filtros.desde}_${datos.filtros.hasta}-${fecha}.png`;
      document.body.appendChild(enlace); enlace.click();
    } catch (e) {
      if (!this.resumenDestruido) { this.estadoResumen = 'error'; this.errorResumen = e instanceof Error && e.message === 'obsoleto'
        ? 'Los filtros o las fuentes cambiaron durante la captura. Genera el resumen nuevamente.'
        : 'No se pudo capturar el resumen completo dentro del tiempo y tamaño permitidos. Puedes reintentar sin generar un nuevo análisis.'; }
    } finally { clearTimeout(timer); enlace?.remove(); this.capturaResumenActiva = false; this.exportandoResumen = false; if (!this.resumenDestruido) this.changeDetector.markForCheck(); }
  }

  // REPORTE EJECUTIVO - EXPORTACION PNG
  @ViewChild('reporteImagen')
  private reporteImagen?: ElementRef<HTMLElement>;

  exportandoReporte = false;
  errorExportacion: string | null = null;

  // VALIDAR QUE TODOS LOS DATOS ESTEN LISTOS
  get reporteListo(): boolean {

    

    return (
      !this.cargandoFiltros &&
      !this.cargandoAtribucion &&
      !this.cargandoAnalisisCausas &&
      !this.cargandoTopServidores &&
      !this.cargandoHallazgos &&
      !this.cargandoConclusiones &&
      !this.cargandoAnalisisIA &&
      !this.cargandoTipos &&


      // NUEVAS CONSULTAS
      !this.cargandoProyectos &&
      !this.cargandoTopProyectos &&
      !this.cargandoRendimientoReporte &&
      !this.cargandoTicketsPorResolutor &&

      !this.errorAtribucion &&
      !this.errorAnalisisCausas &&
      !this.errorTopServidores &&
      !this.errorHallazgos &&
      !this.errorConclusiones &&
      !this.errorTipos &&

      // NUEVOS ERRORES
      !this.errorProyectos &&
      !this.errorTopProyectos &&
      !this.errorRendimientoReporte &&
      !this.errorTicketsPorResolutor &&

      this.atribucionIncidentes !== null &&
      this.distribucionAjustada !== null &&
      this.analisisCausas !== null &&
      this.principalesHallazgos !== null &&
      this.conclusiones !== null &&
      this.tiposIncidenteDistribucion !== null &&

      // DATOS NECESARIOS PARA EL REPORTE
      this.rendimientoReporte !== null &&
      this.ticketsPorResolutor !== null
    );
  }


  async descargarReporte(): Promise<void> {

    if (this.exportandoReporte || !this.reporteListo) {
      return;
    }

    // OBTENER EL CONTENEDOR ORIGINAL
    const contenedor = this.reporteImagen?.nativeElement;

    // CAPTURAR SOLO EL DOCUMENTO DEL REPORTE
    // NO CAPTURAR EL CONTENEDOR CON left: -20000px
    const elemento = contenedor?.querySelector<HTMLElement>(
      '.report-document'
    );

    if (!elemento) {
      this.errorExportacion =
        'No se encontró el contenido del reporte.';
      return;
    }

    this.exportandoReporte = true;
    this.errorExportacion = null;

    this.changeDetector.detectChanges();

    try {

      // ESPERAR A QUE LAS FUENTES ESTEN DISPONIBLES
      await document.fonts.ready;

      // ESPERAR A QUE TERMINE EL RENDERIZADO
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      // OBTENER DIMENSIONES REALES DEL REPORTE
      const ancho = Math.ceil(elemento.scrollWidth);
      const altura = Math.ceil(elemento.scrollHeight);

      if (ancho <= 0 || altura <= 0) {
        throw new Error(
          'El reporte no tiene dimensiones válidas.'
        );
      }

      console.log('Dimensiones del reporte:', {
        ancho,
        altura
      });

      // AJUSTAR RESOLUCION SEGUN EL TAMAÑO
      const escala = altura > 4000 ? 1 : 2;

      // GENERAR LA IMAGEN DEL CONTENIDO REAL
      const imagen = await toPng(elemento, {

        backgroundColor: '#F7F9FB',

        width: ancho,
        height: altura,

        pixelRatio: escala,

        cacheBust: true,

        // EVITAR POSICIONES FUERA DEL AREA DE CAPTURA
        style: {
          position: 'static',
          left: 'auto',
          top: 'auto',
          transform: 'none',
          margin: '0'
        }

      });

      // NOMBRE DEL PROYECTO
      const proyecto = (
        this.proyectoTitulo || 'general'
      )
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'general';

      // FECHA ACTUAL
      const ahora = new Date();

      const fecha = [
        ahora.getFullYear(),
        String(ahora.getMonth() + 1).padStart(2, '0'),
        String(ahora.getDate()).padStart(2, '0')
      ].join('-');

      // DESCARGAR IMAGEN
      const enlace = document.createElement('a');

      enlace.href = imagen;

      enlace.download =
        `CANVIA-Analisis-Incidentes-${proyecto}-${fecha}.png`;

      document.body.appendChild(enlace);

      enlace.click();

      enlace.remove();

    } catch (error) {

      console.error(
        'Error al generar el reporte de incidentes:',
        error
      );

      this.errorExportacion =
        'No fue posible generar el reporte PNG.';

    } finally {

      this.exportandoReporte = false;

      this.changeDetector.markForCheck();

    }
  }



  // 7. CICLO DE VIDA
  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.resumenDestruido = true; this.invalidarResumen();
    this.suscripcionFiltros?.unsubscribe();
    this.suscripcionOpcionesProyectos?.unsubscribe();
    this.suscripcionRendimientoResolutores?.unsubscribe();
    this.suscripcionTicketsPorResolutor?.unsubscribe();
    this.solicitudesDashboard.unsubscribe();
  }


  // 8. CREAR FORMULARIO
  crearFormularioFiltros(): void {

    this.filtrosForm = this.formBuilder.group({
      desde: [null, Validators.required],
      hasta: [null, Validators.required],
      prioridad: [null],
      motivo_estado: [null],
      motivo_resolucion: [null],

      // feat/mejoras-analisis-incidentes-gpt
      grupo_resolutor: [this.grupoResolutorPorDefecto],

      proyecto: [null],
      nombre_resolutor: [null],
      tipo_incidente: [[]],
      ticket_id: ['']
    });

  }


  // 9. OBTENER OPCIONES DE FILTROS
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
          console.error('Error obteniendo filtros de análisis de incidentes:', error);
          this.cargandoFiltros = false;
          this.errorFiltros = 'No se pudieron cargar las opciones de filtros.';
          this.changeDetector.markForCheck();
        }
      });
  }


  // 10. FECHAS POR DEFECTO
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


  // 11. APLICAR FILTROS
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

      ticket_id: valores.ticket_id?.trim() || undefined,

      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    const motivoSeleccionado = valores.motivo_resolucion;

    this.atribucionSeleccionada =
      motivoSeleccionado === 'Atribuible a Cliente' ||
        motivoSeleccionado === 'Atribuible a Canvia'
        ? motivoSeleccionado
        : null;


    this.cargarDashboard();
  }


  // 12. LIMPIAR FILTROS
  limpiarFiltros(): void {

    // feat/mejoras-analisis-incidentes-gpt
    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      prioridad: null,
      motivo_estado: null,
      motivo_resolucion: null,
      grupo_resolutor: this.grupoResolutorPorDefecto,
      proyecto: null,
      nombre_resolutor: null,
      tipo_incidente: [],
      ticket_id: ''
    });
    this.filtrosActuales = {
      grupo_resolutor: this.grupoResolutorPorDefecto
    };

    this.errorFiltros = null;
    this.establecerFechasPorDefecto();
    this.atribucionSeleccionada = null;
    // RESTABLECER FILTROS DE LAS NUEVAS SECCIONES
    this.proyectosExcluidos = [];

    this.paginaResolutores = 1;
    this.tamanoResolutores = 5;
    this.limiteTicketsPorResolutor = 5;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      proyecto: undefined,
      nombre_resolutor: undefined,
      proyectos_excluidos: undefined
    };
    this.cargarDashboard();

  }


  // 13. CARGAR DASHBOARD

  cargarDashboard(): void {

    // CANCELAR CONSULTAS DE LOS FILTROS ANTERIORES
    this.solicitudesDashboard.unsubscribe();
    this.solicitudesDashboard = new Subscription();

    const filtros: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,

      tipo_incidente: this.filtrosActuales.tipo_incidente
        ? [...this.filtrosActuales.tipo_incidente]
        : undefined,

      proyectos_excluidos: this.filtrosActuales.proyectos_excluidos
        ? [...this.filtrosActuales.proyectos_excluidos]
        : undefined
    };

    this.iniciarContextoResumen(filtros);

    // RESTABLECER PAGINACIÓN
    this.paginaResolutores = 1;
    this.kpis = null;
    this.principalesHallazgos = null;
    this.conclusiones = null;

    // INVALIDAR EL ANÁLISIS IA DEL FILTRO ANTERIOR
    this.resultadoAnalisisIA = null;
    this.cargandoAnalisisIA = false;
    this.errorAnalisisIA = null;


    this.atribucionIncidentes = null;
    this.distribucionAjustada = null;

    this.analisisCausas = null;
    this.analisisCausasVisual = null;
    this.topServidores = null;

    this.tiposIncidenteDistribucion = null;
    this.tiposGrafico = [];
    this.errorTipos = null;

    // NUEVAS SECCIONES
    this.proyectos = [];
    this.topProyectos = { periodos: [], proyectos: [] };
    this.rendimientoResolutores = null;
    this.rendimientoReporte = null;
    this.ticketsPorResolutor = null;
    this.errorRendimientoReporte = null;

    // LIMPIAR ERRORES
    this.errorKpis = null;
    this.errorHallazgos = null;
    this.errorConclusiones = null;
    this.errorExportacion = null;

    this.errorProyectos = null;
    this.errorTopProyectos = null;
    this.errorRendimientoResolutores = null;
    this.errorTicketsPorResolutor = null;

    // MÓDULOS EXISTENTES
    // this.cargarKpis(filtros);

    // MÓDULOS EXISTENTES
    this.cargarAtribucion(filtros);
    this.cargarAnalisisCausas(filtros);
    this.cargarTipos(filtros);
    this.cargarTopServidores(filtros);

    this.cargarAnalisisEjecutivoIA(filtros);


    // NUEVO: CLIENTE
    this.cargarOpcionesProyectos();
    this.cargarProyectos(filtros);
    this.cargarTopProyectos(filtros);

    // NUEVO: RESOLUTOR
    this.cargarRendimientoResolutores(filtros);
    this.cargarTicketsPorResolutor(filtros);
    this.cargarRendimientoReporte(filtros);

    this.changeDetector.markForCheck();
  }


  // 14. CARGAR KPIS
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





  // 18. ESTADO DE AJUSTES
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


  // 19. NAVEGACION INTERNA
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



  // CARGAR DISTRIBUCION ORIGINAL Y AJUSTADA
  private cargarAtribucion(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    const tokenResumen = this.solicitarFuenteResumen('ajustada', filtros);

    this.cargandoAtribucion = true;
    this.errorAtribucion = null;
    const solicitud = this.incidentConsolidatedService
      .obtenerDistribucionAjustadaCausas(filtros)
      .subscribe({

        next: (data) => {
          this.distribucionAjustada = data;
          this.recibirFuenteResumen('ajustada', tokenResumen, data);
          this.atribucionIncidentes = {
            total_tickets: data.total_tickets,
            total_atribuidos: data.total_atribuidos_original,
            sin_atribucion: data.sin_atribucion_original,
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
          this.errorAtribucion = 'No se pudo cargar la distribución de atribución.';
          this.fallarFuenteResumen('ajustada', tokenResumen);
          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }

  // FILTRO DINAMICO POR ATRIBUCION
  cambiarAtribucion(atribucion: string | null): void {
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


  // CARGAR ANALISIS DE CAUSAS V3
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

          this.analisisCausasVisual = {
            ...data,
            causas: data.causas.filter(
              item =>
                item.categoria.trim().toLowerCase() !==
                'sin evidencia técnica suficiente'
            )
          };

          this.cargandoAnalisisCausas = false;

        },

        error: (error) => {

          console.error(
            'Error obteniendo análisis de causas:',
            error
          );

          this.analisisCausas = null;
          this.analisisCausasVisual = null;
          this.cargandoAnalisisCausas = false;

          this.errorAnalisisCausas =
            'No se pudo cargar el análisis de causas.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }

  // DISTRIBUCIÓN POR TIPO DE INCIDENTE
  private cargarTipos(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoTipos = true;
    this.errorTipos = null;
    this.tiposIncidenteDistribucion = null;
    this.tiposGrafico = [];

    const solicitud = this.incidentConsolidatedService
      .obtenerTipos(filtros)
      .subscribe({

        next: (data) => {

          this.tiposIncidenteDistribucion = data;

          this.tiposGrafico = data.map(item => ({
            categoria: item.tipo_incidente,
            cantidad: item.cantidad
          }));

          this.cargandoTipos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error cargando distribución por tipo de incidente:',
            error
          );

          this.tiposIncidenteDistribucion = null;
          this.tiposGrafico = [];

          this.cargandoTipos = false;
          this.errorTipos =
            'No se pudo cargar la distribución por tipo de incidente.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }

  // CARGAR TOP DE SERVIDORES
  private cargarTopServidores(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    const tokenResumen = this.solicitarFuenteResumen('servidores', filtros);

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
          this.recibirFuenteResumen('servidores', tokenResumen, data);
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
          this.fallarFuenteResumen('servidores', tokenResumen);

          this.changeDetector.markForCheck();
        }
      });

    this.suscripcionTopServidores = solicitud;

    this.solicitudesDashboard.add(solicitud);
  }


  // CAMBIAR LIMITE TOP SERVIDORES
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

  // TÍTULO DINÁMICO DEL GRÁFICO DE CLIENTES
  get tituloGraficoClientes(): string {

    const proyecto = this.proyectoTitulo;

    return proyecto
      ? `Tickets por el cliente ${proyecto}`
      : 'Top 10: Tickets por Proyecto y Mes';
  }

  // TITULO DINAMICO - PROYECTO SELECCIONADO
  get proyectoTitulo(): string | null {

    const proyecto = this.filtrosActuales.proyecto?.trim();

    if (!proyecto) {
      return null;
    }

    const sinCodigo = proyecto.replace(/^\d+\s+/, '');

    const coincidencia = sinCodigo.match(
      /^(.+?)\s+PROY\b/i
    );

    return coincidencia
      ? coincidencia[1].trim()
      : sinCodigo;
  }

  // SUBTITULO DINAMICO - TIPOS DE INCIDENTE
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


  // BUSCADORES DE FILTROS - PROYECTO Y TIPO DE INCIDENTE

  @ViewChild('buscadorProyecto')
  buscadorProyecto?: ElementRef<HTMLInputElement>;

  @ViewChild('buscadorTipoIncidente')
  buscadorTipoIncidente?: ElementRef<HTMLInputElement>;

  busquedaProyecto = '';
  busquedaTipoIncidente = '';

  // NORMALIZAR TEXTO PARA BUSQUEDA
  private normalizarBusqueda(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // FILTRAR OPCIONES DE PROYECTO
  get proyectosFiltrados(): string[] {

    const busqueda = this.normalizarBusqueda(
      this.busquedaProyecto
    );

    const seleccionado = this.filtrosForm
      ?.get('proyecto')?.value;

    return this.opcionesFiltros.proyectos.filter(
      proyecto => {
        if (proyecto === seleccionado) {
          return true;
        }
        return this.normalizarBusqueda(proyecto)
          .includes(busqueda);
      }
    );
  }


  // FILTRAR OPCIONES DE TIPO DE INCIDENTE
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

      if (seleccionados.has(tipo)) {
        return true;
      }

      return this.normalizarBusqueda(tipo)
        .includes(busqueda);
    });
  }

  // ACTUALIZAR BUSQUEDA
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


  // ABRIR COMBO Y ENFOCAR BUSCADOR
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


  // EVITAR QUE MAT-SELECT INTERCEPTE LA ESCRITURA
  detenerTeclasBusqueda(evento: KeyboardEvent): void {
    if (
      evento.key !== 'Escape' &&
      evento.key !== 'Tab'
    ) {
      evento.stopPropagation();
    }
  }


  // CLIENTE - OPCIONES DE PROYECTOS
  private cargarOpcionesProyectos(): void {

    this.suscripcionOpcionesProyectos?.unsubscribe();

    const filtros: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      proyectos_excluidos: undefined
    };

    this.suscripcionOpcionesProyectos = this.incidentConsolidatedService
      .obtenerProyectos(filtros)
      .subscribe({
        next: (datos) => {
          this.opcionesProyectos = [
            ...new Set(datos.map(item => item.proyecto))
          ];

          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando opciones de proyectos:', error);

          this.opcionesProyectos = [
            ...this.opcionesFiltros.proyectos
          ];

          this.changeDetector.markForCheck();
        }
      });
  }


  // CLIENTE - EXPLORADOR POR PROYECTOS
  private cargarProyectos(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoProyectos = true;
    this.errorProyectos = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerProyectos(filtros)
      .subscribe({
        next: (datos) => {
          this.proyectos = datos;
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando proyectos:', error);

          this.proyectos = [];
          this.cargandoProyectos = false;
          this.errorProyectos = 'No se pudo cargar el Explorador por Proyectos.';
          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // CLIENTE - TOP 10 PROYECTOS
  private cargarTopProyectos(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoTopProyectos = true;
    this.errorTopProyectos = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerTopProyectos(filtros)
      .subscribe({
        next: (datos) => {
          this.topProyectos = datos;
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando Top de Proyectos:', error);

          this.topProyectos = { periodos: [], proyectos: [] };
          this.cargandoTopProyectos = false;
          this.errorTopProyectos = 'No se pudo cargar el Top 10 de Proyectos.';
          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }


  // CLIENTE - FILTRO DINÁMICO POR PROYECTO
  cambiarProyecto(proyecto: string | null): void {

    const nuevoProyecto = proyecto?.trim() || null;

    if ((this.filtrosActuales.proyecto ?? null) === nuevoProyecto) {
      return;
    }

    // UN PROYECTO SELECCIONADO NO DEBE ESTAR EXCLUIDO
    if (nuevoProyecto) {
      this.proyectosExcluidos = this.proyectosExcluidos.filter(
        item => item.trim().toLowerCase() !== nuevoProyecto.toLowerCase()
      );
    }

    // SINCRONIZAR EL FORMULARIO SUPERIOR
    this.filtrosForm.patchValue(
      { proyecto: nuevoProyecto },
      { emitEvent: false }
    );

    this.filtrosActuales = {
      ...this.filtrosActuales,

      proyecto: nuevoProyecto ?? undefined,

      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.cargarDashboard();
  }


  // CLIENTE - EXCLUSIÓN MÚLTIPLE
  cambiarProyectosExcluidos(proyectos: string[]): void {

    const vistos = new Set<string>();
    const seleccion: string[] = [];

    for (const proyecto of proyectos) {

      const nombre = proyecto.trim();
      const clave = nombre.toLowerCase();

      if (!nombre || vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);
      seleccion.push(nombre);
    }

    const anteriores = new Set(
      this.proyectosExcluidos.map(
        item => item.trim().toLowerCase()
      )
    );

    if (
      anteriores.size === seleccion.length &&
      seleccion.every(item => anteriores.has(item.toLowerCase()))
    ) {
      return;
    }

    this.proyectosExcluidos = seleccion;

    let proyectoActual = this.filtrosActuales.proyecto;

    if (
      proyectoActual &&
      seleccion.some(
        item => item.toLowerCase() === proyectoActual!.toLowerCase()
      )
    ) {
      proyectoActual = undefined;

      this.filtrosForm.patchValue(
        { proyecto: null },
        { emitEvent: false }
      );
    }

    this.filtrosActuales = {
      ...this.filtrosActuales,

      proyecto: proyectoActual,

      proyectos_excluidos: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };

    this.cargarDashboard();
  }


  // RESOLUTOR - RENDIMIENTO MENSUAL
  private cargarRendimientoResolutores(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.suscripcionRendimientoResolutores?.unsubscribe();

    this.cargandoRendimientoResolutores = true;
    this.errorRendimientoResolutores = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerRendimientoResolutores(
        filtros,
        this.paginaResolutores,
        this.tamanoResolutores
      )
      .subscribe({
        next: (datos) => {
          this.rendimientoResolutores = datos;
          this.cargandoRendimientoResolutores = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando rendimiento de resolutores:', error);

          this.rendimientoResolutores = null;
          this.cargandoRendimientoResolutores = false;
          this.errorRendimientoResolutores =
            'No se pudo cargar el Rendimiento por Resolutor.';

          this.changeDetector.markForCheck();
        }
      });

    this.suscripcionRendimientoResolutores = solicitud;
    this.solicitudesDashboard.add(solicitud);
  }


  // RESOLUTOR - PAGINACIÓN
  cambiarPaginaResolutores(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.cargandoRendimientoResolutores ||
      (
        this.paginaResolutores === evento.pagina &&
        this.tamanoResolutores === evento.tamano
      )
    ) {
      return;
    }

    this.paginaResolutores = evento.pagina;
    this.tamanoResolutores = evento.tamano;

    // RECARGAR ÚNICAMENTE LA TABLA
    this.cargarRendimientoResolutores({
      ...this.filtrosActuales
    });
  }


  // RESOLUTOR - FILTRO DINÁMICO
  cambiarResolutor(resolutor: string | null): void {

    const nuevoResolutor = resolutor?.trim() || null;

    if ((this.filtrosActuales.nombre_resolutor ?? null) === nuevoResolutor) {
      return;
    }

    this.filtrosForm.patchValue(
      { nombre_resolutor: nuevoResolutor },
      { emitEvent: false }
    );

    this.filtrosActuales = {
      ...this.filtrosActuales,
      nombre_resolutor: nuevoResolutor ?? undefined
    };

    // SE ACTUALIZAN TODAS LAS SECCIONES
    this.cargarDashboard();
  }


  // RESOLUTOR - NÚMERO DE TICKETS
  private cargarTicketsPorResolutor(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.suscripcionTicketsPorResolutor?.unsubscribe();

    this.cargandoTicketsPorResolutor = true;
    this.errorTicketsPorResolutor = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerTicketsPorResolutor(
        filtros,
        this.limiteTicketsPorResolutor
      )
      .subscribe({
        next: (datos) => {
          this.ticketsPorResolutor = datos;
          this.cargandoTicketsPorResolutor = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error cargando tickets por resolutor:', error);

          this.ticketsPorResolutor = null;
          this.cargandoTicketsPorResolutor = false;
          this.errorTicketsPorResolutor =
            'No se pudo cargar el gráfico de Tickets por Resolutor.';

          this.changeDetector.markForCheck();
        }
      });

    this.suscripcionTicketsPorResolutor = solicitud;
    this.solicitudesDashboard.add(solicitud);
  }


  // RESOLUTOR - CAMBIAR TOP
  cambiarLimiteTicketsPorResolutor(limite: number): void {

    if (
      ![5, 10, 15, 20].includes(limite) ||
      this.limiteTicketsPorResolutor === limite
    ) {
      return;
    }

    this.limiteTicketsPorResolutor = limite;

    // RECARGAR ÚNICAMENTE EL GRÁFICO
    this.cargarTicketsPorResolutor({
      ...this.filtrosActuales
    });
  }

  // RENDIMIENTO DE RESOLUTORES PARA EXPORTACIÓN PNG
  private cargarRendimientoReporte(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    this.cargandoRendimientoReporte = true;
    this.errorRendimientoReporte = null;
    this.rendimientoReporte = null;

    const solicitud = this.incidentConsolidatedService
      .obtenerRendimientoResolutores(filtros, 1, 20)
      .subscribe({

        next: (datos) => {
          this.rendimientoReporte = datos;
          this.cargandoRendimientoReporte = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error(
            'Error cargando resolutores del reporte:',
            error
          );

          this.rendimientoReporte = null;
          this.cargandoRendimientoReporte = false;
          this.errorRendimientoReporte =
            'No se pudo preparar el rendimiento de resolutores del reporte.';

          this.changeDetector.markForCheck();
        }
      });

    this.solicitudesDashboard.add(solicitud);
  }



  // ANÁLISIS EJECUTIVO IA - CARGA AUTOMÁTICA
  private cargarAnalisisEjecutivoIA(
    filtros: IncidentConsolidatedDashboardFilters
  ): void {

    const tokenResumen = this.solicitarFuenteResumen('analisis', filtros);

    this.cargandoAnalisisIA = true;
    this.cargandoHallazgos = true;
    this.cargandoConclusiones = true;

    this.errorAnalisisIA = null;
    this.errorHallazgos = null;
    this.errorConclusiones = null;

    this.resultadoAnalisisIA = null;
    this.principalesHallazgos = null;
    this.conclusiones = null;

    // El backend incorpora el hallazgo de servidores
    // cuando existen asociaciones en el conjunto filtrado.
    // No depende de que el gráfico termine de cargar.
    const incluirServidores = true;

    const solicitud = this.incidentConsolidatedService
      .generarAnalisisEjecutivoIA(
        filtros,
        incluirServidores
      )
      .subscribe({

        next: (resultado) => {

          // RESPUESTA ÚNICA DEL BACKEND
          this.resultadoAnalisisIA = resultado;
          this.recibirFuenteResumen('analisis', tokenResumen, resultado);

          // ACTUALIZAR LOS DOS APARTADOS
          this.principalesHallazgos = resultado.hallazgos;
          this.conclusiones = resultado.conclusiones;

          // FINALIZAR CARGA
          this.cargandoAnalisisIA = false;
          this.cargandoHallazgos = false;
          this.cargandoConclusiones = false;

          this.errorAnalisisIA = null;
          this.errorHallazgos = null;
          this.errorConclusiones = null;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          console.error(
            'Error cargando análisis ejecutivo IA:',
            error
          );

          this.resultadoAnalisisIA = null;
          this.principalesHallazgos = null;
          this.conclusiones = null;

          this.cargandoAnalisisIA = false;
          this.cargandoHallazgos = false;
          this.cargandoConclusiones = false;

          const mensaje =
            'No se pudo obtener el análisis ejecutivo ' +
            'con inteligencia artificial.';

          this.errorAnalisisIA = mensaje;
          this.errorHallazgos = mensaje;
          this.errorConclusiones = mensaje;
          this.fallarFuenteResumen('analisis', tokenResumen);

          this.changeDetector.markForCheck();
        }
      });

    // CANCELAR SI CAMBIAN LOS FILTROS
    // O SI SE DESTRUYE EL COMPONENTE
    this.solicitudesDashboard.add(solicitud);
  }

}
