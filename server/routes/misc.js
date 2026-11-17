import express from 'express';

import { db, normalizeSearchTerm } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

// ===== Pesquisa global =====
router.get('/search', (request, response) => {
  const term = String(request.query?.q || '').trim().toLowerCase();
  if (!term) {
    return response.json({ families: [], members: [], relations: [] });
  }
  const like = normalizeSearchTerm(term);

  const families = db
    .prepare(`
      SELECT f.id, f.name, f.logo_path, f.status, f.territory,
        (SELECT COUNT(*) FROM family_memberships m JOIN members mem ON mem.id = m.member_id
          WHERE m.family_id = f.id AND m.left_on IS NULL AND mem.archived_at IS NULL) AS member_count
      FROM families f
      WHERE f.archived_at IS NULL
        AND (unaccent(lower(f.name)) LIKE ? OR unaccent(lower(COALESCE(f.territory, ''))) LIKE ?)
      ORDER BY f.name ASC LIMIT 20
    `)
    .all(like, like);

  const members = db
    .prepare(`
      SELECT mem.id, mem.nickname, mem.full_name, mem.photo_path, mem.status,
        cf.name AS current_family_name, cf.logo_path AS current_family_logo, cr.name AS current_role_name,
        (SELECT GROUP_CONCAT(mi.server_id, ', ') FROM member_ids mi WHERE mi.member_id = mem.id) AS server_ids
      FROM members mem
      LEFT JOIN family_memberships cm ON cm.member_id = mem.id AND cm.left_on IS NULL
      LEFT JOIN families cf ON cf.id = cm.family_id
      LEFT JOIN roles cr ON cr.id = cm.role_id
      WHERE mem.archived_at IS NULL
        AND (unaccent(lower(mem.nickname)) LIKE ? OR unaccent(lower(COALESCE(mem.full_name, ''))) LIKE ? OR
             EXISTS (SELECT 1 FROM member_ids mi WHERE mi.member_id = mem.id AND unaccent(lower(mi.server_id)) LIKE ?))
      ORDER BY mem.nickname ASC LIMIT 20
    `)
    .all(like, like, like);

  const relations = db
    .prepare(`
      SELECT r.id, r.type, r.is_active,
        fa.name AS family_a_name, fb.name AS family_b_name
      FROM relations r
      JOIN families fa ON fa.id = r.family_a_id
      JOIN families fb ON fb.id = r.family_b_id
      WHERE r.archived_at IS NULL
        AND (unaccent(lower(fa.name)) LIKE ? OR unaccent(lower(fb.name)) LIKE ? OR
             unaccent(lower(COALESCE(r.description, ''))) LIKE ?)
      ORDER BY r.is_active DESC LIMIT 20
    `)
    .all(like, like, like);

  const products = db
    .prepare(`
      SELECT p.id, p.name, p.price, p.photo_path, p.category,
        f.name AS family_name, f.id AS family_id
      FROM family_products p
      JOIN families f ON f.id = p.family_id
      WHERE (unaccent(lower(p.name)) LIKE ? OR unaccent(lower(COALESCE(p.description, ''))) LIKE ? OR
             unaccent(lower(COALESCE(p.category, ''))) LIKE ?)
      ORDER BY p.name ASC LIMIT 20
    `)
    .all(like, like, like);

  const investigations = db
    .prepare(`
      SELECT i.id, i.title, i.status
      FROM investigations i
      WHERE i.archived_at IS NULL
        AND (unaccent(lower(i.title)) LIKE ? OR unaccent(lower(COALESCE(i.description, ''))) LIKE ?)
      ORDER BY i.updated_at DESC LIMIT 20
    `)
    .all(like, like);

  return response.json({ families, members, relations, products, investigations });
});

// ===== Grafo de relações (mapa) =====
router.get('/graph', (_, response) => {
  const nodes = db
    .prepare(`
      SELECT f.id, f.name, f.logo_path, f.status,
        (SELECT COUNT(*) FROM family_memberships m JOIN members mem ON mem.id = m.member_id
          WHERE m.family_id = f.id AND m.left_on IS NULL AND mem.archived_at IS NULL) AS member_count
      FROM families f
      WHERE f.archived_at IS NULL
      ORDER BY f.name
    `)
    .all();

  const edges = db
    .prepare(`
      SELECT r.id, r.family_a_id AS source, r.family_b_id AS target, r.type, r.started_on
      FROM relations r
      WHERE r.archived_at IS NULL AND r.is_active = 1
      ORDER BY r.created_at
    `)
    .all();

  return response.json({ nodes, edges });
});

