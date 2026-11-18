
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import {
  RequirementAtencionParalelaTabla,
  RequirementAtencionParalelaDetalleItem
} from '../../../../../models/requirement-consolidated';

type ColumnaOrden =
  | 'ticket_id'
  | 'proyecto'
  | 'resolutor'
  | 'fecha_apertura'
  | 'fecha_resolucion'
  | 'tickets_simultaneos';

@Component({
  selector: 'app-requirement-parallel-details-table',
  standalone: false,
  templateUrl: './requirement-parallel-details-table.html',
  styleUrl: './requirement-parallel-details-table.css'
})
export class RequirementParallelDetailsTable
  implements OnChanges {

  // ======================================================
  // INPUTS
  // ======================================================

  @Input()
  datos: RequirementAtencionParalelaTabla | null = null;

  @Input()
  resolutorSeleccionado: string | null = null;

  @Input()
  cargando = false;

  @Input()
  error: string | null = null;

  // ======================================================
  // OUTPUTS
  // ======================================================

  @Output()
  paginaChange = new EventEmitter<{
    pagina: number;
    tamano: number;
  }>();

  @Output()
  resolutorChange = new EventEmitter<string | null>();

  // ======================================================
  // ESTADO LOCAL
  // ======================================================

  busquedaLocal = '';

  textoResolutor = '';

  filaExpandida: string | null = null;

  ordenColumna: ColumnaOrden = 'tickets_simultaneos';

  ordenDescendente = true;

  readonly tamanosPagina = [10, 25, 50, 100];

  // ======================================================
  // CICLO DE VIDA
  // ======================================================

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['resolutorSeleccionado']) {
      this.textoResolutor = this.resolutorSeleccionado ?? '';
    }

    if (changes['datos']) {
      this.filaExpandida = null;
    }
  }

  // ======================================================
  // FILAS VISIBLES
  // ======================================================

  get filasVisibles(): RequirementAtencionParalelaDetalleItem[] {

    const registros = this.datos?.items ?? [];

    const termino = this.busquedaLocal
      .trim()
      .toLocaleLowerCase('es-PE');

    const filtrados = registros.filter(item => {

      if (!termino) {
        return true;
      }

      const campos = [
        item.ticket_id,
        item.proyecto,
        item.resolutor,
        item.fecha_apertura,
        item.fecha_resolucion,
        item.inicio_coincidencia,
        item.fin_coincidencia,
        ...(item.tickets_coincidentes ?? [])
      ];

      return campos.some(
        campo => String(campo ?? '')
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
        comparacion = String(valorA ?? '').localeCompare(
          String(valorB ?? ''),
          'es',
          { sensitivity: 'base' }
        );
      }

      if (comparacion === 0) {
        return a.ticket_id.localeCompare(
          b.ticket_id,
          'es'
        );
      }

      return this.ordenDescendente
        ? -comparacion
        : comparacion;
    });
  }

  // ======================================================
  // RESOLUTORES SUGERIDOS
  // ======================================================

  get resolutoresSugeridos(): string[] {

    const nombres = [
      ...(this.datos?.items ?? []).map(
        item => item.resolutor
      ),
      this.resolutorSeleccionado ?? ''
    ];

    return [...new Set(
      nombres
        .map(nombre => nombre?.trim() ?? '')
        .filter(nombre => nombre.length > 0)
    )].sort((a, b) => a.localeCompare(b, 'es'));
  }

  // ======================================================
  // BÚSQUEDA LOCAL
  // ======================================================

  buscarLocal(evento: Event): void {

    const input = evento.target as HTMLInputElement;

    this.busquedaLocal = input.value;
    this.filaExpandida = null;
  }

  limpiarBusquedaLocal(): void {

    this.busquedaLocal = '';
    this.filaExpandida = null;
  }

  // ======================================================
  // FILTRO POR RESOLUTOR - BACKEND
  // ======================================================

  capturarResolutor(evento: Event): void {

    const input = evento.target as HTMLInputElement;

    this.textoResolutor = input.value;
  }

  aplicarFiltroResolutor(): void {

    if (this.cargando) {
      return;
    }

    const nuevo = this.textoResolutor.trim() || null;

    if (nuevo === this.resolutorSeleccionado) {
      return;
    }

    this.busquedaLocal = '';
    this.filaExpandida = null;

    this.resolutorChange.emit(nuevo);
  }

  limpiarFiltroResolutor(): void {

    if (this.cargando) {
      return;
    }

    this.textoResolutor = '';
    this.busquedaLocal = '';
    this.filaExpandida = null;

    if (this.resolutorSeleccionado !== null) {
      this.resolutorChange.emit(null);
    }
  }

  // ======================================================
  // ORDENAMIENTO
  // ======================================================

  ordenar(columna: ColumnaOrden): void {

    if (this.ordenColumna === columna) {

      this.ordenDescendente = !this.ordenDescendente;

    } else {

      this.ordenColumna = columna;

      this.ordenDescendente = columna !== 'proyecto' &&
        columna !== 'resolutor' &&
        columna !== 'ticket_id';
    }
  }

  indicadorOrden(columna: ColumnaOrden): string {

    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  // ======================================================
  // DETALLE DESPLEGABLE
  // ======================================================

  claveFila(
    fila: RequirementAtencionParalelaDetalleItem
  ): string {

    return [
      fila.ticket_id,
      fila.resolutor,
      fila.inicio_coincidencia,
      fila.fin_coincidencia
    ].join('|');
  }

  estaExpandida(
    fila: RequirementAtencionParalelaDetalleItem
  ): boolean {

    return this.filaExpandida === this.claveFila(fila);
  }

  alternarDetalle(
    fila: RequirementAtencionParalelaDetalleItem
  ): void {

    const clave = this.claveFila(fila);

    this.filaExpandida =
      this.filaExpandida === clave ? null : clave;
  }

  // ======================================================
  // PAGINACIÓN DESDE BACKEND
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

    this.busquedaLocal = '';
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

    this.busquedaLocal = '';
    this.filaExpandida = null;

    this.paginaChange.emit({
      pagina: 1,
      tamano
    });
  }

  // ======================================================
  // FORMATEO DE FECHAS
  // ======================================================

  formatearFecha(
    fecha: string | null | undefined
  ): string {

    const valor = String(fecha ?? '').trim();

    if (!valor) {
      return '—';
    }

    // Mantener la hora almacenada por SQL Server.
    // No convertir zonas horarias implícitamente.
    const coincidencia = valor.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
    );

    if (!coincidencia) {
      return valor;
    }

    const [, anio, mes, dia, hora, minuto] = coincidencia;

    return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
  }

  // ======================================================
  // FORMATEO GENERAL
  // ======================================================

  nombreVisibleProyecto(proyecto: string): string {

    return proyecto
      .replace(/^\d{6}\s+/, '')
      .trim();
  }

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  // Arrow function para conservar el contexto en *ngFor.
  readonly identificarFila = (
    _indice: number,
    fila: RequirementAtencionParalelaDetalleItem
  ): string => {

    return [
      fila.ticket_id,
      fila.resolutor,
      fila.inicio_coincidencia,
      fila.fin_coincidencia
    ].join('|');
  };
}
