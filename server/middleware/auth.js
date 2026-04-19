const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'playpiso-secret-dev-2026';

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Não autenticado' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = { verifyToken, JWT_SECRET };
