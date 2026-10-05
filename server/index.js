import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

import {
  deleteOrganizationById,
  deleteOrganizationImage,
  getAllCategories,
  getAllOrganizations,
  getDatabase,
  getOrganizationById,
  saveOrganizationImage,
  updateOrganizationTimestamp,
} from './database.js';

const app = express();
const port = process.env.PORT || 3001;
const uploadDirectory = path.resolve(process.cwd(), 'server/uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname) || '.png';
    callback(null, `${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
  fileFilter: (_, file, callback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Tipo de arquivo não suportado. Use PNG, JPG, WEBP ou GIF.'));
  },
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(uploadDirectory));

function sanitizeId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeOrganizationPayload(body) {
  const categories = Array.isArray(body.categories)
    ? body.categories
    : typeof body.categories === 'string'
      ? JSON.parse(body.categories || '[]')
      : [];

  const products = Array.isArray(body.products)
    ? body.products
    : typeof body.products === 'string'
      ? JSON.parse(body.products || '[]')
      : [];

  const hierarchy = Array.isArray(body.hierarchy)
    ? body.hierarchy
    : typeof body.hierarchy === 'string'
      ? JSON.parse(body.hierarchy || '[]')
      : [];

  const allianceBenefits = Array.isArray(body.allianceBenefits)
    ? body.allianceBenefits
    : typeof body.allianceBenefits === 'string'
      ? JSON.parse(body.allianceBenefits || '[]')
      : [];

  return {
    name: String(body.name || '').trim(),
    abbreviation: String(body.abbreviation || '').trim(),
    logo: body.logo || '',
    categories,
    products,
    hierarchy,
    allianceBenefits,
    partnership: body.partnership === true || body.partnership === 'true' || body.partnership === 1 ? 1 : 0,
    alliance: body.alliance === true || body.alliance === 'true' || body.alliance === 1 ? 1 : 0,
    allianceNotes: String(body.allianceNotes || '').trim(),
    primaryColor: body.primaryColor || '#d92c2c',
    secondaryColor: body.secondaryColor || '#f5f5f5',
    observations: String(body.observations || '').trim(),
    trackTable: body.trackTable || '',
    partnershipTable: body.partnershipTable || '',
  };
}

app.get('/api/health', (_, response) => {
  response.json({ ok: true, message: 'Sistema Investigativa funcionando corretamente.' });
});

app.get('/api/categories', (_, response) => {
  response.json(getAllCategories());
});

app.get('/api/organizations', (request, response) => {
  const { category, search, product, partnership, alliance, color } = request.query;
  const organizations = getAllOrganizations({
    category: String(category || ''),
    search: String(search || ''),
    product: String(product || ''),
    partnership: String(partnership || ''),
    alliance: String(alliance || ''),
    color: String(color || ''),
  });

  response.json(organizations);
});

app.get('/api/organizations/:id', (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  const organization = getOrganizationById(organizationId);

  if (!organization) {
    return response.status(404).json({ message: 'Organização não encontrada.' });
  }

  return response.json(organization);
});

app.post('/api/organizations', (request, response) => {
  const data = normalizeOrganizationPayload(request.body);

  if (!data.name) {
    return response.status(400).json({ message: 'O nome da organização é obrigatório.' });
  }

  const db = getDatabase();
  const transaction = db.transaction(() => {
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
        track_table,
        partnership_table,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = insertOrganization.run(
      data.name,
      data.abbreviation,
      data.logo,
      data.partnership,
      data.alliance,
      data.allianceNotes,
      data.primaryColor,
      data.secondaryColor,
      data.observations,
      data.trackTable,
      data.partnershipTable
    );

    const organizationId = result.lastInsertRowid;
    const categoryStatement = db.prepare('SELECT id FROM categories WHERE name = ?');
    const relationStatement = db.prepare('INSERT OR IGNORE INTO organization_categories (organization_id, category_id) VALUES (?, ?)');

    data.categories.forEach((categoryName) => {
      const category = categoryStatement.get(categoryName);
      if (category) {
        relationStatement.run(organizationId, category.id);
      }
    });

    const productStatement = db.prepare(`
      INSERT INTO products (organization_id, name, category, description, observation)
      VALUES (?, ?, ?, ?, ?)
    `);

    data.products.forEach((product) => {
      if (!product.name) {
        return;
      }
      productStatement.run(
        organizationId,
        String(product.name || '').trim(),
        String(product.category || '').trim(),
        String(product.description || '').trim(),
        String(product.observation || '').trim()
      );
    });

    const hierarchyStatement = db.prepare(`
      INSERT INTO hierarchy_positions (organization_id, title, person_name, rank)
      VALUES (?, ?, ?, ?)
    `);

    data.hierarchy.forEach((position, index) => {
      if (!position.title) {
        return;
      }
      hierarchyStatement.run(
        organizationId,
        String(position.title || '').trim(),
        String(position.personName || '').trim(),
        Number(position.rank ?? index + 1)
      );
    });

    const benefitStatement = db.prepare('INSERT INTO alliance_benefits (organization_id, benefit) VALUES (?, ?)');

    data.allianceBenefits.forEach((benefit) => {
      const cleanedBenefit = String(benefit || '').trim();
      if (cleanedBenefit) {
        benefitStatement.run(organizationId, cleanedBenefit);
      }
    });

    return organizationId;
  });

  try {
    const organizationId = transaction();
    const createdOrganization = getOrganizationById(organizationId);
    return response.status(201).json(createdOrganization);
  } catch (error) {
    console.error('Erro ao criar organização:', error);
    return response.status(500).json({ message: 'Não foi possível criar a organização.' });
  }
});

app.put('/api/organizations/:id', (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  const existingOrganization = getOrganizationById(organizationId);

  if (!existingOrganization) {
    return response.status(404).json({ message: 'Organização não encontrada.' });
  }

  const data = normalizeOrganizationPayload(request.body);

  if (!data.name) {
    return response.status(400).json({ message: 'O nome da organização é obrigatório.' });
  }

  const db = getDatabase();

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE organizations
      SET name = ?,
          abbreviation = ?,
          logo = ?,
          partnership = ?,
          alliance = ?,
          alliance_notes = ?,
          primary_color = ?,
          secondary_color = ?,
          observations = ?,
          track_table = ?,
          partnership_table = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      data.name,
      data.abbreviation,
      data.logo || existingOrganization.logo,
      data.partnership,
      data.alliance,
      data.allianceNotes,
      data.primaryColor,
      data.secondaryColor,
      data.observations,
      data.trackTable || existingOrganization.track_table,
      data.partnershipTable || existingOrganization.partnership_table,
      organizationId
    );

    db.prepare('DELETE FROM organization_categories WHERE organization_id = ?').run(organizationId);
    const categoryStatement = db.prepare('SELECT id FROM categories WHERE name = ?');
    const relationStatement = db.prepare('INSERT INTO organization_categories (organization_id, category_id) VALUES (?, ?)');

    data.categories.forEach((categoryName) => {
      const category = categoryStatement.get(categoryName);
      if (category) {
        relationStatement.run(organizationId, category.id);
      }
    });

    db.prepare('DELETE FROM products WHERE organization_id = ?').run(organizationId);
    const productStatement = db.prepare('INSERT INTO products (organization_id, name, category, description, observation) VALUES (?, ?, ?, ?, ?)');
    data.products.forEach((product) => {
      if (!product.name) {
        return;
      }
      productStatement.run(
        organizationId,
        String(product.name || '').trim(),
        String(product.category || '').trim(),
        String(product.description || '').trim(),
        String(product.observation || '').trim()
      );
    });

    db.prepare('DELETE FROM hierarchy_positions WHERE organization_id = ?').run(organizationId);
    const hierarchyStatement = db.prepare('INSERT INTO hierarchy_positions (organization_id, title, person_name, rank) VALUES (?, ?, ?, ?)');
    data.hierarchy.forEach((position, index) => {
      if (!position.title) {
        return;
      }
      hierarchyStatement.run(
        organizationId,
        String(position.title || '').trim(),
        String(position.personName || '').trim(),
        Number(position.rank ?? index + 1)
      );
    });

    db.prepare('DELETE FROM alliance_benefits WHERE organization_id = ?').run(organizationId);
    const benefitStatement = db.prepare('INSERT INTO alliance_benefits (organization_id, benefit) VALUES (?, ?)');
    data.allianceBenefits.forEach((benefit) => {
      const cleanedBenefit = String(benefit || '').trim();
      if (cleanedBenefit) {
        benefitStatement.run(organizationId, cleanedBenefit);
      }
    });

    updateOrganizationTimestamp(organizationId);
  });

  try {
    transaction();
    const updatedOrganization = getOrganizationById(organizationId);
    return response.json(updatedOrganization);
  } catch (error) {
    console.error('Erro ao atualizar organização:', error);
    return response.status(500).json({ message: 'Não foi possível atualizar a organização.' });
  }
});

app.delete('/api/organizations/:id', (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  const removed = deleteOrganizationById(organizationId);

  if (!removed) {
    return response.status(404).json({ message: 'Organização não encontrada.' });
  }

  return response.json({ message: 'Organização removida com sucesso.' });
});

app.post('/api/organizations/:id/logo', upload.single('logo'), (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  if (!request.file) {
    return response.status(400).json({ message: 'Selecione uma imagem para enviar.' });
  }

  const imagePath = `/uploads/${request.file.filename}`;
  const db = getDatabase();
  db.prepare('UPDATE organizations SET logo = ?, updated_at = datetime("now") WHERE id = ?').run(imagePath, organizationId);
  return response.json({ url: imagePath, message: 'Logo atualizada com sucesso.' });
});

app.post('/api/organizations/:id/track-table', upload.single('trackTable'), (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  if (!request.file) {
    return response.status(400).json({ message: 'Selecione a imagem da tabela de pista.' });
  }

  const imagePath = `/uploads/${request.file.filename}`;
  const db = getDatabase();
  db.prepare('UPDATE organizations SET track_table = ?, updated_at = datetime("now") WHERE id = ?').run(imagePath, organizationId);
  return response.json({ url: imagePath, message: 'Tabela de pista atualizada com sucesso.' });
});

app.post('/api/organizations/:id/partnership-table', upload.single('partnershipTable'), (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  if (!request.file) {
    return response.status(400).json({ message: 'Selecione a imagem da tabela de parceria.' });
  }

  const imagePath = `/uploads/${request.file.filename}`;
  const db = getDatabase();
  db.prepare('UPDATE organizations SET partnership_table = ?, updated_at = datetime("now") WHERE id = ?').run(imagePath, organizationId);
  return response.json({ url: imagePath, message: 'Tabela de parceria atualizada com sucesso.' });
});

app.post('/api/organizations/:id/images', upload.array('baseImages', 20), (request, response) => {
  const organizationId = sanitizeId(request.params.id);

  if (!organizationId) {
    return response.status(400).json({ message: 'Identificador da organização inválido.' });
  }

  if (!request.files?.length) {
    return response.status(400).json({ message: 'Nenhuma foto foi enviada.' });
  }

  const createdImages = request.files.map((file) => {
    const url = `/uploads/${file.filename}`;
    saveOrganizationImage(organizationId, 'base', url);
    return { url };
  });

  return response.status(201).json({ images: createdImages, message: 'Fotos da base salvas com sucesso.' });
});

app.delete('/api/organizations/:id/images/:imageId', (request, response) => {
  const organizationId = sanitizeId(request.params.id);
  const imageId = sanitizeId(request.params.imageId);

  if (!organizationId || !imageId) {
    return response.status(400).json({ message: 'Dados da imagem inválidos.' });
  }

  const image = getDatabase()
    .prepare('SELECT * FROM organization_images WHERE id = ? AND organization_id = ?')
    .get(imageId, organizationId);

  if (!image) {
    return response.status(404).json({ message: 'Imagem não encontrada para esta organização.' });
  }

  deleteOrganizationImage(imageId);
  return response.json({ message: 'Imagem removida com sucesso.' });
});

app.use((error, _, response, __) => {
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ message: 'Arquivo inválido ou excedeu o limite permitido.' });
  }

  console.error('Erro inesperado no servidor:', error);
  return response.status(500).json({ message: 'Não foi possível processar a solicitação.' });
});

app.listen(port, () => {
  console.log(`Servidor Investigativa ouvindo na porta ${port}`);
});
