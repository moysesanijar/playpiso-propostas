const { Router } = require('express');
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../data/orcamentos.json');

function readDb() {
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

const router = Router();

// Todas as rotas requerem autenticação
router.use(verifyToken);

// GET /api/propostas
// Query: ?status=pendente&q=nome
router.get('/', (req, res) => {
  try {
    const db = readDb();
    let lista = [...db.propostas];

    if (req.query.status) {
      lista = lista.filter(p => p.status === req.query.status);
    }

    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      lista = lista.filter(p =>
        (p.proposal?.nome_cliente || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }

    // Pendentes primeiro, depois por data mais recente
    lista.sort((a, b) => {
      if (a.status === 'pendente' && b.status !== 'pendente') return -1;
      if (a.status !== 'pendente' && b.status === 'pendente') return 1;
      return new Date(b.criado_em) - new Date(a.criado_em);
    });

    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/propostas/:id
router.get('/:id', (req, res) => {
  try {
    const db = readDb();
    const proposta = db.propostas.find(p => p.id === req.params.id);
    if (!proposta) return res.status(404).json({ error: 'Proposta não encontrada' });
    res.json(proposta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/propostas — cria nova proposta
router.post('/', (req, res) => {
  try {
    const db = readDb();
    db.ultimo_numero += 1;

    const ano = new Date().getFullYear();
    const seq = String(db.ultimo_numero).padStart(3, '0');
    const id = `PS-${ano}-${seq}`;

    const { proposal, items } = req.body;

    // Vendedor sempre vem do usuário autenticado — nunca do frontend
    const vendedor = req.user.nome;

    const nova = {
      id,
      numero_seq: db.ultimo_numero,
      status: 'pendente',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      ppt_path: null,
      criado_por: {
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
      },
      proposal: {
        ...proposal,
        numero_proposta: id,
        vendedor,
      },
      items: items || [],
    };

    db.propostas.unshift(nova);
    writeDb(db);

    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/propostas/:id — atualiza status e/ou ppt_path
router.patch('/:id', (req, res) => {
  try {
    const db = readDb();
    const idx = db.propostas.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Proposta não encontrada' });

    const allowed = ['status', 'ppt_path'];
    allowed.forEach(key => {
      if (req.body[key] !== undefined) {
        db.propostas[idx][key] = req.body[key];
      }
    });
    db.propostas[idx].atualizado_em = new Date().toISOString();

    writeDb(db);
    res.json(db.propostas[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
