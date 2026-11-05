import pandas as pd
def detectar_cambios(df_staging: pd.DataFrame, df_oficial: pd.DataFrame, clave: str = "Ticket_ID"):
    
    # Validar que exista la clave
    if clave not in df_staging.columns:
        raise ValueError(f"La columna {clave} no existe en staging")

    if clave not in df_oficial.columns:
        raise ValueError(f"La columna {clave} no existe en la tabla oficial")

    # Evitar comparar tickets duplicados
    if df_staging[clave].duplicated().any():
        raise ValueError(f"Existen {clave} duplicados en staging")

    if df_oficial[clave].duplicated().any():
        raise ValueError(f"Existen {clave} duplicados en la tabla oficial")

    # Las columnas de staging deben existir también en la tabla oficial
    columnas_faltantes = [
        columna
        for columna in df_staging.columns
        if columna not in df_oficial.columns
    ]

    if columnas_faltantes:
        raise ValueError(f"Faltan columnas en la tabla oficial: {columnas_faltantes}")

    columnas_comparar = [
        columna
        for columna in df_staging.columns
        if columna != clave
    ]
    
    #----------------------------------------------------------------------------
    ## Unir staging con oficial por Ticket_ID [Saber si hay un ticket nuevo]
    df_comparacion = df_staging.merge(
        df_oficial,
        on=clave,
        how="left",
        suffixes=("_staging", "_oficial"),
        indicator=True
    )
    # NEW
    ids_new = df_comparacion.loc[df_comparacion["_merge"] == "left_only", clave]

    # Extraer la fila completa de los tickets nuevos
    df_new = df_staging[df_staging[clave].isin(ids_new)].copy()

    #----------------------------------------------------------------------------

    # TICKETS QUE YA EXISTEN
    # Extraer los tickets que ya existen previamente
    df_existentes = df_comparacion[df_comparacion["_merge"] == "both"].copy()

    # Asumir inicialmente que todos los tickets existentes son iguales
    filas_iguales = pd.Series(True, index = df_existentes.index)

    # Comparar columna por columna si los datos cambiaron (considerando nulos como iguales)
    for columna in columnas_comparar:

        staging = df_existentes[f"{columna}_staging"]
        oficial = df_existentes[f"{columna}_oficial"]

        # NULL = NULL se considera igual
        iguales = (
            staging.eq(oficial)
            |
            (
                staging.isna()
                &
                oficial.isna()
            )
        )

        filas_iguales &= iguales.fillna(False)

    # SAME
    ids_same = df_existentes.loc[filas_iguales, clave]
    df_same = df_staging[df_staging[clave].isin(ids_same)].copy()

    # CHANGED
    ids_changed = df_existentes.loc[~filas_iguales, clave]
    df_changed = df_staging[df_staging[clave].isin(ids_changed)].copy()

    return {
        "NEW": df_new,
        "CHANGED": df_changed,
        "SAME": df_same
    }