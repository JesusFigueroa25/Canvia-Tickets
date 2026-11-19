
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';

import {
  TicketsReportTimesProjectTabla
} from '../../../../models/tickets-report-times';
import { formatearTiempo } from '../../../../utils/formatear-tiempo';

type Metrica = 'horas_totales' | 'acciones' | 'tickets';

interface IndicadoresMes {
  horas_totales: number;
  segundos_totales: number;
  acciones: number;
  tickets: number;
}

interface FilaMatrizProyecto {
  nombre: string;
  mensual: Record<string, IndicadoresMes>;
  total: IndicadoresMes;
}

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

  readonly tamanosPagina = [10, 25, 50, 100];

  busqueda = '';
  metrica: Metrica = 'horas_totales';

  periodos: string[] = [];
  filas: FilaMatrizProyecto[] = [];

  columnaOrden = 'total';
  ordenDescendente = true;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.construirMatriz();

      if (!changes['datos'].firstChange) {
        this.busqueda = '';
      }
    }
  }

  private crearIndicadores(): IndicadoresMes {
    return {
      horas_totales: 0,
      segundos_totales: 0,
      acciones: 0,
      tickets: 0
    };
  }

  private construirMatriz(): void {
    const registros = this.datos?.items ?? [];
    const mapa = new Map<string, FilaMatrizProyecto>();
    const meses = new Set<string>();

    for (const item of registros) {
      const nombre = item.proyecto?.trim() || 'Sin especificar';
      const periodo = item.periodo;

      meses.add(periodo);

      let fila = mapa.get(nombre);

      if (!fila) {
        fila = {
          nombre,
          mensual: Object.create(null) as Record<string, IndicadoresMes>,
          total: this.crearIndicadores()
        };

        mapa.set(nombre, fila);
      }

      if (!fila.mensual[periodo]) {
        fila.mensual[periodo] = this.crearIndicadores();
      }

      const valores: IndicadoresMes = {
        horas_totales: Number(item.horas_totales) || 0,
        segundos_totales: Number(item.segundos_totales) || 0,
        acciones: Number(item.acciones) || 0,
        tickets: Number(item.tickets) || 0
      };

      for (const metrica of [
        'horas_totales',
        'segundos_totales',
        'acciones',
        'tickets'
      ] as (keyof IndicadoresMes)[]) {
        fila.mensual[periodo][metrica] += valores[metrica];
        fila.total[metrica] += valores[metrica];
      }
    }

    this.periodos = [...meses].sort();
    this.filas = [...mapa.values()];
  }

  get filasVisibles(): FilaMatrizProyecto[] {
    const termino = this.normalizar(this.busqueda);

    const filtradas = this.filas.filter(fila =>
      this.normalizar(fila.nombre).includes(termino) ||
      this.normalizar(
        this.nombreVisibleProyecto(fila.nombre)
      ).includes(termino)
    );

    return filtradas.sort((a, b) => {
      let resultado: number;

      if (this.columnaOrden === 'nombre') {
        resultado = a.nombre.localeCompare(
          b.nombre, 'es', { sensitivity: 'base' }
        );
      } else {
        const valorA = this.columnaOrden === 'total'
          ? a.total[this.metrica]
          : a.mensual[this.columnaOrden]?.[this.metrica] ?? 0;

        const valorB = this.columnaOrden === 'total'
          ? b.total[this.metrica]
          : b.mensual[this.columnaOrden]?.[this.metrica] ?? 0;

        resultado = valorA - valorB;
      }

      if (resultado === 0) {
        resultado = a.nombre.localeCompare(b.nombre, 'es');
      }

      return this.ordenDescendente ? -resultado : resultado;
    });
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  buscar(evento: Event): void {
    this.busqueda = (evento.target as HTMLInputElement).value;
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
  }

  cambiarMetrica(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;

    if (
      valor === 'horas_totales' ||
      valor === 'acciones' ||
      valor === 'tickets'
    ) {
      this.metrica = valor;
      this.columnaOrden = 'total';
      this.ordenDescendente = true;
    }
  }

  ordenar(columna: string): void {
    if (this.columnaOrden === columna) {
      this.ordenDescendente = !this.ordenDescendente;
    } else {
      this.columnaOrden = columna;
      this.ordenDescendente = columna !== 'nombre';
    }
  }

  indicadorOrden(columna: string): string {
    if (this.columnaOrden !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  obtenerValor(fila: FilaMatrizProyecto, periodo: string): number {
    return fila.mensual[periodo]?.[this.metrica] ?? 0;
  }

  obtenerSegundos(fila: FilaMatrizProyecto, periodo: string): number {
    return fila.mensual[periodo]?.segundos_totales ?? 0;
  }

  obtenerTotal(fila: FilaMatrizProyecto): number {
    return fila.total[this.metrica];
  }

  obtenerTotalSegundos(fila: FilaMatrizProyecto): number {
    return fila.total.segundos_totales;
  }

  totalMes(periodo: string): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + this.obtenerValor(fila, periodo),
      0
    );
  }

  totalMesSegundos(periodo: string): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + this.obtenerSegundos(fila, periodo),
      0
    );
  }

  get totalVisible(): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + this.obtenerTotal(fila),
      0
    );
  }

  get totalVisibleSegundos(): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + this.obtenerTotalSegundos(fila),
      0
    );
  }

  nombreVisibleProyecto(proyecto: string): string {
    return proyecto.replace(/^\d{6}\s+/, '').trim();
  }

  formatearValor(valor: number, segundos: number): string {
    if (this.metrica === 'horas_totales') {
      return formatearTiempo(segundos, valor);
    }

    return valor.toLocaleString('es-PE', {
      maximumFractionDigits: 0
    });
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

  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    const meses = [
      'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
      'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
    ];

    if (!anio || mes < 1 || mes > 12) {
      return periodo;
    }

    return `${meses[mes - 1]} ${anio}`;
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

    this.paginaChange.emit({
      pagina,
      tamano: this.tamanoActual
    });
  }

  cambiarTamanoPagina(evento: Event): void {
    const tamano = Number(
      (evento.target as HTMLSelectElement).value
    );

    if (
      this.cargando ||
      !this.tamanosPagina.includes(tamano) ||
      tamano === this.tamanoActual
    ) {
      return;
    }

    this.paginaChange.emit({
      pagina: 1,
      tamano
    });
  }

  identificarFila(
    _indice: number,
    fila: FilaMatrizProyecto
  ): string {
    return fila.nombre;
  }

  identificarPeriodo(_indice: number, periodo: string): string {
    return periodo;
  }
}
