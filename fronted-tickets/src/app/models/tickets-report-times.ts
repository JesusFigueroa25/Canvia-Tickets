
export interface TicketsReportTimesDashboardFilters {
  desde?: string;
  hasta?: string;
  grupo_resolutor?: string | null;
  periodo?: string;
  proyectos?: string[];
  todos_proyectos?: boolean;
}

export interface TicketsReportTimesFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  grupos_resolutores: string[];
  proyectos: string[];
  proyectos_predeterminados: string[];
}

export interface TicketsReportTimesKPI {
  total_tickets: number;
  total_proyectos: number;
  alta_criticidad: number;
  porcentaje_alta_criticidad: number;
}

export interface TicketsReportTimesVolumenItem {
  anio: number;
  mes: number;
  periodo: string;
  tickets: number;
  acciones: number;
  horas_totales: number;
}

export interface TicketsReportTimesResumen {
  tickets_distintos: number;
  acciones: number;
  horas_totales: number;
  proyectos_distintos: number;
  resolutores_distintos: number;
}

export interface TicketsReportTimesResolverItem {
  anio: number;
  mes: number;
  periodo: string;
  resolutor: string;
  tickets: number;
  acciones: number;
  horas_totales: number;
}

export interface TicketsReportTimesProjectItem {
  anio: number;
  mes: number;
  periodo: string;
  proyecto: string;
  tickets: number;
  acciones: number;
  resolutores_distintos: number;
  horas_totales: number;
}

export interface TicketsReportTimesTabla<T> {
  resumen: TicketsReportTimesResumen;
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export type TicketsReportTimesResolverTabla =
  TicketsReportTimesTabla<TicketsReportTimesResolverItem>;

export type TicketsReportTimesProjectTabla =
  TicketsReportTimesTabla<TicketsReportTimesProjectItem>;

export interface TicketsReportTimesGraficoPunto {
  periodo: string;
  horas: number;
}

export interface TicketsReportTimesGraficoSerie {
  nombre: string;
  horas_totales: number;
  mensual: TicketsReportTimesGraficoPunto[];
}

export interface TicketsReportTimesGrafico {
  periodos: string[];
  series: TicketsReportTimesGraficoSerie[];
  limite: number;
}

export interface TicketsReportTimesImportResult {
  tipo: 'tickets_report_times';
  tabla_staging: 'stg_tickets_report_times';
  tabla_destino: 'tickets_report_times';
  lote_id: string;
  filas_excel: number;
  filas_procesadas: number;
  filas_staging: number;
  filas_rechazadas: number;
  nuevos: number;
  modificados: number;
  sin_cambios: number;
  tickets_distintos: number;
  total_acciones: number;
  mensaje: string;
}
