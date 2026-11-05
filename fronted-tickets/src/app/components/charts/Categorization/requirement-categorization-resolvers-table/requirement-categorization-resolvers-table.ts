
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { AuditResolver } from '../../../../models/requirement-categorization-audit';

@Component({
  selector: 'app-requirement-categorization-resolvers-table',
  standalone: false,
  templateUrl: './requirement-categorization-resolvers-table.html',
  styleUrl: './requirement-categorization-resolvers-table.css'
})
export class RequirementCategorizationResolversTable implements OnChanges {

  @Input() datos: AuditResolver[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;


  // FILTRO DINÁMICO POR COLABORADOR
  @Input() opcionesResolutores: string[] = [];
  @Input() resolutorSeleccionado: string | null = null;
  @Output() resolutorChange = new EventEmitter<string | null>();

  busquedaResolutor = '';

  // Buscar en todos los colaboradores del backend.
  get resolutoresFiltrados(): string[] {

    const busqueda = this.busquedaResolutor
      .trim()
      .toLocaleLowerCase('es-PE');

    if (!busqueda) {
      return this.opcionesResolutores;
    }

    return this.opcionesResolutores.filter(
      nombre =>
        nombre.toLocaleLowerCase('es-PE').includes(busqueda)
    );
  }


  @ViewChild(MatPaginator)
  set paginatorReferencia(paginator: MatPaginator | undefined) {
    if (paginator) {
      this.dataSource.paginator = paginator;
    }
  }

  @ViewChild(MatSort)
  set sortReferencia(sort: MatSort | undefined) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  columnasMostradas: string[] = [
    'resolver_name',
    'total_tickets',
    'correct_count',
    'incorrect_count',
    'correct_percentage',
    'incorrect_percentage',
  ];

  dataSource = new MatTableDataSource<AuditResolver>([]);

  totalResolutores = 0;
  totalTickets = 0;
  totalCorrectos = 0;
  totalIncorrectos = 0;
  totalSinSolucionObligatoria = 0;
  porcentajeCorrectos = 0;
  porcentajeIncorrectos = 0;

  constructor() {
    this.dataSource.sortingDataAccessor = (item, propiedad) => {
      const valor = item[propiedad as keyof AuditResolver];

      if (typeof valor === 'number') {
        return valor;
      }

      return String(valor ?? '').toLocaleLowerCase();
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.dataSource.data = [...(this.datos ?? [])];
      this.calcularTotales();

      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }
  }


  private calcularTotales(): void {
    this.totalResolutores = this.datos.length;

    this.totalTickets = this.datos.reduce(
      (total, item) => total + item.total_tickets,
      0
    );

    this.totalCorrectos = this.datos.reduce(
      (total, item) => total + item.correct_count,
      0
    );

    this.totalIncorrectos = this.datos.reduce(
      (total, item) => total + item.incorrect_count,
      0
    );

    this.totalSinSolucionObligatoria = this.datos.reduce(
      (total, item) => total + item.missing_required_solution_count,
      0
    );

    this.porcentajeCorrectos = this.totalTickets > 0
      ? (this.totalCorrectos / this.totalTickets) * 100
      : 0;

    this.porcentajeIncorrectos = this.totalTickets > 0
      ? (this.totalIncorrectos / this.totalTickets) * 100
      : 0;
  }

  obtenerNombreResolutor(nombre: string | null): string {
    return nombre?.trim() || 'Sin asignar';
  }


  // FILTRO DINÁMICO: CUADRO ESTADÍSTICO POR COLABORADOR
  filtrarResolutores(event: Event): void {

    this.busquedaResolutor =
      (event.target as HTMLInputElement).value;
  }


  abrirComboResolutor(abierto: boolean): void {

    if (abierto) {
      this.busquedaResolutor = '';
    }
  }


  manejarTeclaBusquedaResolutor(event: KeyboardEvent): void {

    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }


  // Seleccionar colaborador desde el buscador.
  seleccionarResolutorDesdeCombo(
    nombre: string | null
  ): void {

    this.busquedaResolutor = '';

    this.resolutorChange.emit(nombre);
  }


  // Seleccionar colaborador desde la fila.
  seleccionarResolutorDesdeFila(
    fila: AuditResolver
  ): void {

    if (this.cargando || this.error) {
      return;
    }

    const nombre = this.obtenerNombreResolutor(
      fila.resolver_name
    );

    this.resolutorChange.emit(nombre);
  }


  get tieneDatos(): boolean {
    return this.dataSource.data.length > 0;
  }
}
