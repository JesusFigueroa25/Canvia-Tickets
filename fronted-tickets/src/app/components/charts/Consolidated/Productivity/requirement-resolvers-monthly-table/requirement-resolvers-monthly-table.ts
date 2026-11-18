
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import {
  RequirementDotacionTabla
} from '../../../../../models/requirement-consolidated';

type MetricaDotacion = 'tickets' | 'actividad';

interface DetalleProyectoResolutor {
  proyecto: string;
  periodo: string;
  tickets: number;
}

interface FilaMatrizDotacion {
  clave: string;
  nombre: string;
  sinResolutor: boolean;
  mensual: Record<string, number>;
  totalTickets: number;
  mesesActivos: number;
  detalles: DetalleProyectoResolutor[];
}

@Component({
  selector: 'app-requirement-resolvers-monthly-table',
  standalone: false,
  templateUrl: './requirement-resolvers-monthly-table.html',
  styleUrl: './requirement-resolvers-monthly-table.css'
})
export class RequirementResolversMonthlyTable implements OnChanges {

  @Input() datos: RequirementDotacionTabla | null = null;
  @Input() periodosDisponibles: string[] = [];
  @ViewChild('detalleDialog')
  detalleDialog?: ElementRef<HTMLDialogElement>;
  filaDetalle: FilaMatrizDotacion | null = null;

  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange =
    new EventEmitter<{ pagina: number; tamano: number }>();

  readonly tamanosPagina = [10, 25, 50, 100, 200];

  private readonly nombresMeses = [
    'ENE', 'FEB', 'MAR', 'ABR',
    'MAY', 'JUN', 'JUL', 'AGO',
    'SEP', 'OCT', 'NOV', 'DIC'
  ];

  busqueda = '';
  metrica: MetricaDotacion = 'tickets';

  periodos: string[] = [];
  filas: FilaMatrizDotacion[] = [];

  filaExpandida: string | null = null;

