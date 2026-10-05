import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDirectory = path.resolve(process.cwd(), 'server/data');
const databaseFile = path.join(dataDirectory, 'investigativa.db');

fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');

function ensureDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      abbreviation TEXT,
      logo TEXT,
      partnership INTEGER DEFAULT 0,
      alliance INTEGER DEFAULT 0,
      alliance_notes TEXT,
      primary_color TEXT DEFAULT '#d92c2c',
      secondary_color TEXT DEFAULT '#f5f5f5',
      observations TEXT,
      track_table TEXT,
      partnership_table TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS organization_categories (
      organization_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (organization_id, category_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      observation TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hierarchy_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      person_name TEXT,
      rank INTEGER DEFAULT 99,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alliance_benefits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      benefit TEXT NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS organization_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
    CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
    CREATE INDEX IF NOT EXISTS idx_hierarchy_organization ON hierarchy_positions(organization_id);
    CREATE INDEX IF NOT EXISTS idx_images_organization ON organization_images(organization_id);
  `);

  const defaultCategories = [
    'Organizações de Munição',
    'Organizações de Armas',
    'Organizações de C4',
    'Organizações de Lavagem de Dinheiro',
  ];

  const categoryInsert = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  defaultCategories.forEach((categoryName) => categoryInsert.run(categoryName));

  const organizationExists = db.prepare('SELECT COUNT(*) AS total FROM organizations').get();

  if (organizationExists.total === 0) {
    const insertOrganization = db.prepare(`
      INSERT INTO organizations (
        name,
        abbreviation,
        logo,
        partnership,
        alliance,
        alliance_notes,
        primary_color,
        secondary_color,
        observations,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const insertRelations = db.prepare('INSERT INTO organization_categories (organization_id, category_id) VALUES (?, ?)');
    const insertProduct = db.prepare(`
      INSERT INTO products (organization_id, name, category, description, observation)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertHierarchy = db.prepare(`
      INSERT INTO hierarchy_positions (organization_id, title, person_name, rank)
      VALUES (?, ?, ?, ?)
    `);
    const insertBenefit = db.prepare('INSERT INTO alliance_benefits (organization_id, benefit) VALUES (?, ?)');

    const seedOrganization = (
      name,
      abbreviation,
      categories,
      products,
      hierarchy,
      benefits,
      primaryColor,
      secondaryColor,
      observations,
      partnership = 1,
      alliance = 1,
      allianceNotes = 'Acesso prioritário e proteção em operações de contrabando.'
    ) => {
      const result = insertOrganization.run(
        name,
        abbreviation,
        '/uploads/demo-logo.png',
        partnership,
        alliance,
        allianceNotes,
        primaryColor,
        secondaryColor,
        observations
      );
      const organizationId = result.lastInsertRowid;

      categories.forEach((categoryName) => {
        const category = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
        if (category) {
          insertRelations.run(organizationId, category.id);
        }
      });

      products.forEach((product) => {
        insertProduct.run(
          organizationId,
          product.name,
          product.category,
          product.description,
          product.observation
        );
      });

      hierarchy.forEach((position) => {
        insertHierarchy.run(
          organizationId,
          position.title,
          position.personName,
          position.rank
        );
      });

      benefits.forEach((benefit) => {
        insertBenefit.run(organizationId, benefit);
      });
    };

    seedOrganization(
      'Família Alpha',
      'FA',
      ['Organizações de Munição', 'Organizações de C4'],
      [
        {
          name: 'Munição Premium',
          category: 'Suprimentos',
          description: 'Carga de munição com abastecimento rápido e discreto.',
          observation: 'Em alta demanda durante operações em rota de fuga.',
        },
        {
          name: 'Carga de Explosivos',
          category: 'Especial',
          description: 'Material para operações específicas e apoio de infiltração.',
          observation: 'Disponível somente por contatos externos.',
        },
      ],
      [
        { title: 'Líder / 01', personName: 'João', rank: 1 },
        { title: 'Gerente Geral', personName: 'Lucas', rank: 2 },
        { title: 'Gerente de Ação', personName: 'Carlos', rank: 3 },
        { title: 'Gerente de Farm', personName: 'Pedro', rank: 4 },
      ],
      ['Acesso ao estoque premium', 'Proteção logística', 'Preço diferenciado em compras registradas'],
      '#d92c2c',
      '#2d4b8c',
      'Operações discretas, organização forte e alto nível de cooperação.',
      1,
      1,
      'Acesso a materiais exclusivos e rota de abastecimento vial.'
    );

    seedOrganization(
      'Família Beta',
      'FB',
      ['Organizações de Armas', 'Organizações de Lavagem de Dinheiro'],
      [
        {
          name: 'Armas de Assalto',
          category: 'Armas',
          description: 'Pacotes de armamento leve e pesado.',
          observation: 'Foco em operações de suporte e reconhecimento.',
        },
        {
          name: 'Lavagem de Capital',
          category: 'Financeiro',
          description: 'Fluxo de capital reciclado com proteção de identidade.',
          observation: 'Uso de múltiplos canais para diluir rastros.',
        },
      ],
      [
        { title: 'Líder / 01', personName: 'Renato', rank: 1 },
        { title: 'Gerente Geral', personName: 'Cristiano', rank: 2 },
        { title: 'Gerente de Vendas', personName: 'Mauro', rank: 6 },
      ],
      ['Acesso a rota de lavagem', 'Prioridade de atendimento', 'Proteção em operação financeira'],
      '#8a5cf6',
      '#0f0f13',
      'Organização ligada a logística pesada, armas e movimentos financeiros.',
      1,
      0,
      'Sem aliança ativa no momento.'
    );

    seedOrganization(
      'Família Omega',
      'FO',
      ['Organizações de Munição', 'Organizações de Armas', 'Organizações de C4'],
      [
        {
          name: 'Kit de Ativo',
          category: 'Munição',
          description: 'Suprimentos para unidades dedicadas.',
          observation: 'Disponível em lote de três vezes por semana.',
        },
      ],
      [
        { title: 'Líder / 01', personName: 'Rafael', rank: 1 },
        { title: 'Gerente de Recrutamento', personName: 'Sérgio', rank: 7 },
      ],
      ['Prioridade de atendimento', 'Acesso à base', 'Cobertura no campo'],
      '#f58b20',
      '#f3f3f3',
      'Estrutura de ação rápida com foco em munição e armas leves.',
      0,
      1,
      'Parceria limitada em operações de vigilância e recarga.'
    );
  }
}

ensureDatabase();

export function getDatabase() {
  return db;
}

function getRelatedRecords(organizationId) {
  const categories = db
    .prepare('SELECT c.id, c.name FROM organization_categories oc INNER JOIN categories c ON c.id = oc.category_id WHERE oc.organization_id = ? ORDER BY c.name')
    .all(organizationId);

  const products = db
    .prepare('SELECT * FROM products WHERE organization_id = ? ORDER BY id')
    .all(organizationId);

  const hierarchy = db
    .prepare('SELECT * FROM hierarchy_positions WHERE organization_id = ? ORDER BY rank ASC, title ASC')
    .all(organizationId);

  const benefits = db
    .prepare('SELECT * FROM alliance_benefits WHERE organization_id = ? ORDER BY id')
    .all(organizationId);

  const images = db
    .prepare('SELECT * FROM organization_images WHERE organization_id = ? ORDER BY created_at DESC')
    .all(organizationId);

  return { categories, products, hierarchy, benefits, images };
}

export function getAllCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY name').all();
}

export function getAllOrganizations(filters = {}) {
  const rows = db.prepare('SELECT * FROM organizations ORDER BY updated_at DESC').all();
  const normalizedFilters = {
    category: filters.category || '',
    search: filters.search || '',
    product: filters.product || '',
    partnership: filters.partnership || '',
    alliance: filters.alliance || '',
    color: filters.color || '',
  };

  return rows
    .map((organization) => ({
      ...organization,
      ...getRelatedRecords(organization.id),
    }))
    .filter((organization) => {
      const matchesSearch =
        !normalizedFilters.search ||
        [
          organization.name,
          organization.abbreviation,
          organization.observations,
          organization.products?.map((product) => product.name).join(' '),
          organization.categories?.map((category) => category.name).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedFilters.search.toLowerCase());

      const matchesCategory =
        !normalizedFilters.category ||
        organization.categories?.some((category) => category.name === normalizedFilters.category);

      const matchesProduct =
        !normalizedFilters.product ||
        organization.products?.some((product) => product.name.toLowerCase().includes(normalizedFilters.product.toLowerCase()));

      const matchesPartnership =
        !normalizedFilters.partnership ||
        (normalizedFilters.partnership === 'active' && organization.partnership === 1) ||
        (normalizedFilters.partnership === 'inactive' && organization.partnership === 0);

      const matchesAlliance =
        !normalizedFilters.alliance ||
        (normalizedFilters.alliance === 'active' && organization.alliance === 1) ||
        (normalizedFilters.alliance === 'inactive' && organization.alliance === 0);

      const matchesColor =
        !normalizedFilters.color ||
        organization.primary_color?.toLowerCase() === normalizedFilters.color.toLowerCase();

      return (
        matchesSearch &&
        matchesCategory &&
        matchesProduct &&
        matchesPartnership &&
        matchesAlliance &&
        matchesColor
      );
    });
}

export function getOrganizationById(organizationId) {
  const organization = db
    .prepare('SELECT * FROM organizations WHERE id = ?')
    .get(organizationId);

  if (!organization) {
    return null;
  }

  return {
    ...organization,
    ...getRelatedRecords(organization.id),
  };
}

export function getOrganizationSummary() {
  return db
    .prepare(`
      SELECT o.id, o.name, o.abbreviation, o.logo, o.partnership, o.alliance, o.primary_color, o.secondary_color
      FROM organizations o
      ORDER BY o.name ASC
    `)
    .all();
}

export function updateOrganizationTimestamp(organizationId) {
  db.prepare('UPDATE organizations SET updated_at = datetime("now") WHERE id = ?').run(organizationId);
}

export function saveOrganizationImage(organizationId, kind, url) {
  db.prepare('INSERT INTO organization_images (organization_id, kind, url) VALUES (?, ?, ?)').run(
    organizationId,
    kind,
    url
  );
}

export function deleteOrganizationImage(imageId) {
  const image = db.prepare('SELECT * FROM organization_images WHERE id = ?').get(imageId);

  if (image?.url) {
    const absolutePath = path.resolve(process.cwd(), image.url.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  db.prepare('DELETE FROM organization_images WHERE id = ?').run(imageId);
}

export function deleteOrganizationById(organizationId) {
  const organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId);

  if (!organization) {
    return false;
  }

  const imageRecords = db.prepare('SELECT * FROM organization_images WHERE organization_id = ?').all(organizationId);
  imageRecords.forEach((imageRecord) => deleteOrganizationImage(imageRecord.id));

  const organizationAssets = [organization.logo, organization.track_table, organization.partnership_table].filter(Boolean);
  organizationAssets.forEach((assetPath) => {
    const absolutePath = path.resolve(process.cwd(), assetPath.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  });

  db.prepare('DELETE FROM organizations WHERE id = ?').run(organizationId);
  return true;
}
