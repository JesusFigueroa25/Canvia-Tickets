import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { IncidentConsolidatedRendimientoOut, IncidentConsolidatedRendimientoResolutorItem } from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-resolutor-performance-table',
  standalone: false,
  templateUrl: './resolver-performance-table.html',
  styleUrl: './resolver-performance-table.css'
})
export class ResolverPerformanceTable implements OnChanges {

  @Input() datos: IncidentConsolidatedRendimientoOut | null = null;
  @Input() opcionesResolutores: string[] = [];
  @Input() resolutorSeleccionado: string | null = null;
  @Input() cargando: boolean = false;
  @Output() resolutorChange = new EventEmitter<string | null>();
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number; }>();

  columnasMostradas: string[] = [
    'nombre_resolutor',
    'total'
  ];

  busquedaResolutor: string = '';

  get resolutoresFiltrados(): string[] {
    const busqueda = this.busquedaResolutor.trim().toLowerCase();
    if (!busqueda) {
      return this.opcionesResolutores;
    }
    return this.opcionesResolutores.filter(
      resolutor => resolutor.toLowerCase().includes(busqueda)
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.columnasMostradas = [
        'nombre_resolutor',
        ...(this.datos?.periodos.map(item => item.periodo) ?? []),
        'total'
      ];
    }
  }

  filtrarResolutores(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaResolutor = input.value;
  }

  abrirComboResolutor(abierto: boolean): void {
    if (abierto) {
      this.busquedaResolutor = '';
    }
  }

  manejarTeclaBusqueda(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }

  seleccionarResolutor(resolutor: string | null): void {
    if (this.cargando) {
      return;
    }

    this.busquedaResolutor = '';
    this.resolutorChange.emit(resolutor);
  }

  seleccionarFila(fila: IncidentConsolidatedRendimientoResolutorItem): void {
    if (this.cargando) {
      return;
    }

    const nuevoResolutor =
      this.resolutorSeleccionado === fila.nombre_resolutor
        ? null
        : fila.nombre_resolutor;

    this.seleccionarResolutor(nuevoResolutor);
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