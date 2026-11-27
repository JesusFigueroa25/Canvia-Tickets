
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TicketsReportTimesDashboardFilters, TicketsReportTimesFilters, TicketsReportTimesKPI, TicketsReportTimesVolumenItem, TicketsReportTimesResolverTabla, TicketsReportTimesProjectTabla, TicketsReportTimesGrafico, TicketsReportTimesImportResult } from '../models/tickets-report-times';

@Injectable({
  providedIn: 'root'
})
export class TicketsReportTimesService {

  private readonly apiUrl = 'api/tickets-report-times';
  constructor(private http: HttpClient) { }

  private construirParametros(filtros: TicketsReportTimesDashboardFilters = {}): HttpParams {

    let params = new HttpParams();

    if (filtros.desde) {
      params = params.set('desde', filtros.desde);
    }

    if (filtros.hasta) {
      params = params.set('hasta', filtros.hasta);
    }

    if (filtros.grupo_resolutor !== undefined) {
      params = params.set(
        'grupo_resolutor',
        filtros.grupo_resolutor ?? ''
      );
    }

    if (filtros.periodo) {
      params = params.set('periodo', filtros.periodo);
    }

    params = params.set(
      'todos_proyectos',
      String(filtros.todos_proyectos ?? false)
    );

    const proyectos = [
      ...new Set(
        (filtros.proyectos ?? [])
          .map(proyecto => proyecto.trim())
          .filter(Boolean)
      )
    ];

    for (const proyecto of proyectos) {
      params = params.append('proyectos', proyecto);
    }

    return params;
  }

  importarExcel(archivo: File): Observable<TicketsReportTimesImportResult> {
    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);

    return this.http.post<TicketsReportTimesImportResult>(
      `${this.apiUrl}/import`,
      formData
    );
  }

  obtenerFiltros(grupoResolutor: string | null = 'BASE DE DATOS Y EBS'): Observable<TicketsReportTimesFilters> {
    const params = new HttpParams().set(
      'grupo_resolutor',
      grupoResolutor ?? ''
    );

    return this.http.get<TicketsReportTimesFilters>(
      `${this.apiUrl}/filters`,
      { params }
    );
  }

  obtenerKpis(filtros: TicketsReportTimesDashboardFilters = {}): Observable<TicketsReportTimesKPI> {
    return this.http.get<TicketsReportTimesKPI>(
      `${this.apiUrl}/kpis`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerVolumenMensual(filtros: TicketsReportTimesDashboardFilters = {}): Observable<TicketsReportTimesVolumenItem[]> {
    return this.http.get<TicketsReportTimesVolumenItem[]>(
      `${this.apiUrl}/volumen-mensual`,
      { params: this.construirParametros(filtros) }
    );
  }

  obtenerTiemposResolutores(filtros: TicketsReportTimesDashboardFilters = {}, pagina: number = 1, tamano: number = 25):
    Observable<TicketsReportTimesResolverTabla> {
    const params = this.construirParametros(filtros)
      .set('pagina', pagina.toString())
      .set('tamano', tamano.toString());

    return this.http.get<TicketsReportTimesResolverTabla>(
      `${this.apiUrl}/tiempos-resolutores`,
      { params }
    );
  }

  obtenerTiemposResolutoresGrafico(
    filtros: TicketsReportTimesDashboardFilters = {},
    limite: number = 10
  ): Observable<TicketsReportTimesGrafico> {
    const params = this.construirParametros(filtros)
      .set('limite', limite.toString());

    return this.http.get<TicketsReportTimesGrafico>(
      `${this.apiUrl}/tiempos-resolutores-grafico`,
      { params }
    );
  }

  obtenerTiemposProyectos(
    filtros: TicketsReportTimesDashboardFilters = {},
    pagina: number = 1,
    tamano: number = 25
  ): Observable<TicketsReportTimesProjectTabla> {

    const params = this.construirParametros(filtros)
      .set('pagina', pagina.toString())
      .set('tamano', tamano.toString());

    return this.http.get<TicketsReportTimesProjectTabla>(
      `${this.apiUrl}/tiempos-proyectos`,
      { params }
    );
  }

  obtenerTiemposProyectosGrafico(
    filtros: TicketsReportTimesDashboardFilters = {},
    limite: number = 10
  ): Observable<TicketsReportTimesGrafico> {

    const params = this.construirParametros(filtros)
      .set('limite', limite.toString());

    return this.http.get<TicketsReportTimesGrafico>(
      `${this.apiUrl}/tiempos-proyectos-grafico`,
      { params }
    );
  }
}
