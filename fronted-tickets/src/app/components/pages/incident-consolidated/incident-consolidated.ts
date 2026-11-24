
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IncidentConsolidatedFilters, IncidentConsolidatedDashboardFilters, IncidentConsolidatedKPI, IncidentConsolidatedVolumenItem, IncidentConsolidatedProyectoItem, IncidentConsolidatedTipoItem, IncidentConsolidatedPrioridadItem, IncidentConsolidatedTopProyectos, IncidentConsolidatedPrioridadMensualItem, IncidentConsolidatedRendimientoOut, IncidentConsolidatedExploradorDescripcionesOut, IncidentConsolidatedDetalleEventosOut, IncidentConsolidatedIncidentesPorcentajesOut, IncidentConsolidatedTopDescripcionProyectoOut, IncidentConsolidatedTopDetallesOut, IncidentConsolidatedTicketsPorResolutorOut, IncidentConsolidatedDetalleEventoItem, IncidentConsolidatedTicketsOut } from '../../../models/incident-consolidated';
import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { Component, OnInit, ChangeDetectorRef, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { forkJoin, Subscription, timeout } from 'rxjs';
import { toPng } from 'html-to-image';
import { IncidentMonthlyReportData } from '../../../models/incident-monthly-report';
import { crearReporteMensual, fechaLima, filtrosReporteMensual } from '../../charts/Consolidated/incident-monthly-report/incident-monthly-report.utils';
import { IncidentProjectReportData } from '../../../models/incident-project-report';
import { IncidentProjectMonthlyRenderError, IncidentProjectMonthlyReportData } from '../../../models/incident-project-monthly-report';
import { claveProyectoMensual, crearReporteProyectoMensual, filtrosReporteProyectoMensual, seleccionProyectoMensualValida } from '../../charts/Consolidated/incident-project-monthly-report/incident-project-monthly-report.utils';
import { claveFiltrosProyectos, crearReporteProyectos, filtrosReporteProyectos, rangoProyectosValido } from '../../charts/Consolidated/incident-project-report/incident-project-report.utils';
import { MAT_DATE_LOCALE, MatDateFormats, provideNativeDateAdapter } from '@angular/material/core';

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
  selector: 'app-incident-consolidated',
  standalone: false,
  templateUrl: './incident-consolidated.html',
  styleUrl: './incident-consolidated.css',
  providers: [
    {
      provide: MAT_DATE_LOCALE,
      useValue: 'es-PE'
    },
    provideNativeDateAdapter(FORMATOS_FECHA)
  ]
})


