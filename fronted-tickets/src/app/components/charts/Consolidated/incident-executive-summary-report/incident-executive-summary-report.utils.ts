import type { IncidentConsolidatedDashboardFilters, IncidentConsolidatedAtribucionItem } from '../../../../models/incident-consolidated';
import type { IncidentExecutiveSummaryData, IncidentExecutiveSummarySources } from '../../../../models/incident-executive-summary-report';

function exigir(ok: boolean, mensaje: string): void { if (!ok) throw new Error(mensaje); }
function cantidad(n: number): number { exigir(Number.isSafeInteger(n) && n >= 0, 'El resumen recibió cantidades inválidas.'); return n; }
function texto(s: string): boolean { return typeof s === 'string' && !!s.trim(); }
function tasa(valor: number, denominador: number, recibida: number): void {
  exigir(Number.isFinite(recibida) && Math.abs(recibida - (denominador ? valor * 100 / denominador : 0)) <= 0.005000001,
    'Los porcentajes del resumen no coinciden con sus denominadores.');
}
export function copiarFiltrosResumen(f: IncidentConsolidatedDashboardFilters): IncidentConsolidatedDashboardFilters {
  return {
    desde: f.desde, hasta: f.hasta, prioridad: f.prioridad, motivo_estado: f.motivo_estado, motivo_resolucion: f.motivo_resolucion,
    grupo_resolutor: f.grupo_resolutor, proyecto: f.proyecto, proyectos_excluidos: f.proyectos_excluidos ? [...f.proyectos_excluidos] : undefined,
    nombre_resolutor: f.nombre_resolutor, descripcion: f.descripcion, periodo: f.periodo,
    tipo_incidente: f.tipo_incidente ? [...f.tipo_incidente] : undefined, detalle_id: f.detalle_id, ticket_id: f.ticket_id
  };
}
export function claveResumen(f: IncidentConsolidatedDashboardFilters): string { return JSON.stringify(copiarFiltrosResumen(f)); }
export function fechasResumenValidas(f: IncidentConsolidatedDashboardFilters): boolean {
  const valida = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  return valida(f.desde) && valida(f.hasta) && f.desde! <= f.hasta! &&
    !(f.proyecto && f.proyectos_excluidos?.some(p => p.trim().toLowerCase() === f.proyecto!.trim().toLowerCase()));
}

/** El contrato público no expone evidencia_id ni prioridad numérica. El prompt
 * PROMPT_DECISIONES prioriza cruces/patrones; A01 es complementario de baja
 * prioridad. No se reconstruye el orden privado de evidencia_id desde Hxx/Cxx.
 * Los códigos solo desempatan de forma determinista, nunca indican importancia. */
export function prioridadResumen(tipo: string): number {
  return ['cruces', 'patrones'].includes(tipo) ? 0 : tipo === 'atribucion' ? 2 : 1;
}
const ordenar = (a: { tipo: string; codigo: string }, b: { tipo: string; codigo: string }) =>
  prioridadResumen(a.tipo) - prioridadResumen(b.tipo) || (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0);

