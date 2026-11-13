import {
  Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges
} from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { RequirementActualizacionesManualesTabla } from '../../../../../models/requirement-consolidated';

@Component({
  selector: 'app-requirement-manual-updates-table',
  standalone: false,
  templateUrl: './requirement-manual-updates-table.html',
  styleUrl: './requirement-manual-updates-table.css'
})
export class RequirementManualUpdatesTable implements OnChanges, OnDestroy {
  @Input() datos: RequirementActualizacionesManualesTabla | null = null;
  @Input() resolutorSeleccionado: string | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() paginaChange = new EventEmitter<{ pagina: number; tamano: number }>();
  @Output() resolutorChange = new EventEmitter<string | null>();

  readonly columnas = ['grupo_resolutor', 'resolutor', 'tickets', 'proyectos', 'porcentaje'];
  readonly opcionesPagina = [10, 25, 50, 100];
  textoBusqueda = '';

  private readonly buscar$ = new Subject<string>();
  private readonly destruir$ = new Subject<void>();

  constructor() {
    this.buscar$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destruir$)
    ).subscribe(valor => {
      this.resolutorChange.emit(valor || null);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resolutorSeleccionado']) {
      this.textoBusqueda = this.resolutorSeleccionado ?? '';
    }
  }

  actualizarBusqueda(evento: Event): void {
    const elemento = evento.target as HTMLInputElement | null;
    this.textoBusqueda = elemento?.value ?? '';
    this.buscar$.next(this.textoBusqueda.trim());
  }

  limpiarBusqueda(): void {
    if (!this.textoBusqueda) return;
    this.textoBusqueda = '';
    this.buscar$.next('');
  }

  cambiarPagina(evento: PageEvent): void {
    this.paginaChange.emit({ pagina: evento.pageIndex + 1, tamano: evento.pageSize });
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }
}
