import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../app-module';
import { VolumeMonth } from './volume-month';

describe('VolumeMonth: título de incidentes consolidados', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
  });
  const crear = (periodos: [number, number][]) => {
    const componente = new VolumeMonth();
    componente.modo = 'consolidado';
    componente.datosConsolidados = periodos.map(([anio, mes]) => ({
      anio, mes, periodo: `${anio}-${mes}`, tickets: 10
    }));
    componente.ngOnChanges({ datosConsolidados: new SimpleChange(null, componente.datosConsolidados, true) });
    return componente;
  };

  it('usa las barras visibles aunque se seleccione enero', () => {
    const componente = crear([[2026, 10], [2026, 1]]);
    const datos = componente.chartData.datasets[0].data;
    componente.periodoSeleccionado = '2026-01';
    componente.ngOnChanges({ periodoSeleccionado: new SimpleChange(null, '2026-01', false) });
    expect(componente.tituloIncidentesConsolidados).toBe('Nro Incidentes por Mes - Enero - Octubre');
    expect(componente.chartData.datasets[0].data).toEqual(datos);
    componente.periodoSeleccionado = null;
    componente.ngOnChanges({ periodoSeleccionado: new SimpleChange('2026-01', null, false) });
    expect(componente.tituloIncidentesConsolidados).toBe('Nro Incidentes por Mes - Enero - Octubre');
  });

  it('actualiza el título al recibir nuevos períodos o una respuesta vacía', () => {
    const componente = crear([[2026, 1]]);
    expect(componente.tituloIncidentesConsolidados).toBe('Nro Incidentes por el Mes de Enero');
    componente.datosConsolidados = [];
    componente.ngOnChanges({ datosConsolidados: new SimpleChange(null, [], false) });
    expect(componente.tituloIncidentesConsolidados).toBe('Nro Incidentes por Mes');
    expect(componente.chartData.labels).toEqual([]);
  });

  it('desambigua años, incluso cuando se repite el nombre del mes', () => {
    expect(crear([[2026, 1], [2025, 12]]).tituloIncidentesConsolidados)
      .toBe('Nro Incidentes por Mes - Diciembre 2025 - Enero 2026');
    expect(crear([[2025, 1], [2026, 1]]).tituloIncidentesConsolidados)
      .toBe('Nro Incidentes por Mes - Enero 2025 - Enero 2026');
  });
});
