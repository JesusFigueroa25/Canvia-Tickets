import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { RequirementCategorizationReportData } from '../../../../models/requirement-categorization-audit';

interface Segmento {
  nombre: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

@Component({
  selector: 'app-requirement-categorization-report',
  standalone: false,
  styleUrl: './requirement-categorization-report.css',
  templateUrl: './requirement-categorization-report.html',
})
export class RequirementCategorizationReport implements OnChanges, OnDestroy {
  @Input() datos!: RequirementCategorizationReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<number>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  private revision = 0;

  categorizaciones: Segmento[] = [];
  motivos: Segmento[] = [];
  filtros: string[] = [];
  meses: RequirementCategorizationReportData['meses'] = [];
  colaboradores: RequirementCategorizationReportData['resolutores'] = [];
  top: RequirementCategorizationReportData['resolutores'] = [];
  subtotalTop = {
    total_tickets: 0, correct_count: 0, incorrect_count: 0,
    correct_percentage: 0, incorrect_percentage: 0,
  };
  maxTop = 1;
  maxMes = 1;

  ngOnChanges(): void {
    const revision = ++this.revision;
    if (!this.datos) return;
    const { resumen: r, filtros: f } = this.datos;
    this.categorizaciones = [
      {
        nombre: 'Correctas',
        cantidad: r.correct_count,
        porcentaje: r.correct_percentage,
        color: '#16835B',
      },
      {
        nombre: 'Incorrectas',
        cantidad: r.incorrect_count,
        porcentaje: r.incorrect_percentage,
        color: '#D95C4F',
      },
    ];
    this.motivos = this.datos.motivos.items.map((m) => ({
      nombre: m.reason === 'SIN_DATO' ? 'Sin dato' : m.reason,
      cantidad: m.total_tickets,
      porcentaje: m.percentage,
      color:
        m.reason === 'Atribuible a Cliente'
          ? '#FF620F'
          : m.reason === 'Atribuible a Canvia'
            ? '#16835B'
            : '#98A2B3',
    }));
    this.filtros = [
      `Periodo: ${this.fecha(f.desde)} — ${this.fecha(f.hasta)}`,
      `Grupo: ${f.grupo_resolutor || r.grupo_resolutor}`,
      `Proyecto: ${f.proyecto || 'Todos'}`,
      ...(f.resultado
        ? [`Resultado: ${f.resultado === 'CORRECT' ? 'Correctas' : 'Incorrectas'}`]
        : []),
      ...(f.motivo_resolucion ? [`Motivo: ${f.motivo_resolucion}`] : []),
      ...(f.mes ? [`Mes: ${this.mes(f.mes)}`] : []),
      ...(f.nombre_resolutor ? [`Colaborador: ${f.nombre_resolutor}`] : []),
      ...(f.ticket_id ? [`Ticket: ${f.ticket_id}`] : []),
    ];
    this.meses = [...this.datos.meses].sort((a, b) => a.month.localeCompare(b.month));
    this.colaboradores = [...this.datos.resolutores].sort((a, b) =>
      this.nombre(a.resolver_name).localeCompare(this.nombre(b.resolver_name), 'es'),
    );
    this.top = [...this.datos.resolutores]
      .filter((r) => r.total_tickets > 0)
      .sort(
        (a, b) =>
          b.total_tickets - a.total_tickets ||
          b.incorrect_count - a.incorrect_count ||
          this.nombre(a.resolver_name).localeCompare(
            this.nombre(b.resolver_name),
            'es'
          )
      )
      .slice(0, 10);
    const total = this.top.reduce((s, r) => s + r.total_tickets, 0);
    const correctas = this.top.reduce((s, r) => s + r.correct_count, 0);
    const incorrectas = this.top.reduce((s, r) => s + r.incorrect_count, 0);
    this.subtotalTop = {
      total_tickets: total, correct_count: correctas, incorrect_count: incorrectas,
      correct_percentage: total > 0 ? correctas * 100 / total : 0,
      incorrect_percentage: total > 0 ? incorrectas * 100 / total : 0,
    };
    this.maxTop = Math.max(1, ...this.top.map((r) => r.total_tickets));
    this.maxMes = Math.max(1, ...this.meses.map((r) => r.total_tickets));
    void this.esperarRender(revision, this.datos.version);
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    try {
      await document.fonts?.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth <= 0 || el.scrollHeight <= 0) throw new Error('dimensiones');
      this.renderizado.emit(version);
    } catch {
      if (revision === this.revision) this.errorRenderizado.emit(version);
    }
  }

  ngOnDestroy(): void {
    this.revision++;
  }

  nombre(valor: string | null): string {
    return valor?.trim() || 'Sin asignar';
  }
  fecha(valor?: string): string {
    return valor ? valor.split('-').reverse().join('/') : 'Sin límite';
  }
  mes(valor: string): string {
    const nombres = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${nombres[Number(valor.slice(5, 7)) - 1] || valor} ${valor.slice(0, 4)}`;
  }

  dona(segmentos: Segmento[]): string {
    const total = segmentos.reduce((s, f) => s + f.cantidad, 0);
    if (!total) return '#E5E9EE';
    let inicio = 0;
    const tramos = segmentos.map((s) => {
      const fin = inicio + (s.cantidad * 100) / total;
      const tramo = `${s.color} ${inicio}% ${fin}%`;
      inicio = fin;
      return tramo;
    });
    return `conic-gradient(${tramos.join(', ')})`;
  }
}
