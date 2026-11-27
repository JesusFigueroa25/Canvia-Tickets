import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener,
  OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import Chart from 'chart.js/auto';
import type { Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { catchError, defer, EMPTY, from, map, mergeMap, Observable, Subscription, tap, timeout } from 'rxjs';
import {
  TipoTicketParalelo, TicketsParallelDashboardFilters, TicketsParallelFilters,
  TicketsParallelKPI, TicketsParallelMonthlyItem, TicketsParallelResolverItem,
  TicketsParallelProjectItem, TicketsParallelTicketsOut, TicketsParallelTicketItem,
  TicketsParallelDetailOut
} from '../../../models/tickets-manual-updates';
import { TicketsManualUpdatesService } from '../../../services/tickets-manual-updates.service';

type Seccion = 'kpis' | 'resumen' | 'resolutores' | 'proyectos' | 'tickets' | 'detalle';
type Estado = { cargando: boolean; error: string | null };
type Pagina = { pagina: number; tamano: number };

@Component({
  selector: 'app-tickets-parallel-analysis',
  standalone: false,
  styleUrl: './tickets-parallel-analysis.css',
  templateUrl: './tickets-parallel-analysis.html',
})
export class TicketsParallelAnalysis implements OnInit, AfterViewInit, OnDestroy {
  readonly grupoPorDefecto = 'BASE DE DATOS Y EBS';
  readonly filtrosForm;
  readonly estados: Record<Seccion, Estado> = {
    kpis: { cargando: false, error: null }, resumen: { cargando: false, error: null },
    resolutores: { cargando: false, error: null }, proyectos: { cargando: false, error: null },
    tickets: { cargando: false, error: null }, detalle: { cargando: false, error: null }
  };

  @ViewChild('resumenCanvas') resumenCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('resumenFs') resumenFs?: ElementRef<HTMLElement>;
  opcionesFiltros: TicketsParallelFilters = {
    fecha_min: null, fecha_max: null, grupos_resolutores: [], prioridades: [],
    motivos: [], proyectos: [], tipos_ticket: []
  };
  fechaMin: Date | null = null;
  fechaMax: Date | null = null;
  filtrosListos = false;
  cargandoFiltros = false;
  errorFiltros: string | null = null;
  busquedaProyecto = '';
  periodoSeleccionado: string | null = null;
  filtrosActuales: TicketsParallelDashboardFilters = {};
  filtrosEfectivos: TicketsParallelDashboardFilters = {};
  kpis: TicketsParallelKPI | null = null;
  resumenMensual: TicketsParallelMonthlyItem[] = [];
  datosResolutores: TicketsParallelResolverItem[] = [];
  datosProyectos: TicketsParallelProjectItem[] = [];
  datosTickets: TicketsParallelTicketsOut | null = null;
  detalleTicket: TicketsParallelDetailOut | null = null;
  ticketSeleccionado: TicketsParallelTicketItem | null = null;
  paginaTickets = 1;
  tamanoTickets = 25;
  tipoTicketLocal: TipoTicketParalelo | null = null;
  resolutorBusqueda = '';
  graficoExpandido = false;
  errorPantallaCompleta: string | null = null;

  private chart: Chart<'bar', number[], string> | null = null;
  private filtrosSub?: Subscription;
  private dashboardSub?: Subscription;
  private ticketsSub?: Subscription;
  private detalleSub?: Subscription;
  private version = 0;
  private destruido = false;
  private readonly colores = ['#FF620F', '#16835B', '#FFB184', '#63B891'];
  private readonly etiquetas = [
    'Incidentes evaluados',
    'Incidentes en paralelo',
    'Requerimientos evaluados',
    'Requerimientos en paralelo'
  ];

  constructor(private fb: FormBuilder, private service: TicketsManualUpdatesService,
    private cdr: ChangeDetectorRef) {
    this.filtrosForm = this.fb.group({
      desde: this.fb.control<Date | null>(null, Validators.required),
      hasta: this.fb.control<Date | null>(null, Validators.required),
      grupo_resolutor: this.fb.control<string | null>(this.grupoPorDefecto),
      prioridad: this.fb.control<string | null>(null),
      motivo: this.fb.control<string | null>(null),
      proyectos: this.fb.nonNullable.control<string[]>([]),
      ticket_type: this.fb.control<TipoTicketParalelo | null>(null)
    });
  }

  ngOnInit(): void { this.cargarOpcionesFiltros(true); }
  ngAfterViewInit(): void { this.inicializarGrafico(); }
  ngOnDestroy(): void {
    this.destruido = true;
    ++this.version;
    this.filtrosSub?.unsubscribe();
    this.cancelarConsultas();
    this.chart?.destroy();
    this.chart = null;
  }

  private fecha(valor: string | null): Date | null {
    if (!valor) return null;
    const [y, m, d] = valor.split('-').map(Number);
    const result = new Date(y, m - 1, d);
    return Number.isNaN(result.getTime()) ? null : result;
  }
  private iso(valor: Date | null): string | undefined {
    if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) return undefined;
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  get rangoInvalido(): boolean {
    const { desde, hasta } = this.filtrosForm.getRawValue();
    return !!(desde && hasta && (desde > hasta ||
      (this.fechaMin && desde < this.fechaMin) || (this.fechaMax && hasta > this.fechaMax)));
  }
  get cargandoDashboard(): boolean {
    return (['kpis', 'resumen', 'resolutores', 'proyectos', 'tickets'] as const)
      .some(s => this.estados[s].cargando);
  }
  get hayResumen(): boolean {
    return this.resumenMensual.some(r => r.incidentes_evaluados > 0 || r.requerimientos_evaluados > 0);
  }
  get cantidadResolutores(): number { return new Set(this.datosResolutores.map(r => r.resolutor)).size; }
  get cantidadProyectos(): number { return new Set(this.datosProyectos.map(r => r.proyecto)).size; }
  get etiquetaRangoAplicado(): string {
    return this.filtrosEfectivos.desde && this.filtrosEfectivos.hasta
      ? `${this.filtrosEfectivos.desde} al ${this.filtrosEfectivos.hasta}` : '—';
  }

  cargarOpcionesFiltros(inicial = false): void {
    this.filtrosSub?.unsubscribe();
    this.cargandoFiltros = true;
    this.filtrosListos = false;
    this.errorFiltros = null;
    const grupo = this.filtrosForm.controls.grupo_resolutor.value;
    this.filtrosSub = this.service.obtenerFiltros(grupo).pipe(timeout(120000)).subscribe({
      next: datos => {
        if (this.destruido) return;
        this.opcionesFiltros = datos;
        this.fechaMin = this.fecha(datos.fecha_min);
        this.fechaMax = this.fecha(datos.fecha_max);
        const actual = this.filtrosForm.getRawValue();
        let desde = inicial ? this.fechaMin : actual.desde;
        let hasta = inicial ? this.fechaMax : actual.hasta;
        if (!desde || (this.fechaMin && desde < this.fechaMin)) desde = this.fechaMin;
        if (!hasta || (this.fechaMax && hasta > this.fechaMax)) hasta = this.fechaMax;
        if (!this.fechaMin || !this.fechaMax || (desde && hasta && desde > hasta)) {
          desde = this.fechaMin; hasta = this.fechaMax;
        }
        this.filtrosForm.patchValue({
          desde, hasta,
          proyectos: actual.proyectos.filter(p => datos.proyectos.includes(p)),
          prioridad: actual.prioridad && datos.prioridades.includes(actual.prioridad) ? actual.prioridad : null,
          motivo: actual.motivo && datos.motivos.includes(actual.motivo) ? actual.motivo : null,
          ticket_type: actual.ticket_type && datos.tipos_ticket.includes(actual.ticket_type) ? actual.ticket_type : null
        });
        this.cargandoFiltros = false;
        this.filtrosListos = !!(this.fechaMin && this.fechaMax);
        if (!this.filtrosListos) this.errorFiltros = 'No hay intervalos disponibles para el grupo seleccionado.';
        if (inicial && this.filtrosListos) this.aplicarFiltros();
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoFiltros = false;
        this.errorFiltros = 'No se pudieron cargar las opciones de filtros. Reintenta.';
        this.cdr.markForCheck();
      }
    });
  }

  cambiarGrupoResolutor(): void {
    this.filtrosForm.patchValue({ proyectos: [], prioridad: null, motivo: null, ticket_type: null });
    this.busquedaProyecto = '';
    this.cargarOpcionesFiltros();
  }
  limpiarSeleccionProyectos(evento?: Event): void {
    evento?.stopPropagation();
    this.filtrosForm.controls.proyectos.setValue([]);
    this.busquedaProyecto = '';
  }
  buscarProyecto(evento: Event): void { this.busquedaProyecto = (evento.target as HTMLInputElement).value; }
  coincideBusquedaProyecto(proyecto: string): boolean {
    const normalizar = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
    return normalizar(proyecto).includes(normalizar(this.busquedaProyecto));
  }
  get hayProyectosCoincidentes(): boolean { return this.opcionesFiltros.proyectos.some(p => this.coincideBusquedaProyecto(p)); }
  aplicarFiltros(): void {
    if (!this.filtrosListos || this.cargandoFiltros || this.filtrosForm.invalid || this.rangoInvalido) {
      this.filtrosForm.markAllAsTouched();
      return;
    }
    const f = this.filtrosForm.getRawValue();
    const proyectos = [...new Set(f.proyectos)];
    if (proyectos.length > 200) { this.errorFiltros = 'Selecciona un máximo de 200 proyectos o deja la selección vacía para consultar todos.'; return; }
    this.errorFiltros = null;
    this.filtrosActuales = {
      desde: this.iso(f.desde), hasta: this.iso(f.hasta), grupo_resolutor: f.grupo_resolutor,
      prioridad: f.prioridad, motivo: f.motivo, proyectos, todos_proyectos: proyectos.length === 0, ticket_type: f.ticket_type
    };
    this.periodoSeleccionado = null;
    this.tipoTicketLocal = null;
    this.cargarDashboard(true);
  }
  limpiarFiltros(): void {
    ++this.version;
    this.cancelarConsultas();
    this.resetDatos(true);
    this.filtrosActuales = {};
    this.filtrosEfectivos = {};
    this.periodoSeleccionado = null;
    this.tipoTicketLocal = null;
    this.busquedaProyecto = '';
    this.filtrosForm.reset({
      desde: null, hasta: null, grupo_resolutor: this.grupoPorDefecto,
      prioridad: null, motivo: null, proyectos: [], ticket_type: null
    });
    this.cargarOpcionesFiltros(true);
  }

  cambiarPeriodo(periodo: string | null): void {
    if (periodo === this.periodoSeleccionado || this.estados.resumen.cargando ||
      (periodo && !this.resumenMensual.some(r => r.periodo === periodo))) return;
    this.periodoSeleccionado = periodo;
    this.actualizarGrafico();
    this.cargarDashboard(false);
  }
  private calcularFiltrosEfectivos(): TicketsParallelDashboardFilters {
    const f = { ...this.filtrosActuales, proyectos: [...(this.filtrosActuales.proyectos ?? [])] };
    if (this.periodoSeleccionado) {
      const [y, m] = this.periodoSeleccionado.split('-').map(Number);
      const inicio = `${this.periodoSeleccionado}-01`;
      const fin = this.iso(new Date(y, m, 0))!;
      f.desde = f.desde && f.desde > inicio ? f.desde : inicio;
      f.hasta = f.hasta && f.hasta < fin ? f.hasta : fin;
    }
    return f;
  }
  private cancelarConsultas(): void {
    this.dashboardSub?.unsubscribe(); this.ticketsSub?.unsubscribe(); this.detalleSub?.unsubscribe();
  }
  private resetDatos(incluirResumen: boolean): void {
    this.kpis = null; this.datosResolutores = []; this.datosProyectos = []; this.datosTickets = null;
    this.detalleTicket = null; this.ticketSeleccionado = null; this.paginaTickets = 1;
    for (const s of Object.keys(this.estados) as Seccion[]) {
      if (s !== 'resumen' || incluirResumen) this.estados[s] = { cargando: false, error: null };
    }
    if (incluirResumen) { this.resumenMensual = []; this.actualizarGrafico(); }
  }
  private consulta<T>(seccion: Seccion, solicitar: () => Observable<T>, aceptar: (dato: T) => void,
    version: number): Observable<void> {
    return defer(solicitar).pipe(timeout(120000), tap(dato => {
      if (this.destruido || version !== this.version) return;
      aceptar(dato);
      this.estados[seccion] = { cargando: false, error: null };
      this.cdr.markForCheck();
    }), map(() => undefined), catchError((error: unknown) => {
      if (!this.destruido && version === this.version) {
        this.estados[seccion] = {
          cargando: false, error: error instanceof Error && error.name === 'TimeoutError'
            ? 'La consulta tardó demasiado. Reintenta.' : 'No se pudo cargar esta información. Reintenta.'
        };
        this.cdr.markForCheck();
      }
      return EMPTY;
    }));
  }
  cargarDashboard(incluirResumen = true): void {
    if (!this.filtrosActuales.desde || !this.filtrosActuales.hasta) return;
    ++this.version;
    this.cancelarConsultas();
    this.resetDatos(incluirResumen);
    const v = this.version;
    const f = this.calcularFiltrosEfectivos();
    this.filtrosEfectivos = f;
    const global = { ...this.filtrosActuales, proyectos: [...(this.filtrosActuales.proyectos ?? [])] };
    const trabajos: Observable<void>[] = [];
    const agregar = <T>(s: Seccion, pedir: () => Observable<T>, recibir: (d: T) => void) => {
      this.estados[s] = { cargando: true, error: null };
      trabajos.push(this.consulta(s, pedir, recibir, v));
    };
    agregar('kpis', () => this.service.obtenerKpis(f), d => this.kpis = d);
    if (incluirResumen) agregar('resumen', () => this.service.obtenerResumenEjecutivoMensual(global), d => {
      this.resumenMensual = [...d].sort((a, b) => a.periodo.localeCompare(b.periodo));
      this.actualizarGrafico();
    });
    // Una sola descarga de agregados por dimensión. Tablas y gráficos comparten estos arrays.
    agregar('resolutores', () => this.service.obtenerParalelosResolutores(f), d => this.datosResolutores = d);
    agregar('proyectos', () => this.service.obtenerParalelosProyectos(f), d => this.datosProyectos = d);
    agregar(
      'tickets',
      () => this.service.obtenerParalelosTickets(
        f,
        this.paginaTickets,
        this.tamanoTickets,
        this.tipoTicketLocal,
        this.resolutorBusqueda
      ),
      d => this.datosTickets = d
    );
    // Evitar saturar SQL Server con cinco cálculos simultáneos.
    this.dashboardSub = from(trabajos).pipe(mergeMap(t => t, 2)).subscribe();
    this.cdr.markForCheck();
  }
  reintentarDashboard(): void { this.cargarDashboard(true); }

  // Contratos para el explorador y el diálogo del PASO 6.
  cambiarPaginaTickets(evento: Pagina): void {
    if (this.estados.tickets.cargando || !this.filtrosEfectivos.desde || !Number.isInteger(evento.pagina) ||
      !Number.isInteger(evento.tamano) || evento.pagina < 1 || evento.tamano < 1 || evento.tamano > 100) return;
    this.paginaTickets = evento.pagina; this.tamanoTickets = evento.tamano;
    this.cargarTickets();
  }
  cambiarTipoTicketLocal(tipo: TipoTicketParalelo | null): void {
    if (this.estados.tickets.cargando || tipo === this.tipoTicketLocal || !this.filtrosEfectivos.desde) return;
    this.tipoTicketLocal = tipo; this.paginaTickets = 1; this.cargarTickets();
  }
  cambiarResolutorBusqueda(valor: string): void {
    const busqueda = valor.trim();

    if (
      this.estados.tickets.cargando ||
      !this.filtrosEfectivos.desde ||
      busqueda === this.resolutorBusqueda
    ) return;

    this.resolutorBusqueda = busqueda;
    this.paginaTickets = 1;

    this.cargarTickets();
  }
  private cargarTickets(): void {

    this.ticketsSub?.unsubscribe();

    this.cerrarDetalle();

    this.datosTickets = null;

    this.estados.tickets = {
      cargando: true,
      error: null
    };

    this.ticketsSub = this.consulta(
      'tickets',
      () => this.service.obtenerParalelosTickets(
        this.filtrosEfectivos,
        this.paginaTickets,
        this.tamanoTickets,
        this.tipoTicketLocal,
        this.resolutorBusqueda
      ),
      d => this.datosTickets = d,
      this.version
    ).subscribe();
  }
  abrirDetalle(ticket: TicketsParallelTicketItem): void {
    this.detalleSub?.unsubscribe();
    this.ticketSeleccionado = ticket; this.detalleTicket = null;
    this.estados.detalle = { cargando: true, error: null };
    this.detalleSub = this.consulta('detalle', () => this.service.obtenerDetalleTicketParalelo(
      ticket.ticket_id, ticket.ticket_type, ticket.resolutor, this.filtrosEfectivos),
      d => this.detalleTicket = d, this.version).subscribe();
  }
  cerrarDetalle(): void {
    this.detalleSub?.unsubscribe(); this.ticketSeleccionado = null; this.detalleTicket = null;
    this.estados.detalle = { cargando: false, error: null };
  }

  nombreMes(periodo: string, corto = false): string {
    const [y, m] = periodo.split('-').map(Number);
    const texto = new Intl.DateTimeFormat('es-PE', { month: corto ? 'short' : 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }


  private inicializarGrafico(): void {
    if (!this.resumenCanvas) return;

    this.chart = new Chart<'bar', number[], string>(
      this.resumenCanvas.nativeElement,
      {
        type: 'bar',
        data: {
          labels: [],
          datasets: this.etiquetas.map((label, i) => ({
            label,
            data: [],
            backgroundColor: this.colores[i],
            borderRadius: 4,
            maxBarThickness: 42,
            categoryPercentage: 0.82,
            barPercentage: 0.88,
            borderColor: this.colores[i],
            borderWidth: 0
          }))
        },
        plugins: [
          ChartDataLabels as unknown as Plugin<'bar'>
        ],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          layout: {
            padding: {
              top: 24,
              right: 8,
              left: 8
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 16,
                color: '#667085'
              }
            },
            datalabels: {
              display: c =>
                Number(c.dataset.data[c.dataIndex] ?? 0) > 0
                  ? 'auto'
                  : false,
              anchor: 'end',
              align: 'end',
              offset: 2,
              clamp: true,
              clip: false,
              color: '#344054',
              font: {
                size: 10,
                weight: 'bold'
              },
              formatter: (v: number) =>
                v.toLocaleString('es-PE')
            },
            tooltip: {
              callbacks: {
                label: c =>
                  `${c.dataset.label}: ${Number(
                    c.parsed.y ?? 0
                  ).toLocaleString('es-PE')}`
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
            y: {
              beginAtZero: true,
              grace: '15%',
              ticks: {
                precision: 0,
                color: '#667085'
              },
              title: {
                display: true,
                text: 'Tickets'
              },
              grid: {
                color: '#E5E9EE'
              }
            }
          },
          onClick: (_event, elementos) => {
            const indice = elementos[0]?.index;

            const item = indice === undefined
              ? undefined
              : this.resumenMensual[indice];

            if (item) {
              this.cambiarPeriodo(
                this.periodoSeleccionado === item.periodo
                  ? null
                  : item.periodo
              );
            }
          }
        }
      }
    );

    this.actualizarGrafico();
  }


  private actualizarGrafico(): void {
    if (!this.chart) return;
    const claves = ['incidentes_evaluados', 'incidentes_paralelos', 'requerimientos_evaluados', 'requerimientos_paralelos'] as const;
    this.chart.data.labels = this.resumenMensual.map(r => this.nombreMes(r.periodo, true));
    this.chart.data.datasets.forEach((d, i) => {
      d.data = this.resumenMensual.map(r => r[claves[i]]);
      d.backgroundColor = this.resumenMensual.map(r => !this.periodoSeleccionado || r.periodo === this.periodoSeleccionado
        ? this.colores[i] : `${this.colores[i]}45`);
      d.borderWidth = this.resumenMensual.map(r => this.periodoSeleccionado === r.periodo ? 1 : 0);
    });
    this.chart.update();
  }
  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    this.errorPantallaCompleta = null;
    try {
      if (document.fullscreenElement === elemento) await document.exitFullscreen();
      else await elemento.requestFullscreen();
    } catch { this.errorPantallaCompleta = 'No se pudo activar la pantalla completa.'; this.cdr.markForCheck(); }
  }
  @HostListener('document:fullscreenchange') actualizarPantallaCompleta(): void {
    this.graficoExpandido = !!this.resumenFs && document.fullscreenElement === this.resumenFs.nativeElement;
    this.chart?.resize(); this.cdr.markForCheck();
  }
}
