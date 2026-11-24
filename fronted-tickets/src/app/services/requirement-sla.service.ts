import { Injectable } from '@angular/core';
import { ResolutorRendimientoOut, ResolutorTicketsPorResolutorOut } from '../models/resolutor-dashboard';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RequirementSLADashboardFilters, RequirementSLAKPI, RequirementSLAFilters, RequirementSLASolucionTendenciaItem, RequirementSLAVolumenItem, RequirementSLAProyectoItem, RequirementSLAParticipacionProyectoItem, RequirementSLAParetoItem, RequirementSLATendenciaItem, RequirementSLAResolutorItem, RequirementSLAExploradorTiposOut, RequirementSLACondicionDiaOut, RequirementSLACumplimientoOut, RequirementSLACumplimientoHorarioOut, RequirementSLACumplimientoPrioridadOut, RequirementSLATop10CategoriaOut, RequirementSLACumplimientoTipoOut, RequirementSLAParetoCategoriaOut, RequirementSLAParetoGraficoOut, RequirementSLATicketsOut } from '../models/requirement-sla';
import { ImportResultado } from '../models/import-result';

@Injectable({
    providedIn: 'root'
})
export class RequirementSlaService {

    private servidor = 'api';
    private recurso = 'requirement-sla';
    constructor(private http: HttpClient) { }

    private construirParametros(filtros?: RequirementSLADashboardFilters): HttpParams {

        let params = new HttpParams();

        if (!filtros) { return params; }

        if (filtros.desde) {
            params = params.set('desde', filtros.desde);
        }

        if (filtros.hasta) {
            params = params.set('hasta', filtros.hasta);
        }

        if (filtros.grupo_resolutor) {
            params = params.set('grupo_resolutor', filtros.grupo_resolutor);
        }

        if (filtros.prioridad) {
            params = params.set('prioridad', filtros.prioridad);
        }

        if (filtros.categoria) {
            params = params.set('categoria', filtros.categoria);
        }

        if (filtros.proyecto) {
            params = params.set('proyecto', filtros.proyecto);
        }


        // EXCLUSION MULTIPLE DE PROYECTOS
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

        if (filtros.condicion_dia) {
            params = params.set('condicion_dia', filtros.condicion_dia);
        }


        if (filtros.periodo) {
            params = params.set(
                'periodo',
                filtros.periodo
            );
        }

        if (filtros.sla_solucion_condicion) {
            params = params.set('sla_solucion_condicion', filtros.sla_solucion_condicion);
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
            `${this.servidor}/${this.recurso}/import`,
            formData
        );
    }


    obtenerFiltros(): Observable<RequirementSLAFilters> {
        return this.http.get<RequirementSLAFilters>(
            `${this.servidor}/${this.recurso}/filters`
        );
    }

    obtenerKpis(filtros?: RequirementSLADashboardFilters): Observable<RequirementSLAKPI> {
        const params = this.construirParametros(filtros);
        return this.http.get<RequirementSLAKPI>(
            `${this.servidor}/${this.recurso}/kpis`,
            { params }
        );
    }


    obtenerSlaSolucionTendencia(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLASolucionTendenciaItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLASolucionTendenciaItem[]>(
            `${this.servidor}/${this.recurso}/sla-solucion-tendencia`,
            { params }
        );
    }


    obtenerVolumenRequerimientos(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAVolumenItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAVolumenItem[]>(
            `${this.servidor}/${this.recurso}/volumen-requerimientos`,
            { params }
        );
    }


    obtenerProyectos(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAProyectoItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAProyectoItem[]>(
            `${this.servidor}/${this.recurso}/proyectos`,
            { params }
        );
    }

    obtenerParticipacionProyectos(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAParticipacionProyectoItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAParticipacionProyectoItem[]>(
            `${this.servidor}/${this.recurso}/participacion-proyectos`,
            { params }
        );
    }

    obtenerParetoRequerimientos(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAParetoItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAParetoItem[]>(
            `${this.servidor}/${this.recurso}/pareto-requerimientos`,
            { params }
        );
    }

