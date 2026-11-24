import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedKPI, IncidentConsolidatedTopProyectos } from './incident-consolidated';
import { IncidentMonthlyReportData, IncidentMonthlyVariation } from './incident-monthly-report';

export type IncidentProjectMonthlyFilters = Pick<IncidentConsolidatedDashboardFilters,
  'desde' | 'hasta' | 'prioridad' | 'motivo_estado' | 'motivo_resolucion' | 'grupo_resolutor' | 'proyectos_excluidos'> & { proyecto: string };

export interface IncidentProjectMonthlyResponses {
  readonly kpis: IncidentConsolidatedKPI;
  readonly top: IncidentConsolidatedTopProyectos;
}

export interface IncidentProjectMonthlyReportData {
  readonly version: number;
  readonly preparadoEn: string;
  readonly proyecto: string;
  readonly filtros: Readonly<IncidentProjectMonthlyFilters>;
  readonly mensual: IncidentMonthlyReportData;
  readonly variacionPeriodo: IncidentMonthlyVariation | null;
  readonly hallazgos: readonly string[];
  readonly conclusion: string;
  readonly recomendaciones: readonly string[];
}

export interface IncidentProjectMonthlyRenderError {
  readonly version: number;
  readonly motivo: 'legibilidad' | 'render';
}
