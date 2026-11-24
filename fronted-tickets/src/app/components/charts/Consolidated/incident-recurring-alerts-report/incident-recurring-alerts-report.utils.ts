import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedIncidentesPorcentajesOut } from '../../../../models/incident-consolidated';
import { IncidentRecurringAlertsFilters, IncidentRecurringAlertsReportData } from '../../../../models/incident-recurring-alerts-report';

const numero = (n: number) => n.toLocaleString('es-PE');
const porcentaje = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const identidad = (s: string) => s.trim().toLocaleLowerCase();
function exigir(condicion: boolean, mensaje: string): void { if (!condicion) throw new Error(mensaje); }
function cantidad(n: number): number {
  exigir(Number.isSafeInteger(n) && n >= 0, 'R04 recibió cantidades inválidas o fuera de la precisión segura.');
  return n;
}

/** La selección explícita decide el modo, sin heredar selecciones dinámicas. */
export function filtrosReporteAlertas(f: IncidentConsolidatedDashboardFilters, proyecto: string | null): IncidentRecurringAlertsFilters {
  return { desde: f.desde, hasta: f.hasta, prioridad: f.prioridad, motivo_estado: f.motivo_estado,
    motivo_resolucion: f.motivo_resolucion, grupo_resolutor: f.grupo_resolutor,
    proyectos_excluidos: f.proyectos_excluidos ? [...f.proyectos_excluidos] : undefined,
    proyecto: proyecto?.trim() ? proyecto : undefined };
}

export function claveReporteAlertas(f: IncidentConsolidatedDashboardFilters, proyecto: string | null): string {
  return JSON.stringify(filtrosReporteAlertas(f, proyecto));
}

export function filtrosReporteAlertasValidos(f: IncidentRecurringAlertsFilters): boolean {
  const valida = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  return valida(f.desde) && valida(f.hasta) && f.desde! <= f.hasta! &&
    (!f.proyecto || !(f.proyectos_excluidos ?? []).some(p => identidad(p) === identidad(f.proyecto!)));
}

