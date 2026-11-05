
from __future__ import annotations
import hashlib
import json
from collections.abc import Mapping,Sequence
from dataclasses import dataclass
from typing import Any
import numpy as np
from app.services.categorization.preprocessor import TicketPreparado,normalizar_texto
import re
import unicodedata


@dataclass(frozen=True,slots=True)
class SemanticConfig:
    model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    device: str = "cpu"
    batch_size: int = 16
    min_words: int = 3
    correct_score: float = 0.60
    correct_margin: float = 0.05
    incorrect_score: float = 0.65
    incorrect_margin: float = 0.16
    alternative_margin: float = 0.06
    evidence_chars: int = 240
    binary_mode: bool = False
    binary_threshold: float = 0.35
    binary_uncertainty_margin: float = 0.07


    def __post_init__(self):
        if self.batch_size < 1 or self.min_words < 1 or self.evidence_chars < 1:
            raise ValueError("Parámetros de configuración inválidos")

        for valor in (self.correct_score,self.correct_margin,self.incorrect_score,self.incorrect_margin,self.alternative_margin):
            if not 0 <= valor <= 1:
                raise ValueError("Los umbrales deben estar entre 0 y 1")

        if not isinstance(self.binary_mode,bool):
            raise ValueError("binary_mode debe ser booleano")

        if not 0 <= self.binary_threshold <= 1:
            raise ValueError("binary_threshold debe estar entre 0 y 1")

        if not 0 <= self.binary_uncertainty_margin <= 1:
            raise ValueError("binary_uncertainty_margin debe estar entre 0 y 1")



@dataclass(frozen=True,slots=True)
class RutaCandidata:
    catalog_id: int | None
    level_1: str
    level_2: str
    level_3: str
    description: str = ""
    examples: str = ""

    @property
    def clave(self) -> tuple[str,str,str]:
        return tuple(" ".join(valor.split()).casefold() for valor in (self.level_1,self.level_2,self.level_3))


@dataclass(frozen=True,slots=True)
class EvaluacionSemantica:
    result_status: str
    reason_code: str
    reason_text: str
    semantic_score: float | None
    suggested_catalog_id: int | None
    evidence_json: dict[str,Any]


