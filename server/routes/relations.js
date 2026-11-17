import express from 'express';

import { db, logAudit, normalizeSearchTerm } from '../db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

const RELATION_LIST_SQL = `
  SELECT r.*,
    fa.name AS family_a_name, fa.logo_path AS family_a_logo,
    fb.name AS family_b_name, fb.logo_path AS family_b_logo,
    (SELECT COUNT(*) FROM attachments a WHERE a.entity_type = 'relation' AND a.entity_id = r.id) AS evidence_count
  FROM relations r
  JOIN families fa ON fa.id = r.family_a_id
  JOIN families fb ON fb.id = r.family_b_id
`;

const RELATION_TYPES = ['alianca', 'rivalidade', 'neutralidade'];

router.get('/', (request, response) => {
  const { type = '', status = 'vigente', search = '' } = request.query;
  const conditions = ['r.archived_at IS NULL'];
  const params = [];

  if (type && RELATION_TYPES.includes(String(type))) {
    conditions.push('r.type = ?');
    params.push(String(type));
  }

  if (status === 'vigente') conditions.push('r.is_active = 1');
  else if (status === 'encerrada') conditions.push('r.is_active = 0');

  if (search) {
    conditions.push(`(
      unaccent(lower(fa.name)) LIKE ? OR unaccent(lower(fb.name)) LIKE ? OR
      unaccent(lower(COALESCE(r.description, ''))) LIKE ? OR unaccent(lower(COALESCE(r.exceptions, ''))) LIKE ?
    )`);
    const term = normalizeSearchTerm(search);
    params.push(term, term, term, term);
  }

  const relations = db
    .prepare(`${RELATION_LIST_SQL} WHERE ${conditions.join(' AND ')} ORDER BY r.is_active DESC, r.created_at DESC`)
    .all(...params);

  return response.json(relations);
});

router.get('/:id', (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db.prepare(`${RELATION_LIST_SQL} WHERE r.id = ?`).get(relationId);
  if (!relation) return response.status(404).json({ message: 'Relação não encontrada.' });

  const attachments = db
    .prepare('SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC')
    .all('relation', relationId);

  const audit = db
    .prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 30')
    .all('relation', relationId);

  return response.json({ ...relation, attachments, audit });
});

function validateRelationPayload(body, { relationId = null } = {}) {
  const familyAId = sanitizeId(body?.family_a_id);
  const familyBId = sanitizeId(body?.family_b_id);
  const type = String(body?.type || '');

  if (!familyAId || !familyBId) {
    return { error: 'Selecione as duas famílias da relação.' };
  }
  if (familyAId === familyBId) {
    return { error: 'Uma família não pode ter relação com ela mesma.' };
  }
  if (!RELATION_TYPES.includes(type)) {
    return { error: 'Tipo de relação inválido.' };
  }

  // RN-05: no máximo uma relação vigente por par (qualquer direção)
  const duplicate = db
    .prepare(`
      SELECT r.id, fa.name AS name_a, fb.name AS name_b
      FROM relations r
      JOIN families fa ON fa.id = r.family_a_id
      JOIN families fb ON fb.id = r.family_b_id
      WHERE r.archived_at IS NULL AND r.is_active = 1
        AND ((r.family_a_id = ? AND r.family_b_id = ?) OR (r.family_a_id = ? AND r.family_b_id = ?))
        AND r.id != COALESCE(?, 0)
    `)
    .get(familyAId, familyBId, familyBId, familyAId, relationId ?? null);

  if (duplicate) {
    return { error: `Já existe uma relação vigente entre ${duplicate.name_a} e ${duplicate.name_b} (#${duplicate.id}).` };
  }

  return { familyAId, familyBId, type };
}

