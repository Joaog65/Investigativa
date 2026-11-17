import express from 'express';

import { db, logAudit, normalizeSearchTerm } from '../db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

function normalizeFamilyPayload(body, current = null) {
  return {
    name: String(body?.name ?? current?.name ?? '').trim(),
    description: String(body?.description ?? current?.description ?? '').trim() || null,
    founded_on: String(body?.founded_on ?? current?.founded_on ?? '').trim() || null,
    territory: String(body?.territory ?? current?.territory ?? '').trim() || null,
    status: ['ativa', 'inativa', 'dissolvida'].includes(body?.status)
      ? body.status
      : (current?.status ?? 'ativa'),
    observations: String(body?.observations ?? current?.observations ?? '').trim() || null,
    location_name: String(body?.location_name ?? current?.location_name ?? '').trim() || null,
    coordinates: String(body?.coordinates ?? current?.coordinates ?? '').trim() || null,
    location_notes: String(body?.location_notes ?? current?.location_notes ?? '').trim() || null,
    leader_member_id: sanitizeId(body?.leader_member_id) ?? current?.leader_member_id ?? null,
    vice_leader_member_id: sanitizeId(body?.vice_leader_member_id) ?? current?.vice_leader_member_id ?? null,
  };
}

function validateLeadership(data, familyId = null) {
  const errors = [];

  for (const [field, label] of [
    ['leader_member_id', 'Líder'],
    ['vice_leader_member_id', 'Vice-líder'],
  ]) {
    const memberId = data[field];
    if (!memberId) continue;

    const membership = db
      .prepare(
        `SELECT m.id, m.family_id, m.member_id
         FROM family_memberships m
         JOIN members mem ON mem.id = m.member_id
         WHERE m.member_id = ? AND m.left_on IS NULL AND mem.archived_at IS NULL`
      )
      .get(memberId);

    if (!membership) {
      errors.push(`${label} precisa ter um vínculo ativo em alguma família.`);
    } else if (familyId && membership.family_id !== familyId) {
      errors.push(`${label} precisa ter vínculo ativo nesta família.`);
    }
  }

  if (
    data.leader_member_id &&
    data.vice_leader_member_id &&
    data.leader_member_id === data.vice_leader_member_id
  ) {
    errors.push('Líder e vice-líder não podem ser a mesma pessoa.');
  }

  return errors;
}

const FAMILY_LIST_SQL = `
  SELECT f.*,
    (SELECT COUNT(*) FROM family_memberships m JOIN members mem ON mem.id = m.member_id
      WHERE m.family_id = f.id AND m.left_on IS NULL AND mem.archived_at IS NULL) AS member_count,
    (SELECT COUNT(*) FROM relations r
      WHERE r.archived_at IS NULL AND r.is_active = 1
        AND (r.family_a_id = f.id OR r.family_b_id = f.id)) AS relation_count,
    (SELECT COUNT(*) FROM family_products p WHERE p.family_id = f.id) AS product_count,
    (SELECT COUNT(*) FROM attachments a WHERE a.entity_type = 'family' AND a.entity_id = f.id) AS photo_count,
    leader.nickname AS leader_nickname
  FROM families f
  LEFT JOIN members leader ON leader.id = f.leader_member_id
`;

export const LOCATION_CATEGORIES = ['localizacao', 'qg_fachada', 'qg_interna', 'territorio', 'veiculos', 'outros'];

router.get('/', (request, response) => {
  const { status = 'ativas', search = '', sort = 'name' } = request.query;

  const conditions = ['f.archived_at IS NULL'];
  const params = [];

  if (status === 'ativas') conditions.push("f.status = 'ativa'");
  else if (['inativa', 'dissolvida'].includes(String(status))) {
    conditions.push('f.status = ?');
    params.push(String(status));
  }

  if (search) {
    conditions.push(
      '(unaccent(lower(f.name)) LIKE ? OR unaccent(lower(COALESCE(f.territory, ""))) LIKE ? OR unaccent(lower(COALESCE(f.description, ""))) LIKE ?)'
    );
    const term = normalizeSearchTerm(search);
    params.push(term, term, term);
  }

  const orderBy = {
    name: 'f.name ASC',
    members: 'member_count DESC, f.name ASC',
    recent: 'f.updated_at DESC',
    created: 'f.created_at DESC',
  }[sort] || 'f.name ASC';

  const families = db
    .prepare(`${FAMILY_LIST_SQL} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`)
    .all(...params);

  return response.json(families);
});

