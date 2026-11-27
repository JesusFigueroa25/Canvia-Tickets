import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { TicketsParallelTicketItem, TicketsParallelDetailOut, TicketsParallelEvidenceItem } from '../../../../models/tickets-manual-updates';
import { fechaParalela, tipoParalelo, duracionParalela } from '../parallel-ticket-view.utils';

@Component({
  selector: 'app-parallel-ticket-detail-dialog',
  standalone: false,
  styleUrl: './parallel-ticket-detail-dialog.css',
  templateUrl: './parallel-ticket-detail-dialog.html',
})
export class ParallelTicketDetailDialog implements AfterViewInit, OnChanges, OnDestroy {
  @Input() ticket!: TicketsParallelTicketItem;
  @Input() datos: TicketsParallelDetailOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() reintentar = new EventEmitter<TicketsParallelTicketItem>();
  @ViewChild('dialogo') dialogo?: ElementRef<HTMLDialogElement>;
  readonly formatearFecha = fechaParalela;
  readonly nombreTipo = tipoParalelo;
  readonly formatearDuracion = duracionParalela;
  readonly identificarEvidencia = (_: number, e: TicketsParallelEvidenceItem) => JSON.stringify([e.rol, e.report_time_id]);
  expandidos = new Set<number>();
  private finalizado = false;
  private focoAnterior: HTMLElement | null = null;

  get ticketVisible(): TicketsParallelTicketItem { return this.datos?.ticket ?? this.ticket; }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos'] || changes['ticket']) this.expandidos.clear();
  }
  ngAfterViewInit(): void {
    const elemento = this.dialogo?.nativeElement;
    if (!elemento || elemento.open) return;
    this.focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    elemento.showModal();
  }
  alternarEvidencia(indice: number): void {
    if (this.expandidos.has(indice)) this.expandidos.delete(indice);
    else this.expandidos.add(indice);
  }
  solicitarReintento(): void { if (!this.cargando && this.error && !this.finalizado) this.reintentar.emit(this.ticket); }
  solicitarCierre(evento?: Event): void {
    evento?.preventDefault();
    if (this.finalizado) return;
    this.finalizado = true;
    this.dialogo?.nativeElement.close();
    this.cerrar.emit();
  }
  ngOnDestroy(): void {
    this.finalizado = true;
    if (this.dialogo?.nativeElement.open) this.dialogo.nativeElement.close();
    if (this.focoAnterior?.isConnected) this.focoAnterior.focus({ preventScroll: true });
  }
}
