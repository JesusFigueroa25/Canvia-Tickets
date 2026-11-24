import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedProyectoItem } from '../../../../models/incident-consolidated';
import { IncidentMonthlyAvailability } from '../../../../models/incident-monthly-report';
import { IncidentProjectReportData, IncidentProjectReportFilters, IncidentProjectReportResponses, IncidentProjectSeries } from '../../../../models/incident-project-report';
import { crearReporteMensual } from '../incident-monthly-report/incident-monthly-report.utils';

/** Lista positiva: nunca heredar una selección dinámica del dashboard. */
export function filtrosReporteProyectos(f: IncidentConsolidatedDashboardFilters): IncidentProjectReportFilters {
  return {
    desde: f.desde, hasta: f.hasta, prioridad: f.prioridad,
    motivo_estado: f.motivo_estado, motivo_resolucion: f.motivo_resolucion,
    grupo_resolutor: f.grupo_resolutor,
    proyectos_excluidos: f.proyectos_excluidos ? [...f.proyectos_excluidos] : undefined,
  };
}

export function claveFiltrosProyectos(f: IncidentConsolidatedDashboardFilters): string {
  return JSON.stringify(filtrosReporteProyectos(f));
}

export function rangoProyectosValido(f: IncidentProjectReportFilters): boolean {
  const valida = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  return valida(f.desde) && valida(f.hasta) && f.desde! <= f.hasta!;
}

const numero = (n: number) => n.toLocaleString('es-PE');
const porcentaje = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function cantidad(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Los agregados contienen cantidades inválidas.');
  return n;
}
function suma(ns: readonly number[]): number { return cantidad(ns.reduce((s, n) => s + cantidad(n), 0)); }
function exigir(condicion: boolean, mensaje: string): void { if (!condicion) throw new Error(mensaje); }

