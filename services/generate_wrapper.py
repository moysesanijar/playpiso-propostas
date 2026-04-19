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


def _apply_defaults(raw: dict, comprimento: float, largura: float) -> dict:
    d = dict(raw)
    d.setdefault("alambrado_comprimento", comprimento)
    d.setdefault("alambrado_largura", largura)
    d.setdefault("galvanizacao", "A fogo")
    d.setdefault("coligadas", "Laterais")
    d.setdefault("tipo_estrutura", "Trapézio")
    d.setdefault("travamento_tipo", "Travamento Superior")
    d.setdefault("tela_superior", False)
    d.setdefault("tela_sombreamento", False)
    d.setdefault("iluminacao_quantidade", 0)
    d.setdefault("quantidade_postes", 0)
    d.setdefault("potencia", 0)
    d.setdefault("altura_poste", 0.0)
    d.setdefault("cruzeta_1", 0)
    d.setdefault("cruzeta_2", 0)
    d.setdefault("qtd_blocos", 0)
    d.setdefault("qtd_areia_media", 0.0)
    d.setdefault("qtd_brita_1", 0.0)
    d.setdefault("qtd_po_de_pedra", 0.0)
    d.setdefault("qtd_cimento", 0)
    d.setdefault("qtd_lona_plastica", 0.0)
    d.setdefault("qtd_pedrisco_limpo", 0.0)
    if not d.get("travamento_tipo"):
        d["travamento_tipo"] = "Travamento Superior"
    if not d.get("tipo_estrutura"):
        d["tipo_estrutura"] = "Trapézio"
    if not d.get("coligadas"):
        d["coligadas"] = "Laterais"
    return d


def _build_quadra_item(idx: int, raw: dict) -> QuadraItem:
    comprimento = float(raw.get("comprimento", 0))
    largura = float(raw.get("largura", 0))
    raw = _apply_defaults(raw, comprimento, largura)

    tipo_id = raw.get("tipo_quadra", "futsal")
    tipo_label = _TIPO_LABEL_MAP.get(tipo_id, tipo_id)

    return QuadraItem(
        item_numero=idx + 1,
        tipo_quadra=tipo_label,
        quantidade=int(raw.get("quantidade", 1)),
        comprimento=comprimento,
        largura=largura,
        dificuldade_acesso=raw.get("dificuldade_acesso", "Fácil"),
        material_pedreira=raw.get("material_pedreira", "Cliente"),
        tipo_terreno=raw.get("tipo_terreno", "Terreno"),
        alambrado_altura=float(raw.get("alambrado_altura", 0)),
        alambrado_comprimento=float(raw.get("alambrado_comprimento", comprimento)),
        alambrado_largura=float(raw.get("alambrado_largura", largura)),
        galvanizacao=raw["galvanizacao"],
        coligadas=raw["coligadas"],
        tipo_estrutura=raw["tipo_estrutura"],
        travamento_tipo=raw["travamento_tipo"],
        tela_superior=bool(raw.get("tela_superior", False)),
        tela_sombreamento=bool(raw.get("tela_sombreamento", False)),
        iluminacao_quantidade=int(raw["iluminacao_quantidade"]),
        quantidade_postes=int(raw["quantidade_postes"]),
        potencia=int(raw["potencia"]),
        altura_poste=float(raw["altura_poste"]),
        cruzeta_1=int(raw["cruzeta_1"]),
        cruzeta_2=int(raw["cruzeta_2"]),
        qtd_blocos=int(raw["qtd_blocos"]),
        qtd_areia_media=float(raw["qtd_areia_media"]),
        qtd_brita_1=float(raw["qtd_brita_1"]),
        qtd_po_de_pedra=float(raw["qtd_po_de_pedra"]),
        qtd_cimento=int(raw["qtd_cimento"]),
        qtd_lona_plastica=float(raw["qtd_lona_plastica"]),
        qtd_pedrisco_limpo=float(raw["qtd_pedrisco_limpo"]),
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
