/**
 * PlayPiso Propostas — Frontend SPA
 * Vanilla JS, sem frameworks.
 */

// ============================================================
// Autenticação
// ============================================================

const AUTH = {
  token: localStorage.getItem('pp_token'),
  user: (() => { try { return JSON.parse(localStorage.getItem('pp_user')); } catch { return null; } })(),
};

function authSalvar(token, user) {
  AUTH.token = token;
  AUTH.user = user;
  localStorage.setItem('pp_token', token);
  localStorage.setItem('pp_user', JSON.stringify(user));
}

function authLimpar() {
  AUTH.token = null;
  AUTH.user = null;
  localStorage.removeItem('pp_token');
  localStorage.removeItem('pp_user');
}

function mostrarLogin() {
  const ls = document.getElementById('view-login');
  ls.hidden = false;
  document.getElementById('form-login').hidden = false;
  document.getElementById('form-cadastro').hidden = true;
  document.querySelector('.login-switch').hidden = false;
  document.getElementById('switch-login').hidden = true;
  document.getElementById('login-erro').hidden = true;
}

function mostrarCadastro() {
  document.getElementById('form-login').hidden = true;
  document.getElementById('form-cadastro').hidden = false;
  document.querySelector('.login-switch').hidden = true;
  document.getElementById('switch-login').hidden = false;
  document.getElementById('cad-erro').hidden = true;
}

function esconderLogin() {
  document.getElementById('view-login').hidden = true;
}

function atualizarAvatar() {
  if (!AUTH.user) return;
  const iniciais = AUTH.user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  document.getElementById('avatar-initials').textContent = iniciais;
  document.getElementById('avatar-menu-nome').textContent = AUTH.user.nome;
  document.getElementById('avatar-menu-email').textContent = AUTH.user.email;
}

function toggleAvatarMenu() {
  const menu = document.getElementById('avatar-menu');
  menu.hidden = !menu.hidden;
}

function logout() {
  authLimpar();
  document.getElementById('avatar-menu').hidden = true;
  mostrarLogin();
}

async function fazerLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  const btn = document.getElementById('btn-login');

  erroEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  try {
    const data = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    }).then(r => r.json());

    if (!data.ok) throw new Error(data.error);

    authSalvar(data.token, data.user);
    esconderLogin();
    iniciarApp();
  } catch (err) {
    erroEl.textContent = err.message;
    erroEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function fazerCadastro(e) {
  e.preventDefault();
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const erroEl = document.getElementById('cad-erro');
  const btn = document.getElementById('btn-cadastro');

  erroEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Criando conta…';

  try {
    const data = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha }),
    }).then(r => r.json());

    if (!data.ok) throw new Error(data.error);

    authSalvar(data.token, data.user);
    esconderLogin();
    iniciarApp();
  } catch (err) {
    erroEl.textContent = err.message;
    erroEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
}

// Fecha o dropdown do avatar ao clicar fora
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('avatar-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const menu = document.getElementById('avatar-menu');
    if (menu) menu.hidden = true;
  }
});

// ============================================================
// Estado global
// ============================================================

const STATE = {
  view: 'nova',
  quadraConfig: null,
  form: {
    proposal: {},
    items: [],
  },
  propostas: [],
  propostaSelecionada: null,
  filtroStatus: 'todos',
  buscaTexto: '',
  loading: false,
  historicoBusca: '',
};

// Campos obrigatórios no formulário de proposta
const CAMPOS_OBRIGATORIOS = ['nome_cliente', 'contato', 'telefone', 'local_obra'];

// ============================================================
// Utils
// ============================================================

