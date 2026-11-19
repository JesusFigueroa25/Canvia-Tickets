import {
  TicketsReportTimesProjectItem,
  TicketsReportTimesReportData,
  TicketsReportTimesResolverItem,
  TicketsReportTimesResumen,
  TicketsReportTimesTabla,
} from '../../../../models/tickets-report-times';

export type RegistroTiempo = TicketsReportTimesResolverItem | TicketsReportTimesProjectItem;

export interface FilaTiempo {
  nombre: string;
  mensual: Record<string, number>;
  mensualSegundos: Record<string, number>;
  total: number;
  totalSegundos: number;
}

/** Construye las matrices conservando horas y segundos. */
export function matrizTiempos(items: RegistroTiempo[]): {
  periodos: string[];
  filas: FilaTiempo[];
} {
  const mapa = new Map<string, FilaTiempo>();
  const periodos = new Set<string>();

  for (const item of items) {
    const nombre = nombreRegistro(item);

    const fila = mapa.get(nombre) ?? {
      nombre,
      mensual: Object.create(null) as Record<string, number>,
      mensualSegundos: Object.create(null) as Record<string, number>,
      total: 0,
      totalSegundos: 0
    };

    fila.mensual[item.periodo] =
      (fila.mensual[item.periodo] ?? 0) + item.horas_totales;

    fila.mensualSegundos[item.periodo] =
      (fila.mensualSegundos[item.periodo] ?? 0) +
      item.segundos_totales;

    fila.total += item.horas_totales;
    fila.totalSegundos += item.segundos_totales;

    mapa.set(nombre, fila);
    periodos.add(item.periodo);
  }

  return {
    periodos: [...periodos].sort(),
    filas: [...mapa.values()].sort(
      (a, b) =>
        b.total - a.total ||
        -a.nombre.localeCompare(b.nombre, 'es')
    )
  };
}

export const nombreRegistro = (r: RegistroTiempo): string =>
  ('resolutor' in r ? r.resolutor : r.proyecto)?.trim() || 'Sin especificar';

export function bloques<T>(items: T[], tamano = 6): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) resultado.push(items.slice(i, i + tamano));
  return resultado;
}

/** Same hour matrix and initial comparator as the dashboard tables. */


const entero = (n: number) => Number.isSafeInteger(n) && n >= 0;
const horas = (n: number) => Number.isFinite(n) && n >= 0;
const periodoValido = (p: string) => /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(p);
const cerca = (a: number, b: number, cantidad: number) =>
  Math.abs(a - b) <= 0.005 * (cantidad + 1) + 0.000001;
export const resumenesIguales = (
  a: TicketsReportTimesResumen,
  b: TicketsReportTimesResumen,
): boolean =>
  (
    [
      'tickets_distintos',
      'acciones',
      'horas_totales',
      'proyectos_distintos',
      'resolutores_distintos',
      'segundos_totales',
    ] as const
  ).every((clave) => a[clave] === b[clave]);

export function validarResumen(r: TicketsReportTimesResumen): void {
  if (
    !r ||
    ![r.tickets_distintos, r.acciones, r.proyectos_distintos, r.resolutores_distintos].every(
      entero,
    ) ||
    (!horas(r.horas_totales) || !horas(r.segundos_totales))
  ) {
    throw new Error('Resumen de tiempos inválido.');
  }
}

