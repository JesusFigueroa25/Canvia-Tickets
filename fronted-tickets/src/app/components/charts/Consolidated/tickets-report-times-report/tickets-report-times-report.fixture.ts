import type {
  TicketsReportTimesGrafico,
  TicketsReportTimesReportData,
} from '../../../../models/tickets-report-times';
export function reporteTiemposFicticio(
  meses = 12,
  entidades = 12
): TicketsReportTimesReportData {

  const periodos = Array.from(
    { length: meses },
    (_, i) => `2026-${String(i + 1).padStart(2, '0')}`
  );

  const nombres = Array.from(
    { length: entidades },
    (_, i) => `Especialista ficticio ${String(i).padStart(2, '0')}`
  );

  const proyectos = nombres.map(
    (_, i) =>
      `${String(i + 1).padStart(6, '0')} Proyecto ficticio ${String(i).padStart(2, '0')}`
  );

  const filas = periodos.flatMap((periodo, m) =>
    nombres.map((_, i) => ({
      anio: 2026,
      mes: m + 1,
      periodo,
      tickets: 1,
      acciones: 2,
      horas_totales: 1.25,
      segundos_totales: 4500,
      indice: i
    }))
  );

  const resumen = {
    tickets_distintos: filas.length,
    acciones: filas.length * 2,
    horas_totales: filas.length * 1.25,
    segundos_totales: filas.length * 4500,
    proyectos_distintos: entidades,
    resolutores_distintos: entidades
  };

  const grafico = (lista: string[]): TicketsReportTimesGrafico => ({
    periodos,
    limite: 10,
    series: lista.slice(0, 10).map(nombre => ({
      nombre,
      horas_totales: meses * 1.25,
      segundos_totales: meses * 4500,
      mensual: periodos.map(periodo => ({
        periodo,
        horas: 1.25,
        segundos: 4500
      }))
    }))
  });

  return {
    version: 1,
    preparadoEn: '2026-11-18T12:00:00.000Z',

    filtros: {
      desde: '2026-01-01',
      hasta: '2026-12-31',
      grupo_resolutor: 'GRUPO FICTICIO',
      todos_proyectos: true,
      proyectos: []
    },

    kpis: {
      total_tickets: filas.length,
      total_proyectos: entidades,
      horas_totales: filas.length * 1.25,
      segundos_totales: filas.length * 4500,
      total_resolutores: entidades,
      promedio_horas: meses > 0 ? entidades * 1.25 : 0,
      promedio_segundos: meses > 0 ? entidades * 4500 : 0,
      promedio_tickets: meses > 0 ? entidades : 0,
      alta_criticidad: 0,
      porcentaje_alta_criticidad: 0
    },

    volumenMensual: periodos.map((periodo, i) => ({
      anio: 2026,
      mes: i + 1,
      periodo,
      tickets: entidades,
      acciones: entidades * 2,
      horas_totales: entidades * 1.25,
      segundos_totales: entidades * 4500
    })),

    graficoResolutores: grafico(nombres),
    graficoProyectos: grafico(proyectos),

    detalleResolutores: {
      resumen: { ...resumen },
      totalRegistros: filas.length,
      items: filas.map(({ indice, ...fila }) => ({
        ...fila,
        resolutor: nombres[indice]
      }))
    },

    detalleProyectos: {
      resumen: { ...resumen },
      totalRegistros: filas.length,
      items: filas.map(({ indice, ...fila }) => ({
        ...fila,
        proyecto: proyectos[indice],
        resolutores_distintos: 1
      }))
    }
  };
}