import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { IncidentProjectReportData } from '../../../../models/incident-project-report';

interface MesVisual { indice: number; etiqueta: string; color: string; }
interface Barra { x: number; y: number; ancho: number; alto: number; valor: number; mes: number; etiquetar: boolean; etiquetaX: number; }
interface Grupo { nombre: string; clave: string | null; lineas: string[]; centro: number; barras: Barra[]; }
interface GraficoTop { id: string; meses: MesVisual[]; grupos: Grupo[]; maximo: number; alto: number; etiquetasCompletas: boolean; }
interface Punto { indice: number; etiqueta: string; anio: string; estado: string; x: number; y: number; valor: number; etiquetar: boolean; mostrarMes: boolean; }
interface GraficoTendencia { meses: Punto[]; maximo: number; linea: string; area: string; fuenteMes: number; }

function lineas(nombre: string, limite: number): string[] {
  const salida: string[] = [];
  let linea = '';
  for (const palabra of nombre.split(/\s+/)) {
    if (linea && linea.length + palabra.length + 1 > limite) { salida.push(linea); linea = ''; }
    let restante = palabra;
    while (restante.length > limite) {
      if (linea) { salida.push(linea); linea = ''; }
      salida.push(restante.slice(0, limite)); restante = restante.slice(limite);
    }
    if (restante) linea += `${linea ? ' ' : ''}${restante}`;
  }
  if (linea) salida.push(linea);
  return salida;
}

@Component({
  selector: 'app-incident-project-report',
  standalone: false,
  styleUrl: './incident-project-report.css',
  templateUrl: './incident-project-report.html',
})
export class IncidentProjectReport implements OnChanges, OnDestroy {
  @Input() datos!: IncidentProjectReportData;
  @Output() renderizado = new EventEmitter<number>();
  @Output() errorRenderizado = new EventEmitter<number>();
  @ViewChild('documento') documento?: ElementRef<HTMLElement>;
  readonly colores = ['#FF620F', '#16835B', '#E8AD24', '#63B891', '#D97706', '#12633F', '#F1C450', '#419F74', '#EE8C23', '#9EB64B', '#268C62', '#C7A232', '#E2762F', '#77A845', '#F2A14A', '#367D4C', '#D6BA38', '#55AE83'];
  readonly fracciones = [0, 0.25, 0.5, 0.75, 1];
  readonly iconos = {
    grafico: 'M4 3v21h21M9 18v-6m6 6V7m6 11v-9',
    dona: 'M13 3a11 11 0 1 0 11 12H13V3Zm4 0v8h8a10 10 0 0 0-8-8Z',
    tendencia: 'M3 21h23M5 17l6-8 6 5 7-10M18 4h6v6',
    hallazgos: 'M10 21h8m-7 4h6M9 17c-7-7-2-14 5-14s12 7 5 14l-1 3h-8l-1-3Z',
    conclusion: 'M7 3h12v21H4V6h3m0-3v3h9V3M8 12l3 3 6-6M8 20h8',
  };
  subtitulo = '';
  filtros: string[] = [];
  fuenteDona = 25;
  graficoTop?: GraficoTop;
  tendencia?: GraficoTendencia;
  segmentos: { nombre: string; cantidad: number; porcentaje: number; color: string; trazo: string; offset: number; otros: boolean }[] = [];
  hallazgos: { texto: string; partes: { texto: string; destacado: boolean }[] }[] = [];
  private revision = 0;
  private cancelarRender?: () => void;

