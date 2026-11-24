import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedIncidentesPorcentajeItem } from './incident-consolidated';

export type IncidentRecurringAlertsFilters = Pick<IncidentConsolidatedDashboardFilters,
  'desde' | 'hasta' | 'prioridad' | 'motivo_estado' | 'motivo_resolucion' | 'grupo_resolutor' | 'proyectos_excluidos' | 'proyecto'>;

export interface IncidentRecurringAlertsReportData {
  readonly version: number;
  readonly preparadoEn: string;
  readonly modo: 'general' | 'proyecto';
  readonly filtros: Readonly<IncidentRecurringAlertsFilters>;
  readonly total: number;
  readonly topTotal: number;
  readonly participacionTop: number;
  readonly otros: number;
  readonly participacionOtros: number;
  readonly alertas: readonly Readonly<IncidentConsolidatedIncidentesPorcentajeItem>[];
  readonly lideresVisibles: readonly Readonly<IncidentConsolidatedIncidentesPorcentajeItem>[];
  readonly avisoSinEspecificar: string | null;
  readonly hallazgos: readonly string[];
  readonly conclusion: string;
  readonly recomendaciones: readonly string[];
}

export interface IncidentRecurringAlertsRenderError {
  readonly version: number;
  readonly motivo: 'legibilidad' | 'render';
}
