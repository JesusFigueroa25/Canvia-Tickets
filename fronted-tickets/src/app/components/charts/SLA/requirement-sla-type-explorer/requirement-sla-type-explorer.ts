import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RequirementSLAExploradorFila, RequirementSLAExploradorMetricas, RequirementSLAExploradorPeriodo, RequirementSLAExploradorTiposOut } from '../../../../models/requirement-sla';
import { PageEvent } from '@angular/material/paginator';

interface ExploradorTipoFilaVista {
  tipo_requerimiento: string;
  mensual: RequirementSLAExploradorMetricas[];
  total: RequirementSLAExploradorMetricas;
}

@Component({
  selector: 'app-requirement-sla-type-explorer',
  standalone: false,
  templateUrl: './requirement-sla-type-explorer.html',
  styleUrl: './requirement-sla-type-explorer.css'
})
export class RequirementSlaTypeExplorer implements OnChanges {

  @Input() datos: RequirementSLAExploradorTiposOut | null = null;
  @Input() cargando: boolean = false;

  periodos: RequirementSLAExploradorPeriodo[] = [];
  filas: ExploradorTipoFilaVista[] = [];
  filasFiltradas: ExploradorTipoFilaVista[] = [];
  filasVisibles: ExploradorTipoFilaVista[] = [];

  totalGeneralMensual: RequirementSLAExploradorMetricas[] = [];
  totalGeneral: RequirementSLAExploradorMetricas = { tot: 0, c: 0, i: 0, porcentaje_inc: 0 };
  busqueda: string = '';

  // PAGINACION
  paginaActual: number = 0;
  tamanoPagina: number = 5;
  opcionesPaginacion: number[] = [5, 10];


  // METRICAS SIN DATOS
  private readonly metricasVacias: RequirementSLAExploradorMetricas = {
    tot: 0,
    c: 0,
    i: 0,
    porcentaje_inc: 0
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.prepararTabla();
    }
  }


  private prepararTabla(): void {

    this.periodos = [
      ...(this.datos?.periodos ?? [])
    ];

    this.filas = [];
    this.totalGeneralMensual = [];

    this.totalGeneral = {
      ...this.metricasVacias
    };

    this.busqueda = '';
    this.paginaActual = 0;

    if (!this.datos) {
      this.aplicarBusquedaLocal();
      return;
    }

    this.filas = this.datos.filas.map(
      (fila: RequirementSLAExploradorFila) => {

        const mapaMensual = new Map<string, RequirementSLAExploradorMetricas>();

        // INDEXAR LOS MESES DEL TIPO
        for (const mes of fila.mensual) {
          const clave = this.clavePeriodo(mes.anio, mes.mes);
          mapaMensual.set(clave, mes);
        }

        // ALINEAR LOS MESES CON LOS PERIODOS GLOBALES
        const mensual = this.periodos.map(
          periodo => {
            const clave = this.clavePeriodo(periodo.anio, periodo.mes);
            return (
              mapaMensual.get(clave)
              ?? this.metricasVacias
            );
          }
        );

        return {
          tipo_requerimiento: fila.tipo_requerimiento,
          mensual,
          total: fila.total
        };

      }
    );


    // PREPARAR TOTALES MENSUALES
    const mapaTotales = new Map<string, RequirementSLAExploradorMetricas>();

    for (const mes of this.datos.total_general.mensual) {
      const clave = this.clavePeriodo(
        mes.anio,
        mes.mes
      );
      mapaTotales.set(clave, mes);
    }

    this.totalGeneralMensual = this.periodos.map(
      periodo => {

        const clave = this.clavePeriodo(
          periodo.anio,
          periodo.mes
        );

        return (
          mapaTotales.get(clave)
          ?? this.metricasVacias
        );
      }
    );

    this.totalGeneral = {
      ...this.datos.total_general.total
    };

    this.aplicarBusquedaLocal();

  }


  private clavePeriodo(anio: number, mes: number): string {
    return `${anio}-${String(mes).padStart(2, '0')}`;
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }


  filtrarTipos(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda = input.value;
    this.paginaActual = 0;
    this.aplicarBusquedaLocal();
  }


  private aplicarBusquedaLocal(): void {

    const termino = this.normalizarTexto(
      this.busqueda
    );

    if (!termino) {
      this.filasFiltradas = [
        ...this.filas
      ];

    } else {

      this.filasFiltradas = this.filas.filter(
        fila => {
          const tipo = this.normalizarTexto(
            fila.tipo_requerimiento
          );
          return tipo.includes(termino);
        }
      );
    }

    this.actualizarFilasVisibles();
  }


  cambiarPagina(event: PageEvent): void {
    this.paginaActual = event.pageIndex;
    this.tamanoPagina = event.pageSize;
    this.actualizarFilasVisibles();
  }

  private actualizarFilasVisibles(): void {
    const inicio = (
      this.paginaActual * this.tamanoPagina
    );
    const fin = inicio + this.tamanoPagina;
    this.filasVisibles = this.filasFiltradas.slice(
      inicio,
      fin
    );
  }

  obtenerClaseIncumplimiento(metricas: RequirementSLAExploradorMetricas): string {

    // SIN TICKETS EN EL PERIODO
    if (metricas.tot === 0) {
      return 'inc-sin-datos';
    }

    const porcentaje = metricas.porcentaje_inc;

    // INCUMPLIMIENTO BAJO
    if (porcentaje <= 5) {
      return 'inc-bajo';
    }

    // INCUMPLIMIENTO MEDIO
    if (porcentaje <= 38) {
      return 'inc-medio';
    }

    // INCUMPLIMIENTO CRITICO
    return 'inc-critico';

  }

  get totalColumnas(): number {
    return 1 + (this.periodos.length * 4) + 4;
  }

}