
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  DailyReportDashboardFilters,
  DailyReportFilters,
  DailyReportKPI,
  DailyReportDiaItem,
  DailyReportResumen,
  DailyReportProyectoItem,
  DailyReportTopProyectos
} from '../models/daily-report';

@Injectable({ providedIn: 'root' })
export class DailyReportService {

  private readonly apiUrl = 'api/daily-report';

  constructor(private http: HttpClient) { }

  private construirParametros(
    filtros: DailyReportDashboardFilters = {}
  ): HttpParams {

    let params = new HttpParams();

    const desde = filtros.desde?.trim();
    const hasta = filtros.hasta?.trim();
    const grupoResolutor = filtros.grupo_resolutor?.trim();
    const proyecto = filtros.proyecto?.trim();

    if (desde) {
      params = params.set('desde', desde);
    }

    if (hasta) {
      params = params.set('hasta', hasta);
    }

    if (grupoResolutor) {
      params = params.set('grupo_resolutor', grupoResolutor);
    }

    if (proyecto) {
      params = params.set('proyecto', proyecto);
    }

    return params;
  }

  obtenerFiltros(): Observable<DailyReportFilters> {
    return this.http.get<DailyReportFilters>(
      `${this.apiUrl}/filters`
    );
  }

  obtenerKpis(
    filtros: DailyReportDashboardFilters = {}
  ): Observable<DailyReportKPI> {
    return this.http.get<DailyReportKPI>(
      `${this.apiUrl}/kpis`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerDiario(
    filtros: DailyReportDashboardFilters = {}
  ): Observable<DailyReportDiaItem[]> {
    return this.http.get<DailyReportDiaItem[]>(
      `${this.apiUrl}/diario`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerResumen(
    filtros: DailyReportDashboardFilters = {}
  ): Observable<DailyReportResumen> {
    return this.http.get<DailyReportResumen>(
      `${this.apiUrl}/resumen`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerProyectos(
    filtros: DailyReportDashboardFilters = {}
  ): Observable<DailyReportProyectoItem[]> {
    return this.http.get<DailyReportProyectoItem[]>(
      `${this.apiUrl}/proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTopProyectos(
    filtros: DailyReportDashboardFilters = {}
  ): Observable<DailyReportTopProyectos> {
    return this.http.get<DailyReportTopProyectos>(
      `${this.apiUrl}/top-proyectos`,
      { params: this.construirParametros(filtros) }
    );
  }
}
