
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    AUDIT_GROUP_ID,
    AuditRunCreate,
    AuditRun,
    AuditSummary,
    AuditDashboardFilters,
    AuditTicketFilters,
    AuditTicketList,
    AuditResolverList,
    AuditCategoryList,
    AuditMonthlyStats,
    AuditResolutionReasonList,
    AuditFilterOptions
} from '../models/requirement-categorization-audit';


@Injectable({
    providedIn: 'root'
})
export class RequirementCategorizationAuditService {

    private readonly apiUrl = 'api/requirement-categorization-audit';
    constructor(private http: HttpClient) { }

    // 1. CONSTRUCCIÓN DE PARÁMETROS GENERALES
    private construirParametrosGenerales(runId?: number, grupoResolutor?: string): HttpParams {
        let params = new HttpParams();

        if (runId !== undefined && runId !== null) {
            params = params.set(
                'run_id',
                runId.toString()
            );
        }

        if (grupoResolutor?.trim()) {
            params = params.set(
                'grupo_resolutor',
                grupoResolutor.trim()
            );
        }

        return params;
    }


    // 2. CONSTRUCCIÓN DE FILTROS DE TICKETS

    private construirParametrosTickets(
        filtros: AuditTicketFilters = {}
    ): HttpParams {

        let params = this.construirParametrosDashboard(filtros);

        // Compatibilidad con auditorías individuales.
        if (filtros.run_id !== undefined && filtros.run_id !== null) {
            params = params.set(
                'run_id',
                filtros.run_id.toString()
            );
        }

        // Paginación.
        params = params.set(
            'page',
            (filtros.page ?? 1).toString()
        );

        params = params.set(
            'page_size',
            (filtros.page_size ?? 25).toString()
        );

        return params;
    }




    private construirParametrosDashboard(
        filtros: AuditDashboardFilters = {},
        grupoResolutor?: string
    ): HttpParams {

        let params = new HttpParams();

        // FILTROS GLOBALES

        const grupo = filtros.grupo_resolutor?.trim()
            || grupoResolutor?.trim();

        if (grupo) {
            params = params.set('grupo_resolutor', grupo);
        }

        if (filtros.desde?.trim()) {
            params = params.set('desde', filtros.desde.trim());
        }

        if (filtros.hasta?.trim()) {
            params = params.set('hasta', filtros.hasta.trim());
        }

        if (filtros.proyecto?.trim()) {
            params = params.set('proyecto', filtros.proyecto.trim());
        }

        // FILTROS DINÁMICOS

        if (filtros.resultado) {
            params = params.set('resultado', filtros.resultado);
        }

        if (filtros.motivo_resolucion) {
            params = params.set(
                'motivo_resolucion',
                filtros.motivo_resolucion
            );
        }

        if (filtros.mes?.trim()) {
            params = params.set('mes', filtros.mes.trim());
        }

        if (filtros.nombre_resolutor?.trim()) {
            params = params.set(
                'nombre_resolutor',
                filtros.nombre_resolutor.trim()
            );
        }

        if (filtros.ticket_id?.trim()) {
            params = params.set('ticket_id', filtros.ticket_id.trim());
        }

        return params;
    }



    crearEjecucion(datos: AuditRunCreate): Observable<AuditRun> {
        return this.http.post<AuditRun>(
            `${this.apiUrl}/runs`,
            {
                ...datos,
                group_id: AUDIT_GROUP_ID
            }
        );
    }

    // 4. LISTAR EJECUCIONES
    obtenerEjecuciones(grupoResolutor?: string, limite: number = 50, offset: number = 0): Observable<AuditRun[]> {
        const params = this.construirParametrosGenerales(
            undefined,
            grupoResolutor
        )
            .set('limite', limite.toString())
            .set('offset', offset.toString());

        return this.http.get<AuditRun[]>(
            `${this.apiUrl}/runs`,
            { params }
        );
    }


    // 5. OBTENER UNA EJECUCIÓN POR ID
    obtenerEjecucion(runId: number, grupoResolutor?: string): Observable<AuditRun> {
        const params = this.construirParametrosGenerales(
            undefined,
            grupoResolutor
        );

        return this.http.get<AuditRun>(
            `${this.apiUrl}/runs/${runId}`,
            { params }
        );
    }


    // 6. OBTENER RESUMEN Y KPIs DE AUDITORÍA
    obtenerResumen(runId?: number, grupoResolutor?: string): Observable<AuditSummary> {
        const params = this.construirParametrosGenerales(
            runId,
            grupoResolutor
        );

        return this.http.get<AuditSummary>(
            `${this.apiUrl}/summary`,
            { params }
        );
    }


