
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { AuditTicket, AuditTicketList, AuditSolutionStatus } from '../../../../models/requirement-categorization-audit';

@Component({
  selector: 'app-requirement-categorization-tickets-table',
  standalone: false,
  templateUrl: './requirement-categorization-tickets-table.html',
  styleUrl: './requirement-categorization-tickets-table.css'
})
export class RequirementCategorizationTicketsTable implements OnChanges {

  @Input() datos: AuditTicketList | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number }>();

  @Input() opcionesTicketIds: string[] = [];
  @Input() ticketIdSeleccionado: string | null = null;

  @Output() ticketIdChange = new EventEmitter<string | null>();

  busquedaTicketId = '';
  ticketIdsFiltrados: string[] = [];
  totalCoincidenciasTickets = 0;
  readonly limiteOpcionesTickets = 100;

  columnasMostradas: string[] = [
    'ticket_id',
    'project_name',
    'resolver_name',
    'original_category',
    'result_status',
    'suggested_category',
    'reason_text',
    'actions'
  ];

  ticketSeleccionado: AuditTicket | null = null;


  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos']) {

      const disponible = this.datos?.items.some(
        item => item.result_id === this.ticketSeleccionado?.result_id
      );

      if (!disponible) {
        this.ticketSeleccionado = null;
      }
    }

    if (
      changes['opcionesTicketIds'] ||
      changes['ticketIdSeleccionado']
    ) {
      this.actualizarOpcionesTickets();
    }
  }


  seleccionarTicket(ticket: AuditTicket): void {
    if (this.cargando) {
      return;
    }

    if (this.ticketSeleccionado?.result_id === ticket.result_id) {
      this.ticketSeleccionado = null;
      return;
    }

    this.ticketSeleccionado = ticket;
  }

  cerrarDetalle(): void {
    this.ticketSeleccionado = null;
  }



  @HostListener('document:keydown.escape')
  cerrarDetalleConEscape(): void {

    if (this.ticketSeleccionado) {
      this.cerrarDetalle();
    }
  }


  // FILTRO DINÁMICO: EXPLORADOR DE TICKETS AUDITADOS
  private actualizarOpcionesTickets(): void {

    const busqueda = this.busquedaTicketId
      .trim()
      .toLocaleLowerCase();

    const coincidencias = this.opcionesTicketIds.filter(
      ticketId =>
        ticketId.toLocaleLowerCase().includes(busqueda)
    );

    this.totalCoincidenciasTickets = coincidencias.length;

    const visibles = coincidencias.slice(
      0,
      this.limiteOpcionesTickets
    );

    if (
      this.ticketIdSeleccionado &&
      !visibles.includes(this.ticketIdSeleccionado)
    ) {
      visibles.unshift(this.ticketIdSeleccionado);
    }

    this.ticketIdsFiltrados = visibles;
  }


  filtrarTickets(event: Event): void {

    this.busquedaTicketId =
      (event.target as HTMLInputElement).value;

    this.actualizarOpcionesTickets();
  }


  abrirComboTickets(_abierto: boolean): void {

    this.busquedaTicketId = '';
    this.actualizarOpcionesTickets();
  }


  manejarTeclaBusquedaTickets(event: KeyboardEvent): void {

    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }


  seleccionarTicketDesdeCombo(
    ticketId: string | null
  ): void {

    this.busquedaTicketId = '';

    this.ticketIdChange.emit(ticketId);
  }

  seleccionarTicketFiltroDesdeFila(
    ticket: AuditTicket
  ): void {

    if (this.cargando || this.error) {
      return;
    }

    this.ticketIdChange.emit(ticket.ticket_id);
  }


  cambiarPagina(event: PageEvent): void {
    if (this.cargando) {
      return;
    }

    this.ticketSeleccionado = null;

    this.paginaChange.emit({
      pagina: event.pageIndex + 1,
      tamano: event.pageSize
    });
  }

  obtenerRutaOriginal(ticket: AuditTicket): string {
    return this.construirRuta(
      ticket.original_level_1,
      ticket.original_level_2,
      ticket.original_level_3
    );
  }

  obtenerRutaSugerida(ticket: AuditTicket): string {
    return this.construirRuta(
      ticket.suggested_level_1,
      ticket.suggested_level_2,
      ticket.suggested_level_3
    );
  }

  private construirRuta(
    nivel1: string | null,
    nivel2: string | null,
    nivel3: string | null
  ): string {
    const niveles = [nivel1, nivel2, nivel3]
      .map(nivel => nivel?.trim() ?? '')
      .filter(nivel => nivel.length > 0);

    return niveles.length > 0
      ? niveles.join(' / ')
      : 'No disponible';
  }

  obtenerEstadoSolucion(estado: AuditSolutionStatus | null): string {
    const estados: Record<AuditSolutionStatus, string> = {
      PRESENT: 'Solución registrada',
      MISSING_REQUIRED: 'Solución obligatoria faltante',
      OPTIONAL_MISSING: 'Solución opcional ausente',
      REVIEW_STATUS: 'Estado por verificar'
    };

    return estado ? estados[estado] : 'No disponible';
  }

  obtenerClaseResultado(ticket: AuditTicket): string {
    return ticket.result_status === 'CORRECT'
      ? 'result-correct'
      : 'result-incorrect';
  }

  obtenerTextoResultado(ticket: AuditTicket): string {
    return ticket.result_status === 'CORRECT'
      ? 'Correcta'
      : 'Incorrecta';
  }

  get tieneDatos(): boolean {
    return (this.datos?.total ?? 0) > 0;
  }
}
