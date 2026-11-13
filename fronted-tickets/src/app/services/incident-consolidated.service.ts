import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IncidentConsolidatedFilters, IncidentConsolidatedDashboardFilters, IncidentConsolidatedKPI, IncidentConsolidatedVolumenItem, IncidentConsolidatedProyectoItem, IncidentConsolidatedTipoItem, IncidentConsolidatedPrioridadItem, IncidentConsolidatedTopProyectos, IncidentConsolidatedPrioridadMensualItem, IncidentConsolidatedRendimientoOut, IncidentConsolidatedExploradorDescripcionesOut, IncidentConsolidatedDetalleEventosOut, IncidentConsolidatedIncidentesPorcentajesOut, IncidentConsolidatedTopDescripcionProyectoOut, IncidentConsolidatedTopDetallesOut, IncidentConsolidatedTicketsPorResolutorOut, IncidentConsolidatedTicketsOut } from '../models/incident-consolidated';
import { ImportResultado } from '../models/import-result';

import {
    IncidentConsolidatedAtribucionOut,
    IncidentConsolidatedTopServidoresOut,
    IncidentConsolidatedAnalisisCausasOut,
    IncidentConsolidatedDistribucionAjustadaOut,
    IncidentConsolidatedPrincipalesHallazgosOut,
    IncidentConsolidatedConclusionesOut
} from '../models/incident-consolidated';




@Injectable({ providedIn: 'root' })
export class IncidentConsolidatedService {
    private readonly apiUrl = 'api/incident-consolidated';

