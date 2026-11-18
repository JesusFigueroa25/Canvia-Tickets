
import { Component, Input } from '@angular/core';

import {
  IncidentConsolidatedDashboardFilters,
  IncidentConsolidatedAtribucionOut,
  IncidentConsolidatedDistribucionAjustadaOut,
  IncidentConsolidatedAnalisisCausasOut,
  IncidentConsolidatedTopServidoresOut,
  IncidentConsolidatedPrincipalesHallazgosOut,
  IncidentConsolidatedConclusionesOut,
  IncidentConsolidatedServidorItem,
  IncidentConsolidatedProyectoItem,
  IncidentConsolidatedTopProyectos,
  IncidentConsolidatedRendimientoOut,
  IncidentConsolidatedTicketsPorResolutorOut,
  IncidentConsolidatedRendimientoResolutorItem,
  IncidentConsolidatedTopProyectoItem,
  IncidentConsolidatedTipoItem
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
  @Input() tiposDistribucion: IncidentConsolidatedTipoItem[] = [];

  // PROCEDENCIA DEL ANÁLISIS EJECUTIVO
  @Input() origenAnalisis: 'ia' | 'reglas' | 'sin_datos' = 'reglas';
  @Input() modeloAnalisis: string | null = null;

  // NUEVAS VISUALIZACIONES DEL REPORTE
  @Input() proyectos: IncidentConsolidatedProyectoItem[] = [];
  @Input() topProyectos: IncidentConsolidatedTopProyectos | null = null;
  @Input() rendimiento: IncidentConsolidatedRendimientoOut | null = null;
  @Input() ticketsPorResolutor: IncidentConsolidatedTicketsPorResolutorOut | null = null;

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
      .filter(item =>
        typeof item.servidor === 'string' &&
        item.servidor.trim().length > 0 &&
        item.incidentes > 0
      )
      .sort((a, b) =>
        b.incidentes - a.incidentes ||
        a.servidor.localeCompare(b.servidor)
      );

  }

  // MOSTRAR SECCIÓN SOLO CUANDO EXISTAN SERVIDORES
  get hayServidores(): boolean {
    return this.servidoresOrdenados.length > 0;
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


  // REPORTE - CLIENTE
  get proyectosTabla(): IncidentConsolidatedProyectoItem[] {
    return [...this.proyectos]
      .sort((a, b) =>
        b.cantidad - a.cantidad ||
        a.proyecto.localeCompare(b.proyecto)
      )
      .slice(0, 20);
  }

  get proyectosGrafico(): IncidentConsolidatedTopProyectoItem[] {
    return [...(this.topProyectos?.proyectos ?? [])]
      .sort((a, b) =>
        b.total_tickets - a.total_tickets ||
        a.proyecto.localeCompare(b.proyecto)
      )
      .slice(0, 10);
  }

  get periodosProyectosGrafico() {
    return [...(this.topProyectos?.periodos ?? [])]
      .sort((a, b) =>
        a.anio - b.anio || a.mes - b.mes
      )
      .slice(-12);
  }

  get maximoTopProyectos(): number {
    const valores = this.proyectosGrafico.flatMap(
      proyecto => this.periodosProyectosGrafico.map(
        periodo => this.obtenerTicketsMes(
          proyecto.mensual,
          periodo.periodo
        )
      )
    );

    return Math.max(1, ...valores);
  }

  limpiarNombreProyecto(nombre: string): string {
    return nombre
      .replace(/^\s*\d{6}\s*[-–:]?\s*/, '')
      .trim() || 'Sin proyecto';
  }

  obtenerTicketsMes(
    mensual: { periodo: string; tickets: number }[],
    periodo: string
  ): number {
    return mensual.find(
      item => item.periodo === periodo
    )?.tickets ?? 0;
  }

  colorCalorProyecto(cantidad: number): string {
    if (cantidad <= 0) {
      return '#F2F4F7';
    }

    const intensidad = cantidad / this.maximoTopProyectos;

    const opacidad = Math.min(
      0.65,
      0.15 + intensidad * 0.50
    );

    return `rgba(255, 98, 15, ${opacidad})`;
  }

  // REPORTE - RENDIMIENTO POR RESOLUTOR
  get resolutoresTabla(): IncidentConsolidatedRendimientoResolutorItem[] {
    return (this.rendimiento?.resolutores ?? []).slice(0, 5);
  }

  get periodosRendimientoReporte() {
    return (this.rendimiento?.periodos ?? []).slice(-12);
  }

  get totalResolutoresReporte(): number {
    return this.rendimiento?.total_resolutores ?? 0;
  }

  totalMesResolutores(periodo: string): number {
    return this.rendimiento?.totales_mensuales.find(
      item => item.periodo === periodo
    )?.tickets ?? 0;
  }

  // REPORTE - GRÁFICO TICKETS POR RESOLUTOR
  private readonly coloresReporte: string[] = [
    '#FF620F',
    '#FFB184',
    '#16835B',
    '#63B891',
    '#D97706',
    '#F4C95D',
    '#12633F',
    '#A8DCC2'
  ];

  get resolutoresGrafico(): IncidentConsolidatedRendimientoResolutorItem[] {
    return this.ticketsPorResolutor?.resolutores ?? [];
  }

  get periodosResolutorGrafico() {
    return (this.ticketsPorResolutor?.periodos ?? []).slice(-12);
  }

  get maximoGraficoResolutor(): number {
    const totales = this.resolutoresGrafico.map(
      resolutor => this.periodosResolutorGrafico.reduce(
        (acumulado, periodo) =>
          acumulado + this.obtenerTicketsMes(
            resolutor.mensual,
            periodo.periodo
          ),
        0
      )
    );

    return Math.max(1, ...totales);
  }

  anchoBarraResolutor(
    resolutor: IncidentConsolidatedRendimientoResolutorItem,
    periodo: string
  ): number {

    const tickets = this.obtenerTicketsMes(
      resolutor.mensual,
      periodo
    );

    return Math.max(
      0,
      Math.min(
        100,
        tickets / this.maximoGraficoResolutor * 100
      )
    );
  }

  colorPeriodoResolutor(indice: number): string {
    return this.coloresReporte[
      indice % this.coloresReporte.length
    ];
  }

  // PERIODOS MOSTRADOS EN EL PNG

  get proyectosMesesLimitados(): boolean {
    return (this.topProyectos?.periodos.length ?? 0) > 12;
  }

  get rendimientoMesesLimitados(): boolean {
    return (this.rendimiento?.periodos.length ?? 0) > 12;
  }

  get resolutorMesesLimitados(): boolean {
    return (this.ticketsPorResolutor?.periodos.length ?? 0) > 12;
  }


  // CAUSAS VISIBLES
  get causasVisibles() {
    return (this.causas?.causas ?? []).filter(
      item =>
        item.categoria.trim().toLowerCase() !==
        'sin evidencia técnica suficiente'
    );
  }

  // TÍTULO DINÁMICO DE CLIENTES
  get tituloGraficoClientes(): string {
    return this.proyecto
      ? `Tickets por el cliente ${this.proyecto}`
      : 'Top 10: Tickets por Proyecto y Mes';
  }

  // DISTRIBUCIÓN POR TIPO DE INCIDENTE
  get tiposReporte(): IncidentConsolidatedTipoItem[] {
    return [...this.tiposDistribucion]
      .sort((a, b) =>
        b.cantidad - a.cantidad ||
        a.tipo_incidente.localeCompare(b.tipo_incidente)
      )
      .slice(0, 10);
  }


  get maximoTiposReporte(): number {
    return Math.max(
      1,
      ...this.tiposReporte.map(item => item.cantidad)
    );
  }

  anchoBarraTipo(cantidad: number): number {
    return Math.max(
      0,
      Math.min(
        100,
        (cantidad / this.maximoTiposReporte) * 100
      )
    );
  }

  porcentajeTipo(cantidad: number): number {
    if (this.totalIncidentes <= 0) {
      return 0;
    }
    return (cantidad / this.totalIncidentes) * 100;
  }

}