router.get('/:id', (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  const family = db
    .prepare(`${FAMILY_LIST_SQL} WHERE f.id = ?`)
    .get(familyId);

  if (!family) return response.status(404).json({ message: 'Família não encontrada.' });

  const activeMembers = db
    .prepare(`
      SELECT m.id AS membership_id, mem.id AS member_id, mem.nickname, mem.full_name,
             mem.photo_path, mem.status AS member_status, mem.archived_at,
             r.name AS role_name, r.level AS role_level, m.joined_on
      FROM family_memberships m
      JOIN members mem ON mem.id = m.member_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.family_id = ? AND m.left_on IS NULL
      ORDER BY r.level ASC, lower(mem.nickname) ASC
    `)
    .all(familyId);

  const pastMembers = db
    .prepare(`
      SELECT m.id AS membership_id, mem.id AS member_id, mem.nickname, mem.photo_path,
             r.name AS role_name, m.joined_on, m.left_on, m.leave_reason, m.status
      FROM family_memberships m
      JOIN members mem ON mem.id = m.member_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.family_id = ? AND m.left_on IS NOT NULL
      ORDER BY m.left_on DESC
      LIMIT 50
    `)
    .all(familyId);

  const relations = db
    .prepare(`
      SELECT r.*,
        fa.name AS family_a_name, fa.logo_path AS family_a_logo,
        fb.name AS family_b_name, fb.logo_path AS family_b_logo
      FROM relations r
      JOIN families fa ON fa.id = r.family_a_id
      JOIN families fb ON fb.id = r.family_b_id
      WHERE (r.family_a_id = ? OR r.family_b_id = ?) AND r.archived_at IS NULL
      ORDER BY r.is_active DESC, r.created_at DESC
    `)
    .all(familyId, familyId);

  const products = db
    .prepare('SELECT * FROM family_products WHERE family_id = ? ORDER BY category, name')
    .all(familyId);

  const attachments = db
    .prepare('SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC')
    .all('family', familyId);

  const audit = db
    .prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 30')
    .all('family', familyId);

  return response.json({ ...family, active_members: activeMembers, past_members: pastMembers, relations, products, attachments, audit });
});

router.post('/', (request, response) => {
  const data = normalizeFamilyPayload(request.body);

  if (!data.name) {
    return response.status(400).json({ message: 'O nome da família é obrigatório.' });
  }

  const errors = validateLeadership(data);
  if (errors.length) {
    return response.status(400).json({ message: errors[0] });
  }

  const result = db
    .prepare(`
      INSERT INTO families (name, description, founded_on, territory, status, observations,
                            location_name, coordinates, location_notes,
                            leader_member_id, vice_leader_member_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      data.name,
      data.description,
      data.founded_on,
      data.territory,
      data.status,
      data.observations,
      data.location_name,
      data.coordinates,
      data.location_notes,
      data.leader_member_id,
      data.vice_leader_member_id,
      request.user.id
    );

  logAudit(request.user.id, 'create', 'family', result.lastInsertRowid, data.name);
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada.' });

  const data = normalizeFamilyPayload(request.body, family);

  if (!data.name) {
    return response.status(400).json({ message: 'O nome da família é obrigatório.' });
  }

  const errors = validateLeadership(data, familyId);
  if (errors.length) {
    return response.status(400).json({ message: errors[0] });
  }

  db.prepare(`
    UPDATE families SET name = ?, description = ?, founded_on = ?, territory = ?, status = ?,
                        observations = ?, location_name = ?, coordinates = ?, location_notes = ?,
                        leader_member_id = ?, vice_leader_member_id = ?,
                        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.name,
    data.description,
    data.founded_on,
    data.territory,
    data.status,
    data.observations,
    data.location_name,
    data.coordinates,
    data.location_notes,
    data.leader_member_id,
    data.vice_leader_member_id,
    familyId
  );

  logAudit(request.user.id, 'update', 'family', familyId, data.name);
  return response.json({ ok: true });
});

