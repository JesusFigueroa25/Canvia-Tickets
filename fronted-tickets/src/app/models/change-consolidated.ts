/** Contratos HTTP del módulo Cambios Consolidados. */

export interface ChangeConsolidatedDashboardFilters {
  desde?: string;
  hasta?: string;
  prioridad?: string;
  motivo?: string;
  grupo_resolutor?: string;
  estado?: string;
  proyecto?: string;
  proyectos_excluidos?: string[];
  periodo?: string;
  tipo_cambio?: string[];
  ticket_id?: string;
  /** Nombre seleccionado en el filtro de resolutor. */
  nombre_resolutor?: string;
}

export interface ChangeConsolidatedFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  prioridades: string[];
  motivos: string[];
  grupos_resolutores: string[];
  estados: string[];
  proyectos: string[];
  tipos_cambio: string[];
  nombres_resolutores: string[];
}

export interface ChangeConsolidatedKPI {
  total_tickets: number;
  total_proyectos: number;
  alta_criticidad: number;
  porcentaje_alta_criticidad: number;
}

export interface ChangeConsolidatedVolumenItem {
  anio: number;
  mes: number;
  periodo: string;
  tickets: number;
}

export interface ChangeConsolidatedProyectoItem {
  proyecto: string;
  cantidad: number;
}

/** Distribución por Tipo_Cambio: Normal, Standard, Emergency, etc. */
export interface ChangeConsolidatedTipoItem {
  tipo_cambio: string;
  cantidad: number;
}

/** Distribución por Categorizacion_Nivel_3. */
export interface ChangeConsolidatedCategoriaItem {
  categoria: string;
  cantidad: number;
}

export interface ChangeConsolidatedPrioridadItem {
  prioridad: string;
  cantidad: number;
}

export interface ChangeConsolidatedTopPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}

export interface ChangeConsolidatedTopMesItem {
  periodo: string;
  tickets: number;
}

export interface ChangeConsolidatedTopProyectoItem {
  proyecto: string;
  total_tickets: number;
  mensual: ChangeConsolidatedTopMesItem[];
}

export interface ChangeConsolidatedTopProyectos {
  periodos: ChangeConsolidatedTopPeriodoItem[];
  proyectos: ChangeConsolidatedTopProyectoItem[];
}

export interface ChangeConsolidatedPrioridadMesDetalleItem {
  prioridad: string;
  cantidad: number;
  porcentaje: number;
}

export interface ChangeConsolidatedPrioridadMensualItem {
  anio: number;
  mes: number;
  periodo: string;
  total_tickets: number;
  prioridades: ChangeConsolidatedPrioridadMesDetalleItem[];
}

export interface ChangeConsolidatedTicketItem {
  Ticket_ID: string;
  Fecha_Creacion: string;
  Fecha_Inicio_Propuesta: string | null;
  Fecha_Fin_Propuesta: string | null;
  Fecha_Inicio_Planificada: string | null;
  Fecha_Fin_Planificada: string | null;
  Fecha_Inicio_Real: string | null;
  Fecha_Fin_Real: string | null;
  Fecha_Ultimo_Worklog: string | null;
  ALP: string | null;
  Proyecto: string | null;
  BU: string | null;
  Grupo_Resolutor: string | null;
  Nombre_Resolutor: string | null;
  Categorizacion_Nivel_1: string | null;
  Categorizacion_Nivel_2: string | null;
  Categorizacion_Nivel_3: string | null;
  Prioridad: string | null;
  Urgencia: string | null;
  Impacto: string | null;
  Phase: string | null;
  Estado: string | null;
  Motivo: string | null;
  Tipo_Cambio: string | null;
  Descripcion: string | null;
  Detalle: string | null;
  Fuente: string | null;
  Valor_Riesgo: number | null;
  Autor_Creacion: string | null;
  Codigo_Cierre_Cambio: string | null;
  Motivo_Cancelacion_Cambio: string | null;
}

export interface ChangeConsolidatedTicketsOut {
  tickets: ChangeConsolidatedTicketItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

// =====================================================
// PRD 05 - ANÁLISIS DE ACTIVIDADES Y HORAS DE CAMBIOS
// =====================================================

// BLOQUE 1: Actividades de bases de datos

export interface ChangeConsolidatedActividadBDItem
  extends ChangeConsolidatedTicketItem {

  Total_Tareas_BD: number;
  Total_Tareas_Wintel: number;

  Tipo_Participacion: string;
  Clasificacion_Evidencia: string;
  Tipo_Actividad: string;

  Es_Subida_Bajada: number;
  Es_Baja_Instancia: number;
  Es_Validacion: number;

  Ticket_Evidencia: string | null;
}

export interface ChangeConsolidatedActividadesBDOut {
  cambios: ChangeConsolidatedActividadBDItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


// BLOQUE 2: Horas totales por cambio

export interface ChangeConsolidatedHorasCambioItem {
  Ticket_ID: string;
  Fecha_Creacion: string;

  ALP: string | null;
  Proyecto: string | null;
  Descripcion: string | null;

  Grupo_Resolutor: string | null;
  Nombre_Resolutor: string | null;
  Estado: string | null;

  Tipo_Participacion: string;
  Tipo_Actividad: string;
  Clasificacion_Evidencia: string;

  Total_Tareas_BD: number;
  Total_Tareas_Wintel: number;

  Registros_Tiempo_BD: number;
  Total_Resolutores_BD: number;

  Horas_Totales: number;
}

export interface ChangeConsolidatedHorasCambioOut {
  cambios: ChangeConsolidatedHorasCambioItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


// BLOQUE 3: Horas totales por resolutor

export interface ChangeConsolidatedHorasResolutorItem {
  Resolutor: string;
  Total_Registros: number;
  Total_Tareas: number;
  Horas_Totales: number | null;
}


// BLOQUE 4: Horas totales por mes

export interface ChangeConsolidatedHorasMensualesItem {
  Anio: number;
  Mes: number;
  Periodo: string;

  Total_Cambios: number;
  Total_Tareas: number;
  Total_Resolutores: number;

  Horas_Totales: number;
  Promedio_Horas_Por_Cambio: number;
}
