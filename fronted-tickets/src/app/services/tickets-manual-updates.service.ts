import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TicketsManualUpdatesImportOut } from '../models/tickets-manual-updates';

@Injectable({ providedIn: 'root' })
export class TicketsManualUpdatesService {

    private readonly apiUrl = 'api/tickets-manual-updates';

    constructor(private http: HttpClient) { }

    importarExcel(archivo: File): Observable<TicketsManualUpdatesImportOut> {
        const formData = new FormData();
        formData.append('archivo', archivo, archivo.name);

        return this.http.post<TicketsManualUpdatesImportOut>(
            `${this.apiUrl}/import`,
            formData
        );
    }
}
