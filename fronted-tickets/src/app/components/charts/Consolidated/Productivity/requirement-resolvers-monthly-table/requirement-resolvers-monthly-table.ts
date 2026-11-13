
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import {
  RequirementDotacionTabla,
  RequirementDotacionFila
} from '../../../../../models/requirement-consolidated';

type ColumnaOrden =
  | 'periodo'
  | 'proyecto'
  | 'total_tickets'
  | 'resolutores_distintos'
  | 'tickets_sin_resolutor';

@Component({
  selector: 'app-requirement-resolvers-monthly-table',
  standalone: false,
  templateUrl: './requirement-resolvers-monthly-table.html',
  styleUrl: './requirement-resolvers-monthly-table.css'
})
export class RequirementResolversMonthlyTable
  implements OnChanges {

  // ======================================================
  // INPUTS Y OUTPUTS
  // ======================================================

  @Input() datos: RequirementDotacionTabla | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange =
    new EventEmitter<{ pagina: number; tamano: number }>();

  // ======================================================
  // ESTADO LOCAL
  // ======================================================

  busqueda = '';

  filaExpandida: string | null = null;

  ordenColumna: ColumnaOrden = 'periodo';

  ordenDescendente = true;

  readonly tamanosPagina = [10, 25, 50, 100];

  private readonly meses = [
    'ENE', 'FEB', 'MAR', 'ABR',
    'MAY', 'JUN', 'JUL', 'AGO',
    'SEP', 'OCT', 'NOV', 'DIC'
  ];

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos']) {
      this.filaExpandida = null;
    }
  }

  // ======================================================
  // FILAS VISIBLES
  // ======================================================

  get filasVisibles(): RequirementDotacionFila[] {

    const registros = this.datos?.items ?? [];

    const termino = this.busqueda
      .trim()
      .toLocaleLowerCase('es-PE');

    const filtrados = registros.filter(fila => {

      if (!termino) {
        return true;
      }

      const proyecto = fila.proyecto
        .toLocaleLowerCase('es-PE');

      const proyectoVisible = this.nombreVisibleProyecto(
        fila.proyecto
      ).toLocaleLowerCase('es-PE');

      const periodo = fila.periodo.toLowerCase();

      const nombresResolutores = fila.resolutores.some(
        resolutor =>
          resolutor.nombre
            .toLocaleLowerCase('es-PE')
            .includes(termino)
      );

      return (
        proyecto.includes(termino) ||
        proyectoVisible.includes(termino) ||
        periodo.includes(termino) ||
        nombresResolutores
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

        // Desempate estable.
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

  // ======================================================
  // BÚSQUEDA
  // ======================================================

  buscar(evento: Event): void {

    const input = evento.target as HTMLInputElement;

    this.busqueda = input.value;

    this.filaExpandida = null;
  }

  limpiarBusqueda(): void {

    this.busqueda = '';

    this.filaExpandida = null;
  }

  // ======================================================
  // ORDENAMIENTO
  // ======================================================

  ordenar(columna: ColumnaOrden): void {

    if (this.ordenColumna === columna) {

      this.ordenDescendente = !this.ordenDescendente;

    } else {

      this.ordenColumna = columna;

      this.ordenDescendente = columna !== 'proyecto';
    }
  }

  indicadorOrden(columna: ColumnaOrden): string {

    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  // ======================================================
  // EXPANDIR DETALLE
  // ======================================================

  claveFila(fila: RequirementDotacionFila): string {

    return `${fila.periodo}|${fila.proyecto}`;
  }

  estaExpandida(fila: RequirementDotacionFila): boolean {

    return this.filaExpandida === this.claveFila(fila);
  }

  alternarDetalle(fila: RequirementDotacionFila): void {

    const clave = this.claveFila(fila);

    this.filaExpandida =
      this.filaExpandida === clave ? null : clave;
  }

  // ======================================================
  // PAGINACIÓN
  // ======================================================

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
    this.filaExpandida = null;

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
      !this.tamanosPagina.includes(tamano) ||
      tamano === this.tamanoActual
    ) {
      return;
    }

    this.busqueda = '';
    this.filaExpandida = null;

    this.paginaChange.emit({
      pagina: 1,
      tamano
    });
  }

  // ======================================================
  // FORMATEO
  // ======================================================

  formatearPeriodo(periodo: string): string {

    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    return `${this.meses[mes - 1]} ${anio}`;
  }

  nombreVisibleProyecto(proyecto: string): string {

    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  formatearNumero(valor: number): string {

    return valor.toLocaleString('es-PE');
  }


identificarFila(
  _indice: number,
  fila: RequirementDotacionFila
): string {

  return `${fila.periodo}|${fila.proyecto}`;
}


}
