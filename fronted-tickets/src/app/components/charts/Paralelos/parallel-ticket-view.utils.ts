import { TipoTicketParalelo, TicketsParallelTicketItem } from '../../../models/tickets-manual-updates';

/** Conservar la hora registrada por SQL Server, sin conversión de zona horaria. */
export function fechaParalela(valor: string | null | undefined): string {
  if (!valor) return '—';
  const partes = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(valor);
  if (!partes) return valor;
  const [, y, m, d, h, min, s] = partes;
  return `${d}/${m}/${y} ${h}:${min}${s ? ':' + s : ''}`;
}
export function tipoParalelo(tipo: TipoTicketParalelo): string {
  return tipo === 'Incident' ? 'Incidente' : 'Requerimiento';
}
export function duracionParalela(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '—';
  const total = Math.floor(segundos);
  const dias = Math.floor(total / 86400), horas = Math.floor(total % 86400 / 3600);
  const minutos = Math.floor(total % 3600 / 60), resto = total % 60;
  return [dias ? `${dias} d` : '', horas ? `${horas} h` : '', minutos ? `${minutos} min` : '', resto || total === 0 ? `${resto} s` : ''].filter(Boolean).join(' ');
}
export function identidadParalela(fila: TicketsParallelTicketItem): string {
  return JSON.stringify([fila.ticket_id, fila.ticket_type, fila.resolutor]);
}
