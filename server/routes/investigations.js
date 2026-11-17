import express from 'express';

import { db, logAudit, normalizeSearchTerm } from '../db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

const STATUS_VALUES = ['aberta', 'em_andamento', 'encerrada'];

const LIST_SQL = `
  SELECT i.*,
    f.name AS family_name, f.logo_path AS family_logo,
    u.display_name AS created_by_name,
    (SELECT COUNT(*) FROM investigation_members im WHERE im.investigation_id = i.id) AS member_count,
    (SELECT COUNT(*) FROM investigation_notes n WHERE n.investigation_id = i.id) AS note_count,
    (SELECT COUNT(*) FROM attachments a WHERE a.entity_type = 'investigation' AND a.entity_id = i.id) AS evidence_count
  FROM investigations i
  LEFT JOIN families f ON f.id = i.family_id
  LEFT JOIN users u ON u.id = i.created_by
`;

router.get('/', (request, response) => {
  const { status = '', family = '', search = '' } = request.query;
  const conditions = [];
  const params = [];

  if (status && STATUS_VALUES.includes(String(status))) {
    conditions.push('i.status = ?');
    params.push(String(status));
  }

  if (family) {
    conditions.push('i.family_id = ?');
    params.push(Number(family));
  }

  if (search) {
    conditions.push("(unaccent(lower(i.title)) LIKE ? OR unaccent(lower(COALESCE(i.description, ''))) LIKE ?)");
    const term = normalizeSearchTerm(search);
    params.push(term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = {
    recent: 'i.updated_at DESC',
    created: 'i.created_at DESC',
    status: "CASE i.status WHEN 'aberta' THEN 1 WHEN 'em_andamento' THEN 2 ELSE 3 END, i.updated_at DESC",
    title: 'i.title ASC',
  }[request.query.sort] || "CASE i.status WHEN 'aberta' THEN 1 WHEN 'em_andamento' THEN 2 ELSE 3 END, i.updated_at DESC";

  const investigations = db.prepare(`${LIST_SQL} ${where} ORDER BY ${order}`).all(...params);
  return response.json(investigations);
});

router.get('/:id', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare(`${LIST_SQL} WHERE i.id = ?`).get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada.' });

  const involved = db
    .prepare(`
      SELECT im.id AS link_id, im.involvement,
        mem.id AS member_id, mem.nickname, mem.full_name, mem.photo_path, mem.archived_at,
        cf.name AS current_family_name
      FROM investigation_members im
      JOIN members mem ON mem.id = im.member_id
      LEFT JOIN family_memberships cm ON cm.member_id = mem.id AND cm.left_on IS NULL
      LEFT JOIN families cf ON cf.id = cm.family_id
      WHERE im.investigation_id = ?
      ORDER BY lower(mem.nickname)
    `)
    .all(investigationId);

  const notes = db
    .prepare(`
      SELECT n.*, u.display_name AS user_name
      FROM investigation_notes n LEFT JOIN users u ON u.id = n.created_by
      WHERE n.investigation_id = ?
      ORDER BY n.created_at DESC, n.id DESC
    `)
    .all(investigationId);

  const attachments = db
    .prepare('SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC')
    .all('investigation', investigationId);

  const audit = db
    .prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 30')
    .all('investigation', investigationId);

  return response.json({ ...investigation, involved, notes, attachments, audit });
});

router.post('/', (request, response) => {
  const title = String(request.body?.title || '').trim();
  if (!title) return response.status(400).json({ message: 'O título da investigação é obrigatório.' });

  const familyId = sanitizeId(request.body?.family_id);
  const status = STATUS_VALUES.includes(request.body?.status) ? request.body.status : 'aberta';

  const result = db
    .prepare(`
      INSERT INTO investigations (title, description, family_id, status, investigation_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      title,
      String(request.body?.description || '').trim() || null,
      familyId,
      status,
      String(request.body?.investigation_date || '').trim() || null,
      request.user.id
    );

  logAudit(request.user.id, 'create', 'investigation', result.lastInsertRowid, title);
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada.' });

  const title = String(request.body?.title ?? investigation.title).trim() || investigation.title;
  const description = request.body?.description !== undefined
    ? String(request.body.description).trim() || null
    : investigation.description;
  const familyId = request.body?.family_id !== undefined
    ? sanitizeId(request.body.family_id)
    : investigation.family_id;
  const status = STATUS_VALUES.includes(request.body?.status) ? request.body.status : investigation.status;
  const investigationDate = request.body?.investigation_date !== undefined
    ? String(request.body.investigation_date).trim() || null
    : investigation.investigation_date;

  db.prepare(`
    UPDATE investigations SET title = ?, description = ?, family_id = ?, status = ?,
                             investigation_date = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, familyId, status, investigationDate, investigationId);

  logAudit(request.user.id, 'update', 'investigation', investigationId, title,
    status !== investigation.status ? `Status: ${investigation.status} → ${status}` : null);

  return response.json({ ok: true });
});

// ===== Pessoas envolvidas =====
router.post('/:id/members', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada.' });

  const memberId = sanitizeId(request.body?.member_id);
  if (!memberId) return response.status(400).json({ message: 'Selecione um membro.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado.' });

  const duplicate = db
    .prepare('SELECT id FROM investigation_members WHERE investigation_id = ? AND member_id = ?')
    .get(investigationId, memberId);
  if (duplicate) {
    return response.status(409).json({ message: `${member.nickname} já está registrado nesta investigação.` });
  }

  const involvement = String(request.body?.involvement || '').trim() || null;
  const result = db
    .prepare('INSERT INTO investigation_members (investigation_id, member_id, involvement) VALUES (?, ?, ?)')
    .run(investigationId, memberId, involvement);

  logAudit(request.user.id, 'update', 'investigation', investigationId, investigation.title,
    `Pessoa envolvida registrada: ${member.nickname}`);
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id/members/:linkId', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  const linkId = sanitizeId(request.params.linkId);
  if (!investigationId || !linkId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  const link = db
    .prepare(`
      SELECT im.*, mem.nickname FROM investigation_members im
      JOIN members mem ON mem.id = im.member_id
      WHERE im.id = ? AND im.investigation_id = ?
    `)
    .get(linkId, investigationId);

  if (!link) return response.status(404).json({ message: 'Registro não encontrado nesta investigação.' });

  db.prepare('DELETE FROM investigation_members WHERE id = ?').run(linkId);
  logAudit(request.user.id, 'update', 'investigation', investigationId,
    investigation?.title || `#${investigationId}`, `Pessoa removida: ${link.nickname}`);
  return response.json({ ok: true });
});

// ===== Anotações cronológicas =====
router.post('/:id/notes', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada.' });

  const note = String(request.body?.note || '').trim();
  if (!note) return response.status(400).json({ message: 'A anotação não pode estar vazia.' });

  const result = db
    .prepare('INSERT INTO investigation_notes (investigation_id, note, created_by) VALUES (?, ?, ?)')
    .run(investigationId, note, request.user.id);

  logAudit(request.user.id, 'update', 'investigation', investigationId, investigation.title, 'Anotação adicionada.');
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id/notes/:noteId', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  const noteId = sanitizeId(request.params.noteId);
  if (!investigationId || !noteId) return response.status(400).json({ message: 'Identificador inválido.' });

  const note = db
    .prepare('SELECT * FROM investigation_notes WHERE id = ? AND investigation_id = ?')
    .get(noteId, investigationId);
  if (!note) return response.status(404).json({ message: 'Anotação não encontrada.' });

  db.prepare('DELETE FROM investigation_notes WHERE id = ?').run(noteId);
  return response.json({ ok: true });
});

