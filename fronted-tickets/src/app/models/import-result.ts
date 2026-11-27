export interface ImportResultado {
    tipo: string;
    tabla_staging: string;
    tabla_destino: string;
    filas_excel?: number;
    duplicados?: number;
    filas_procesadas: number;
    filas_staging: number;
    nuevos: number;
    modificados: number;
    sin_cambios: number;
    mensaje: string;
}

export type EstadoArchivoImportacion =
    | 'pendiente'
    | 'procesando'
    | 'completado'
    | 'error';

export interface ArchivoImportacion {
    id: number;
    archivo: File;
    estado: EstadoArchivoImportacion;
    resultado: ImportResultado | null;
    error: string | null;
}
