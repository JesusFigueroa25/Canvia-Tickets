
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  TicketsReportTimesResolverItem,
  TicketsReportTimesResolverTabla
} from '../../../../models/tickets-report-times';

type ColumnaOrden =
  | 'periodo'
  | 'resolutor'
  | 'tickets'
  | 'acciones'
  | 'horas_totales';

@Component({
  selector: 'app-report-times-resolver-table',
  standalone: false,
  templateUrl: './report-times-resolver-table.html',
  styleUrl: './report-times-resolver-table.css'
})
export class ReportTimesResolverTable {

  @Input() datos: TicketsReportTimesResolverTabla | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange =
    new EventEmitter<{ pagina: number; tamano: number }>();

  busqueda = '';

  ordenColumna: ColumnaOrden = 'horas_totales';
  ordenDescendente = true;

  readonly tamanosPagina = [10, 25, 50, 100];

  get filasVisibles(): TicketsReportTimesResolverItem[] {
    const registros = this.datos?.items ?? [];

    const termino = this.busqueda
      .trim()
      .toLocaleLowerCase('es-PE');

    const filtrados = registros.filter(item => {
      if (!termino) {
        return true;
      }

      return (
        item.resolutor.toLocaleLowerCase('es-PE')
          .includes(termino) ||
        item.periodo.includes(termino) ||
        this.formatearPeriodo(item.periodo)
          .toLocaleLowerCase('es-PE')
          .includes(termino)
      );
    });

    return [...filtrados].sort((a, b) => {
      const valorA = a[this.ordenColumna];
      const valorB = b[this.ordenColumna];

      let resultado = 0;

      if (
        typeof valorA === 'number' &&
        typeof valorB === 'number'
      ) {
        resultado = valorA - valorB;
      } else {
        resultado = String(valorA).localeCompare(
          String(valorB),
          'es',
          { sensitivity: 'base' }
        );
      }

      if (resultado === 0) {
        resultado = a.resolutor.localeCompare(
          b.resolutor,
          'es',
          { sensitivity: 'base' }
        );
      }

      return this.ordenDescendente
        ? -resultado
        : resultado;
    });
  }

  buscar(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.busqueda = input.value;
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
  }

  ordenar(columna: ColumnaOrden): void {
    if (this.ordenColumna === columna) {
      this.ordenDescendente = !this.ordenDescendente;
      return;
    }

    this.ordenColumna = columna;

    this.ordenDescendente = !(
      columna === 'resolutor'
    );
  }

  indicadorOrden(columna: ColumnaOrden): string {
    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  get paginaActual(): number {
    return this.datos?.pagina ?? 1;
  }

  get tamanoActual(): number {
    return this.datos?.tamano ?? 25;
  }

  get totalPaginas(): number {
    return this.datos?.total_paginas ?? 0;
  }

  get totalRegistros(): number {
    return this.datos?.total ?? 0;
  }

  get primerRegistro(): number {
    if (!this.datos || this.datos.total === 0) {
      return 0;
    }

    return (this.datos.pagina - 1) * this.datos.tamano + 1;
  }

  get ultimoRegistro(): number {
    if (!this.datos) {
      return 0;
    }

    return Math.min(
      this.datos.pagina * this.datos.tamano,
      this.datos.total
    );
  }

  cambiarPagina(pagina: number): void {
    if (
      this.cargando ||
      pagina < 1 ||
      pagina > this.totalPaginas ||
      pagina === this.paginaActual
    ) {
      return;
    }

    this.busqueda = '';

    this.paginaChange.emit({
      pagina,
      tamano: this.tamanoActual
    });
  }

  cambiarTamanoPagina(evento: Event): void {
    const select = evento.target as HTMLSelectElement;
    const tamano = Number(select.value);

    if (
      this.cargando ||
      !Number.isInteger(tamano) ||
      !this.tamanosPagina.includes(tamano) ||
      tamano === this.tamanoActual
    ) {
      return;
    }

    this.busqueda = '';

    this.paginaChange.emit({
      pagina: 1,
      tamano
    });
  }

  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    const nombre = new Intl.DateTimeFormat('es-PE', {
      month: 'short',
      year: 'numeric'
    }).format(new Date(anio, mes - 1, 1));

    return nombre.toUpperCase();
  }

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  formatearHoras(valor: number): string {
    return valor.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  identificarFila(
    _indice: number,
    fila: TicketsReportTimesResolverItem
  ): string {
    return `${fila.periodo}|${fila.resolutor}`;
  }
}
