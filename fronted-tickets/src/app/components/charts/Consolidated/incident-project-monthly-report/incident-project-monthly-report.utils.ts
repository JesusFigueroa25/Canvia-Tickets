import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedVolumenItem } from '../../../../models/incident-consolidated';
import { IncidentMonthlyAvailability, IncidentMonthlyVariation } from '../../../../models/incident-monthly-report';
import { IncidentProjectMonthlyFilters, IncidentProjectMonthlyReportData, IncidentProjectMonthlyResponses } from '../../../../models/incident-project-monthly-report';
import { crearReporteMensual } from '../incident-monthly-report/incident-monthly-report.utils';

const identidad = (p: string) => p.trim().toLocaleLowerCase();
const numero = (n: number) => n.toLocaleString('es-PE');
const tasa = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function exigir(condicion: boolean, mensaje: string): void { if (!condicion) throw new Error(mensaje); }
function cantidad(n: number): number {
  exigir(Number.isSafeInteger(n) && n >= 0, 'R03 recibió cantidades inválidas.');
  return n;
}

/** La selección explícita es la identidad; no se heredan filtros dinámicos. */
export function filtrosReporteProyectoMensual(f: IncidentConsolidatedDashboardFilters, proyecto: string | null): IncidentProjectMonthlyFilters {
  return { desde: f.desde, hasta: f.hasta, prioridad: f.prioridad, motivo_estado: f.motivo_estado,
    motivo_resolucion: f.motivo_resolucion, grupo_resolutor: f.grupo_resolutor,
    proyectos_excluidos: f.proyectos_excluidos ? [...f.proyectos_excluidos] : undefined, proyecto: proyecto ?? '' };
}

export function claveProyectoMensual(f: IncidentConsolidatedDashboardFilters, proyecto: string | null): string {
  return JSON.stringify(filtrosReporteProyectoMensual(f, proyecto));
}

export function seleccionProyectoMensualValida(f: IncidentProjectMonthlyFilters): boolean {
  const fechaValida = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  return !!f.proyecto.trim() && fechaValida(f.desde) && fechaValida(f.hasta) && f.desde! <= f.hasta! &&
    !(f.proyectos_excluidos ?? []).some(p => identidad(p) === identidad(f.proyecto));
}

export function textoCambioProyecto(v: IncidentMonthlyVariation): string {
  return `${v.desde.etiqueta} → ${v.hasta.etiqueta}: ${v.diferencia > 0 ? '+' : ''}${numero(v.diferencia)} tickets (${v.porcentaje === null ? 'porcentaje no calculable por base cero' : `${tasa(v.porcentaje)} %`}).`;
}

