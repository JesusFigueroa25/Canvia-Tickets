import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  ChangeConsolidatedHorasCambioItem,
  ChangeConsolidatedHorasCambioOut
} from '../../../../models/change-consolidated';

type Columna = 'Ticket_ID' | 'Fecha_Creacion' | 'Proyecto' | 'Descripcion'
  | 'Horas_Totales' | 'Registros_Tiempo_BD' | 'Total_Resolutores_BD'
  | 'Total_Tareas_BD' | 'Total_Tareas_Wintel' | 'Tipo_Actividad';

@Component({
  selector: 'app-change-hours-detail-table',
  standalone: false,
  templateUrl: './change-hours-detail-table.html',
  styleUrl: './change-hours-detail-table.css'
})
export class ChangeHoursDetailTable implements OnChanges {
  @Input() datos: ChangeConsolidatedHorasCambioOut | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number }>();

  readonly tamanosPagina = [10, 25, 50, 100];
  busqueda = '';
  columnaOrden: Columna = 'Fecha_Creacion';
  ordenDescendente = false;
  ticketExpandido: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.ticketExpandido = null;
      if (!changes['datos'].firstChange) this.busqueda = '';
    }
  }

  private normalizar(valor: unknown): string {
    return String(valor ?? '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE').trim();
  }

  get filasVisibles(): ChangeConsolidatedHorasCambioItem[] {
    const termino = this.normalizar(this.busqueda);
    const filas = (this.datos?.cambios ?? []).filter(fila => {
      if (!termino) return true;
      return [fila.Ticket_ID, fila.Proyecto, fila.Descripcion, fila.Grupo_Resolutor,
      fila.Tipo_Actividad, fila.Clasificacion_Evidencia, fila.Nombre_Resolutor]
        .some(campo => this.normalizar(campo).includes(termino));
    });
    return [...filas].sort((a, b) => {
      const columna = this.columnaOrden;
      const valorA = a[columna];
      const valorB = b[columna];
      let diferencia = typeof valorA === 'number' && typeof valorB === 'number'
        ? valorA - valorB
        : String(valorA ?? '').localeCompare(String(valorB ?? ''), 'es',
          { sensitivity: 'base', numeric: true });
      if (diferencia === 0) diferencia = a.Ticket_ID.localeCompare(b.Ticket_ID, 'es');
      return this.ordenDescendente ? -diferencia : diferencia;
    });
  }

  buscar(evento: Event): void { this.busqueda = (evento.target as HTMLInputElement).value; }
  limpiarBusqueda(): void { this.busqueda = ''; }

  ordenar(columna: Columna): void {
    if (columna === this.columnaOrden) this.ordenDescendente = !this.ordenDescendente;
    else {
      this.columnaOrden = columna;
      this.ordenDescendente = ['Horas_Totales', 'Registros_Tiempo_BD',
        'Total_Resolutores_BD', 'Total_Tareas_BD', 'Total_Tareas_Wintel'].includes(columna);
    }
  }
  indicadorOrden(columna: Columna): string {
    return this.columnaOrden === columna ? (this.ordenDescendente ? '↓' : '↑') : '↕';
  }
  alternarDetalle(ticketId: string): void {
    this.ticketExpandido = this.ticketExpandido === ticketId ? null : ticketId;
  }
  fecha(valor: string | null | undefined): string {
    if (!valor) return '—';
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : valor;
  }
  numero(numero: number): string { return numero.toLocaleString('es-PE'); }
  horas(numero: number): string {
    return numero.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  get horasPagina(): number { return this.filasVisibles.reduce((suma, fila) => suma + fila.Horas_Totales, 0); }
  get paginaActual(): number { return this.datos?.pagina ?? 1; }
  get tamanoActual(): number { return this.datos?.tamano ?? 10; }
  get totalPaginas(): number { return this.datos?.total_paginas ?? 0; }
  get totalRegistros(): number { return this.datos?.total ?? 0; }
  get primerRegistro(): number {
    return this.totalRegistros ? (this.paginaActual - 1) * this.tamanoActual + 1 : 0;
  }
  get ultimoRegistro(): number {
    return Math.min(this.paginaActual * this.tamanoActual, this.totalRegistros);
  }
  cambiarPagina(pagina: number): void {
    if (this.cargando || !Number.isInteger(pagina) || pagina < 1 ||
      pagina > this.totalPaginas || pagina === this.paginaActual) return;
    this.paginaChange.emit({ pagina, tamano: this.tamanoActual });
  }
  cambiarTamanoPagina(evento: Event): void {
    const tamano = Number((evento.target as HTMLSelectElement).value);
    if (this.cargando || !this.tamanosPagina.includes(tamano) || tamano === this.tamanoActual) return;
    this.paginaChange.emit({ pagina: 1, tamano });
  }
  identificarFila(_indice: number, fila: ChangeConsolidatedHorasCambioItem): string { return fila.Ticket_ID; }
}
