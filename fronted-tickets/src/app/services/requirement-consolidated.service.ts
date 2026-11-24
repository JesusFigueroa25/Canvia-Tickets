import { Injectable } from '@angular/core';
import { ResolutorRendimientoOut, ResolutorTicketsPorResolutorOut } from '../models/resolutor-dashboard';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RequirementConsolidatedFilters, RequirementConsolidatedDashboardFilters, RequirementConsolidatedKPI, RequirementConsolidatedVolumenItem, RequirementConsolidatedProyectoItem, RequirementConsolidatedTipoItem, RequirementConsolidatedPrioridadItem, RequirementConsolidatedTopProyectos, RequirementConsolidatedPrioridadMensualItem, RequirementConsolidatedTicketsOut, RequirementProductividadGranularidad, RequirementProductividadOut, RequirementDotacionOut, RequirementAtencionParalelaOut, RequirementActualizacionesManualesOut } from '../models/requirement-consolidated';
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


    // ALCANCE 1 - PRODUCTIVIDAD PROMEDIO POR PROYECTO
    obtenerProductividadProyectos(
        filtros: RequirementConsolidatedDashboardFilters = {},
        granularidad: RequirementProductividadGranularidad = 'mes',
        pagina: number = 1,
        tamano: number = 25,
        limiteGrafico: number = 10
    ): Observable<RequirementProductividadOut> {

        const params = this.construirParametros(filtros)
            .set('granularidad', granularidad)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString())
            .set('limite_grafico', limiteGrafico.toString());

        return this.http.get<RequirementProductividadOut>(
            `${this.apiUrl}/productividad-proyectos`,
            { params }
        );
    }


    // ALCANCE 2 - DOTACIÓN MENSUAL DE RESOLUTORES
    obtenerDotacionResolutores(
        filtros: RequirementConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 25,
        limiteGrafico: number = 10
    ): Observable<RequirementDotacionOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString())
            .set('limite_grafico', limiteGrafico.toString());

        return this.http.get<RequirementDotacionOut>(
            `${this.apiUrl}/dotacion-resolutores`,
            { params }
        );
    }


    // ALCANCE 3 - ATENCIÓN PARALELA DE REQUERIMIENTOS
    obtenerAtencionParalela(
        filtros: RequirementConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 25,
        limiteGrafico: number = 10,
        resolutor?: string
    ): Observable<RequirementAtencionParalelaOut> {

        let params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString())
            .set('limite_grafico', limiteGrafico.toString());

        if (resolutor?.trim()) {
            params = params.set(
                'resolutor',
                resolutor.trim()
            );
        }

        return this.http.get<RequirementAtencionParalelaOut>(
            `${this.apiUrl}/atencion-paralela`,
            { params }
        );
    }




    // ALCANCE 4 - TICKETS CON REGISTROS DE ACTUALIZACIÓN MANUAL
    obtenerActualizacionesManuales(
        filtros: RequirementConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 25,
        limiteGrafico: number = 10,
        resolutor?: string
    ): Observable<RequirementActualizacionesManualesOut> {

        let params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString())
            .set('limite_grafico', limiteGrafico.toString());

        if (resolutor?.trim()) {
            params = params.set('resolutor', resolutor.trim());
        }

        return this.http.get<RequirementActualizacionesManualesOut>(
            `${this.apiUrl}/actualizaciones-manuales`,
            { params }
        );
    }
    // PRD 06 - Rendimiento mensual paginado por resolutor.
    obtenerRendimientoResolutores(
        filtros: RequirementConsolidatedDashboardFilters = {},
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
        filtros: RequirementConsolidatedDashboardFilters = {},
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
