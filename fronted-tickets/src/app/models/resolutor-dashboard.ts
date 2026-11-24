/** Contratos comunes de los dashboards de Resolutores (PRD 06). */

export interface ResolutorPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}

export interface ResolutorMesItem {
  periodo: string;
  tickets: number;
}

export interface ResolutorRendimientoItem {
  nombre_resolutor: string;
  total_tickets: number;
  mensual: ResolutorMesItem[];
}

/** Tabla paginada: GET /rendimiento-resolutores */
export interface ResolutorRendimientoOut {
  periodos: ResolutorPeriodoItem[];
  resolutores: ResolutorRendimientoItem[];
  totales_mensuales: ResolutorMesItem[];
  total_general: number;
  total_resolutores: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

/** Gráfico Top: GET /tickets-por-resolutor */
export interface ResolutorTicketsPorResolutorOut {
  total_general: number;
  limite: number;
  periodos: ResolutorPeriodoItem[];
  resolutores: ResolutorRendimientoItem[];
}
