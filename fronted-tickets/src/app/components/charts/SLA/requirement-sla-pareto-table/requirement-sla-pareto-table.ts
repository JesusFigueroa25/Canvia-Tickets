import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { RequirementSLAParetoCategoriaItem, RequirementSLAParetoCategoriaOut, RequirementSLAParetoCategoriaTotal } from '../../../../models/requirement-sla';

@Component({
  selector: 'app-requirement-sla-pareto-table',
  standalone: false,
  templateUrl: './requirement-sla-pareto-table.html',
  styleUrl: './requirement-sla-pareto-table.css'
})
export class RequirementSlaParetoTable implements OnChanges {

  @Input() datos: RequirementSLAParetoCategoriaOut | null = null;
  @Input() cargando: boolean = false;
  @Input() error: string | null = null;

  // DATOS PARA LA VISTA
  filas: RequirementSLAParetoCategoriaItem[] = [];
  filasFiltradas: RequirementSLAParetoCategoriaItem[] = [];
  filasVisibles: RequirementSLAParetoCategoriaItem[] = [];
  totalCategorias = 0;
  categoriasConIncumplimientos = 0;

  // TOTALES GENERALES
  totalGeneral: RequirementSLAParetoCategoriaTotal = {
    total_tickets: 0,
    cumplidos: 0,
    incumplidos: 0,
    cancelados: 0,
    incumplidos_acumulados: 0,
    porcentaje_req: 0,
    porcentaje_acumulado: 0
  };

  // BUSQUEDA
  busqueda = '';

  // PAGINACION
  paginaActual = 0;
  tamanoPagina = 5;
  opcionesPaginacion = [5, 10, 20];

  // COLUMNAS
  readonly totalColumnas = 9;

  // DETECTAR CAMBIOS
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararTabla();
    }
  }

  // PREPARAR TABLA
  private prepararTabla(): void {

    // UTILIZAR ORDEN DEL BACKEND
    this.filas = [
      ...(this.datos?.filas ?? [])
    ];

    this.totalCategorias =
      this.datos?.total_categorias ?? 0;

    // CATEGORIAS CON AL MENOS UN INCUMPLIMIENTO
    this.categoriasConIncumplimientos =
      this.filas.filter(
        fila => fila.incumplidos > 0
      ).length;

    // TOTALES DEL BACKEND
    this.totalGeneral = this.datos
      ? { ...this.datos.total_general }
      : {
        total_tickets: 0,
        cumplidos: 0,
        incumplidos: 0,
        cancelados: 0,
        incumplidos_acumulados: 0,
        porcentaje_req: 0,
        porcentaje_acumulado: 0
      };

    // REINICIAR BUSQUEDA AL CAMBIAR EL CONJUNTO
    this.busqueda = '';

    this.paginaActual = 0;

    this.aplicarBusquedaLocal();
  }

  // NORMALIZAR TEXTO
  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  // BUSCAR POR CATEGORIA
  filtrarCategorias(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda = input.value;
    this.paginaActual = 0;
    this.aplicarBusquedaLocal();
  }

  // APLICAR BUSQUEDA LOCAL
  private aplicarBusquedaLocal(): void {
    const termino = this.normalizarTexto(
      this.busqueda
    );
    if (!termino) {
      this.filasFiltradas = [...this.filas];
    } else {

      this.filasFiltradas = this.filas.filter(
        fila => {
          return this.normalizarTexto(
            fila.categoria
          ).includes(termino);
        }
      );
    }
    this.actualizarFilasVisibles();
  }

  // PAGINACION
  cambiarPagina(event: PageEvent): void {
    this.paginaActual = event.pageIndex;
    this.tamanoPagina = event.pageSize;
    this.actualizarFilasVisibles();
  }

  private actualizarFilasVisibles(): void {
    const inicio = this.paginaActual * this.tamanoPagina;
    const fin = inicio + this.tamanoPagina;
    this.filasVisibles = this.filasFiltradas.slice(inicio, fin);
  }

  // SEMAFORO DEL BACKEND
  obtenerClaseSemaforo(semaforo: string): string {
    switch (semaforo.trim().toLowerCase()) {
      case 'rojo':
        return 'semaforo-rojo';
      case 'amarillo':
        return 'semaforo-amarillo';
      case 'verde':
        return 'semaforo-verde';
      default:
        return 'semaforo-neutro';
    }
  }

  // PORCENTAJE PARA LA BARRA VISUAL
  obtenerAnchoPorcentaje(porcentaje: number): number {
    // VALOR YA EXPRESADO EN ESCALA 0 - 100
    return Math.max(
      0,
      Math.min(100, porcentaje)
    );
  }

  // VERIFICAR REGISTROS
  get tieneDatos(): boolean {
    return (
      this.datos !== null &&
      this.totalGeneral.total_tickets > 0
    );
  }

  get tieneIncumplimientos(): boolean {
    return this.totalGeneral.incumplidos > 0;
  }

}
