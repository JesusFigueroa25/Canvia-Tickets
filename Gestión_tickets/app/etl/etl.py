import pandas as pd


def cargar_excel(archivo, sheet_name=0):
    return pd.read_excel(
        archivo,
        sheet_name=sheet_name
    )


def seleccionar_columnas(df, columnas):
    return df[columnas].copy()


def renombrar_columnas(df, columnas_renombrar):
    return df.rename(
        columns=columnas_renombrar
    )


def convertir_fecha(df, columna):
    df[columna] = pd.to_datetime(
        df[columna],
        errors="coerce"
    )

    return df


def obtener_duplicados(df):
    return df[
        df.duplicated(
            subset=["Ticket_ID"],
            keep=False
        )
    ]


def eliminar_duplicados(df):
    return (
        df.drop_duplicates(
            subset=["Ticket_ID"],
            keep="first"
        )
        .copy()
    )