function showToast(msg, tipo = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setLoading(on) {
  STATE.loading = on;
  document.getElementById('loading-overlay').hidden = !on;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR');
}

function formatArea(v) {
  const n = parseFloat(v);
  if (!n) return '0 m²';
  return Number.isInteger(n) ? `${n} m²` : `${n.toFixed(2)} m²`;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function statusLabel(s) {
  return { pendente: 'Pendente', em_orcamento: 'Em orçamento', concluido: 'Concluído' }[s] || s;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// API helpers
// ============================================================

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH.token) headers['Authorization'] = `Bearer ${AUTH.token}`;

  const res = await fetch(path, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    authLimpar();
    mostrarLogin();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ============================================================
// Navegação entre views
// ============================================================

function switchView(view) {
  STATE.view = view;

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');

  if (view === 'orcamentos' || view === 'historico') {
    carregarPropostas();
  }
}

// ============================================================
// Carregar propostas da API
// ============================================================

async function carregarPropostas() {
  try {
    const lista = await api('/api/propostas');
    STATE.propostas = lista;
    renderLista();
    renderHistorico();
    atualizarBadge();
  } catch (err) {
    showToast('Erro ao carregar propostas: ' + err.message, 'erro');
  }
}

function atualizarBadge() {
  const count = STATE.propostas.filter(p => p.status === 'pendente').length;
  const badge = document.getElementById('badge-pendentes');
  badge.textContent = count > 0 ? count : '';
}

// ============================================================
// View Orçamentos — lista
// ============================================================

function setFiltro(status) {
  STATE.filtroStatus = status;
  document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  renderLista();
}

function renderLista() {
  const container = document.getElementById('lista-propostas');
  let lista = STATE.propostas;

  if (STATE.filtroStatus !== 'todos') {
    lista = lista.filter(p => p.status === STATE.filtroStatus);
  }

  if (!lista.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--texto-terciario);font-size:12px">Nenhuma proposta</div>';
    return;
  }

  container.innerHTML = lista.map(p => {
    const selecionado = STATE.propostaSelecionada?.id === p.id ? 'selecionado' : '';
    const primeiroTipo = p.items?.[0]?.tipo_quadra || '—';
    const totalQ = p.items?.reduce((s, i) => s + (i.quantidade || 1), 0) || 0;
    return `
      <div class="proposta-card ${selecionado}" onclick="app.selecionarProposta('${p.id}')">
        <div class="proposta-card-header">
          <span class="proposta-numero">${p.id}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
            <button class="proposta-del-btn" title="Apagar proposta" onclick="event.stopPropagation();app.deletarProposta('${p.id}')">×</button>
          </div>
        </div>
        <div class="proposta-cliente">${p.proposal?.nome_cliente || '—'}</div>
        <div class="proposta-meta">${primeiroTipo} · ${totalQ} quadra${totalQ !== 1 ? 's' : ''} · ${formatDate(p.criado_em)}</div>
      </div>
    `;
  }).join('');
}

async function selecionarProposta(id) {
  const proposta = STATE.propostas.find(p => p.id === id);
  if (!proposta) return;

  STATE.propostaSelecionada = proposta;
  renderLista(); // atualiza seleção visual

  const vazio = document.getElementById('detalhe-vazio');
  const conteudo = document.getElementById('detalhe-conteudo');
  vazio.style.display = 'none';
  conteudo.style.display = 'block';
  conteudo.innerHTML = renderDetalhe(proposta);
}

function renderDetalhe(p) {
  const pr = p.proposal || {};
  const vendedor = pr.vendedor || '—';
  const data = formatDate(pr.data_solicitacao);
  const validade = formatDate(pr.data_envio);

  let quadrasHtml = (p.items || []).map((item, i) => {
    const area = calcularAreaItem(item);
    const tags = buildTags(item);
    return `
      <div class="detalhe-secao">
        <div class="detalhe-secao-title">Quadra ${i + 1} — ${item.tipo_quadra || '—'}</div>
        <div class="kv-table">
          <span class="kv-key">Quantidade</span><span class="kv-value">${item.quantidade || 1}</span>
          <span class="kv-key">Dimensões</span><span class="kv-value">${item.comprimento || 0} × ${item.largura || 0} m</span>
          <span class="kv-key">Área total</span><span class="kv-value">${formatArea(area)}</span>
          ${item.dificuldade_acesso ? `<span class="kv-key">Acesso</span><span class="kv-value">${item.dificuldade_acesso}</span>` : ''}
          ${item.tipo_terreno ? `<span class="kv-key">Terreno</span><span class="kv-value">${item.tipo_terreno}</span>` : ''}
          ${item.alambrado_altura ? `<span class="kv-key">Alambrado</span><span class="kv-value">${item.alambrado_altura} m altura</span>` : ''}
          ${item.galvanizacao ? `<span class="kv-key">Galvanização</span><span class="kv-value">${item.galvanizacao}</span>` : ''}
          ${item.tipo_estrutura ? `<span class="kv-key">Estrutura</span><span class="kv-value">${item.tipo_estrutura}</span>` : ''}
          ${item.iluminacao_quantidade ? `<span class="kv-key">Iluminação</span><span class="kv-value">${item.iluminacao_quantidade} projetores · ${item.potencia || 0}W · ${item.quantidade_postes || 0} postes</span>` : ''}
          ${item.material_pedreira === 'PlayPiso' ? `<span class="kv-key">Materiais</span><span class="kv-value">Fornecido pela PlayPiso</span>` : ''}
        </div>
        ${tags.length ? `<div class="detalhe-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');

  const pptBotao = p.ppt_path
    ? `<a href="${p.download_url || p.ppt_path}" download class="btn-outline btn-sm">Baixar PPTX</a>`
    : '';

  return `
    <div class="detalhe-header">
      <div class="detalhe-titulo">
        <h2>${pr.nome_cliente || '—'}</h2>
        <p>${p.id} · ${vendedor} · ${data}${validade ? ' (válido até ' + validade + ')' : ''}</p>
      </div>
      <div class="detalhe-acoes">
        ${pptBotao}
        <select class="status-select" onchange="app.mudarStatus('${p.id}', this.value)">
          <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="em_orcamento" ${p.status === 'em_orcamento' ? 'selected' : ''}>Em orçamento</option>
          <option value="concluido" ${p.status === 'concluido' ? 'selected' : ''}>Concluído</option>
        </select>
        <button class="btn-primary btn-sm" id="btn-gerar-${p.id}" onclick="app.gerarProposta('${p.id}')">
          ${p.ppt_path ? 'Regenerar PPT' : 'Gerar Proposta'}
        </button>
      </div>
    </div>
    <div class="detalhe-body">
      <div class="detalhe-secao">
        <div class="detalhe-secao-title">Cliente</div>
        <div class="kv-table">
          <span class="kv-key">Nome</span><span class="kv-value">${pr.nome_cliente || '—'}</span>
          ${pr.cnpj_cpf ? `<span class="kv-key">CNPJ/CPF</span><span class="kv-value">${pr.cnpj_cpf}</span>` : ''}
          <span class="kv-key">Contato</span><span class="kv-value">${pr.contato || '—'}</span>
          <span class="kv-key">Telefone</span><span class="kv-value">${pr.telefone || '—'}</span>
          ${pr.email ? `<span class="kv-key">E-mail</span><span class="kv-value">${pr.email}</span>` : ''}
          ${pr.endereco ? `<span class="kv-key">Endereço</span><span class="kv-value">${pr.endereco}</span>` : ''}
          <span class="kv-key">Local da obra</span><span class="kv-value">${pr.local_obra || '—'}${pr.cidade ? ' · ' + pr.cidade + (pr.estado ? '-' + pr.estado : '') : ''}</span>
        </div>
      </div>
      ${quadrasHtml}
      <div id="resultado-gerar-${p.id}" class="gerar-resultado"></div>
    </div>
  `;
}

async function deletarProposta(id) {
  if (!confirm('Apagar esta proposta? Esta ação não pode ser desfeita.')) return;
  try {
    await api(`/api/propostas/${id}`, { method: 'DELETE' });
    STATE.propostas = STATE.propostas.filter(p => p.id !== id);
    if (STATE.propostaSelecionada?.id === id) {
      STATE.propostaSelecionada = null;
      document.getElementById('detalhe-vazio').style.display = '';
      document.getElementById('detalhe-conteudo').style.display = 'none';
    }
    renderLista();
    renderHistorico();
    atualizarBadge();
    showToast('Proposta apagada', 'sucesso');
  } catch (err) {
    showToast('Erro ao apagar: ' + err.message, 'erro');
  }
}

async function mudarStatus(id, novoStatus) {
  try {
    const updated = await api(`/api/propostas/${id}`, {
      method: 'PATCH',
      body: { status: novoStatus },
    });
    const idx = STATE.propostas.findIndex(p => p.id === id);
    if (idx !== -1) STATE.propostas[idx] = updated;
    if (STATE.propostaSelecionada?.id === id) STATE.propostaSelecionada = updated;
    renderLista();
    atualizarBadge();
    showToast('Status atualizado', 'sucesso');
  } catch (err) {
    showToast('Erro ao atualizar status: ' + err.message, 'erro');
  }
}

async function gerarProposta(id) {
  const btn = document.getElementById(`btn-gerar-${id}`);
  const resultado = document.getElementById(`resultado-gerar-${id}`);

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Gerando…';
  }
  if (resultado) {
    resultado.className = 'gerar-resultado';
    resultado.innerHTML = '';
  }

  try {
    const res = await api('/api/gerar-proposta', {
      method: 'POST',
      body: { proposta_id: id },
    });

    // Atualiza proposta local com ppt_path
    const idx = STATE.propostas.findIndex(p => p.id === id);
    if (idx !== -1) {
      STATE.propostas[idx].ppt_path = res.ppt_path;
      STATE.propostas[idx].download_url = res.download_url;
      STATE.propostaSelecionada = STATE.propostas[idx];
    }

    if (resultado) {
      resultado.className = 'gerar-resultado sucesso';
      resultado.innerHTML = `PPT gerado com sucesso. <a href="${res.download_url}" download>Baixar PPTX</a>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Regenerar PPT';
    }
    showToast('Proposta gerada com sucesso!', 'sucesso');
  } catch (err) {
    if (resultado) {
      resultado.className = 'gerar-resultado erro';
      resultado.textContent = 'Erro: ' + err.message;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Gerar Proposta';
    }
    showToast('Erro ao gerar: ' + err.message, 'erro');
  }
}

// ============================================================
// View Histórico
// ============================================================

const filtrarHistorico = debounce(() => {
  STATE.historicoBusca = document.getElementById('historico-busca').value;
  renderHistorico();
}, 300);

function renderHistorico() {
  const container = document.getElementById('historico-lista');
  const q = STATE.historicoBusca.toLowerCase();

  let lista = [...STATE.propostas];
  if (q) {
    lista = lista.filter(p =>
      (p.proposal?.nome_cliente || '').toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }

  if (!lista.length) {
    container.innerHTML = '<div style="color:var(--texto-terciario);font-size:12px;padding:12px 0">Nenhuma proposta encontrada</div>';
    return;
  }

  container.innerHTML = lista.map(p => {
    const pr = p.proposal || {};
    const totalQ = p.items?.reduce((s, i) => s + (i.quantidade || 1), 0) || 0;
    const solicitante = pr.vendedor || p.criado_por?.nome || '—';
    const pdfBadge = p.ppt_gerado_em
      ? `<span class="hist-badge hist-badge-pdf" title="PDF gerado em ${formatDate(p.ppt_gerado_em)}">PDF ${formatDate(p.ppt_gerado_em)}</span>`
      : `<span class="hist-badge hist-badge-sem-pdf">Sem PDF</span>`;
    return `
      <div class="historico-card" onclick="app.abrirHistoricoDetalhe('${p.id}')">
        <div class="historico-card-info">
          <div class="historico-card-num">${p.id}</div>
          <div class="historico-card-cliente">${pr.nome_cliente || '—'}</div>
          <div class="historico-card-meta">${pr.local_obra || '—'} · ${totalQ} quadra${totalQ !== 1 ? 's' : ''}</div>
          <div class="historico-card-datas">
            <span>Solicitado por <strong>${solicitante}</strong> em ${formatDate(p.criado_em)}</span>
            ${pdfBadge}
          </div>
        </div>
        <span class="status-badge status-${p.status}">${statusLabel(p.status)}</span>
      </div>
    `;
  }).join('');
}

function abrirHistoricoDetalhe(id) {
  const proposta = STATE.propostas.find(p => p.id === id);
  if (!proposta) return;

  document.getElementById('modal-historico-titulo').textContent = `${proposta.id} — ${proposta.proposal?.nome_cliente || ''}`;
  document.getElementById('modal-historico-body').innerHTML = renderBriefingContent(proposta);
  document.getElementById('modal-historico').showModal();
}

// ============================================================
// Quadra items — formulário dinâmico
// ============================================================

function getConfig() {
  return STATE.quadraConfig;
}

function getSecao(id) {
  return getConfig().secoes[id];
}

function getTipoCfg(id) {
  return getConfig().tipos.find(t => t.id === id);
}

function defaultItem(index) {
  const tipo = getConfig().tipos[0];
  const item = { tipo_quadra: tipo.id, _index: index };
  // Aplica defaults de todas as seções do tipo padrão
  for (const secId of tipo.secoes) {
    const sec = getSecao(secId);
    for (const campo of sec.campos) {
      item[campo.id] = campo.default !== null && campo.default !== undefined ? campo.default : '';
    }
  }
  return item;
}

function addItem() {
  const idx = STATE.form.items.length;
  const item = defaultItem(idx);
  STATE.form.items.push(item);
  renderItems();
}

function removeItem(index) {
  if (STATE.form.items.length <= 1) return;
  STATE.form.items.splice(index, 1);
  STATE.form.items.forEach((item, i) => item._index = i);
  renderItems();
}

function renderItems() {
  const container = document.getElementById('items-container');
  container.innerHTML = STATE.form.items.map((item, i) => renderItemCard(item, i)).join('');
  attachItemListeners();
}

function renderItemCard(item, index) {
  const config = getConfig();
  const tipoCfg = getTipoCfg(item.tipo_quadra) || config.tipos[0];
  const area = calcularAreaItem(item);

  const tiposOptions = config.tipos.map(t =>
    `<option value="${t.id}" ${t.id === item.tipo_quadra ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const secoesHtml = tipoCfg.secoes.map(secId => {
    const sec = getSecao(secId);
    const isCondicional = !!sec.condicional;
    const condicaoAtendida = isCondicional ? item[sec.condicional.campo] === sec.condicional.valor : true;
    const visivel = !isCondicional || condicaoAtendida;

    return `
      <div class="quadra-secao ${isCondicional ? 'quadra-secao-condicional' : ''} ${isCondicional && visivel ? 'visivel' : ''}"
           data-secao="${secId}" data-condicional="${isCondicional ? JSON.stringify(sec.condicional) : ''}">
        <div class="section-subtitle">${sec.titulo}</div>
        <div class="grid-3">
          ${sec.campos.map(campo => renderCampo(campo, item, index)).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="quadra-card" data-item-index="${index}">
      <div class="quadra-header">
        <span class="quadra-pill">Quadra ${index + 1}</span>
        <select class="quadra-tipo-select" data-index="${index}" data-field="tipo_quadra" onchange="app.onTipoChange(${index}, this.value)">
          ${tiposOptions}
        </select>
        <label class="quadra-area-display">Área m²:
        <input type="number" class="quadra-area-input" data-index="${index}" data-field="area_total"
          min="0" step="0.01" value="${item.area_total !== undefined && item.area_total !== '' ? item.area_total : area || ''}"
          placeholder="0" />
      </label>
        <button class="quadra-remove" onclick="app.removeItem(${index})" title="Remover quadra">×</button>
      </div>
      <div class="quadra-body" id="quadra-body-${index}">
        ${secoesHtml}
      </div>
    </div>
  `;
}

function renderCampo(campo, item, index) {
  const val = item[campo.id] !== undefined ? item[campo.id] : (campo.default !== null ? campo.default : '');

  if (campo.tipo === 'number') {
    return `
      <div class="field">
        <label>${campo.label}</label>
        <input type="number"
          data-index="${index}" data-field="${campo.id}"
          min="${campo.min !== undefined ? campo.min : 0}"
          step="${campo.step || 1}"
          value="${val !== '' ? val : ''}"
          placeholder="0"
          ${campo.vinculado_a ? `data-vinculado-a="${campo.vinculado_a}"` : ''}
        />
      </div>
    `;
  }

  if (campo.tipo === 'select') {
    const opts = campo.opcoes.map(op =>
      `<option value="${op}" ${op === val ? 'selected' : ''}>${op}</option>`
    ).join('');
    return `
      <div class="field">
        <label>${campo.label}</label>
        <select data-index="${index}" data-field="${campo.id}">${opts}</select>
      </div>
    `;
  }

  if (campo.tipo === 'radio') {
    const radios = campo.opcoes.map(op => {
      const checked = op === val;
      return `
        <label class="radio-option ${checked ? 'selecionado' : ''}">
          <input type="radio" name="r-${index}-${campo.id}" value="${op}" ${checked ? 'checked' : ''}
            data-index="${index}" data-field="${campo.id}" />
          ${op}
        </label>
      `;
    }).join('');
    return `
      <div class="field" style="grid-column: 1/-1">
        <label>${campo.label}</label>
        <div class="radio-group">${radios}</div>
      </div>
    `;
  }

  if (campo.tipo === 'checkbox') {
    return `
      <div class="field" style="grid-column: 1/-1">
        <label class="checkbox-option">
          <input type="checkbox"
            data-index="${index}" data-field="${campo.id}"
            ${val ? 'checked' : ''} />
          ${campo.label}
        </label>
      </div>
    `;
  }

  return '';
}

function calcularAreaItem(item) {
  // Se o orçamentista definiu uma área manual, usa ela
  if (item.area_total !== undefined && item.area_total !== '' && item.area_total > 0) {
    return parseFloat(item.area_total);
  }
  const c = parseFloat(item.comprimento) || 0;
  const l = parseFloat(item.largura) || 0;
  const q = parseInt(item.quantidade) || 1;
  return Math.max(c, l) * Math.min(c, l) * q;
}

function attachItemListeners() {
  const container = document.getElementById('items-container');
  container.querySelectorAll('input, select').forEach(el => {
    if (el.dataset.index === undefined) return;
    el.removeEventListener('change', onFieldChange);
    el.removeEventListener('input', onFieldInput);
    el.addEventListener('change', onFieldChange);
    el.addEventListener('input', onFieldInput);
  });
}

function onFieldChange(e) {
  handleFieldEvent(e);
}

function onFieldInput(e) {
  handleFieldEvent(e);
}

function handleFieldEvent(e) {
  const el = e.target;
  const index = parseInt(el.dataset.index);
  const field = el.dataset.field;
  if (isNaN(index) || !field) return;

  let value;
  if (el.type === 'checkbox') {
    value = el.checked;
  } else if (el.type === 'number') {
    value = el.value !== '' ? parseFloat(el.value) : '';
  } else {
    value = el.value;
  }

  STATE.form.items[index][field] = value;

  // Auto-fill linked fields if they haven't been manually changed
  if (field === 'comprimento' || field === 'largura') {
    autoFillLinked(index, field, value);
    updateAreaDisplay(index);
  }

  if (field === 'quantidade') {
    updateAreaDisplay(index);
  }

  // Update radio visual state
  if (el.type === 'radio') {
    const group = el.closest('.radio-group');
    if (group) {
      group.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selecionado'));
      el.closest('.radio-option').classList.add('selecionado');
    }
  }

  // Check conditional sections
  updateConditionals(index);
}

function autoFillLinked(index, changedField, value) {
  const card = document.querySelector(`[data-item-index="${index}"]`);
  if (!card) return;
  card.querySelectorAll(`[data-vinculado-a="${changedField}"]`).forEach(input => {
    const linkField = input.dataset.field;
    // Only auto-fill if the linked field matches the source value or is empty
    const current = STATE.form.items[index][linkField];
    if (!current || current === STATE.form.items[index][changedField]) {
      input.value = value;
      STATE.form.items[index][linkField] = parseFloat(value) || 0;
    }
  });
}

function updateAreaDisplay(index) {
  const item = STATE.form.items[index];
  const area = calcularAreaItem(item);
  // Atualiza o input de área com o valor calculado e salva no state
  const input = document.querySelector(`[data-item-index="${index}"] .quadra-area-input`);
  if (input) {
    input.value = area || '';
    STATE.form.items[index].area_total = area;
  }
}

function updateConditionals(index) {
  const card = document.querySelector(`[data-item-index="${index}"]`);
  if (!card) return;

  card.querySelectorAll('.quadra-secao-condicional').forEach(secEl => {
    const condStr = secEl.dataset.condicional;
    if (!condStr) return;
    try {
      const cond = JSON.parse(condStr);
      const val = STATE.form.items[index][cond.campo];
      secEl.classList.toggle('visivel', val === cond.valor);
    } catch { /* noop */ }
  });
}

function onTipoChange(index, novoTipo) {
  const item = STATE.form.items[index];
  const oldItem = { ...item };
  const novoDefault = defaultItem(index);

  // Manter valores existentes, aplicar só defaults de campos novos
  STATE.form.items[index] = {
    ...novoDefault,
    tipo_quadra: novoTipo,
    _index: index,
    // Preserva campos comuns que o usuário já preencheu
    comprimento: oldItem.comprimento ?? novoDefault.comprimento,
    largura: oldItem.largura ?? novoDefault.largura,
    quantidade: oldItem.quantidade ?? novoDefault.quantidade,
  };

  // Re-render apenas esse card
  const card = document.querySelector(`[data-item-index="${index}"]`);
  if (card) {
    const temp = document.createElement('div');
    temp.innerHTML = renderItemCard(STATE.form.items[index], index);
    card.replaceWith(temp.firstElementChild);
    attachItemListeners();
  }
}

// ============================================================
// Briefing preview
// ============================================================

function buildTags(item) {
  const tags = [];
  if (item.material_pedreira) tags.push(`Material: ${item.material_pedreira}`);
  if (item.tipo_terreno) tags.push(item.tipo_terreno);
  if (item.dificuldade_acesso && item.dificuldade_acesso !== 'Fácil') tags.push(`Acesso ${item.dificuldade_acesso.toLowerCase()}`);
  if (item.tela_superior) tags.push('Tela superior');
  if (item.tela_sombreamento) tags.push('Tela sombreamento');
  return tags;
}

function coletarFormProposal() {
  const f = {};
  CAMPOS_OBRIGATORIOS.forEach(k => { f[k] = document.getElementById(`f-${k}`)?.value.trim() || ''; });
  ['cnpj_cpf', 'email', 'endereco', 'cidade', 'estado', 'numero_proposta', 'data_solicitacao', 'data_envio'].forEach(k => {
    f[k] = document.getElementById(`f-${k}`)?.value.trim() || '';
  });
  return f;
}

function validarForm() {
  const proposal = coletarFormProposal();
  const erros = [];

  CAMPOS_OBRIGATORIOS.forEach(campo => {
    const el = document.getElementById(`f-${campo}`);
    const errEl = document.getElementById(`err-${campo}`);
    const vazio = !proposal[campo];
    if (el) el.classList.toggle('erro', vazio);
    if (errEl) errEl.classList.toggle('visivel', vazio);
    if (vazio) erros.push(campo);
  });

  STATE.form.items.forEach((item, i) => {
    if (!item.comprimento || !item.largura) {
      showToast(`Quadra ${i + 1}: preencha as dimensões`, 'aviso');
      erros.push('dimensoes');
    }
  });

  return erros.length === 0;
}

function abrirBriefing() {
  if (!validarForm()) {
    showToast('Preencha os campos obrigatórios antes de visualizar', 'aviso');
    return;
  }
  STATE.form.proposal = coletarFormProposal();

  const modal = document.getElementById('modal-briefing');
  document.getElementById('modal-briefing-body').innerHTML = renderBriefingContent({
    id: '(novo)',
    status: 'pendente',
    criado_em: new Date().toISOString(),
    proposal: STATE.form.proposal,
    items: STATE.form.items,
  });
  modal.showModal();
}

function renderBriefingContent(p) {
  const pr = p.proposal || {};
  const quadrasHtml = (p.items || []).map((item, i) => {
    const area = calcularAreaItem(item);
    const tipoCfg = STATE.quadraConfig ? getTipoCfg(item.tipo_quadra) : null;
    const label = tipoCfg ? tipoCfg.label : item.tipo_quadra;
    const tags = buildTags(item);

    return `
      <div class="detalhe-secao">
        <div class="detalhe-secao-title">Quadra ${i + 1} — ${label}</div>
        <div class="kv-table">
          <span class="kv-key">Quantidade</span><span class="kv-value">${item.quantidade || 1}</span>
          <span class="kv-key">Dimensões</span><span class="kv-value">${item.comprimento || 0} × ${item.largura || 0} m</span>
          <span class="kv-key">Área total</span><span class="kv-value">${formatArea(area)}</span>
          ${item.dificuldade_acesso ? `<span class="kv-key">Acesso</span><span class="kv-value">${item.dificuldade_acesso}</span>` : ''}
          ${item.tipo_terreno ? `<span class="kv-key">Terreno</span><span class="kv-value">${item.tipo_terreno}</span>` : ''}
          ${item.alambrado_altura ? `<span class="kv-key">Alambrado</span><span class="kv-value">${item.alambrado_altura} m · ${item.galvanizacao || ''} · ${item.tipo_estrutura || ''}</span>` : ''}
          ${item.travamento_tipo ? `<span class="kv-key">Travamento</span><span class="kv-value">${item.travamento_tipo}</span>` : ''}
          ${item.iluminacao_quantidade ? `<span class="kv-key">Iluminação</span><span class="kv-value">${item.iluminacao_quantidade} proj. · ${item.potencia || 0}W · ${item.quantidade_postes || 0} postes ${item.altura_poste || 0}m</span>` : ''}
          ${item.material_pedreira === 'PlayPiso' ? renderMateriaisKV(item) : ''}
        </div>
        ${tags.length ? `<div class="detalhe-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="detalhe-secao">
      <div class="detalhe-secao-title">Dados Comerciais</div>
      <div class="kv-table">
        <span class="kv-key">Proposta</span><span class="kv-value">${p.id}</span>
        <span class="kv-key">Vendedor</span><span class="kv-value">${pr.vendedor || '—'}</span>
        <span class="kv-key">Data</span><span class="kv-value">${formatDate(pr.data_solicitacao)}</span>
        ${pr.data_envio ? `<span class="kv-key">Validade</span><span class="kv-value">${formatDate(pr.data_envio)}</span>` : ''}
      </div>
    </div>
    <div class="detalhe-secao">
      <div class="detalhe-secao-title">Cliente</div>
      <div class="kv-table">
        <span class="kv-key">Nome</span><span class="kv-value">${pr.nome_cliente || '—'}</span>
        ${pr.cnpj_cpf ? `<span class="kv-key">CNPJ/CPF</span><span class="kv-value">${pr.cnpj_cpf}</span>` : ''}
        <span class="kv-key">Contato</span><span class="kv-value">${pr.contato || '—'}</span>
        <span class="kv-key">Telefone</span><span class="kv-value">${pr.telefone || '—'}</span>
        ${pr.email ? `<span class="kv-key">E-mail</span><span class="kv-value">${pr.email}</span>` : ''}
        ${pr.endereco ? `<span class="kv-key">Endereço</span><span class="kv-value">${pr.endereco}</span>` : ''}
        <span class="kv-key">Local da obra</span><span class="kv-value">${pr.local_obra || '—'}${pr.cidade ? ' · ' + pr.cidade + (pr.estado ? '-' + pr.estado : '') : ''}</span>
      </div>
    </div>
    ${quadrasHtml}
  `;
}

function renderMateriaisKV(item) {
  const campos = [
    ['Blocos', item.qtd_blocos, 'unid'],
    ['Areia média', item.qtd_areia_media, 'm³'],
    ['Brita 1', item.qtd_brita_1, 'm³'],
    ['Pó de pedra', item.qtd_po_de_pedra, 'm³'],
    ['Cimento', item.qtd_cimento, 'sc'],
    ['Lona', item.qtd_lona_plastica, 'm²'],
    ['Pedrisco', item.qtd_pedrisco_limpo, 'm³'],
  ].filter(([, v]) => v);
  if (!campos.length) return '';
  return campos.map(([k, v, u]) =>
    `<span class="kv-key">${k}</span><span class="kv-value">${v} ${u}</span>`
  ).join('');
}

// ============================================================
// Salvar proposta
// ============================================================

async function salvarProposta() {
  if (!validarForm()) {
    showToast('Preencha os campos obrigatórios', 'aviso');
    return;
  }

  STATE.form.proposal = coletarFormProposal();

  setLoading(true);
  try {
    const nova = await api('/api/propostas', {
      method: 'POST',
      body: {
        proposal: STATE.form.proposal,
        items: STATE.form.items,
      },
    });

    showToast('Proposta salva com sucesso!', 'sucesso');
    document.getElementById('modal-briefing').close();
    resetForm();
    STATE.propostas.unshift(nova);
    atualizarBadge();
    switchView('orcamentos');
    await selecionarProposta(nova.id);
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'erro');
  } finally {
    setLoading(false);
  }
}

async function confirmarSalvar() {
  await salvarProposta();
}

function resetForm() {
  STATE.form = { proposal: {}, items: [] };
  CAMPOS_OBRIGATORIOS.concat(['cnpj_cpf', 'email', 'endereco', 'cidade', 'estado', 'data_solicitacao', 'data_envio']).forEach(k => {
    const el = document.getElementById(`f-${k}`);
    if (el) { el.value = ''; el.classList.remove('erro'); }
  });
  // Vendedor sempre vem do usuário logado
  const vEl = document.getElementById('f-vendedor');
  if (vEl && AUTH.user) vEl.value = AUTH.user.nome;
  addItem();
}

// ============================================================
// Init
// ============================================================

async function iniciarApp() {
  atualizarAvatar();

  // Carregar config
  try {
    STATE.quadraConfig = await fetch('/quadra-config.json').then(r => r.json());
  } catch {
    showToast('Erro ao carregar configuração de quadras', 'erro');
    return;
  }

  // Preencher vendedor com nome do usuário logado
  const vEl = document.getElementById('f-vendedor');
  if (vEl && AUTH.user) vEl.value = AUTH.user.nome;

  // Datas padrão
  const hoje_ = hoje();
  const daqui30 = new Date(); daqui30.setDate(daqui30.getDate() + 30);
  const el_sol = document.getElementById('f-data_solicitacao');
  const el_env = document.getElementById('f-data_envio');
  if (el_sol) el_sol.value = hoje_;
  if (el_env) el_env.value = daqui30.toISOString().slice(0, 10);

  // Iniciar com 1 item
  addItem();

  // Carregar propostas em background
  carregarPropostas();

  // Offline detection
  window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('visivel'));
  window.addEventListener('online', () => document.getElementById('offline-banner').classList.remove('visivel'));
}

function init() {
  if (!AUTH.token || !AUTH.user) {
    mostrarLogin();
    return;
  }
  esconderLogin();
  iniciarApp();
}

// ============================================================
// Exportar API pública para onclick handlers no HTML
// ============================================================

window.app = {
  switchView,
  addItem,
  removeItem,
  onTipoChange,
  abrirBriefing,
  salvarProposta,
  confirmarSalvar,
  selecionarProposta,
  setFiltro,
  mudarStatus,
  deletarProposta,
  gerarProposta,
  abrirHistoricoDetalhe,
  filtrarHistorico,
  // Auth
  fazerLogin,
  fazerCadastro,
  mostrarLogin,
  mostrarCadastro,
  toggleAvatarMenu,
  logout,
};

document.getElementById('form-login').addEventListener('submit', fazerLogin);
document.getElementById('form-cadastro').addEventListener('submit', fazerCadastro);

window.addEventListener('error', (e) => {
  const erroEl = document.getElementById('login-erro');
  const loginView = document.getElementById('view-login');
  if (erroEl && loginView && !loginView.hidden) {
    erroEl.textContent = 'Erro JS: ' + e.message;
    erroEl.hidden = false;
  }
});

init();