export class IncidentConsolidated implements OnInit, OnDestroy {

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
    nombres_resolutores: []
  };

  cargandoFiltros = false;
  kpis: IncidentConsolidatedKPI | null = null;
  cargandoKpis = false;
  errorKpis: string | null = null;
  volumenMensual: IncidentConsolidatedVolumenItem[] = [];
  cargandoVolumenMensual = false;
  proyectos: IncidentConsolidatedProyectoItem[] = [];
  cargandoProyectos = false;
  tipos: IncidentConsolidatedTipoItem[] = [];
  tiposGrafico: { categoria: string; cantidad: number; }[] = [];
  cargandoTipos = false;
  tiposIncidenteSeleccionados: string[] = [];
  prioridades: IncidentConsolidatedPrioridadItem[] = [];
  prioridadesGrafico: { categoria: string; cantidad: number; }[] = [];
  cargandoPrioridades = false;
  topProyectos: IncidentConsolidatedTopProyectos = { periodos: [], proyectos: [] };
  cargandoTopProyectos = false;
  prioridadMensual: IncidentConsolidatedPrioridadMensualItem[] = [];
  cargandoPrioridadMensual = false;
  errorDashboard: string | null = null;
  private solicitudDashboard = 0;
  periodoSeleccionado: string | null = null;

  @ViewChild('reporteMensualImagen') reporteMensualImagen?: ElementRef<HTMLElement>;
  datosReporteMensual: IncidentMonthlyReportData | null = null;
  estadoReporteMensual: 'inicial' | 'cargando' | 'sin_datos' | 'preparando' | 'listo' | 'error' = 'inicial';
  errorReporteMensual: string | null = null;
  errorExportacionMensual: string | null = null;
  exportandoReporteMensual = false;
  private versionReporteMensual = 0;
  private reporteMensualDestruido = false;

  get reporteMensualListo(): boolean {
    return !this.reporteMensualDestruido && !this.cargandoFiltros && !this.cargandoVolumenMensual &&
      this.estadoReporteMensual === 'listo' && this.datosReporteMensual !== null &&
      this.datosReporteMensual.version === this.versionReporteMensual &&
      this.datosReporteMensual.solicitud === this.solicitudDashboard;
  }

  private invalidarReporteMensual(): void {
    ++this.versionReporteMensual;
    this.datosReporteMensual = null;
    this.estadoReporteMensual = 'cargando';
    this.errorReporteMensual = null;
    this.errorExportacionMensual = null;
  }

  confirmarRenderMensual(version: number): void {
    if (!this.reporteMensualDestruido && version === this.versionReporteMensual &&
      this.datosReporteMensual?.version === version) {
      this.estadoReporteMensual = 'listo';
      this.changeDetector.markForCheck();
    }
  }

  fallarRenderMensual(version: number): void {
    if (!this.reporteMensualDestruido && version === this.versionReporteMensual && this.datosReporteMensual?.version === version) {
      this.estadoReporteMensual = 'error';
      this.errorReporteMensual = 'No se pudo renderizar el reporte mensual. Reintenta la preparación.';
      this.changeDetector.markForCheck();
    }
  }

  reintentarReporteMensual(): void {
    if (this.reporteMensualDestruido || this.exportandoReporteMensual || this.cargandoVolumenMensual) return;
    if (this.datosReporteMensual && this.datosReporteMensual.solicitud === this.solicitudDashboard) {
      this.datosReporteMensual = { ...this.datosReporteMensual, version: ++this.versionReporteMensual };
      this.estadoReporteMensual = 'preparando';
      this.errorReporteMensual = null;
      this.changeDetector.markForCheck();
    } else {
      this.cargarVolumenMensual();
    }
  }

  async descargarReporteMensual(): Promise<void> {
    if (!this.reporteMensualListo || this.exportandoReporteMensual || !this.datosReporteMensual) return;
    const datos = this.datosReporteMensual;
    this.exportandoReporteMensual = true;
    this.errorExportacionMensual = null;
    this.changeDetector.markForCheck();
    let enlace: HTMLAnchorElement | undefined;
    try {
      // El hijo ya confirmó fuentes y pintura para esta versión del documento.
      if (!this.reporteMensualListo || this.datosReporteMensual !== datos) throw new Error('obsoleto');
      const elemento = this.reporteMensualImagen?.nativeElement.querySelector<HTMLElement>('.report-document');
      if (!elemento) throw new Error('documento');
      const width = Math.ceil(elemento.scrollWidth), height = Math.ceil(elemento.scrollHeight);
      if (width !== 1400 || height <= 0) throw new Error('dimensiones');
      const pixelRatio = height > 4000 ? 1 : 2;
      if (width * pixelRatio > 16384 || height * pixelRatio > 16384 || width * height * pixelRatio ** 2 > 32000000) {
        throw new Error('limite');
      }
      const imagen = await toPng(elemento, {
        backgroundColor: '#F7F9FB', width, height, pixelRatio, skipFonts: true, skipAutoScale: true,
        style: { position: 'static', left: 'auto', top: 'auto', transform: 'none', margin: '0' },
      });
      if (this.reporteMensualDestruido) return;
      if (!this.reporteMensualListo || this.datosReporteMensual !== datos) throw new Error('obsoleto');
      if (!imagen.startsWith('data:image/png;base64,') || imagen.length < 100) throw new Error('imagen');
      enlace = document.createElement('a');
      enlace.href = imagen;
      enlace.download = `CANVIA-Incidentes-Mensuales-${datos.filtros.desde ?? 'inicio'}_${datos.filtros.hasta ?? 'fin'}-${fechaLima(new Date())}.png`;
      document.body.appendChild(enlace);
      enlace.click();
    } catch (error) {
      if (!this.reporteMensualDestruido) {
        const causa = error instanceof Error ? error.message : '';
        this.errorExportacionMensual = causa === 'obsoleto'
          ? 'Los filtros o los datos cambiaron durante la captura. Descarga el reporte actualizado.'
          : causa === 'limite'
            ? 'El reporte supera el tamaño de imagen permitido. Reduce el rango de fechas para descargarlo completo.'
            : 'No fue posible generar el PNG completo. Reintenta la descarga.';
      }
    } finally {
      enlace?.remove();
      this.exportandoReporteMensual = false;
      if (!this.reporteMensualDestruido) this.changeDetector.markForCheck();
    }
  }



  // R02 - REPORTE GENERAL POR PROYECTO
  @ViewChild('reporteProyectosImagen') reporteProyectosImagen?: ElementRef<HTMLElement>;
  datosReporteProyectos: IncidentProjectReportData | null = null;
  estadoReporteProyectos: 'inicial' | 'cargando' | 'preparando' | 'listo' | 'sin_datos' | 'error' = 'inicial';
  errorReporteProyectos: string | null = null;
  exportandoReporteProyectos = false;
  private versionReporteProyectos = 0;
  private claveReporteProyectos: string | null = null;
  private consultaReporteProyectos?: Subscription;
  private capturaProyectosActiva = false;
  private reporteProyectosDestruido = false;

  get puedeGenerarReporteProyectos(): boolean {
    return !this.reporteProyectosDestruido && !this.cargandoFiltros && !this.exportandoReporteProyectos &&
      rangoProyectosValido(filtrosReporteProyectos(this.filtrosActuales));
  }

  private invalidarReporteProyectos(): void {
    ++this.versionReporteProyectos;
    this.consultaReporteProyectos?.unsubscribe();
    this.datosReporteProyectos = null;
    this.claveReporteProyectos = null;
    this.estadoReporteProyectos = 'inicial';
    this.errorReporteProyectos = null;
    this.exportandoReporteProyectos = this.capturaProyectosActiva;
  }

  private sincronizarReporteProyectos(): void {
    if (this.claveReporteProyectos !== null && this.claveReporteProyectos !== claveFiltrosProyectos(this.filtrosActuales)) {
      this.invalidarReporteProyectos();
    }
  }

  private reporteProyectosVigente(version: number): boolean {
    return !this.reporteProyectosDestruido && version === this.versionReporteProyectos &&
      this.claveReporteProyectos === claveFiltrosProyectos(this.filtrosActuales);
  }

  generarReporteProyectos(): void {
    if (!this.puedeGenerarReporteProyectos) return;
    this.invalidarReporteProyectos();
    const version = this.versionReporteProyectos;
    const filtros = filtrosReporteProyectos(this.filtrosActuales);
    const disponibilidad = { fecha_min: this.opcionesFiltros.fecha_min, fecha_max: this.opcionesFiltros.fecha_max };
    this.claveReporteProyectos = claveFiltrosProyectos(filtros);
    this.estadoReporteProyectos = 'cargando';
    this.exportandoReporteProyectos = true;
    this.consultaReporteProyectos = forkJoin({
      kpis: this.incidentConsolidatedService.obtenerKpis(filtros).pipe(timeout(30000)),
      proyectos: this.incidentConsolidatedService.obtenerProyectos(filtros).pipe(timeout(30000)),
      top: this.incidentConsolidatedService.obtenerTopProyectos(filtros).pipe(timeout(30000)),
      volumen: this.incidentConsolidatedService.obtenerVolumenMensual(filtros).pipe(timeout(30000)),
    }).subscribe({
      next: respuestas => {
        if (!this.reporteProyectosVigente(version)) { this.sincronizarReporteProyectos(); return; }
        try {
          const reporte = crearReporteProyectos(respuestas, filtros, disponibilidad, version, new Date().toISOString());
          this.datosReporteProyectos = reporte.total > 0 ? reporte : null;
          this.estadoReporteProyectos = reporte.total > 0 ? 'preparando' : 'sin_datos';
          if (reporte.total === 0) this.exportandoReporteProyectos = false;
        } catch (error) { this.fallarPreparacionProyectos(error); }
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (!this.reporteProyectosVigente(version)) { this.sincronizarReporteProyectos(); return; }
        this.fallarPreparacionProyectos(new Error('No se pudieron completar las cuatro consultas de Reporte 2. Reintenta la preparación.'));
      },
      complete: () => {
        if (this.reporteProyectosVigente(version) && this.estadoReporteProyectos === 'cargando') {
          this.fallarPreparacionProyectos(new Error('Las consultas de Reporte 2 terminaron sin todos los agregados requeridos.'));
        }
      },
    });
    this.changeDetector.markForCheck();
  }

  private fallarPreparacionProyectos(error: unknown): void {
    this.estadoReporteProyectos = 'error';
    this.exportandoReporteProyectos = false;
    this.errorReporteProyectos = error instanceof Error && !(error instanceof TypeError)
      ? error.message : 'No se pudieron validar los datos de Reporte 2. Reintenta la preparación.';
    this.changeDetector.markForCheck();
  }

  confirmarRenderProyectos(version: number): void {
    if (!this.reporteProyectosVigente(version) || this.datosReporteProyectos?.version !== version ||
      this.estadoReporteProyectos !== 'preparando') return;
    this.estadoReporteProyectos = 'listo';
    void this.capturarReporteProyectos(this.datosReporteProyectos);
  }

  fallarRenderProyectos(version: number): void {
    if (this.reporteProyectosVigente(version) && this.datosReporteProyectos?.version === version) {
      this.fallarPreparacionProyectos(new Error('No se pudo renderizar Reporte 2. Reintenta la preparación.'));
    }
  }

  reintentarReporteProyectos(): void {
    if (!this.puedeGenerarReporteProyectos) return;
    const datos = this.datosReporteProyectos;
    if (!datos || !this.reporteProyectosVigente(datos.version)) { this.generarReporteProyectos(); return; }
    this.datosReporteProyectos = { ...datos, version: ++this.versionReporteProyectos };
    this.estadoReporteProyectos = 'preparando';
    this.errorReporteProyectos = null;
    this.exportandoReporteProyectos = true;
    this.changeDetector.markForCheck();
  }

  private async capturarReporteProyectos(datos: IncidentProjectReportData): Promise<void> {
    if (this.capturaProyectosActiva || !this.reporteProyectosVigente(datos.version)) return;
    this.capturaProyectosActiva = true;
    let enlace: HTMLAnchorElement | undefined;
    try {
      const elemento = this.reporteProyectosImagen?.nativeElement.querySelector<HTMLElement>('.report-document');
      if (!elemento) throw new Error('documento');
      const width = Math.ceil(elemento.scrollWidth), height = Math.ceil(elemento.scrollHeight);
      if (width !== 1400 || !Number.isFinite(height) || height <= 0) throw new Error('dimensiones');
      const pixelRatio = height > 4000 ? 1 : 2;
      if (width * pixelRatio > 16384 || height * pixelRatio > 16384 || width * height * pixelRatio ** 2 > 32000000) throw new Error('limite');
      const imagen = await toPng(elemento, {
        backgroundColor: '#F7F9FB', width, height, pixelRatio, skipFonts: true, skipAutoScale: true,
        style: { position: 'static', left: 'auto', top: 'auto', transform: 'none', margin: '0' },
      });
      if (this.reporteProyectosDestruido) return;
      if (!this.reporteProyectosVigente(datos.version) || this.datosReporteProyectos !== datos) throw new Error('obsoleto');
      if (!imagen.startsWith('data:image/png;base64,') || imagen.length < 100) throw new Error('imagen');
      enlace = document.createElement('a'); enlace.href = imagen;
      enlace.download = `CANVIA-Tickets-Proyecto-${datos.filtros.desde}_${datos.filtros.hasta}-${fechaLima(new Date())}.png`;
      document.body.appendChild(enlace); enlace.click();
    } catch (error) {
      if (!this.reporteProyectosDestruido) {
        const causa = error instanceof Error ? error.message : '';
        this.estadoReporteProyectos = 'error';
        this.errorReporteProyectos = causa === 'obsoleto' ? 'Los filtros cambiaron durante la captura. Genera Reporte 2 nuevamente.'
          : causa === 'limite' ? 'Reporte 2 supera el tamaño de imagen permitido. Reduce el rango de fechas para descargarlo completo.'
            : 'No fue posible generar el PNG completo de Reporte 2. Puedes reintentar la descarga.';
      }
    } finally {
      enlace?.remove(); this.capturaProyectosActiva = false; this.exportandoReporteProyectos = false;
      if (!this.reporteProyectosDestruido) this.changeDetector.markForCheck();
    }
  }

  // R03 - PROYECTO SELECCIONADO: consultas y versiones independientes de R01/R02.
  @ViewChild('reporteProyectoMensualImagen') reporteProyectoMensualImagen?: ElementRef<HTMLElement>;
  datosReporteProyectoMensual: IncidentProjectMonthlyReportData | null = null;
  estadoReporteProyectoMensual: 'inicial' | 'cargando' | 'preparando' | 'listo' | 'sin_datos' | 'error' = 'inicial';
  errorReporteProyectoMensual: string | null = null;
  exportandoReporteProyectoMensual = false;
  private versionProyectoMensual = 0;
  private claveReporteProyectoMensual: string | null = null;
  private consultaProyectoMensual?: Subscription;
  private capturaProyectoMensualActiva = false;
  private proyectoMensualDestruido = false;

  get puedeGenerarReporteProyectoMensual(): boolean {
    return !this.proyectoMensualDestruido && !this.cargandoFiltros && !this.exportandoReporteProyectoMensual &&
      seleccionProyectoMensualValida(filtrosReporteProyectoMensual(this.filtrosActuales, this.proyectoSeleccionado));
  }
  private invalidarReporteProyectoMensual(): void {
    ++this.versionProyectoMensual;
    this.consultaProyectoMensual?.unsubscribe();
    this.datosReporteProyectoMensual = null; this.claveReporteProyectoMensual = null;
    this.estadoReporteProyectoMensual = 'inicial'; this.errorReporteProyectoMensual = null;
    this.exportandoReporteProyectoMensual = this.capturaProyectoMensualActiva;
  }
  private sincronizarReporteProyectoMensual(): void {
    if (this.claveReporteProyectoMensual !== null && this.claveReporteProyectoMensual !== claveProyectoMensual(this.filtrosActuales, this.proyectoSeleccionado)) this.invalidarReporteProyectoMensual();
  }
  private proyectoMensualVigente(version: number): boolean {
    return !this.proyectoMensualDestruido && version === this.versionProyectoMensual &&
      this.claveReporteProyectoMensual === claveProyectoMensual(this.filtrosActuales, this.proyectoSeleccionado);
  }
  generarReporteProyectoMensual(): void {
    if (!this.puedeGenerarReporteProyectoMensual) return;
    this.invalidarReporteProyectoMensual();
    const version = this.versionProyectoMensual;
    const filtros = filtrosReporteProyectoMensual(this.filtrosActuales, this.proyectoSeleccionado);
    const disponibilidad = { fecha_min: this.opcionesFiltros.fecha_min, fecha_max: this.opcionesFiltros.fecha_max };
    this.claveReporteProyectoMensual = claveProyectoMensual(filtros, filtros.proyecto);
    this.estadoReporteProyectoMensual = 'cargando'; this.exportandoReporteProyectoMensual = true;
    this.consultaProyectoMensual = forkJoin({
      kpis: this.incidentConsolidatedService.obtenerKpis(filtros).pipe(timeout(30000)),
      top: this.incidentConsolidatedService.obtenerTopProyectos(filtros).pipe(timeout(30000)),
    }).subscribe({
      next: respuestas => {
        if (!this.proyectoMensualVigente(version)) { this.sincronizarReporteProyectoMensual(); return; }
        try {
          const datos = crearReporteProyectoMensual(respuestas, filtros, disponibilidad, version, new Date().toISOString());
          this.datosReporteProyectoMensual = datos.mensual.total > 0 ? datos : null;
          this.estadoReporteProyectoMensual = datos.mensual.total > 0 ? 'preparando' : 'sin_datos';
          if (!datos.mensual.total) this.exportandoReporteProyectoMensual = false;
        } catch (error) { this.fallarPreparacionProyectoMensual(error); }
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (!this.proyectoMensualVigente(version)) { this.sincronizarReporteProyectoMensual(); return; }
        this.fallarPreparacionProyectoMensual(new Error('No se pudieron completar las consultas de Reporte 3. Reintenta la preparación.'));
      },
      complete: () => {
        if (this.proyectoMensualVigente(version) && this.estadoReporteProyectoMensual === 'cargando') this.fallarPreparacionProyectoMensual(new Error('Las consultas de Reporte 3 terminaron sin los agregados requeridos.'));
      },
    });
    this.changeDetector.markForCheck();
  }
  private fallarPreparacionProyectoMensual(error: unknown): void {
    this.estadoReporteProyectoMensual = 'error'; this.exportandoReporteProyectoMensual = false;
    this.errorReporteProyectoMensual = error instanceof Error && !(error instanceof TypeError) ? error.message : 'No se pudieron validar los datos del proyecto para Reporte 3.';
    this.changeDetector.markForCheck();
  }
  confirmarRenderProyectoMensual(version: number): void {
    if (!this.proyectoMensualVigente(version) || this.datosReporteProyectoMensual?.version !== version || this.estadoReporteProyectoMensual !== 'preparando') return;
    this.estadoReporteProyectoMensual = 'listo';
    void this.capturarReporteProyectoMensual(this.datosReporteProyectoMensual);
  }
  fallarRenderProyectoMensual(error: IncidentProjectMonthlyRenderError): void {
    if (this.proyectoMensualVigente(error.version) && this.datosReporteProyectoMensual?.version === error.version) this.fallarPreparacionProyectoMensual(new Error(error.motivo === 'legibilidad'
      ? 'Reporte 3 no cabe en una composición horizontal legible. Reduce el rango de fechas para conservar todos los meses y valores sin recortes.'
      : 'No se pudo renderizar Reporte 3. Puedes reintentar la preparación.'));
  }
  reintentarReporteProyectoMensual(): void {
    if (!this.puedeGenerarReporteProyectoMensual) return;
    const datos = this.datosReporteProyectoMensual;
    if (!datos || !this.proyectoMensualVigente(datos.version)) { this.generarReporteProyectoMensual(); return; }
    this.datosReporteProyectoMensual = { ...datos, version: ++this.versionProyectoMensual };
    this.estadoReporteProyectoMensual = 'preparando'; this.errorReporteProyectoMensual = null; this.exportandoReporteProyectoMensual = true;
    this.changeDetector.markForCheck();
  }
  private async capturarReporteProyectoMensual(datos: IncidentProjectMonthlyReportData): Promise<void> {
    if (this.capturaProyectoMensualActiva || !this.proyectoMensualVigente(datos.version)) return;
    this.capturaProyectoMensualActiva = true;
    let enlace: HTMLAnchorElement | undefined, temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      const elemento = this.reporteProyectoMensualImagen?.nativeElement.querySelector<HTMLElement>('.report-document');
      if (!elemento) throw new Error('documento');
      const width = Math.ceil(elemento.scrollWidth), height = Math.ceil(elemento.scrollHeight);
      if (width !== 1400 || !Number.isFinite(height) || height <= 0) throw new Error('dimensiones');
      const pixelRatio = height > 4000 ? 1 : 2;
      if (width * pixelRatio > 16384 || height * pixelRatio > 16384 || width * height * pixelRatio ** 2 > 32000000) throw new Error('limite');
      const imagen = await Promise.race([
        toPng(elemento, { backgroundColor: '#F7F9FB', width, height, pixelRatio, skipFonts: true, skipAutoScale: true,
          style: { position: 'static', left: 'auto', top: 'auto', transform: 'none', margin: '0' } }),
        new Promise<never>((_, reject) => { temporizador = setTimeout(() => reject(new Error('timeout')), 30000); }),
      ]);
      if (this.proyectoMensualDestruido) return;
      if (!this.proyectoMensualVigente(datos.version) || this.datosReporteProyectoMensual !== datos) throw new Error('obsoleto');
      if (!imagen.startsWith('data:image/png;base64,') || imagen.length < 100) throw new Error('imagen');
      enlace = document.createElement('a'); enlace.href = imagen;
      enlace.download = `CANVIA-Tickets-Mes-Proyecto-Seleccionado-${datos.filtros.desde}_${datos.filtros.hasta}-${fechaLima(new Date())}.png`;
      document.body.appendChild(enlace); enlace.click();
    } catch (error) {
      if (!this.proyectoMensualDestruido) {
        const causa = error instanceof Error ? error.message : '';
        this.estadoReporteProyectoMensual = 'error';
        this.errorReporteProyectoMensual = causa === 'obsoleto' ? 'El proyecto o los filtros cambiaron durante la captura. Genera Reporte 3 nuevamente.'
          : causa === 'limite' ? 'Reporte 3 supera el tamaño de imagen permitido. Reduce el rango para descargarlo completo.'
            : causa === 'timeout' ? 'La captura de Reporte 3 superó el tiempo permitido. Puedes reintentar la descarga.'
              : 'No fue posible generar el PNG completo de Reporte 3. Puedes reintentar la descarga.';
      }
    } finally {
      clearTimeout(temporizador); enlace?.remove(); this.capturaProyectoMensualActiva = false; this.exportandoReporteProyectoMensual = false;
      if (!this.proyectoMensualDestruido) this.changeDetector.markForCheck();
    }
  }

  // TABLA PAGINADA - EXPLORADOR DE TICKETS
  ticketsDetalle: IncidentConsolidatedTicketsOut | null = null;
  cargandoTickets = false;
  errorTickets: string | null = null;
  paginaTickets = 1;
  tamanoTickets = 10;
  ticketIdSeleccionado: string | null = null;
  private solicitudTickets = 0;




  //FIltro Proyectos
  opcionesProyectos: string[] = [];
  proyectoSeleccionado: string | null = null;
  proyectosExcluidos: string[] = [];
  private solicitudOpcionesProyectos = 0;
  private temporizadorExclusiones: ReturnType<typeof setTimeout> | null = null;



  // RENDIMIENTO POR RESOLUTOR
  rendimientoResolutores: IncidentConsolidatedRendimientoOut | null = null;
  cargandoRendimientoResolutores = false;
  paginaResolutores = 1;
  tamanoResolutores = 5;
  resolutorSeleccionado: string | null = null;
  private solicitudRendimientoResolutores = 0;

  // EXPLORADOR POR DESCRIPCIONES
  exploradorDescripciones: IncidentConsolidatedExploradorDescripcionesOut | null = null;
  cargandoExploradorDescripciones = false;
  paginaDescripciones = 1;
  tamanoDescripciones = 5;
  busquedaDescripcion = '';
  descripcionSeleccionada: string | null = null;
  private solicitudExploradorDescripciones = 0;
  private temporizadorBusquedaDescripciones: ReturnType<typeof setTimeout> | null = null;

  // TABLA DETALLE DE EVENTOS TECNICOS
  detalleEventosTecnicos: IncidentConsolidatedDetalleEventosOut | null = null;
  cargandoDetalleEventosTecnicos = false;
  paginaDetalles = 1;
  tamanoDetalles = 5;
  busquedaDetalles = '';
  detalleSeleccionadoId: string | null = null;
  detalleSeleccionadoTexto: string | null = null;
  private solicitudDetalleEventosTecnicos = 0;
  private temporizadorBusquedaDetalles: ReturnType<typeof setTimeout> | null = null;

  // NRO DE INCIDENTES X PORCENTAJES
  incidentesPorcentajes: IncidentConsolidatedIncidentesPorcentajesOut | null = null;
  cargandoIncidentesPorcentajes = false;
  limiteIncidentesPorcentajes = 5;
  private solicitudIncidentesPorcentajes = 0;

  // TOP 10 DESCRIPCION Y PROYECTO
  topDescripcionesProyectos: IncidentConsolidatedTopDescripcionProyectoOut | null = null;
  cargandoTopDescripcionesProyectos = false;
  private solicitudTopDescripcionesProyectos = 0;

  // TOP 10 TICKETS POR DETALLE
  topDetalles: IncidentConsolidatedTopDetallesOut | null = null;
  cargandoTopDetalles = false;
  private solicitudTopDetalles = 0;

  // NUMERO DE TICKETS POR RESOLUTOR
  ticketsPorResolutor: IncidentConsolidatedTicketsPorResolutorOut | null = null;
  cargandoTicketsPorResolutor = false;
  limiteTicketsPorResolutor = 5;
  private solicitudTicketsPorResolutor = 0;


  //09/11/2026
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
      console.error('Error al cambiar pantalla completa:', error);
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id ?? null;

    this.changeDetector.markForCheck();
  }



  get cargandoDashboard(): boolean {
    return (
      this.cargandoKpis ||
      this.cargandoVolumenMensual ||
      this.cargandoProyectos ||
      this.cargandoTipos ||
      this.cargandoPrioridades ||
      this.cargandoTopProyectos ||
      this.cargandoPrioridadMensual ||
      this.cargandoRendimientoResolutores ||
      this.cargandoExploradorDescripciones ||
      this.cargandoDetalleEventosTecnicos ||
      this.cargandoIncidentesPorcentajes ||
      this.cargandoTopDescripcionesProyectos ||
      this.cargandoTopDetalles ||
      this.cargandoTicketsPorResolutor ||
      this.cargandoTickets
    );
  }


  constructor(
    private formBuilder: FormBuilder,
    private incidentConsolidatedService: IncidentConsolidatedService,
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>
  ) { }



  ngOnDestroy(): void {
    this.proyectoMensualDestruido = true;
    this.invalidarReporteProyectoMensual();
    this.reporteProyectosDestruido = true;
    this.invalidarReporteProyectos();
    this.reporteMensualDestruido = true;
    this.invalidarReporteMensual();
    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    this.solicitudDashboard++;
    this.solicitudExploradorDescripciones++;
    this.solicitudDetalleEventosTecnicos++;
    this.solicitudIncidentesPorcentajes++;
    this.solicitudTopDescripcionesProyectos++;
    this.solicitudTopDetalles++;
    this.solicitudTicketsPorResolutor++;
    this.solicitudTickets++;
  }

  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
    //this.cargarOpcionesProyectos();
  }


  cargarDashboard(): void {
    this.sincronizarReporteProyectoMensual();
    this.sincronizarReporteProyectos();

    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
      this.temporizadorExclusiones = null;
    }

    const solicitudActual = ++this.solicitudDashboard;

    this.errorDashboard = null;
    this.errorKpis = null;

    // REINICIAR PAGINACIONES
    this.paginaResolutores = 1;
    this.paginaDescripciones = 1;
    this.paginaDetalles = 1;
    this.paginaTickets = 1;


    // GRAFICOS EXISTENTES
    this.cargarKpis(solicitudActual);
    this.cargarVolumenMensual(solicitudActual);
    this.cargarProyectos(solicitudActual);
    this.cargarTipos(solicitudActual);
    this.cargarPrioridades(solicitudActual);
    this.cargarTopProyectos(solicitudActual);
    this.cargarPrioridadMensual(solicitudActual);

    // NUEVOS COMPONENTES
    this.cargarRendimientoResolutores(solicitudActual);
    this.cargarExploradorDescripciones(solicitudActual);
    this.cargarDetalleEventosTecnicos(solicitudActual);
    this.cargarIncidentesPorcentajes(solicitudActual);
    this.cargarTopDescripcionesProyectos(solicitudActual);
    this.cargarTopDetalles(solicitudActual);
    this.cargarTicketsPorResolutor(solicitudActual);
    this.cargarTickets(solicitudActual);

    this.changeDetector.markForCheck();
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
    console.log(
      'Controles del formulario:',
      Object.keys(this.filtrosForm.controls)
    );
  }

  cargarOpcionesFiltros(): void {

    this.cargandoFiltros = true;

    this.incidentConsolidatedService
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
          console.error('Error obteniendo filtros:', error);
          this.cargandoFiltros = false;
          this.cargarOpcionesProyectos();
          this.cargarDashboard();
          this.changeDetector.markForCheck();
        }
      });
  }


  aplicarFiltros(): void {
    if (this.filtrosForm.invalid) {
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

      // CONSERVAR PROYECTOS EXCLUIDOS
      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.proyectoSeleccionado = null;
    this.resolutorSeleccionado = null;
    this.descripcionSeleccionada = null;
    this.tiposIncidenteSeleccionados = [];
    this.periodoSeleccionado = null;
    this.detalleSeleccionadoId = null;
    this.detalleSeleccionadoTexto = null;
    this.ticketIdSeleccionado = null;

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  limpiarFiltros(): void {

    this.filtrosForm.reset({
      desde: null,
      hasta: null,
      prioridad: null,
      motivo_estado: null,
      motivo_resolucion: null,
      grupo_resolutor: this.grupoResolutorPorDefecto
    });

    // feat/mejoras-analisis-incidentes-gpt
    this.filtrosActuales = { grupo_resolutor: this.grupoResolutorPorDefecto };

    this.proyectosExcluidos = [];
    this.establecerFechasPorDefecto();

    this.proyectoSeleccionado = null;
    this.resolutorSeleccionado = null;
    this.descripcionSeleccionada = null;

    // FILTROS DINAMICOS
    this.tiposIncidenteSeleccionados = [];
    this.periodoSeleccionado = null;
    this.ticketIdSeleccionado = null;
    this.detalleSeleccionadoId = null;
    this.detalleSeleccionadoTexto = null;

    // LIMPIAR BUSQUEDAS
    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    // RECARGAR DATOS
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
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

  private registrarError(mensaje: string, error: unknown): void {
    console.error(mensaje, error);
    this.errorDashboard = 'Algunos elementos del dashboard no pudieron actualizarse.';
  }

  cargarKpis(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoKpis = true;
    this.incidentConsolidatedService
      .obtenerKpis({ ...this.filtrosActuales })
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
          console.error('Error obteniendo KPIs:', error);
          this.errorKpis = 'No se pudieron actualizar los KPIs.';
          this.cargandoKpis = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  // CARGAR NUMERO DE INCIDENTES POR MES
  cargarVolumenMensual(solicitudActual: number = this.solicitudDashboard): void {

    this.invalidarReporteMensual();
    const versionReporte = this.versionReporteMensual;
    this.cargandoVolumenMensual = true;

    const filtrosBase = filtrosReporteMensual(this.filtrosActuales);
    const disponibilidad = {
      fecha_min: this.opcionesFiltros.fecha_min,
      fecha_max: this.opcionesFiltros.fecha_max,
    };

    this.incidentConsolidatedService
      .obtenerVolumenMensual(filtrosBase)
      .pipe(timeout(30000))
      .subscribe({

        next: (data) => {

          // DESCARTAR RESPUESTAS OBSOLETAS
          if (solicitudActual !== this.solicitudDashboard || versionReporte !== this.versionReporteMensual || this.reporteMensualDestruido) {
            return;
          }

          this.volumenMensual = data;
          this.cargandoVolumenMensual = false;
          try {
            const reporte = crearReporteMensual(data, filtrosBase, disponibilidad, versionReporte, solicitudActual, new Date().toISOString());
            this.datosReporteMensual = reporte.total > 0 ? reporte : null;
            this.estadoReporteMensual = reporte.total > 0 ? 'preparando' : 'sin_datos';
          } catch (error) {
            this.estadoReporteMensual = 'error';
            this.errorReporteMensual = error instanceof Error ? error.message : 'No se pudieron validar los datos del reporte mensual.';
          }
          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (solicitudActual !== this.solicitudDashboard || versionReporte !== this.versionReporteMensual || this.reporteMensualDestruido) {
            return;
          }

          this.registrarError(
            'Error obteniendo volumen mensual:',
            error
          );

          this.cargandoVolumenMensual = false;
          this.estadoReporteMensual = 'error';
          this.errorReporteMensual = 'No se pudo cargar el volumen mensual. Reintenta la consulta.';
          this.changeDetector.markForCheck();
        }
      });
  }


  cargarProyectos(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoProyectos = true;
    this.incidentConsolidatedService
      .obtenerProyectos({ ...this.filtrosActuales })
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
          this.registrarError('Error obteniendo proyectos:', error);
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }



  // ====================================================
  // CARGAR DISTRIBUCION POR TIPO DE INCIDENTE
  // ====================================================

  cargarTipos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    this.cargandoTipos = true;

    const filtrosBase: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      tipo_incidente: undefined
    };

    this.incidentConsolidatedService
      .obtenerTipos(filtrosBase)
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard
          ) {
            return;
          }

          this.tipos = data;

          this.tiposGrafico = data.map(item => ({
            categoria: item.tipo_incidente,
            cantidad: item.cantidad
          }));

          this.cargandoTipos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo tipos de incidentes:',
            error
          );

          this.cargandoTipos = false;

          this.changeDetector.markForCheck();
        }

      });
  }


  cargarPrioridades(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoPrioridades = true;
    this.incidentConsolidatedService
      .obtenerPrioridades({ ...this.filtrosActuales })
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
          this.registrarError(
            'Error obteniendo prioridades:',
            error
          );
          this.cargandoPrioridades = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarTopProyectos(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoTopProyectos = true;
    this.incidentConsolidatedService
      .obtenerTopProyectos({ ...this.filtrosActuales })
      .subscribe({
        next: (data) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.topProyectos = data;
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          if (solicitudActual !== this.solicitudDashboard) {
            return;
          }
          this.registrarError('Error obteniendo Top 10 proyectos:', error);
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cargarPrioridadMensual(solicitudActual: number = this.solicitudDashboard): void {
    this.cargandoPrioridadMensual = true;
    this.incidentConsolidatedService
      .obtenerPrioridadMensual({ ...this.filtrosActuales })
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
          this.registrarError('Error obteniendo prioridad mensual:', error);
          this.cargandoPrioridadMensual = false;
          this.changeDetector.markForCheck();
        }

      });

  }



  //Filtro Proyectos
  cargarOpcionesProyectos(): void {

    const solicitudActual = ++this.solicitudOpcionesProyectos;

    const filtrosBase: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined,
      proyectos_excluidos: undefined,
      ticket_id: undefined
    };

    this.incidentConsolidatedService
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

    if (proyecto) {
      const claveProyecto = proyecto.trim().toLocaleLowerCase();
      this.proyectosExcluidos = this.proyectosExcluidos.filter(excluido => excluido.trim().toLocaleLowerCase() !== claveProyecto);
    }

    this.proyectoSeleccionado = proyecto;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      proyecto: proyecto ?? undefined,

      proyectos_excluidos: this.proyectosExcluidos.length > 0
        ? [...this.proyectosExcluidos]
        : undefined
    };

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    this.cargarDashboard();
  }


  cargarRendimientoResolutores(solicitudActual: number = this.solicitudDashboard): void {
    const solicitudTabla = ++this.solicitudRendimientoResolutores;
    this.cargandoRendimientoResolutores = true;
    this.incidentConsolidatedService
      .obtenerRendimientoResolutores(
        { ...this.filtrosActuales },
        this.paginaResolutores,
        this.tamanoResolutores
      )
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudRendimientoResolutores
          ) {
            return;
          }

          this.rendimientoResolutores = data;
          this.cargandoRendimientoResolutores = false;
          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudRendimientoResolutores
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo rendimiento por resolutor:',
            error
          );

          this.cargandoRendimientoResolutores = false;
          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaResolutores(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaResolutores === evento.pagina &&
      this.tamanoResolutores === evento.tamano
    ) {
      return;
    }

    this.paginaResolutores = evento.pagina;
    this.tamanoResolutores = evento.tamano;

    this.cargarRendimientoResolutores();
  }

  // FILTRO GLOBAL POR RESOLUTOR
  cambiarResolutor(resolutor: string | null): void {

    if (this.resolutorSeleccionado === resolutor) {
      return;
    }

    this.resolutorSeleccionado = resolutor;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      nombre_resolutor: resolutor ?? undefined
    };

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }

  cargarExploradorDescripciones(
    solicitudActual: number = this.solicitudDashboard
  ): void {
    const solicitudTabla = ++this.solicitudExploradorDescripciones;
    this.cargandoExploradorDescripciones = true;

    this.incidentConsolidatedService
      .obtenerExploradorDescripciones(
        { ...this.filtrosActuales },
        this.paginaDescripciones,
        this.tamanoDescripciones,
        this.busquedaDescripcion
      )
      .subscribe({
        next: (data) => {
          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudExploradorDescripciones
          ) {
            return;
          }

          this.exploradorDescripciones = data;
          this.cargandoExploradorDescripciones = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudExploradorDescripciones
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo explorador por descripciones:',
            error
          );

          this.cargandoExploradorDescripciones = false;
          this.exploradorDescripciones = null;

          this.changeDetector.markForCheck();
        }
      });
  }

  cambiarPaginaDescripciones(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaDescripciones === evento.pagina &&
      this.tamanoDescripciones === evento.tamano
    ) {
      return;
    }

    this.paginaDescripciones = evento.pagina;
    this.tamanoDescripciones = evento.tamano;

    this.cargarExploradorDescripciones();
  }

  cambiarBusquedaDescripciones(busqueda: string): void {

    this.busquedaDescripcion = busqueda;
    this.paginaDescripciones = 1;

    // INVALIDAR RESPUESTAS DE BUSQUEDAS ANTERIORES
    this.solicitudExploradorDescripciones++;
    this.cargandoExploradorDescripciones = true;

    if (this.temporizadorBusquedaDescripciones !== null) {
      clearTimeout(this.temporizadorBusquedaDescripciones);
    }

    this.temporizadorBusquedaDescripciones = setTimeout(() => {

      this.temporizadorBusquedaDescripciones = null;

      this.cargarExploradorDescripciones();

    }, 300);

    this.changeDetector.markForCheck();
  }

  // FILTRO GLOBAL POR DESCRIPCION
  cambiarDescripcion(descripcion: string | null): void {

    if (this.descripcionSeleccionada === descripcion) {
      return;
    }

    this.descripcionSeleccionada = descripcion;

    this.filtrosActuales = {
      ...this.filtrosActuales,
      descripcion: descripcion ?? undefined
    };

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  private reiniciarBusquedaDescripciones(): void {

    if (this.temporizadorBusquedaDescripciones !== null) {
      clearTimeout(this.temporizadorBusquedaDescripciones);
      this.temporizadorBusquedaDescripciones = null;
    }

    this.busquedaDescripcion = '';
  }


  // CARGAR TABLA DETALLE DE EVENTOS TECNICOS
  cargarDetalleEventosTecnicos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudTabla =
      ++this.solicitudDetalleEventosTecnicos;
    this.cargandoDetalleEventosTecnicos = true;


    // EXCLUIR SOLO EL FILTRO PROPIO DE LA TABLA
    const filtrosBase: IncidentConsolidatedDashboardFilters = {
      ...this.filtrosActuales,
      detalle_id: undefined
    };


    // REALIZAR PETICION
    this.incidentConsolidatedService
      .obtenerDetalleEventosTecnicos(
        filtrosBase,
        this.paginaDetalles,
        this.tamanoDetalles,
        this.busquedaDetalles
      )
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudDetalleEventosTecnicos
          ) {
            return;
          }

          this.detalleEventosTecnicos = data;
          this.cargandoDetalleEventosTecnicos = false;
          this.changeDetector.markForCheck();
        },


        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudDetalleEventosTecnicos
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo detalle de eventos técnicos:',
            error
          );

          this.cargandoDetalleEventosTecnicos = false;
          this.detalleEventosTecnicos = null;
          this.changeDetector.markForCheck();
        }
      });

  }


  cambiarPaginaDetalles(evento: {
    pagina: number;
    tamano: number;
  }): void {

    if (
      this.paginaDetalles === evento.pagina &&
      this.tamanoDetalles === evento.tamano
    ) {
      return;
    }

    this.paginaDetalles = evento.pagina;
    this.tamanoDetalles = evento.tamano;

    this.cargarDetalleEventosTecnicos();
  }


  cambiarBusquedaDetalles(busqueda: string): void {

    this.busquedaDetalles = busqueda;
    this.paginaDetalles = 1;

    // INVALIDAR RESPUESTAS ANTERIORES
    this.solicitudDetalleEventosTecnicos++;
    this.cargandoDetalleEventosTecnicos = true;

    if (this.temporizadorBusquedaDetalles !== null) {
      clearTimeout(this.temporizadorBusquedaDetalles);
    }

    this.temporizadorBusquedaDetalles = setTimeout(() => {
      this.temporizadorBusquedaDetalles = null;
      this.cargarDetalleEventosTecnicos();
    }, 300);

    this.changeDetector.markForCheck();
  }

  private reiniciarBusquedaDetalles(): void {

    if (this.temporizadorBusquedaDetalles !== null) {
      clearTimeout(this.temporizadorBusquedaDetalles);
      this.temporizadorBusquedaDetalles = null;
    }

    this.busquedaDetalles = '';
  }

  cargarIncidentesPorcentajes(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudGrafico = ++this.solicitudIncidentesPorcentajes;

    this.cargandoIncidentesPorcentajes = true;

    this.incidentConsolidatedService
      .obtenerIncidentesPorcentajes(
        { ...this.filtrosActuales },
        this.limiteIncidentesPorcentajes
      )
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudIncidentesPorcentajes
          ) {
            return;
          }

          this.incidentesPorcentajes = data;
          this.cargandoIncidentesPorcentajes = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudIncidentesPorcentajes
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo incidentes por porcentajes:',
            error
          );

          this.incidentesPorcentajes = null;
          this.cargandoIncidentesPorcentajes = false;

          this.changeDetector.markForCheck();
        }
      });
  }


  cambiarLimiteIncidentesPorcentajes(limite: number): void {
    if (this.limiteIncidentesPorcentajes === limite) {
      return;
    }

    this.limiteIncidentesPorcentajes = limite;
    this.cargarIncidentesPorcentajes();
  }

  cargarTopDescripcionesProyectos(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudGrafico = ++this.solicitudTopDescripcionesProyectos;
    this.cargandoTopDescripcionesProyectos = true;
    this.incidentConsolidatedService
      .obtenerTopDescripcionesProyectos({
        ...this.filtrosActuales
      })
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTopDescripcionesProyectos
          ) {
            return;
          }

          this.topDescripcionesProyectos = data;
          this.cargandoTopDescripcionesProyectos = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTopDescripcionesProyectos
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo Top 10 por descripción y proyecto:',
            error
          );

          this.topDescripcionesProyectos = null;
          this.cargandoTopDescripcionesProyectos = false;

          this.changeDetector.markForCheck();
        }
      });
  }


  cargarTopDetalles(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudGrafico = ++this.solicitudTopDetalles;

    this.cargandoTopDetalles = true;

    this.incidentConsolidatedService
      .obtenerTopDetalles({
        ...this.filtrosActuales
      })
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTopDetalles
          ) {
            return;
          }

          this.topDetalles = data;
          this.cargandoTopDetalles = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTopDetalles
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo Top 10 por detalle:',
            error
          );

          this.topDetalles = null;
          this.cargandoTopDetalles = false;

          this.changeDetector.markForCheck();
        }
      });
  }



  // NUMERO DE TICKETS POR RESOLUTOR
  cargarTicketsPorResolutor(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudGrafico = ++this.solicitudTicketsPorResolutor;

    this.cargandoTicketsPorResolutor = true;

    this.incidentConsolidatedService
      .obtenerTicketsPorResolutor(
        { ...this.filtrosActuales },
        this.limiteTicketsPorResolutor
      )
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTicketsPorResolutor
          ) {
            return;
          }

          this.ticketsPorResolutor = data;
          this.cargandoTicketsPorResolutor = false;

          this.changeDetector.markForCheck();
        },

        error: (error) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudGrafico !== this.solicitudTicketsPorResolutor
          ) {
            return;
          }

          this.registrarError(
            'Error obteniendo número de tickets por resolutor:',
            error
          );

          this.ticketsPorResolutor = null;
          this.cargandoTicketsPorResolutor = false;

          this.changeDetector.markForCheck();
        }
      });
  }


  cambiarLimiteTicketsPorResolutor(limite: number): void {

    if (this.limiteTicketsPorResolutor === limite) {
      return;
    }

    this.limiteTicketsPorResolutor = limite;

    this.cargarTicketsPorResolutor();
  }

  // NAVEGACION INTERNA DEL DASHBOARD
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

  // CONVERTIR FECHA DEL BACKEND A DATE

  private convertirFecha(fecha: string | null): Date | null {

    if (!fecha) {
      return null;
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);

    return new Date(anio, mes - 1, dia);
  }

  // ESTABLECER RANGO DISPONIBLE POR DEFECTO
  private establecerFechasPorDefecto(): void {

    const desde = this.convertirFecha(
      this.opcionesFiltros.fecha_min
    );

    const hasta = this.convertirFecha(
      this.opcionesFiltros.fecha_max
    );

    // ACTUALIZAR LOS DATEPICKERS
    this.filtrosForm.patchValue(
      {
        desde,
        hasta
      },
      { emitEvent: false }
    );

    // ACTUALIZAR FILTROS QUE SE ENVIAN AL BACKEND
    this.filtrosActuales = {
      ...this.filtrosActuales,
      desde: desde ? this.formatearFecha(desde) : undefined,
      hasta: hasta ? this.formatearFecha(hasta) : undefined
    };
  }





  cambiarTiposIncidente(tipos: string[]): void {

    // VALIDAR TIPOS VISIBLES Y SELECCIONES PREVIAS
    const tiposPermitidos = new Set([
      ...this.tiposGrafico.map(item => item.categoria),
      ...this.tiposIncidenteSeleccionados
    ]);

    // NORMALIZAR Y ELIMINAR DUPLICADOS
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

    // EVITAR CONSULTAS INNECESARIAS
    const anteriores = new Set(
      this.tiposIncidenteSeleccionados
    );

    const mismaSeleccion =
      anteriores.size === seleccion.length &&
      seleccion.every(tipo => anteriores.has(tipo));

    if (mismaSeleccion) {
      return;
    }

    this.tiposIncidenteSeleccionados = seleccion;

    this.filtrosActuales = {
      ...this.filtrosActuales,

      tipo_incidente: seleccion.length > 0
        ? [...seleccion]
        : undefined
    };
    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }

  quitarTipoIncidente(tipo: string): void {

    this.cambiarTiposIncidente(
      this.tiposIncidenteSeleccionados.filter(
        seleccionado => seleccionado !== tipo
      )
    );

  }


  // CAMBIAR FILTRO DINAMICO MENSUAL
  cambiarPeriodo(periodo: string | null): void {

    // VALIDAR FORMATO ANTES DE ENVIAR AL BACKEND
    if (
      periodo !== null &&
      !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(periodo)
    ) {
      console.error(
        'Formato de periodo inválido:',
        periodo
      );
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

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();
    this.cargarOpcionesProyectos();
    this.cargarDashboard();
  }


  // FILTRO DINAMICO - CAMBIAR DETALLE TECNICO
  cambiarDetalleTecnico(
    fila: IncidentConsolidatedDetalleEventoItem | null
  ): void {
    const nuevoId = fila?.detalle_id ?? null;
    const nuevoTexto = fila?.detalle ?? null;
    if (
      this.detalleSeleccionadoId === nuevoId &&
      this.detalleSeleccionadoTexto === nuevoTexto
    ) {
      return;
    }

    this.detalleSeleccionadoId = nuevoId;
    this.detalleSeleccionadoTexto = nuevoTexto;
    this.filtrosActuales = {
      ...this.filtrosActuales,

      detalle_id: nuevoId ?? undefined
    };

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();
    this.cargarOpcionesProyectos();
    this.cargarDashboard();

  }


  get mostrarMesesEnEjeXResolutores(): boolean {

    const f = this.filtrosActuales;
    const fechasPersonalizadas =
      (
        !!f.desde &&
        f.desde !== this.opcionesFiltros.fecha_min
      ) ||
      (
        !!f.hasta &&
        f.hasta !== this.opcionesFiltros.fecha_max
      );

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



  // FILTRO GLOBAL - EXCLUSION MULTIPLE DE PROYECTOS
  cambiarProyectosExcluidos(proyectos: string[]): void {

    // NORMALIZAR PROYECTOS Y ELIMINAR DUPLICADOS
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

    if (this.proyectoSeleccionado) {

      const proyectoActual =
        this.proyectoSeleccionado.trim().toLocaleLowerCase();

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

    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    // INVALIDAR RESPUESTAS ANTERIORES
    this.solicitudDashboard++;
    this.invalidarReporteMensual();
    this.sincronizarReporteProyectos();
    this.sincronizarReporteProyectoMensual();

    // AGRUPAR CAMBIOS RAPIDOS DE LOS CHECKBOXES
    if (this.temporizadorExclusiones !== null) {
      clearTimeout(this.temporizadorExclusiones);
    }

    this.temporizadorExclusiones = setTimeout(() => {

      this.temporizadorExclusiones = null;

      // RECARGAR TODOS LOS COMPONENTES
      this.cargarDashboard();

    }, 300);

    this.changeDetector.markForCheck();
  }



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

    this.cargarTickets();
  }


  cargarTickets(
    solicitudActual: number = this.solicitudDashboard
  ): void {

    const solicitudTabla = ++this.solicitudTickets;

    this.cargandoTickets = true;
    this.errorTickets = null;

    this.incidentConsolidatedService
      .obtenerTickets(
        { ...this.filtrosActuales },
        this.paginaTickets,
        this.tamanoTickets
      )
      .subscribe({

        next: (data) => {

          if (
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudTickets
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
            solicitudActual !== this.solicitudDashboard ||
            solicitudTabla !== this.solicitudTickets
          ) {
            return;
          }

          console.error(
            'Error obteniendo tabla de tickets:',
            error
          );

          this.ticketsDetalle = null;
          this.cargandoTickets = false;

          this.errorTickets =
            'No se pudieron cargar los tickets.';

          this.changeDetector.markForCheck();
        }

      });
  }


  // FILTRO DINÁMICO POR TICKET ID
  cambiarTicketId(ticketId: string | null): void {

    const nuevoTicketId = ticketId?.trim() || null;

    if (this.ticketIdSeleccionado === nuevoTicketId) {
      return;
    }

    this.ticketIdSeleccionado = nuevoTicketId;

    // CONSERVAR TODOS LOS DEMÁS FILTROS
    this.filtrosActuales = {
      ...this.filtrosActuales,
      ticket_id: nuevoTicketId ?? undefined
    };

    // REINICIAR BUSQUEDAS LOCALES EXISTENTES
    this.reiniciarBusquedaDescripciones();
    this.reiniciarBusquedaDetalles();

    // RECARGAR KPIS, GRAFICOS Y TABLAS
    this.cargarDashboard();
  }

}


