import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { User } from '../models/user';
import { Token } from '../models/token';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  servidor: string = "api";
  recurso: string = "auth";

  constructor(private clienteHTTP: HttpClient) { }

  logearUsuario(usuario: User) {
    return this.clienteHTTP.post<Token>(
      this.servidor + "/" + this.recurso + "/" + "login",
      usuario
    ).pipe(
      tap((data: Token) => {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("token_type", data.token_type.toString());
        localStorage.setItem("correo", data.correo);
      })
    );
  }

  deslogearUsuario(): void {

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('correo');
    }

  }

  getToken(): string | null {

    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('access_token');
    }

    return null;
  }

  sesionValida(): boolean {

    if (typeof localStorage === 'undefined') {
      return false;
    }

    const token = this.getToken();
    const correo = localStorage.getItem('correo');
    const tokenType = localStorage.getItem('token_type');

    if (!token || !correo?.trim() || !tokenType?.trim()) {
      this.deslogearUsuario();
      return false;
    }

    try {

      const partes = token.split('.');

      if (
        partes.length !== 3 ||
        partes.some(parte =>
          !/^[A-Za-z0-9_-]+$/.test(parte)
        )
      ) {
        this.deslogearUsuario();
        return false;
      }

      const header = JSON.parse(
        this.decodificarBase64Url(partes[0])
      );

      const payload = JSON.parse(
        this.decodificarBase64Url(partes[1])
      );

      if (
        !header ||
        typeof header.alg !== 'string' ||
        header.alg.toLowerCase() === 'none' ||
        !payload ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp)
      ) {
        this.deslogearUsuario();
        return false;
      }

      const fechaExpiracion = payload.exp * 1000;

      if (
        !Number.isFinite(fechaExpiracion) ||
        Date.now() >= fechaExpiracion
      ) {
        this.deslogearUsuario();
        return false;
      }

      return true;

    } catch {

      this.deslogearUsuario();
      return false;

    }

  }

  private decodificarBase64Url(valor: string): string {

    const base64 = valor
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const base64Completo = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '='
    );

    const bytes = Uint8Array.from(
      atob(base64Completo),
      caracter => caracter.charCodeAt(0)
    );

    return new TextDecoder('utf-8', {
      fatal: true
    }).decode(bytes);

  }

}