    // 7. LISTAR TICKETS EVALUADOS
    obtenerTickets(filtros: AuditTicketFilters = {}): Observable<AuditTicketList> {
        return this.http.get<AuditTicketList>(
            `${this.apiUrl}/tickets`,
            {
                params: this.construirParametrosTickets(filtros)
            }
        );
    }


    // 8. OBTENER RESULTADOS POR RESOLUTOR
    obtenerResolutores(runId?: number, grupoResolutor?: string): Observable<AuditResolverList> {
        const params = this.construirParametrosGenerales(
            runId,
            grupoResolutor
        );

        return this.http.get<AuditResolverList>(
            `${this.apiUrl}/resolvers`,
            { params }
        );
    }


    // 9. OBTENER CATÁLOGO DE CATEGORIZACIONES
    obtenerCategorias(grupoResolutor?: string, limite: number = 200, offset: number = 0): Observable<AuditCategoryList> {
        const params = this.construirParametrosGenerales(
            undefined,
            grupoResolutor
        )
            .set('limite', limite.toString())
            .set('offset', offset.toString());

        return this.http.get<AuditCategoryList>(
            `${this.apiUrl}/categories`,
            { params }
        );
    }


    // 10. HISTORIAL DE EJECUCIONES DE LA AGRUPACIÓN

    obtenerEjecucionesAgrupadas(
        grupoResolutor?: string
    ): Observable<AuditRun[]> {

        const params = this.construirParametrosGenerales(
            undefined,
            grupoResolutor
        );

        return this.http.get<AuditRun[]>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/runs`,
            { params }
        );
    }


    // 11. KPIs ACUMULADOS - TICKETS ÚNICOS


    // 11. KPIs ACUMULADOS CON FILTROS

    obtenerResumenAgrupado(
        grupoResolutor?: string,
        filtros: AuditDashboardFilters = {}
    ): Observable<AuditSummary> {

        const params = this.construirParametrosDashboard(
            filtros,
            grupoResolutor
        );

        return this.http.get<AuditSummary>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/summary`,
            { params }
        );
    }


    // 12. TICKETS ACUMULADOS CON FILTROS Y PAGINACIÓN

    obtenerTicketsAgrupados(
        filtros: AuditTicketFilters = {}
    ): Observable<AuditTicketList> {

        const filtrosAgrupados = { ...filtros };

        // Nunca filtrar el acumulado por una ejecución individual.
        delete filtrosAgrupados.run_id;

        return this.http.get<AuditTicketList>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/tickets`,
            {
                params: this.construirParametrosTickets(
                    filtrosAgrupados
                )
            }
        );
    }


    // 13. RESOLUTORES ACUMULADOS CON FILTROS

    obtenerResolutoresAgrupados(
        grupoResolutor?: string,
        mesOFiltros?: string | AuditDashboardFilters
    ): Observable<AuditResolverList> {

        // Compatible con el uso anterior:
        // obtenerResolutoresAgrupados(grupo, '2026-09')
        //
        // Nuevo uso:
        // obtenerResolutoresAgrupados(grupo, filtros)

        const filtros: AuditDashboardFilters =
            typeof mesOFiltros === 'string'
                ? { mes: mesOFiltros }
                : (mesOFiltros ?? {});

        const params = this.construirParametrosDashboard(
            filtros,
            grupoResolutor
        );

        return this.http.get<AuditResolverList>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/resolvers`,
            { params }
        );
    }


    // 14. ESTADÍSTICAS MENSUALES CON FILTROS

    obtenerEstadisticasMensualesAgrupadas(
        grupoResolutor?: string,
        filtros: AuditDashboardFilters = {}
    ): Observable<AuditMonthlyStats> {

        const params = this.construirParametrosDashboard(
            filtros,
            grupoResolutor
        );

        return this.http.get<AuditMonthlyStats>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/monthly-stats`,
            { params }
        );
    }


    // 15. DISTRIBUCIÓN POR MOTIVO RESOLUCIÓN CON FILTROS

    obtenerMotivosResolucionAgrupados(
        grupoResolutor?: string,
        mesOFiltros?: string | AuditDashboardFilters
    ): Observable<AuditResolutionReasonList> {

        const filtros: AuditDashboardFilters =
            typeof mesOFiltros === 'string'
                ? { mes: mesOFiltros }
                : (mesOFiltros ?? {});

        const params = this.construirParametrosDashboard(
            filtros,
            grupoResolutor
        );

        return this.http.get<AuditResolutionReasonList>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/resolution-reasons`,
            { params }
        );
    }


    // 16. OPCIONES PARA FILTROS GLOBALES Y BUSCADORES

    obtenerOpcionesFiltrosAgrupados(): Observable<AuditFilterOptions> {

        return this.http.get<AuditFilterOptions>(
            `${this.apiUrl}/groups/${AUDIT_GROUP_ID}/filter-options`
        );
    }



}
