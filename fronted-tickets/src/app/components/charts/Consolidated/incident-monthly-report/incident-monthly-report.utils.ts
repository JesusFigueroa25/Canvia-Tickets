import { IncidentConsolidatedDashboardFilters, IncidentConsolidatedVolumenItem } from '../../../../models/incident-consolidated';
import { IncidentMonthlyAvailability, IncidentMonthlyMonth, IncidentMonthlyReportData, IncidentMonthlyReportFilters, IncidentMonthlyVariation } from '../../../../models/incident-monthly-report';

export function filtrosReporteMensual(filtros: IncidentConsolidatedDashboardFilters): IncidentMonthlyReportFilters {
  const { periodo: _periodo, ...efectivos } = structuredClone(filtros);
  return efectivos;
}

export function fechaLima(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function validarFecha(valor: string): string {
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new Error('El reporte recibió una fecha inválida.');
  }
  return valor;
}

const numero = (n: number) => n.toLocaleString('es-PE');
const porcentaje = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function variacion(desde: IncidentMonthlyMonth, hasta: IncidentMonthlyMonth): IncidentMonthlyVariation {
  const diferencia = hasta.tickets - desde.tickets;
  return { desde, hasta, diferencia, porcentaje: desde.tickets > 0 ? diferencia * 100 / desde.tickets : null };
}

function textoVariacion(v: IncidentMonthlyVariation): string {
  const cambio = `${v.diferencia > 0 ? '+' : ''}${numero(v.diferencia)} incidentes`;
  const tasa = v.porcentaje === null ? 'porcentaje no calculable por base cero' : `${porcentaje(v.porcentaje)} %`;
  return `${v.desde.etiqueta} → ${v.hasta.etiqueta}: ${cambio} (${tasa}).`;
}