export function validarPagina<T extends RegistroTiempo>(
  tabla: TicketsReportTimesTabla<T>,
  pagina: number,
  tamano: number,
): void {
  validarResumen(tabla.resumen);
  if (
    tabla.pagina !== pagina ||
    tabla.tamano !== tamano ||
    !entero(tabla.total) ||
    tabla.total_paginas !== Math.ceil(tabla.total / tamano) ||
    tabla.items.length !== Math.max(0, Math.min(tamano, tabla.total - (pagina - 1) * tamano))
  ) {
    throw new Error('La paginación cambió o está incompleta. Actualiza los datos.');
  }
  const claves = new Set<string>();
  for (const item of tabla.items) {
    const clave = JSON.stringify([nombreRegistro(item), item.periodo]);
    if (
      !periodoValido(item.periodo) ||
      item.periodo !== `${item.anio}-${String(item.mes).padStart(2, '0')}` ||
      !entero(item.tickets) ||
      !entero(item.acciones) ||
      !horas(item.horas_totales) ||
      !horas(item.segundos_totales) ||
      ('resolutores_distintos' in item && !entero(item.resolutores_distintos)) ||
      claves.has(clave)
    ) {
      throw new Error('El detalle contiene registros inválidos o duplicados.');
    }
    claves.add(clave);
  }
}
export function validarReporte(
  d: TicketsReportTimesReportData
): void {
  const k = d.kpis;

  if (
    ![
      k.total_tickets,
      k.total_proyectos,
      k.total_resolutores,
      k.alta_criticidad
    ].every(entero) ||
    ![
      k.horas_totales,
      k.segundos_totales,
      k.promedio_horas,
      k.promedio_segundos,
      k.promedio_tickets
    ].every(horas) ||
    k.alta_criticidad > k.total_tickets ||
    !Number.isFinite(k.porcentaje_alta_criticidad) ||
    k.porcentaje_alta_criticidad < 0 ||
    k.porcentaje_alta_criticidad > 100
  ) {
    throw new Error('KPIs inválidos.');
  }

  const resumen = d.detalleResolutores.resumen;
  const otro = d.detalleProyectos.resumen;

  validarResumen(resumen);
  validarResumen(otro);

  if (
    !resumenesIguales(resumen, otro) ||
    resumen.tickets_distintos !== k.total_tickets ||
    resumen.proyectos_distintos !== k.total_proyectos ||
    resumen.resolutores_distintos !== k.total_resolutores ||
    !cerca(resumen.horas_totales, k.horas_totales, 1) ||
    !cerca(resumen.segundos_totales, k.segundos_totales, 1)
  ) {
    throw new Error('Los agregados no son consistentes.');
  }

  for (const detalle of [
    d.detalleResolutores,
    d.detalleProyectos
  ]) {
    const claves = detalle.items.map(
      r => JSON.stringify([nombreRegistro(r), r.periodo])
    );

    if (
      detalle.items.length !== detalle.totalRegistros ||
      new Set(claves).size !== claves.length ||
      detalle.items.some(
        r => !!d.filtros.periodo &&
          r.periodo !== d.filtros.periodo
      ) ||
      detalle.items.reduce(
        (s, r) => s + r.acciones, 0
      ) !== resumen.acciones ||
      !cerca(
        detalle.items.reduce(
          (s, r) => s + r.horas_totales, 0
        ),
        resumen.horas_totales,
        detalle.items.length
      ) ||
      !cerca(
        detalle.items.reduce(
          (s, r) => s + r.segundos_totales, 0
        ),
        resumen.segundos_totales,
        detalle.items.length
      )
    ) {
      throw new Error(
        'El detalle no está completo o sus sumas son inconsistentes.'
      );
    }
  }

  const meses = new Set<string>();

  for (const m of d.volumenMensual) {
    if (
      !periodoValido(m.periodo) ||
      meses.has(m.periodo) ||
      !entero(m.tickets) ||
      !entero(m.acciones) ||
      !horas(m.horas_totales) ||
      !horas(m.segundos_totales)
    ) {
      throw new Error('Volumen mensual inválido.');
    }

    meses.add(m.periodo);
  }

  const volumen = d.volumenMensual.filter(
    m => !d.filtros.periodo ||
      m.periodo === d.filtros.periodo
  );

  if (
    (
      d.filtros.periodo &&
      volumen.reduce((s, m) => s + m.tickets, 0) !==
      k.total_tickets
    ) ||
    volumen.reduce(
      (s, m) => s + m.acciones, 0
    ) !== resumen.acciones ||
    !cerca(
      volumen.reduce(
        (s, m) => s + m.horas_totales, 0
      ),
      resumen.horas_totales,
      volumen.length
    ) ||
    !cerca(
      volumen.reduce(
        (s, m) => s + m.segundos_totales, 0
      ),
      resumen.segundos_totales,
      volumen.length
    )
  ) {
    throw new Error(
      'El volumen mensual no corresponde al detalle.'
    );
  }

  for (const grafico of [
    d.graficoResolutores,
    d.graficoProyectos
  ]) {
    if (
      !entero(grafico.limite) ||
      grafico.limite < 1 ||
      grafico.series.length > grafico.limite ||
      new Set(grafico.periodos).size !==
      grafico.periodos.length ||
      !grafico.periodos.every(periodoValido) ||
      new Set(
        grafico.series.map(s => s.nombre)
      ).size !== grafico.series.length ||
      (resumen.acciones > 0 && !grafico.series.length)
    ) {
      throw new Error('Ranking incompleto.');
    }

    for (const s of grafico.series) {
      if (
        !horas(s.horas_totales) ||
        !horas(s.segundos_totales) ||
        s.mensual.length !== grafico.periodos.length ||
        s.mensual.some(
          (p, i) =>
            p.periodo !== grafico.periodos[i] ||
            !horas(p.horas) ||
            !horas(p.segundos)
        ) ||
        !cerca(
          s.mensual.reduce((t, p) => t + p.horas, 0),
          s.horas_totales,
          s.mensual.length
        ) ||
        !cerca(
          s.mensual.reduce((t, p) => t + p.segundos, 0),
          s.segundos_totales,
          s.mensual.length
        )
      ) {
        throw new Error('Serie mensual inválida.');
      }
    }
  }
}