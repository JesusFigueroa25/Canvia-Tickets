export interface IncidentConsolidatedFilters {
  fecha_min: string | null;
  fecha_max: string | null;
  prioridades: string[];
  motivos_estado: string[];
  motivos_resolucion: string[];
  grupos_resolutores: string[];
  proyectos: string[];
  nombres_resolutores: string[];
  tipos_incidente?: string[];
}


export interface IncidentConsolidatedDashboardFilters {
  desde?: string;
  hasta?: string;
  prioridad?: string;
  motivo_estado?: string;
  motivo_resolucion?: string;
  grupo_resolutor?: string;
  proyecto?: string;
  proyectos_excluidos?: string[];
  nombre_resolutor?: string;
  descripcion?: string;

  // Filtros dinámicos
  periodo?: string;
  tipo_incidente?: string[];
  detalle_id?: string;
  ticket_id?: string;
}



/* ====================================================
   TABLA PAGINADA - DETALLE DE TICKETS
   ==================================================== */

export interface IncidentConsolidatedTicketItem {
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
  Causa: string | null;
  Motivo_Resolucion: string | null;
}

export interface IncidentConsolidatedTicketsOut {
  tickets: IncidentConsolidatedTicketItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}



export interface IncidentConsolidatedKPI {
  total_tickets: number;
  total_proyectos: number;
  alta_criticidad: number;
  porcentaje_alta_criticidad: number;
}

export interface IncidentConsolidatedVolumenItem {
  anio: number;
  mes: number;
  periodo: string;
  tickets: number;
}

export interface IncidentConsolidatedProyectoItem {
  proyecto: string;
  cantidad: number;
}

export interface IncidentConsolidatedTipoItem {
  tipo_incidente: string;
  cantidad: number;
}

export interface IncidentConsolidatedPrioridadItem {
  prioridad: string;
  cantidad: number;
}

export interface IncidentConsolidatedTopPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}

export interface IncidentConsolidatedTopMesItem {
  periodo: string;
  tickets: number;
}

export interface IncidentConsolidatedTopProyectoItem {
  proyecto: string;
  total_tickets: number;
  mensual: IncidentConsolidatedTopMesItem[];
}

export interface IncidentConsolidatedTopProyectos {
  periodos: IncidentConsolidatedTopPeriodoItem[];
  proyectos: IncidentConsolidatedTopProyectoItem[];
}

export interface IncidentConsolidatedPrioridadMesDetalleItem {
  prioridad: string;
  cantidad: number;
  porcentaje: number;
}

export interface IncidentConsolidatedPrioridadMensualItem {
  anio: number;
  mes: number;
  periodo: string;
  total_tickets: number;
  prioridades: IncidentConsolidatedPrioridadMesDetalleItem[];
}


