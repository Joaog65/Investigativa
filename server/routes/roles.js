import express from 'express';

import { db, logAudit } from '../db.js';
import { sanitizeId } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', (_, response) => {
  const active = db
    .prepare('SELECT * FROM roles WHERE archived_at IS NULL ORDER BY level ASC, name ASC')
    .all();
  const archived = db
    .prepare('SELECT * FROM roles WHERE archived_at IS NOT NULL ORDER BY name ASC')
    .all();

  const usage = db
    .prepare('SELECT role_id, COUNT(*) AS count FROM family_memberships WHERE left_on IS NULL GROUP BY role_id')
    .all();
  const usageMap = new Map(usage.map((row) => [row.role_id, row.count]));

  return response.json({
    active: active.map((role) => ({ ...role, active_usage: usageMap.get(role.id) || 0 })),
    archived,
  });
});

router.post('/', (request, response) => {
  const name = String(request.body?.name || '').trim();
  if (!name) return response.status(400).json({ message: 'O nome do cargo é obrigatório.' });

  const duplicate = db.prepare('SELECT id FROM roles WHERE lower(name) = lower(?) AND archived_at IS NULL').get(name);
  if (duplicate) return response.status(409).json({ message: 'Já existe um cargo com esse nome.' });

  const maxLevel = db.prepare('SELECT COALESCE(MAX(level), 0) AS max FROM roles WHERE archived_at IS NULL').get();
  const description = String(request.body?.description || '').trim() || null;

  const result = db
    .prepare('INSERT INTO roles (name, level, description) VALUES (?, ?, ?)')
    .run(name, maxLevel.max + 1, description);

  logAudit(request.user.id, 'create', 'role', result.lastInsertRowid, name);
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (request, response) => {
  const roleId = sanitizeId(request.params.id);
  if (!roleId) return response.status(400).json({ message: 'Identificador inválido.' });

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!role) return response.status(404).json({ message: 'Cargo não encontrado.' });

  const name = String(request.body?.name ?? role.name).trim() || role.name;
  const description = request.body?.description !== undefined
    ? String(request.body.description).trim() || null
    : role.description;

  const duplicate = db
    .prepare('SELECT id FROM roles WHERE lower(name) = lower(?) AND id != ? AND archived_at IS NULL')
    .get(name, roleId);
  if (duplicate) return response.status(409).json({ message: 'Já existe um cargo com esse nome.' });

  db.prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?').run(name, description, roleId);
  logAudit(request.user.id, 'update', 'role', roleId, name);

  return response.json({ ok: true });
});

router.post('/reorder', (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(sanitizeId).filter(Boolean) : [];
  if (!ids.length) return response.status(400).json({ message: 'Ordem de cargos inválida.' });

  const update = db.prepare('UPDATE roles SET level = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    ids.forEach((roleId, index) => update.run(index + 1, roleId));
  });
  reorder();

  logAudit(request.user.id, 'update', 'role', null, 'Hierarquia de cargos', 'Ordem dos cargos alterada.');
  return response.json({ ok: true });
});

router.post('/:id/archive', (request, response) => {
  const roleId = sanitizeId(request.params.id);
  if (!roleId) return response.status(400).json({ message: 'Identificador inválido.' });

  const role = db.prepare('SELECT * FROM roles WHERE id = ? AND archived_at IS NULL').get(roleId);
  if (!role) return response.status(404).json({ message: 'Cargo não encontrado ou já arquivado.' });

  const inUse = db
    .prepare('SELECT COUNT(*) AS total FROM family_memberships WHERE role_id = ? AND left_on IS NULL')
    .get(roleId);

  if (inUse.total) {
    return response.status(400).json({
      message: `Este cargo está em uso por ${inUse.total} vínculo(s) ativo(s). Redistribua antes de arquivar.`,
    });
  }

  db.prepare("UPDATE roles SET archived_at = datetime('now') WHERE id = ?").run(roleId);
  logAudit(request.user.id, 'archive', 'role', roleId, role.name);

  return response.json({ ok: true });
});

router.post('/:id/restore', (request, response) => {
  const roleId = sanitizeId(request.params.id);
  if (!roleId) return response.status(400).json({ message: 'Identificador inválido.' });

  const role = db.prepare('SELECT * FROM roles WHERE id = ? AND archived_at IS NOT NULL').get(roleId);
  if (!role) return response.status(404).json({ message: 'Cargo não encontrado no arquivo.' });

  const maxLevel = db.prepare('SELECT COALESCE(MAX(level), 0) AS max FROM roles WHERE archived_at IS NULL').get();
  db.prepare('UPDATE roles SET archived_at = NULL, level = ? WHERE id = ?').run(maxLevel.max + 1, roleId);
  logAudit(request.user.id, 'restore', 'role', roleId, role.name);

  return response.json({ ok: true });
});

export default router;