router.post('/:id/logo', upload.single('logo'), (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  if (!request.file) {
    return response.status(400).json({ message: 'Selecione uma imagem para enviar.' });
  }

  const family = db.prepare('SELECT logo_path FROM families WHERE id = ?').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada.' });

  const url = `/uploads/${request.file.filename}`;
  db.prepare("UPDATE families SET logo_path = ?, updated_at = datetime('now') WHERE id = ?").run(url, familyId);

  if (family.logo_path) removeUploadFile(family.logo_path);

  logAudit(request.user.id, 'update', 'family', familyId, request.body?.name || `família #${familyId}`, 'Logotipo atualizado.');
  return response.json({ url });
}, uploadErrorHandler);

router.post('/:id/photos', upload.array('files', 15), (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada.' });

  if (!request.files?.length) {
    return response.status(400).json({ message: 'Nenhuma foto enviada.' });
  }

  const category = LOCATION_CATEGORIES.includes(request.body?.category)
    ? request.body.category
    : 'outros';
  const captions = Array.isArray(request.body?.captions)
    ? request.body.captions.map((item) => String(item).trim())
    : [];

  const insert = db.prepare(
    "INSERT INTO attachments (entity_type, entity_id, file_path, category, caption, created_by) VALUES ('family', ?, ?, ?, ?, ?)"
  );
  const created = request.files.map((file, index) => {
    const url = `/uploads/${file.filename}`;
    insert.run(familyId, url, category, captions[index] || null, request.user.id);
    return { url, category };
  });

  logAudit(
    request.user.id,
    'update',
    'family',
    familyId,
    family.name,
    `Fotos adicionadas (categoria: ${category}).`
  );

  return response.status(201).json({ attachments: created });
}, uploadErrorHandler);

router.delete('/attachments/:attachmentId', (request, response) => {
  const attachmentId = sanitizeId(request.params.attachmentId);
  if (!attachmentId) return response.status(400).json({ message: 'Identificador inválido.' });

  const attachment = db
    .prepare("SELECT * FROM attachments WHERE id = ? AND entity_type = 'family'")
    .get(attachmentId);
  if (!attachment) return response.status(404).json({ message: 'Foto não encontrada.' });

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  removeUploadFile(attachment.file_path);

  logAudit(request.user.id, 'update', 'family', attachment.entity_id, `família #${attachment.entity_id}`, 'Foto removida.');
  return response.json({ ok: true });
});

router.post('/:id/archive', (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ? AND archived_at IS NULL').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada ou já arquivada.' });

  const reason = String(request.body?.reason || '').trim();

  const archive = db.transaction(() => {
    // RN-08: encerra vínculos ativos
    db.prepare(`
      UPDATE family_memberships
      SET left_on = date('now'), leave_reason = COALESCE(leave_reason, 'outro'),
          notes = COALESCE(notes, '') || ' [Vínculo encerrado: família arquivada]'
      WHERE family_id = ? AND left_on IS NULL
    `).run(familyId);

    // Encerra relações vigentes (RN-06)
    db.prepare(`
      UPDATE relations SET is_active = 0
      WHERE (family_a_id = ? OR family_b_id = ?) AND is_active = 1 AND archived_at IS NULL
    `).run(familyId, familyId);

    db.prepare("UPDATE families SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(familyId);
  });
  archive();

  logAudit(
    request.user.id,
    'archive',
    'family',
    familyId,
    family.name,
    reason ? `Motivo: ${reason}` : 'Vínculos e relações vigentes encerrados automaticamente.'
  );

  return response.json({ ok: true });
});

router.post('/:id/restore', (request, response) => {
  const familyId = sanitizeId(request.params.id);
  if (!familyId) return response.status(400).json({ message: 'Identificador inválido.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ? AND archived_at IS NOT NULL').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada no arquivo.' });

  db.prepare("UPDATE families SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?").run(familyId);
  logAudit(request.user.id, 'restore', 'family', familyId, family.name);

  return response.json({ ok: true });
});

export default router;