router.post('/', (request, response) => {
  const validated = validateRelationPayload(request.body);
  if (validated.error) return response.status(400).json({ message: validated.error });

  const startedOn = String(request.body?.started_on || '').trim() || null;
  const description = String(request.body?.description || '').trim() || null;
  const exceptions = String(request.body?.exceptions || '').trim() || null;

  const result = db
    .prepare(`
      INSERT INTO relations (family_a_id, family_b_id, type, started_on, description, exceptions, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(validated.familyAId, validated.familyBId, validated.type, startedOn, description, exceptions, request.user.id);

  const familyA = db.prepare('SELECT name FROM families WHERE id = ?').get(validated.familyAId);
  const familyB = db.prepare('SELECT name FROM families WHERE id = ?').get(validated.familyBId);

  logAudit(
    request.user.id,
    'create',
    'relation',
    result.lastInsertRowid,
    `${familyA.name} × ${familyB.name}`,
    `Tipo: ${validated.type}`
  );

  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId);
  if (!relation) return response.status(404).json({ message: 'Relação não encontrada.' });

  const validated = validateRelationPayload(request.body, { relationId });
  if (validated.error) return response.status(400).json({ message: validated.error });

  const startedOn = request.body?.started_on !== undefined
    ? String(request.body.started_on).trim() || null
    : relation.started_on;
  const description = request.body?.description !== undefined
    ? String(request.body.description).trim() || null
    : relation.description;
  const exceptions = request.body?.exceptions !== undefined
    ? String(request.body.exceptions).trim() || null
    : relation.exceptions;

  db.prepare(`
    UPDATE relations SET family_a_id = ?, family_b_id = ?, type = ?, started_on = ?,
                         description = ?, exceptions = ? WHERE id = ?
  `).run(validated.familyAId, validated.familyBId, validated.type, startedOn, description, exceptions, relationId);

  const familyA = db.prepare('SELECT name FROM families WHERE id = ?').get(validated.familyAId);
  const familyB = db.prepare('SELECT name FROM families WHERE id = ?').get(validated.familyBId);

  logAudit(
    request.user.id,
    'update',
    'relation',
    relationId,
    `${familyA.name} × ${familyB.name}`
  );

  return response.json({ ok: true });
});

router.post('/:id/end', (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db
    .prepare(`${RELATION_LIST_SQL} WHERE r.id = ? AND r.is_active = 1 AND r.archived_at IS NULL`)
    .get(relationId);

  if (!relation) return response.status(404).json({ message: 'Relação vigente não encontrada.' });

  db.prepare('UPDATE relations SET is_active = 0 WHERE id = ?').run(relationId);

  const note = String(request.body?.notes || '').trim();
  logAudit(
    request.user.id,
    'update',
    'relation',
    relationId,
    `${relation.family_a_name} × ${relation.family_b_name}`,
    `Relação encerrada.${note ? ` ${note}` : ''}`
  );

  return response.json({ ok: true });
});

router.post('/:id/attachments', upload.array('files', 10), (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db.prepare('SELECT * FROM relations WHERE id = ?').get(relationId);
  if (!relation) return response.status(404).json({ message: 'Relação não encontrada.' });

  if (!request.files?.length) {
    return response.status(400).json({ message: 'Nenhuma imagem enviada.' });
  }

  const insert = db.prepare(
    'INSERT INTO attachments (entity_type, entity_id, file_path, caption, created_by) VALUES (?, ?, ?, ?, ?)'
  );
  const captions = parseListSafe(request.body?.captions);

  const created = request.files.map((file, index) => {
    const url = `/uploads/${file.filename}`;
    insert.run('relation', relationId, url, captions[index] || null, request.user.id);
    return { url };
  });

  logAudit(request.user.id, 'update', 'relation', relationId, `relação #${relationId}`, 'Evidências adicionadas.');
  return response.status(201).json({ attachments: created });
}, uploadErrorHandler);

router.delete('/attachments/:attachmentId', (request, response) => {
  const attachmentId = sanitizeId(request.params.attachmentId);
  if (!attachmentId) return response.status(400).json({ message: 'Identificador inválido.' });

  const attachment = db
    .prepare("SELECT * FROM attachments WHERE id = ? AND entity_type = 'relation'")
    .get(attachmentId);
  if (!attachment) return response.status(404).json({ message: 'Evidência não encontrada.' });

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  removeUploadFile(attachment.file_path);

  logAudit(request.user.id, 'update', 'relation', attachment.entity_id, `relação #${attachment.entity_id}`, 'Evidência removida.');
  return response.json({ ok: true });
});

router.post('/:id/archive', (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db.prepare(`${RELATION_LIST_SQL} WHERE r.id = ? AND r.archived_at IS NULL`).get(relationId);
  if (!relation) return response.status(404).json({ message: 'Relação não encontrada.' });

  db.prepare("UPDATE relations SET archived_at = datetime('now'), is_active = 0 WHERE id = ?").run(relationId);

  logAudit(
    request.user.id,
    'archive',
    'relation',
    relationId,
    `${relation.family_a_name} × ${relation.family_b_name}`
  );
  return response.json({ ok: true });
});

router.post('/:id/restore', (request, response) => {
  const relationId = sanitizeId(request.params.id);
  if (!relationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const relation = db.prepare(`${RELATION_LIST_SQL} WHERE r.id = ? AND r.archived_at IS NOT NULL`).get(relationId);
  if (!relation) return response.status(404).json({ message: 'Relação não encontrada no arquivo.' });

  db.prepare('UPDATE relations SET archived_at = NULL WHERE id = ?').run(relationId);
  logAudit(
    request.user.id,
    'restore',
    'relation',
    relationId,
    `${relation.family_a_name} × ${relation.family_b_name}`
  );

  return response.json({ ok: true });
});

function parseListSafe(value) {
  try {
    if (Array.isArray(value)) return value.map((item) => String(item).trim());
    if (typeof value === 'string' && value.trim()) return JSON.parse(value).map((item) => String(item).trim());
  } catch {
    // ignora
  }
  return [];
}

export default router;
