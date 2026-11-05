
import { ChangeDetectorRef, Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, from, Observable } from 'rxjs';
import { catchError, concatMap, finalize, tap } from 'rxjs';

import { IncidentConsolidatedService } from '../../../services/incident-consolidated.service';
import { IncidentSlaService } from '../../../services/incident-sla.service';
import { RequirementConsolidatedService } from '../../../services/requirement-consolidated.service';
import { RequirementSlaService } from '../../../services/requirement-sla.service';

import { ArchivoImportacion, ImportResultado } from '../../../models/import-result';

type TipoImportacion =
    | 'incident-sla'
    | 'incident-consolidated'
    | 'requirement-consolidated'
    | 'requirement-sla';

interface ModuloImportacion {
    id: TipoImportacion;
    titulo: string;
    descripcion: string;
}

interface EstadoImportacion {
    archivos: ArchivoImportacion[];
    cargando: boolean;
}

@Component({
    selector: 'app-importaciones',
    standalone: false,
    templateUrl: './importaciones.component.html',
    styleUrl: './importaciones.component.css'
})
export class ImportacionesComponent {

    readonly modulos: ModuloImportacion[] = [
        {
            id: 'incident-sla',
            titulo: 'Incidente SLA',
            descripcion: 'Importación de incidentes y mediciones de cumplimiento SLA.'
        },
        {
            id: 'incident-consolidated',
            titulo: 'Incidente Consolidado',
            descripcion: 'Actualización del consolidado general de incidentes.'
        },
        {
            id: 'requirement-consolidated',
            titulo: 'Requerimiento Consolidado',
            descripcion: 'Actualización del consolidado general de requerimientos.'
        },
        {
            id: 'requirement-sla',
            titulo: 'Requerimiento SLA',
            descripcion: 'Importación de requerimientos y mediciones de cumplimiento SLA.'
        }
    ];

    estados: Record<TipoImportacion, EstadoImportacion> = {
        'incident-sla': this.crearEstado(),
        'incident-consolidated': this.crearEstado(),
        'requirement-consolidated': this.crearEstado(),
        'requirement-sla': this.crearEstado()
    };

    private siguienteArchivoId = 1;

    constructor(
        private incidentConsolidatedService: IncidentConsolidatedService,
        private incidentSlaService: IncidentSlaService,
        private requirementConsolidatedService: RequirementConsolidatedService,
        private requirementSlaService: RequirementSlaService,
        private cdr: ChangeDetectorRef
    ) {}

    private crearEstado(): EstadoImportacion {
        return {
            archivos: [],
            cargando: false
        };
    }

    agregarArchivos(id: TipoImportacion, archivos: File[]): void {
        const estado = this.estados[id];

        if (estado.cargando) {
            return;
        }

        const existentes = new Set(
            estado.archivos.map(item => this.obtenerClaveArchivo(item.archivo))
        );

        const nuevos: ArchivoImportacion[] = [];

        for (const archivo of archivos) {
            const clave = this.obtenerClaveArchivo(archivo);

            if (existentes.has(clave)) {
                continue;
            }

            existentes.add(clave);

            nuevos.push({
                id: this.siguienteArchivoId++,
                archivo,
                estado: 'pendiente',
                resultado: null,
                error: null
            });
        }

        estado.archivos = [
            ...estado.archivos,
            ...nuevos
        ];

        this.cdr.markForCheck();
    }

    quitarArchivo(id: TipoImportacion, archivoId: number): void {
        const estado = this.estados[id];

        if (estado.cargando) {
            return;
        }

        estado.archivos = estado.archivos.filter(
            item => item.id !== archivoId
        );

        this.cdr.markForCheck();
    }

    limpiarLista(id: TipoImportacion): void {
        const estado = this.estados[id];

        if (estado.cargando) {
            return;
        }

        estado.archivos = [];

        this.cdr.markForCheck();
    }

    importarExcel(id: TipoImportacion): void {
        const estado = this.estados[id];

        if (estado.cargando) {
            return;
        }

        const pendientes = estado.archivos.filter(
            item => item.estado === 'pendiente' || item.estado === 'error'
        );

        if (!pendientes.length) {
            return;
        }

        estado.cargando = true;
        this.cdr.markForCheck();

        from(pendientes)
            .pipe(
                concatMap(item => {
                    item.estado = 'procesando';
                    item.error = null;
                    item.resultado = null;

                    this.cdr.markForCheck();

                    return this.ejecutarImportacion(id, item.archivo)
                        .pipe(
                            tap(resultado => {
                                item.resultado = resultado;
                                item.estado = 'completado';

                                this.cdr.markForCheck();
                            }),
                            catchError(error => {
                                item.estado = 'error';
                                item.error = this.obtenerMensajeError(error);

                                this.cdr.markForCheck();

                                return EMPTY;
                            })
                        );
                }),
                finalize(() => {
                    estado.cargando = false;
                    this.cdr.markForCheck();
                })
            )
            .subscribe();
    }

    private obtenerClaveArchivo(archivo: File): string {
        return `${archivo.name}|${archivo.size}|${archivo.lastModified}`;
    }

    private ejecutarImportacion(
        id: TipoImportacion,
        archivo: File
    ): Observable<ImportResultado> {

        switch (id) {
            case 'incident-sla':
                return this.incidentSlaService.importarExcel(archivo);

            case 'incident-consolidated':
                return this.incidentConsolidatedService.importarExcel(archivo);

            case 'requirement-consolidated':
                return this.requirementConsolidatedService.importarExcel(archivo);

            case 'requirement-sla':
                return this.requirementSlaService.importarExcel(archivo);
        }
    }

    private obtenerMensajeError(error: unknown): string {
        if (!(error instanceof HttpErrorResponse)) {
            return 'Se produjo un error inesperado durante la importación.';
        }

        if (error.status === 0) {
            return 'No se pudo establecer conexión con el servidor.';
        }

        const detalle = error.error?.detail;

        if (typeof detalle === 'string') {
            return detalle;
        }

        if (Array.isArray(detalle)) {
            return detalle
                .map(item => item.msg || 'Error de validación')
                .join('. ');
        }

        if (typeof error.error?.mensaje === 'string') {
            return error.error.mensaje;
        }

        return 'No se pudo completar la importación.';
    }

    trackByModulo(
        index: number,
        modulo: ModuloImportacion
    ): TipoImportacion {
        return modulo.id;
    }
}
