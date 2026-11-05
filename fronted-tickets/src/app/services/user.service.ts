import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { Token } from '../models/token';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  servidor: string = "api"
  recurso: string = "auth"

  constructor(private clienteHTTP: HttpClient) { }

  logearUsuario(usuario: User) {
    return this.clienteHTTP.post<Token>(this.servidor + "/" + this.recurso + "/" + "login", usuario).pipe(
      tap((data: Token) => {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("token_type", data.token_type.toString());
        localStorage.setItem("correo", data.correo);
      })
    );
  }

  deslogearUsuario() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('correo');
  }

  getToken() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }
}
