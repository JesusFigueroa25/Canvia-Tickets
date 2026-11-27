import { TicketsParallelResolverItem, TipoTicketParalelo } from '../../../models/tickets-manual-updates';

export type TipoLocalParalelo = TipoTicketParalelo | '';
export interface FilaResolutorParalelo {
  nombre: string;
  mensual: Record<string, number>;
  total: number;
}

export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function periodosResolutores(datos: readonly TicketsParallelResolverItem[], desde: string | null, hasta: string | null): string[] {
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

export function construirFilasResolutores(datos: readonly TicketsParallelResolverItem[], periodos: readonly string[], tipo: TipoLocalParalelo, busqueda: string): FilaResolutorParalelo[] {
  const meses = new Set(periodos);
  const termino = normalizarBusqueda(busqueda);
  const mapa = new Map<string, FilaResolutorParalelo>();
  for (const item of datos) {
    if (!meses.has(item.periodo) || !normalizarBusqueda(item.resolutor).includes(termino)) continue;
    const valor = tipo === 'Incident' ? item.incidentes_paralelos : tipo === 'Service Request' ? item.requerimientos_paralelos : item.total_paralelos;
    if (!(valor > 0)) continue;
    let fila = mapa.get(item.resolutor);
    if (!fila) {
      fila = { nombre: item.resolutor, mensual: Object.create(null) as Record<string, number>, total: 0 };
      mapa.set(item.resolutor, fila);
    }
    fila.mensual[item.periodo] = (fila.mensual[item.periodo] ?? 0) + valor;
    fila.total += valor;
  }
  return [...mapa.values()];
}

export function ordenarFilasResolutores(filas: readonly FilaResolutorParalelo[], columna: string, descendente: boolean): FilaResolutorParalelo[] {
  return [...filas].sort((a, b) => {
    const nombre = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.nombre.localeCompare(b.nombre, 'es');
    if (columna === 'nombre') return descendente ? -nombre : nombre;
    const diferencia = columna === 'total' ? a.total - b.total : (a.mensual[columna] ?? 0) - (b.mensual[columna] ?? 0);
    return (descendente ? -diferencia : diferencia) || nombre;
  });
}

export function nombreMesParalelo(periodo: string, corto = false): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return periodo;
  const [y, m] = periodo.split('-').map(Number);
  const fecha = new Date(2000, m - 1, 1); fecha.setFullYear(y);
  const texto = new Intl.DateTimeFormat('es-PE', { month: corto ? 'short' : 'long', year: 'numeric' }).format(fecha);
  return corto ? texto.toUpperCase() : texto.charAt(0).toUpperCase() + texto.slice(1);
}
