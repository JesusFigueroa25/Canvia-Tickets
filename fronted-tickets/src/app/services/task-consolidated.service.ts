import { Injectable } from '@angular/core';
import { ResolutorRendimientoOut, ResolutorTicketsPorResolutorOut } from '../models/resolutor-dashboard';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ImportResultado } from '../models/import-result';
import {
  TaskConsolidatedDashboardFilters,
  TaskConsolidatedFilters,
  TaskConsolidatedKPI,
  TaskConsolidatedVolumenItem,
  TaskConsolidatedProyectoItem,
  TaskConsolidatedTipoItem,
  TaskConsolidatedPrioridadItem,
  TaskConsolidatedTopProyectos,
  TaskConsolidatedPrioridadMensualItem,
  TaskConsolidatedTicketsOut
} from '../models/task-consolidated';

@Injectable({ providedIn: 'root' })
export class TaskConsolidatedService {

  private readonly apiUrl = 'api/task-consolidated';

  constructor(private http: HttpClient) { }

  private construirParametros(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): HttpParams {
    let params = new HttpParams();

    const campos: (keyof Pick<
      TaskConsolidatedDashboardFilters,
      | 'desde'
      | 'hasta'
      | 'prioridad'
      | 'motivo_estado'
      | 'grupo_resolutor'
      | 'proyecto'
      | 'periodo'
      | 'ticket_id'
    >)[] = [
        'desde',
        'hasta',
        'prioridad',
        'motivo_estado',
        'grupo_resolutor',
        'proyecto',
        'periodo',
        'ticket_id'
      ];

    for (const campo of campos) {
      const valor = filtros[campo]?.trim();
      if (valor) {
        params = params.set(campo, valor);
      }
    }

    for (const campo of ['proyectos_excluidos', 'tipo_tarea'] as const) {
      const valores = [
        ...new Set(
          (filtros[campo] ?? [])
            .map(valor => valor.trim())
            .filter(valor => valor.length > 0)
        )
      ];

      for (const valor of valores) {
        params = params.append(campo, valor);
      }
    }

        // PRD 06: filtro común para los cinco dashboards.
        if (filtros.nombre_resolutor?.trim()) {
            params = params.set('nombre_resolutor', filtros.nombre_resolutor.trim());
        }

    return params;
  }

  importarExcel(archivo: File): Observable<ImportResultado> {
    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);

    return this.http.post<ImportResultado>(
      `${this.apiUrl}/import`,
      formData
    );
  }

  obtenerFiltros(): Observable<TaskConsolidatedFilters> {
    return this.http.get<TaskConsolidatedFilters>(
      `${this.apiUrl}/filters`
    );
  }

  obtenerKpis(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedKPI> {
    return this.http.get<TaskConsolidatedKPI>(
      `${this.apiUrl}/kpis`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerVolumenMensual(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedVolumenItem[]> {
    return this.http.get<TaskConsolidatedVolumenItem[]>(
      `${this.apiUrl}/volumen-mensual`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerProyectos(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedProyectoItem[]> {
    return this.http.get<TaskConsolidatedProyectoItem[]>(
      `${this.apiUrl}/proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTipos(
    filtros: TaskConsolidatedDashboardFilters = {},
    limite: number = 10
  ): Observable<TaskConsolidatedTipoItem[]> {
    const params = this.construirParametros(filtros)
      .set('limite', limite.toString());

    return this.http.get<TaskConsolidatedTipoItem[]>(
      `${this.apiUrl}/tipos`,
      { params }
    );
  }

  obtenerPrioridades(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedPrioridadItem[]> {
    return this.http.get<TaskConsolidatedPrioridadItem[]>(
      `${this.apiUrl}/prioridades`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTopProyectos(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedTopProyectos> {
    return this.http.get<TaskConsolidatedTopProyectos>(
      `${this.apiUrl}/top-proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerPrioridadMensual(
    filtros: TaskConsolidatedDashboardFilters = {}
  ): Observable<TaskConsolidatedPrioridadMensualItem[]> {
    return this.http.get<TaskConsolidatedPrioridadMensualItem[]>(
      `${this.apiUrl}/prioridad-mensual`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTickets(
    filtros: TaskConsolidatedDashboardFilters = {},
    pagina: number = 1,
    tamano: number = 10
  ): Observable<TaskConsolidatedTicketsOut> {
    const params = this.construirParametros(filtros)
      .set('pagina', pagina.toString())
      .set('tamano', tamano.toString());

    return this.http.get<TaskConsolidatedTicketsOut>(
      `${this.apiUrl}/tickets`,
      { params }
    );
  }
    // PRD 06 - Rendimiento mensual paginado por resolutor.
    obtenerRendimientoResolutores(
        filtros: TaskConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 20
    ): Observable<ResolutorRendimientoOut> {
        const params = this.construirParametros(filtros)
            .set('pagina', String(pagina))
            .set('tamano', String(tamano));

        return this.http.get<ResolutorRendimientoOut>(
            `${this.apiUrl}/rendimiento-resolutores`,
            { params }
        );
    }

    // PRD 06 - Ranking de tickets por resolutor (Top 5/10/15/20).
    obtenerTicketsPorResolutor(
        filtros: TaskConsolidatedDashboardFilters = {},
        limite: number = 5
    ): Observable<ResolutorTicketsPorResolutorOut> {
        const params = this.construirParametros(filtros)
            .set('tamano', String(limite));

        return this.http.get<ResolutorTicketsPorResolutorOut>(
            `${this.apiUrl}/tickets-por-resolutor`,
            { params }
        );
    }
}
