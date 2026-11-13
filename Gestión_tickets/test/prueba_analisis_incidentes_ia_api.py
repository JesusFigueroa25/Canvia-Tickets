"""Valida el contrato del backend CANVIA contra una instancia REAL de FastAPI.

Ejemplo:
  CANVIA_API_BASE=http://127.0.0.1:8000/incident-consolidated \
  python test/prueba_analisis_incidentes_ia_api.py --confirm-live

No modifica datos SQL; con OPENAI_API_KEY configurada en el SERVIDOR, el POST
consume tokens de API. Requiere --confirm-live de forma deliberada.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

FILTROS = {
    "desde": "2026-10-01",
    "hasta": "2026-10-26",
    "grupo_resolutor": "BASE DE DATOS Y EBS",
    "proyecto": "103855 LA POSITIVA PROY CLOUD GEST TI",
}


def solicitar(base, ruta, params=None, body=None):
    url = base.rstrip("/") + ruta
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"Accept": "application/json"}
    token = os.getenv("CANVIA_TEST_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=150) as resp:
        return json.loads(resp.read().decode("utf-8"))


def validar():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm-live", action="store_true")
    parser.add_argument("--require-ia", action="store_true", help="Devuelve error si la IA fue reemplazada por reglas")
    parser.add_argument("--require-cross", action="store_true", help="Exige al menos una evidencia de cruces o patrones en hallazgos")
    parser.add_argument("--base-url", help="URL base de FastAPI, incluyendo /incident-consolidated")
    args = parser.parse_args()
    if not args.confirm_live:
        parser.error("Debes añadir --confirm-live para ejecutar consultas reales.")

    base = args.base_url or os.getenv("CANVIA_API_BASE", "http://127.0.0.1:8000/incident-consolidated")
    print("Filtros:", FILTROS)
    try:
        kpis = solicitar(base, "/kpis", FILTROS)
        causas = solicitar(base, "/analisis-causas", FILTROS)
        atribucion = solicitar(base, "/atribucion-incidentes", FILTROS)
        ajustada = solicitar(base, "/distribucion-ajustada-causas", FILTROS)
        respuesta = solicitar(base, "/analisis-ejecutivo-ia", {"incluir_servidores": "true"}, FILTROS)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.reason)
        print(e.read().decode("utf-8")[:1000])
        return 1
    except Exception as e:
        print("Error de conexión:", type(e).__name__, str(e)[:180])
        return 1

    total = int(kpis["total_tickets"])
    assert total == causas["total_incidentes"], "Total KPIs vs Causas distinto"
    assert total == atribucion["total_tickets"], "Total KPIs vs Atribución distinto"
    assert total == ajustada["total_tickets"], "Total KPIs vs Ajustada distinto"
    assert total == respuesta["hallazgos"]["total_incidentes"]
    assert total == respuesta["conclusiones"]["total_incidentes"]
    assert sum(int(c["incidentes"]) for c in causas["causas"]) == total
    assert (sum(int(a["tickets"]) for a in atribucion["distribucion"])
            + int(atribucion["sin_atribucion"])) == total
    if ajustada["estado_ajuste"] == "PENDIENTE_REGLAS_APROBADAS":
        assert ajustada["ajustes_aplicados"] == 0

    h = respuesta["hallazgos"]["hallazgos"]
    c = respuesta["conclusiones"]["conclusiones"]
    codigos_h = {x["codigo"] for x in h}
    assert len(codigos_h) == len(h)
    assert all(set(x["hallazgos_referencia"]).issubset(codigos_h) for x in c)
    assert respuesta["hallazgos"]["total_hallazgos"] == len(h)
    assert respuesta["conclusiones"]["total_conclusiones"] == len(c)

    print("Total de tickets:", total)
    print("Origen de interpretación:", respuesta["origen"])
    print("Modelo utilizado:", respuesta["modelo"])
    print("Hallazgos:", len(h), "| Conclusiones:", len(c))
    print("Dimensiones hallazgos:", [item["tipo"] for item in h])
    if respuesta["advertencia"]:
        print("Advertencia:", respuesta["advertencia"])
    if total and respuesta["origen"] != "ia":
        print("AVISO: La interpretación GPT-4 no se generó; revisar configuración/logs.")
    print("OK: denominadores, conteos y referencias consistentes.")
    if args.require_ia and total and respuesta["origen"] != "ia":
        print("ERROR: esta prueba exige origen='ia' pero recibió un respaldo de reglas.")
        return 2
    if args.require_cross and total and not any(x["tipo"] in ("cruces", "patrones") for x in h):
        print("ERROR: no apareció ningún cruce o patrón técnico en los hallazgos.")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(validar())