// ===== Dashboard =====
router.get('/dashboard', (request, response) => {
  const metrics = {
    families_active: db.prepare("SELECT COUNT(*) AS total FROM families WHERE archived_at IS NULL AND status = 'ativa'").get().total,
    members_active: db.prepare('SELECT COUNT(*) AS total FROM members WHERE archived_at IS NULL').get().total,
    memberships_active: db.prepare('SELECT COUNT(*) AS total FROM family_memberships WHERE left_on IS NULL').get().total,
    alliances: db.prepare("SELECT COUNT(*) AS total FROM relations WHERE archived_at IS NULL AND is_active = 1 AND type = 'alianca'").get().total,
    rivalries: db.prepare("SELECT COUNT(*) AS total FROM relations WHERE archived_at IS NULL AND is_active = 1 AND type = 'rivalidade'").get().total,
    relations_active: db.prepare('SELECT COUNT(*) AS total FROM relations WHERE archived_at IS NULL AND is_active = 1').get().total,
    products: db.prepare('SELECT COUNT(*) AS total FROM family_products').get().total,
    investigations_open: db.prepare("SELECT COUNT(*) AS total FROM investigations WHERE archived_at IS NULL AND status != 'encerrada'").get().total,
  };

  const activities = db
    .prepare(`
      SELECT a.*, u.display_name AS user_name, u.avatar_path AS user_avatar
      FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC, a.id DESC LIMIT 12
    `)
    .all();

  const recentFamilies = db
    .prepare(`
      SELECT f.id, f.name, f.logo_path, f.status, f.updated_at,
        (SELECT COUNT(*) FROM family_memberships m JOIN members mem ON mem.id = m.member_id
          WHERE m.family_id = f.id AND m.left_on IS NULL AND mem.archived_at IS NULL) AS member_count
      FROM families f WHERE f.archived_at IS NULL
      ORDER BY f.updated_at DESC LIMIT 6
    `)
    .all();

  const recentInvestigations = db
    .prepare(`
      SELECT i.id, i.title, i.status, i.updated_at, f.name AS family_name
      FROM investigations i LEFT JOIN families f ON f.id = i.family_id
      WHERE i.archived_at IS NULL
      ORDER BY i.updated_at DESC LIMIT 5
    `)
    .all();

  return response.json({
    metrics, activities,
    recent_families: recentFamilies,
    recent_investigations: recentInvestigations,
  });
});

// ===== Log de auditoria =====
router.get('/audit', (request, response) => {
  const limit = Math.min(Number(request.query?.limit) || 100, 300);
  const entries = db
    .prepare(`
      SELECT a.*, u.display_name AS user_name, u.username
      FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?
    `)
    .all(limit);

  return response.json(entries);
});

// ===== Arquivo (registros arquivados) =====
router.get('/archive', (_, response) => {
  const enrich = (rows, entityType) => {
    const latestArchive = db.prepare(`
      SELECT a.entity_id, a.created_at, a.detail, u.display_name AS user_name
      FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.action = 'archive' AND a.entity_type = ?
      ORDER BY a.created_at DESC
    `).all(entityType);

    const map = new Map();
    for (const event of latestArchive) {
      if (!map.has(event.entity_id)) map.set(event.entity_id, event);
    }

    return rows.map((row) => ({
      ...row,
      archived_info: map.get(row.id) || null,
    }));
  };

  const families = enrich(
    db.prepare('SELECT id, name, status, archived_at FROM families WHERE archived_at IS NOT NULL ORDER BY archived_at DESC').all(),
    'family'
  );

  const members = enrich(
    db.prepare('SELECT id, nickname, status, archived_at FROM members WHERE archived_at IS NOT NULL ORDER BY archived_at DESC').all(),
    'member'
  );

  const roles = enrich(
    db.prepare('SELECT id, name, archived_at FROM roles WHERE archived_at IS NOT NULL ORDER BY archived_at DESC').all(),
    'role'
  );

  const relations = enrich(
    db.prepare(`
      SELECT r.id, r.type, r.is_active, fa.name AS family_a_name, fb.name AS family_b_name, r.archived_at
      FROM relations r
      JOIN families fa ON fa.id = r.family_a_id
      JOIN families fb ON fb.id = r.family_b_id
      WHERE r.archived_at IS NOT NULL
      ORDER BY r.archived_at DESC
    `).all(),
    'relation'
  );

  const investigations = enrich(
    db.prepare('SELECT id, title, status, archived_at FROM investigations WHERE archived_at IS NOT NULL ORDER BY archived_at DESC').all(),
    'investigation'
  );

  return response.json({ families, members, roles, relations, investigations });
});

export default router;
