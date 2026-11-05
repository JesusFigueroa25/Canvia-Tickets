import pandas as pd

def agregar_condicion_dia(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula Condicion_dia a partir de Fecha_Creacion.

    Reglas:
    - Fin Sem.:
        Sabado y domingo, cualquier hora.
        Viernes desde las 19:00.

    - Fuera Horario:
        Otros dias con hora menor a 09:00
        o mayor a 18:00.

    - Lun-Vie:
        Casos restantes.

    Una Fecha_Creacion nula produce Condicion_dia nula.
    """

    if "Fecha_Creacion" not in df.columns:
        raise ValueError(
            "No existe la columna Fecha_Creacion "
            "para calcular Condicion_dia"
        )

    resultado = df.copy()

    # CONVERTIR FECHAS
    fechas = pd.to_datetime(
        resultado["Fecha_Creacion"],
        errors="coerce"
    )

    # PANDAS: LUNES=0, VIERNES=4, SABADO=5, DOMINGO=6
    dias = fechas.dt.dayofweek

    # HORA ENTERA: 0 A 23
    horas = fechas.dt.hour

    fecha_valida = fechas.notna()

    # SABADO O DOMINGO
    es_fin_semana = dias.isin([5, 6])

    # VIERNES DESDE LAS 19:00
    es_viernes_noche = (
        (dias == 4)
        & (horas > 18)
    )

    # CONDICION FIN DE SEMANA
    es_fin_semana = (
        es_fin_semana
        | es_viernes_noche
    )

    # FUERA DEL HORARIO LABORAL
    es_fuera_horario = (
        (horas > 18)
        | (horas < 9)
    )

    # INICIALIZAR COLUMNA
    resultado["Condicion_dia"] = None

    # VALOR PREDETERMINADO PARA FECHAS VALIDAS
    resultado.loc[
        fecha_valida,
        "Condicion_dia"
    ] = "Lun-Vie"

    # SEGUNDA PRIORIDAD
    resultado.loc[
        fecha_valida & es_fuera_horario,
        "Condicion_dia"
    ] = "Fuera Horario"

    # PRIMERA PRIORIDAD: FIN DE SEMANA
    resultado.loc[
        fecha_valida & es_fin_semana,
        "Condicion_dia"
    ] = "Fin Sem."

    return resultado