    obtenerTendenciaRequerimientos(
        rankingDesde: number = 1,
        rankingHasta: number = 2,
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLATendenciaItem[]> {

        let params = this.construirParametros(filtros);

        params = params.set(
            'ranking_desde',
            rankingDesde.toString()
        );

        params = params.set(
            'ranking_hasta',
            rankingHasta.toString()
        );

        return this.http.get<RequirementSLATendenciaItem[]>(
            `${this.servidor}/${this.recurso}/tendencia-requerimientos`,
            { params }
        );
    }

    obtenerResolutores(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAResolutorItem[]> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAResolutorItem[]>(
            `${this.servidor}/${this.recurso}/resolutores`,
            { params }
        );
    }


    obtenerExploradorTipos(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAExploradorTiposOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAExploradorTiposOut>(
            `${this.servidor}/${this.recurso}/explorador-tipos`,
            { params }
        );
    }


    obtenerDistribucionCondicionDia(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLACondicionDiaOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLACondicionDiaOut>(
            `${this.servidor}/${this.recurso}/distribucion-condicion-dia`,
            { params }
        );
    }

    obtenerPorcentajeCumplimientoSla(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLACumplimientoOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLACumplimientoOut>(
            `${this.servidor}/${this.recurso}/porcentaje-cumplimiento-sla`,
            { params }
        );
    }

    obtenerCumplimientoSlaHorario(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLACumplimientoHorarioOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLACumplimientoHorarioOut>(
            `${this.servidor}/${this.recurso}/cumplimiento-sla-horario`,
            { params }
        );
    }

    obtenerCumplimientoSlaPrioridad(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLACumplimientoPrioridadOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLACumplimientoPrioridadOut>(
            `${this.servidor}/${this.recurso}/cumplimiento-sla-prioridad`,
            { params }
        );
    }


    obtenerTop10CumplimientoSlaCategoria(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLATop10CategoriaOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLATop10CategoriaOut>(
            `${this.servidor}/${this.recurso}/top10-cumplimiento-sla-categoria`,
            { params }
        );
    }

    obtenerCumplimientoSlaTipo(
        filtros?: RequirementSLADashboardFilters,
        limite: number = 15
    ): Observable<RequirementSLACumplimientoTipoOut> {

        let params = this.construirParametros(filtros);

        params = params.set(
            'limite',
            limite.toString()
        );

        return this.http.get<RequirementSLACumplimientoTipoOut>(
            `${this.servidor}/${this.recurso}/cumplimiento-sla-tipo`,
            { params }
        );
    }

    obtenerParetoSlaCategorias(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAParetoCategoriaOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAParetoCategoriaOut>(
            `${this.servidor}/${this.recurso}/pareto-sla-categorias`,
            { params }
        );
    }

    obtenerParetoSlaCategoriasGrafico(
        filtros?: RequirementSLADashboardFilters
    ): Observable<RequirementSLAParetoGraficoOut> {

        const params = this.construirParametros(filtros);

        return this.http.get<RequirementSLAParetoGraficoOut>(
            `${this.servidor}/${this.recurso}/pareto-sla-categorias-grafico`,
            { params }
        );
    }


    

    obtenerTickets(
        filtros: RequirementSLADashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<RequirementSLATicketsOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        return this.http.get<RequirementSLATicketsOut>(
            `${this.servidor}/${this.recurso}/tickets`,
            { params }
        );
    }
    // PRD 06 - Rendimiento mensual paginado por resolutor.
    obtenerRendimientoResolutores(
        filtros: RequirementSLADashboardFilters = {},
        pagina: number = 1,
        tamano: number = 20
    ): Observable<ResolutorRendimientoOut> {
        const params = this.construirParametros(filtros)
            .set('pagina', String(pagina))
            .set('tamano', String(tamano));

        return this.http.get<ResolutorRendimientoOut>(
            `${this.servidor}/${this.recurso}/rendimiento-resolutores`,
            { params }
        );
    }

    // PRD 06 - Ranking de tickets por resolutor (Top 5/10/15/20).
    obtenerTicketsPorResolutor(
        filtros: RequirementSLADashboardFilters = {},
        limite: number = 5
    ): Observable<ResolutorTicketsPorResolutorOut> {
        const params = this.construirParametros(filtros)
            .set('tamano', String(limite));

        return this.http.get<ResolutorTicketsPorResolutorOut>(
            `${this.servidor}/${this.recurso}/tickets-por-resolutor`,
            { params }
        );
    }
}