/** Única fuente analítica: respuesta de incidentes-porcentajes con limite=5. */
export function crearReporteAlertas(respuesta: IncidentConsolidatedIncidentesPorcentajesOut,
  filtrosEntrada: IncidentRecurringAlertsFilters, version: number, preparadoEn: string): IncidentRecurringAlertsReportData {
  const filtros = filtrosReporteAlertas(filtrosEntrada, filtrosEntrada.proyecto ?? null);
  exigir(filtrosReporteAlertasValidos(filtros), 'Aplica fechas válidas y un proyecto compatible con las exclusiones antes de generar Reporte 4.');
  exigir(respuesta.limite === 5 && Array.isArray(respuesta.descripciones) && respuesta.descripciones.length <= 5,
    'El ranking de Reporte 4 no respeta el límite de cinco descripciones.');
  const total = cantidad(respuesta.total_general);
  exigir(total > 0 ? respuesta.descripciones.length > 0 : respuesta.descripciones.length === 0,
    'El total general y el ranking de Reporte 4 no coinciden.');
  const nombres = new Set<string>();
  let anterior = Infinity;
  const alertas = respuesta.descripciones.map(item => {
    exigir(typeof item.descripcion === 'string' && !!item.descripcion.trim() && !nombres.has(item.descripcion.trim()),
      'El ranking de Reporte 4 contiene descripciones vacías o duplicadas.');
    nombres.add(item.descripcion.trim());
    const valor = cantidad(item.cantidad);
    exigir(valor > 0 && valor <= total && valor <= anterior, 'Las cantidades o el orden del ranking de Reporte 4 son incoherentes.');
    anterior = valor;
    const tasa = valor * 100 / total;
    exigir(Number.isFinite(item.porcentaje) && item.porcentaje >= 0 && item.porcentaje <= 100 && Math.abs(item.porcentaje - tasa) <= 0.005000001,
      'Los porcentajes de Reporte 4 no coinciden con el total general.');
    return { descripcion: item.descripcion, cantidad: valor, porcentaje: tasa };
  });
  const topTotal = cantidad(alertas.reduce((s, a) => s + a.cantidad, 0));
  exigir(topTotal <= total, 'El subtotal Top 5 supera el total general de Reporte 4.');
  // Contrato verificado en obtener_incidentes_porcentajes (repository): ambas
  // consultas aplican los mismos filtros; COALESCE incluye NULL/vacíos; no hay
  // HAVING ni descarte de categorías antes de LIMIT. Menos de cinco filas cubren
  // el universo solo bajo este contrato. Un incumplimiento bloquea el documento.
  exigir(alertas.length === 5 || topTotal === total,
    'El ranking incompleto no cubre el universo previsto por el contrato de Reporte 4. Actualiza y reintenta.');
  const otros = total - topTotal, participacionTop = total > 0 ? topTotal * 100 / total : 0;
  const participacionOtros = total > 0 ? otros * 100 / total : 0;
  const lideresVisibles = alertas.filter(a => a.cantidad === alertas[0]?.cantidad);
  const sinEspecificar = alertas.find(a => identidad(a.descripcion) === 'sin especificar');
  const avisoSinEspecificar = sinEspecificar
    ? `«Sin especificar» reúne ${numero(sinEspecificar.cantidad)} incidentes sin identificación específica de la descripción; no representa una causa técnica verificada.` : null;
  const modo = filtros.proyecto ? 'proyecto' : 'general';
  const hallazgos: string[] = [];
  if (total > 0) {
    const lider = alertas[0], segunda = alertas[1];
    hallazgos.push(!segunda ? 'Solo se devuelve una descripción en el alcance; no hay una segunda categoría con la que contrastar el registro.'
      : lideresVisibles.length > 1 ? `Empate visible: ${lideresVisibles.length} descripciones mostradas comparten el mayor registro, ${numero(lider.cantidad)} incidentes cada una. No se infieren empates fuera del corte.`
        : `La primera descripción supera a la segunda en ${numero(lider.cantidad - segunda.cantidad)} incidentes (${numero(lider.cantidad)} frente a ${numero(segunda.cantidad)}).`);
    hallazgos.push(otros > 0 ? `Otros reúne ${numero(otros)} incidentes fuera de las ${alertas.length} descripciones mostradas; el Top 5 no equivale al total general.`
      : `Las ${alertas.length} descripciones mostradas cubren los ${numero(total)} incidentes del alcance; no queda volumen adicional en Otros.`);
    hallazgos.push(avisoSinEspecificar ?? (alertas.length >= 3
      ? `Las dos primeras descripciones reúnen ${numero(alertas[0].cantidad + alertas[1].cantidad)} incidentes, ${porcentaje((alertas[0].cantidad + alertas[1].cantidad) * 100 / total)} % del total general filtrado.`
      : `El ranking contiene ${alertas.length} ${alertas.length === 1 ? 'descripción' : 'descripciones'}; estos conteos agregados no demuestran persistencia entre meses.`));
  }
  const conclusion = total > 0 ? `En el alcance ${modo === 'general' ? 'general' : 'del proyecto seleccionado'}, el Top 5 reúne ${numero(topTotal)} de ${numero(total)} incidentes (${porcentaje(participacionTop)} %). ${otros > 0 ? `Otros contiene los ${numero(otros)} restantes.` : 'Las descripciones mostradas abarcan todo el volumen filtrado.'} El ranking describe frecuencia por descripción, sin atribuir causas ni recurrencia temporal.` : '';
  const recomendaciones = total > 0 ? [
    `Revisar el detalle de ${lideresVisibles.length > 1 ? 'las descripciones empatadas en el mayor registro' : 'la descripción con mayor registro'}, con ${numero(alertas[0].cantidad)} incidentes por descripción, antes de priorizar acciones técnicas.`,
    otros > 0 ? `Ampliar el desglose de Otros (${numero(otros)} incidentes) para identificar descripciones fuera del Top 5.`
      : `Dar seguimiento a las ${alertas.length} descripciones mostradas, que abarcan todos los incidentes del alcance.`,
    sinEspecificar ? `Completar o verificar la descripción de los ${numero(sinEspecificar.cantidad)} incidentes agrupados como «Sin especificar» antes de asociarlos a una alerta concreta.`
      : `Contrastar el rango ${filtros.desde} a ${filtros.hasta} con otro período comparable antes de afirmar persistencia temporal.`,
  ] : [];
  return { version, preparadoEn, modo, filtros, total, topTotal, participacionTop, otros, participacionOtros, alertas, lideresVisibles,
    avisoSinEspecificar, hallazgos, conclusion, recomendaciones };
}