// 1. RENDIMIENTO POR RESOLUTOR
export interface IncidentConsolidatedRendimientoPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}
export interface IncidentConsolidatedRendimientoMesItem {
  periodo: string;
  tickets: number;
}
export interface IncidentConsolidatedRendimientoResolutorItem {
  nombre_resolutor: string;
  total_tickets: number;
  mensual: IncidentConsolidatedRendimientoMesItem[];
}
export interface IncidentConsolidatedRendimientoOut {
  periodos: IncidentConsolidatedRendimientoPeriodoItem[];
  resolutores: IncidentConsolidatedRendimientoResolutorItem[];
  totales_mensuales: IncidentConsolidatedRendimientoMesItem[];
  total_general: number;
  total_resolutores: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


// 2. EXPLORADOR POR DESCRIPCIONES X MES
export interface IncidentConsolidatedExploradorPeriodoItem {
  anio: number;
  mes: number;
  periodo: string;
}
export interface IncidentConsolidatedExploradorMesItem {
  periodo: string;
  tickets: number;
}
export interface IncidentConsolidatedExploradorDescripcionItem {
  descripcion: string;
  total_tickets: number;
  mensual: IncidentConsolidatedExploradorMesItem[];
}
export interface IncidentConsolidatedExploradorDescripcionesOut {
  periodos: IncidentConsolidatedExploradorPeriodoItem[];
  descripciones: IncidentConsolidatedExploradorDescripcionItem[];
  totales_mensuales: IncidentConsolidatedExploradorMesItem[];
  total_general: number;
  total_descripciones: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


// 3. TABLA DETALLE DE EVENTOS TÉCNICOS
export interface IncidentConsolidatedDetalleEventoItem {
  detalle_id: string;
  detalle: string;
  total: number;
}
export interface IncidentConsolidatedDetalleEventosOut {
  detalles: IncidentConsolidatedDetalleEventoItem[];
  total_general: number;
  total_detalles: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}


// 4. NRO DE INCIDENTES X PORCENTAJES
export interface IncidentConsolidatedIncidentesPorcentajeItem {
  descripcion: string;
  cantidad: number;
  porcentaje: number;
}

export interface IncidentConsolidatedIncidentesPorcentajesOut {
  total_general: number;
  limite: number;
  descripciones: IncidentConsolidatedIncidentesPorcentajeItem[];
}

// 5. TOP 10 TICKETS POR DESCRIPCIÓN Y PROYECTO
export interface IncidentConsolidatedTopDescripcionProyectoItem {
  descripcion: string;
  proyecto: string;
  tickets: number;
}
export interface IncidentConsolidatedTopDescripcionProyectoOut {
  total_general: number;
  combinaciones: IncidentConsolidatedTopDescripcionProyectoItem[];
}


// 6. TOP 10 TICKETS POR DETALLE
export interface IncidentConsolidatedTopDetalleItem {
  detalle: string;
  tickets: number;
}
export interface IncidentConsolidatedTopDetallesOut {
  total_general: number;
  detalles: IncidentConsolidatedTopDetalleItem[];
}

// 7. NUMERO DE TICKETS POR RESOLUTOR

export interface IncidentConsolidatedTicketsPorResolutorOut {
  total_general: number;
  limite: number;
  periodos: IncidentConsolidatedRendimientoPeriodoItem[];
  resolutores: IncidentConsolidatedRendimientoResolutorItem[];
}




/* ANALISIS DE INCIDENTES - ATRIBUCION ORIGINAL*/
export interface IncidentConsolidatedAtribucionItem {
  atribucion: string;
  tickets: number;
  porcentaje: number;
}

export interface IncidentConsolidatedAtribucionOut {
  total_tickets: number;
  total_atribuidos: number;
  sin_atribucion: number;
  distribucion: IncidentConsolidatedAtribucionItem[];
}


/* ANALISIS DE INCIDENTES - TOP DE SERVIDORES*/
export interface IncidentConsolidatedServidorItem {
  servidor: string;
  incidentes: number;
  porcentaje: number;
  tickets_ejemplo: string[];
}

export interface IncidentConsolidatedTopServidoresOut {
  total_incidentes: number;
  incidentes_con_servidor: number;
  incidentes_sin_servidor: number;
  total_servidores_identificados: number;
  total_asociaciones: number;
  limite: number;
  servidores: IncidentConsolidatedServidorItem[];
}


/* ANALISIS DE INCIDENTES - ANALISIS DE CAUSAS*/
export interface IncidentConsolidatedCausaEvidenciaItem {
  ticket_id: string;
  campo: string;
  texto: string;
}

export interface IncidentConsolidatedCausaAnalisisItem {
  categoria: string;
  incidentes: number;
  porcentaje: number;
  es_causa_identificada: boolean;
  accion_recomendada: string;
  evidencias: IncidentConsolidatedCausaEvidenciaItem[];
}

export interface IncidentConsolidatedAnalisisCausasOut {
  total_incidentes: number;
  con_factor_tecnico: number;
  sin_causa_determinada: number;
  casos_multifactor: number;
  metodologia: string;
  causas: IncidentConsolidatedCausaAnalisisItem[];
  tickets_para_revision: string[];
}


/* ANALISIS DE INCIDENTES - DISTRIBUCION AJUSTADA*/
export interface IncidentConsolidatedComparacionAtribucionItem {
  atribucion: string;
  tickets_originales: number;
  tickets_ajustados: number;
  variacion_tickets: number;
  porcentaje_original: number;
  porcentaje_ajustado: number;
}

export interface IncidentConsolidatedDistribucionAjustadaOut {
  total_tickets: number;

  total_atribuidos_original: number;
  total_atribuidos_ajustado: number;

  sin_atribucion_original: number;
  sin_atribucion_ajustado: number;

  reglas_aprobadas: number;
  ajustes_aplicados: number;
  ajustes_habilitados: boolean;

  estado_ajuste: string;
  metodologia: string;

  distribucion_original: IncidentConsolidatedAtribucionItem[];
  distribucion_ajustada: IncidentConsolidatedAtribucionItem[];

  comparacion: IncidentConsolidatedComparacionAtribucionItem[];
}


/* ANALISIS DE INCIDENTES - PRINCIPALES HALLAZGOS*/
export interface IncidentConsolidatedHallazgoItem {
  codigo: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  valor: number;
  porcentaje: number | null;
  denominador: number | null;
  requiere_validacion: boolean;
}

export interface IncidentConsolidatedPrincipalesHallazgosOut {
  total_incidentes: number;
  total_hallazgos: number;
  estado_ajuste: string;
  metodologia: string;
  hallazgos: IncidentConsolidatedHallazgoItem[];
}


/* ANALISIS DE INCIDENTES - CONCLUSIONES*/
export interface IncidentConsolidatedConclusionItem {
  codigo: string;
  tipo: string;
  titulo: string;
  conclusion: string;
  recomendacion: string;
  hallazgos_referencia: string[];
  requiere_validacion: boolean;
}

export interface IncidentConsolidatedConclusionesOut {
  total_incidentes: number;
  total_conclusiones: number;
  estado_ajuste: string;
  metodologia: string;
  conclusiones: IncidentConsolidatedConclusionItem[];
}
