
export interface RequirementConsolidatedDashboardFilters {
  desde?: string;
  hasta?: string;
  prioridad?: string;
  motivo_estado?: string;
  motivo_resolucion?: string;
  grupo_resolutor?: string;
  proyecto?: string;
  proyectos_excluidos?: string[];
  periodo?: string;
  tipo_requerimiento?: string[];
  ticket_id?: string;
}


export interface RequirementConsolidatedTicketItem {
  Ticket_ID: string;
  Fecha_Apertura: string;
  Fecha_Resolucion: string | null;
  Fecha_Cierre: string | null;
  Fecha_Ultima_Modificacion: string | null;
  Proyecto: string | null;
  ALP: string | null;
  BU: string | null;
  Grupo_Resolutor: string | null;
  Nombre_Resolutor: string | null;
  Categorizacion_Nivel_1: string | null;
  Categorizacion_Nivel_2: string | null;
  Categorizacion_Nivel_3: string | null;
  Prioridad: string | null;
  Urgencia: string | null;
  Impacto: string | null;
  Estado: string | null;
  Motivo_Estado: string | null;
  Descripcion: string | null;
  Detalle: string | null;
  Fuente_Reportada: string | null;
  Solucion: string | null;
  Motivo_Resolucion: string | null;
}

export interface RequirementConsolidatedTicketsOut {
  tickets: RequirementConsolidatedTicketItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}



export interface RequirementConsolidatedFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  prioridades: string[];
  motivos_estado: string[];
  motivos_resolucion: string[];
  grupos_resolutores?: string[];
  proyectos?: string[];
}

export interface RequirementConsolidatedKPI {
  total_tickets: number;
  total_proyectos: number;
  alta_criticidad: number;
  porcentaje_alta_criticidad: number;
}

export interface RequirementConsolidatedVolumenItem {
  anio: number;
  mes: number;
  periodo: string;
  tickets: number;
}

export interface RequirementConsolidatedProyectoItem {
  proyecto: string;
  cantidad: number;
}

export interface RequirementConsolidatedTipoItem {
  tipo_requerimiento: string;
  cantidad: number;
}

export interface RequirementConsolidatedPrioridadItem {
  prioridad: string;
  cantidad: number;
}

export interface RequirementConsolidatedTopPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}

export interface RequirementConsolidatedTopMesItem {
  periodo: string;
  tickets: number;
}

export interface RequirementConsolidatedTopProyectoItem {
  proyecto: string;
  total_tickets: number;
  mensual: RequirementConsolidatedTopMesItem[];
}


export interface RequirementConsolidatedTopProyectos {
  periodos: RequirementConsolidatedTopPeriodoItem[];
  proyectos: RequirementConsolidatedTopProyectoItem[];
}

export interface RequirementConsolidatedPrioridadMesDetalleItem {
  prioridad: string;
  cantidad: number;
  porcentaje: number;
}

export interface RequirementConsolidatedPrioridadMensualItem {
  anio: number;
  mes: number;
  periodo: string;
  total_tickets: number;
  prioridades: RequirementConsolidatedPrioridadMesDetalleItem[];
}


// ALCANCE 1 - PRODUCTIVIDAD PROMEDIO POR PROYECTO
export type RequirementProductividadGranularidad = 'dia' | 'semana' | 'mes';

export interface RequirementProductividadProyectoItem {
  proyecto: string;
  total_tickets: number;
  promedio_diario: number;
  promedio_semanal: number;
  promedio_mensual: number;
  resolutores_distintos: number;
}

export interface RequirementProductividadResumen {
  total_tickets: number;
  total_proyectos: number;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  dias_calendario: number;
  semanas_calendario: number;
  meses_calendario: number;
}

export interface RequirementProductividadPunto {
  periodo: string;
  tickets: number;
}

export interface RequirementProductividadSerie {
  proyecto: string;
  total_tickets: number;
  puntos: RequirementProductividadPunto[];
}

