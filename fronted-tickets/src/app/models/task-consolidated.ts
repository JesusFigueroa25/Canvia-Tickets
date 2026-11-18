export interface TaskConsolidatedDashboardFilters {
  desde?: string;
  hasta?: string;
  prioridad?: string;
  motivo_estado?: string;
  grupo_resolutor?: string;
  proyecto?: string;
  proyectos_excluidos?: string[];
  periodo?: string;
  tipo_tarea?: string[];
  ticket_id?: string;
}

export interface TaskConsolidatedFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  prioridades: string[];
  motivos_estado: string[];
  grupos_resolutores: string[];
  proyectos: string[];
  tipos_tarea: string[];
}

export interface TaskConsolidatedKPI {
  total_tickets: number;
  total_proyectos: number;
  alta_criticidad: number;
  porcentaje_alta_criticidad: number;
}

export interface TaskConsolidatedVolumenItem {
  anio: number;
  mes: number;
  periodo: string;
  tickets: number;
}

export interface TaskConsolidatedProyectoItem {
  proyecto: string;
  cantidad: number;
}

export interface TaskConsolidatedTipoItem {
  tipo_tarea: string;
  cantidad: number;
}

export interface TaskConsolidatedPrioridadItem {
  prioridad: string;
  cantidad: number;
}

export interface TaskConsolidatedTopPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}

export interface TaskConsolidatedTopMesItem {
  periodo: string;
  tickets: number;
}

export interface TaskConsolidatedTopProyectoItem {
  proyecto: string;
  total_tickets: number;
  mensual: TaskConsolidatedTopMesItem[];
}

export interface TaskConsolidatedTopProyectos {
  periodos: TaskConsolidatedTopPeriodoItem[];
  proyectos: TaskConsolidatedTopProyectoItem[];
}

export interface TaskConsolidatedPrioridadMesDetalleItem {
  prioridad: string;
  cantidad: number;
  porcentaje: number;
}

export interface TaskConsolidatedPrioridadMensualItem {
  anio: number;
  mes: number;
  periodo: string;
  total_tickets: number;
  prioridades: TaskConsolidatedPrioridadMesDetalleItem[];
}

export interface TaskConsolidatedTicketItem {
  Ticket_ID: string;
  Ticket_Padre: string | null;
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
}

export interface TaskConsolidatedTicketsOut {
  tickets: TaskConsolidatedTicketItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}
