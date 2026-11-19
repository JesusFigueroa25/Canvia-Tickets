import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ImportResultado } from '../models/import-result';
import {
  ChangeConsolidatedDashboardFilters,
  ChangeConsolidatedFilters,
  ChangeConsolidatedKPI,
  ChangeConsolidatedVolumenItem,
  ChangeConsolidatedProyectoItem,
  ChangeConsolidatedTipoItem,
  ChangeConsolidatedCategoriaItem,
  ChangeConsolidatedPrioridadItem,
  ChangeConsolidatedTopProyectos,
  ChangeConsolidatedPrioridadMensualItem,
  ChangeConsolidatedTicketsOut
} from '../models/change-consolidated';

@Injectable({ providedIn: 'root' })
export class ChangeConsolidatedService {
  // Mismo patrón de proxy Angular que TaskConsolidatedService.
  private readonly apiUrl = 'api/change-consolidated';

  constructor(private readonly http: HttpClient) { }

  private construirParametros(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): HttpParams {
    let params = new HttpParams();

    const campos: (keyof Pick<
      ChangeConsolidatedDashboardFilters,
      'desde' | 'hasta' | 'prioridad' | 'motivo' | 'grupo_resolutor' |
      'estado' | 'proyecto' | 'periodo' | 'ticket_id'
    >)[] = [
      'desde', 'hasta', 'prioridad', 'motivo', 'grupo_resolutor',
      'estado', 'proyecto', 'periodo', 'ticket_id'
    ];

    for (const campo of campos) {
      const valor = filtros[campo]?.trim();
      if (valor) {
        params = params.set(campo, valor);
      }
    }

    for (const campo of ['proyectos_excluidos', 'tipo_cambio'] as const) {
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

    return params;
  }

  importarExcel(archivo: File): Observable<ImportResultado> {
    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);
    return this.http.post<ImportResultado>(`${this.apiUrl}/import`, formData);
  }

  obtenerFiltros(): Observable<ChangeConsolidatedFilters> {
    return this.http.get<ChangeConsolidatedFilters>(`${this.apiUrl}/filters`);
  }

  obtenerKpis(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedKPI> {
    return this.http.get<ChangeConsolidatedKPI>(`${this.apiUrl}/kpis`, {
      params: this.construirParametros(filtros)
    });
  }

  // Métodos disponibles para integrar los componentes hijos en la etapa siguiente.
  obtenerVolumenMensual(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedVolumenItem[]> {
    return this.http.get<ChangeConsolidatedVolumenItem[]>(
      `${this.apiUrl}/volumen-mensual`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerProyectos(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedProyectoItem[]> {
    return this.http.get<ChangeConsolidatedProyectoItem[]>(
      `${this.apiUrl}/proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTiposCambio(
    filtros: ChangeConsolidatedDashboardFilters = {},
    limite = 10
  ): Observable<ChangeConsolidatedTipoItem[]> {
    const params = this.construirParametros(filtros).set('limite', limite.toString());
    // Ruta efectiva compartida: /tipo_cambio (no /tipos).
    return this.http.get<ChangeConsolidatedTipoItem[]>(
      `${this.apiUrl}/tipos`, { params }
    );
  }

  obtenerCategorias(
    filtros: ChangeConsolidatedDashboardFilters = {},
    limite = 10
  ): Observable<ChangeConsolidatedCategoriaItem[]> {
    const params = this.construirParametros(filtros).set('limite', limite.toString());
    return this.http.get<ChangeConsolidatedCategoriaItem[]>(
      `${this.apiUrl}/categorias`, { params }
    );
  }

  obtenerPrioridades(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedPrioridadItem[]> {
    return this.http.get<ChangeConsolidatedPrioridadItem[]>(
      `${this.apiUrl}/prioridades`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTopProyectos(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedTopProyectos> {
    return this.http.get<ChangeConsolidatedTopProyectos>(
      `${this.apiUrl}/top-proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerPrioridadMensual(
    filtros: ChangeConsolidatedDashboardFilters = {}
  ): Observable<ChangeConsolidatedPrioridadMensualItem[]> {
    return this.http.get<ChangeConsolidatedPrioridadMensualItem[]>(
      `${this.apiUrl}/prioridad-mensual`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTickets(
    filtros: ChangeConsolidatedDashboardFilters = {},
    pagina = 1,
    tamano = 10
  ): Observable<ChangeConsolidatedTicketsOut> {
    const params = this.construirParametros(filtros)
      .set('pagina', pagina.toString())
      .set('tamano', tamano.toString());
    return this.http.get<ChangeConsolidatedTicketsOut>(
      `${this.apiUrl}/tickets`, { params }
    );
  }
}
