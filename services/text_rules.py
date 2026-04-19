from __future__ import annotations

from services.models import ProposalData, QuadraItem


def format_decimal_pt(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}".replace(".", ",")


def format_area_pt(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return format_decimal_pt(value, 2)


def get_tipo_resumo(tipo_quadra: str) -> tuple[str, str]:
    mapping = {
        "Tênis Asfáltica": ("quadra de tênis", "quadras de tênis"),
        "Tênis Asfáltica - Cushion": ("quadra de tênis", "quadras de tênis"),
        "Tênis Saibro": ("quadra de tênis", "quadras de tênis"),
    }
    return mapping.get(tipo_quadra, ("quadra esportiva", "quadras esportivas"))


def get_base_description(tipo_quadra: str) -> str:
    if tipo_quadra == "Tênis Asfáltica":
        return "composta por piso de base asfáltica, alambrado, acessórios e iluminação"
    if tipo_quadra == "Tênis Asfáltica - Cushion":
        return "composta por piso de base asfáltica, alambrado, acessórios, iluminação e playcushion"
    if tipo_quadra == "Tênis Saibro":
        return "composta por piso de saibro, alambrado, acessórios e iluminação"
    return "composta por estrutura esportiva, acessórios e iluminação"


def get_material_pedreira_text(material_pedreira: str) -> str:
    if material_pedreira.strip().lower() == "cliente":
        return "do cliente"
    return "da PlayPiso"


def build_item_summary(item: QuadraItem) -> str:
    tipo_singular, tipo_plural = get_tipo_resumo(item.tipo_quadra)
    tipo_label = tipo_singular if item.quantidade == 1 else tipo_plural
    verbo_execucao = "executada" if item.quantidade == 1 else "executadas"

    area = format_area_pt(item.area_total)
    comprimento = format_decimal_pt(item.comprimento, 2)
    largura = format_decimal_pt(item.largura, 2)
    base_desc = get_base_description(item.tipo_quadra)

    telas = []
    if item.tela_superior:
        telas.append("tela superior")
    if item.tela_sombreamento:
        telas.append("tela de sombreamento")

    telas_texto = ""
    if telas:
        telas_texto = f", incluindo {' e '.join(telas)}"

    return (
        f"{item.quantidade} {tipo_label} "
        f"de {area}m² ({comprimento}m x {largura}m), "
        f"{base_desc}, com {item.travamento_tipo.lower()}, "
        f"acesso {item.dificuldade_acesso.lower()}, "
        f"material de pedreira por conta {get_material_pedreira_text(item.material_pedreira)}, "
        f"{verbo_execucao} sobre {item.tipo_terreno.lower()}{telas_texto}."
    )


def build_project_summary(data: ProposalData) -> str:
    if not data.items:
        return "Proposta sem itens cadastrados."

    lines = ["Proposta composta por:"]
    for item in data.items:
        lines.append(f"• {build_item_summary(item)}")
    return "\n".join(lines)


def build_piso_text(item: QuadraItem) -> str:
    linhas = [
        "Execução de guia perimetral;",
        "Aplicação de pó de pedra nivelado e compactado;",
    ]

    if item.tipo_terreno.lower() == "terreno":
        linhas.append("Aplicação de lona plástica;")

    if item.tipo_quadra == "Tênis Saibro":
        linhas.extend(
            [
                "Execução da base e preparação para sistema de saibro;",
                "Aplicação da camada final de saibro com acabamento esportivo;",
            ]
        )
    else:
        linhas.extend(
            [
                "Aplicação de pedra 01, espalhada, nivelada, compactada e emulsionada com asfalto;",
                "Aplicação de pedrisco limpo, espalhado, nivelado, compactado e emulsionado com asfalto;",
                "Aplicação de pó de pedra emulsionado com asfalto;",
                "Aplicação de uma demão de Playgrit (lama asfáltica);",
                "Aplicação de camadas regularizadoras e acabamento acrílico esportivo;",
                "Pintura das linhas de demarcação.",
            ]
        )

    return "\n".join(linhas)


def build_playcushion_text(item: QuadraItem) -> str:
    if "Cushion" not in item.tipo_quadra:
        return ""

    linhas = [
        "O sistema PLAYCUSHION foi desenvolvido para proporcionar maior conforto ao tenista, protegendo as articulações e evitando microtraumatismos;",
        "Composto por resinas especiais mescladas com grânulos finos de borracha SBR;",
        "Forma uma camada homogênea macia com alto poder de absorção de impacto;",
        "Contribui para uma superfície de jogo mais segura e agradável.",
    ]
    return "\n".join(linhas)


def build_alambrado_text(item: QuadraItem) -> str:
    estrutura = item.tipo_estrutura.lower()
    galvanizacao = item.galvanizacao.lower()

    if estrutura == "trapézio" or estrutura == "trapezio":
        portao = "02 portões de acesso com dimensões de 1,00m x 1,00m;"
        corrimao = "laterais em sistema trapézio com corrimão de 1,00m;"
    else:
        portao = "02 portões de acesso com dimensões de 1,00m x 2,00m;"
        corrimao = "laterais em sistema gaiola, sem corrimão;"

    telas = []
    if item.tela_superior:
        telas.append("instalação de tela superior")
    if item.tela_sombreamento:
        telas.append("instalação de tela de sombreamento")

    telas_texto = ""
    if telas:
        telas_texto = " e " + " e ".join(telas) + ";"

    linhas = [
        f"Fundos com {format_decimal_pt(item.alambrado_altura)}m de altura de tela e {corrimao}",
        portao,
        f"Tubos galvanizados {galvanizacao}, pintados na cor verde;",
        "Tela malha 2” x 2” fio 14 revestida em PVC verde;",
        f"Instalação de {item.travamento_tipo.lower()};{telas_texto}",
    ]
    return "\n".join(linhas)


def build_iluminacao_text(item: QuadraItem) -> str:
    linhas = [
        f"{item.iluminacao_quantidade} projetores em módulo de LED {item.potencia}W;",
        f"{item.quantidade_postes} postes telecônicos metálicos com altura livre de {format_decimal_pt(item.altura_poste)}m;",
        f"{item.cruzeta_1} cruzetas simples e {item.cruzeta_2} cruzetas complementares;",
    ]
    return "\n".join(linhas)


def build_responsabilidades_contratada(item: QuadraItem) -> str:
    linhas = [
        "Frete dos materiais e equipamentos necessários à execução dos serviços;",
        "Transporte e condução para equipe de serviços;",
        "Alojamento e alimentação para equipe de serviço;",
        "Visitas de engenheiro na obra;",
        "Fornecimento de mão de obra especializada, maquinário e ferramentas necessárias à execução dos serviços;",
    ]
    return "\n".join(linhas)


def build_responsabilidades_contratante(item: QuadraItem) -> str:
    linhas = [
        "Executar serviços de limpeza geral, terraplanagem geral, corte, aterro, remoção de terra, nivelamento e compactação;",
        "Proteger jardins, gramados, pisos e paredes próximos ao local;",
        "Local seguro para guarda de materiais, equipamentos e ferramentas;",
        "Fornecimento de banheiro e vestiário para a equipe de trabalho;",
        "Fornecimento, no local da obra, de água e energia elétrica necessárias aos trabalhos;",
    ]

    if item.tipo_terreno.lower() == "laje":
        linhas.append("Responsabilizar-se quanto à capacidade de dimensionamento da laje.")
    else:
        linhas.append("Entregar o terreno com declividade e compactação adequadas para execução.")

    return "\n".join(linhas)


def build_materiais_pedreira_text(item: QuadraItem) -> str:
    if item.material_pedreira.lower() == "cliente":
        return (
            "Fornecimento dos materiais de pedreira necessários à execução dos serviços deverá ser realizado pelo CONTRATANTE."
        )
    return (
        "Fornecimento dos materiais de pedreira necessários à execução dos serviços deverá ser realizado pela PLAYPISO."
    )