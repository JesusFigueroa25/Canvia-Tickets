import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: false,
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.css',
})
export class KpiCard {

  @Input() titulo: string = '';
  @Input() valor: string | number = '';
  @Input() icono: string = 'analytics';

  @Input() color: 'orange' | 'green' = 'green';
  @Input() esPorcentaje: boolean = false;

}