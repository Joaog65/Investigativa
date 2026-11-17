import cors from 'cors';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cookieParser from 'cookie-parser';

import { initializeDatabase } from './db.js';
import { authRouter, usersRouter, profileRouter, requireAuth } from './auth.js';
import { uploadErrorHandler, uploadDirectory } from './helpers.js';
import familiesRouter from './routes/families.js';
import membersRouter from './routes/members.js';
import rolesRouter from './routes/roles.js';
import relationsRouter from './routes/relations.js';
import productsRouter from './routes/products.js';
import investigationsRouter from './routes/investigations.js';
import miscRouter from './routes/misc.js';

initializeDatabase();

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDirectory));

app.get('/api/health', (_, response) => {
  response.json({ ok: true, message: 'Sistema Investigativa funcionando corretamente.' });
});

// Rotas públicas
app.use('/api/auth', authRouter);

// Rotas autenticadas
app.use('/api/users', usersRouter);
app.use('/api/families', familiesRouter);
app.use('/api/members', membersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/relations', relationsRouter);
app.use('/api/products', productsRouter);
app.use('/api/investigations', investigationsRouter);
app.use('/api/profile', profileRouter);
app.use('/api', miscRouter);

// Segurança básica: qualquer outra rota /api exige autenticação
app.use('/api', requireAuth);

if (isProduction) {
  const distDirectory = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDirectory)) {
    app.use(express.static(distDirectory));
    app.get('*', (_, response) => response.sendFile(path.join(distDirectory, 'index.html')));
  }
}

// Tratamento de erros de upload
app.use('/api', uploadErrorHandler);

app.use((error, _, response, __) => {
  console.error('Erro inesperado no servidor:', error);
  return response.status(500).json({ message: 'Não foi possível processar a solicitação.' });
});

app.listen(port, () => {
  console.log(`Servidor Investigativa ouvindo na porta ${port}`);
});
