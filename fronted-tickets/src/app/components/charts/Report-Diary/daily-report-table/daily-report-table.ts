import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { DailyReportDiaItem } from '../../../../models/daily-report';

interface DailyReportTotales {
  total_tickets: number;
  incidentes: number;
  requerimientos: number;
  tareas: number;
}

@Component({
  selector: 'app-daily-report-table',
  standalone: false,
  templateUrl: './daily-report-table.html',
  styleUrl: './daily-report-table.css'
})
export class DailyReportTable implements OnChanges {

  @Input() datos: DailyReportDiaItem[] = [];
  @Input() cargando = false;

  // Pantalla completa: se conserva el control en el componente padre.
  @Input() habilitarPantallaCompleta = false;
  @Input() pantallaCompletaActiva = false;
  @Output() pantallaCompletaSolicitada = new EventEmitter<void>();

  readonly displayedColumns: string[] = [
    'fecha_accion',
    'total_tickets',
    'incidentes',
    'requerimientos',
    'tareas'
  ];

  dataSource = new MatTableDataSource<DailyReportDiaItem>([]);
  cantidadDias = 0;

  totales: DailyReportTotales = {
    total_tickets: 0,
    incidentes: 0,
    requerimientos: 0,
    tareas: 0
  };

  // El matSort se crea cuando el *ngIf de la tabla recibe datos.
  // Un setter evita perder el ordenamiento tras la carga HTTP asíncrona.
  @ViewChild(MatSort)
  set matSort(directiva: MatSort | undefined) {
    if (directiva) {
      this.dataSource.sort = directiva;
    }
  }

  constructor() {
    // Se ordena cronológicamente por ISO 8601 sin diferencias de zona horaria.
    this.dataSource.sortingDataAccessor = (fila, columna) => {
      if (columna === 'fecha_accion') {
        return fila.fecha_accion;
      }

      switch (columna) {
        case 'total_tickets': return fila.total_tickets;
        case 'incidentes': return fila.incidentes;
        case 'requerimientos': return fila.requerimientos;
        case 'tareas': return fila.tareas;
        default: return 0;
      }
    };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datos']) {
      this.actualizarTabla();
    }
  }

  private actualizarTabla(): void {
    const registros = [...(this.datos ?? [])].sort(
      (a, b) => a.fecha_accion.localeCompare(b.fecha_accion)
    );

    this.cantidadDias = registros.length;
    this.dataSource.data = registros;

    // Los totales siempre corresponden al período filtrado por el padre.
    this.totales = registros.reduce<DailyReportTotales>(
      (acumulado, fila) => ({
        total_tickets: acumulado.total_tickets + fila.total_tickets,
        incidentes: acumulado.incidentes + fila.incidentes,
        requerimientos: acumulado.requerimientos + fila.requerimientos,
        tareas: acumulado.tareas + fila.tareas
      }),
      {
        total_tickets: 0,
        incidentes: 0,
        requerimientos: 0,
        tareas: 0
      }
    );
  }

  formatearFecha(fechaISO: string): string {
    const partes = fechaISO.split('-');
    return partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : fechaISO;
  }
}
