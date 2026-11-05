import pandas as pd

from app.database.database import engine


def exportar_dataframe(
    df: pd.DataFrame,
    nombre_tabla: str
):

    df.to_sql(
        name=nombre_tabla,
        con=engine,
        if_exists="replace",
        index=False
    )

    return len(df)