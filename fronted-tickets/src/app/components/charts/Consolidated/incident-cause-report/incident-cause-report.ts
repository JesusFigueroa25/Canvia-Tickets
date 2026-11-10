
import { Component, Input } from '@angular/core';

import {
  IncidentConsolidatedDashboardFilters,
  IncidentConsolidatedAtribucionOut,
  IncidentConsolidatedDistribucionAjustadaOut,
  IncidentConsolidatedAnalisisCausasOut,
  IncidentConsolidatedTopServidoresOut,
  IncidentConsolidatedPrincipalesHallazgosOut,
  IncidentConsolidatedConclusionesOut,
  IncidentConsolidatedServidorItem
} from '../../../../models/incident-consolidated';

@Component({
  selector: 'app-incident-cause-report',
  standalone: false,
  templateUrl: './incident-cause-report.html',
  styleUrl: './incident-cause-report.css'
})
export class IncidentCauseReport {

  @Input() filtros: IncidentConsolidatedDashboardFilters = {};

  @Input() proyecto: string | null = null;
  @Input() tiposIncidente: string | null = null;

  @Input() atribucion: IncidentConsolidatedAtribucionOut | null = null;

  @Input() ajustada: IncidentConsolidatedDistribucionAjustadaOut | null = null;

  @Input() causas: IncidentConsolidatedAnalisisCausasOut | null = null;

  @Input() servidores: IncidentConsolidatedTopServidoresOut | null = null;

  @Input() hallazgos: IncidentConsolidatedPrincipalesHallazgosOut | null = null;

  @Input() conclusiones: IncidentConsolidatedConclusionesOut | null = null;

  // TOTAL DE INCIDENTES
  get totalIncidentes(): number {
    return this.ajustada?.total_tickets ??
      this.causas?.total_incidentes ??
      this.servidores?.total_incidentes ??
      this.atribucion?.total_tickets ?? 0;
  }

  // FORMATEAR FECHAS SIN CONVERSION UTC
  formatearFecha(fecha?: string): string {
    if (!fecha) return '—';

    const partes = fecha.split('-');

    if (partes.length !== 3) return fecha;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  // FILTROS QUE SE MOSTRARAN EN EL REPORTE
  get filtrosResumen(): string[] {
    const f = this.filtros;
    const resultado: string[] = [];

    if (f.prioridad) {
      resultado.push(`Prioridad: ${f.prioridad}`);
    }

    if (f.motivo_estado) {
      resultado.push(`Estado: ${f.motivo_estado}`);
    }

    if (f.motivo_resolucion) {
      resultado.push(`Resolución: ${f.motivo_resolucion}`);
    }

    if (f.grupo_resolutor) {
      resultado.push(`Grupo: ${f.grupo_resolutor}`);
    }

    if (f.nombre_resolutor) {
      resultado.push(`Resolutor: ${f.nombre_resolutor}`);
    }

    if (f.ticket_id) {
      resultado.push(`Ticket: ${f.ticket_id}`);
    }

    return resultado;
  }

  // RANKING DE SERVIDORES
  get servidoresOrdenados(): IncidentConsolidatedServidorItem[] {
    return [...(this.servidores?.servidores ?? [])]
      .sort((a, b) =>
        b.incidentes - a.incidentes ||
        a.servidor.localeCompare(b.servidor)
      );
  }

  get maxServidor(): number {
    return Math.max(
      1,
      ...this.servidoresOrdenados.map(item => item.incidentes)
    );
  }

  anchoServidor(cantidad: number): number {
    return Math.max(
      0,
      Math.min(100, cantidad / this.maxServidor * 100)
    );
  }

  // ATRIBUCION ORIGINAL
  obtenerAtribucion(tipo: string): {
    tickets: number;
    porcentaje: number;
  } {
    const item = this.atribucion?.distribucion.find(
      registro => registro.atribucion === tipo
    );

    return {
      tickets: item?.tickets ?? 0,
      porcentaje: item?.porcentaje ?? 0
    };
  }

  get totalAtribuidos(): number {
    return this.atribucion?.total_atribuidos ?? 0;
  }

  get fondoDona(): string {
    if (this.totalAtribuidos <= 0) {
      return '#E5E9EE';
    }

    const cliente = this.obtenerAtribucion(
      'Atribuible a Cliente'
    ).tickets;

    const canvia = this.obtenerAtribucion(
      'Atribuible a Canvia'
    ).tickets;

    const clientePct = Math.min(
      100,
      cliente / this.totalAtribuidos * 100
    );

    const finalPct = Math.min(
      100,
      (cliente + canvia) / this.totalAtribuidos * 100
    );

    return `conic-gradient(
      #FF620F 0% ${clientePct}%,
      #16835B ${clientePct}% ${finalPct}%,
      #E5E9EE ${finalPct}% 100%
    )`;
  }

  // COMPARACION ORIGINAL VS AJUSTADA
  get maxComparacion(): number {
    const registros = this.ajustada?.comparacion ?? [];

    return Math.max(
      1,
      ...registros.flatMap(item => [
        item.tickets_originales,
        item.tickets_ajustados
      ])
    );
  }

  anchoComparacion(cantidad: number): number {
    return Math.max(
      0,
      Math.min(100, cantidad / this.maxComparacion * 100)
    );
  }

  nombreAtribucion(valor: string): string {
    if (valor === 'Atribuible a Cliente') return 'Cliente';
    if (valor === 'Atribuible a Canvia') return 'Canvia';
    return valor;
  }

  get ajustesPendientes(): boolean {
    return this.ajustada?.estado_ajuste ===
      'PENDIENTE_REGLAS_APROBADAS';
  }

  get estadoAjuste(): string {
    if (this.ajustesPendientes) {
      return 'Ajustes pendientes de reglas aprobadas';
    }

    return this.ajustada?.estado_ajuste ??
      'Sin información del estado de ajustes';
  }
}
