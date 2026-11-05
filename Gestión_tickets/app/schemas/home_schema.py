from pydantic import BaseModel

#KPIs
class HomeKPIsOut(BaseModel):
    incidentes_consolidados: int
    incidentes_sla: int
    requerimientos_consolidados: int
    requerimientos_sla: int

#INDICADORES CLAVE
class HomeIndicadoresClaveOut(BaseModel):
    sla_solucion_incidentes: float
    sla_solucion_requerimientos: float
    incumplimientos_incidentes: int
    incumplimientos_requerimientos: int

#GRAFICOS
class HomeVolumenMensualItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    incidentes: int | None
    requerimientos: int | None

class HomeEvolucionSLAItem(BaseModel):
    anio: int
    mes: int
    periodo: str
    incidentes: float | None
    requerimientos: float | None

class HomeGraficosOut(BaseModel):
    volumen_mensual: list[HomeVolumenMensualItem]
    evolucion_sla: list[HomeEvolucionSLAItem]

#RESUMEN EJECUTIVO
class HomeEvolucionOperativaOut(BaseModel):
    periodo_actual: str | None = None
    periodo_anterior: str | None = None
    volumen_actual: int | None = None
    volumen_anterior: int | None = None
    variacion_porcentaje: float | None = None
    mensaje: str

class HomeCumplimientoOut(BaseModel):
    sla_solucion: float
    objetivo: float
    diferencia_pp: float
    mensaje: str

class HomeFocoAtencionOut(BaseModel):
    proyecto: str | None
    incumplimientos_incidentes: int 
    incumplimientos_requerimientos: int
    total_incumplimientos: int
    porcentaje_total: float
    mensaje: str

class HomeResumenEjecutivoOut(BaseModel):
    evolucion_operativa: HomeEvolucionOperativaOut
    cumplimiento: HomeCumplimientoOut
    foco_atencion: HomeFocoAtencionOut

#RESPUESTA GENERAL
class HomeResumenOut(BaseModel):
    kpis: HomeKPIsOut
    indicadores_clave: HomeIndicadoresClaveOut
    graficos: HomeGraficosOut
    resumen_ejecutivo: HomeResumenEjecutivoOut