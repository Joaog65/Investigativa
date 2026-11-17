import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const dataDirectory = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'server/data');

const databaseFile = path.join(dataDirectory, 'investigativa.db');

fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function getDatabase() {
  return db;
}

// Busca sem sensibilidade a acentos (pt-BR)
db.function('unaccent', (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
});

/** Termo de busca normalizado (minúsculo, sem acentos). */
export function normalizeSearchTerm(term) {
  return `%${String(term || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}%`;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    nickname TEXT,
    avatar_path TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    entity_name TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 99,
    description TEXT,
    archived_at TEXT
  );

  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo_path TEXT,
    description TEXT,
    founded_on TEXT,
    territory TEXT,
    status TEXT NOT NULL DEFAULT 'ativa',
    leader_member_id INTEGER REFERENCES members(id),
    vice_leader_member_id INTEGER REFERENCES members(id),
    location_name TEXT,
    coordinates TEXT,
    location_notes TEXT,
    observations TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_families_name ON families(name);

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    full_name TEXT,
    photo_path TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    observations TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_members_nickname ON members(nickname);

  CREATE TABLE IF NOT EXISTS member_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    server_id TEXT NOT NULL,
    UNIQUE(server_id)
  );
  CREATE INDEX IF NOT EXISTS idx_member_ids_server_id ON member_ids(server_id);

  CREATE TABLE IF NOT EXISTS family_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    family_id INTEGER NOT NULL REFERENCES families(id),
    role_id INTEGER REFERENCES roles(id),
    joined_on TEXT NOT NULL,
    left_on TEXT,
    leave_reason TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_memberships_member ON family_memberships(member_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_family ON family_memberships(family_id);

  CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_a_id INTEGER NOT NULL REFERENCES families(id),
    family_b_id INTEGER NOT NULL REFERENCES families(id),
    type TEXT NOT NULL,
    started_on TEXT,
    description TEXT,
    exceptions TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_relations_a ON relations(family_a_id);
  CREATE INDEX IF NOT EXISTS idx_relations_b ON relations(family_b_id);

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    category TEXT,
    caption TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

  CREATE TABLE IF NOT EXISTS family_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL REFERENCES families(id),
    name TEXT NOT NULL,
    photo_path TEXT,
    description TEXT,
    category TEXT,
    price TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_family_products_family ON family_products(family_id);

  CREATE TABLE IF NOT EXISTS investigations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    family_id INTEGER REFERENCES families(id),
    status TEXT NOT NULL DEFAULT 'aberta',
    investigation_date TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);

  CREATE TABLE IF NOT EXISTS investigation_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id INTEGER NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    involvement TEXT,
    UNIQUE(investigation_id, member_id)
  );
  CREATE INDEX IF NOT EXISTS idx_inv_members_investigation ON investigation_members(investigation_id);

  CREATE TABLE IF NOT EXISTS investigation_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id INTEGER NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_inv_notes_investigation ON investigation_notes(investigation_id);
