import { IncidentConsolidatedDashboardFilters } from './incident-consolidated';

export type IncidentMonthlyReportFilters = Omit<IncidentConsolidatedDashboardFilters, 'periodo'>;

export interface IncidentMonthlyAvailability {
  readonly fecha_min: string | null;
  readonly fecha_max: string | null;
}

export interface IncidentMonthlyMonth {
  readonly periodo: string;
  readonly etiqueta: string;
  readonly tickets: number;
  readonly estado: 'completo' | 'parcial' | 'no_confirmado';
  readonly sinRegistros: boolean;
}

export interface IncidentMonthlyVariation {
  readonly desde: IncidentMonthlyMonth;
  readonly hasta: IncidentMonthlyMonth;
  readonly diferencia: number;
  readonly porcentaje: number | null;
}

export interface IncidentMonthlyReportData {
  readonly version: number;
  readonly solicitud: number;
  readonly preparadoEn: string;
  readonly filtros: Readonly<IncidentMonthlyReportFilters>;
  readonly disponibilidad: IncidentMonthlyAvailability;
  readonly meses: readonly IncidentMonthlyMonth[];
  readonly total: number;
  readonly maximos: readonly IncidentMonthlyMonth[];
  readonly minimos: readonly IncidentMonthlyMonth[];
  readonly variaciones: readonly IncidentMonthlyVariation[];
  readonly hallazgos: readonly string[];
  readonly conclusion: string;
  readonly recomendacion: string;
}