  ordenColumna = 'total';
  ordenDescendente = true;


  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['datos'] ||
      changes['periodosDisponibles']
    ) {
      this.cerrarDetalle();
      this.construirMatriz();
      this.filaExpandida = null;

      if (
        changes['datos'] &&
        !changes['datos'].firstChange
      ) {
        this.busqueda = '';
      }
    }
  }


  // CONSTRUCCIÓN DE LA MATRIZ
  private construirMatriz(): void {
    const registros = this.datos?.items ?? [];

    const mapa = new Map<string, FilaMatrizDotacion>();
    const meses = new Set<string>();

    for (const registro of registros) {
      meses.add(registro.periodo);

      for (const resolutor of registro.resolutores ?? []) {
        const nombre = resolutor.nombre?.trim();

        if (!nombre) {
          continue;
        }

        this.agregarRegistro(
          mapa,
          nombre,
          registro.periodo,
          registro.proyecto,
          resolutor.tickets,
          false
        );
      }

      // Conservar los tickets sin resolutor.
      if (registro.tickets_sin_resolutor > 0) {
        this.agregarRegistro(
          mapa,
          'Sin resolutor',
          registro.periodo,
          registro.proyecto,
          registro.tickets_sin_resolutor,
          true
        );
      }
    }


    this.periodos = [
      ...new Set([
        ...this.periodosDisponibles,
        ...meses
      ])
    ].sort();


    this.filas = [...mapa.values()].map(fila => {
      fila.mesesActivos = Object.keys(fila.mensual).length;

      fila.detalles.sort((a, b) =>
        b.periodo.localeCompare(a.periodo) ||
        a.proyecto.localeCompare(b.proyecto, 'es', {
          sensitivity: 'base'
        })
      );

      return fila;
    });
  }

  private agregarRegistro(
    mapa: Map<string, FilaMatrizDotacion>,
    nombre: string,
    periodo: string,
    proyecto: string,
    tickets: number,
    sinResolutor: boolean
  ): void {
    const clave = sinResolutor
      ? '__SIN_RESOLUTOR__'
      : this.normalizar(nombre);

    let fila = mapa.get(clave);

    if (!fila) {
      fila = {
        clave,
        nombre,
        sinResolutor,
        mensual: Object.create(null) as Record<string, number>,
        totalTickets: 0,
        mesesActivos: 0,
        detalles: []
      };

      mapa.set(clave, fila);
    }

    const cantidad = Number(tickets) || 0;

    fila.mensual[periodo] =
      (fila.mensual[periodo] ?? 0) + cantidad;

    fila.totalTickets += cantidad;

    const detalleExistente = fila.detalles.find(
      detalle =>
        detalle.periodo === periodo &&
        detalle.proyecto === proyecto
    );

    if (detalleExistente) {
      detalleExistente.tickets += cantidad;
    } else {
      fila.detalles.push({
        proyecto,
        periodo,
        tickets: cantidad
      });
    }
  }

  // BÚSQUEDA Y ORDENAMIENTO
  get filasVisibles(): FilaMatrizDotacion[] {
    const termino = this.normalizar(this.busqueda);

    const filtradas = this.filas.filter(fila => {
      if (!termino) {
        return true;
      }

      return (
        this.normalizar(fila.nombre).includes(termino) ||
        fila.detalles.some(detalle =>
          this.normalizar(detalle.proyecto).includes(termino) ||
          this.normalizar(
            this.nombreVisibleProyecto(detalle.proyecto)
          ).includes(termino) ||
          detalle.periodo.includes(termino)
        )
      );
    });

    return filtradas.sort((a, b) => {
      let resultado: number;

      if (this.ordenColumna === 'nombre') {
        resultado = a.nombre.localeCompare(
          b.nombre,
          'es',
          { sensitivity: 'base' }
        );
      } else {
        resultado =
          this.obtenerValorOrden(a) -
          this.obtenerValorOrden(b);
      }

      if (resultado === 0) {
        resultado = a.nombre.localeCompare(
          b.nombre,
          'es',
          { sensitivity: 'base' }
        );
      }

      return this.ordenDescendente
        ? -resultado
        : resultado;
    });
  }

  private obtenerValorOrden(fila: FilaMatrizDotacion): number {
    if (this.ordenColumna === 'total') {
      return this.obtenerTotal(fila);
    }

    return this.obtenerValor(fila, this.ordenColumna);
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  buscar(evento: Event): void {
    this.busqueda =
      (evento.target as HTMLInputElement).value;

    this.filaExpandida = null;
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.filaExpandida = null;
  }

  ordenar(columna: string): void {
    if (this.ordenColumna === columna) {
      this.ordenDescendente = !this.ordenDescendente;
    } else {
      this.ordenColumna = columna;
      this.ordenDescendente = columna !== 'nombre';
    }
  }

  indicadorOrden(columna: string): string {
    if (this.ordenColumna !== columna) {
      return '↕';
    }

    return this.ordenDescendente ? '↓' : '↑';
  }

  cambiarMetrica(evento: Event): void {
    const valor =
      (evento.target as HTMLSelectElement).value;

    if (valor === 'tickets' || valor === 'actividad') {
      this.metrica = valor;
      this.ordenColumna = 'total';
      this.ordenDescendente = true;
    }
  }

  // VALORES DE LA MATRIZ
  obtenerValor(
    fila: FilaMatrizDotacion,
    periodo: string
  ): number {
    if (this.metrica === 'actividad') {
      if (fila.sinResolutor) {
        return 0;
      }

      return Object.prototype.hasOwnProperty.call(
        fila.mensual,
        periodo
      ) ? 1 : 0;
    }

    return fila.mensual[periodo] ?? 0;
  }

  obtenerTotal(fila: FilaMatrizDotacion): number {
    if (this.metrica === 'actividad') {
      return fila.sinResolutor ? 0 : fila.mesesActivos;
    }

    return fila.totalTickets;
  }

  totalMes(periodo: string): number {
    return this.filasVisibles.reduce(
      (total, fila) =>
        total + this.obtenerValor(fila, periodo),
      0
    );
  }

  get totalVisible(): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + this.obtenerTotal(fila),
      0
    );
  }

  resolutoresActivosMes(periodo: string): number {
    return this.filasVisibles.filter(fila =>
      !fila.sinResolutor &&
      Object.prototype.hasOwnProperty.call(
        fila.mensual,
        periodo
      )
    ).length;
  }

  get resolutoresUnicosVisibles(): number {
    return this.filasVisibles.filter(
      fila => !fila.sinResolutor
    ).length;
  }

  totalTicketsMes(periodo: string): number {
    return this.filasVisibles.reduce(
      (total, fila) =>
        total + (fila.mensual[periodo] ?? 0),
      0
    );
  }

  get totalTicketsVisibles(): number {
    return this.filasVisibles.reduce(
      (total, fila) => total + fila.totalTickets,
      0
    );
  }


  abrirDetalle(fila: FilaMatrizDotacion): void {
    this.filaDetalle = fila;

    const dialogo = this.detalleDialog?.nativeElement;

    if (dialogo && !dialogo.open) {
      dialogo.showModal();
    }
  }

  cerrarDetalle(): void {
    const dialogo = this.detalleDialog?.nativeElement;

    if (dialogo?.open) {
      dialogo.close();
    }

    this.filaDetalle = null;
  }

  cerrarDialogoSiBackdrop(evento: MouseEvent): void {
    if (
      evento.target ===
      this.detalleDialog?.nativeElement
    ) {
      this.cerrarDetalle();
    }
  }


  // PAGINACIÓN EXISTENTE
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

    return (this.datos.pagina - 1) *
      this.datos.tamano + 1;
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

    this.busqueda = '';
    this.filaExpandida = null;

    this.paginaChange.emit({
      pagina: 1,
      tamano
    });
  }

  // FORMATEO
  formatearPeriodo(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);

    if (!anio || !mes || mes < 1 || mes > 12) {
      return periodo;
    }

    return `${this.nombresMeses[mes - 1]} ${anio}`;
  }

  nombreVisibleProyecto(proyecto: string): string {
    return proyecto.replace(/^\d{6}\s+/, '').trim();
  }

  formatearNumero(valor: number): string {
    return valor.toLocaleString('es-PE');
  }

  identificarFila(
    _indice: number,
    fila: FilaMatrizDotacion
  ): string {
    return fila.clave;
  }

  identificarPeriodo(
    _indice: number,
    periodo: string
  ): string {
    return periodo;
  }


  proyectosDistintosDetalle(
    fila: FilaMatrizDotacion
  ): number {
    return new Set(
      fila.detalles.map(detalle => detalle.proyecto)
    ).size;
  }


}
