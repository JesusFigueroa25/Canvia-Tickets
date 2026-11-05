
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { IncidentConsolidatedDetalleEventoItem, IncidentConsolidatedDetalleEventosOut } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-technical-events-table',
  standalone: false,
  templateUrl: './technical-events-table.html',
  styleUrl: './technical-events-table.css'
})
export class TechnicalEventsTable {

  @Input() datos: IncidentConsolidatedDetalleEventosOut | null = null;
  @Input() busqueda: string = '';
  @Input() cargando: boolean = false;
  @Input() habilitarFiltroDetalle = false;
  @Input() detalleSeleccionadoId: string | null = null;
  @Input() detalleSeleccionadoTexto: string | null = null;
  
  @Output() detalleChange = new EventEmitter<IncidentConsolidatedDetalleEventoItem | null>();
  @Output() busquedaChange = new EventEmitter<string>();
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number; }>();

  // COLUMNAS
  readonly columnasMostradas: string[] = [
    'detalle',
    'total'
  ];

  // FILTRO DINAMICO - SELECCIONAR DETALLE
  seleccionarDetalle(fila: IncidentConsolidatedDetalleEventoItem): void {

    if (!this.habilitarFiltroDetalle || this.cargando || !fila.detalle_id) {
      return;
    }

    if (this.filaSeleccionada(fila)) {
      this.detalleChange.emit(null);
      return;
    }

    this.detalleChange.emit(fila);
  }

  // IDENTIFICAR LA FILA SELECCIONADA

  filaSeleccionada(fila: IncidentConsolidatedDetalleEventoItem): boolean {
    if (!this.detalleSeleccionadoId) {
      return false;
    }
    return (
      fila.detalle_id === this.detalleSeleccionadoId ||
      (
        this.detalleSeleccionadoTexto !== null &&
        fila.detalle === this.detalleSeleccionadoTexto
      )
    );
  }

  // BUSCADOR INTERNO - LOGICA EXISTENTE
  cambiarBusqueda(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaChange.emit(input.value);
  }


  limpiarBusqueda(): void {
    this.busquedaChange.emit('');
  }
  
  // PAGINACION DEL BACKEND - LOGICA EXISTENTE
  cambiarPagina(event: PageEvent): void {
    if (this.cargando) {
      return;
    }

    this.paginaChange.emit({
      pagina: event.pageIndex + 1,
      tamano: event.pageSize
    });
  }
}