`;

/** Adiciona uma coluna a uma tabela se ela ainda não existir (migration segura). */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const DEFAULT_ROLES = [
  ['Dono', 1],
  ['Líder', 2],
  ['Sub-líder', 3],
  ['Gerente', 4],
  ['Braço direito', 5],
  ['Recrutador', 6],
  ['Membro', 7],
  ['Novato', 8],
];

function mapLegacyRole(title = '') {
  const normalized = title.toLowerCase();
  if (normalized.includes('dono')) return 'Dono';
  if (normalized.includes('sub')) return 'Sub-líder';
  if (normalized.includes('líder') || normalized.includes('lider')) return 'Líder';
  if (normalized.includes('braço') || normalized.includes('braco')) return 'Braço direito';
  if (normalized.includes('recrut')) return 'Recrutador';
  if (normalized.includes('novato')) return 'Novato';
  if (normalized.includes('gerente')) return 'Gerente';
  return 'Membro';
}

function migrateLegacyOrganizations(adminUserId) {
  const legacyCount = db
    .prepare('SELECT COUNT(*) AS total FROM organizations')
    .get();

  const familiesCount = db.prepare('SELECT COUNT(*) AS total FROM families').get();

  if (!legacyCount.total || familiesCount.total) {
    return;
  }

  const legacy = db.prepare('SELECT * FROM organizations ORDER BY id').all();
  const roleByName = new Map(
    db.prepare('SELECT id, name FROM roles').all().map((role) => [role.name, role.id])
  );

  const insertMember = db.prepare(`
    INSERT INTO members (nickname, status, observations, created_by, created_at, updated_at)
    VALUES (?, 'ativo', ?, ?, datetime('now'), datetime('now'))
  `);
  const insertMembership = db.prepare(`
    INSERT INTO family_memberships (member_id, family_id, role_id, joined_on, status, notes, created_by)
    VALUES (?, ?, ?, date('now'), 'ativo', 'Vínculo migrado do sistema anterior.', ?)
  `);
  const insertFamily = db.prepare(`
    INSERT INTO families (name, description, observations, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'ativa', ?, datetime('now'), datetime('now'))
  `);

  const migrate = db.transaction(() => {
    for (const organization of legacy) {
      const familyResult = insertFamily.run(
        organization.name,
        organization.observations || '',
        organization.alliance_notes || '',
        adminUserId
      );
      const familyId = familyResult.lastInsertRowid;

      const positions = db
        .prepare('SELECT * FROM hierarchy_positions WHERE organization_id = ? ORDER BY rank ASC')
        .all(organization.id);

      for (const position of positions) {
        const nickname = String(position.person_name || '').trim();
        if (!nickname) continue;

        const roleName = mapLegacyRole(position.title);
        const roleId = roleByName.get(roleName) || roleByName.get('Membro');

        const existingMember = db
          .prepare('SELECT id FROM members WHERE lower(nickname) = lower(?)')
          .get(nickname);

        const memberId =
          existingMember?.id ?? insertMember.run(nickname, null, adminUserId).lastInsertRowid;

        if (existingMember) {
          db.prepare(
            'INSERT OR IGNORE INTO member_ids (member_id, server_id) VALUES (?, ?)'
          ).run(memberId, `legacy-${organization.id}`);
        }

        const membershipId = insertMembership.run(
          memberId,
          familyId,
          roleId,
          adminUserId
        ).lastInsertRowid;

        if (roleName === 'Líder') {
          db.prepare('UPDATE families SET leader_member_id = ? WHERE id = ?').run(
            memberId,
            familyId
          );
        }

        void membershipId;
      }
    }
  });

  migrate();

  logAudit(null, 'migrate', 'system', null, 'Migração do protótipo v1.0', `${legacy.length} organizações convertidas em famílias.`);
}

export function logAudit(userId, action, entityType, entityId, entityName, detail = '') {
  db.prepare(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_name, detail)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, action, entityType, entityId, entityName, detail || null);
}

export function initializeDatabase() {
  db.exec(SCHEMA);

  // Migrações incrementais (bancos existentes)
  ensureColumn('users', 'nickname', 'TEXT');
  ensureColumn('users', 'avatar_path', 'TEXT');
  ensureColumn('attachments', 'category', 'TEXT');
  ensureColumn('families', 'location_name', 'TEXT');
  ensureColumn('families', 'coordinates', 'TEXT');
  ensureColumn('families', 'location_notes', 'TEXT');
  ensureColumn('family_products', 'photo_path', 'TEXT');

  // Usuário administrador inicial
  const usersCount = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  let adminUserId = null;

  if (!usersCount.total) {
    const passwordHash = bcrypt.hashSync('investigativa', 10);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
      .run('admin', passwordHash, 'Administrador', 'admin');
    adminUserId = result.lastInsertRowid;
    logAudit(null, 'seed', 'user', adminUserId, 'admin', 'Usuário administrador inicial criado (senha padrão: investigativa).');
  } else {
    adminUserId = db.prepare('SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1').get('admin')?.id ?? null;
  }

  // Cargos padrão
  const rolesCount = db.prepare('SELECT COUNT(*) AS total FROM roles').get();
  if (!rolesCount.total) {
    const insertRole = db.prepare('INSERT INTO roles (name, level) VALUES (?, ?)');
    DEFAULT_ROLES.forEach(([name, level]) => insertRole.run(name, level));
  }

  migrateLegacyOrganizations(adminUserId);
}
