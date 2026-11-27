import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TipoTicketParalelo, TicketsParallelTicketsOut, TicketsParallelTicketItem } from '../../../../models/tickets-manual-updates';
import { fechaParalela, tipoParalelo, identidadParalela } from '../parallel-ticket-view.utils';
import { Subject, Subscription, debounceTime } from 'rxjs';
@Component({
  selector: 'app-parallel-ticket-explorer-table',
  standalone: false,
  styleUrl: './parallel-ticket-explorer-table.css',
  templateUrl: './parallel-ticket-explorer-table.html',
})
export class ParallelTicketExplorerTable implements OnDestroy {
  @Input() datos: TicketsParallelTicketsOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Input() tipo: TipoTicketParalelo | null = null;
  @Input() pagina = 1;
  @Input() tamano = 25;
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number }>();
  @Output() tipoChange = new EventEmitter<TipoTicketParalelo | null>();
  @Output() detalle = new EventEmitter<TicketsParallelTicketItem>();
  @ViewChild('tablaFs') tablaFs?: ElementRef<HTMLElement>;
  readonly tamanosPagina = [10, 25, 50, 100];
  readonly formatearFecha = fechaParalela;
  readonly nombreTipo = tipoParalelo;
  readonly identificarFila = (_: number, fila: TicketsParallelTicketItem) => identidadParalela(fila);
  expandida = false;
  @Input() busquedaResolutor = '';

  @Output() busquedaResolutorChange =
    new EventEmitter<string>();

  private busquedaSubject = new Subject<string>();

  private busquedaSub: Subscription =
    this.busquedaSubject.pipe(
      debounceTime(350)
    ).subscribe(valor => {
      this.busquedaResolutorChange.emit(valor);
    });
  errorPantallaCompleta: string | null = null;
  private destruido = false;

  get filas(): TicketsParallelTicketItem[] {
    return this.datos?.items ?? [];
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  buscarResolutor(evento: Event): void {

    this.busquedaResolutor =
      (evento.target as HTMLInputElement).value;

    this.busquedaSubject.next(
      this.busquedaResolutor
    );
  }

  limpiarBusquedaResolutor(): void {
    this.busquedaResolutor = '';
    this.busquedaSubject.next('');
  }
  
  get totalRegistros(): number { return this.datos?.total ?? 0; }
  get paginaActual(): number { return this.datos?.pagina ?? this.pagina; }
  get tamanoActual(): number { return this.datos?.tamano ?? this.tamano; }
  get totalPaginas(): number { return Math.ceil(this.totalRegistros / this.tamanoActual); }
  get primerRegistro(): number {
    return this.datos?.items.length
      ? (this.paginaActual - 1) * this.tamanoActual + 1
      : 0;
  }

  get ultimoRegistro(): number {
    return this.datos?.items.length
      ? Math.min(
        this.totalRegistros,
        this.primerRegistro + this.datos.items.length - 1
      )
      : 0;
  }
  get controlesDeshabilitados(): boolean { return this.cargando || !this.datos || !!this.error; }

  constructor(private cdr: ChangeDetectorRef) { }

  cambiarTipo(evento: Event): void {
    if (this.controlesDeshabilitados) return;
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor !== '' && valor !== 'Incident' && valor !== 'Service Request') return;
    const tipo: TipoTicketParalelo | null = valor === '' ? null : valor;
    if (tipo !== this.tipo) this.tipoChange.emit(tipo);
  }
  cambiarPagina(pagina: number): void {
    if (this.controlesDeshabilitados || !Number.isInteger(pagina) || pagina < 1 || pagina > this.totalPaginas || pagina === this.paginaActual) return;
    this.paginaChange.emit({ pagina, tamano: this.tamanoActual });
  }
  cambiarTamanoPagina(evento: Event): void {
    const tamano = Number((evento.target as HTMLSelectElement).value);
    if (this.controlesDeshabilitados || !this.tamanosPagina.includes(tamano) || tamano === this.tamanoActual) return;
    this.paginaChange.emit({ pagina: 1, tamano });
  }
  reintentar(): void {
    if (!this.cargando && this.error) this.paginaChange.emit({ pagina: this.pagina, tamano: this.tamano });
  }
  verDetalle(fila: TicketsParallelTicketItem): void {
    if (!this.controlesDeshabilitados) this.detalle.emit(fila);
  }
  async alternarPantallaCompleta(): Promise<void> {
    const elemento = this.tablaFs?.nativeElement;
    if (!elemento || this.destruido) return;
    this.errorPantallaCompleta = null;
    try {
      if (document.fullscreenElement === elemento) await document.exitFullscreen();
      else await elemento.requestFullscreen();
    } catch {
      if (!this.destruido) this.errorPantallaCompleta = 'No se pudo activar la pantalla completa.';
    }
    if (!this.destruido) this.cdr.markForCheck();
  }
  @HostListener('document:fullscreenchange') actualizarPantallaCompleta(): void {
    this.expandida = !!this.tablaFs && document.fullscreenElement === this.tablaFs.nativeElement;
    this.cdr.markForCheck();
  }
  ngOnDestroy(): void {
    this.destruido = true;
    if (this.tablaFs && document.fullscreenElement === this.tablaFs.nativeElement) void document.exitFullscreen().catch(() => { });
  }
}
