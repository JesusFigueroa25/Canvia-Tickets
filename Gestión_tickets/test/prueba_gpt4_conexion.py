from app.services.ai.chat_service import (
    interpretar_pregunta_analitica,
)


def main():

    pregunta = (
        "¿Cuántos incidentes se aperturaron "
        "en marzo de 2026?"
    )

    resultado = interpretar_pregunta_analitica(
        pregunta
    )

    print("=" * 60)
    print("FASE 4.5.1 - PRUEBA DE OPENAI")
    print("=" * 60)

    print("Estado:", resultado["status"])
    print("Modelo:", resultado.get("model"))
    print(
        "Objetivo:",
        resultado.get("analytical_goal"),
    )
    print(
        "Contexto:",
        resultado.get("context_candidate"),
    )

    print("Ejecutó SQL:", resultado["executed"])

    if resultado["status"] != "interpreted":
        print(
            "Detalle:",
            resultado.get("detail"),
        )


if __name__ == "__main__":
    main()