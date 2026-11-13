"""Etapa 2.3: evidencia cruzada por Ticket_ID y patrones de menciones locales.

Los datos de texto de los tickets JAMÁS se envían al LLM ni se registran en logs.
Los patrones indican MENCIONES, no fallas ni soluciones confirmadas. Si el
universo supera 4.000 tickets, se lee solo la muestra reciente y su denominador
es el número realmente examinado (no el total de incidentes).
"""

from collections import Counter
import re
from typing import Any

from sqlalchemy.orm import Session
from app.schemas.consolidated_import_schema import IncidentConsolidatedDashboardFilters

MAX_TICKETS_PATRONES = 4000

# Catálogo cerrado de síntomas o referencias técnicas (no afirma causa raíz).
PATRONES_SINTOMAS = (
    ("Indisponibilidad o caída mencionada", re.compile(
        r"\bindisponib\w*\b|\bservicio\s+ca[ií]do\b|\bno\s+responde\b|\bfuera\s+de\s+servicio\b", re.I)),
    ("Conexión o acceso mencionado", re.compile(
        r"\bconectividad\b|\bsin\s+conexi[oó]n\b|\bno\s+(?:puede\s+)?conectar\b|\bconnection\s+(?:refused|failed)\b", re.I)),
    ("Lentitud o tiempo de espera mencionado", re.compile(
        r"\blentitud\b|\btimeout\b|\btiempo\s+de\s+espera\b|\brespuesta\s+lenta\b", re.I)),
    ("Bloqueos o deadlocks mencionados", re.compile(
        r"\bdeadlocks?\b|\bbloqueo\s+de\s+(?:sesiones?|transacciones?)\b|\bsesi[oó]n\s+bloqueada\b", re.I)),
    ("Espacio o crecimiento mencionado", re.compile(
        r"\btablespace\b|\bdatafile\b|\b(?:disco|log|filesystem)\s+lleno\b|\bsin\s+espacio\b|\bcrecimiento\s+de\s+(?:archivos?|bd|datos)\b", re.I)),
    ("Error Oracle mencionado", re.compile(r"\bORA-\d{5}\b", re.I)),
    ("Respaldo o restauración mencionados", re.compile(
        r"\bbackup\b|\brestore\b|\brestauraci[oó]n\b|\brespaldos?\b", re.I)),
    ("Job o tarea programada mencionados", re.compile(
        r"\bjobs?\b|\bscheduler\b|\btarea\s+programada\b|\bSQL\s+Server\s+Agent\b", re.I)),
)

# MENCIONES en Solucion, no prueba de ejecución; tampoco prueba de efectividad.
PATRONES_SOLUCION = (
    ("Reinicio mencionado en solución", re.compile(r"\breinici\w*\b|\brestart\b", re.I)),
    ("Restauración mencionada en solución", re.compile(r"\brestaur\w*\b|\brestore\b|\brecovery\b", re.I)),
    ("Ajuste de configuración mencionado en solución", re.compile(
        r"\bconfiguraci[oó]n\b|\bpar[aá]metros?\b|\breconfigur\w*\b", re.I)),
    ("Liberación de espacio mencionada en solución", re.compile(
        r"\bliberaci[oó]n\s+de\s+espacio\b|\bliber[oó]\s+espacio\b|\bdepuraci[oó]n\s+de\s+(?:archivos?|logs?)\b", re.I)),
)


def _procesar_menciones(filas: list[Any], total_universo: int) -> dict:
    """Reduce datos libres a etiquetas estáticas y conteos. Sin Ticket_ID en salida."""
    sintomas: Counter[str] = Counter()
    sintomas_altas: Counter[str] = Counter()
    soluciones: Counter[str] = Counter()
    total_examinados = 0
    vistos = set()
    for fila in filas:
        # Las consultas reales cuentan cada Ticket_ID una vez. La deduplicación
        # defensiva evita sobreconteos ante dobles filas en pruebas/mocks.
        ticket = str(fila.get("ticket_id") or "")
        if not ticket or ticket in vistos:
            continue
        vistos.add(ticket)
        total_examinados += 1
        texto_sintoma = " ".join(
            str(fila.get(campo) or "")[:800]
            for campo in ("descripcion", "detalle", "causa")
        )
        texto_solucion = str(fila.get("solucion") or "")[:800]
        alta = str(fila.get("prioridad") or "").strip() in ("1-Critical", "2-High")
        for etiqueta, patron in PATRONES_SINTOMAS:
            if patron.search(texto_sintoma):
                sintomas[etiqueta] += 1
                if alta:
                    sintomas_altas[etiqueta] += 1
        for etiqueta, patron in PATRONES_SOLUCION:
            if patron.search(texto_solucion):
                soluciones[etiqueta] += 1

    # No retornar muestras de texto, ni IDs, ni campos libres.
    return {
        "examinados": total_examinados,
        "total_universo": total_universo,
        "cobertura_completa": total_examinados == total_universo,
        "criterio_muestra": "tickets_recientes_por_fecha_apertura" if total_examinados < total_universo else "universo_completo",
        "sintomas": [
            {"patron": etiqueta, "tickets": cantidad, "altas": sintomas_altas[etiqueta]}
            for etiqueta, cantidad in sorted(sintomas.items(), key=lambda x: (-x[1], x[0]))
        ],
        "soluciones": [
            {"patron": etiqueta, "tickets": cantidad}
            for etiqueta, cantidad in sorted(soluciones.items(), key=lambda x: (-x[1], x[0]))
        ],
    }


def obtener_evidencia_cruzada(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    total_universo: int,
) -> dict:
    """Solicita los mismos filtros a SQL Server sin escrituras ni llamadas HTTP."""
    from app.repositories import incident_consolidated_repository as repo
    tipo_prioridad = repo.obtener_cruces_tipo_prioridad_ia(db, filtros, limite=15)
    # Un solo proyecto seleccionado vuelve trivial un ranking global de proyectos.
    proyecto_tipo = (
        repo.obtener_cruces_proyecto_tipo_ia(db, filtros, limite=15)
        if not filtros.proyecto else []
    )
    filas = repo.obtener_tickets_para_patrones_ia(
        db, filtros, limite=MAX_TICKETS_PATRONES
    )
    return {
        "tipo_prioridad": tipo_prioridad,
        "proyecto_tipo": proyecto_tipo,
        "patrones": _procesar_menciones(filas, total_universo),
    }
