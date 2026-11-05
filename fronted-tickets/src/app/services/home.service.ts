
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HomeResumen } from '../models/home';

@Injectable({ providedIn: 'root' })
export class HomeService {

  private readonly servidor = 'api';
  private readonly recurso = 'home';

  constructor(private http: HttpClient) { }

  obtenerResumen(): Observable<HomeResumen> {
    return this.http.get<HomeResumen>(
      `${this.servidor}/${this.recurso}/resumen`
    );

  }

}
