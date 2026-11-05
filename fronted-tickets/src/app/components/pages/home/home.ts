
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HomeResumen } from '../../../models/home';
import { HomeService } from '../../../services/home.service';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  resumen: HomeResumen | null = null;
  cargandoResumen: boolean = false;
  errorResumen: string | null = null;

  constructor(
    private homeService: HomeService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.cargandoResumen = true;
    this.errorResumen = null;
    this.homeService
      .obtenerResumen()
      .subscribe({
        next: (data) => {
          this.resumen = data;
          this.cargandoResumen = false;
          console.log('Dashboard Home:', data);
          this.changeDetector.markForCheck();
        },

        error: (error) => {
          console.error('Error obteniendo Dashboard Home:', error);
          this.resumen = null;
          this.errorResumen = 'No se pudo cargar la información del Home.';
          this.cargandoResumen = false;
          this.changeDetector.markForCheck();
        }
      });
  }
}
