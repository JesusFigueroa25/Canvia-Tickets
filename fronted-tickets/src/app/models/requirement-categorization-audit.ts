
export type AuditResultStatus = 'CORRECT' | 'INCORRECT';

export type AuditRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type AuditTicketLifecycle =
  | 'RESOLVED'
  | 'CANCELLED'
  | 'OPEN'
  | 'UNCERTAIN';

export type AuditSolutionStatus =
  | 'PRESENT'
  | 'MISSING_REQUIRED'
  | 'OPTIONAL_MISSING'
  | 'REVIEW_STATUS';

export interface AuditRunCreate {
  grupo_resolutor: string;
  group_id: number;
  period_from: string;
  period_to: string;
}

export interface AuditRun {
  run_id: number;
  group_id: number | null;
  grupo_resolutor: string;
  period_from: string | null;
  period_to: string | null;
  status: AuditRunStatus;

  model_name: string | null;
  model_version: string | null;
  engine_version: string | null;
  catalog_snapshot_hash: string | null;

  total_tickets: number;
  processed_tickets: number;
  correct_count: number;
  incorrect_count: number;
  error_count: number;

  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface AuditSummary {
  // Auditoría individual (compatibilidad)
  run_id?: number;
  run_status?: AuditRunStatus;

  // Auditoría acumulativa
  group_id?: number;
  group_name?: string;
  audit_year?: number;
  total_runs?: number;
  completed_runs?: number;

  grupo_resolutor: string;

  total_tickets: number;
  processed_tickets: number;
  correct_count: number;
  incorrect_count: number;
  error_count: number;

  correct_percentage: number;
  incorrect_percentage: number;

  missing_required_solution_count: number;
  optional_missing_solution_count: number;
  review_solution_status_count: number;
}


export interface AuditDashboardFilters {

  desde?: string;
  hasta?: string;
  grupo_resolutor?: string;
  proyecto?: string;

  resultado?: AuditResultStatus;

  motivo_resolucion?:
    | 'Atribuible a Cliente'
    | 'Atribuible a Canvia';

  mes?: string; // YYYY-MM
  nombre_resolutor?: string;
  ticket_id?: string;
}


export interface AuditTicketFilters extends AuditDashboardFilters {
  run_id?: number;
  page?: number;
  page_size?: number;
}


export interface AuditTicket {
  result_id: number;
  run_id: number;
  ticket_id: string;
  grupo_resolutor: string;

  resolver_name: string | null;
  project_name: string | null;

  source_opened_at: string;
  source_status: string | null;
  source_status_reason: string | null;
  source_resolved_at: string | null;
  source_last_modified_at: string | null;

  original_level_1: string | null;
  original_level_2: string | null;
  original_level_3: string | null;
  original_catalog_id: number | null;

  suggested_catalog_id: number | null;
  suggested_level_1: string | null;
  suggested_level_2: string | null;
  suggested_level_3: string | null;

  descripcion: string | null;
  detalle: string | null;
  solucion: string | null;

  result_status: AuditResultStatus;
  reason_code: string;
  reason_text: string;
  evidence_json: Record<string, unknown> | null;
  semantic_score: number | null;
  source_hash: string;
  evaluated_at: string;

  ticket_lifecycle_status: AuditTicketLifecycle | null;
  has_solution: boolean | null;
  solution_check_status: AuditSolutionStatus | null;
  solution_check_reason: string | null;
}

export interface AuditTicketList {
  run_id?: number;
  group_id?: number;
  grupo_resolutor: string;
  total: number;
  page: number;
  page_size: number;
  items: AuditTicket[];
}

export interface AuditResolver {
  resolver_name: string | null;
  total_tickets: number;

  correct_count: number;
  incorrect_count: number;

  correct_percentage: number;
  incorrect_percentage: number;

  missing_required_solution_count: number;
}

export interface AuditResolverList {
  run_id?: number;
  group_id?: number;
  grupo_resolutor: string;
  total: number;
  items: AuditResolver[];
}

export interface AuditCategory {
  catalog_id: number;
  level_1: string;
  level_2: string;
  level_3: string;

  description: string | null;
  examples: string | null;

  catalog_source: 'SQL_SERVER' | 'SERVICE_AIDE' | 'MANUAL';
  validation_status: 'OBSERVED' | 'VALIDATED';

  first_observed_at: string | null;
  last_observed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditCategoryList {
  total: number;
  items: AuditCategory[];
}


// Agrupación anual utilizada por el dashboard.
export const AUDIT_GROUP_ID = 1;


export interface AuditMonthlyStat {
  month: string;
  total_tickets: number;
  correct_count: number;
  incorrect_count: number;
  correct_percentage: number;
  incorrect_percentage: number;
}

export interface AuditMonthlyStats {
  group_id: number;
  grupo_resolutor: string;
  audit_year: number;
  total: number;
  items: AuditMonthlyStat[];
}


//Grafico Dona - Motivo Resolucion
export interface AuditResolutionReason {
  reason: string;
  total_tickets: number;
  percentage: number;
}

export interface AuditResolutionReasonList {
  group_id: number;
  grupo_resolutor: string;
  audit_year: number;
  total: number;
  items: AuditResolutionReason[];
}

export interface AuditFilterOptions {
  group_id: number;
  audit_year: number;

  fecha_min: string | null;
  fecha_max: string | null;

  grupos_resolutores: string[];
  proyectos: string[];
  nombres_resolutores: string[];
  meses: string[];
  ticket_ids: string[];
}
