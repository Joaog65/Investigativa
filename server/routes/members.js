import express from 'express';

import { db, logAudit, normalizeSearchTerm } from '../db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler, parseList } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

const MEMBER_LIST_SQL = `
  SELECT mem.*,
    cm.family_id AS current_family_id, cf.name AS current_family_name, cf.logo_path AS current_family_logo,
    cr.name AS current_role_name, cr.level AS current_role_level, cm.joined_on AS current_joined_on,
    (SELECT COUNT(*) FROM member_ids mi WHERE mi.member_id = mem.id) AS id_count,
    (SELECT GROUP_CONCAT(mi.server_id, ', ') FROM member_ids mi WHERE mi.member_id = mem.id) AS server_ids
  FROM members mem
  LEFT JOIN family_memberships cm ON cm.member_id = mem.id AND cm.left_on IS NULL
  LEFT JOIN families cf ON cf.id = cm.family_id
  LEFT JOIN roles cr ON cr.id = cm.role_id
`;

function replaceServerIds(memberId, serverIds) {
  db.prepare('DELETE FROM member_ids WHERE member_id = ?').run(memberId);
  const insert = db.prepare('INSERT OR IGNORE INTO member_ids (member_id, server_id) VALUES (?, ?)');
  serverIds.forEach((serverId) => insert.run(memberId, serverId));
}

router.get('/', (request, response) => {
  const { search = '', family = '', status = '', sort = 'nickname' } = request.query;
  const conditions = ['mem.archived_at IS NULL'];
  const params = [];

  if (search) {
    conditions.push(`(
      unaccent(lower(mem.nickname)) LIKE ? OR unaccent(lower(COALESCE(mem.full_name, ''))) LIKE ? OR
      EXISTS (SELECT 1 FROM member_ids mi WHERE mi.member_id = mem.id AND unaccent(lower(mi.server_id)) LIKE ?)
    )`);
    const term = normalizeSearchTerm(search);
    params.push(term, term, term);
  }

  if (family) {
    conditions.push('cm.family_id = ?');
    params.push(Number(family));
  }

  if (status) {
    conditions.push('mem.status = ?');
    params.push(String(status));
  }

  const orderBy = {
    nickname: 'lower(mem.nickname) ASC',
    family: 'lower(current_family_name) ASC, lower(mem.nickname) ASC',
    recent: 'mem.updated_at DESC',
  }[sort] || 'lower(mem.nickname) ASC';

  const members = db
    .prepare(`${MEMBER_LIST_SQL} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`)
    .all(...params);

  return response.json(members);
});

router.get('/:id', (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });

  const member = db.prepare(`${MEMBER_LIST_SQL} WHERE mem.id = ?`).get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado.' });

  const serverIds = db.prepare('SELECT server_id FROM member_ids WHERE member_id = ? ORDER BY server_id').all(memberId);
  member.server_id_list = serverIds.map((row) => row.server_id);

  const memberships = db
    .prepare(`
      SELECT m.*, f.name AS family_name, f.logo_path AS family_logo, f.archived_at AS family_archived,
             r.name AS role_name, r.level AS role_level
      FROM family_memberships m
      JOIN families f ON f.id = m.family_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.member_id = ?
      ORDER BY m.joined_on DESC, m.id DESC
    `)
    .all(memberId);

  let relations = [];
  if (member.current_family_id) {
    relations = db
      .prepare(`
        SELECT r.*, fa.name AS family_a_name, fb.name AS family_b_name
        FROM relations r
        JOIN families fa ON fa.id = r.family_a_id
        JOIN families fb ON fb.id = r.family_b_id
        WHERE r.archived_at IS NULL AND r.is_active = 1
          AND (r.family_a_id = ? OR r.family_b_id = ?)
        ORDER BY r.type
      `)
      .all(member.current_family_id, member.current_family_id);
  }

  const audit = db
    .prepare(`
      SELECT * FROM audit_log
      WHERE (entity_type = 'member' AND entity_id = ?)
         OR (entity_type = 'membership' AND entity_id IN (
           SELECT id FROM family_memberships WHERE member_id = ?
         ))
      ORDER BY created_at DESC LIMIT 30
    `)
    .all(memberId, memberId);

  return response.json({ ...member, memberships, relations, audit });
});

