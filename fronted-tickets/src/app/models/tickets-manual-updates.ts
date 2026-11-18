import { ImportResultado } from './import-result';

/**
 * Contrato de POST /tickets-manual-updates/import.
 * Mantiene compatibilidad con ImportResultado, reutilizado por las tarjetas.
 *
 * Regla de negocio: se insertan únicamente Ticket_ID nuevos;
 * los previamente importados no se sobrescriben.
 */
export type TicketsManualUpdatesImportOut = ImportResultado & {
    tipo: 'tickets_manual_updates';
    tabla_staging: 'stg_tickets_manual_updates';
    tabla_destino: 'tickets_manual_updates';
    lote_id: string;
    filas_excel: number;
    filas_procesadas: number;
    filas_staging: number;
    duplicados: number;
    nuevos: number;
    modificados: number;
    sin_cambios: number;
    tickets_distintos: number;
    filas_ticket_repetido: number;
    mensaje: string;
};