/** Adapta el ranking YA filtrado; nunca selecciona un proyecto de un Top 10 general. */
export function crearReporteProyectoMensual(r: IncidentProjectMonthlyResponses, filtros: IncidentProjectMonthlyFilters,
  disponibilidad: IncidentMonthlyAvailability, version: number, preparadoEn: string): IncidentProjectMonthlyReportData {
  exigir(seleccionProyectoMensualValida(filtros), 'Selecciona un proyecto compatible con las exclusiones y aplica fechas válidas para R03.');
  const copia = filtrosReporteProyectoMensual(filtros, filtros.proyecto);
  const total = cantidad(r.kpis.total_tickets);
  exigir(r.top.proyectos.length === (total > 0 ? 1 : 0), 'El ranking filtrado no corresponde exclusivamente al proyecto de R03.');
  const registros: IncidentConsolidatedVolumenItem[] = [];
  if (total > 0) {
    const proyecto = r.top.proyectos[0];
    exigir(typeof proyecto.proyecto === 'string' && identidad(proyecto.proyecto) === identidad(copia.proyecto), 'El proyecto recibido no coincide con el seleccionado para R03.');
    const etiquetas = new Set<string>(), meses = new Set<string>();
    const conteos = new Map<string, number>();
    for (const m of proyecto.mensual) {
      exigir(typeof m.periodo === 'string' && !conteos.has(m.periodo), 'El detalle mensual de R03 está duplicado o es inválido.');
      conteos.set(m.periodo, cantidad(m.tickets));
    }
    for (const p of r.top.periodos) {
      const iso = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
      exigir(Number.isInteger(p.anio) && p.anio >= 1900 && p.anio <= 9999 && Number.isInteger(p.mes) && p.mes >= 1 && p.mes <= 12 &&
        typeof p.periodo === 'string' && !!p.periodo.trim() && !etiquetas.has(p.periodo) && !meses.has(iso) && conteos.has(p.periodo),
      'Los períodos de R03 son inválidos, ambiguos o incompletos.');
      etiquetas.add(p.periodo); meses.add(iso);
      registros.push({ anio: p.anio, mes: p.mes, periodo: p.periodo, tickets: conteos.get(p.periodo)! });
    }
    exigir(conteos.size === etiquetas.size && cantidad(proyecto.total_tickets) === total, 'Los totales del proyecto y KPI de R03 no coinciden.');
  } else {
    exigir(r.top.periodos.length === 0, 'El ranking vacío de R03 contiene períodos inesperados.');
  }
  // Contrato R01: copia entradas; ordena/completa meses; expone variaciones consecutivas,
  // pero NO expone la variación general. Esta se deriva aquí sin alterar R01.
  const mensual = crearReporteMensual(registros, copia, disponibilidad, version, version, preparadoEn);
  exigir(mensual.total === total && (total === 0 || mensual.meses.length === registros.length), 'La serie mensual de R03 no cubre el rango o no coincide con el KPI.');
  const completos = mensual.meses.filter(m => m.estado === 'completo');
  const primero = completos[0], ultimo = completos.at(-1);
  const variacionPeriodo = completos.length >= 2 && mensual.variaciones.length === completos.length - 1
    ? { desde: primero, hasta: ultimo!, diferencia: ultimo!.tickets - primero.tickets,
      porcentaje: primero.tickets > 0 ? (ultimo!.tickets - primero.tickets) * 100 / primero.tickets : null } : null;
  const usados = new Set<string>();
  const clave = (v: IncidentMonthlyVariation) => `${v.desde.periodo}/${v.hasta.periodo}`;
  const hallazgos: string[] = [];
  if (total > 0) {
    hallazgos.push(variacionPeriodo ? `Variación del período comparable: ${textoCambioProyecto(variacionPeriodo)}`
      : 'No hay al menos dos meses completos consecutivos con cobertura confirmada para calcular la variación del período.');
    if (variacionPeriodo) usados.add(clave(variacionPeriodo));
    const crecimiento = mensual.variaciones.filter(v => v.diferencia > 0 && !usados.has(clave(v))).sort((a, b) =>
      (b.porcentaje ?? -1) - (a.porcentaje ?? -1) || (a.porcentaje === null && b.porcentaje === null ? b.diferencia - a.diferencia : 0))[0];
    if (crecimiento) { hallazgos.push(`Mayor incremento mensual comparable: ${textoCambioProyecto(crecimiento)}`); usados.add(clave(crecimiento)); }
    const reduccion = mensual.variaciones.filter(v => v.diferencia < 0 && !usados.has(clave(v))).sort((a, b) => a.porcentaje! - b.porcentaje!)[0];
    if (reduccion) {
      const posterior = mensual.variaciones.find(v => v.desde.periodo === reduccion.hasta.periodo && v.diferencia > 0);
      const seguimiento = posterior ? posterior.hasta.tickets >= reduccion.desde.tickets
        ? ` ${posterior.hasta.etiqueta} registra ${numero(posterior.hasta.tickets)} tickets y recupera el nivel previo de ${reduccion.desde.etiqueta}, sin acreditar continuidad.`
        : ` ${posterior.hasta.etiqueta} registra ${numero(posterior.hasta.tickets)} tickets: repunte parcial, aún por debajo de ${reduccion.desde.etiqueta}.` : '';
      hallazgos.push(`Mayor reducción mensual comparable: ${textoCambioProyecto(reduccion)}${seguimiento}`);
    }
    const maximo = mensual.maximos[0];
    if (hallazgos.length < 3) hallazgos.push(`Mayor registro visible: ${maximo.etiqueta}, ${numero(maximo.tickets)} tickets${mensual.maximos.length > 1 ? `; empate entre ${mensual.maximos.length} meses` : ''}.`);
    const ceros = mensual.meses.filter(m => m.tickets === 0).length;
    if (hallazgos.length < 3 && ceros > 0) hallazgos.push(`${ceros} de los ${mensual.meses.length} meses visibles registran cero tickets; este conteo no demuestra ausencia de incidencias no importadas.`);
    if (hallazgos.length < 3) hallazgos.push(`Cobertura de calendario: ${completos.length} de ${mensual.meses.length} meses completos comparables; ${mensual.meses.length - completos.length} parciales o sin cobertura confirmada.`);
  }
  const pico = mensual.maximos[0];
  const conclusion = total > 0 ? `El proyecto registra ${numero(total)} tickets en los ${mensual.meses.length} meses visibles. ${variacionPeriodo
    ? `Entre ${variacionPeriodo.desde.etiqueta} y ${variacionPeriodo.hasta.etiqueta}, el cierre ${variacionPeriodo.diferencia > 0 ? 'supera' : variacionPeriodo.diferencia < 0 ? 'queda por debajo de' : 'iguala'} el registro inicial; el cambio neto no acredita una tendencia sostenida.`
    : 'La cobertura disponible no permite establecer una variación comparable del período.'}` : '';
  const recomendaciones = total > 0 ? [
    `Revisar la capacidad de atención frente al máximo de ${numero(pico.tickets)} tickets de ${pico.etiqueta}${mensual.maximos.length > 1 ? ` y sus ${mensual.maximos.length - 1} meses empatados` : ''}, sin inferir sobrecarga solo por volumen.`,
    !variacionPeriodo ? 'Mantener el seguimiento mensual del proyecto antes de ajustar capacidad a partir de meses no comparables.'
      : variacionPeriodo.diferencia > 0 ? 'Dar seguimiento a los próximos meses completos para comprobar si continúa el aumento observado.'
        : variacionPeriodo.diferencia < 0 ? 'Comprobar si el descenso continúa en los próximos meses completos antes de ajustar capacidad.'
          : 'Revisar las variaciones intermedias: igualar los extremos no demuestra estabilidad durante el período.',
    completos.length < mensual.meses.length
      ? `Verificar cobertura de los ${mensual.meses.length - completos.length} meses parciales o no confirmados antes de incorporarlos a comparaciones.`
      : `Contrastar el comportamiento del proyecto en el siguiente mes completo con ${ultimo?.etiqueta ?? pico.etiqueta}, sin atribuir causas técnicas a estos conteos.`,
  ] : [];
  return { version, preparadoEn, proyecto: copia.proyecto, filtros: copia, mensual, variacionPeriodo, hallazgos: hallazgos.slice(0, 3), conclusion, recomendaciones };
}
