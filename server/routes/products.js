import express from 'express';

import { db, logAudit, normalizeSearchTerm } from '../db.js';
import { sanitizeId, upload, removeUploadFile, uploadErrorHandler } from '../helpers.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

// Catálogo geral (com filtro por família) — cada produto pertence a exatamente uma família
router.get('/', (request, response) => {
  const { family = '', search = '' } = request.query;
  const conditions = [];
  const params = [];

  if (family) {
    conditions.push('p.family_id = ?');
    params.push(Number(family));
  }

  if (search) {
    conditions.push(
      "(unaccent(lower(p.name)) LIKE ? OR unaccent(lower(COALESCE(p.description, ''))) LIKE ? OR unaccent(lower(COALESCE(p.category, ''))) LIKE ?)"
    );
    const term = normalizeSearchTerm(search);
    params.push(term, term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const products = db
    .prepare(`
      SELECT p.*, f.name AS family_name, f.logo_path AS family_logo, f.status AS family_status
      FROM family_products p
      JOIN families f ON f.id = p.family_id
      ${where}
      ORDER BY f.name ASC, p.category ASC, p.name ASC
    `)
    .all(...params);

  return response.json(products);
});

router.post('/', (request, response) => {
  const familyId = sanitizeId(request.body?.family_id);
  const name = String(request.body?.name || '').trim();

  if (!familyId) return response.status(400).json({ message: 'Produto precisa estar vinculado a uma família.' });
  if (!name) return response.status(400).json({ message: 'O nome do produto é obrigatório.' });

  const family = db.prepare('SELECT * FROM families WHERE id = ? AND archived_at IS NULL').get(familyId);
  if (!family) return response.status(404).json({ message: 'Família não encontrada ou arquivada.' });

  const result = db
    .prepare(`
      INSERT INTO family_products (family_id, name, description, category, price, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      familyId,
      name,
      String(request.body?.description || '').trim() || null,
      String(request.body?.category || '').trim() || null,
      String(request.body?.price || '').trim() || null,
      request.user.id
    );

  logAudit(request.user.id, 'create', 'product', result.lastInsertRowid, name, `Família: ${family.name}`);
  return response.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (request, response) => {
  const productId = sanitizeId(request.params.id);
  if (!productId) return response.status(400).json({ message: 'Identificador inválido.' });

  const product = db
    .prepare('SELECT p.*, f.name AS family_name FROM family_products p JOIN families f ON f.id = p.family_id WHERE p.id = ?')
    .get(productId);
  if (!product) return response.status(404).json({ message: 'Produto não encontrado.' });

  // A família de um produto não pode ser alterada: produto é vinculado à família de origem
  const name = String(request.body?.name ?? product.name).trim() || product.name;
  const description = request.body?.description !== undefined
    ? String(request.body.description).trim() || null
    : product.description;
  const category = request.body?.category !== undefined
    ? String(request.body.category).trim() || null
    : product.category;
  const price = request.body?.price !== undefined
    ? String(request.body.price).trim() || null
    : product.price;

  db.prepare(`
    UPDATE family_products SET name = ?, description = ?, category = ?, price = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description, category, price, productId);

  logAudit(request.user.id, 'update', 'product', productId, name, `Família: ${product.family_name}`);
  return response.json({ ok: true });
});

router.post('/:id/photo', upload.single('photo'), (request, response) => {
  const productId = sanitizeId(request.params.id);
  if (!productId) return response.status(400).json({ message: 'Identificador inválido.' });
  if (!request.file) return response.status(400).json({ message: 'Selecione uma imagem para enviar.' });

  const product = db
    .prepare('SELECT p.*, f.name AS family_name FROM family_products p JOIN families f ON f.id = p.family_id WHERE p.id = ?')
    .get(productId);
  if (!product) return response.status(404).json({ message: 'Produto não encontrado.' });

  const url = `/uploads/${request.file.filename}`;
  db.prepare("UPDATE family_products SET photo_path = ?, updated_at = datetime('now') WHERE id = ?").run(url, productId);

  if (product.photo_path) removeUploadFile(product.photo_path);

  logAudit(request.user.id, 'update', 'product', productId, product.name, `Foto atualizada. Família: ${product.family_name}`);
  return response.json({ url });
}, uploadErrorHandler);

router.delete('/:id', (request, response) => {
  const productId = sanitizeId(request.params.id);
  if (!productId) return response.status(400).json({ message: 'Identificador inválido.' });

  const product = db
    .prepare('SELECT p.*, f.name AS family_name FROM family_products p JOIN families f ON f.id = p.family_id WHERE p.id = ?')
    .get(productId);
  if (!product) return response.status(404).json({ message: 'Produto não encontrado.' });

  db.prepare('DELETE FROM family_products WHERE id = ?').run(productId);
  if (product.photo_path) removeUploadFile(product.photo_path);

  logAudit(request.user.id, 'archive', 'product', productId, product.name, `Excluído. Família: ${product.family_name}`);
  return response.json({ ok: true });
});

export default router;