export function crearResumenEjecutivo(fuentes: IncidentExecutiveSummarySources, filtrosEntrada: IncidentConsolidatedDashboardFilters,
  version: number, preparadoEn: string): IncidentExecutiveSummaryData {
  const filtros = copiarFiltrosResumen(filtrosEntrada), a = fuentes.ajustada, s = fuentes.servidores, ia = fuentes.analisis;
  exigir(fechasResumenValidas(filtros), 'Aplica fechas válidas y filtros compatibles antes de generar Reporte 1.');
  const total = cantidad(a.total_tickets), atribuidos = cantidad(a.total_atribuidos_original), sinAtribucion = cantidad(a.sin_atribucion_original);
  exigir(atribuidos + sinAtribucion === total && cantidad(a.total_atribuidos_ajustado) + cantidad(a.sin_atribucion_ajustado) === total,
    'La atribución definida y sin atribución no coincide con el total.');
  const categorias = ['Atribuible a Cliente', 'Atribuible a Canvia'];
  const distribucion = (items: IncidentConsolidatedAtribucionItem[], base: number) => {
    exigir(Array.isArray(items) && items.length === 2 && new Set(items.map(i => i.atribucion)).size === 2 && items.every(i => categorias.includes(i.atribucion)), 'La distribución de atribución está incompleta.');
    exigir(items.reduce((suma, i) => suma + cantidad(i.tickets), 0) === base, 'La distribución no coincide con el total atribuido.');
    items.forEach(i => tasa(i.tickets, base, i.porcentaje));
  };
  distribucion(a.distribucion_original, atribuidos); distribucion(a.distribucion_ajustada, a.total_atribuidos_ajustado);
  exigir(Array.isArray(a.comparacion) && a.comparacion.length === 2 && new Set(a.comparacion.map(i => i.atribucion)).size === 2, 'La comparación de atribución está incompleta.');
  a.comparacion.forEach(i => {
    const original = a.distribucion_original.find(x => x.atribucion === i.atribucion), ajustado = a.distribucion_ajustada.find(x => x.atribucion === i.atribucion);
    exigir(!!original && !!ajustado && i.tickets_originales === original.tickets && i.tickets_ajustados === ajustado.tickets &&
      i.variacion_tickets === i.tickets_ajustados - i.tickets_originales, 'La comparación no coincide con las distribuciones.');
    tasa(i.tickets_originales, atribuidos, i.porcentaje_original); tasa(i.tickets_ajustados, a.total_atribuidos_ajustado, i.porcentaje_ajustado);
  });
  exigir(typeof a.ajustes_habilitados === 'boolean' && texto(a.estado_ajuste) && texto(a.metodologia), 'Falta el estado metodológico de los ajustes.');
  cantidad(a.reglas_aprobadas); exigir(cantidad(a.ajustes_aplicados) <= total, 'Los ajustes aplicados superan el total.');
  exigir(a.ajustes_habilitados || (a.ajustes_aplicados === 0 && a.sin_atribucion_original === a.sin_atribucion_ajustado && a.comparacion.every(i => i.variacion_tickets === 0)), 'Se recibieron reasignaciones con ajustes deshabilitados.');
  exigir(cantidad(s.total_incidentes) === total && cantidad(s.incidentes_con_servidor) + cantidad(s.incidentes_sin_servidor) === total, 'Los totales de servidores y atribución no coinciden.');
  const identificados = cantidad(s.total_servidores_identificados), asociaciones = cantidad(s.total_asociaciones);
  exigir(Number.isSafeInteger(s.limite) && s.limite >= 1 && s.limite <= 50 && Array.isArray(s.servidores) && s.servidores.length === Math.min(s.limite, identificados) && s.servidores.length >= Math.min(5, identificados), 'El ranking disponible no contiene el Top 5 requerido.');
  exigir(asociaciones >= s.incidentes_con_servidor && asociaciones >= identificados && (identificados > 0 ? s.incidentes_con_servidor > 0 : asociaciones === 0 && s.incidentes_con_servidor === 0), 'Las asociaciones de servidores son incoherentes.');
  const nombres = new Set<string>(); let anterior = Infinity;
  s.servidores.forEach(i => {
    exigir(texto(i.servidor) && !nombres.has(i.servidor) && cantidad(i.incidentes) > 0 && i.incidentes <= s.incidentes_con_servidor && i.incidentes <= anterior, 'El ranking de servidores es incoherente.');
    nombres.add(i.servidor); anterior = i.incidentes; tasa(i.incidentes, total, i.porcentaje);
  });
  const subtotal = s.servidores.reduce((sum, i) => sum + i.incidentes, 0);
  exigir(Number.isSafeInteger(subtotal) && subtotal <= asociaciones && (s.servidores.length !== identificados || subtotal === asociaciones), 'El ranking no coincide con las asociaciones de servidores.');
  exigir(['ia', 'reglas', 'sin_datos'].includes(ia.origen) && (ia.modelo === null || texto(ia.modelo)) && (ia.advertencia === null || texto(ia.advertencia)), 'Falta la procedencia válida del análisis.');
  const h = ia.hallazgos, c = ia.conclusiones;
  exigir(h.total_incidentes === total && c.total_incidentes === total && h.estado_ajuste === a.estado_ajuste && c.estado_ajuste === a.estado_ajuste, 'El análisis vigente no coincide con el alcance de atribución.');
  exigir(Array.isArray(h.hallazgos) && Array.isArray(c.conclusiones) && h.total_hallazgos === h.hallazgos.length && c.total_conclusiones === c.conclusiones.length, 'El análisis está incompleto.');
  exigir(texto(h.metodologia) && texto(c.metodologia), 'Falta la metodología del análisis.');
  const codigos = new Set<string>();
  h.hallazgos.forEach(i => {
    exigir(texto(i.codigo) && !codigos.has(i.codigo) && texto(i.tipo) && texto(i.titulo) && texto(i.descripcion) && typeof i.requiere_validacion === 'boolean' && Number.isSafeInteger(i.valor), 'Hay hallazgos incompletos o duplicados.');
    codigos.add(i.codigo); if (i.denominador !== null) cantidad(i.denominador);
    if (i.porcentaje !== null) { exigir(i.denominador !== null, 'El porcentaje del hallazgo carece de denominador.'); tasa(i.valor, i.denominador!, i.porcentaje); }
  });
  const codigosConclusiones = new Set<string>();
  c.conclusiones.forEach(i => {
    exigir(texto(i.codigo) && !codigosConclusiones.has(i.codigo) && texto(i.tipo) && texto(i.titulo) && texto(i.conclusion) && texto(i.recomendacion) && typeof i.requiere_validacion === 'boolean' &&
      Array.isArray(i.hallazgos_referencia) && i.hallazgos_referencia.length > 0 && i.hallazgos_referencia.length <= 4 && new Set(i.hallazgos_referencia).size === i.hallazgos_referencia.length && i.hallazgos_referencia.every(ref => codigos.has(ref)), 'Hay conclusiones incompletas o referencias inválidas.');
    codigosConclusiones.add(i.codigo);
  });
  exigir(total === 0 || (ia.origen !== 'sin_datos' && h.hallazgos.length > 0 && c.conclusiones.length > 0), 'Espera a disponer de hallazgos, conclusión y recomendación vigentes.');
  const principal = [...c.conclusiones].sort(ordenar)[0] ?? null;
  const elegidos = new Set(principal?.hallazgos_referencia ?? []);
  [...h.hallazgos].sort(ordenar).forEach(i => { if (elegidos.size < 4) elegidos.add(i.codigo); });
  return {
    version, preparadoEn, filtros, total, atribuidos, sinAtribucion,
    ajustada: { ...a, distribucion_original: a.distribucion_original.map(i => ({ ...i })), distribucion_ajustada: a.distribucion_ajustada.map(i => ({ ...i })), comparacion: a.comparacion.map(i => ({ ...i })) },
    servidores: s.servidores.slice(0, 5).map(i => ({ servidor: i.servidor, incidentes: i.incidentes, porcentaje: i.porcentaje })),
    origen: ia.origen, modelo: ia.modelo, advertencia: ia.advertencia,
    hallazgos: h.hallazgos.filter(i => elegidos.has(i.codigo)).sort(ordenar).map(i => ({ ...i })), totalHallazgos: h.total_hallazgos,
    conclusion: principal ? { ...principal, hallazgos_referencia: [...principal.hallazgos_referencia] } : null,
    metodologia: h.metodologia === c.metodologia ? h.metodologia : `${h.metodologia} ${c.metodologia}`
  };
}