// ===== Evidências =====
router.post('/:id/attachments', upload.array('files', 15), (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada.' });

  if (!request.files?.length) {
    return response.status(400).json({ message: 'Nenhuma evidência enviada.' });
  }

  const insert = db.prepare(
    "INSERT INTO attachments (entity_type, entity_id, file_path, caption, created_by) VALUES ('investigation', ?, ?, ?, ?)"
  );
  const created = request.files.map((file) => {
    const url = `/uploads/${file.filename}`;
    insert.run(investigationId, url, null, request.user.id);
    return { url };
  });

  logAudit(request.user.id, 'update', 'investigation', investigationId, investigation.title, 'Evidências adicionadas.');
  return response.status(201).json({ attachments: created });
}, uploadErrorHandler);

router.delete('/attachments/:attachmentId', (request, response) => {
  const attachmentId = sanitizeId(request.params.attachmentId);
  if (!attachmentId) return response.status(400).json({ message: 'Identificador inválido.' });

  const attachment = db
    .prepare("SELECT * FROM attachments WHERE id = ? AND entity_type = 'investigation'")
    .get(attachmentId);
  if (!attachment) return response.status(404).json({ message: 'Evidência não encontrada.' });

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  removeUploadFile(attachment.file_path);
  return response.json({ ok: true });
});

router.post('/:id/archive', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ? AND archived_at IS NULL').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada ou já arquivada.' });

  db.prepare("UPDATE investigations SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(investigationId);
  logAudit(request.user.id, 'archive', 'investigation', investigationId, investigation.title);
  return response.json({ ok: true });
});

router.post('/:id/restore', (request, response) => {
  const investigationId = sanitizeId(request.params.id);
  if (!investigationId) return response.status(400).json({ message: 'Identificador inválido.' });

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ? AND archived_at IS NOT NULL').get(investigationId);
  if (!investigation) return response.status(404).json({ message: 'Investigação não encontrada no arquivo.' });

  db.prepare('UPDATE investigations SET archived_at = NULL WHERE id = ?').run(investigationId);
  logAudit(request.user.id, 'restore', 'investigation', investigationId, investigation.title);
  return response.json({ ok: true });
});

export default router;
