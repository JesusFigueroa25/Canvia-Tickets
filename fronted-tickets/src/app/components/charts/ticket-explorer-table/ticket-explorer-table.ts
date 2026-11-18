
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import { PageEvent } from '@angular/material/paginator';



export type TipoDashboardTickets =
  | 'incident-consolidated'
  | 'incident-sla'
  | 'requirement-consolidated'
  | 'requirement-sla'
  | 'task-consolidated';



export interface TablaTicketsPaginados {
  tickets: object[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


interface ColumnaTicket {
  clave: string;
  titulo: string;
  fecha?: boolean;
  larga?: boolean;
}


// COLUMNAS DE INCIDENTES CONSOLIDADOS
const COLUMNAS_CONSOLIDADOS: ColumnaTicket[] = [
  { clave: 'Ticket_ID', titulo: 'Ticket ID' },
  { clave: 'Fecha_Apertura', titulo: 'Fecha Apertura', fecha: true },
  { clave: 'Fecha_Resolucion', titulo: 'Fecha Resolución', fecha: true },
  { clave: 'Fecha_Cierre', titulo: 'Fecha Cierre', fecha: true },
  { clave: 'Fecha_Ultima_Modificacion', titulo: 'Última Modificación', fecha: true },
  { clave: 'Proyecto', titulo: 'Proyecto' },
  { clave: 'ALP', titulo: 'ALP' },
  { clave: 'BU', titulo: 'BU' },
  { clave: 'Grupo_Resolutor', titulo: 'Grupo Resolutor' },
  { clave: 'Nombre_Resolutor', titulo: 'Nombre Resolutor' },
  { clave: 'Categorizacion_Nivel_1', titulo: 'Categorización Nivel 1' },
  { clave: 'Categorizacion_Nivel_2', titulo: 'Categorización Nivel 2' },
  { clave: 'Categorizacion_Nivel_3', titulo: 'Categorización Nivel 3' },
  { clave: 'Prioridad', titulo: 'Prioridad' },
  { clave: 'Urgencia', titulo: 'Urgencia' },
  { clave: 'Impacto', titulo: 'Impacto' },
  { clave: 'Estado', titulo: 'Estado' },
  { clave: 'Motivo_Estado', titulo: 'Motivo Estado' },
  { clave: 'Descripcion', titulo: 'Descripción', larga: true },
  { clave: 'Detalle', titulo: 'Detalle', larga: true },
  { clave: 'Fuente_Reportada', titulo: 'Fuente Reportada' },
  { clave: 'Solucion', titulo: 'Solución', larga: true },
  { clave: 'Causa', titulo: 'Causa', larga: true },
  { clave: 'Motivo_Resolucion', titulo: 'Motivo Resolución' }
];


// REQUERIMIENTOS CONSOLIDADOS NO TIENE CAUSA
const COLUMNAS_REQUERIMIENTOS_CONSOLIDADOS =
  COLUMNAS_CONSOLIDADOS.filter(
    columna => columna.clave !== 'Causa'
  );

const COLUMNAS_TAREAS_CONSOLIDADAS: ColumnaTicket[] = [
  { clave: 'Ticket_ID', titulo: 'Ticket ID' },
  { clave: 'Ticket_Padre', titulo: 'Ticket Padre' },
  { clave: 'Fecha_Apertura', titulo: 'Fecha Apertura', fecha: true },
  { clave: 'Fecha_Resolucion', titulo: 'Fecha Resolución', fecha: true },
  { clave: 'Fecha_Cierre', titulo: 'Fecha Cierre', fecha: true },
  { clave: 'Fecha_Ultima_Modificacion', titulo: 'Última Modificación', fecha: true },
  { clave: 'Proyecto', titulo: 'Proyecto' },
  { clave: 'ALP', titulo: 'ALP' },
  { clave: 'BU', titulo: 'BU' },
  { clave: 'Grupo_Resolutor', titulo: 'Grupo Resolutor' },
  { clave: 'Nombre_Resolutor', titulo: 'Nombre Resolutor' },
  { clave: 'Categorizacion_Nivel_1', titulo: 'Categorización Nivel 1' },
  { clave: 'Categorizacion_Nivel_2', titulo: 'Categorización Nivel 2' },
  { clave: 'Categorizacion_Nivel_3', titulo: 'Categorización Nivel 3' },
  { clave: 'Prioridad', titulo: 'Prioridad' },
  { clave: 'Urgencia', titulo: 'Urgencia' },
  { clave: 'Impacto', titulo: 'Impacto' },
  { clave: 'Estado', titulo: 'Estado' },
  { clave: 'Motivo_Estado', titulo: 'Motivo Estado' },
  { clave: 'Descripcion', titulo: 'Descripción', larga: true },
  { clave: 'Detalle', titulo: 'Detalle', larga: true },
  { clave: 'Fuente_Reportada', titulo: 'Fuente Reportada' }
];



// COLUMNAS DE INCIDENTES SLA Y REQUERIMIENTOS SLA
const COLUMNAS_SLA: ColumnaTicket[] = [
  { clave: 'Ticket_ID', titulo: 'Ticket ID' },
  { clave: 'Proyecto', titulo: 'Proyecto' },
  { clave: 'Descripcion', titulo: 'Descripción', larga: true },
  { clave: 'Detalle', titulo: 'Detalle', larga: true },
  { clave: 'Fecha_Creacion', titulo: 'Fecha Creación', fecha: true },
  { clave: 'Fecha_Resolucion', titulo: 'Fecha Resolución', fecha: true },
  { clave: 'Estado', titulo: 'Estado' },
  { clave: 'Codigo_Motivo', titulo: 'Código Motivo' },
  { clave: 'Prioridad', titulo: 'Prioridad' },
  { clave: 'Usuario_Resolutor', titulo: 'Usuario Resolutor' },
  { clave: 'Grupo_Resolutor', titulo: 'Grupo Resolutor' },
  { clave: 'Categorizacion_Clase', titulo: 'Categorización Clase' },
  { clave: 'Categorizacion_Categoria', titulo: 'Categorización Categoría' },
  { clave: 'Categorizacion_Tipo', titulo: 'Categorización Tipo' },
  { clave: 'SLA_Respuesta_Condicion', titulo: 'SLA Respuesta' },
  { clave: 'OLA_Respuesta_Condicion', titulo: 'OLA Respuesta' },
  { clave: 'SLA_Solucion_Condicion', titulo: 'SLA Solución' },
  { clave: 'OLA_Solucion_Condicion', titulo: 'OLA Solución' },
  { clave: 'Condicion_dia', titulo: 'Condición Día' }
];


@Component({
  selector: 'app-ticket-explorer-table',
  standalone: false,
  templateUrl: './ticket-explorer-table.html',
  styleUrl: './ticket-explorer-table.css'
})
export class TicketExplorerTable implements OnChanges {

  @Input() tipoDashboard: TipoDashboardTickets = 'incident-consolidated';
  @Input() datos: TablaTicketsPaginados | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Input() ticketIdSeleccionado: string | null = null;
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number }>();
  @Output() ticketIdChange = new EventEmitter<string | null>();

  // PANTALLA COMPLETA
  @Input() habilitarPantallaCompleta = false;
  @Input() pantallaCompletaActiva = false;
  @Output() pantallaCompletaSolicitada = new EventEmitter<void>();


  // ESTADO LOCAL
  busquedaTicketId = '';
  mensajeBusqueda: string | null = null;
  columnas: ColumnaTicket[] = COLUMNAS_CONSOLIDADOS;
  columnasMostradas: string[] = [];
  ticketDetalle: object | null = null;


  constructor() {
    this.configurarColumnas();
  }


  ngOnChanges(changes: SimpleChanges): void {

    if (changes['tipoDashboard']) {
      this.configurarColumnas();
      this.cerrarDetalle();
    }

    if (changes['ticketIdSeleccionado']) {
      this.busquedaTicketId = this.ticketIdSeleccionado ?? '';
      this.mensajeBusqueda = null;
    }

    if (changes['datos'] && this.ticketDetalle) {

      const ticketId = this.obtenerTicketId(this.ticketDetalle);

      this.ticketDetalle = this.datos?.tickets.find(
        ticket => this.obtenerTicketId(ticket) === ticketId
      ) ?? null;
    }
  }


  // CONFIGURAR TODAS LAS COLUMNAS SEGÚN EL MODELO
  private configurarColumnas(): void {

    switch (this.tipoDashboard) {

      case 'incident-consolidated':
        this.columnas = COLUMNAS_CONSOLIDADOS;
        break;

      case 'requirement-consolidated':
        this.columnas = COLUMNAS_REQUERIMIENTOS_CONSOLIDADOS;
        break;

      case 'incident-sla':

      case 'requirement-sla':
        this.columnas = COLUMNAS_SLA;
        break;

      case 'task-consolidated':
        this.columnas = COLUMNAS_TAREAS_CONSOLIDADAS;
        break;


      default:
        this.columnas = COLUMNAS_CONSOLIDADOS;
    }

    this.columnasMostradas = [
      ...this.columnas.map(columna => columna.clave),
      'acciones'
    ];
  }


  // NOMBRE DEL DASHBOARD
  get nombreDashboard(): string {

    switch (this.tipoDashboard) {

      case 'incident-consolidated':
        return 'Incidentes Consolidados';

      case 'incident-sla':
        return 'Incidentes SLA';

      case 'requirement-consolidated':
        return 'Requerimientos Consolidados';

      case 'requirement-sla':
        return 'Requerimientos SLA';

      case 'task-consolidated':
        return 'Tareas Consolidadas';

    }
  }


  // REGISTROS DE LA PÁGINA ACTUAL
  get tickets(): object[] {
    return this.datos?.tickets ?? [];
  }


  get tieneDatos(): boolean {
    return this.tickets.length > 0;
  }


  get indicePagina(): number {
    return Math.max(0, (this.datos?.pagina ?? 1) - 1);
  }


  // LECTURA DINÁMICA DE CUALQUIER COLUMNA
  private obtenerValor(
    ticket: object,
    clave: string
  ): unknown {

    return (ticket as Record<string, unknown>)[clave];
  }


  obtenerTicketId(ticket: object): string {

    const valor = this.obtenerValor(ticket, 'Ticket_ID');

    return valor == null ? '' : String(valor);
  }


  formatearValor(
    ticket: object,
    columna: ColumnaTicket
  ): string {

    const valor = this.obtenerValor(ticket, columna.clave);

    if (valor === null || valor === undefined || valor === '') {
      return 'No disponible';
    }

    const texto = String(valor);

    if (!columna.fecha) {
      return texto;
    }

    // FORMATO DE FECHAS DEL BACKEND:
    // 2026-05-15T10:30:00 -> 15/05/2026 10:30
    const coincidencia = texto.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
    );

    if (coincidencia) {

      const [, anio, mes, dia, hora, minuto] = coincidencia;

      return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
    }

    return texto;
  }


