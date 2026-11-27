import { ImportResultado } from './import-result';
export type TicketsManualUpdatesImportOut = ImportResultado & {
    tipo: 'tickets_manual_updates';
    tabla_staging: 'stg_tickets_manual_updates';
    tabla_destino: 'tickets_manual_updates';
    lote_id: string;
    filas_excel: number;
    filas_procesadas: number;
    filas_staging: number;
    duplicados: number;
    nuevos: number;
    modificados: number;
    sin_cambios: number;
    tickets_distintos: number;
    filas_ticket_repetido: number;
    mensaje: string;
};

export type TipoTicketParalelo = 'Incident' | 'Service Request';

/** Fechas YYYY-MM-DD, referidas al intervalo efectivo de atención. */
export interface TicketsParallelDashboardFilters {
    desde?: string | null;
    hasta?: string | null;
    /** undefined: grupo por defecto; null o '': todos los grupos. */
    grupo_resolutor?: string | null;
    prioridad?: string | null;
    motivo?: string | null;
    proyectos?: string[];
    todos_proyectos?: boolean;
    ticket_type?: TipoTicketParalelo | null;
}

export interface TicketsParallelFilters {
    fecha_min: string | null;
    fecha_max: string | null;
    grupos_resolutores: string[];
    prioridades: string[];
    motivos: string[];
    proyectos: string[];
    tipos_ticket: TipoTicketParalelo[];
}

export interface TicketsParallelKPI {
    total_tickets_paralelos: number;
    total_resolutores: number;
    total_proyectos: number;
}

export interface TicketsParallelMonthlyItem {
    periodo: string;
    incidentes_evaluados: number;
    incidentes_paralelos: number;
    requerimientos_evaluados: number;
    requerimientos_paralelos: number;
}

export interface TicketsParallelCountItem {
    periodo: string;
    incidentes_paralelos: number;
    requerimientos_paralelos: number;
    total_paralelos: number;
}

export interface TicketsParallelResolverItem extends TicketsParallelCountItem {
    resolutor: string;
}

export interface TicketsParallelProjectItem extends TicketsParallelCountItem {
    proyecto: string;
    alp: string | null;
}

export interface TicketsParallelTicketItem {
    ticket_id: string;
    ticket_type: TipoTicketParalelo;
    resolutor: string;
    proyecto: string | null;
    alp: string | null;
    prioridad: string | null;
    motivo: string | null;
    descripcion: string | null;
    fuente_metadatos: string;
    otros_tickets_paralelos: number;
    maximo_tickets_simultaneos: number;
    coincidencias: number;
    primera_coincidencia: string;
    ultima_coincidencia: string;
}

/** pagina empieza en 1. La unidad de total depende del endpoint. */
export interface TicketsParallelPage<T> {
    items: T[];
    total: number;
    pagina: number;
    tamano: number;
}

/** total: resolutores distintos, items: todos sus meses de la página. */
export type TicketsParallelResolverPage = TicketsParallelPage<TicketsParallelResolverItem>;
/** total: proyectos distintos por nombre completo, no ALP. */
export type TicketsParallelProjectPage = TicketsParallelPage<TicketsParallelProjectItem>;
/** total: filas ticket-resolutor, no tickets únicos. */
export type TicketsParallelTicketsOut = TicketsParallelPage<TicketsParallelTicketItem>;

export interface TicketsParallelEvidenceItem {
    rol: 'Seleccionado' | 'Relacionado';
    ticket_padre: string;
    ticket_origen: string;
    tipo_origen: string;
    report_time_id: number;
    resolutor_original: string;
    grupo_resolutor: string | null;
    inicio_original: string;
    fin_original: string;
    estado_origen: string | null;
    motivo_origen: string | null;
    descripcion_origen: string | null;
}

export interface TicketsParallelDetailItem {
    ticket_relacionado: string;
    tipo_relacionado: TipoTicketParalelo;
    proyecto_relacionado: string | null;
    alp_relacionado: string | null;
    prioridad_relacionada: string | null;
    motivo_relacionado: string | null;
    descripcion_relacionada: string | null;
    fuente_metadatos: string;
    resolutor: string;
    inicio_paralelo: string;
    fin_paralelo: string;
    segundos_paralelo: number;
    minutos_paralelo: number;
    evidencia: TicketsParallelEvidenceItem[];
}

export interface TicketsParallelDetailOut {
    ticket: TicketsParallelTicketItem;
    coincidencias: TicketsParallelDetailItem[];
}