    constructor(private http: HttpClient) { }
    private construirParametros(filtros: IncidentConsolidatedDashboardFilters = {}): HttpParams {
        let params = new HttpParams();
        if (filtros.desde) {
            params = params.set(
                'desde',
                filtros.desde
            );
        }

        if (filtros.hasta) {
            params = params.set(
                'hasta',
                filtros.hasta
            );
        }

        if (filtros.prioridad) {
            params = params.set(
                'prioridad',
                filtros.prioridad
            );
        }

        if (filtros.motivo_estado) {
            params = params.set(
                'motivo_estado',
                filtros.motivo_estado
            );
        }

        if (filtros.motivo_resolucion) {
            params = params.set(
                'motivo_resolucion',
                filtros.motivo_resolucion
            );
        }

        if (filtros.grupo_resolutor) {
            params = params.set(
                'grupo_resolutor',
                filtros.grupo_resolutor
            );
        }

        if (filtros.proyecto) {
            params = params.set(
                'proyecto',
                filtros.proyecto
            );
        }


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


        if (filtros.nombre_resolutor) {
            params = params.set(
                'nombre_resolutor',
                filtros.nombre_resolutor
            );
        }

        if (filtros.descripcion) {
            params = params.set(
                'descripcion',
                filtros.descripcion
            );
        }

        if (filtros.periodo) {
            params = params.set(
                'periodo',
                filtros.periodo
            );
        }

        if (filtros.tipo_incidente?.length) {

            const tipos = [
                ...new Set(
                    filtros.tipo_incidente
                        .map(tipo => tipo.trim())
                        .filter(tipo => tipo.length > 0)
                )
            ];

            for (const tipo of tipos) {

                params = params.append(
                    'tipo_incidente',
                    tipo
                );

            }
        }

        if (filtros.detalle_id) {
            params = params.set(
                'detalle_id',
                filtros.detalle_id
            );
        }

        // FILTRO DINÁMICO POR TICKET ID
        if (filtros.ticket_id) {
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


    obtenerFiltros(): Observable<IncidentConsolidatedFilters> {
        return this.http.get<IncidentConsolidatedFilters>(
            `${this.apiUrl}/filters`
        );
    }

    obtenerKpis(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedKPI> {
        return this.http.get<IncidentConsolidatedKPI>(
            `${this.apiUrl}/kpis`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerVolumenMensual(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedVolumenItem[]> {
        return this.http.get<IncidentConsolidatedVolumenItem[]>(
            `${this.apiUrl}/volumen-mensual`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerProyectos(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedProyectoItem[]> {
        return this.http.get<IncidentConsolidatedProyectoItem[]>(
            `${this.apiUrl}/proyectos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTipos(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedTipoItem[]> {
        return this.http.get<IncidentConsolidatedTipoItem[]>(
            `${this.apiUrl}/tipos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }


    obtenerPrioridades(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedPrioridadItem[]> {
        return this.http.get<IncidentConsolidatedPrioridadItem[]>(
            `${this.apiUrl}/prioridades`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTopProyectos(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedTopProyectos> {
        return this.http.get<IncidentConsolidatedTopProyectos>(
            `${this.apiUrl}/top-proyectos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerPrioridadMensual(filtros: IncidentConsolidatedDashboardFilters = {}): Observable<IncidentConsolidatedPrioridadMensualItem[]> {
        return this.http.get<IncidentConsolidatedPrioridadMensualItem[]>(
            `${this.apiUrl}/prioridad-mensual`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerRendimientoResolutores(
        filtros: IncidentConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 20
    ): Observable<IncidentConsolidatedRendimientoOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        return this.http.get<IncidentConsolidatedRendimientoOut>(
            `${this.apiUrl}/rendimiento-resolutores`,
            { params }
        );
    }


    obtenerExploradorDescripciones(
        filtros: IncidentConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 20,
        buscar?: string
    ): Observable<IncidentConsolidatedExploradorDescripcionesOut> {

        let params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        if (buscar?.trim()) {
            params = params.set('buscar', buscar.trim());
        }

        return this.http.get<IncidentConsolidatedExploradorDescripcionesOut>(
            `${this.apiUrl}/explorador-descripciones`,
            { params }
        );
    }


    obtenerDetalleEventosTecnicos(
        filtros: IncidentConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 20,
        buscar?: string
    ): Observable<IncidentConsolidatedDetalleEventosOut> {

        let params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        if (buscar?.trim()) {
            params = params.set('buscar', buscar.trim());
        }

        return this.http.get<IncidentConsolidatedDetalleEventosOut>(
            `${this.apiUrl}/detalle-eventos-tecnicos`,
            { params }
        );
    }


    obtenerIncidentesPorcentajes(
        filtros: IncidentConsolidatedDashboardFilters = {},
        limite: number = 20
    ): Observable<IncidentConsolidatedIncidentesPorcentajesOut> {

        const params = this.construirParametros(filtros)
            .set('limite', limite.toString());

        return this.http.get<IncidentConsolidatedIncidentesPorcentajesOut>(
            `${this.apiUrl}/incidentes-porcentajes`,
            { params }
        );
    }


    obtenerTopDescripcionesProyectos(
        filtros: IncidentConsolidatedDashboardFilters = {}
    ): Observable<IncidentConsolidatedTopDescripcionProyectoOut> {

        return this.http.get<IncidentConsolidatedTopDescripcionProyectoOut>(
            `${this.apiUrl}/top-descripciones-proyectos`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTopDetalles(
        filtros: IncidentConsolidatedDashboardFilters = {}
    ): Observable<IncidentConsolidatedTopDetallesOut> {

        return this.http.get<IncidentConsolidatedTopDetallesOut>(
            `${this.apiUrl}/top-detalles`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }

    obtenerTicketsPorResolutor(
        filtros: IncidentConsolidatedDashboardFilters = {},
        limite: number = 5
    ): Observable<IncidentConsolidatedTicketsPorResolutorOut> {

        const params = this.construirParametros(filtros)
            .set('tamano', limite.toString());

        return this.http.get<IncidentConsolidatedTicketsPorResolutorOut>(
            `${this.apiUrl}/tickets-por-resolutor`,
            { params }
        );

    }


    obtenerTickets(
        filtros: IncidentConsolidatedDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<IncidentConsolidatedTicketsOut> {

        const params = this.construirParametros(filtros)
            .set('pagina', pagina.toString())
            .set('tamano', tamano.toString());

        return this.http.get<IncidentConsolidatedTicketsOut>(
            `${this.apiUrl}/tickets`,
            { params }
        );
    }





    // 1. DISTRIBUCION POR ATRIBUCION ORIGINAL
    obtenerAtribucionIncidentes(
        filtros: IncidentConsolidatedDashboardFilters = {}
    ): Observable<IncidentConsolidatedAtribucionOut> {

        return this.http.get<IncidentConsolidatedAtribucionOut>(
            `${this.apiUrl}/atribucion-incidentes`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }



    // 2. TOP DE SERVIDORES CON MAS INCIDENTES
    obtenerTopServidores(
        filtros: IncidentConsolidatedDashboardFilters = {},
        limite: number = 10
    ): Observable<IncidentConsolidatedTopServidoresOut> {

        const params = this.construirParametros(filtros)
            .set('limite', limite.toString());

        return this.http.get<IncidentConsolidatedTopServidoresOut>(
            `${this.apiUrl}/top-servidores`,
            { params }
        );
    }



    // 3. ANALISIS DE CAUSAS V3
    obtenerAnalisisCausas(
        filtros: IncidentConsolidatedDashboardFilters = {}
    ): Observable<IncidentConsolidatedAnalisisCausasOut> {

        return this.http.get<IncidentConsolidatedAnalisisCausasOut>(
            `${this.apiUrl}/analisis-causas`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }



    // 4. DISTRIBUCION AJUSTADA POR ANALISIS DE CAUSA
    obtenerDistribucionAjustadaCausas(
        filtros: IncidentConsolidatedDashboardFilters = {}
    ): Observable<IncidentConsolidatedDistribucionAjustadaOut> {

        return this.http.get<IncidentConsolidatedDistribucionAjustadaOut>(
            `${this.apiUrl}/distribucion-ajustada-causas`,
            {
                params: this.construirParametros(filtros)
            }
        );
    }



    // 5. PRINCIPALES HALLAZGOS
    obtenerPrincipalesHallazgos(
        filtros: IncidentConsolidatedDashboardFilters = {},
        incluirServidores: boolean = false
    ): Observable<IncidentConsolidatedPrincipalesHallazgosOut> {

        const params = this.construirParametros(filtros)
            .set(
                'incluir_servidores',
                incluirServidores.toString()
            );

        return this.http.get<IncidentConsolidatedPrincipalesHallazgosOut>(
            `${this.apiUrl}/principales-hallazgos`,
            { params }
        );
    }



    // 6. CONCLUSIONES
    obtenerConclusiones(
        filtros: IncidentConsolidatedDashboardFilters = {},
        incluirServidores: boolean = false
    ): Observable<IncidentConsolidatedConclusionesOut> {

        const params = this.construirParametros(filtros)
            .set(
                'incluir_servidores',
                incluirServidores.toString()
            );

        return this.http.get<IncidentConsolidatedConclusionesOut>(
            `${this.apiUrl}/conclusiones`,
            { params }
        );
    }




}
