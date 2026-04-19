from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any


@dataclass
class QuadraItem:
    item_numero: int
    tipo_quadra: str
    quantidade: int
    comprimento: float
    largura: float
    dificuldade_acesso: str
    material_pedreira: str
    tipo_terreno: str
    alambrado_altura: float
    alambrado_comprimento: float
    alambrado_largura: float
    galvanizacao: str
    coligadas: str
    tipo_estrutura: str
    travamento_tipo: str
    tela_superior: bool
    tela_sombreamento: bool
    iluminacao_quantidade: int
    quantidade_postes: int
    potencia: int
    altura_poste: float
    cruzeta_1: int
    cruzeta_2: int
    # Materiais de pedreira (só relevantes quando material_pedreira == "PlayPiso")
    qtd_blocos: int = 0
    qtd_areia_media: float = 0.0
    qtd_brita_1: float = 0.0
    qtd_po_de_pedra: float = 0.0
    qtd_cimento: int = 0
    qtd_lona_plastica: float = 0.0
    qtd_pedrisco_limpo: float = 0.0

    @property
    def area_unitaria(self) -> float:
        return round(self.comprimento * self.largura, 2)

    @property
    def area_total(self) -> float:
        return round(self.area_unitaria * self.quantidade, 2)


@dataclass
class ProposalData:
    nome_cliente: str
    cnpj_cpf: str
    contato: str
    telefone: str
    email: str
    endereco: str
    local_obra: str
    cidade: str
    estado: str
    vendedor: str
    numero_proposta: str
    data_solicitacao: date
    data_envio: date
    items: list[QuadraItem] = field(default_factory=list)

    @property
    def cliente_nome_cnpj(self) -> str:
        if self.cnpj_cpf.strip():
            return f"{self.nome_cliente} - {self.cnpj_cpf}"
        return self.nome_cliente

    @property
    def cidade_estado(self) -> str:
        left = self.cidade.strip()
        right = self.estado.strip()
        if left and right:
            return f"{left} - {right}"
        return left or right

    @property
    def local_obra_completo(self) -> str:
        parts = [self.local_obra.strip(), self.cidade_estado.strip()]
        return " | ".join([p for p in parts if p])

    @property
    def total_itens(self) -> int:
        return len(self.items)

    @property
    def total_quadras(self) -> int:
        return sum(item.quantidade for item in self.items)

    @property
    def area_total_proposta(self) -> float:
        return round(sum(item.area_total for item in self.items), 2)

    def to_excel_rows(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for item in self.items:
            rows.append(
                {
                    "data_registro": self.data_envio.isoformat(),
                    "numero_proposta": self.numero_proposta,
                    "cliente": self.nome_cliente,
                    "cnpj_cpf": self.cnpj_cpf,
                    "contato": self.contato,
                    "telefone": self.telefone,
                    "email": self.email,
                    "endereco": self.endereco,
                    "local_obra": self.local_obra,
                    "cidade": self.cidade,
                    "estado": self.estado,
                    "vendedor": self.vendedor,
                    "item_numero": item.item_numero,
                    "tipo_quadra": item.tipo_quadra,
                    "quantidade": item.quantidade,
                    "comprimento_m": item.comprimento,
                    "largura_m": item.largura,
                    "area_unitaria_m2": item.area_unitaria,
                    "area_total_m2": item.area_total,
                    "dificuldade_acesso": item.dificuldade_acesso,
                    "material_pedreira": item.material_pedreira,
                    "tipo_terreno": item.tipo_terreno,
                    "alambrado_altura_m": item.alambrado_altura,
                    "alambrado_comprimento_m": item.alambrado_comprimento,
                    "alambrado_largura_m": item.alambrado_largura,
                    "galvanizacao": item.galvanizacao,
                    "coligadas": item.coligadas,
                    "tipo_estrutura": item.tipo_estrutura,
                    "travamento_tipo": item.travamento_tipo,
                    "tela_superior": item.tela_superior,
                    "tela_sombreamento": item.tela_sombreamento,
                    "iluminacao_quantidade": item.iluminacao_quantidade,
                    "quantidade_postes": item.quantidade_postes,
                    "potencia_w": item.potencia,
                    "altura_poste_m": item.altura_poste,
                    "cruzeta_1": item.cruzeta_1,
                    "cruzeta_2": item.cruzeta_2,
                    "qtd_blocos": item.qtd_blocos,
                    "qtd_areia_media": item.qtd_areia_media,
                    "qtd_brita_1": item.qtd_brita_1,
                    "qtd_po_de_pedra": item.qtd_po_de_pedra,
                    "qtd_cimento": item.qtd_cimento,
                    "qtd_lona_plastica": item.qtd_lona_plastica,
                    "qtd_pedrisco_limpo": item.qtd_pedrisco_limpo,
                    "descricao_projeto": "",
                }
            )
        return rows

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)
