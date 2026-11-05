

export interface IncidentSLADashboardFilters {
  desde?: string;
  hasta?: string;
  grupo_resolutor?: string;
  prioridad?: string;
  proyecto?: string;
  proyectos_excluidos?: string[];
  tipo_incidente?: string[];
  periodo?: string;

  // FILTRO DINÁMICO POR TICKET ID
  ticket_id?: string;
}


export interface IncidentSLATicketItem {
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

export interface IncidentSLATicketsOut {
  tickets: IncidentSLATicketItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}



export interface IncidentSLAFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  grupos_resolutores: string[];
  prioridades: string[];
  proyectos?: string[];
  tipos_incidente?: string[];
}

export interface IncidentSLAKPI {
  total_tickets: number;
  sla_respuesta: number;
  sla_solucion: number;
  ola_respuesta: number;
  ola_solucion: number;
}

export interface IncidentSLAInsights {
  estado_sla: string;
  principal_foco: string;
  prioridad_vigilar: string;
}

export interface IncidentSLATrendItem {
  mes: string;
  cumplimiento: number;
  objetivo: number;
  medibles: number;
}

export interface IncidentSLAVolumenItem {
  mes: string;
  tickets: number;
  media_movil_3m: number | null;
}

export interface IncidentSLAProyectoItem {
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

export interface IncidentSLAParetoItem {
  ranking: number;
  tipo_incidente: string | null;
  tickets: number;
  porcentaje: number;
  porcentaje_acumulado: number;
}
export interface IncidentSLATendenciaPunto {
  mes: string;
  tickets: number;
}

export interface IncidentSLATendenciaSerie {
  ranking: number;
  tipo_incidente: string | null;
  puntos: IncidentSLATendenciaPunto[];
}

export interface IncidentSLATendencia {
  grupo: string;
  series: IncidentSLATendenciaSerie[];
}

export interface IncidentSLAResolutorItem {
  resolutor: string | null;
  tickets: number;
  sla: number;
}


