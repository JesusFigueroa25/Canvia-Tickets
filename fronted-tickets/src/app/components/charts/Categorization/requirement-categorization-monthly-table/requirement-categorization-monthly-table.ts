
import { Component, Input, OnChanges, EventEmitter, SimpleChanges, ViewChild, Output } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { AuditMonthlyStat } from '../../../../models/requirement-categorization-audit';

@Component({
  selector: 'app-requirement-categorization-monthly-table',
  standalone: false,
  templateUrl: './requirement-categorization-monthly-table.html',
  styleUrl: './requirement-categorization-monthly-table.css'
})
export class RequirementCategorizationMonthlyTable implements OnChanges {

  @Input() datos: AuditMonthlyStat[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  // FILTRO DINÁMICO POR MES
  @Input() opcionesMeses: string[] = [];
  @Input() mesSeleccionado: string | null = null;
  @Output() mesChange = new EventEmitter<string | null>();

  busquedaMes = '';

  // Buscar sobre todas las opciones del backend.
  get mesesFiltrados(): string[] {

    const busqueda = this.busquedaMes.trim().toLocaleLowerCase('es-PE');

    if (!busqueda) {
      return this.opcionesMeses;
    }

    return this.opcionesMeses.filter(mes => {

      const nombre = this.obtenerNombreMes(mes)
        .toLocaleLowerCase('es-PE');

      return nombre.includes(busqueda) ||
        mes.toLocaleLowerCase('es-PE').includes(busqueda);
    });
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
    'month',
    'total_tickets',
    'correct_count',
    'incorrect_count',
    'correct_percentage',
    'incorrect_percentage'
  ];

  dataSource = new MatTableDataSource<AuditMonthlyStat>([]);

  totalMeses = 0;
  totalTickets = 0;
  totalCorrectos = 0;
  totalIncorrectos = 0;
  porcentajeCorrectos = 0;
  porcentajeIncorrectos = 0;

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos']) {

      this.dataSource.data = [...(this.datos ?? [])]
        .sort((a, b) => a.month.localeCompare(b.month));

      this.calcularTotales();

      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }
  }

  private calcularTotales(): void {

    const registros = this.datos ?? [];

    this.totalMeses = registros.length;

    this.totalTickets = registros.reduce(
      (total, item) => total + item.total_tickets, 0
    );

    this.totalCorrectos = registros.reduce(
      (total, item) => total + item.correct_count, 0
    );

    this.totalIncorrectos = registros.reduce(
      (total, item) => total + item.incorrect_count, 0
    );

    this.porcentajeCorrectos = this.totalTickets > 0
      ? this.totalCorrectos * 100 / this.totalTickets
      : 0;

    this.porcentajeIncorrectos = this.totalTickets > 0
      ? this.totalIncorrectos * 100 / this.totalTickets
      : 0;
  }

  obtenerNombreMes(codigo: string): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril',
      'Mayo', 'Junio', 'Julio', 'Agosto',
      'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const indice = Number(codigo.slice(5, 7)) - 1;

    if (indice < 0 || indice >= 12) {
      return codigo;
    }

    return `${meses[indice]} ${codigo.slice(0, 4)}`;
  }



  filtrarMeses(event: Event): void {
    this.busquedaMes = (event.target as HTMLInputElement).value;
  }


  abrirComboMes(abierto: boolean): void {

    if (abierto) {
      this.busquedaMes = '';
    }
  }


  manejarTeclaBusquedaMes(event: KeyboardEvent): void {

    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }


  seleccionarMesDesdeCombo(mes: string | null): void {

    this.busquedaMes = '';
    this.mesChange.emit(mes);
  }


  seleccionarMesDesdeFila(fila: AuditMonthlyStat): void {

    if (this.cargando || this.error) {
      return;
    }

    this.mesChange.emit(fila.month);
  }



  get tieneDatos(): boolean {
    return this.dataSource.data.length > 0;
  }
}
