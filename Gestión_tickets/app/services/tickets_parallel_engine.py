"""Motor puro de atención paralela. SQL obtiene y consolida los intervalos.

Un barrido por actor compara únicamente intervalos todavía activos. El costo
es O(n log n + k), donde k son las intersecciones examinadas. No se usan
registros manuales ni se infieren intervalos de creación/cierre.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from heapq import heappop, heappush
import re
from unicodedata import normalize
from unicodedata import normalize, combining

INCIDENT = "Incident"
REQUEST = "Service Request"
TIPOS = (INCIDENT, REQUEST)
ParentKey = tuple[str, str]  # Ticket_ID, Ticket_type
ActorKey = tuple[str, str, str]  # Ticket_ID, Ticket_type, resolutor


def _key(row: dict) -> ParentKey:
    return row["Ticket_Padre"], row["Tipo_Padre"]


def _actor_key(row: dict) -> ActorKey:
    return (*_key(row), row["Resolutor"])


def _text_key(value: str | None) -> str:
    # Filtros recibidos de los valores canónicos de /filters; ignora mayúsculas.
    return normalize("NFC", value or "").strip().casefold()


def normalize_actor(value: str) -> str:
    return " ".join(value.translate({8203: None, 8204: None, 8205: None, 65279: None, 160: 32}).split())

def _search_key(value: str | None) -> str:
    texto = normalize(
        "NFD",
        normalize_actor(value or "")
    )

    return "".join(
        c for c in texto if not combining(c)
    ).casefold().strip()


def normalize_alp(alp: str | None, proyecto: str | None) -> str | None:
    raw = str(alp).strip() if alp is not None else ""
    if raw and re.fullmatch(r"\d+\.0+", raw):
        return raw.split(".")[0]
    if raw:
        return raw
    # Solo código numérico explícito al inicio de la denominación.
    match = re.match(r"^(\d+)\s+", proyecto or "")
    return match.group(1) if match else None


def months_between(desde: date | None, hasta: date | None) -> list[str]:
    if desde is None or hasta is None or desde > hasta:
        return []
    y, m = desde.year, desde.month
    out = []
    while (y, m) <= (hasta.year, hasta.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def interval_months(start: datetime, end: datetime):
    """Meses con intersección positiva; un fin a medianoche no suma otro mes."""
    y, m = start.year, start.month
    while datetime(y, m, 1) < end:
        yield f"{y:04d}-{m:02d}"
        if (y, m) == (9999, 12):
            break
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


@dataclass(frozen=True)
class Relation:
    other: ParentKey
    start: datetime
    end: datetime


def detect_relations(consolidated: list[dict]) -> dict[ActorKey, list[Relation]]:
    by_actor = defaultdict(list)
    for row in consolidated:
        if row["Inicio"] < row["Fin"]:
            by_actor[row["Resolutor"]].append(row)
    relations = defaultdict(list)
    for actor, rows in by_actor.items():
        rows.sort(key=lambda r: (r["Inicio"], r["Fin"], _key(r)))
        active = {}
        ends = []
        for idx, row in enumerate(rows):
            start, end = row["Inicio"], row["Fin"]
            key = _key(row)
            while ends and ends[0][0] <= start:
                _, expired = heappop(ends)
                active.pop(expired, None)
            for previous in active.values():
                other = _key(previous)
                if key[0] == other[0]:
                    continue
                overlap_end = min(end, previous["Fin"])
                relations[(*key, actor)].append(Relation(other, start, overlap_end))
                relations[(*other, actor)].append(Relation(key, start, overlap_end))
            active[idx] = row
            heappush(ends, (end, idx))
    return {key: sorted(values, key=lambda r: (r.start, r.end, r.other)) for key, values in relations.items()}


def max_simultaneous(relations: list[Relation]) -> int:
    """Incluye el ticket base. Un mismo compañero cuenta una vez por instante."""
    events = defaultdict(list)
    for rel in relations:
        events[rel.start].append((rel.other, 1))
        events[rel.end].append((rel.other, -1))
    counts = defaultdict(int)
    active = peak = 0
    for stamp in sorted(events):
        changes = defaultdict(int)
        for other, delta in events[stamp]:
            changes[other] += delta
        for other, delta in changes.items():
            old = counts[other]
            new = old + delta
            active += int(new > 0) - int(old > 0)
            counts[other] = new
        peak = max(peak, active)
    return peak + 1


class ParallelSnapshot:
    def __init__(self, desde, hasta, parents, consolidated, originals):
        self.months = months_between(desde, hasta)
        self.parents = {_key(row): dict(row) for row in parents}
        self.relations = detect_relations(consolidated)
        self.evaluated = defaultdict(set)
        self.parallel = defaultdict(set)
        self.originals = defaultdict(list)
        for row in consolidated:
            for month in interval_months(row["Inicio"], row["Fin"]):
                self.evaluated[month].add(_actor_key(row))
        for key, relations in self.relations.items():
            for rel in relations:
                for month in interval_months(rel.start, rel.end):
                    self.parallel[month].add(key)
        for row in originals:
            key = _actor_key(row)
            if key in self.relations:
                self.originals[key].append(row)
        # Conservar únicamente evidencia de tickets con alguna coincidencia.
        self.explorer = {key: self._ticket(key, rels) for key, rels in self.relations.items()}

    def options(self):
        def values(field):
            return sorted({row[field] for row in self.parents.values() if row.get(field)}, key=lambda v: (_text_key(v), v))
        return {"prioridades": values("Prioridad"), "motivos": values("Motivo"),
                "proyectos": values("Proyecto"), "tipos_ticket": list(TIPOS)}

    def eligible(self, filtros):
        projects = {_text_key(p) for p in filtros.proyectos} if not filtros.todos_proyectos else set()
        return {key for key, p in self.parents.items()
                if (not filtros.ticket_type or key[1] == filtros.ticket_type)
                and (not filtros.prioridad or _text_key(p.get("Prioridad")) == _text_key(filtros.prioridad))
                and (not filtros.motivo or _text_key(p.get("Motivo")) == _text_key(filtros.motivo))
                and (not projects or _text_key(p.get("Proyecto")) in projects)}

    @staticmethod
    def _counts(keys):
        return (sum(k[1] == INCIDENT for k in keys), sum(k[1] == REQUEST for k in keys))

    def kpis(self, eligible):
        parallel_actor = {
            k for k in self.relations
            if k[:2] in eligible
        }

        parallel = {
            k[:2] for k in parallel_actor
        }

        resolutores = {
            k[2] for k in parallel_actor
        }

        proyectos = {
            self.parents[k].get("Proyecto")
            for k in parallel
        } - {None, ""}

        return {
            "total_tickets_paralelos": len(parallel),
            "total_resolutores": len(resolutores),
            "total_proyectos": len(proyectos)
        }

    def monthly(self, eligible):
        out = []
        for month in self.months:
            ie, re = self._counts({k[:2] for k in self.evaluated.get(month, ()) if k[:2] in eligible})
            ip, rp = self._counts({k[:2] for k in self.parallel.get(month, ()) if k[:2] in eligible})
            out.append(dict(periodo=month, incidentes_evaluados=ie, incidentes_paralelos=ip,
                            requerimientos_evaluados=re, requerimientos_paralelos=rp))
        return out

    def grouped(self, eligible, by_project=False):
        groups = defaultdict(set)
        alps = defaultdict(set)
        for month in self.months:
            for k in self.parallel.get(month, ()):
                if k[:2] not in eligible:
                    continue
                p = self.parents[k[:2]]
                label = (p.get("Proyecto") or "Sin especificar") if by_project else k[2]
                groups[(label, month)].add(k[:2])
                if by_project:
                    alp = normalize_alp(p.get("ALP"), p.get("Proyecto"))
                    if alp:
                        alps[label].add(alp)
        out = []
        for (label, month), keys in sorted(groups.items()):
            inc, req = self._counts(keys)
            row = dict(periodo=month, incidentes_paralelos=inc, requerimientos_paralelos=req, total_paralelos=len(keys))
            if by_project:
                row.update(proyecto=label, alp=next(iter(alps[label])) if len(alps[label]) == 1 else normalize_alp(None, label))
            else:
                row["resolutor"] = label
            out.append(row)
        return out

    def _ticket(self, key, relations):
        p = self.parents[key[:2]]
        return dict(ticket_id=key[0], ticket_type=key[1], resolutor=key[2],
                    proyecto=p.get("Proyecto"), alp=normalize_alp(p.get("ALP"), p.get("Proyecto")),
                    prioridad=p.get("Prioridad"), motivo=p.get("Motivo"), descripcion=p.get("Descripcion"),
                    fuente_metadatos=p["Fuente_Metadatos"], otros_tickets_paralelos=len({r.other for r in relations}),
                    maximo_tickets_simultaneos=max_simultaneous(relations), coincidencias=len(relations),
                    primera_coincidencia=min(r.start for r in relations), ultima_coincidencia=max(r.end for r in relations))



    def tickets(
        self,
        eligible,
        pagina,
        tamano,
        tipo_local=None,
        resolutor_busqueda=None
    ):
        busqueda = _search_key(resolutor_busqueda)

        rows = [
            row
            for key, row in self.explorer.items()
            if key[:2] in eligible
            and (not tipo_local or key[1] == tipo_local)
            and (
                not busqueda
                or busqueda in _search_key(row["resolutor"])
            )
        ]

        rows.sort(
            key=lambda r: (
                -r["maximo_tickets_simultaneos"],
                -r["otros_tickets_paralelos"],
                -r["coincidencias"],
                r["ticket_id"],
                r["resolutor"]
            )
        )

        start = (pagina - 1) * tamano

        return dict(
            items=rows[start:start + tamano],
            total=len(rows),
            pagina=pagina,
            tamano=tamano
        )

    def detail(self, eligible, ticket_id, tipo, resolutor):
        requested = _text_key(normalize_actor(resolutor))
        keys = [k for k in self.explorer if k[:2] in eligible and k[0] == ticket_id and k[1] == tipo
                and _text_key(k[2]) == requested]
        if len(keys) != 1:
            return None
        key = keys[0]
        out = []
        for rel in self.relations[key]:
            p = self.parents[rel.other]
            evidence = []
            for role, actor_key in (("Seleccionado", key), ("Relacionado", (*rel.other, key[2]))):
                for row in self.originals.get(actor_key, ()):
                    if row["Inicio"] < rel.end and row["Fin"] > rel.start:
                        evidence.append(dict(rol=role, ticket_padre=row["Ticket_Padre"], ticket_origen=row["Ticket_Origen"],
                                             tipo_origen=row["Tipo_Origen"], report_time_id=row["Report_Time_ID"],
                                             resolutor_original=row["Resolutor_Original"], grupo_resolutor=row.get("Grupo_Resolutor"),
                                             inicio_original=row["Inicio_Original"], fin_original=row["Fin_Original"],
                                             estado_origen=row.get("Estado_Origen"), motivo_origen=row.get("Motivo_Origen"),
                                             descripcion_origen=row.get("Descripcion_Origen")))
            evidence.sort(key=lambda r: (r["rol"], r["inicio_original"], r["report_time_id"]))
            seconds = int((rel.end - rel.start).total_seconds())
            out.append(dict(ticket_relacionado=rel.other[0], tipo_relacionado=rel.other[1],
                            proyecto_relacionado=p.get("Proyecto"), alp_relacionado=normalize_alp(p.get("ALP"), p.get("Proyecto")),
                            prioridad_relacionada=p.get("Prioridad"), motivo_relacionado=p.get("Motivo"),
                            descripcion_relacionada=p.get("Descripcion"), fuente_metadatos=p["Fuente_Metadatos"],
                            resolutor=key[2], inicio_paralelo=rel.start, fin_paralelo=rel.end,
                            segundos_paralelo=seconds, minutos_paralelo=round(seconds / 60, 2), evidencia=evidence))
        return dict(ticket=self.explorer[key], coincidencias=out)
