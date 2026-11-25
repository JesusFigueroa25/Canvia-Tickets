import type { IncidentConsolidatedDashboardFilters, IncidentConsolidatedDistribucionAjustadaOut,
  IncidentConsolidatedTopServidoresOut, IncidentConsolidatedAnalisisEjecutivoIAOut,
  IncidentConsolidatedHallazgoItem, IncidentConsolidatedConclusionItem } from './incident-consolidated';

export interface IncidentExecutiveSummarySources {
  ajustada: IncidentConsolidatedDistribucionAjustadaOut;
  servidores: IncidentConsolidatedTopServidoresOut;
  analisis: IncidentConsolidatedAnalisisEjecutivoIAOut;
}
export type ExecutiveSummarySource = keyof IncidentExecutiveSummarySources;
export interface ExecutiveSummaryToken { generacion: number; revision: number; clave: string; }
export interface IncidentExecutiveSummaryData {
  readonly version: number;
  readonly preparadoEn: string;
  readonly filtros: Readonly<IncidentConsolidatedDashboardFilters>;
  readonly total: number;
  readonly atribuidos: number;
  readonly sinAtribucion: number;
  readonly ajustada: Readonly<IncidentConsolidatedDistribucionAjustadaOut>;
  readonly servidores: ReadonlyArray<Readonly<Pick<IncidentConsolidatedTopServidoresOut['servidores'][number], 'servidor' | 'incidentes' | 'porcentaje'>>>;
  readonly origen: 'ia' | 'reglas' | 'sin_datos';
  readonly modelo: string | null;
  readonly advertencia: string | null;
  readonly hallazgos: ReadonlyArray<Readonly<IncidentConsolidatedHallazgoItem>>;
  readonly totalHallazgos: number;
  readonly conclusion: Readonly<IncidentConsolidatedConclusionItem> | null;
  readonly metodologia: string;
}
export interface ExecutiveSummaryRenderError { version: number; motivo: 'render' | 'legibilidad'; }
