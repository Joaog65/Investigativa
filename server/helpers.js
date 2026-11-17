import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { db, logAudit } from './db.js';

export const uploadDirectory = path.resolve(process.cwd(), 'server/uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, callback) => callback(null, uploadDirectory),
  filename: (_, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const extension = path.extname(file.originalname).toLowerCase() || '.png';
    callback(null, `${uniqueSuffix}${extension}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Tipo de arquivo não suportado. Use JPG, PNG ou WEBP.'));
  },
});

export function sanitizeId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function removeUploadFile(urlPath) {
  if (!urlPath || !urlPath.startsWith('/uploads/')) return;
  const absolutePath = path.resolve(process.cwd(), urlPath.replace(/^\//, ''));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

/** Middleware de erro para rotas com upload. */
export function uploadErrorHandler(error, _, response, __) {
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ message: 'Arquivo inválido ou acima do limite de 5 MB.' });
  }
  if (error?.message?.includes('Tipo de arquivo')) {
    return response.status(400).json({ message: error.message });
  }
  console.error('Erro inesperado:', error);
  return response.status(500).json({ message: 'Não foi possível processar a solicitação.' });
}

export function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return JSON.parse(value).map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

export function touchAudit(user, action, entityType, entityId, entityName, detail) {
  logAudit(user?.id ?? null, action, entityType, entityId, entityName, detail);
}

export { db };