router.post('/', (request, response) => {
  const nickname = String(request.body?.nickname || '').trim();
  if (!nickname) {
    return response.status(400).json({ message: 'O vulgo do membro é obrigatório.' });
  }

  const fullName = String(request.body?.full_name || '').trim() || null;
  const status = ['ativo', 'afastado', 'expulso', 'desaparecido'].includes(request.body?.status)
    ? request.body.status
    : 'ativo';
  const observations = String(request.body?.observations || '').trim() || null;
  const serverIds = parseList(request.body?.server_ids);

  const duplicate = db
    .prepare('SELECT id, nickname FROM members WHERE lower(nickname) = lower(?) AND archived_at IS NULL')
    .get(nickname);

  const warning = duplicate
    ? `Já existe um membro ativo com o vulgo "${duplicate.nickname}" (#${duplicate.id}).`
    : null;

  const membership = request.body?.membership;
  const familyId = sanitizeId(membership?.family_id);
  const roleId = sanitizeId(membership?.role_id);
  const joinedOn = String(membership?.joined_on || '').trim() || null;

  if (familyId && !joinedOn) {
    return response.status(400).json({ message: 'Informe a data de entrada do vínculo.' });
  }

  const create = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO members (nickname, full_name, status, observations, created_by)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(nickname, fullName, status, observations, request.user.id);

    const memberId = result.lastInsertRowid;
    replaceServerIds(memberId, serverIds);

    if (familyId) {
      db.prepare(`
        INSERT INTO family_memberships (member_id, family_id, role_id, joined_on, status, notes, created_by)
        VALUES (?, ?, ?, ?, 'ativo', ?, ?)
      `).run(memberId, familyId, roleId, joinedOn, String(membership?.notes || '').trim() || null, request.user.id);
    }

    return memberId;
  });

  let memberId;
  try {
    memberId = create();
  } catch (error) {
    console.error('Erro ao criar membro:', error);
    return response.status(500).json({ message: 'Não foi possível criar o membro.' });
  }

  logAudit(request.user.id, 'create', 'member', memberId, nickname);
  if (familyId) {
    const family = db.prepare('SELECT name FROM families WHERE id = ?').get(familyId);
    logAudit(request.user.id, 'create', 'membership', memberId, nickname, `Vínculo inicial com ${family?.name}.`);
  }

  return response.status(201).json({ id: memberId, warning });
});

router.put('/:id', (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado.' });

  const nickname = String(request.body?.nickname ?? member.nickname).trim() || member.nickname;
  const fullName = request.body?.full_name !== undefined ? String(request.body.full_name).trim() || null : member.full_name;
  const status = ['ativo', 'afastado', 'expulso', 'desaparecido'].includes(request.body?.status)
    ? request.body.status
    : member.status;
  const observations = request.body?.observations !== undefined
    ? String(request.body.observations).trim() || null
    : member.observations;
  const serverIds = request.body?.server_ids !== undefined ? parseList(request.body.server_ids) : null;

  const duplicate = db
    .prepare('SELECT id FROM members WHERE lower(nickname) = lower(?) AND id != ? AND archived_at IS NULL')
    .get(nickname, memberId);

  if (duplicate) {
    return response.status(409).json({ message: `O vulgo "${nickname}" já está em uso pelo membro #${duplicate.id}.` });
  }

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE members SET nickname = ?, full_name = ?, status = ?, observations = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nickname, fullName, status, observations, memberId);

    if (serverIds) replaceServerIds(memberId, serverIds);
  });
  update();

  logAudit(request.user.id, 'update', 'member', memberId, nickname);
  return response.json({ ok: true });
});

router.post('/:id/photo', upload.single('photo'), (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });
  if (!request.file) return response.status(400).json({ message: 'Selecione uma imagem para enviar.' });

  const member = db.prepare('SELECT photo_path, nickname FROM members WHERE id = ?').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado.' });

  const url = `/uploads/${request.file.filename}`;
  db.prepare("UPDATE members SET photo_path = ?, updated_at = datetime('now') WHERE id = ?").run(url, memberId);

  if (member.photo_path) removeUploadFile(member.photo_path);

  logAudit(request.user.id, 'update', 'member', memberId, member.nickname, 'Foto atualizada.');
  return response.json({ url });
}, uploadErrorHandler);

