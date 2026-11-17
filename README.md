# Investigativa

Plataforma web de investigação e gestão de informações para servidores de GTA RP — banco de dados de famílias, membros, hierarquias, alianças e rivalidades.

Documentação do produto: [`PRD.md`](PRD.md)

## Stack

- **Front-end:** React 18 + Vite + React Router
- **Back-end:** Node.js + Express
- **Banco:** SQLite (better-sqlite3)
- **Uploads:** Multer (JPG/PNG/WEBP, até 5 MB)
- **Autenticação:** bcrypt + JWT em cookie httpOnly

## Como rodar (desenvolvimento)

```bash
npm install
npm run dev
```

- Front-end: http://localhost:5173
- API: http://localhost:3001/api

**Primeiro acesso:** usuário `admin` · senha `investigativa` (troque em Configurações → Usuários).

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta da API |
| `SESSION_SECRET` | valor de dev | Segredo de assinatura da sessão (obrigatório em produção) |
| `DATA_DIR` | `server/data` | Diretório do banco SQLite |
| `NODE_ENV` | — | `production` ativa o modo estático (serving do `dist/`) |

## Estrutura

```
server/
  db.js               # conexão, schema/migrações e carga inicial
  auth.js             # login, sessões e gestão de usuários
  helpers.js          # uploads, sanitização e erros
  routes/
    families.js       # famílias (+ logos, arquivamento)
    members.js        # membros, fotos e vínculos (histórico)
    roles.js          # cargos e reordenação da hierarquia
    relations.js      # alianças/rivalidades e evidências
    misc.js           # busca global, dashboard, auditoria, arquivo
src/
  components/         # Sidebar, Topbar, modais, badges
  context/            # autenticação e toasts
  pages/              # uma página por módulo
  services/api.js     # cliente HTTP
```

## Backup

O banco é um único arquivo (`server/data/investigativa.db`) + a pasta `server/uploads/`. Copie ambos para fazer backup.

## Roadmap

Fase 2 (produtos, investigações, mapa gráfico de relações) e fase 3 (relatórios, permissões granulares) estão definidos no PRD.
