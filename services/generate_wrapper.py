"""
CLI bridge between Node.js and the Python PPT/Excel services.

Usage:
    echo '<json>' | PYTHONUNBUFFERED=1 python3 services/generate_wrapper.py

Input (stdin): JSON with keys: proposal, items, excel_path
Output (stdout): {"ok": true, "ppt_path": "..."} or {"ok": false, "error": "..."}
"""
from __future__ import annotations

import json
import sys
import traceback
from datetime import date
from pathlib import Path

def log(msg: str) -> None:
    """Log de progresso para stderr (visível no terminal do Node)."""
    print(f"[wrapper] {msg}", file=sys.stderr, flush=True)

# Must be run from project root so imports resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

log("Importando serviços...")
import services.config as cfg
from services.models import ProposalData, QuadraItem
from services.ppt_generator import generate_ppt
log("Serviços importados.")

# Map frontend court type IDs to the display labels Python expects
_TIPO_LABEL_MAP = {
    "futsal":          "Futsal",
    "beach_tennis":    "Beach Tennis",
    "poliesportiva":   "Poliesportiva",
    "tenis_asfaltica": "Tênis Asfáltica",
    "tenis_cushion":   "Tênis Asfáltica - Cushion",
    "tenis_saibro":    "Tênis Saibro",
}

# Inject new court types into TEMPLATE_BY_TYPE so generate_ppt doesn't raise
_FALLBACK_TEMPLATE = list(cfg.TEMPLATE_BY_TYPE.values())[0]
cfg.TEMPLATE_BY_TYPE["Futsal"]        = _FALLBACK_TEMPLATE
cfg.TEMPLATE_BY_TYPE["Beach Tennis"]  = _FALLBACK_TEMPLATE
cfg.TEMPLATE_BY_TYPE["Poliesportiva"] = _FALLBACK_TEMPLATE


def _sf(val, default: float = 0.0) -> float:
    """Converte val para float, retornando default se for None, "" ou inválido."""
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _si(val, default: int = 0) -> int:
    """Converte val para int, retornando default se for None, "" ou inválido."""
    if val is None or val == "":
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _apply_defaults(raw: dict, comprimento: float, largura: float) -> dict:
    d = dict(raw)

    def _norm(key, default):
        if d.get(key) is None or d.get(key) == "":
            d[key] = default

    _norm("alambrado_comprimento", comprimento)
    _norm("alambrado_largura", largura)
    _norm("galvanizacao", "A fogo")
    _norm("coligadas", "Laterais")
    _norm("tipo_estrutura", "Trapézio")
    _norm("travamento_tipo", "Travamento Superior")
    _norm("tela_superior", False)
    _norm("tela_sombreamento", False)
    _norm("iluminacao_quantidade", 0)
    _norm("quantidade_postes", 0)
    _norm("potencia", 0)
    _norm("altura_poste", 0.0)
    _norm("cruzeta_1", 0)
    _norm("cruzeta_2", 0)
    _norm("qtd_blocos", 0)
    _norm("qtd_areia_media", 0.0)
    _norm("qtd_brita_1", 0.0)
    _norm("qtd_po_de_pedra", 0.0)
    _norm("qtd_cimento", 0)
    _norm("qtd_lona_plastica", 0.0)
    _norm("qtd_pedrisco_limpo", 0.0)
    return d


def _build_quadra_item(idx: int, raw: dict) -> QuadraItem:
    comprimento = _sf(raw.get("comprimento"), 0.0)
    largura = _sf(raw.get("largura"), 0.0)
    raw = _apply_defaults(raw, comprimento, largura)

    tipo_id = raw.get("tipo_quadra", "futsal")
    tipo_label = _TIPO_LABEL_MAP.get(tipo_id, tipo_id)

    return QuadraItem(
        item_numero=idx + 1,
        tipo_quadra=tipo_label,
        quantidade=_si(raw.get("quantidade"), 1),
        comprimento=comprimento,
        largura=largura,
        dificuldade_acesso=raw.get("dificuldade_acesso") or "Fácil",
        material_pedreira=raw.get("material_pedreira") or "Cliente",
        tipo_terreno=raw.get("tipo_terreno") or "Terreno",
        alambrado_altura=_sf(raw.get("alambrado_altura"), 0.0),
        alambrado_comprimento=_sf(raw["alambrado_comprimento"], comprimento),
        alambrado_largura=_sf(raw["alambrado_largura"], largura),
        galvanizacao=raw["galvanizacao"],
        coligadas=raw["coligadas"],
        tipo_estrutura=raw["tipo_estrutura"],
        travamento_tipo=raw["travamento_tipo"],
        tela_superior=bool(raw.get("tela_superior", False)),
        tela_sombreamento=bool(raw.get("tela_sombreamento", False)),
        iluminacao_quantidade=_si(raw["iluminacao_quantidade"]),
        quantidade_postes=_si(raw["quantidade_postes"]),
        potencia=_si(raw["potencia"]),
        altura_poste=_sf(raw["altura_poste"]),
        cruzeta_1=_si(raw["cruzeta_1"]),
        cruzeta_2=_si(raw["cruzeta_2"]),
        qtd_blocos=_si(raw["qtd_blocos"]),
        qtd_areia_media=_sf(raw["qtd_areia_media"]),
        qtd_brita_1=_sf(raw["qtd_brita_1"]),
        qtd_po_de_pedra=_sf(raw["qtd_po_de_pedra"]),
        qtd_cimento=_si(raw["qtd_cimento"]),
        qtd_lona_plastica=_sf(raw["qtd_lona_plastica"]),
        qtd_pedrisco_limpo=_sf(raw["qtd_pedrisco_limpo"]),
    )


def _parse_date(val: str) -> date:
    if val:
        return date.fromisoformat(val[:10])
    return date.today()


def main() -> None:
    try:
        log("Lendo stdin...")
        raw_input = sys.stdin.read()
        log(f"Stdin recebido ({len(raw_input)} bytes). Fazendo parse...")
        payload = json.loads(raw_input)

        proposal_raw = payload["proposal"]
        items_raw = payload["items"]

        log(f"Construindo {len(items_raw)} item(s)...")
        items = [_build_quadra_item(i, r) for i, r in enumerate(items_raw)]

        proposal = ProposalData(
            nome_cliente=proposal_raw.get("nome_cliente", ""),
            cnpj_cpf=proposal_raw.get("cnpj_cpf", ""),
            contato=proposal_raw.get("contato", ""),
            telefone=proposal_raw.get("telefone", ""),
            email=proposal_raw.get("email", ""),
            endereco=proposal_raw.get("endereco", ""),
            local_obra=proposal_raw.get("local_obra", ""),
            cidade=proposal_raw.get("cidade", ""),
            estado=proposal_raw.get("estado", ""),
            vendedor=proposal_raw.get("vendedor", ""),
            numero_proposta=proposal_raw.get("numero_proposta", ""),
            data_solicitacao=_parse_date(proposal_raw.get("data_solicitacao", "")),
            data_envio=_parse_date(proposal_raw.get("data_envio", "")),
            items=items,
        )

        log("Gerando PPT (pode demorar alguns segundos com template grande)...")
        ppt_path = generate_ppt(proposal)
        log(f"PPT gerado: {ppt_path}")


        result = json.dumps({"ok": True, "ppt_path": str(ppt_path)})
        sys.stdout.write(result + "\n")
        sys.stdout.flush()

    except Exception as exc:
        tb = traceback.format_exc()
        log(f"ERRO:\n{tb}")
        error_result = json.dumps({"ok": False, "error": str(exc)})
        sys.stdout.write(error_result + "\n")
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
