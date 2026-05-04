const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const db = require('../db');

function gerarId(count) {
  const num = String(count + 1).padStart(3, '0');
  return `usr-${num}`;
}

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ ok: false, error: 'Nome, email e senha são obrigatórios' });
    }

    if (!email.toLowerCase().endsWith('@playpiso.com.br')) {
      return res.status(400).json({ ok: false, error: 'Apenas emails @playpiso.com.br são permitidos' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ ok: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const emailNorm = email.toLowerCase().trim();

    const existing = await db.query('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'Email já cadastrado' });
    }

    const countResult = await db.query('SELECT COUNT(*) AS total FROM usuarios');
    const count = parseInt(countResult.rows[0].total, 10);
    const id = gerarId(count);

    const senha_hash = await bcrypt.hash(senha, 10);
    const criado_em = new Date().toISOString();

    await db.query(
      'INSERT INTO usuarios (id, nome, email, senha_hash, criado_em) VALUES ($1, $2, $3, $4, $5)',
      [id, nome.trim(), emailNorm, senha_hash, criado_em]
    );

    const user = { id, nome: nome.trim(), email: emailNorm };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ ok: true, token, user });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ ok: false, error: 'Email e senha são obrigatórios' });
    }

    const result = await db.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ ok: false, error: 'Email ou senha incorretos' });
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ ok: false, error: 'Email ou senha incorretos' });
    }

    const user = { id: usuario.id, nome: usuario.nome, email: usuario.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({ ok: true, token, user });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