// ===== Vínculos =====
router.post('/:id/memberships', (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado.' });

  const familyId = sanitizeId(request.body?.family_id);
  if (!familyId) return response.status(400).json({ message: 'Selecione a família do vínculo.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ? AND archived_at IS NULL').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada.' });

  const roleId = sanitizeId(request.body?.role_id);
  const joinedOn = String(request.body?.joined_on || '').trim();
  if (!joinedOn) return response.status(400).json({ message: 'Informe a data de entrada.' });

  const active = db
    .prepare('SELECT id FROM family_memberships WHERE member_id = ? AND left_on IS NULL AND family_id != ?')
    .get(memberId, familyId);

  if (active) {
    return response.status(400).json({
      message: 'O membro já possui um vínculo ativo em outra família. Encerre-o antes de criar um novo vínculo.',
    });
  }

  const result = db
    .prepare(`
      INSERT INTO family_memberships (member_id, family_id, role_id, joined_on, status, notes, created_by)
      VALUES (?, ?, ?, ?, 'ativo', ?, ?)
    `)
    .run(memberId, familyId, roleId, joinedOn, String(request.body?.notes || '').trim() || null, request.user.id);

  logAudit(
    request.user.id,
    'create',
    'membership',
    result.lastInsertRowid,
    member.nickname,
    `Vínculo com ${family.name} (entrada em ${joinedOn}).`
  );

  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/memberships/:membershipId', (request, response) => {
  const membershipId = sanitizeId(request.params.membershipId);
  if (!membershipId) return response.status(400).json({ message: 'Identificador inválido.' });

  const membership = db
    .prepare(`
      SELECT m.*, mem.nickname AS member_nickname
      FROM family_memberships m JOIN members mem ON mem.id = m.member_id
      WHERE m.id = ?
    `)
    .get(membershipId);

  if (!membership) return response.status(404).json({ message: 'Vínculo não encontrado.' });

  const roleId = request.body?.role_id !== undefined ? sanitizeId(request.body.role_id) : membership.role_id;
  const joinedOn = request.body?.joined_on !== undefined
    ? String(request.body.joined_on).trim() || membership.joined_on
    : membership.joined_on;
  const status = ['ativo', 'afastado', 'expulso', 'desaparecido'].includes(request.body?.status)
    ? request.body.status
    : membership.status;
  const notes = request.body?.notes !== undefined ? String(request.body.notes).trim() || null : membership.notes;

  db.prepare(`
    UPDATE family_memberships SET role_id = ?, joined_on = ?, status = ?, notes = ? WHERE id = ?
  `).run(roleId, joinedOn, status, notes, membershipId);

  logAudit(
    request.user.id,
    'update',
    'membership',
    membershipId,
    membership.member_nickname,
    `Vínculo atualizado (cargo/status).`
  );

  return response.json({ ok: true });
});

router.post('/memberships/:membershipId/close', (request, response) => {
  const membershipId = sanitizeId(request.params.membershipId);
  if (!membershipId) return response.status(400).json({ message: 'Identificador inválido.' });

  const membership = db
    .prepare(`
      SELECT m.*, mem.nickname AS member_nickname, f.name AS family_name
      FROM family_memberships m
      JOIN members mem ON mem.id = m.member_id
      JOIN families f ON f.id = m.family_id
      WHERE m.id = ?
    `)
    .get(membershipId);

  if (!membership) return response.status(404).json({ message: 'Vínculo não encontrado.' });
  if (membership.left_on) return response.status(400).json({ message: 'Este vínculo já está encerrado.' });

  const leftOn = String(request.body?.left_on || '').trim();
  if (!leftOn) return response.status(400).json({ message: 'Informe a data de saída.' });

  const leaveReason = ['saiu', 'expulso', 'desapareceu', 'outro'].includes(request.body?.leave_reason)
    ? request.body.leave_reason
    : 'outro';

  db.prepare(`
    UPDATE family_memberships
    SET left_on = ?, leave_reason = ?, status = CASE WHEN ? = 'expulso' THEN 'expulso' ELSE 'ativo' END
    WHERE id = ?
  `).run(leftOn, leaveReason, leaveReason, membershipId);

  // Ajusta o status do membro conforme o motivo
  if (leaveReason === 'expulso') {
    db.prepare("UPDATE members SET status = 'expulso', updated_at = datetime('now') WHERE id = ?").run(membership.member_id);
  } else if (leaveReason === 'saiu') {
    db.prepare("UPDATE members SET status = 'ativo', updated_at = datetime('now') WHERE id = ?").run(membership.member_id);
  }

  // Limpa liderança da família se necessário
  db.prepare(`
    UPDATE families SET leader_member_id = NULL WHERE id = ? AND leader_member_id = ? AND
      NOT EXISTS (SELECT 1 FROM family_memberships WHERE member_id = leader_member_id AND family_id = families.id AND left_on IS NULL)
  `).run(membership.family_id, membership.member_id);
  db.prepare(`
    UPDATE families SET vice_leader_member_id = NULL WHERE id = ? AND vice_leader_member_id = ? AND
      NOT EXISTS (SELECT 1 FROM family_memberships WHERE member_id = vice_leader_member_id AND family_id = families.id AND left_on IS NULL)
  `).run(membership.family_id, membership.member_id);

  logAudit(
    request.user.id,
    'update',
    'membership',
    membershipId,
    membership.member_nickname,
    `Vínculo com ${membership.family_name} encerrado (${leaveReason}, ${leftOn}).`
  );

  return response.json({ ok: true });
});

router.post('/:id/archive', (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ? AND archived_at IS NULL').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado ou já arquivado.' });

  const reason = String(request.body?.reason || '').trim();

  const archive = db.transaction(() => {
    db.prepare(`
      UPDATE family_memberships
      SET left_on = date('now'), leave_reason = COALESCE(leave_reason, 'outro')
      WHERE member_id = ? AND left_on IS NULL
    `).run(memberId);

    db.prepare("UPDATE members SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(memberId);
  });
  archive();

  logAudit(request.user.id, 'archive', 'member', memberId, member.nickname, reason || null);
  return response.json({ ok: true });
});

router.post('/:id/restore', (request, response) => {
  const memberId = sanitizeId(request.params.id);
  if (!memberId) return response.status(400).json({ message: 'Identificador inválido.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ? AND archived_at IS NOT NULL').get(memberId);
  if (!member) return response.status(404).json({ message: 'Membro não encontrado no arquivo.' });

  db.prepare("UPDATE members SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?").run(memberId);
  logAudit(request.user.id, 'restore', 'member', memberId, member.nickname);

  return response.json({ ok: true });
});

export default router;
