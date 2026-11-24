import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ChartData, ChartOptions } from 'chart.js';
import { DailyReportDashboardFilters, DailyReportDiaItem, DailyReportFilters, DailyReportKPI, DailyReportProyectoItem, DailyReportTopProyectos } from '../../../models/daily-report';
import { DailyReportService } from '../../../services/daily-report.service';

interface DailyReportMesResumen {
  periodo: string;
  total_tickets: number;
  incidentes: number;
  requerimientos: number;
  tareas: number;
}

@Component({
  selector: 'app-daily-report',
  standalone: false,
  templateUrl: './daily-report.html',
  styleUrl: './daily-report.css'
})
export class DailyReport implements OnInit, OnDestroy {

  // feat/mejoras-analisis-incidentes-gpt
  private readonly grupoResolutorPorDefecto = 'BASE DE DATOS Y EBS';
  filtrosForm!: FormGroup;

  opcionesFiltros: DailyReportFilters = {
    fecha_min: null,
    fecha_max: null,
    grupos_resolutores: [],
    proyectos: []
  };

  filtrosActuales: DailyReportDashboardFilters = {};

  fechaMinima: Date | null = null;
  fechaMaxima: Date | null = null;

  kpis: DailyReportKPI | null = null;
  datosDiarios: DailyReportDiaItem[] = [];
  resumenMensual: DailyReportMesResumen[] = [];
  mesResumenSeleccionado: string | null = null;
  datosGraficoMensual: ChartData<'bar', number[], string> = { labels: [], datasets: [] };
  readonly opcionesGraficoMensual: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 16, bottom: 4 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 9, padding: 18, color: '#667085' }
      },
      tooltip: {
        callbacks: {
          label: context => `${context.dataset.label}: ${Number(context.parsed.y ?? 0).toLocaleString('es-PE')}`
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#667085' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#667085', precision: 0 },
        grid: { color: '#E5E9EE' },
        title: { display: true, text: 'Tickets', color: '#667085' }
      }
    },
    onClick: (_event, elementos) => {
      const indice = elementos[0]?.index;
      if (indice === undefined) return;
      const periodo = this.resumenMensual[indice]?.periodo;
      if (periodo) this.seleccionarMesResumen(this.mesResumenSeleccionado === periodo ? null : periodo);
    }
  };


  proyectos: DailyReportProyectoItem[] = [];
  topProyectos: DailyReportTopProyectos = { periodos: [], proyectos: [] };
  proyectoSeleccionado: string | null = null;

  cargandoProyectos = false;
  cargandoTopProyectos = false;
  errorProyectos: string | null = null;
  errorTopProyectos: string | null = null;

  cargandoFiltros = false;
  cargandoDashboard = false;
  filtrosListos = false;

  errorFiltros: string | null = null;
  errorDashboard: string | null = null;

  private solicitudResumen = 0;
  private readonly cancelarResumen$ = new Subject<void>();
  private readonly destruir$ = new Subject<void>();

  graficoExpandido: string | null = null;

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
      console.error(
        'Error al cambiar pantalla completa:',
        error
      );
    }
  }

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {

    this.graficoExpandido =
      (document.fullscreenElement as HTMLElement | null)?.id
      ?? null;

    this.changeDetector.markForCheck();
  }

  busquedaProyecto = '';
  get proyectosFiltrados(): string[] {
    const busqueda = this.busquedaProyecto
      .trim()
      .toLocaleLowerCase();

    if (!busqueda) {
      return this.opcionesFiltros.proyectos;
    }

    return this.opcionesFiltros.proyectos.filter(
      proyecto =>
        proyecto.toLocaleLowerCase().includes(busqueda)
    );
  }

  buscarProyecto(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaProyecto = input.value;
  }

  alAbrirComboProyecto(abierto: boolean): void {
    if (abierto) {
      this.busquedaProyecto = '';
    }
  }

  detenerTeclasBusqueda(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }

  limpiarBusquedaProyecto(event: MouseEvent): void {
    event.stopPropagation();
    this.busquedaProyecto = '';
  }


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

    return desde.getTime() > hasta.getTime()
      ? { rangoFechasInvalido: true }
      : null;
  };

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dailyReportService: DailyReportService,
    private readonly changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.crearFormularioFiltros();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.cancelarResumen$.next();
    this.cancelarResumen$.complete();

    this.destruir$.next();
    this.destruir$.complete();
  }

  private crearFormularioFiltros(): void {

    this.filtrosForm = this.formBuilder.group(
      {
        desde: [null, Validators.required],
        hasta: [null, Validators.required],
        // feat/mejoras-analisis-incidentes-gpt
        grupo_resolutor: [this.grupoResolutorPorDefecto],
        proyecto: [null]
      },
      { validators: this.validarRangoFechas }
    );

  }


  cargarOpcionesFiltros(): void {
    this.cargandoFiltros = true;
    this.filtrosListos = false;
    this.errorFiltros = null;

    this.dailyReportService.obtenerFiltros()
      .pipe(takeUntil(this.destruir$))
      .subscribe({
        next: (opciones) => {
          this.opcionesFiltros = opciones;
          this.fechaMinima = this.convertirFecha(opciones.fecha_min);
          this.fechaMaxima = this.convertirFecha(opciones.fecha_max);
          this.cargandoFiltros = false;
          this.filtrosListos = true;

          this.restablecerFormulario();

          if (this.fechaMinima && this.fechaMaxima) {
            this.aplicarFiltros();
          } else {

            this.filtrosActuales = {};
            this.kpis = {
              total_tickets: 0,
              total_incidentes: 0,
              total_requerimientos: 0,
              total_tareas: 0
            };
            this.datosDiarios = [];
            this.proyectos = [];
            this.topProyectos = { periodos: [], proyectos: [] };
            this.proyectoSeleccionado = null;
          }

          this.changeDetector.markForCheck();
        },
        error: (error) => {
          console.error('Error obteniendo filtros del Reporte Diario:', error);
          this.cargandoFiltros = false;
          this.filtrosListos = false;
          this.errorFiltros = 'No se pudieron obtener los filtros del Reporte Diario.';
          this.kpis = null;
          this.datosDiarios = [];
          this.proyectos = [];
          this.topProyectos = { periodos: [], proyectos: [] };
          this.proyectoSeleccionado = null;
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

    this.filtrosActuales = {
      desde: this.formatearFecha(valores.desde),
      hasta: this.formatearFecha(valores.hasta),
      grupo_resolutor: valores.grupo_resolutor?.trim() || undefined,
      proyecto: valores.proyecto?.trim() || undefined
    };

    this.proyectoSeleccionado = this.filtrosActuales.proyecto ?? null;

    this.cargarResumen();
    this.cargarProyectos();
    this.cargarTopProyectos();
  }


  limpiarFiltros(): void {
    if (!this.filtrosListos || this.cargandoFiltros) {
      return;
    }

    this.restablecerFormulario();

    if (this.fechaMinima && this.fechaMaxima) {
      this.aplicarFiltros();
    }
  }

  private restablecerFormulario(): void {

    this.filtrosForm.reset(
      {
        desde: this.fechaMinima,
        hasta: this.fechaMaxima,
        // feat/mejoras-analisis-incidentes-gpt
        grupo_resolutor: this.grupoResolutorPorDefecto,
        proyecto: null
      },
      { emitEvent: false }
    );

    this.filtrosForm.markAsPristine();
    this.filtrosForm.markAsUntouched();
    this.filtrosForm.updateValueAndValidity({
      emitEvent: false
    });
    this.busquedaProyecto = '';
  }


  private cargarResumen(): void {
    this.cancelarResumen$.next();
    const solicitudActual = ++this.solicitudResumen;

    this.cargandoDashboard = true;
    this.errorDashboard = null;
    this.kpis = null;
    this.datosDiarios = [];
    this.resumenMensual = [];
    this.mesResumenSeleccionado = null;
    this.actualizarGraficoMensual();

    this.dailyReportService.obtenerResumen({ ...this.filtrosActuales })
      .pipe(
        takeUntil(this.cancelarResumen$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (respuesta) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          this.kpis = respuesta.kpis;
          this.datosDiarios = respuesta.diario;
          this.actualizarResumenMensual();
          this.cargandoDashboard = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          console.error('Error obteniendo resumen del Reporte Diario:', error);
          this.errorDashboard = 'No se pudo actualizar el Reporte Diario. Intenta aplicar los filtros nuevamente.';
          this.resumenMensual = [];
          this.actualizarGraficoMensual();
          this.cargandoDashboard = false;
          this.kpis = null;
          this.datosDiarios = [];
          this.changeDetector.markForCheck();
        }
      });

    this.changeDetector.markForCheck();
  }

  cargarProyectos(): void {
    const solicitudActual = this.solicitudResumen;
    const filtrosBase: DailyReportDashboardFilters = {
      ...this.filtrosActuales,
      proyecto: undefined
    };

    this.cargandoProyectos = true;
    this.errorProyectos = null;

    this.dailyReportService.obtenerProyectos(filtrosBase)
      .pipe(
        takeUntil(this.cancelarResumen$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (datos) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          this.proyectos = datos;
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          console.error('Error obteniendo proyectos del Reporte Diario:', error);
          this.errorProyectos = 'No se pudo cargar el Explorador de Proyectos.';
          this.cargandoProyectos = false;
          this.changeDetector.markForCheck();
        }
      });

    this.changeDetector.markForCheck();
  }

  cargarTopProyectos(): void {
    const solicitudActual = this.solicitudResumen;

    this.cargandoTopProyectos = true;
    this.errorTopProyectos = null;
    this.topProyectos = { periodos: [], proyectos: [] };

    this.dailyReportService.obtenerTopProyectos({ ...this.filtrosActuales })
      .pipe(
        takeUntil(this.cancelarResumen$),
        takeUntil(this.destruir$)
      )
      .subscribe({
        next: (datos) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          this.topProyectos = datos;
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          console.error('Error obteniendo Top 10 del Reporte Diario:', error);
          this.errorTopProyectos = 'No se pudo cargar el Top 10 por Proyecto y Mes.';
          this.topProyectos = { periodos: [], proyectos: [] };
          this.cargandoTopProyectos = false;
          this.changeDetector.markForCheck();
        }
      });

    this.changeDetector.markForCheck();
  }

  cambiarProyecto(proyecto: string | null): void {
    const seleccion = proyecto?.trim() || null;

    if (this.proyectoSeleccionado === seleccion) {
      return;
    }
    this.filtrosForm.patchValue(
      { proyecto: seleccion },
      { emitEvent: false }
    );

    this.aplicarFiltros();
  }


  // Agrupación exclusivamente visual: los KPIs y los demás gráficos conservan
  // los filtros globales. No se suman duplicados entre fuentes fuera del
  // contrato ya entregado por obtenerResumen().
  private actualizarResumenMensual(): void {
    const acumulado = new Map<string, DailyReportMesResumen>();

    for (const fila of this.datosDiarios) {
      const periodo = fila.fecha_accion?.slice(0, 7);
      if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) continue;

      let mes = acumulado.get(periodo);
      if (!mes) {
        mes = { periodo, total_tickets: 0, incidentes: 0, requerimientos: 0, tareas: 0 };
        acumulado.set(periodo, mes);
      }
      mes.total_tickets += Number(fila.total_tickets) || 0;
      mes.incidentes += Number(fila.incidentes) || 0;
      mes.requerimientos += Number(fila.requerimientos) || 0;
      mes.tareas += Number(fila.tareas) || 0;
    }

    this.resumenMensual = Array.from(acumulado.values())
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (this.mesResumenSeleccionado &&
        !this.resumenMensual.some(m => m.periodo === this.mesResumenSeleccionado)) {
      this.mesResumenSeleccionado = null;
    }
    this.actualizarGraficoMensual();
  }

  seleccionarMesResumen(periodo: string | null): void {
    if (periodo && !this.resumenMensual.some(m => m.periodo === periodo)) return;
    this.mesResumenSeleccionado = periodo;
    this.actualizarGraficoMensual();
  }

  nombreMesResumen(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    const nombre = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })
      .format(new Date(anio, mes - 1, 1));
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  private actualizarGraficoMensual(): void {
    const seleccionado = this.mesResumenSeleccionado;
    const periodos = this.resumenMensual;
    const serie = (clave: keyof Pick<DailyReportMesResumen,
        'total_tickets' | 'incidentes' | 'requerimientos' | 'tareas'>,
        titulo: string, color: string, tenue: string) => ({
      label: titulo,
      data: periodos.map(item => item[clave]),
      backgroundColor: periodos.map(item => !seleccionado || item.periodo === seleccionado ? color : tenue),
      borderRadius: 5,
      maxBarThickness: 36,
      categoryPercentage: 0.8,
      barPercentage: 0.82
    });

    this.datosGraficoMensual = {
      labels: periodos.map(item => {
        const [anio, mes] = item.periodo.split('-').map(Number);
        return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' })
          .format(new Date(anio, mes - 1, 1));
      }),
      datasets: [
        //serie('total_tickets', 'Tickets', '#FF620F', '#FFD3BC'),
        serie('incidentes', 'Incidentes', '#FF620F', '#FF620F'),
        serie('requerimientos', 'Requerimientos', '#16835B', '#B8DDCE'),
        serie('tareas', 'Tareas', '#F4C95D', '#F4C95D')
      ]
    };
  }

  private convertirFecha(valor: string | null): Date | null {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return null;
    }
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    if (
      fecha.getFullYear() !== anio ||
      fecha.getMonth() !== mes - 1 ||
      fecha.getDate() !== dia
    ) {
      return null;
    }
    return fecha;
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

