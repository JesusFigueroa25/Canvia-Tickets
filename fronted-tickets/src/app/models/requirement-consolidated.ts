
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
