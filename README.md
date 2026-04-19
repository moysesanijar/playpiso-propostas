```markdown
# PlayPiso Propostas

Sistema de automação para geração de propostas comerciais e planilhas de orçamento da PlayPiso.

A aplicação permite:
- Coletar dados comerciais via interface interativa
- Estruturar propostas com múltiplos itens (quadras)
- Gerar automaticamente:
  - Apresentação em PowerPoint (proposta comercial)
  - Planilha Excel (orçamentista)
- Garantir padronização, velocidade e consistência entre comercial e operação

---

# Arquitetura Geral

A aplicação segue uma arquitetura modular orientada a serviços:

```

Interface (Streamlit - app.py)
↓
Modelos de dados (models.py)
↓
Serviços:
- ppt_generator.py
- excel_writer.py
- text_rules.py
- config.py
↓
Outputs:
- PPTX (proposta)
- Excel (orçamento)

```

---

# Estrutura de Pastas

```

Playpiso-Propostas/
│
├── app.py
│
├── data/
│   └── orcamentos.xlsx
│
├── outputs/
│   └── propostas/
│
├── services/
│   ├── **init**.py
│   ├── config.py
│   ├── excel_writer.py
│   ├── models.py
│   ├── ppt_generator.py
│   └── text_rules.py
│
├── templates/
│   └── template_final_tenis_playpiso.pptx
│
├── requirements.txt
└── README.md

````

---

# Como Rodar a Aplicação

## 1. Instalar dependências

```bash
pip install -r requirements.txt
````

## 2. Rodar o app

```bash
streamlit run app.py
```

## 3. Acessar no navegador

```
http://localhost:8501
```

---

# Fluxo Completo da Aplicação

1. Usuário preenche dados do cliente
2. Adiciona uma ou mais quadras
3. Sistema estrutura os dados em objetos Python
4. Ao clicar em "Gerar proposta":

   * Gera PPT (proposta comercial)
   * Atualiza Excel (base do orçamentista)
   * Gera resumo automático
5. Libera downloads diretamente na interface

---

# Modelos de Dados (models.py)

## ProposalData

Representa a proposta completa:

* Dados do cliente
* Informações comerciais
* Lista de itens

## QuadraItem

Representa cada item da proposta:

* Dimensões
* Tipo de quadra
* Estrutura
* Alambrado
* Iluminação
* Materiais

Essa camada funciona como o contrato central do sistema.

---

# Configurações (config.py)

Centraliza:

* Caminhos:

  * EXCEL_PATH
  * OUTPUT_DIR
* Templates:

  * TEMPLATE_BY_TYPE
* Opções da interface:

  * tipos de estrutura
  * galvanização
  * coligadas
* Identidade visual:

  * cores
  * fontes

---

# Escrita no Excel (excel_writer.py)

Função principal:

```python
append_to_excel(EXCEL_PATH, proposal_data)
```

Responsável por:

* Converter dados da proposta em linhas estruturadas
* Inserir no arquivo orcamentos.xlsx
* Manter histórico de propostas

---

# Geração de PPT (ppt_generator.py)

Função principal:

```python
generate_ppt(proposal_data)
```

Responsável por:

* Carregar template
* Preencher slides dinamicamente
* Inserir textos e dados técnicos
* Exportar proposta final

---

# Regras de Texto (text_rules.py)

Funções principais:

* build_project_summary()
* format_area_pt()

Responsável por transformar dados técnicos em narrativa comercial

---

# APP.PY — EXPLICAÇÃO COMPLETA

O app.py é o núcleo da aplicação e atua como:

* Interface do usuário
* Controlador de estado
* Orquestrador dos serviços

---

## 1. Configuração Inicial

```python
st.set_page_config(page_title="PlayPiso Propostas", layout="wide")
```

Define título, layout e comportamento base da aplicação.

---

## 2. Estilização (CSS Customizado)

```python
CUSTOM_CSS = """..."""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)
```

Responsável por:

* aplicar identidade visual
* customizar cores, fontes e espaçamento
* estruturar componentes visuais (header, cards, etc.)

---

## 3. Controle de Estado (session_state)

```python
init_state()
```

Inicializa:

* items_count → número de itens
* last_ppt_path → último PPT gerado
* last_excel_path → último Excel gerado
* last_summary → resumo da proposta

Garante persistência entre interações.

---

## 4. Gestão Dinâmica de Itens

### Adicionar item

```python
add_item()
```

Incrementa o número de itens.

### Remover item

```python
remove_last_item()
```

Remove o último item (mantendo mínimo de 1).

---

## 5. Construção do Item (build_quadra_item)

Função responsável por transformar dados da interface em objeto estruturado.

### Etapas:

* Lê valores do session_state
* Aplica regras de negócio:

  * maior medida = comprimento
  * menor medida = largura
* Trata dependências:

  * materiais só são considerados se fornecidos pela PlayPiso

### Retorno:

```python
QuadraItem(...)
```

Converte input bruto em estrutura padronizada.

---

## 6. Renderização dos Itens (render_item)

Responsável por montar a interface de cada item.

### Seções:

### Dimensões

* tipo de quadra
* medidas
* quantidade
* cálculo automático de área

### Condições

* dificuldade de acesso
* tipo de terreno
* fornecimento de material

### Alambrado

* altura
* dimensões
* galvanização
* tipo de estrutura

### Iluminação

* projetores
* postes
* potência
* altura
* cruzetas

### Materiais de pedreira (condicional)

Exibido apenas quando:

```python
material_pedreira == "PlayPiso"
```

Inclui:

* blocos
* cimento
* areia
* brita
* lona
* pedrisco

---

## 7. Dados do Cliente

Captura:

* Nome / Razão social
* Contato
* Telefone
* Email
* Endereço
* Local da obra
* Vendedor
* Número da proposta
* Datas

---

## 8. Geração da Proposta

```python
if st.button("Gerar proposta"):
```

### Etapas:

### 1. Validação de campos obrigatórios

```python
missing = [...]
```

Interrompe execução se houver campos faltantes.

---

### 2. Construção dos itens

```python
items = [build_quadra_item(i) for i in range(...)]
```

---

### 3. Criação do objeto principal

```python
proposal_data = ProposalData(...)
```

---

### 4. Execução dos serviços

```python
ppt_path = generate_ppt(proposal_data)
excel_path = append_to_excel(EXCEL_PATH, proposal_data)
```

---

### 5. Atualização do estado

Armazena:

* caminhos dos arquivos gerados
* resumo da proposta

---

## 9. Pós-processamento

### Exibição de resumo

```python
st.write(summary)
```

### Download dos arquivos

```python
st.download_button(...)
```

Permite baixar:

* proposta PPT
* planilha Excel

---

# Pontos Fortes da Arquitetura

* Separação clara entre interface, lógica e dados
* Facilidade de manutenção
* Estrutura escalável
* Reuso de dados via ProposalData
* Baixo acoplamento entre módulos

---

# Possíveis Evoluções

* Integração com CRM
* Substituição do Excel por banco de dados
* Geração automática de PDF
* Versionamento de propostas
* Dashboard comercial
* API para integração externa

---

# Observações

* O Excel atua como base de dados simples
* Templates PPT são críticos para o funcionamento correto
* session_state controla toda a dinâmica da aplicação
* Estrutura adequada para MVP e expansão gradual

---

# Autor

Projeto desenvolvido para automação comercial da PlayPiso.

```
```
