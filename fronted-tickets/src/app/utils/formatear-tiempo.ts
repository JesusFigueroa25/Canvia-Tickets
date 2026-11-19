const formatoTiempo = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Menos de 3600 segundos: minutos.
 * Desde 3600 segundos: horas.
 *
 * Para horas se mantiene el agregado existente del backend
 * cuando está disponible.
 */
export function formatearTiempo(
  segundos: number,
  horas?: number
): string {
  const duracion = Number(segundos);

  if (!Number.isFinite(duracion) || duracion < 0) {
    return '—';
  }

  if (duracion < 3600) {
    return `${formatoTiempo.format(duracion / 60)} min`;
  }

  const valorHoras = horas ?? duracion / 3600;

  if (!Number.isFinite(valorHoras) || valorHoras < 0) {
    return '—';
  }

  return `${formatoTiempo.format(valorHoras)} h`;
}