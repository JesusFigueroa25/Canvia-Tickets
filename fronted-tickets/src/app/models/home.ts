/* HOME - KPIs PRINCIPALES */
export interface HomeKPIs {
  incidentes_consolidados: number;
  incidentes_sla: number;
  requerimientos_consolidados: number;
  requerimientos_sla: number;
  tareas_consolidadas: number;
}


/* HOME - INDICADORES CLAVE */
export interface HomeIndicadoresClave {
  sla_solucion_incidentes: number;
  sla_solucion_requerimientos: number;
  incumplimientos_incidentes: number;
  incumplimientos_requerimientos: number;
}

/* HOME - VOLUMEN MENSUAL */
export interface HomeVolumenMensualItem {
  anio: number;
  mes: number;
  periodo: string;
  incidentes: number | null;
  requerimientos: number | null;
  tareas: number | null;
}


/* HOME - EVOLUCIÓN SLA */
export interface HomeEvolucionSLAItem {
  anio: number;
  mes: number;
  periodo: string;
  incidentes: number | null;
  requerimientos: number | null;
}

/* HOME - GRÁFICOS */
export interface HomeGraficos {
  volumen_mensual: HomeVolumenMensualItem[];
  evolucion_sla: HomeEvolucionSLAItem[];
}

/* HOME - EVOLUCIÓN OPERATIVA */
export interface HomeEvolucionOperativa {
  periodo_actual: string | null;
  periodo_anterior: string | null;
  volumen_actual: number | null;
  volumen_anterior: number | null;
  variacion_porcentaje: number | null;
  mensaje: string;
}

/* HOME - CUMPLIMIENTO */
export interface HomeCumplimiento {
  sla_solucion: number;
  objetivo: number;
  diferencia_pp: number;
  mensaje: string;
}

/* HOME - FOCO DE ATENCIÓN */
export interface HomeFocoAtencion {
  proyecto: string | null;
  incumplimientos_incidentes: number;
  incumplimientos_requerimientos: number;
  total_incumplimientos: number;
  porcentaje_total: number;
  mensaje: string;
}

/* HOME - RESUMEN EJECUTIVO */
export interface HomeResumenEjecutivo {
  evolucion_operativa: HomeEvolucionOperativa;
  cumplimiento: HomeCumplimiento;
  foco_atencion: HomeFocoAtencion;
}

/* HOME - RESPUESTA GENERAL */
export interface HomeResumen {
  kpis: HomeKPIs;
  indicadores_clave: HomeIndicadoresClave;
  graficos: HomeGraficos;
  resumen_ejecutivo: HomeResumenEjecutivo;
}