  ngOnChanges(): void {
    const revision = ++this.revision;
    this.cancelarRender?.();
    if (!this.datos) return;
    const d = this.datos, f = d.filtros;
    this.subtitulo = `${f.grupo_resolutor || 'Todos los grupos'} | ${this.mes(f.desde!.slice(0, 7))} a ${this.mes(f.hasta!.slice(0, 7))}`;
    this.filtros = [
      `Fechas: ${this.fecha(f.desde!)} — ${this.fecha(f.hasta!)}`,
      ...([['Prioridad', f.prioridad], ['Motivo de estado', f.motivo_estado], ['Motivo de resolución', f.motivo_resolucion],
      ['Proyectos excluidos', f.proyectos_excluidos?.join(', ')]] as const).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`),
    ];
    this.prepararGraficos();
    this.fuenteDona = Math.min(25, 200 / this.numero(d.total).length);
    let acumulado = 0;
    const circunferencia = 2 * Math.PI * 72;
    this.segmentos = d.dona.map((s, i) => {
      const longitud = d.total > 0 ? s.cantidad / d.total * circunferencia : 0;
      const segmento = {
        ...s, nombre: s.otros ? 'Otros (resto de proyectos)' : s.nombre,
        color: s.otros ? '#8795A5' : this.color(i), trazo: `${longitud} ${circunferencia}`, offset: -acumulado
      };
      acumulado += longitud;
      return segmento;
    });
    this.hallazgos = d.hallazgos.map(texto => ({
      texto, partes: texto.split(/([+-]?\d[\d.,]*(?:\s*%)?)/g)
        .filter(Boolean).map(parte => ({ texto: parte, destacado: /\d/.test(parte) }))
    }));
    void this.esperarRender(revision, d.version);
  }

  private prepararGraficos(): void {
    const d = this.datos;
    const meses: MesVisual[] = d.mensual.meses.map((m, indice) => ({ indice, etiqueta: m.etiqueta, color: this.color(indice) }));
    const maximoCelda = d.top.reduce((max, p) => p.mensual.reduce((n, v) => Math.max(n, v), max), 0);
    const maximo = Math.max(4, Math.ceil(maximoCelda / 4) * 4);
    const anchoGrupo = 998 / Math.max(1, d.top.length);
    const slot = (anchoGrupo - 14) / Math.max(1, meses.length);

    const etiquetasCompletas = slot >= this.numero(maximoCelda).length * 8 + 5;
    const grupos: Grupo[] = d.top.map((p, i) => {
      const nombreEnvuelto = lineas(p.proyecto, Math.max(8, Math.floor((anchoGrupo - 8) / 8)));
      const clave = nombreEnvuelto.length > 7 ? `P${i + 1}` : null;
      const centro = 82 + (i + 0.5) * anchoGrupo;
      const pico = p.mensual.indexOf(Math.max(...p.mensual));
      return {
        nombre: p.proyecto, clave, lineas: clave ? [clave] : nombreEnvuelto, centro,
        barras: meses.map((m, j) => {
          const valor = p.mensual[m.indice], alto = valor / maximo * 190;
          const x = 82 + i * anchoGrupo + 7 + j * slot + slot * 0.14;

          return {
            x,
            y: 240 - alto,
            ancho: slot * 0.72,
            alto,
            valor,
            mes: m.indice,
            etiquetar: valor > 0,
            etiquetaX: x + slot * 0.42
          };

        })
      };
    });
    this.graficoTop = {
      id: `r02-${d.version}-top`, meses, grupos, maximo, etiquetasCompletas,
      alto: 278 + Math.max(1, ...grupos.map(g => g.lineas.length)) * 16
    };
    const maximoMes = Math.max(4, Math.ceil((d.mensual.maximos[0]?.tickets ?? 0) / 4) * 4);
    const espacio = 510 / Math.max(1, meses.length - 1);
    const pasoValor = Math.max(1, Math.ceil((this.numero(maximoMes).length * 10 + 6) * 1.5 / espacio));
    const pasoMes = Math.max(1, Math.ceil(32 / espacio));
    const visible = (i: number, paso: number) => i === meses.length - 1 || (i % paso === 0 && (i === 0 || meses.length - 1 - i >= paso));
    const puntos: Punto[] = meses.map(m => {
      const origen = d.mensual.meses[m.indice];
      return {
        indice: m.indice, etiqueta: origen.etiqueta.split(' ')[0], anio: origen.periodo.slice(0, 4), estado: origen.estado,
        x: meses.length === 1 ? 335 : 80 + m.indice * espacio, y: 185 - origen.tickets / maximoMes * 130, valor: origen.tickets,
        etiquetar: visible(m.indice, pasoValor), mostrarMes: visible(m.indice, pasoMes)
      };
    });
    const linea = puntos.map(p => `${p.x},${p.y}`).join(' ');
    this.tendencia = {
      meses: puntos, maximo: maximoMes, linea,
      area: puntos.length ? `${puntos[0].x},185 ${linea} ${puntos.at(-1)!.x},185` : '',
      fuenteMes: Math.max(11, Math.min(18, espacio / 2.7))
    };
  }

  private async esperarRender(revision: number, version: number): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let cancelar: (() => void) | undefined;
    try {
      await Promise.race([
        (async () => { await document.fonts?.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); })(),
        new Promise<never>((_, reject) => {
          cancelar = () => reject(new Error('cancelado')); this.cancelarRender = cancelar;
          temporizador = setTimeout(() => reject(new Error('timeout')), 30000);
        }),
      ]);
      if (revision !== this.revision) return;
      const el = this.documento?.nativeElement;
      if (!el || el.scrollWidth !== 1400 || el.scrollHeight <= 0) throw new Error('dimensiones');
      this.renderizado.emit(version);
    } catch { if (revision === this.revision) this.errorRenderizado.emit(version); }
    finally { clearTimeout(temporizador); if (this.cancelarRender === cancelar) this.cancelarRender = undefined; }
  }

  ngOnDestroy(): void { ++this.revision; this.cancelarRender?.(); }
  color(i: number): string { return this.colores[i % this.colores.length]; }
  claro(i: number): string {
    const c = this.color(i).slice(1);
    return `rgb(${[0, 2, 4].map(n => { const v = parseInt(c.slice(n, n + 2), 16); return Math.round(v + (255 - v) * 0.35); }).join(',')})`;
  }
  numero(n: number): string { return n.toLocaleString('es-PE'); }
  porcentaje(n: number): string { return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fecha(v: string): string { return v.split('-').reverse().join('/'); }
  mes(v: string): string { return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}-01T00:00:00Z`)); }
}
