from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR = BASE_DIR / "outputs" / "propostas"
DATA_DIR = BASE_DIR / "data"

EXCEL_PATH = DATA_DIR / "orcamentos.xlsx"

PLAYPISO_COLORS = {
    "primary": "#D71920",
    "primary_dark": "#A50F15",
    "background": "#F7F8FA",
    "surface": "#FFFFFF",
    "text": "#1F2937",
    "muted": "#6B7280",
    "border": "#E5E7EB",
}

PLAYPISO_FONT_STACK = "Poppins, Arial, sans-serif"

TEMPLATE_BY_TYPE = {
    "Tênis Asfáltica": TEMPLATES_DIR / "template_final_tenis_playpiso.pptx",
    "Tênis Asfáltica - Cushion": TEMPLATES_DIR / "template_final_tenis_playpiso.pptx",
    "Tênis Saibro": TEMPLATES_DIR / "template_final_tenis_playpiso.pptx",
}

GALVANIZACAO_OPTIONS = ["Eletrolítico", "A fogo"]
COLIGADAS_OPTIONS = ["Laterais", "Fundos"]
TIPO_ESTRUTURA_OPTIONS = ["Gaiola", "Trapézio"]