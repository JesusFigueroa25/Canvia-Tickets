import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ArchivoImportacion, EstadoArchivoImportacion } from '../../../../models/import-result';
import { ImportResultado } from '../../../../models/import-result';
import { TicketsManualUpdatesImportOut } from '../../../../models/tickets-manual-updates';
import { TicketsReportTimesImportResult } from '../../../../models/tickets-report-times';

interface ResumenImportacion {
    filas_procesadas: number;
    filas_staging: number;
    nuevos: number;
    modificados: number;
    sin_cambios: number;
}

@Component({
    selector: 'app-importacion-card',
    standalone: false,
    templateUrl: './importacion-card.component.html',
    styleUrl: './importacion-card.component.css'
})
export class ImportacionCardComponent {

    @Input() idModulo = '';
    @Input() titulo = '';
    @Input() descripcion = '';

    @Input() archivos: ArchivoImportacion[] = [];
    @Input() cargando = false;

    @Output() archivosSeleccionados = new EventEmitter<File[]>();
    @Output() archivoQuitado = new EventEmitter<number>();
    @Output() limpiarSolicitado = new EventEmitter<void>();
    @Output() importarSolicitado = new EventEmitter<void>();

    arrastrando = false;
    errorLocal: string | null = null;


    get formatosPermitidos(): string {
        switch (this.idModulo) {
            case 'tickets-manual-updates':
                return '.xlsx,.xls';

            case 'tickets-report-times':
                return '.xlsx,.xlsm';

            default:
                return '.xlsx';
        }
    }

    get descripcionFormatos(): string {
        switch (this.idModulo) {
            case 'tickets-manual-updates':
                return 'Formatos admitidos: XLSX o XLS · Máximo 50 MB por archivo';

            case 'tickets-report-times':
                return 'Formatos admitidos: XLSX o XLSM · Máximo 50 MB por archivo';

            default:
                return 'Formato admitido: XLSX';
        }
    }


    get procesables(): number {
        return this.archivos.filter(
            item => item.estado === 'pendiente' || item.estado === 'error'
        ).length;
    }

    get completados(): number {
        return this.archivos.filter(
            item => item.estado === 'completado'
        ).length;
    }

    get errores(): number {
        return this.archivos.filter(
            item => item.estado === 'error'
        ).length;
    }

    get resumen(): ResumenImportacion | null {
        const resultados = this.archivos
            .filter(item => item.estado === 'completado' && item.resultado)
            .map(item => item.resultado!);

        if (!resultados.length) {
            return null;
        }

        return resultados.reduce(
            (total, resultado) => ({
                filas_procesadas: total.filas_procesadas + resultado.filas_procesadas,
                filas_staging: total.filas_staging + resultado.filas_staging,
                nuevos: total.nuevos + resultado.nuevos,
                modificados: total.modificados + resultado.modificados,
                sin_cambios: total.sin_cambios + resultado.sin_cambios
            }),
            {
                filas_procesadas: 0,
                filas_staging: 0,
                nuevos: 0,
                modificados: 0,
                sin_cambios: 0
            }
        );
    }

    seleccionarDesdeInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        const archivos = Array.from(input.files || []);
        input.value = '';
        this.validarArchivos(archivos);
    }


    validarArchivos(archivos: File[]): void {
        if (this.cargando || !archivos.length) {
            return;
        }

        const validos: File[] = [];
        const rechazados: string[] = [];

        for (const archivo of archivos) {
            const esModuloManual =
                this.idModulo === 'tickets-manual-updates';

            const esReporteTiempos =
                this.idModulo === 'tickets-report-times';

            let extensionValida: boolean;

            if (esModuloManual) {
                extensionValida = /\.(xlsx|xls)$/i.test(archivo.name);
            } else if (esReporteTiempos) {
                extensionValida = /\.(xlsx|xlsm)$/i.test(archivo.name);
            } else {
                extensionValida = /\.xlsx$/i.test(archivo.name);
            }

            const tieneLimite =
                esModuloManual || esReporteTiempos;

            const excedeLimite =
                tieneLimite &&
                archivo.size > 50 * 1024 * 1024;

            if (
                !extensionValida ||
                archivo.size === 0 ||
                excedeLimite
            ) {
                rechazados.push(archivo.name);
                continue;
            }

            validos.push(archivo);
        }

        this.errorLocal = rechazados.length
            ? `Se rechazaron ${rechazados.length} archivos por formato no permitido, tamaño vacío o límite de tamaño.`
            : null;

        if (validos.length) {
            this.archivosSeleccionados.emit(validos);
        }
    }


    alArrastrar(event: DragEvent): void {
        event.preventDefault();
        if (this.cargando) {
            return;
        }
        this.arrastrando = true;
    }

    alSalir(event: DragEvent): void {
        event.preventDefault();
        this.arrastrando = false;
    }

    alSoltar(event: DragEvent): void {
        event.preventDefault();
        this.arrastrando = false;

        if (this.cargando) {
            return;
        }

        const archivos = Array.from(event.dataTransfer?.files || []);

        this.validarArchivos(archivos);
    }

    solicitarImportacion(): void {
        if (!this.procesables || this.cargando) {
            return;
        }
        this.errorLocal = null;
        this.importarSolicitado.emit();
    }

    quitarArchivo(id: number): void {
        if (this.cargando) {
            return;
        }
        this.archivoQuitado.emit(id);
    }

    limpiarLista(): void {
        if (this.cargando) {
            return;
        }
        this.errorLocal = null;
        this.limpiarSolicitado.emit();
    }

    etiquetaEstado(estado: EstadoArchivoImportacion): string {
        switch (estado) {
            case 'pendiente':
                return 'Pendiente';
            case 'procesando':
                return 'Procesando';
            case 'completado':
                return 'Completado';
            case 'error':
                return 'Error';
        }
    }

    obtenerDetalleManual(resultado: ImportResultado): TicketsManualUpdatesImportOut | null {
        if (this.idModulo !== 'tickets-manual-updates') {
            return null;
        }

        const detalle = resultado as Partial<TicketsManualUpdatesImportOut>;
        if (
            typeof detalle.filas_excel !== 'number' ||
            typeof detalle.duplicados !== 'number' ||
            typeof detalle.tickets_distintos !== 'number' ||
            typeof detalle.filas_ticket_repetido !== 'number'
        ) {
            return null;
        }

        return resultado as TicketsManualUpdatesImportOut;
    }

    formatearTamano(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    trackByArchivo(index: number, item: ArchivoImportacion): number {
        return item.id;
    }



    obtenerDetalleTiempos(
        resultado: ImportResultado
    ): TicketsReportTimesImportResult | null {

        if (this.idModulo !== 'tickets-report-times') {
            return null;
        }

        const detalle =
            resultado as Partial<TicketsReportTimesImportResult>;

        if (
            typeof detalle.filas_excel !== 'number' ||
            typeof detalle.filas_rechazadas !== 'number' ||
            typeof detalle.tickets_distintos !== 'number' ||
            typeof detalle.total_acciones !== 'number' ||
            typeof detalle.lote_id !== 'string'
        ) {
            return null;
        }

        return detalle as TicketsReportTimesImportResult;
    }

}
