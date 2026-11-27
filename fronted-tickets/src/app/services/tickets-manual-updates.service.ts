import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    TicketsManualUpdatesImportOut,
    TipoTicketParalelo,
    TicketsParallelDashboardFilters,
    TicketsParallelFilters,
    TicketsParallelKPI,
    TicketsParallelMonthlyItem,
    TicketsParallelResolverItem,
    TicketsParallelResolverPage,
    TicketsParallelProjectItem,
    TicketsParallelProjectPage,
    TicketsParallelTicketsOut,
    TicketsParallelDetailOut
} from '../models/tickets-manual-updates';

@Injectable({ providedIn: 'root' })
export class TicketsManualUpdatesService {

    private readonly apiUrl = 'api/tickets-manual-updates';

    constructor(private http: HttpClient) { }

    private construirParametros(
        filtros: TicketsParallelDashboardFilters = {}
    ): HttpParams {
        let params = new HttpParams();

        if (filtros.desde) {
            params = params.set('desde', filtros.desde);
        }
        if (filtros.hasta) {
            params = params.set('hasta', filtros.hasta);
        }
        // Omitir usa el grupo predeterminado del backend; vacío consulta todos.
        if (filtros.grupo_resolutor !== undefined) {
            params = params.set('grupo_resolutor', filtros.grupo_resolutor ?? '');
        }
        if (filtros.prioridad?.trim()) {
            params = params.set('prioridad', filtros.prioridad.trim());
        }
        if (filtros.motivo?.trim()) {
            params = params.set('motivo', filtros.motivo.trim());
        }
        if (filtros.ticket_type) {
            params = params.set('ticket_type', filtros.ticket_type);
        }
        params = params.set('todos_proyectos', String(filtros.todos_proyectos ?? false));

        const proyectos = [...new Set(
            (filtros.proyectos ?? []).map(proyecto => proyecto.trim()).filter(Boolean)
        )];
        for (const proyecto of proyectos) {
            params = params.append('proyectos', proyecto);
        }
        return params;
    }

    private construirPaginacion(params: HttpParams, pagina: number, tamano: number): HttpParams {
        return params.set('pagina', pagina.toString()).set('tamano', tamano.toString());
    }

    importarExcel(archivo: File): Observable<TicketsManualUpdatesImportOut> {
        const formData = new FormData();
        formData.append('archivo', archivo, archivo.name);

        return this.http.post<TicketsManualUpdatesImportOut>(
            `${this.apiUrl}/import`,
            formData
        );
    }

    obtenerFiltros(
        grupoResolutor: string | null = 'BASE DE DATOS Y EBS',
        filtros: TicketsParallelDashboardFilters = {}
    ): Observable<TicketsParallelFilters> {
        const params = this.construirParametros({ ...filtros, grupo_resolutor: grupoResolutor });
        return this.http.get<TicketsParallelFilters>(`${this.apiUrl}/filters`, { params });
    }

    obtenerKpis(filtros: TicketsParallelDashboardFilters = {}): Observable<TicketsParallelKPI> {
        return this.http.get<TicketsParallelKPI>(`${this.apiUrl}/kpis`, {
            params: this.construirParametros(filtros)
        });
    }

    obtenerResumenEjecutivoMensual(
        filtros: TicketsParallelDashboardFilters = {}
    ): Observable<TicketsParallelMonthlyItem[]> {
        return this.http.get<TicketsParallelMonthlyItem[]>(`${this.apiUrl}/resumen-ejecutivo-mensual`, {
            params: this.construirParametros(filtros)
        });
    }

    /** Conjunto completo para gráficos, rankings y filtros locales. */
    obtenerParalelosResolutores(
        filtros: TicketsParallelDashboardFilters = {}
    ): Observable<TicketsParallelResolverItem[]> {
        return this.http.get<TicketsParallelResolverItem[]>(`${this.apiUrl}/paralelos-resolutores`, {
            params: this.construirParametros(filtros)
        });
    }

    obtenerParalelosResolutoresPaginados(
        filtros: TicketsParallelDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<TicketsParallelResolverPage> {
        const params = this.construirPaginacion(this.construirParametros(filtros), pagina, tamano);
        return this.http.get<TicketsParallelResolverPage>(`${this.apiUrl}/paralelos-resolutores`, { params });
    }

    obtenerParalelosTickets(
        filtros: TicketsParallelDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 25,
        tipoTicketLocal: TipoTicketParalelo | null = null,
        resolutorBusqueda: string = ''
    ): Observable<TicketsParallelTicketsOut> {

        let params = this.construirPaginacion(
            this.construirParametros(filtros),
            pagina,
            tamano
        );

        if (tipoTicketLocal) {
            params = params.set(
                'tipo_ticket_local',
                tipoTicketLocal
            );
        }

        if (resolutorBusqueda.trim()) {
            params = params.set(
                'resolutor_busqueda',
                resolutorBusqueda.trim()
            );
        }

        return this.http.get<TicketsParallelTicketsOut>(
            `${this.apiUrl}/paralelos-tickets`,
            { params }
        );
    }

    /** La identidad del detalle es ticket + tipo + resolutor. */
    obtenerDetalleTicketParalelo(
        ticketId: string,
        tipoTicket: TipoTicketParalelo,
        resolutor: string,
        filtros: TicketsParallelDashboardFilters = {}
    ): Observable<TicketsParallelDetailOut> {
        const params = this.construirParametros(filtros)
            .set('tipo_ticket', tipoTicket)
            .set('resolutor', resolutor);
        return this.http.get<TicketsParallelDetailOut>(
            `${this.apiUrl}/paralelos-tickets/${encodeURIComponent(ticketId)}/detalle`,
            { params }
        );
    }

    /** Conjunto completo para gráficos y filtros locales por nombre o ALP. */
    obtenerParalelosProyectos(
        filtros: TicketsParallelDashboardFilters = {}
    ): Observable<TicketsParallelProjectItem[]> {
        return this.http.get<TicketsParallelProjectItem[]>(`${this.apiUrl}/paralelos-proyectos`, {
            params: this.construirParametros(filtros)
        });
    }

    obtenerParalelosProyectosPaginados(
        filtros: TicketsParallelDashboardFilters = {},
        pagina: number = 1,
        tamano: number = 10
    ): Observable<TicketsParallelProjectPage> {
        const params = this.construirPaginacion(this.construirParametros(filtros), pagina, tamano);
        return this.http.get<TicketsParallelProjectPage>(`${this.apiUrl}/paralelos-proyectos`, { params });
    }
}
