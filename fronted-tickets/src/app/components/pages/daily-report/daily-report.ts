import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import {
  DailyReportDashboardFilters,
  DailyReportDiaItem,
  DailyReportFilters,
  DailyReportKPI
} from '../../../models/daily-report';
import { DailyReportService } from '../../../services/daily-report.service';

/**
 * Página principal del Reporte Diario.
 * Centraliza filtros y estado, y entrega `datosDiarios` a los futuros
 * componentes hijos de tabla y gráfico (sin repetir llamadas HTTP).
 */
@Component({
  selector: 'app-daily-report',
  standalone: false,
  templateUrl: './daily-report.html',
  styleUrl: './daily-report.css'
})
export class DailyReport implements OnInit, OnDestroy {

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

  cargandoFiltros = false;
  cargandoDashboard = false;
  filtrosListos = false;

  errorFiltros: string | null = null;
  errorDashboard: string | null = null;

  private solicitudResumen = 0;
  private readonly cancelarResumen$ = new Subject<void>();
  private readonly destruir$ = new Subject<void>();




  // PANTALLA COMPLETA - REPORTE DIARIO
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



  /** Comprueba la relación entre los dos datepickers. */
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
        grupo_resolutor: [null],
        proyecto: [null]
      },
      { validators: this.validarRangoFechas }
    );
  }

  /**
   * Obtiene el rango de fechas disponible y las opciones consolidadas
   * de las tres fuentes: incidentes, requerimientos y tareas.
   */
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
            // Si aún no existen registros, mostrar KPIs en cero.
            this.filtrosActuales = {};
            this.kpis = {
              total_tickets: 0,
              total_incidentes: 0,
              total_requerimientos: 0,
              total_tareas: 0
            };
            this.datosDiarios = [];
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

    this.cargarResumen();
  }

  /** Vuelve al rango completo disponible y elimina los filtros opcionales. */
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
        grupo_resolutor: null,
        proyecto: null
      },
      { emitEvent: false }
    );
    this.filtrosForm.markAsPristine();
    this.filtrosForm.markAsUntouched();
    this.filtrosForm.updateValueAndValidity({ emitEvent: false });
  }

  /** Una petición obtiene KPIs y serie diaria bajo exactamente los mismos filtros. */
  private cargarResumen(): void {
    this.cancelarResumen$.next();
    const solicitudActual = ++this.solicitudResumen;

    this.cargandoDashboard = true;
    this.errorDashboard = null;
    this.kpis = null;
    this.datosDiarios = [];

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
          this.cargandoDashboard = false;
          this.changeDetector.markForCheck();
        },
        error: (error) => {
          if (solicitudActual !== this.solicitudResumen) {
            return;
          }

          console.error('Error obteniendo resumen del Reporte Diario:', error);
          this.errorDashboard = 'No se pudo actualizar el Reporte Diario. Intenta aplicar los filtros nuevamente.';
          this.cargandoDashboard = false;
          this.kpis = null;
          this.datosDiarios = [];
          this.changeDetector.markForCheck();
        }
      });

    this.changeDetector.markForCheck();
  }

  /** Parseo local para evitar desajustes de fecha por zona horaria. */
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