/** Una sola respuesta mensual es la fuente de todos los valores del documento. */
export function crearReporteMensual(
  registros: readonly IncidentConsolidatedVolumenItem[],
  filtrosEntrada: IncidentConsolidatedDashboardFilters,
  disponibilidadEntrada: IncidentMonthlyAvailability,
  version: number,
  solicitud: number,
  preparadoEn: string,
): IncidentMonthlyReportData {
  const filtros = filtrosReporteMensual(filtrosEntrada);
  const disponibilidad = { ...disponibilidadEntrada };
  const hoy = fechaLima(new Date(preparadoEn));
  const desde = filtros.desde ? validarFecha(filtros.desde) : undefined;
  const hasta = filtros.hasta ? validarFecha(filtros.hasta) : undefined;
  const disponibleDesde = disponibilidad.fecha_min ? validarFecha(disponibilidad.fecha_min) : undefined;
  const disponibleHasta = disponibilidad.fecha_max ? validarFecha(disponibilidad.fecha_max) : undefined;
  if ((desde && hasta && desde > hasta) || (disponibleDesde && disponibleHasta && disponibleDesde > disponibleHasta)) {
    throw new Error('El rango de fechas del reporte no es válido.');
  }
  const valores = new Map<string, number>();
  for (const item of registros) {
    if (!Number.isInteger(item.anio) || item.anio < 1900 || item.anio > 9999 ||
      !Number.isInteger(item.mes) || item.mes < 1 || item.mes > 12 ||
      !Number.isSafeInteger(item.tickets) || item.tickets < 0) {
      throw new Error('El volumen mensual contiene valores inválidos.');
    }
    const clave = `${item.anio}-${String(item.mes).padStart(2, '0')}`;
    if (valores.has(clave) || (desde && clave < desde.slice(0, 7)) || (hasta && clave > hasta.slice(0, 7))) {
      throw new Error('El volumen mensual contiene meses duplicados o fuera del rango solicitado.');
    }
    valores.set(clave, item.tickets);
  }
  const claves = [...valores.keys()].sort();
  const inicio = desde?.slice(0, 7) ?? claves[0];
  const fin = hasta?.slice(0, 7) ?? claves.at(-1);
  const meses: IncidentMonthlyMonth[] = [];
  // Una respuesta vacía no constituye evidencia para inventar una serie de ceros.
  if (claves.length && inicio && fin) {
    const [anioInicio, mesInicio] = inicio.split('-').map(Number);
    const [anioFin, mesFin] = fin.split('-').map(Number);
    for (let indice = anioInicio * 12 + mesInicio - 1; indice <= anioFin * 12 + mesFin - 1; indice++) {
      const anio = Math.floor(indice / 12), mes = indice % 12 + 1;
      const periodo = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
      const primerDia = `${periodo}-01`;
      const fechaFin = new Date(`${primerDia}T00:00:00Z`);
      fechaFin.setUTCMonth(fechaFin.getUTCMonth() + 1, 0);
      const ultimoDia = `${periodo}-${fechaFin.getUTCDate()}`;
      const cubierto = (!desde || desde <= primerDia) && (!hasta || hasta >= ultimoDia) &&
        disponibleDesde !== undefined && disponibleDesde <= primerDia &&
        disponibleHasta !== undefined && disponibleHasta >= ultimoDia && ultimoDia < hoy;
      meses.push({
        periodo,
        etiqueta: new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(`${primerDia}T00:00:00Z`)),
        tickets: valores.get(periodo) ?? 0,
        estado: !disponibleDesde || !disponibleHasta ? 'no_confirmado' : cubierto ? 'completo' : 'parcial',
        sinRegistros: !valores.has(periodo),
      });
    }
  }
  const total = meses.reduce((s, m) => s + m.tickets, 0);
  if (!Number.isSafeInteger(total)) throw new Error('El total de incidentes supera la precisión admitida.');
  const mayor = meses.reduce((n, m) => Math.max(n, m.tickets), 0);
  const menor = meses.reduce((n, m) => Math.min(n, m.tickets), Infinity);
  const maximos = meses.filter(m => m.tickets === mayor);
  const minimos = meses.filter(m => m.tickets === menor);
  const variaciones = meses.slice(1).flatMap((m, i) =>
    m.estado === 'completo' && meses[i].estado === 'completo' ? [variacion(meses[i], m)] : []);
  // El orden original resuelve los empates cronológicamente (sort es estable).
  const crecimiento = variaciones.filter(v => v.diferencia > 0).sort((a, b) =>
    (b.porcentaje ?? -1) - (a.porcentaje ?? -1) || (a.porcentaje === null && b.porcentaje === null ? b.diferencia - a.diferencia : 0))[0];
  const reduccion = variaciones.filter(v => v.diferencia < 0).sort((a, b) =>
    (a.porcentaje ?? 0) - (b.porcentaje ?? 0))[0];
  const completos = meses.filter(m => m.estado === 'completo');
  const general = completos.length >= 2 && variaciones.length === completos.length - 1
    ? variacion(completos[0], completos[completos.length - 1]) : null;
  const hallazgos: string[] = [];
  if (total > 0) {
    hallazgos.push(maximos.length === meses.length
      ? `Registro uniforme: los ${meses.length} meses visibles registran ${numero(mayor)} incidentes cada uno.`
      : `Mayor registro: ${maximos[0].etiqueta}, con ${numero(mayor)} incidentes${maximos.length > 1 ? `; empate entre ${maximos.length} meses` : ''}.`);
    if (crecimiento) hallazgos.push(`Mayor crecimiento mensual comparable: ${textoVariacion(crecimiento)}`);
    if (reduccion) hallazgos.push(`Mayor reducción mensual comparable: ${textoVariacion(reduccion)}`);
    const generalRepetida = general && [crecimiento, reduccion].some(v =>
      v && v.diferencia === general.diferencia && v.porcentaje === general.porcentaje);
    if (general && completos.length > 2 && !generalRepetida && variaciones.some(v => v.diferencia !== 0)) {
      hallazgos.push(`Variación general del tramo de meses completos consecutivos: ${textoVariacion(general)}`);
    }
  }
  const conclusion = general
    ? `Entre ${general.desde.etiqueta} y ${general.hasta.etiqueta}, el registro de cierre ${general.diferencia > 0 ? 'es mayor que el inicial' : general.diferencia < 0 ? 'es menor que el inicial' : 'iguala el inicial'}. La comparación se limita al tramo de meses completos consecutivos y no acredita una tendencia sostenida.`
    : 'No hay al menos dos meses completos consecutivos con cobertura conocida para comparar la evolución.';
  const recomendacion = !general || general.diferencia === 0
    ? 'Mantener el seguimiento mensual y verificar la cobertura disponible antes de evaluar cambios operativos.'
    : general.diferencia > 0
      ? 'Revisar la capacidad de atención frente al aumento observado y comprobar su continuidad en los siguientes meses completos.'
      : 'Comprobar si el descenso se mantiene en los siguientes meses completos antes de ajustar la capacidad de atención.';
  return { version, solicitud, preparadoEn, filtros, disponibilidad, meses, total, maximos, minimos, variaciones, hallazgos, conclusion, recomendacion };
}

export function etiquetasFiltrosMensuales(datos: IncidentMonthlyReportData): string[] {
  const f = datos.filtros;
  const etiquetas: [string, string | undefined][] = [
    ['Grupo resolutor', f.grupo_resolutor ?? 'Todos'], ['Proyecto', f.proyecto ?? 'Todos'],
    ['Prioridad', f.prioridad], ['Motivo de estado', f.motivo_estado], ['Motivo de resolución', f.motivo_resolucion],
    ['Resolutor', f.nombre_resolutor], ['Descripción', f.descripcion], ['Detalle técnico (ticket de referencia)', f.detalle_id],
    ['Ticket', f.ticket_id], ['Tipos de incidente', f.tipo_incidente?.join(', ')], ['Proyectos excluidos', f.proyectos_excluidos?.join(', ')],
  ];
  return etiquetas.filter(([, valor]) => !!valor).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`);
}
