
import { Component, Input } from '@angular/core';
import { HomeResumenEjecutivo } from '../../../../models/home';

@Component({
  selector: 'app-home-executive-summary',
  standalone: false,
  templateUrl: './home-executive-summary.html',
  styleUrl: './home-executive-summary.css'
})
export class HomeExecutiveSummary {

  @Input() datos: HomeResumenEjecutivo | null = null;

  obtenerIconoVariacion(variacion: number | null): string {
    if (variacion === null) {
      return 'timeline';
    }
    if (variacion > 0) {
      return 'trending_up';
    }
    if (variacion < 0) {
      return 'trending_down';
    }
    return 'trending_flat';
  }

}