/** Reconcilia primero los denominadores; después calcula gráficos y textos. */
export function crearReporteProyectos(
  r: IncidentProjectReportResponses, filtrosEntrada: IncidentConsolidatedDashboardFilters,
  disponibilidad: IncidentMonthlyAvailability, version: number, preparadoEn: string,
): IncidentProjectReportData {
  const filtros = filtrosReporteProyectos(filtrosEntrada);
  exigir(rangoProyectosValido(filtros), 'Aplica un rango de fechas válido antes de generar Reporte 2.');
  const mensual = crearReporteMensual(r.volumen, filtros, disponibilidad, version, version, preparadoEn);
  const total = cantidad(r.kpis.total_tickets);
  const nombres = new Set<string>();
  const excluidos = new Set((filtros.proyectos_excluidos ?? []).map(p => p.trim().toLocaleLowerCase()));
  const distribucion: IncidentConsolidatedProyectoItem[] = r.proyectos.map(p => {
    exigir(typeof p.proyecto === 'string' && p.proyecto.trim().length > 0, 'La distribución contiene un proyecto sin identificar.');
    const nombre = p.proyecto.trim();
    exigir(!nombres.has(nombre), 'La distribución contiene proyectos duplicados.');
    exigir(!excluidos.has(nombre.toLocaleLowerCase()), 'La distribución contiene un proyecto excluido.');
    nombres.add(nombre);
    return { proyecto: nombre, cantidad: cantidad(p.cantidad) };
  }).sort((a, b) => b.cantidad - a.cantidad || a.proyecto.localeCompare(b.proyecto, 'es'));
  exigir(suma(distribucion.map(p => p.cantidad)) === total && mensual.total === total,
    'Los totales de KPI, proyectos y volumen mensual no coinciden. Actualiza los datos y reintenta.');

  const porNombre = new Map(distribucion.map(p => [p.proyecto, p.cantidad]));
  const mesesPorEtiqueta = new Map<string, number>();
  const periodos = new Set<string>();
  for (const p of r.top.periodos) {
    exigir(Number.isInteger(p.anio) && p.anio >= 1900 && p.anio <= 9999 && Number.isInteger(p.mes) && p.mes >= 1 && p.mes <= 12,
      'El ranking contiene un período inválido.');
    const iso = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
    const indice = mensual.meses.findIndex(m => m.periodo === iso);
    exigir(indice >= 0 && !periodos.has(iso) && typeof p.periodo === 'string' && !mesesPorEtiqueta.has(p.periodo),
      'Los períodos del ranking son ambiguos, duplicados o ajenos al rango.');
    periodos.add(iso); mesesPorEtiqueta.set(p.periodo, indice);
  }
  if (total > 0) exigir(periodos.size === mensual.meses.length, 'El ranking no cubre todos los meses del rango.');
  const vistos = new Set<string>();
  const top: IncidentProjectSeries[] = r.top.proyectos.map(p => {
    exigir(typeof p.proyecto === 'string' && porNombre.has(p.proyecto) && !vistos.has(p.proyecto),
      'El ranking contiene proyectos duplicados o ajenos a la distribución.');
    vistos.add(p.proyecto);
    const valores = mensual.meses.map(() => 0);
    const mesesVistos = new Set<number>();
    for (const m of p.mensual) {
      const indice = mesesPorEtiqueta.get(m.periodo);
      exigir(indice !== undefined && !mesesVistos.has(indice), 'El detalle mensual del ranking es inválido o está duplicado.');
      mesesVistos.add(indice!); valores[indice!] = cantidad(m.tickets);
    }
    exigir(mesesVistos.size === periodos.size && suma(valores) === cantidad(p.total_tickets) &&
      p.total_tickets === porNombre.get(p.proyecto), 'Los totales del ranking no coinciden con la distribución por proyecto.');
    return { proyecto: p.proyecto, total: p.total_tickets, mensual: valores };
  });
  exigir(top.length === Math.min(10, distribucion.filter(p => p.cantidad > 0).length), 'El ranking Top 10 está incompleto.');
  const minimoTop = top.length ? Math.min(...top.map(p => p.total)) : 0;
  exigir(!distribucion.some(p => !vistos.has(p.proyecto) && p.cantidad > minimoTop), 'El ranking no contiene los proyectos de mayor demanda.');
  mensual.meses.forEach((m, i) => exigir(suma(top.map(p => p.mensual[i])) <= m.tickets,
    'El subtotal mensual del Top 10 supera el total general del mes.'));
  const subtotalTop = suma(top.map(p => p.total));
  const cinco = distribucion.filter(p => p.cantidad > 0).slice(0, 5);
  const acumulado = suma(cinco.map(p => p.cantidad));
  const otros = total - acumulado;
  const dona = [...cinco.map(p => ({
    clave: `proyecto:${p.proyecto}`, nombre: p.proyecto, cantidad: p.cantidad,
    porcentaje: total > 0 ? p.cantidad * 100 / total : 0, otros: false,
  })), { clave: 'resto', nombre: 'Otros', cantidad: otros, porcentaje: total > 0 ? otros * 100 / total : 0, otros: true }];
  const lideres = distribucion.filter(p => total > 0 && p.cantidad === distribucion[0]?.cantidad);
  const lider = lideres[0];
  const ultima = mensual.variaciones.at(-1);
  const tasa = ultima?.porcentaje === null ? 'porcentaje no calculable por base cero' : `${porcentaje(ultima?.porcentaje ?? 0)} %`;
  const hallazgos = total > 0 ? [
    `${lider.proyecto} registra la mayor demanda: ${numero(lider.cantidad)} tickets (${porcentaje(lider.cantidad * 100 / total)} %)${lideres.length > 1 ? `; hay ${lideres.length} proyectos empatados` : ''}.`,
    `Los ${cinco.length} proyectos principales reúnen ${numero(acumulado)} tickets (${porcentaje(acumulado * 100 / total)} %); Otros agrupa ${numero(otros)} tickets de ${distribucion.filter(p => p.cantidad > 0).length - cinco.length} proyectos.`,
    ultima ? `Último par completo consecutivo, ${ultima.desde.etiqueta} → ${ultima.hasta.etiqueta}: ${ultima.diferencia > 0 ? '+' : ''}${numero(ultima.diferencia)} tickets (${tasa}).`
      : 'No hay dos meses completos consecutivos con cobertura confirmada para comparar la evolución mensual.',
  ] : [];
  const conclusion = total > 0
    ? `Se registran ${numero(total)} tickets entre ${distribucion.filter(p => p.cantidad > 0).length} proyectos; los ${cinco.length} principales representan ${porcentaje(acumulado * 100 / total)} % del total. ${mensual.conclusion}` : '';
  const recomendaciones = total > 0 ? [
    `Revisar la capacidad de atención asignada a ${lider.proyecto}, que reúne ${numero(lider.cantidad)} tickets en el período${lideres.length > 1 ? ', considerando los demás proyectos empatados' : ''}.`,
    otros > 0 ? `Revisar el desglose de Otros: ${numero(otros)} tickets distribuidos entre ${distribucion.filter(p => p.cantidad > 0).length - cinco.length} proyectos.`
      : `Mantener el seguimiento comparativo de los ${cinco.length} proyectos con tickets; no hay volumen adicional agrupado en Otros.`,
    mensual.recomendacion,
  ] : [];
  return { version, preparadoEn, filtros, total, distribucion, lideres, mensual, top, subtotalTop, dona, hallazgos, conclusion, recomendaciones };
}
