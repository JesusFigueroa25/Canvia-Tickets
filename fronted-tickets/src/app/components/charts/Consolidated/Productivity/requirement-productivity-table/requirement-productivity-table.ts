
import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import {
  RequirementProductividadTabla,
  RequirementProductividadProyectoItem
} from '../../../../../models/requirement-consolidated';


type ColumnaOrden =
  | 'proyecto'
  | 'total_tickets'
  | 'promedio_diario'
  | 'promedio_semanal'
  | 'promedio_mensual'
  | 'resolutores_distintos';


@Component({
  selector: 'app-requirement-productivity-table',
  standalone: false,
  templateUrl: './requirement-productivity-table.html',
  styleUrl: './requirement-productivity-table.css'
})
export class RequirementProductivityTable {

  // ============================================================
  // INPUTS Y OUTPUTS
  // ============================================================

  @Input() datos: RequirementProductividadTabla | null = null;

  @Input() cargando = false;

  @Input() error: string | null = null;

  @Output() paginaChange =
    new EventEmitter<{ pagina: number; tamano: number }>();


  // ============================================================
  // BÚSQUEDA Y ORDENAMIENTO
  // ============================================================

  busqueda = '';

  ordenColumna: ColumnaOrden = 'total_tickets';

  ordenDescendente = true;

  readonly tamanosPagina = [10, 25, 50, 100];


  // ============================================================
  // FILAS VISIBLES
  // ============================================================

  get filasVisibles(): RequirementProductividadProyectoItem[] {

    const registros = this.datos?.items ?? [];

    const termino = this.busqueda
      .trim()
      .toLocaleLowerCase('es-PE');

    const filtrados = registros.filter(item => {

      if (!termino) {
        return true;
      }

      return (
        item.proyecto.toLocaleLowerCase('es-PE').includes(termino) ||
        this.nombreVisibleProyecto(item.proyecto)
          .toLocaleLowerCase('es-PE')
          .includes(termino)
      );
    });

    return [...filtrados].sort((a, b) => {

      const valorA = a[this.ordenColumna];
      const valorB = b[this.ordenColumna];

      let comparacion = 0;

      if (
        typeof valorA === 'number' &&
        typeof valorB === 'number'
      ) {
        comparacion = valorA - valorB;
      } else {
        comparacion = String(valorA).localeCompare(
          String(valorB),
          'es',
          { sensitivity: 'base' }
        );
      }

      if (comparacion === 0) {
        return a.proyecto.localeCompare(
          b.proyecto,
          'es',
          { sensitivity: 'base' }
        );
      }

      return this.ordenDescendente
        ? -comparacion
        : comparacion;
    });
  }


  // ============================================================
  // BÚSQUEDA
  // ============================================================

  buscar(evento: Event): void {

    const input = evento.target as HTMLInputElement;

    this.busqueda = input.value;
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
  }


  // ============================================================
  // ORDENAMIENTO
  // ============================================================

  ordenar(columna: ColumnaOrden): void {

    if (this.ordenColumna === columna) {

      this.ordenDescendente = !this.ordenDescendente;

      return;
    }

    this.ordenColumna = columna;

    this.ordenDescendente = columna !== 'proyecto';
  }


  indicadorOrden(columna: ColumnaOrden): string {

    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }


  // ============================================================
  // PAGINACIÓN DESDE BACKEND
  // ============================================================

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

    return (
      (this.datos.pagina - 1) * this.datos.tamano
    ) + 1;
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


  // ============================================================
  // FORMATEO
  // ============================================================

  nombreVisibleProyecto(proyecto: string): string {

    // Ocultar código ALP inicial solo visualmente.
    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  formatearEntero(valor: number): string {

    return valor.toLocaleString('es-PE');
  }

  formatearPromedio(valor: number): string {

    return valor.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }


  // ============================================================
  // TRACK BY
  // ============================================================

  identificarProyecto(
    _indice: number,
    item: RequirementProductividadProyectoItem
  ): string {

    return item.proyecto;
  }

}
