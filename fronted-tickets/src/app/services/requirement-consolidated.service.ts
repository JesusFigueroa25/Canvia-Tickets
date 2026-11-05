import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RequirementConsolidatedFilters, RequirementConsolidatedDashboardFilters, RequirementConsolidatedKPI, RequirementConsolidatedVolumenItem, RequirementConsolidatedProyectoItem, RequirementConsolidatedTipoItem, RequirementConsolidatedPrioridadItem, RequirementConsolidatedTopProyectos, RequirementConsolidatedPrioridadMensualItem, RequirementConsolidatedTicketsOut } from '../models/requirement-consolidated';
import { ImportResultado } from '../models/import-result';

@Injectable({ providedIn: 'root' })
export class RequirementConsolidatedService {

    private readonly apiUrl = 'api/requirement-consolidated';
    constructor(private http: HttpClient) { }


    private construirParametros(
        filtros: RequirementConsolidatedDashboardFilters = {}
    ): HttpParams {

        let params = new HttpParams();

        // Fecha desde
        if (filtros.desde) {
            params = params.set(
                'desde',
                filtros.desde
            );
        }

        // Fecha hasta
        if (filtros.hasta) {
            params = params.set(
                'hasta',
                filtros.hasta
            );
        }

        // Prioridad
        if (filtros.prioridad) {
            params = params.set(
                'prioridad',
                filtros.prioridad
            );
        }

        // Motivo de estado
        if (filtros.motivo_estado) {
            params = params.set(
                'motivo_estado',
                filtros.motivo_estado
            );
        }

        // Motivo de resolución
        if (filtros.motivo_resolucion) {
            params = params.set(
                'motivo_resolucion',
                filtros.motivo_resolucion
            );
        }

        // Grupo resolutor
        if (filtros.grupo_resolutor) {
            params = params.set(
                'grupo_resolutor',
                filtros.grupo_resolutor
            );
        }

        // Proyecto
        if (filtros.proyecto) {
            params = params.set(
                'proyecto',
                filtros.proyecto
            );
        }

        // Exclusión múltiple de proyectos
        if (filtros.proyectos_excluidos?.length) {

            const proyectos = [
                ...new Set(
                    filtros.proyectos_excluidos
                        .map(proyecto => proyecto.trim())
                        .filter(proyecto => proyecto.length > 0)
                )
            ];

            for (const proyecto of proyectos) {

                params = params.append(
                    'proyectos_excluidos',
                    proyecto
                );

            }
        }

        // Filtro dinámico por mes
        if (filtros.periodo) {
            params = params.set(
                'periodo',
                filtros.periodo
            );
        }

        // Filtro dinámico por múltiples tipos de requerimiento
        if (filtros.tipo_requerimiento?.length) {

            const tiposUnicos = [
                ...new Set(
                    filtros.tipo_requerimiento
                        .map(tipo => tipo.trim())
                        .filter(tipo => tipo.length > 0)
                )
            ];

            for (const tipo of tiposUnicos) {

                params = params.append(
                    'tipo_requerimiento',
                    tipo
                );

            }
        }


        // FILTRO DINÁMICO POR TICKET ID
        if (filtros.ticket_id?.trim()) {
            params = params.set(
                'ticket_id',
                filtros.ticket_id.trim()
            );
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


    obtenerFiltros(): Observable<RequirementConsolidatedFilters> {
        return this.http.get<RequirementConsolidatedFilters>(
            `${this.apiUrl}/filters`
        );
    }

    obtenerKpis(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedKPI> {
        return this.http.get<RequirementConsolidatedKPI>(
            `${this.apiUrl}/kpis`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }
    obtenerVolumenMensual(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedVolumenItem[]> {
        return this.http.get<RequirementConsolidatedVolumenItem[]>(
            `${this.apiUrl}/volumen-mensual`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerProyectos(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedProyectoItem[]> {
        return this.http.get<RequirementConsolidatedProyectoItem[]>(
            `${this.apiUrl}/proyectos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTipos(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedTipoItem[]> {
        return this.http.get<RequirementConsolidatedTipoItem[]>(
            `${this.apiUrl}/tipos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerPrioridades(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedPrioridadItem[]> {
        return this.http.get<RequirementConsolidatedPrioridadItem[]>(
            `${this.apiUrl}/prioridades`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTopProyectos(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedTopProyectos> {
        return this.http.get<RequirementConsolidatedTopProyectos>(
            `${this.apiUrl}/top-proyectos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerPrioridadMensual(filtros: RequirementConsolidatedDashboardFilters = {}): Observable<RequirementConsolidatedPrioridadMensualItem[]> {
        return this.http.get<RequirementConsolidatedPrioridadMensualItem[]>(
            `${this.apiUrl}/prioridad-mensual`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }


    
    obtenerTickets(
        filtros: RequirementConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<RequirementConsolidatedTicketsOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        return this.http.get<RequirementConsolidatedTicketsOut>(
            `${this.apiUrl}/tickets`,
            { params }
        );
    }


}
