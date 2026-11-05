import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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

  @Output() usuarioLogeado = new EventEmitter<void>();
  @Output() registrarse = new EventEmitter<void>();
  @Output() landingPage = new EventEmitter<void>();

  logeoForm!: FormGroup;
  muestraPassword: boolean = false;

  constructor(private ruta: ActivatedRoute,
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
    const user: User = {
      correo: this.logeoForm.get("correo")!.value,
      password: this.logeoForm.get("password")!.value,
    };

    this.userService.logearUsuario(user).subscribe({
      next: (data: Token) => {
        console.log(data);
        this.enrutador.navigate(["/home"]);
        this.usuarioLogeado.emit();
      },
      error: (err) => {
        console.log(err);
        this._snackBar.open("Error en el ingreso: " + err.error.message, "OK", { duration: 3000 });
      }
    })
  }

  irARegistrar() {
    this.registrarse.emit();
  }
  irALandingPage() {
    this.landingPage.emit();
  }




}
