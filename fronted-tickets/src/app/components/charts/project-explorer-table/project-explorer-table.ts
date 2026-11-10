
import { AfterViewInit, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { IncidentSLAProyectoItem } from '../../../models/incident-sla';
import { IncidentConsolidatedProyectoItem } from '../../../models/incident-consolidated';

interface ProyectoTablaFila {
  proyecto: string | null;
  // Métrica de Consolidados
  cantidad?: number;
  // Métricas de SLA
  tickets?: number;
  medibles?: number;
  sin_medicion?: number;
  cumple?: number;
  incumple?: number;
  sla_solucion?: number;
  sla_respuesta?: number;
  porcentaje_volumen?: number;
}

@Component({
  selector: 'app-project-explorer-table',
  standalone: false,
  templateUrl: './project-explorer-table.html',
  styleUrl: './project-explorer-table.css'
})

export class ProjectExplorerTable
  implements OnChanges, AfterViewInit {

  @Input() datosConsolidados: IncidentConsolidatedProyectoItem[] = [];
  @Input() modo: 'sla' | 'consolidado' = 'sla';
  @Input() datos: IncidentSLAProyectoItem[] = [];
  @Input() entidadConsolidado: 'incidentes' | 'requerimientos' = 'incidentes';

  @Input() opcionesProyectos: string[] = [];
  @Input() proyectoSeleccionado: string | null = null;
  @Output() proyectoChange = new EventEmitter<string | null>();
  @Input() modoBusqueda: 'texto' | 'combo' = 'texto';

  // EXCLUSION MULTIPLE DE PROYECTOS
  @Input() habilitarExclusionProyectos = false;
  @Input() proyectosExcluidos: string[] = [];
  @Output() proyectosExcluidosChange = new EventEmitter<string[]>();


  // PANTALLA COMPLETA
  @Input() habilitarPantallaCompleta = false;
  @Input() pantallaCompletaActiva = false;
  @Output() pantallaCompletaSolicitada = new EventEmitter<void>();

  exclusionesAbiertas = false;
  busquedaExclusion = '';

  // Texto que escribe el usuario
  busquedaProyecto: string = '';

  // Proyectos que coinciden con la búsqueda
  get proyectosFiltrados(): string[] {
    const busqueda = this.busquedaProyecto.trim().toLocaleLowerCase();

    if (!busqueda) {
      return this.opcionesProyectos;
    }

    return this.opcionesProyectos.filter(
      proyecto =>
        proyecto.toLocaleLowerCase().includes(busqueda)
    );
  }

  filtrarProyectos(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaProyecto = input.value;
  }

  abrirComboProyecto(abierto: boolean): void {
    if (abierto) {
      this.busquedaProyecto = '';
    }
  }

  manejarTeclaBusqueda(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }

  // ====================================================
  // EXCLUSION MULTIPLE DE PROYECTOS
  // ====================================================

  private normalizarNombreProyecto(proyecto: string): string {
    return proyecto.trim().toLocaleLowerCase();
  }

  // Mantener disponibles los proyectos excluidos
  // aunque desaparezcan del resultado filtrado.
  get proyectosDisponiblesExclusion(): string[] {

    const proyectos = [
      ...this.opcionesProyectos,
      ...this.proyectosExcluidos
    ];

    const vistos = new Set<string>();
    const resultado: string[] = [];

    for (const proyecto of proyectos) {

      if (typeof proyecto !== 'string') {
        continue;
      }

      const nombre = proyecto.trim();
      const clave = this.normalizarNombreProyecto(nombre);

      if (!nombre || vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);
      resultado.push(nombre);
    }

    return resultado;
  }

  // Buscar proyectos dentro del selector de exclusiones
  get proyectosFiltradosExclusion(): string[] {

    const busqueda = this.busquedaExclusion
      .trim()
      .toLocaleLowerCase();

    if (!busqueda) {
      return this.proyectosDisponiblesExclusion;
    }

    return this.proyectosDisponiblesExclusion.filter(
      proyecto =>
        proyecto.toLocaleLowerCase().includes(busqueda)
    );
  }

  abrirExclusiones(): void {

    this.exclusionesAbiertas = !this.exclusionesAbiertas;

    if (this.exclusionesAbiertas) {
      this.busquedaExclusion = '';
    }
  }

  cerrarExclusiones(): void {
    this.exclusionesAbiertas = false;
    this.busquedaExclusion = '';
  }

  filtrarExclusiones(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busquedaExclusion = input.value;
  }

  estaExcluido(proyecto: string): boolean {

    const clave = this.normalizarNombreProyecto(proyecto);

    return this.proyectosExcluidos.some(
      excluido =>
        this.normalizarNombreProyecto(excluido) === clave
    );
  }

  alternarExclusionProyecto(proyecto: string): void {

    const nombre = proyecto.trim();

    if (!nombre) {
      return;
    }

    const clave = this.normalizarNombreProyecto(nombre);

    let seleccion: string[];

    if (this.estaExcluido(nombre)) {

      seleccion = this.proyectosExcluidos.filter(
        excluido =>
          this.normalizarNombreProyecto(excluido) !== clave
      );

    } else {

      seleccion = [
        ...this.proyectosExcluidos,
        nombre
      ];
    }

    this.actualizarProyectosExcluidos(seleccion);
  }

  // Excluir o volver a incluir todos los proyectos
  // que coinciden con la búsqueda actual.
  alternarExclusionVisibles(): void {

    const visibles = this.proyectosFiltradosExclusion;

    if (visibles.length === 0) {
      return;
    }

    const todosExcluidos = visibles.every(
      proyecto => this.estaExcluido(proyecto)
    );

    let seleccion: string[];

    if (todosExcluidos) {

      const clavesVisibles = new Set(
        visibles.map(
          proyecto => this.normalizarNombreProyecto(proyecto)
        )
      );

      seleccion = this.proyectosExcluidos.filter(
        proyecto =>
          !clavesVisibles.has(
            this.normalizarNombreProyecto(proyecto)
          )
      );

    } else {

      seleccion = [...this.proyectosExcluidos];

      const clavesSeleccionadas = new Set(
        seleccion.map(
          proyecto => this.normalizarNombreProyecto(proyecto)
        )
      );

      for (const proyecto of visibles) {

        const clave = this.normalizarNombreProyecto(proyecto);

        if (!clavesSeleccionadas.has(clave)) {
          seleccion.push(proyecto);
          clavesSeleccionadas.add(clave);
        }
      }
    }

    this.actualizarProyectosExcluidos(seleccion);
  }

  get todosVisiblesExcluidos(): boolean {

    const visibles = this.proyectosFiltradosExclusion;

    return (
      visibles.length > 0 &&
      visibles.every(
        proyecto => this.estaExcluido(proyecto)
      )
    );
  }

  limpiarExclusiones(): void {

    if (this.proyectosExcluidos.length === 0) {
      return;
    }

    this.actualizarProyectosExcluidos([]);
  }

  private actualizarProyectosExcluidos(proyectos: string[]): void {

    const vistos = new Set<string>();
    const seleccion: string[] = [];

    for (const proyecto of proyectos) {

      const nombre = proyecto.trim();
      const clave = this.normalizarNombreProyecto(nombre);

      if (!nombre || vistos.has(clave)) {
        continue;
      }

      vistos.add(clave);
      seleccion.push(nombre);
    }

    // Actualización local para que los checkboxes
    // respondan inmediatamente.
    this.proyectosExcluidos = seleccion;

    // El componente padre aplicará el filtro global.
    this.proyectosExcluidosChange.emit([...seleccion]);
  }


  private readonly columnasSla: string[] = [
    'proyecto',
    'tickets',
    'medibles',
    'sin_medicion',
    'cumple',
    'incumple',
    'sla_solucion',
    'sla_respuesta',
    'porcentaje_volumen'
  ];

  private readonly columnasConsolidados: string[] = [
    'proyecto',
    'cantidad'
  ];

  seleccionarProyecto(proyecto: string | null): void {
    this.busquedaProyecto = '';
    this.proyectoChange.emit(proyecto);
  }

  displayedColumns: string[] = [
    ...this.columnasSla
  ];

  dataSource = new MatTableDataSource<ProyectoTablaFila>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor() {

    this.dataSource.filterPredicate = (
      data: ProyectoTablaFila,
      filter: string
    ) => {

      const proyecto = data.proyecto?.toLowerCase() ?? '';

      return proyecto.includes(
        filter.trim().toLowerCase()
      );
    };
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (
      changes['datos'] ||
      changes['datosConsolidados'] ||
      changes['modo']
    ) {

      if (this.modo === 'consolidado') {

        this.displayedColumns = [
          ...this.columnasConsolidados
        ];

        this.dataSource.data = this.datosConsolidados.map(
          item => ({
            proyecto: item.proyecto,
            cantidad: item.cantidad
          })
        );

      } else {

        this.displayedColumns = [...this.columnasSla];

        this.dataSource.data = this.datos.map(
          item => ({ ...item })
        );
      }

      if (this.paginator) {
        this.paginator.firstPage();
      }
    }
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  aplicarBusqueda(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.dataSource.filter = valor.trim().toLowerCase();
  }

  obtenerClaseSla(valor: number): string {
    if (valor >= 95) {
      return 'sla-good';
    }

    if (valor >= 90) {
      return 'sla-warning';
    }

    return 'sla-danger';
  }

  seleccionarFilaProyecto(fila: ProyectoTablaFila): void {

    if (this.modoBusqueda !== 'combo' || !fila.proyecto) {
      return;
    }

    const nuevoProyecto =
      this.proyectoSeleccionado === fila.proyecto
        ? null
        : fila.proyecto;

    this.seleccionarProyecto(nuevoProyecto);
  }

}
