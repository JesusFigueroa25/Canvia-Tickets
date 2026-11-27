import { TicketsParallelProjectItem, TipoTicketParalelo } from '../../../models/tickets-manual-updates';

export type TipoLocalProyecto = TipoTicketParalelo | '';
export interface FilaProyectoParalelo { nombre: string; alp: string | null; mensual: Record<string, number>; total: number; }

export function normalizarProyecto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function periodosProyectos(datos: readonly TicketsParallelProjectItem[], desde: string | null, hasta: string | null): string[] {
  const valido = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
  const inicio = desde?.slice(0, 7) ?? '';
  const fin = hasta?.slice(0, 7) ?? '';
  if (!valido(inicio) || !valido(fin) || inicio > fin) {
    return [...new Set(datos.map(d => d.periodo).filter(valido))].sort();
  }
  let [y, m] = inicio.split('-').map(Number);
  const [yf, mf] = fin.split('-').map(Number);
  const meses: string[] = [];
  while (y < yf || (y === yf && m <= mf)) {
    meses.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    if (++m === 13) { m = 1; y++; }
  }
  return meses;
}

// El ALP es un atributo, nunca la identidad del proyecto.
export function catalogoProyectos(datos: readonly TicketsParallelProjectItem[], periodos: readonly string[]): { nombre: string; alp: string | null }[] {
  const meses = new Set(periodos);
  const mapa = new Map<string, Set<string>>();
  for (const item of datos) {
    if (!meses.has(item.periodo)) continue;
    let alps = mapa.get(item.proyecto);
    if (!alps) { alps = new Set<string>(); mapa.set(item.proyecto, alps); }
    if (item.alp) alps.add(item.alp);
  }
  return [...mapa.entries()].map(([nombre, alps]) => ({ nombre, alp: alps.size === 1 ? [...alps][0] : null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function construirFilasProyectos(datos: readonly TicketsParallelProjectItem[], periodos: readonly string[], tipo: TipoLocalProyecto, busqueda = '', seleccion: readonly string[] = []): FilaProyectoParalelo[] {
  const meses = new Set(periodos);
  const elegidos = new Set(seleccion);
  const termino = normalizarProyecto(busqueda);
  const catalogo = new Map(catalogoProyectos(datos, periodos).map(p => [p.nombre, p.alp]));
  const mapa = new Map<string, FilaProyectoParalelo>();
  for (const item of datos) {
    if (!meses.has(item.periodo) || (elegidos.size && !elegidos.has(item.proyecto))) continue;
    const alp = catalogo.get(item.proyecto) ?? null;
    if (!normalizarProyecto(`${item.proyecto} ${alp ?? ''}`).includes(termino)) continue;
    const valor = tipo === 'Incident' ? item.incidentes_paralelos : tipo === 'Service Request' ? item.requerimientos_paralelos : item.total_paralelos;
    if (!(valor > 0)) continue;
    let fila = mapa.get(item.proyecto);
    if (!fila) { fila = { nombre: item.proyecto, alp, mensual: Object.create(null) as Record<string, number>, total: 0 }; mapa.set(item.proyecto, fila); }
    fila.mensual[item.periodo] = (fila.mensual[item.periodo] ?? 0) + valor;
    fila.total += valor;
  }
  return [...mapa.values()];
}

export function ordenarFilasProyectos(filas: readonly FilaProyectoParalelo[], columna: string, descendente: boolean): FilaProyectoParalelo[] {
  return [...filas].sort((a, b) => {
    const nombre = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.nombre.localeCompare(b.nombre, 'es');
    if (columna === 'nombre') return descendente ? -nombre : nombre;
    if (columna === 'alp') { const d = (a.alp ?? '').localeCompare(b.alp ?? '', 'es', { numeric: true }); return (descendente ? -d : d) || nombre; }
    const diferencia = columna === 'total' ? a.total - b.total : (a.mensual[columna] ?? 0) - (b.mensual[columna] ?? 0);
    return (descendente ? -diferencia : diferencia) || nombre;
  });
}

export function nombreMesProyecto(periodo: string, corto = false): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return periodo;
  const [y, m] = periodo.split('-').map(Number);
  const fecha = new Date(2000, m - 1, 1); fecha.setFullYear(y);
  const texto = new Intl.DateTimeFormat('es-PE', { month: corto ? 'short' : 'long', year: 'numeric' }).format(fecha);
  return corto ? texto.toUpperCase() : texto.charAt(0).toUpperCase() + texto.slice(1);
}
