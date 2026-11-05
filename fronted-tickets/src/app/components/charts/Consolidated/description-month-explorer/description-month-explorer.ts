import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { IncidentConsolidatedExploradorDescripcionesOut, IncidentConsolidatedExploradorDescripcionItem } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-description-month-explorer',
  standalone: false,
  templateUrl: './description-month-explorer.html',
  styleUrl: './description-month-explorer.css'
})
export class DescriptionMonthExplorer implements OnChanges {

  @Input() datos: IncidentConsolidatedExploradorDescripcionesOut | null = null;
  @Input() descripcionSeleccionada: string | null = null;
  @Input() busqueda: string = '';
  @Input() cargando: boolean = false;
  @Output() descripcionChange = new EventEmitter<string | null>();
  @Output() busquedaChange = new EventEmitter<string>();
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number; }>();

  columnasMostradas: string[] = [
    'descripcion',
    'total'
  ];

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos']) {
      this.columnasMostradas = [
        'descripcion',
        ...(this.datos?.periodos.map(item => item.periodo) ?? []),
        'total'
      ];
    }
  }

  cambiarBusqueda(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaChange.emit(input.value);
  }

  limpiarBusqueda(): void {
    this.busquedaChange.emit('');
  }

  seleccionarDescripcion(descripcion: string | null): void {

    if (this.cargando) {
      return;
    }

    this.descripcionChange.emit(descripcion);
  }

  seleccionarFila(
    fila: IncidentConsolidatedExploradorDescripcionItem
  ): void {

    if (this.cargando) {
      return;
    }

    const nuevaDescripcion =
      this.descripcionSeleccionada === fila.descripcion
        ? null
        : fila.descripcion;

    this.seleccionarDescripcion(nuevaDescripcion);
  }

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