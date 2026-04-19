const { Router } = require('express');
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../data/usuarios.json');

function readDb() {
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function gerarId(usuarios) {
  const num = String(usuarios.length + 1).padStart(3, '0');
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

    const db = readDb();
    const existe = db.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existe) {
      return res.status(409).json({ ok: false, error: 'Email já cadastrado' });
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const novoUsuario = {
      id: gerarId(db.usuarios),
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      senha_hash,
      criado_em: new Date().toISOString(),
    };

    db.usuarios.push(novoUsuario);
    writeDb(db);

    const user = { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ ok: true, token, user });
  } catch (err) {
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

    const db = readDb();
    const usuario = db.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

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
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