class SemanticEngine:
    def __init__(self,config: SemanticConfig | None = None,modelo: Any = None):
        self.config = config or SemanticConfig()
        self._modelo = modelo
        self._catalogo_hash: str | None = None
        self._catalogo: list[RutaCandidata] = []
        self._matriz = np.empty((0,0),dtype=np.float32)
        self._rangos: list[tuple[int,int]] = []

    @property
    def catalog_hash(self) -> str | None:
        return self._catalogo_hash

    def _obtener_modelo(self):
        if self._modelo is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise RuntimeError("Instala sentence-transformers en el entorno de FastAPI") from exc

            self._modelo = SentenceTransformer(self.config.model_name,device=self.config.device)

        return self._modelo

    def _codificar(self,textos: list[str]) -> np.ndarray:
        if not textos:
            raise ValueError("No se recibieron textos para codificar")

        salida = self._obtener_modelo().encode(
            textos,batch_size=self.config.batch_size,show_progress_bar=False,
            convert_to_numpy=True,normalize_embeddings=True,
        )

        matriz = np.asarray(salida,dtype=np.float32)

        if matriz.ndim != 2 or matriz.shape[0] != len(textos) or not np.isfinite(matriz).all():
            raise RuntimeError("El modelo devolvió embeddings inválidos")

        normas = np.linalg.norm(matriz,axis=1,keepdims=True)

        if np.any(normas <= 0):
            raise RuntimeError("El modelo devolvió embeddings vacíos")

        return matriz / normas

    @staticmethod
    def _valor(registro: Any,nombre: str) -> Any:
        return registro.get(nombre) if isinstance(registro,Mapping) else getattr(registro,nombre,None)

    def _rutas(self,catalogo: Sequence[Any]) -> list[RutaCandidata]:
        rutas = {}

        for registro in catalogo:
            valores = [normalizar_texto(self._valor(registro,nombre)) for nombre in ("level_1","level_2","level_3")]

            if not all(valores):
                continue

            identificador = self._valor(registro,"catalog_id")

            ruta = RutaCandidata(
                catalog_id=int(identificador) if identificador is not None else None,
                level_1=valores[0],level_2=valores[1],level_3=valores[2],
                description=normalizar_texto(self._valor(registro,"description")),
                examples=normalizar_texto(self._valor(registro,"examples")),
            )

            rutas.setdefault(ruta.clave,ruta)

        return list(rutas.values())

    @staticmethod
    def _representaciones(ruta: RutaCandidata) -> list[str]:
        textos = [
            f"Actividad solicitada o realizada: {ruta.level_3}.",
            f"Área: {ruta.level_1}. Categoría: {ruta.level_2}. Actividad: {ruta.level_3}.",
        ]

        if ruta.description:
            textos.append(f"Actividad: {ruta.level_3}. {ruta.description[:350]}")

        if ruta.examples:
            textos.append(f"Actividad: {ruta.level_3}. Ejemplo: {ruta.examples[:350]}")

        return textos

    def preparar_catalogo(self,catalogo: Sequence[Any]) -> int:
        rutas = self._rutas(catalogo)

        huella = hashlib.sha256(json.dumps(
            [(r.catalog_id,r.level_1,r.level_2,r.level_3,r.description,r.examples) for r in rutas],
            ensure_ascii=False,separators=(",",":"),
        ).encode("utf-8")).hexdigest()

        if huella == self._catalogo_hash:
            return len(self._catalogo)

        textos = []
        rangos = []

        for ruta in rutas:
            inicio = len(textos)
            textos.extend(self._representaciones(ruta))
            rangos.append((inicio,len(textos)))

        matriz = self._codificar(textos) if textos else np.empty((0,0),dtype=np.float32)

        self._catalogo_hash = huella
        self._catalogo = rutas
        self._matriz = matriz
        self._rangos = rangos

        return len(rutas)

    @staticmethod
    def _salida(estado: str,codigo: str,motivo: str,puntaje: float | None = None,sugerencia: int | None = None,evidencia: dict[str,Any] | None = None) -> EvaluacionSemantica:
        return EvaluacionSemantica(
            result_status=estado,reason_code=codigo,reason_text=motivo,
            semantic_score=round(puntaje,4) if puntaje is not None else None,
            suggested_catalog_id=sugerencia,evidence_json=evidencia or {},
        )



    def evaluar(self,ticket: TicketPreparado,catalogo: Sequence[Any]) -> EvaluacionSemantica:
        if not ticket.tiene_ruta_completa:
            return self._salida(
                "INCORRECT",
                "MISSING_CATEGORY",
                "Falta uno o mas niveles de la ruta de categorizacion.",
            )

        if (
            not self.config.binary_mode
            and sum(
                len(texto.split())
                for texto in (ticket.descripcion,ticket.detalle,ticket.solucion)
            ) < self.config.min_words
        ):
            return self._salida(
                "REVIEW",
                "INSUFFICIENT_INFORMATION",
                "Los textos disponibles son insuficientes para evaluar la categorizacion.",
            )

        if not ticket.fragmentos:
            return self._salida(
                "INCORRECT" if self.config.binary_mode else "REVIEW",
                "NO_TEXT_EVIDENCE" if self.config.binary_mode else "INSUFFICIENT_INFORMATION",
                "El ticket no contiene descripcion, detalle ni solucion evaluables.",
            )

        self.preparar_catalogo(catalogo)

        if not self._catalogo:
            if self.config.binary_mode:
                raise RuntimeError(
                    "No hay rutas disponibles en el catalogo"
                )

            return self._salida(
                "REVIEW",
                "CATALOG_EMPTY",
                "No hay rutas de referencia para realizar la comparacion semantica.",
            )

        if len(self._catalogo) < 2:
            if self.config.binary_mode:
                raise RuntimeError(
                    "El catalogo es insuficiente para comparar categorias"
                )

            return self._salida(
                "REVIEW",
                "CATALOG_INSUFFICIENT",
                "Se requieren varias rutas para efectuar una comparacion confiable.",
            )

        ruta_original = RutaCandidata(
            catalog_id=None,
            level_1=ticket.nivel_1,
            level_2=ticket.nivel_2,
            level_3=ticket.nivel_3,
        )

        rutas = list(self._catalogo)
        matriz = self._matriz
        rangos = list(self._rangos)

        indices = {
            ruta.clave:i
            for i,ruta in enumerate(rutas)
        }

        indice_original = indices.get(ruta_original.clave)

        if indice_original is None:
            inicio = matriz.shape[0]
            adicional = self._codificar(
                self._representaciones(ruta_original)
            )

            matriz = np.concatenate(
                (matriz,adicional),
                axis=0,
            )

            rangos.append((inicio,matriz.shape[0]))
            indice_original = len(rutas)
            rutas.append(ruta_original)

        fragmentos = [
            fragmento.texto
            for fragmento in ticket.fragmentos
        ]

        similitudes = self._codificar(fragmentos) @ matriz.T

        pesos = {
            "descripcion":0.50,
            "detalle":0.20,
            "solucion":0.30,
        }

        campos = [
            campo
            for campo in pesos
            if any(
                fragmento.campo == campo
                for fragmento in ticket.fragmentos
            )
        ]

        peso_total = sum(
            pesos[campo]
            for campo in campos
        )

        puntajes = []
        mejores_fragmentos = []

        for inicio,fin in rangos:
            candidatos = np.max(
                similitudes[:,inicio:fin],
                axis=1,
            )

            puntaje = 0.0
            evidencia_fragmentos = []

            for campo in campos:
                indices_campo = [
                    i
                    for i,fragmento in enumerate(ticket.fragmentos)
                    if fragmento.campo == campo
                ]

                mejor_i = max(
                    indices_campo,
                    key=lambda i:float(candidatos[i]),
                )

                valor = float(candidatos[mejor_i])

                puntaje += pesos[campo]*valor
                evidencia_fragmentos.append((mejor_i,valor))

            puntajes.append(puntaje/peso_total)
            mejores_fragmentos.append(evidencia_fragmentos)

        orden = sorted(
            range(len(rutas)),
            key=lambda i:puntajes[i],
            reverse=True,
        )

        mejor_indice = orden[0]
        mejor_score = puntajes[mejor_indice]
        score_original = puntajes[indice_original]

        segundo_score = (
            puntajes[orden[1]]
            if len(orden) > 1
            else -1.0
        )

        alternativa = rutas[mejor_indice]

        mejor_score_alternativo = max(
            (
                puntajes[i]
                for i in range(len(rutas))
                if i != indice_original
            ),
            default=-1.0,
        )

        margen_original = (
            score_original-mejor_score_alternativo
        )

        margen_alternativa = (
            mejor_score-segundo_score
        )

        evidencia = {
            "modelo":self.config.model_name,
            "metrica":"cosine_similarity",
            "score_original":round(score_original,4),
            "score_mejor":round(mejor_score,4),
            "margen_original":round(margen_original,4),
            "fragmentos_omitidos":ticket.fragmentos_omitidos,
            "ruta_alternativa":{
                "catalog_id":alternativa.catalog_id,
                "level_1":alternativa.level_1,
                "level_2":alternativa.level_2,
                "level_3":alternativa.level_3,
            } if mejor_indice != indice_original else None,
            "fragmentos":[
                {
                    "campo":ticket.fragmentos[i].campo,
                    "texto":ticket.fragmentos[i].texto[:self.config.evidence_chars],
                    "similitud":round(valor,4),
                }
                for i,valor in mejores_fragmentos[mejor_indice]
            ],
        }

        if self.config.binary_mode:
            coherencia_lexica = self._coherencia_lexica(ticket)


            proximidad_relativa = max(
                0.0,
                min(
                    1.0,
                    1.0 + 4.0 * min(0.0, margen_original),
                ),
            )


            indice_coherencia = (
                0.55*score_original
                + 0.30*coherencia_lexica
                + 0.15*proximidad_relativa
            )

            diferencia_umbral = abs(
                indice_coherencia-self.config.binary_threshold
            )

            confianza_limitada = (
                diferencia_umbral < self.config.binary_uncertainty_margin
                or ticket.fragmentos_omitidos > 0
            )

            evidencia.update({
                "engine_mode":"BINARY_EXPERIMENTAL",
                "score_lexico":round(coherencia_lexica,4),
                "proximidad_relativa":round(proximidad_relativa,4),
                "indice_coherencia":round(indice_coherencia,4),
                "umbral_binario":self.config.binary_threshold,
                "distancia_umbral":round(diferencia_umbral,4),
                "confianza_limitada":confianza_limitada,
            })

            if indice_coherencia >= self.config.binary_threshold:
                return self._salida(
                    "CORRECT",
                    "BINARY_SEMANTIC_MATCH",
                    "La evidencia presenta coherencia suficiente con la categoria registrada segun el criterio experimental.",
                    score_original,
                    evidencia=evidencia,
                )

            sugerencia = (
                alternativa.catalog_id
                if mejor_indice != indice_original
                else None
            )

            return self._salida(
                "INCORRECT",
                "BINARY_SEMANTIC_MISMATCH",
                "La evidencia no alcanza el criterio experimental de coherencia con la categoria registrada.",
                score_original,
                sugerencia,
                evidencia,
            )

        if (
            mejor_indice == indice_original
            and score_original >= self.config.correct_score
            and margen_original >= self.config.correct_margin
        ):
            return self._salida(
                "CORRECT",
                "SEMANTIC_MATCH",
                "Los textos presentan coherencia semantica con la ruta registrada segun los umbrales preliminares.",
                score_original,
                evidencia=evidencia,
            )

        if (
            mejor_indice != indice_original
            and mejor_score >= self.config.incorrect_score
            and mejor_score-score_original >= self.config.incorrect_margin
            and margen_alternativa >= self.config.alternative_margin
            and ticket.fragmentos_omitidos == 0
        ):
            return self._salida(
                "INCORRECT",
                "SEMANTIC_MISMATCH",
                "La evidencia se aproxima mas a una ruta alternativa que a la ruta registrada; clasificacion preliminar pendiente de validacion DBA.",
                score_original,
                alternativa.catalog_id,
                evidencia,
            )

        motivo = (
            "Existen varias rutas plausibles o la similitud no supera los umbrales preliminares."
        )

        codigo = "AMBIGUOUS_CATEGORY"

        if ticket.fragmentos_omitidos:
            motivo = (
                "No se puede descartar una ruta alternativa con la evidencia parcial examinada."
            )

            codigo = "PARTIAL_EVIDENCE"

        return self._salida(
            "REVIEW",
            codigo,
            motivo,
            score_original,
            evidencia=evidencia,
        )




    @staticmethod
    def _palabras_significativas(texto: str) -> set[str]:
        normalizado = unicodedata.normalize("NFKD",texto.casefold())

        normalizado = "".join(
            caracter
            for caracter in normalizado
            if not unicodedata.combining(caracter)
        )

        palabras = set(
            re.findall(r"[a-z0-9]{3,}",normalizado)
        )

        excluidas = {
            "de","del","los","las","una","uno","con","por",
            "para","que","sin","sobre","entre","desde","hasta",
            "base","datos","administracion","actividad",
            "actividades","genericas","tecnica","tecnico",
        }

        return palabras-excluidas

    def _coherencia_lexica(self,ticket: TicketPreparado) -> float:
        categoria = self._palabras_significativas(
            ticket.nivel_3
        )

        if not categoria:
            return 0.0

        contenido = " ".join((
            ticket.descripcion,
            ticket.detalle,
            ticket.solucion,
        ))

        evidencia = self._palabras_significativas(
            contenido
        )

        return len(
            categoria.intersection(evidencia)
        )/len(categoria)
