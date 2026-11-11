export interface DailyReportDashboardFilters {
  desde?: string;
  hasta?: string;
  grupo_resolutor?: string | null;
  proyecto?: string | null;
}

export interface DailyReportFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  grupos_resolutores: string[];
  proyectos: string[];
}

export interface DailyReportKPI {
  total_tickets: number;
  total_incidentes: number;
  total_requerimientos: number;
  total_tareas: number;
}

export interface DailyReportDiaItem {
  fecha_accion: string;
  total_tickets: number;
  incidentes: number;
  requerimientos: number;
  tareas: number;
}

export interface DailyReportResumen {
  kpis: DailyReportKPI;
  diario: DailyReportDiaItem[];
}
