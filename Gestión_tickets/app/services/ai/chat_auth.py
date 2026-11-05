
import os

from fastapi import HTTPException, Request


def get_current_chat_subject(
    request: Request,
) -> str:
    """
    Acceso local al Chatbot Analítico IA V1.

    No requiere JWT en modo de desarrollo.

    Por seguridad:
    - Solo permite solicitudes desde localhost.
    - Requiere habilitación explícita.
    - No debe habilitarse en el servidor productivo.
    """

    modo_local = (
        os.getenv("AI_CHAT_LOCAL_MODE", "0") == "1"
    )

    cliente = (
        request.client.host
        if request.client
        else None
    )

    if (
        not modo_local
        or cliente not in {"127.0.0.1", "::1"}
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Chatbot sin autenticación habilitado "
                "únicamente para desarrollo local"
            ),
        )

    return "canvia-local-dev"
