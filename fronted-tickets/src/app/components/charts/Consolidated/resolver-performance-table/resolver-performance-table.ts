import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ResolutorRendimientoOut, ResolutorRendimientoItem } from '../../../../models/resolutor-dashboard';

@Component({
  selector: 'app-resolutor-performance-table',
  standalone: false,
  templateUrl: './resolver-performance-table.html',
  styleUrl: './resolver-performance-table.css'
})
export class ResolverPerformanceTable implements OnChanges {

  /** Contrato compartido por los seis dashboards. Compatible estructuralmente con Incidentes Consolidados. */
  @Input() datos: ResolutorRendimientoOut | null = null;
  /** Por defecto conserva los textos originales del dashboard de Incidentes Consolidados. */
  @Input() titulo = 'Rendimiento por Resolutor';
  @Input() descripcion =
    'Distribución mensual de incidentes por resolutor. Selecciona uno para filtrar el dashboard.';
  @Input() opcionesResolutores: string[] = [];
  @Input() resolutorSeleccionado: string | null = null;
  @Input() cargando: boolean = false;
  @Output() resolutorChange = new EventEmitter<string | null>();
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number; }>();
  // PANTALLA COMPLETA
  @Input() habilitarPantallaCompleta = false;
  @Input() pantallaCompletaActiva = false;
  @Output() pantallaCompletaSolicitada = new EventEmitter<void>();

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

  seleccionarFila(fila: ResolutorRendimientoItem): void {
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
