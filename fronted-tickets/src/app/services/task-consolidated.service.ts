
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ImportResultado } from '../models/import-result';

@Injectable({
  providedIn: 'root'
})
export class TaskConsolidatedService {

  private readonly apiUrl = 'api/task-consolidated';

  constructor(
    private http: HttpClient
  ) {}

  importarExcel(archivo: File): Observable<ImportResultado> {

    const formData = new FormData();

    formData.append(
      'archivo',
      archivo,
      archivo.name
    );

    return this.http.post<ImportResultado>(
      `${this.apiUrl}/import`,
      formData
    );
  }
}
