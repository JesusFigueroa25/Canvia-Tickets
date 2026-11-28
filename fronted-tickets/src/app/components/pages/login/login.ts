import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User } from '../../../models/user';
import { Token } from '../../../models/token';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: false,
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  logeoForm!: FormGroup;
  muestraPassword: boolean = false;

  constructor(
    private userService: UserService,
    private formBuilder: FormBuilder,
    private enrutador: Router,
    private _snackBar: MatSnackBar) { }

  ngOnInit() {
    this.crearLogeoForm();
  }
  crearLogeoForm() {
    this.logeoForm = this.formBuilder.group({
      correo: ["", [Validators.minLength(3), Validators.required]],
      password: ["", [Validators.minLength(3), Validators.required]]
    })
  }

  logearUsuario() {
    if (this.logeoForm.invalid) {
      return;
    }

    const user: User = {
      correo: this.logeoForm.get("correo")!.value,
      password: this.logeoForm.get("password")!.value,
    };

    this.userService.logearUsuario(user).subscribe({
      next: (_data: Token) => {

        if (!this.userService.sesionValida()) {
          this._snackBar.open("No se pudo establecer una sesión válida.", "OK", { duration: 3000 });
          return;
        }

        this.enrutador.navigate(["/home"], { replaceUrl: true });
      },
      error: (err) => {
        this._snackBar.open(
          "Error en el ingreso: " + (err.error?.message || err.error?.detail || "No se pudo iniciar sesión"),
          "OK",
          { duration: 3000 }
        );
      }
    });
  }

}
