import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IncidentSLADashboardFilters, IncidentSLAFilters, IncidentSLAInsights, IncidentSLAKPI, IncidentSLAParetoItem, IncidentSLAProyectoItem, IncidentSLAResolutorItem, IncidentSLATendencia, IncidentSLATicketsOut, IncidentSLATrendItem, IncidentSLAVolumenItem } from '../models/incident-sla';
import { ImportResultado } from '../models/import-result';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class IncidentSlaService {
    servidor: string = "api";
    recurso: string = "incident-sla";
    constructor(private clienteHTTP: HttpClient) { }

    private construirParametros(filtros?: IncidentSLADashboardFilters): HttpParams {

        let params = new HttpParams();

        if (!filtros) { return params; }

        if (filtros.desde) {
            params = params.set("desde", filtros.desde);
        }

        if (filtros.hasta) {
            params = params.set("hasta", filtros.hasta);
        }

        if (filtros.grupo_resolutor) {
            params = params.set("grupo_resolutor", filtros.grupo_resolutor);
        }

        if (filtros.prioridad) {
            params = params.set("prioridad", filtros.prioridad);
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

        /* Filtro dinámico por mes */
        if (filtros.periodo) {
            params = params.set(
                'periodo',
                filtros.periodo
            );
        }

        if (filtros.tipo_incidente?.length) {
            const tiposUnicos = [
                ...new Set(
                    filtros.tipo_incidente
                        .map(tipo => tipo.trim())
                        .filter(tipo => tipo.length > 0)
                )
            ];
            for (const tipo of tiposUnicos) {
                params = params.append(
                    'tipo_incidente',
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

        return this.clienteHTTP.post<ImportResultado>(
            this.servidor + "/" + this.recurso + "/import",
            formData
        );
    }


    obtenerFiltros() {
        return this.clienteHTTP.get<IncidentSLAFilters>(
            this.servidor + "/" + this.recurso + "/filters"
        );
    }

    obtenerKpis(filtros?: IncidentSLADashboardFilters) {
        return this.clienteHTTP.get<IncidentSLAKPI>(
            this.servidor + "/" + this.recurso + "/kpis",
            {
                params: this.construirParametros(filtros)
            }
        );

    }

    obtenerInsights(filtros?: IncidentSLADashboardFilters) {
        return this.clienteHTTP.get<IncidentSLAInsights>(
            this.servidor + "/" + this.recurso + "/insights",
            {
                params: this.construirParametros(filtros)
            }
        );

    }

    obtenerSlaSolucionTendencia(
        filtros?: IncidentSLADashboardFilters
    ) {
        return this.clienteHTTP.get<IncidentSLATrendItem[]>(
            this.servidor + "/" + this.recurso + "/sla-solucion-tendencia",
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerVolumenIncidentes(
        filtros?: IncidentSLADashboardFilters
    ) {
        return this.clienteHTTP.get<IncidentSLAVolumenItem[]>(
            this.servidor + "/" + this.recurso + "/volumen-incidentes",
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerProyectos(filtros?: IncidentSLADashboardFilters) {
        return this.clienteHTTP.get<IncidentSLAProyectoItem[]>(
            this.servidor + "/" + this.recurso + "/proyectos",
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerParetoTipos(filtros?: IncidentSLADashboardFilters) {
        return this.clienteHTTP.get<IncidentSLAParetoItem[]>(
            this.servidor + "/" + this.recurso + "/pareto-tipos",
            {
                params: this.construirParametros(filtros)
            }
        );
    }


    obtenerTendenciaIncidentes(
        filtros?: IncidentSLADashboardFilters
    ) {

        return this.clienteHTTP.get<IncidentSLATendencia>(
            this.servidor + "/" +
            this.recurso + "/tendencia-incidentes",
            {
                params: this.construirParametros(filtros)
            }
        );

    }

    obtenerResolutores(
        filtros?: IncidentSLADashboardFilters
    ) {
        return this.clienteHTTP.get<IncidentSLAResolutorItem[]>(
            this.servidor + "/" + this.recurso + "/resolutores",
            {
                params: this.construirParametros(filtros)
            }
        );
    }



    obtenerTickets(
        filtros: IncidentSLADashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<IncidentSLATicketsOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        return this.clienteHTTP.get<IncidentSLATicketsOut>(
            `${this.servidor}/${this.recurso}/tickets`,
            { params }
        );
    }


}