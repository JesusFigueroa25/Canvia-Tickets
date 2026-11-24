
export interface RequirementSLADashboardFilters {
    desde?: string;
    hasta?: string;
    grupo_resolutor?: string;
    prioridad?: string;
    categoria?: string;
    proyecto?: string;
    proyectos_excluidos?: string[];
    tipo_requerimiento?: string[];
    condicion_dia?: RequirementSLACondicionDia;
    sla_solucion_condicion?: RequirementSLASolucionCondicion;
    periodo?: string;
    ticket_id?: string;
  /** Nombre seleccionado en el filtro de resolutor. */
  nombre_resolutor?: string;
}


export interface RequirementSLATicketItem {
    Ticket_ID: string;
    Proyecto: string | null;
    Descripcion: string | null;
    Detalle: string | null;
    Fecha_Creacion: string | null;
    Fecha_Resolucion: string | null;
    Estado: string | null;
    Codigo_Motivo: string | null;
    Prioridad: string | null;
    Usuario_Resolutor: string | null;
    Grupo_Resolutor: string | null;
    Categorizacion_Clase: string | null;
    Categorizacion_Categoria: string | null;
    Categorizacion_Tipo: string | null;
    SLA_Respuesta_Condicion: string | null;
    OLA_Respuesta_Condicion: string | null;
    SLA_Solucion_Condicion: string | null;
    OLA_Solucion_Condicion: string | null;
    Condicion_dia: string;
}

export interface RequirementSLATicketsOut {
    tickets: RequirementSLATicketItem[];
    total: number;
    pagina: number;
    tamano: number;
    total_paginas: number;
}



export interface RequirementSLAFilters {
    fecha_min: string | null;
    fecha_max: string | null;
    grupos_resolutores: string[];
    prioridades: string[];
    categorias: string[];
    proyectos?: string[];
    tipos_requerimiento?: string[];
    condiciones_dia?: RequirementSLACondicionDia[];
  nombres_resolutores: string[];
}


export interface RequirementSLAKPI {

    total_tickets: number;
    sla_respuesta: number;
    sla_solucion: number;
    ola_respuesta: number;
    ola_solucion: number;

    cant_req_cumplidos: number;
    cant_req_no_cumplidos: number;
    porcentaje_cumpl_req: number;
}


export interface RequirementSLASolucionTendenciaItem {
    anio: number;
    mes: number;
    periodo: string;
    cumplidos: number;
    incumplidos: number;
}


export interface RequirementSLAVolumenItem {
    anio: number;
    mes: number;
    periodo: string;
    tickets: number;
    tendencia: number;
}

export interface RequirementSLAProyectoItem {
    proyecto: string | null;
    tickets: number;
    medibles: number;
    sin_medicion: number;
    cumple: number;
    incumple: number;
    sla_solucion: number;
    sla_respuesta: number;
    porcentaje_volumen: number;
}

export interface RequirementSLAParticipacionProyectoItem {
    proyecto: string | null;
    tickets: number;
    participacion: number;
}

export interface RequirementSLAParetoItem {
    ranking: number;
    tipo_requerimiento: string | null;
    cantidad: number;
    porcentaje: number;
    porcentaje_acumulado: number;
}

export interface RequirementSLATendenciaItem {
    ranking: number;
    tipo_requerimiento: string | null;
    anio: number;
    mes: number;
    periodo: string;
    tickets: number;
}

export interface RequirementSLAResolutorItem {
    resolutor: string | null;
    cantidad: number;
}



export type RequirementSLACondicionDia =
    | 'Lun-Vie'
    | 'Fuera Horario'
    | 'Fin Sem.';

export type RequirementSLASolucionCondicion =
    | 'Cumplido'
    | 'No cumplido';


// GRAFICO 1

export interface RequirementSLAExploradorPeriodo {
    anio: number;
    mes: number;
    periodo: string;
}

export interface RequirementSLAExploradorMetricas {
    tot: number;
    c: number;
    i: number;
    porcentaje_inc: number;
}

export interface RequirementSLAExploradorMensual
    extends RequirementSLAExploradorPeriodo,
    RequirementSLAExploradorMetricas {
}

export interface RequirementSLAExploradorFila {
    tipo_requerimiento: string;
    mensual: RequirementSLAExploradorMensual[];
    total: RequirementSLAExploradorMetricas;
}

