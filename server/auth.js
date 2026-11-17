import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { db, logAudit } from './db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler } from './helpers.js';

export const SESSION_COOKIE = 'inv_session';
const JWT_SECRET = process.env.SESSION_SECRET || 'investigativa-dev-secret';
const TOKEN_TTL = '7d';

export function signSession(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAuth(request, response, next) {
  const token = request.cookies?.[SESSION_COOKIE];

  if (!token) {
    return response.status(401).json({ message: 'Autenticação necessária.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare('SELECT id, username, display_name, nickname, avatar_path, role, is_active FROM users WHERE id = ?')
      .get(payload.sub);

    if (!user || !user.is_active) {
      return response.status(401).json({ message: 'Sessão inválida.' });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
  }
}

export function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ message: 'Ação restrita ao administrador.' });
  }
  return next();
}

const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(key) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() - record.start > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function registerAttempt(key) {
  const record = loginAttempts.get(key) || { start: Date.now(), count: 0 };
  record.count += 1;
  loginAttempts.set(key, record);
}

export const authRouter = express.Router();

authRouter.post('/login', (request, response) => {
  const username = String(request.body?.username || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  const ipKey = `${request.ip}:${username}`;

  if (isRateLimited(ipKey)) {
    return response.status(429).json({ message: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  if (!username || !password) {
    return response.status(400).json({ message: 'Informe usuário e senha.' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE lower(username) = ? AND is_active = 1')
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    registerAttempt(ipKey);
    return response.status(401).json({ message: 'Usuário ou senha inválidos.' });
  }

  loginAttempts.delete(ipKey);
  logAudit(user.id, 'login', 'user', user.id, user.username);

  const token = signSession(user.id);
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return response.json({
    user: { id: user.id, username: user.username, display_name: user.display_name, nickname: user.nickname, avatar_path: user.avatar_path, role: user.role },
  });
});

authRouter.post('/logout', (request, response) => {
  response.clearCookie(SESSION_COOKIE);
  return response.json({ ok: true });
});

authRouter.get('/me', requireAuth, (request, response) => {
  const user = db
    .prepare('SELECT id, username, display_name, nickname, avatar_path, role, is_active, created_at FROM users WHERE id = ?')
    .get(request.user.id);
  return response.json({ user });
});

// ===== Perfil próprio (qualquer usuário autenticado) =====
const profileRouter = express.Router();
profileRouter.use(requireAuth);

profileRouter.put('/', (request, response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
  if (!user) return response.status(404).json({ message: 'Usuário não encontrado.' });

  const displayName = request.body?.display_name !== undefined
    ? String(request.body.display_name).trim()
    : user.display_name;
  const nickname = request.body?.nickname !== undefined
    ? String(request.body.nickname).trim() || null
    : user.nickname;

  if (!displayName) {
    return response.status(400).json({ message: 'O nome de exibição é obrigatório.' });
  }

  db.prepare('UPDATE users SET display_name = ?, nickname = ? WHERE id = ?').run(
    displayName,
    nickname,
    user.id
  );

  logAudit(user.id, 'update', 'user', user.id, user.username, 'Perfil atualizado.');
  return response.json({ ok: true });
});

profileRouter.post('/avatar', upload.single('avatar'), (request, response) => {
  if (!request.file) {
    return response.status(400).json({ message: 'Selecione uma imagem para enviar.' });
  }

  const user = db.prepare('SELECT avatar_path FROM users WHERE id = ?').get(request.user.id);
  const url = `/uploads/${request.file.filename}`;
  db.prepare('UPDATE users SET avatar_path = ? WHERE id = ?').run(url, request.user.id);

  if (user?.avatar_path) removeUploadFile(user.avatar_path);

  logAudit(request.user.id, 'update', 'user', request.user.id, request.user.username, 'Foto de perfil atualizada.');
  return response.json({ url });
}, uploadErrorHandler);

profileRouter.put('/password', (request, response) => {
  const password = String(request.body?.password || '');
  const currentPassword = String(request.body?.current_password || '');

  if (password.length < 6) {
    return response.status(400).json({ message: 'A nova senha deve ter ao menos 6 caracteres.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return response.status(400).json({ message: 'Senha atual incorreta.' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(password, 10),
    user.id
  );

  logAudit(user.id, 'update', 'user', user.id, user.username, 'Alteração de senha própria.');
  return response.json({ ok: true });
});

export { usersRouter, profileRouter };

// ===== Gestão de usuários (admin) =====
const usersRouter = express.Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get('/', (_, response) => {
  const users = db
    .prepare('SELECT id, username, display_name, nickname, avatar_path, role, is_active, created_at FROM users ORDER BY id')
    .all();
  return response.json(users);
});

usersRouter.post('/', (request, response) => {
  const username = String(request.body?.username || '').trim().toLowerCase();
  const displayName = String(request.body?.display_name || '').trim();
  const password = String(request.body?.password || '');
  const role = request.body?.role === 'admin' ? 'admin' : 'user';

  if (!username || !displayName || !password) {
    return response.status(400).json({ message: 'Usuário, nome de exibição e senha são obrigatórios.' });
  }
  if (password.length < 6) {
    return response.status(400).json({ message: 'A senha deve ter ao menos 6 caracteres.' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(username);
  if (exists) {
    return response.status(409).json({ message: 'Já existe um usuário com esse nome.' });
  }

  const result = db
    .prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), displayName, role);

  logAudit(request.user.id, 'create', 'user', result.lastInsertRowid, username);
  return response.status(201).json({ id: result.lastInsertRowid });
});

usersRouter.put('/:id', (request, response) => {
  const userId = sanitizeId(request.params.id);
  if (!userId) return response.status(400).json({ message: 'Identificador inválido.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return response.status(404).json({ message: 'Usuário não encontrado.' });

  const displayName = request.body?.display_name !== undefined
    ? String(request.body.display_name).trim()
    : user.display_name;
  const isActive = request.body?.is_active !== undefined
    ? (request.body.is_active ? 1 : 0)
    : user.is_active;
  const role = request.body?.role !== undefined
    ? (request.body.role === 'admin' ? 'admin' : 'user')
    : user.role;

  if (userId === request.user.id && (!isActive || role !== 'admin')) {
    return response.status(400).json({ message: 'Você não pode remover seu próprio acesso de administrador.' });
  }

  db.prepare('UPDATE users SET display_name = ?, is_active = ?, role = ? WHERE id = ?').run(
    displayName,
    isActive,
    role,
    userId
  );

  logAudit(request.user.id, 'update', 'user', userId, user.username);
  return response.json({ ok: true });
});

usersRouter.put('/:id/password', (request, response) => {
  const userId = sanitizeId(request.params.id);
  const password = String(request.body?.password || '');

  if (!userId || password.length < 6) {
    return response.status(400).json({ message: 'Senha inválida (mínimo de 6 caracteres).' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return response.status(404).json({ message: 'Usuário não encontrado.' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(password, 10),
    userId
  );

  logAudit(request.user.id, 'update', 'user', userId, user.username, 'Redefinição de senha.');
  return response.json({ ok: true });
});