  // FILTRO DINÁMICO POR TICKET ID
  actualizarBusqueda(event: Event): void {

    this.busquedaTicketId =
      (event.target as HTMLInputElement).value;

    this.mensajeBusqueda = null;
  }


  aplicarBusqueda(): void {

    if (this.cargando) {
      return;
    }

    const ticketId = this.busquedaTicketId.trim();

    if (ticketId.length > 20) {
      this.mensajeBusqueda = 'El Ticket ID no puede superar 20 caracteres.';
      return;
    }

    this.mensajeBusqueda = null;
    this.cerrarDetalle();

    this.ticketIdChange.emit(ticketId || null);
  }


  limpiarBusqueda(): void {

    if (this.cargando) {
      return;
    }

    this.busquedaTicketId = '';
    this.mensajeBusqueda = null;
    this.cerrarDetalle();

    if (this.ticketIdSeleccionado) {
      this.ticketIdChange.emit(null);
    }
  }


  // FILTRO DINÁMICO DESDE UNA FILA
  seleccionarTicketDesdeFila(ticket: object): void {

    if (this.cargando || this.error) {
      return;
    }

    const ticketId = this.obtenerTicketId(ticket);

    if (!ticketId) {
      return;
    }

    const nuevoTicketId =
      this.ticketIdSeleccionado === ticketId
        ? null
        : ticketId;

    this.busquedaTicketId = nuevoTicketId ?? '';
    this.cerrarDetalle();

    this.ticketIdChange.emit(nuevoTicketId);
  }


  // PAGINACIÓN DESDE SQL SERVER
  cambiarPagina(event: PageEvent): void {

    if (this.cargando) {
      return;
    }

    this.cerrarDetalle();

    this.paginaChange.emit({
      pagina: event.pageIndex + 1,
      tamano: event.pageSize
    });
  }


  // DETALLE COMPLETO DEL TICKET
  abrirDetalle(ticket: object): void {

    if (this.cargando) {
      return;
    }

    const ticketId = this.obtenerTicketId(ticket);

    if (
      this.ticketDetalle &&
      this.obtenerTicketId(this.ticketDetalle) === ticketId
    ) {
      this.cerrarDetalle();
      return;
    }

    this.ticketDetalle = ticket;
  }


  cerrarDetalle(): void {
    this.ticketDetalle = null;
  }


  @HostListener('document:keydown.escape')
  cerrarDetalleConEscape(): void {

    if (this.ticketDetalle) {
      this.cerrarDetalle();
    }
  }


  esTicketSeleccionado(ticket: object): boolean {

    return (
      !!this.ticketIdSeleccionado &&
      this.obtenerTicketId(ticket) === this.ticketIdSeleccionado
    );
  }

}
