import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppModule } from '../../../../app-module';
import { CategoryDistribution } from './category-distribution';

describe('CategoryDistribution: orden optativo de prioridades', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AppModule] });
  });
  it('conserva etiquetas, cantidades y colores al ordenar por criticidad', () => {
    const componente = new CategoryDistribution();
    const datos = [
      { categoria: 'Sin especificar', cantidad: 100 },
      { categoria: '4-Low', cantidad: 90 },
      { categoria: 'Medium', cantidad: 80 },
      { categoria: '2-High', cantidad: 70 },
      { categoria: '1-Critical', cantidad: 1 }
    ];
    componente.datos = datos;
    componente.coloresPorPrioridad = true;
    componente.ordenPrioridad = true;
    componente.ngOnChanges({ datos: new SimpleChange(null, datos, true) });
    expect(componente.chartData.labels).toEqual(['1-Critical', '2-High', 'Medium', '4-Low', 'Sin especificar']);
    expect(componente.chartData.datasets[0].data).toEqual([1, 70, 80, 90, 100]);
    expect(componente.chartData.datasets[0].backgroundColor)
      .toEqual(['#D95C4F', '#FF8A42', '#98A2B3', '#63B891', '#98A2B3']);
    expect(componente.datos).toEqual(datos);
  });

  it('mantiene el orden por cantidad en los consumidores existentes', () => {
    const componente = new CategoryDistribution();
    componente.datos = [{ categoria: 'Critical', cantidad: 1 }, { categoria: 'Low', cantidad: 10 }];
    componente.ngOnChanges({ datos: new SimpleChange(null, componente.datos, true) });
    expect(componente.chartData.labels).toEqual(['Low', 'Critical']);
  });
});
