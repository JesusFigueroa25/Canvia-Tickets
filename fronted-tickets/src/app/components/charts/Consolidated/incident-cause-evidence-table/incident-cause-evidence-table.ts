
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';

import {
  IncidentConsolidatedAnalisisCausasOut,
  IncidentConsolidatedCausaAnalisisItem
} from '../../../../models/incident-consolidated';


@Component({
  selector: 'app-incident-cause-evidence-table',
  standalone: false,
  templateUrl: './incident-cause-evidence-table.html',
  styleUrl: './incident-cause-evidence-table.css'
})
export class IncidentCauseEvidenceTable implements OnChanges {

  @Input() datos: IncidentConsolidatedAnalisisCausasOut | null = null;

  @Input() cargando = false;
  @Input() error: string | null = null;

  busqueda = '';

  categoriaExpandida: string | null = null;


  ngOnChanges(changes: SimpleChanges): void {

    if (changes['datos']) {
      this.busqueda = '';
      this.categoriaExpandida = null;
    }
  }


  get filas(): IncidentConsolidatedCausaAnalisisItem[] {

    const registros = this.datos?.causas ?? [];

    const texto = this.busqueda
      .trim()
      .toLocaleLowerCase();

    if (!texto) {
      return registros;
    }

    return registros.filter(item => {

      const contenido = [
        item.categoria,
        item.accion_recomendada
      ].join(' ').toLocaleLowerCase();

      return contenido.includes(texto);
    });
  }


  get totalCategorias(): number {
    return this.datos?.causas.length ?? 0;
  }


  get tieneDatos(): boolean {
    return Boolean(
      this.datos &&
      this.datos.total_incidentes > 0
    );
  }


  alternarEvidencias(
    item: IncidentConsolidatedCausaAnalisisItem
  ): void {

    if (!item.evidencias.length) {
      return;
    }

    this.categoriaExpandida =
      this.categoriaExpandida === item.categoria
        ? null
        : item.categoria;
  }


  limpiarBusqueda(): void {
    this.busqueda = '';
  }


  actualizarBusqueda(evento: Event): void {
    this.busqueda = (
      evento.target as HTMLInputElement
    ).value;
  }


}
