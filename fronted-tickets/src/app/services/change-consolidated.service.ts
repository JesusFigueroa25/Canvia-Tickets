import { Injectable } from '@angular/core';
import { ResolutorRendimientoOut, ResolutorTicketsPorResolutorOut } from '../models/resolutor-dashboard';
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
  ChangeConsolidatedTicketsOut,
  ChangeConsolidatedActividadesBDOut,
  ChangeConsolidatedHorasCambioOut,
  ChangeConsolidatedHorasResolutorItem,
  ChangeConsolidatedHorasMensualesItem
} from '../models/change-consolidated';

@Injectable({ providedIn: 'root' })
export class ChangeConsolidatedService {
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

        // PRD 06: filtro común para los cinco dashboards.
        if (filtros.nombre_resolutor?.trim()) {
            params = params.set('nombre_resolutor', filtros.nombre_resolutor.trim());
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


  // =====================================================
  // PRD 05 - ACTIVIDADES Y HORAS DE CAMBIOS
  // =====================================================

  private construirParametrosAnalisis(
    filtros: ChangeConsolidatedDashboardFilters = {},
    incluirSoloValidacion = true
  ): HttpParams {
    return this.construirParametros(filtros)
      .set(
        'incluir_solo_validacion',
        String(incluirSoloValidacion)
      );
  }


  // BLOQUE 1: Tabla de actividades BD
  obtenerActividadesBD(
    filtros: ChangeConsolidatedDashboardFilters = {},
    pagina = 1,
    tamano = 10,
    incluirSoloValidacion = true
  ): Observable<ChangeConsolidatedActividadesBDOut> {

    const params = this.construirParametrosAnalisis(
      filtros,
      incluirSoloValidacion
    )
      .set('pagina', String(pagina))
      .set('tamano', String(tamano));

    return this.http.get<ChangeConsolidatedActividadesBDOut>(
      `${this.apiUrl}/actividades-bd`,
      { params }
    );
  }


  // BLOQUE 2: Tabla de horas por cambio
  obtenerHorasPorCambio(
    filtros: ChangeConsolidatedDashboardFilters = {},
    pagina = 1,
    tamano = 10,
    incluirSoloValidacion = true
  ): Observable<ChangeConsolidatedHorasCambioOut> {

    const params = this.construirParametrosAnalisis(
      filtros,
      incluirSoloValidacion
    )
      .set('pagina', String(pagina))
      .set('tamano', String(tamano));

    return this.http.get<ChangeConsolidatedHorasCambioOut>(
      `${this.apiUrl}/horas-por-cambio`,
      { params }
    );
  }


  // BLOQUE 3: Gráfico de horas por resolutor
  obtenerHorasPorResolutor(
    filtros: ChangeConsolidatedDashboardFilters = {},
    incluirSoloValidacion = true
  ): Observable<ChangeConsolidatedHorasResolutorItem[]> {

    const params = this.construirParametrosAnalisis(
      filtros,
      incluirSoloValidacion
    );

    return this.http.get<ChangeConsolidatedHorasResolutorItem[]>(
      `${this.apiUrl}/horas-por-resolutor`,
      { params }
    );
  }


  // BLOQUE 4: Gráfico de horas mensuales
  obtenerHorasMensuales(
    filtros: ChangeConsolidatedDashboardFilters = {},
    incluirSoloValidacion = true
  ): Observable<ChangeConsolidatedHorasMensualesItem[]> {

    const params = this.construirParametrosAnalisis(
      filtros,
      incluirSoloValidacion
    );

    return this.http.get<ChangeConsolidatedHorasMensualesItem[]>(
      `${this.apiUrl}/horas-mensuales`,
      { params }
    );
  }
    // PRD 06 - Rendimiento mensual paginado por resolutor.
    obtenerRendimientoResolutores(
        filtros: ChangeConsolidatedDashboardFilters = {},
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
        filtros: ChangeConsolidatedDashboardFilters = {},
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
