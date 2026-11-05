class ETLValidationError(ValueError):
    pass


def validar_columnas(df,columnas_requeridas):
    faltantes = [
        c for c in columnas_requeridas
        if c not in df.columns
    ]

    if faltantes:
        raise ETLValidationError(
            f"Faltan columnas requeridas: {faltantes}"
        )


def validar_tipo_archivo(df,columnas_identificadoras,mensaje):
    faltantes = [
        columna
        for columna in columnas_identificadoras
        if columna not in df.columns
    ]

    if faltantes:
        raise ETLValidationError(mensaje)


def validar_prefijo_ticket(df,columna,prefijo,mensaje):
    if columna not in df.columns:
        raise ETLValidationError(mensaje)

    tickets = df[columna].dropna()

    if tickets.empty:
        raise ETLValidationError(mensaje)

    primer_ticket = str(tickets.iloc[0]).strip()

    if not primer_ticket.startswith(prefijo):
        raise ETLValidationError(mensaje)


def filtrar_ticket_id(df,prefijo):
    return df[
        df["Ticket_ID"].astype("string").str.startswith(
            prefijo,
            na=False
        )
    ].copy()