export interface RequirementSLAExploradorTotal {
    mensual: RequirementSLAExploradorMensual[];
    total: RequirementSLAExploradorMetricas;
}

export interface RequirementSLAExploradorTiposOut {
    periodos: RequirementSLAExploradorPeriodo[];
    filas: RequirementSLAExploradorFila[];
    total_general: RequirementSLAExploradorTotal;
}


// GRAFICO 2
// DISTRIBUCION POR CONDICION DIA

export interface RequirementSLACondicionDiaItem {
    condicion_dia: string;
    tickets: number;
    porcentaje: number;
}

export interface RequirementSLACondicionDiaOut {
    total_tickets: number;
    distribucion: RequirementSLACondicionDiaItem[];
}


// GRAFICO 3
// PORCENTAJE DE CUMPLIMIENTO SLA

export interface RequirementSLACumplimientoItem {
    condicion: string;
    tickets: number;
    porcentaje: number;
}

export interface RequirementSLACumplimientoOut {
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
    otros: number;
    porcentaje_cumpl_req: number;
    distribucion: RequirementSLACumplimientoItem[];
}


// GRAFICO 4
// CUMPLIMIENTO SLA POR HORARIO

export interface RequirementSLACumplimientoHorarioItem {
    condicion_dia: string;
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
}

export interface RequirementSLACumplimientoHorarioOut {
    total_tickets: number;
    total_cumplidos: number;
    total_incumplidos: number;
    total_cancelados: number;
    distribucion: RequirementSLACumplimientoHorarioItem[];
}


// GRAFICO 5
// CUMPLIMIENTO SLA POR PRIORIDAD

export interface RequirementSLACumplimientoPrioridadItem {
    prioridad: string;
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
}

export interface RequirementSLACumplimientoPrioridadOut {
    total_tickets: number;
    total_cumplidos: number;
    total_incumplidos: number;
    total_cancelados: number;
    distribucion: RequirementSLACumplimientoPrioridadItem[];
}


// GRAFICO 6
// TOP 10 CUMPLIMIENTO SLA POR CATEGORIA

export interface RequirementSLATop10CategoriaItem {
    categoria: string;
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
}

export interface RequirementSLATop10CategoriaOut {
    total_tickets: number;
    total_cumplidos: number;
    total_incumplidos: number;
    total_cancelados: number;
    distribucion: RequirementSLATop10CategoriaItem[];
}


// GRAFICO 7
// CUMPLIMIENTO SLA POR TIPO DE REQUERIMIENTO

export interface RequirementSLACumplimientoTipoItem {
    tipo_requerimiento: string;
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
}

export interface RequirementSLACumplimientoTipoOut {
    total_tickets: number;
    total_cumplidos: number;
    total_incumplidos: number;
    total_cancelados: number;
    distribucion: RequirementSLACumplimientoTipoItem[];
}


// GRAFICO 8
// ANALISIS DE PARETO POR CATEGORIA

export interface RequirementSLAParetoCategoriaItem {
    categoria: string;
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
    ranking: number;
    incumplidos_acumulados: number;
    porcentaje_req: number;
    porcentaje_acumulado: number;
    semaforo: string;
}

export interface RequirementSLAParetoCategoriaTotal {
    total_tickets: number;
    cumplidos: number;
    incumplidos: number;
    cancelados: number;
    incumplidos_acumulados: number;
    porcentaje_req: number;
    porcentaje_acumulado: number;
}

export interface RequirementSLAParetoCategoriaOut {
    total_categorias: number;
    total_general: RequirementSLAParetoCategoriaTotal;
    filas: RequirementSLAParetoCategoriaItem[];
}


// GRAFICO 9
// PARETO GRAFICO POR CATEGORIA

export interface RequirementSLAParetoGraficoItem {
    categoria: string;
    ranking: number;
    cumplidos: number;
    incumplidos: number;
    incumplidos_acumulados: number;
    porcentaje_req: number;
    porcentaje_acumulado: number;
    semaforo: string;
}

export interface RequirementSLAParetoGraficoOut {
    total_categorias: number;
    categorias_con_incumplimientos: number;
    total_incumplimientos: number;
    categorias_para_80: number;
    porcentaje_categorias_para_80: number;
    porcentaje_incumplimientos_cubiertos: number;
    serie: RequirementSLAParetoGraficoItem[];
}
