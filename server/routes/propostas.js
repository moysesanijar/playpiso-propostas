const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

const router = Router();

// Converte uma linha do banco para o formato esperado pela API/frontend
function rowToObj(row) {
  return {
    id: row.id,
    numero_seq: row.numero_seq,
    status: row.status,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    ppt_path: row.ppt_path || null,
    ppt_gerado_em: row.ppt_gerado_em || null,
    criado_por: {
      id: row.criado_por_id,
      nome: row.criado_por_nome,
      email: row.criado_por_email,
    },
    proposal: row.proposal_json,
    items: row.items_json,
  };
}

// Todas as rotas requerem autenticação
router.use(verifyToken);

// GET /api/propostas
// Query: ?status=pendente&q=nome
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM propostas WHERE 1=1';
    const params = [];

    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND status = $${params.length}`;
    }

    if (req.query.q) {
      params.push(`%${req.query.q.toLowerCase()}%`);
      sql += ` AND (LOWER(proposal_json->>'nome_cliente') LIKE $${params.length} OR LOWER(id) LIKE $${params.length})`;
    }

    // Pendentes primeiro, depois por data mais recente
    sql += ` ORDER BY CASE WHEN status = 'pendente' THEN 0 ELSE 1 END ASC, criado_em DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows.map(rowToObj));
  } catch (err) {
    console.error('[propostas GET /]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/propostas/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM propostas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposta não encontrada' });
    res.json(rowToObj(result.rows[0]));
  } catch (err) {
    console.error('[propostas GET /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/propostas — cria nova proposta
router.post('/', async (req, res) => {
  try {
    // Incrementa o contador atomicamente
    const counterResult = await db.query(
      `UPDATE config SET valor = (valor::int + 1)::text WHERE chave = 'ultimo_numero' RETURNING valor`
    );
    const ultimoNumero = parseInt(counterResult.rows[0].valor, 10);

    const ano = new Date().getFullYear();
    const seq = String(ultimoNumero).padStart(3, '0');
    const id = `PS-${ano}-${seq}`;

    const { proposal, items } = req.body;

    // Vendedor sempre vem do usuário autenticado — nunca do frontend
    const vendedor = req.user.nome;
    const now = new Date().toISOString();

    const proposalFinal = {
      ...proposal,
      numero_proposta: id,
      vendedor,
    };

    await db.query(
      `INSERT INTO propostas
        (id, numero_seq, status, criado_em, atualizado_em, ppt_path, ppt_gerado_em,
         criado_por_id, criado_por_nome, criado_por_email, proposal_json, items_json)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, $9, $10)`,
      [
        id, ultimoNumero, 'pendente', now, now,
        req.user.id, req.user.nome, req.user.email,
        JSON.stringify(proposalFinal),
        JSON.stringify(items || []),
      ]
    );

    const newRow = await db.query('SELECT * FROM propostas WHERE id = $1', [id]);
    res.status(201).json(rowToObj(newRow.rows[0]));
  } catch (err) {
    console.error('[propostas POST /]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/propostas/:id — atualiza status e/ou ppt_path
router.patch('/:id', async (req, res) => {
  try {
    const sets = [];
    const params = [];

    if (req.body.status !== undefined) {
      params.push(req.body.status);
      sets.push(`status = $${params.length}`);
    }

    if (req.body.ppt_path !== undefined) {
      params.push(req.body.ppt_path);
      sets.push(`ppt_path = $${params.length}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }

    params.push(new Date().toISOString());
    sets.push(`atualizado_em = $${params.length}`);

    params.push(req.params.id);
    const sql = `UPDATE propostas SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;

    const result = await db.query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposta não encontrada' });
    res.json(rowToObj(result.rows[0]));
  } catch (err) {
    console.error('[propostas PATCH /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/propostas/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM propostas WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Proposta não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[propostas DELETE /:id]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
