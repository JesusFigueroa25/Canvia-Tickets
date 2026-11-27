import { ChangeDetectorRef, Component, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TicketsParallelProjectItem } from '../../../../models/tickets-manual-updates';
import { catalogoProyectos, construirFilasProyectos, FilaProyectoParalelo, nombreMesProyecto, ordenarFilasProyectos, periodosProyectos, TipoLocalProyecto } from '../parallel-project-view.utils';

@Component({
  selector: 'app-parallel-project-monthly-table',
  standalone: false,
  templateUrl: './parallel-project-monthly-table.html',
  styleUrl: './parallel-project-monthly-table.css'
})
export class ParallelProjectMonthlyTable implements OnChanges {
  @Input() datos: readonly TicketsParallelProjectItem[] = [];
  @Input() desde: string | null = null;
  @Input() hasta: string | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  tipo: TipoLocalProyecto = '';
  busqueda = '';
  proyectosDisponibles: { nombre: string; alp: string | null }[] = [];
  proyectosSeleccionados: string[] = [];
  periodos: string[] = [];
  filasVisibles: FilaProyectoParalelo[] = [];
  private filasFiltradas: FilaProyectoParalelo[] = [];
  columnaOrden = 'total';
  ordenDescendente = true;
  readonly tamanosPagina = [10, 25, 50, 100];
  paginaActual = 1;
  tamanoActual = 10;
  totalesMes: Record<string, number> = {};
  totalVisible = 0;
  expandido = false;
  errorPantallaCompleta: string | null = null;
  private elementoExpandido?: HTMLElement;
  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['desde'] || changes['hasta'] || changes['cargando']) {
      this.periodos = periodosProyectos(this.datos, this.desde, this.hasta);
      this.proyectosDisponibles = catalogoProyectos(this.datos, this.periodos);
      if (!this.cargando && !this.error) {
        const nombres = new Set(this.proyectosDisponibles.map(p => p.nombre));
        this.proyectosSeleccionados = this.proyectosSeleccionados.filter(p => nombres.has(p));
      }
      if (this.columnaOrden !== 'alp' && this.columnaOrden !== 'nombre' && this.columnaOrden !== 'total' && !this.periodos.includes(this.columnaOrden)) {
        this.columnaOrden = 'total'; this.ordenDescendente = true;
      }
      this.reconstruir();
    }
  }
  private reconstruir(): void {
    this.filasFiltradas = ordenarFilasProyectos(construirFilasProyectos(this.datos, this.periodos, this.tipo, this.busqueda, this.proyectosSeleccionados), this.columnaOrden, this.ordenDescendente);
    this.paginaActual = 1;
    this.actualizarPagina();
  }
  private actualizarPagina(): void {
    const inicio = (this.paginaActual - 1) * this.tamanoActual;
    this.filasVisibles = this.filasFiltradas.slice(inicio, inicio + this.tamanoActual);
    this.totalesMes = Object.fromEntries(this.periodos.map(p => [p, this.filasVisibles.reduce((s, f) => s + (f.mensual[p] ?? 0), 0)]));
    this.totalVisible = this.filasVisibles.reduce((s, f) => s + f.total, 0);
  }
  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'Incident' || valor === 'Service Request') { this.tipo = valor; this.reconstruir(); }
  }
  seleccionarProyecto(nombre: string, evento: Event): void {
    const marcados = new Set(this.proyectosSeleccionados);
    if ((evento.target as HTMLInputElement).checked) marcados.add(nombre); else marcados.delete(nombre);
    this.proyectosSeleccionados = [...marcados]; this.reconstruir();
  }
  limpiarProyectos(): void { this.proyectosSeleccionados = []; this.reconstruir(); }
  buscar(evento: Event): void { this.busqueda = (evento.target as HTMLInputElement).value; this.reconstruir(); }
  limpiarBusqueda(): void { this.busqueda = ''; this.reconstruir(); }
  ordenar(columna: string): void {
    if (columna === this.columnaOrden) this.ordenDescendente = !this.ordenDescendente;
    else { this.columnaOrden = columna; this.ordenDescendente = columna !== 'nombre' && columna !== 'alp'; }
    this.reconstruir();
  }
  indicadorOrden(columna: string): string { return columna !== this.columnaOrden ? '↕' : this.ordenDescendente ? '↓' : '↑'; }
  ariaOrden(columna: string): 'none' | 'ascending' | 'descending' { return columna !== this.columnaOrden ? 'none' : this.ordenDescendente ? 'descending' : 'ascending'; }
  get totalRegistros(): number { return this.filasFiltradas.length; }
  get totalPaginas(): number { return Math.ceil(this.totalRegistros / this.tamanoActual); }
  get primerRegistro(): number { return this.totalRegistros ? (this.paginaActual - 1) * this.tamanoActual + 1 : 0; }
  get ultimoRegistro(): number { return Math.min(this.paginaActual * this.tamanoActual, this.totalRegistros); }
  cambiarPagina(pagina: number): void {
    if (this.cargando || pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina; this.actualizarPagina();
  }
  cambiarTamanoPagina(evento: Event): void {
    const tamano = Number((evento.target as HTMLSelectElement).value);
    if (!this.tamanosPagina.includes(tamano)) return;
    this.tamanoActual = tamano; this.paginaActual = 1; this.actualizarPagina();
  }
  formatearNumero(valor: number): string { return valor.toLocaleString('es-PE'); }
  formatearPeriodo(periodo: string): string { return nombreMesProyecto(periodo, true); }
  identificarFila(_i: number, fila: FilaProyectoParalelo): string { return fila.nombre; }
  identificarPeriodo(_i: number, periodo: string): string { return periodo; }
  async alternarPantallaCompleta(elemento: HTMLElement): Promise<void> {
    this.elementoExpandido = elemento; this.errorPantallaCompleta = null;
    try { if (document.fullscreenElement === elemento) await document.exitFullscreen(); else await elemento.requestFullscreen(); }
    catch { this.errorPantallaCompleta = 'No se pudo activar la pantalla completa.'; this.cdr.markForCheck(); }
  }
  @HostListener('document:fullscreenchange') actualizarPantallaCompleta(): void {
    this.expandido = !!this.elementoExpandido && document.fullscreenElement === this.elementoExpandido;
    this.cdr.markForCheck();
  }
}