export interface RequirementProductividadGrafico {
  granularidad: RequirementProductividadGranularidad;
  periodos: string[];
  proyectos: RequirementProductividadSerie[];
}

export interface RequirementProductividadTabla {
  items: RequirementProductividadProyectoItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface RequirementProductividadOut {
  resumen: RequirementProductividadResumen;
  grafico: RequirementProductividadGrafico;
  tabla: RequirementProductividadTabla;
}


// ============================================================
// ALCANCE 2 - DOTACIÓN MENSUAL DE RESOLUTORES
// ============================================================

export interface RequirementDotacionResolutorItem {
  nombre: string;
  tickets: number;
}

export interface RequirementDotacionFila {
  anio: number;
  mes: number;
  periodo: string;
  proyecto: string;
  total_tickets: number;
  resolutores_distintos: number;
  tickets_sin_resolutor: number;
  resolutores: RequirementDotacionResolutorItem[];
}

export interface RequirementDotacionResumen {
  total_tickets: number;
  total_proyectos: number;
  total_resolutores_distintos: number;
  total_proyecto_meses: number;
}

export interface RequirementDotacionPunto {
  periodo: string;
  resolutores: number;
}

export interface RequirementDotacionSerie {
  proyecto: string;
  puntos: RequirementDotacionPunto[];
}

export interface RequirementDotacionGrafico {
  periodos: string[];
  proyectos: RequirementDotacionSerie[];
}

export interface RequirementDotacionTabla {
  items: RequirementDotacionFila[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface RequirementDotacionOut {
  resumen: RequirementDotacionResumen;
  grafico: RequirementDotacionGrafico;
  tabla: RequirementDotacionTabla;
}


// ============================================================
// ALCANCE 3 - ATENCIÓN PARALELA DE REQUERIMIENTOS
// ============================================================

export interface RequirementAtencionParalelaResumen {
  tickets_evaluados: number;
  tickets_con_superposicion: number;
  resolutores_con_superposicion: number;
  total_eventos: number;
  maximo_simultaneos: number;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  metodologia: string;
}

export interface RequirementAtencionParalelaGraficoItem {
  resolutor: string;
  eventos: number;
  tickets_con_superposicion: number;
  maximo_simultaneos: number;
}

export interface RequirementAtencionParalelaDetalleItem {
  ticket_id: string;
  proyecto: string;
  resolutor: string;
  fecha_apertura: string;
  fecha_resolucion: string;
  inicio_coincidencia: string;
  fin_coincidencia: string;
  tickets_simultaneos: number;
  tickets_coincidentes: string[];
}

export interface RequirementAtencionParalelaTabla {
  items: RequirementAtencionParalelaDetalleItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface RequirementAtencionParalelaOut {
  resumen: RequirementAtencionParalelaResumen;
  grafico: RequirementAtencionParalelaGraficoItem[];
  tabla: RequirementAtencionParalelaTabla;
}



// ============================================================
// ALCANCE 4 - TICKETS CON REGISTROS DE ACTUALIZACIÓN MANUAL
// ============================================================
// El resolutor corresponde al asignado en el reporte manual;
// no necesariamente a quien realizó la modificación.
export interface RequirementActualizacionesManualesResumen {
  total_tickets: number;
  total_resolutores: number;
  total_grupos: number;
  total_proyectos: number;
  tickets_sin_resolutor: number;
}

export interface RequirementActualizacionesManualesItem {
  grupo_resolutor: string;
  resolutor: string;
  tickets: number;
  proyectos: number;
  porcentaje: number;
}

export interface RequirementActualizacionesManualesTabla {
  items: RequirementActualizacionesManualesItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface RequirementActualizacionesManualesOut {
  resumen: RequirementActualizacionesManualesResumen;
  grafico: RequirementActualizacionesManualesItem[];
  tabla: RequirementActualizacionesManualesTabla;
}
