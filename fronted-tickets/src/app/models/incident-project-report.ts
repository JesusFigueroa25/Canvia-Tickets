import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedKPI, IncidentConsolidatedProyectoItem, IncidentConsolidatedTopProyectos, IncidentConsolidatedVolumenItem } from './incident-consolidated';
import { IncidentMonthlyReportData } from './incident-monthly-report';

export type IncidentProjectReportFilters = Pick<IncidentConsolidatedDashboardFilters,
  'desde' | 'hasta' | 'prioridad' | 'motivo_estado' | 'motivo_resolucion' | 'grupo_resolutor' | 'proyectos_excluidos'>;

export interface IncidentProjectReportResponses {
  kpis: IncidentConsolidatedKPI;
  proyectos: IncidentConsolidatedProyectoItem[];
  top: IncidentConsolidatedTopProyectos;
  volumen: IncidentConsolidatedVolumenItem[];
}

export interface IncidentProjectSeries {
  readonly proyecto: string;
  readonly total: number;
  readonly mensual: readonly number[];
}

export interface IncidentProjectDonutSegment {
  readonly clave: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly porcentaje: number;
  readonly otros: boolean;
}

export interface IncidentProjectReportData {
  readonly version: number;
  readonly preparadoEn: string;
  readonly filtros: Readonly<IncidentProjectReportFilters>;
  readonly total: number;
  readonly distribucion: readonly IncidentConsolidatedProyectoItem[];
  readonly lideres: readonly IncidentConsolidatedProyectoItem[];
  readonly mensual: IncidentMonthlyReportData;
  readonly top: readonly IncidentProjectSeries[];
  readonly subtotalTop: number;
  readonly dona: readonly IncidentProjectDonutSegment[];
  readonly hallazgos: readonly string[];
  readonly conclusion: string;
  readonly recomendaciones: readonly string[];
}
