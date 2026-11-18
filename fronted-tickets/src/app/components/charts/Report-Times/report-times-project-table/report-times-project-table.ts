
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import {
  TicketsReportTimesProjectItem,
  TicketsReportTimesProjectTabla
} from '../../../../models/tickets-report-times';

type ColumnaOrden =
  | 'periodo'
  | 'proyecto'
  | 'tickets'
  | 'acciones'
  | 'resolutores_distintos'
  | 'horas_totales';

@Component({
  selector: 'app-report-times-project-table',
  standalone: false,
  templateUrl: './report-times-project-table.html',
  styleUrl: './report-times-project-table.css'
})
export class ReportTimesProjectTable implements OnChanges {

  @Input() datos: TicketsReportTimesProjectTabla | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange =
    new EventEmitter<{ pagina: number; tamano: number }>();

  busqueda = '';

  ordenColumna: ColumnaOrden = 'horas_totales';
  ordenDescendente = true;

  readonly tamanosPagina = [10, 25, 50, 100];

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['datos'] &&
      !changes['datos'].firstChange
    ) {
      this.busqueda = '';
    }
  }

  // ============================================
  // FILAS VISIBLES
  // ============================================

  get filasVisibles(): TicketsReportTimesProjectItem[] {
    const registros = this.datos?.items ?? [];

    const termino = this.busqueda
      .trim()
      .toLocaleLowerCase('es-PE');

    const filtrados = registros.filter(item => {
      if (!termino) {
        return true;
      }

      const proyecto = item.proyecto
        .toLocaleLowerCase('es-PE');

      const proyectoVisible = this.nombreVisibleProyecto(
        item.proyecto
      ).toLocaleLowerCase('es-PE');

      const periodo = item.periodo.toLowerCase();

      const periodoVisible = this.formatearPeriodo(
        item.periodo
      ).toLocaleLowerCase('es-PE');

      return (
        proyecto.includes(termino) ||
        proyectoVisible.includes(termino) ||
        periodo.includes(termino) ||
        periodoVisible.includes(termino)
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
        comparacion = a.proyecto.localeCompare(
          b.proyecto,
          'es',
          { sensitivity: 'base' }
        );
      }

      if (comparacion === 0) {
        comparacion = a.periodo.localeCompare(b.periodo);
      }

      return this.ordenDescendente
        ? -comparacion
        : comparacion;
    });
  }

  // ============================================
  // BÚSQUEDA
  // ============================================

  buscar(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.busqueda = input.value;
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
  }

  // ============================================
  // ORDENAMIENTO
  // ============================================

  ordenar(columna: ColumnaOrden): void {
    if (this.ordenColumna === columna) {
      this.ordenDescendente = !this.ordenDescendente;
      return;
    }

    this.ordenColumna = columna;

    this.ordenDescendente =
      columna !== 'proyecto';
  }

  indicadorOrden(columna: ColumnaOrden): string {
    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  // ============================================
  // PAGINACIÓN DESDE BACKEND
  // ============================================

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
      (this.datos.pagina - 1) *
      this.datos.tamano
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

  // ============================================
  // FORMATEO
  // ============================================

  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    const meses = [
      'ENE', 'FEB', 'MAR', 'ABR',
      'MAY', 'JUN', 'JUL', 'AGO',
      'SEP', 'OCT', 'NOV', 'DIC'
    ];

    return `${meses[mes - 1]} ${anio}`;
  }

  nombreVisibleProyecto(proyecto: string): string {
    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
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
    fila: TicketsReportTimesProjectItem
  ): string {
    return `${fila.periodo}|${fila.proyecto}`;
  }
}
