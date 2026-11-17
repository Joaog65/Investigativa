# PRD — Investigativa
## Plataforma de Investigação e Gestão de Informações — GTA RP

| | |
|---|---|
| **Produto** | Investigativa |
| **Versão do documento** | 1.0 |
| **Data** | 17/11/2026 |
| **Status** | Aguardando aprovação |
| **Autor** | Equipe de produto (com o dono do projeto) |

---

## 1. Visão Geral do Produto

A **Investigativa** é uma plataforma web interna que funciona como um **banco de dados investigativo** para o contexto de um servidor de GTA RP. Ela permite organizar, consultar, relacionar e visualizar informações sobre famílias, organizações, membros, hierarquias, alianças, rivalidades, produtos e investigações — apresentando tudo em uma interface temática de sistema de inteligência, com tema escuro e estética de banco de dados confidencial.

A plataforma é usada por uma **equipe pequena de investigadores com acesso total**, priorizando **consulta rápida** durante o jogo e o registro estruturado de informações após eventos do RP.

### 1.1 Contexto atual

Existe um protótipo funcional (v1.0) neste repositório:

- **Front-end:** React 18 + Vite + React Router (`src/`)
- **Back-end:** Express + better-sqlite3 + Multer (`server/`)
- **Funcionalidades existentes:** cadastro/edição de organizações, upload de logotipo, listagem em cards, sidebar de navegação.

**Decisão:** o PRD considera esse código como ponto de partida. A arquitetura (React + Express + SQLite) é mantida e expandida com os novos módulos, dados e padrões descritos neste documento.

### 1.2 Problema que o sistema resolve

Hoje, as informações investigativas do servidor estão dispersas: anotações soltas, prints em pastas, memória dos jogadores. Isso causa:

- Perda de conhecimento quando alguém sai da equipe ou esquece detalhes.
- Impossibilidade de cruzar dados (quem é o líder da família X? quem são os aliados dela?).
- Falta de histórico: não há registro de quem informou o quê, nem quando.
- Dificuldade de visualizar a rede de relações entre organizações.

A Investigativa centraliza essas informações em um sistema único, relacionado, auditável e de consulta imediata.

### 1.3 Objetivos principais

1. Centralizar todo o conhecimento investigativo em um banco de dados estruturado e relacional.
2. Permitir **consulta rápida** (< 10 segundos) de qualquer família, membro, apelido ou ID durante o jogo.
3. Registrar a **autoria** de todas as alterações (quem criou, editou, arquivou).
4. Proteger os dados contra perda acidental (arquivamento com recuperação, backups).
5. Oferecer uma interface temática, moderna e profissional que reforce a experiência de "sistema de inteligência".
6. Ter uma arquitetura extensível que permita adicionar módulos futuros (produtos, investigações, mapa de relações) sem refazer o existente.

### 1.4 Público-alvo

| Perfil | Descrição | Uso principal |
|---|---|---|
| Investigador da equipe | Membros da equipe que jogam no servidor e documentam o que observam | Consulta rápida + registro pós-evento |
| Administrador | Responsável pela plataforma (também investigador) | Mesmo uso + gestão de usuários e configurações |

**Escopo de acesso (MVP):** todos os usuários autenticados têm acesso total de leitura e escrita. A diferenciação por papéis é funcionalidade futura (ver §13).

---

## 2. Requisitos Funcionais

### 2.1 Autenticação e usuários

| ID | Requisito |
|---|---|
| RF-01 | Login com usuário e senha; sessão persistente via cookie/token. |
| RF-02 | Senhas armazenadas com hash (bcrypt); nenhuma senha em texto puro. |
| RF-03 | Administrador cria/desativa usuários em tela de configuração. |
| RF-04 | Todas as ações de escrita registram o usuário autenticado como autor. |
| RF-05 | Tentativas de login limitadas (rate limit simples) para proteção básica. |

### 2.2 Famílias e Organizações

| ID | Requisito |
|---|---|
| RF-10 | CRUD de famílias: nome, logotipo (upload), descrição, data de fundação, território/área de atuação, status (ativa, inativa, dissolvida), observações investigativas. |
| RF-11 | Líder e vice-líder definidos por referência ao membro (dropdown com membros vinculados ativos). |
| RF-12 | Página individual da família exibe: identidade visual, dados cadastrais, membros ativos, membros passados (histórico), relações vigentes, produtos (fase 2), investigações (fase 2) e observações. |
| RF-13 | Listagem de famílias com busca, filtro por status e ordenação (nome, membros, data). |
| RF-14 | Arquivamento de família com confirmação; restauração pela tela de Arquivo. |

### 2.3 Membros

| ID | Requisito |
|---|---|
| RF-20 | CRUD de membros: foto (upload), nome completo (opcional), **vulgo/apelido (identificador principal)**, lista de IDs de servidor conhecidos (informativo, múltiplo), observações. |
| RF-21 | Vínculo membro ↔ família como **histórico**: cada vínculo tem família, cargo, data de entrada, data de saída (opcional), motivo da saída (opcional) e status (ativo, afastado, expulso, desaparecido). |
| RF-22 | A família atual é derivada do vínculo ativo; um membro pode ter vínculos passados com outras famílias, exibidos como linha do tempo no perfil. |
| RF-23 | Perfil do membro exibe: foto, identificação, vínculo atual, linha do tempo de vínculos, relações da família atual e observações. |
| RF-24 | Listagem de membros com busca (vulgo, nome, ID), filtros por família e status, e ordenação. |
| RF-25 | Vulgo único entre membros ativos (validação no cadastro; duplicata gera aviso de conflito). |

### 2.4 Hierarquia e Cargos

| ID | Requisito |
|---|---|
| RF-30 | Lista global de cargos personalizável: criar, editar, arquivar e **reordenar** (drag-and-drop ou botões subir/descer). |
| RF-31 | Cada cargo tem nome, nível hierárquico numérico (1 = topo) e descrição opcional. Exemplos iniciais (seed): Dono, Líder, Sub-líder, Gerente, Braço direito, Recrutador, Membro, Novato. |
| RF-32 | Um cargo só pode ser arquivado se não estiver em uso por vínculo ativo. |
| RF-33 | A hierarquia de cada família é visualizada na página da família, ordenada por nível, a partir dos vínculos ativos. |

### 2.5 Alianças e Rivalidades

| ID | Requisito |
|---|---|
| RF-40 | CRUD de relações: família A, família B, tipo (aliança, rivalidade, neutralidade), data de início, descrição, evidências (uploads), observações e status (vigente, encerrada*). |
| RF-41 | Relação é **mútua por padrão**: um registro vale para as duas famílias e aparece nas duas páginas. |
| RF-42 | Campo opcional de **exceções unilaterais** (texto estruturado por lado): ex. "B vê A como rival em segredo" — registrado e visível na página da relação. |
| RF-43 | **Apenas estado atual:** relação encerrada é marcada como inativa e não volta; nova relação substitui a anterior. Sem histórico de mudança de tipo no MVP. |
| RF-44 | Validação: impedir relação duplicada vigente entre o mesmo par de famílias; impedir relação de família com ela mesma. |
| RF-45 | Visualização das relações por família como lista de cards agrupados por tipo (alianças / rivalidades / neutras). O mapa gráfico de conexões é fase 2. |

> \* "Encerrada" é o estado final simples do MVP; o registro permanece visível no arquivo.

### 2.6 Pesquisa Global

| ID | Requisito |
|---|---|
| RF-50 | Barra de busca fixa no topo de todas as páginas. |
| RF-51 | Busca por texto livre com correspondência parcial (case-insensitive) em: vulgos, nomes, IDs de servidor, nomes de famílias, territórios, produtos (fase 2), títulos de investigações (fase 2) e observações. |
| RF-52 | Ao buscar, leva a uma **página de resultados** com abas por categoria (Famílias, Membros, Relações, Produtos, Investigação), snippets de contexto e filtros. |
| RF-53 | Resultados de membros incluem a família atual; resultados de famílias incluem contagem de membros. |

### 2.7 Auditoria e Arquivo

| ID | Requisito |
|---|---|
| RF-60 | Log central por evento: autor, ação (criou/editou/arquivou/restaurou/login), tipo e nome da entidade, timestamp. |
| RF-61 | Nenhuma exclusão definitiva: registros são **arquivados** (soft delete), somem das listas e podem ser restaurados. |
| RF-62 | Tela de Arquivo: lista de registros arquivados por tipo, com quem arquivou, quando e botão de restaurar. |
| RF-63 | Confirmação explícita (modal) antes de qualquer arquivamento. |
| RF-64 | Feed de atividades recentes no dashboard alimentado pelo log. |

### 2.8 Dashboard

| ID | Requisito |
|---|---|
| RF-70 | Cards de métricas: famílias ativas, membros ativos, alianças vigentes, rivalidades vigentes, investigações abertas (fase 2). |
| RF-71 | Atividades recentes (últimas ~10 entradas do log de auditoria). |
| RF-72 | Famílias recentemente atualizadas e investigações recentes (fase 2). |
| RF-73 | Acesso rápido: campo de busca destacado e atalhos para cadastros frequentes. |

---

## 3. Requisitos Não Funcionais

| ID | Requisito |
|---|---|
| RNF-01 | **Desempenho:** páginas principais carregam < 1s em rede local; buscas < 500ms com até ~5.000 registros. |
| RNF-02 | **Segurança:** bcrypt nas senhas; sessões com expiração; uploads com validação de tipo e tamanho (máx. 5 MB por imagem); rate limit no login; headers básicos de segurança. |
| RNF-03 | **Disponibilidade/backup:** o banco SQLite é um único arquivo versionável; rotina de backup (cópia agendada do arquivo + pasta de uploads) executada pelo administrador ou script. |
| RNF-04 | **Portabilidade:** nada em execução local pode impedir a migração para VPS — configuração por variáveis de ambiente (porta, segredo de sessão, caminho de dados), sem valores fixos em código. |
| RNF-05 | **Responsividade:** layout funcional em desktop e mobile (o uso durante o jogo tende a ocorrer em telas secundárias/celulares). |
| RNF-06 | **Usabilidade:** operações frequentes (buscar, abrir perfil) em no máximo 2 cliques a partir de qualquer página. |
| RNF-07 | **Manutenibilidade:** API REST consistente, camada de banco isolada, componentes React reutilizáveis; código organizado por domínio (famílias, membros, relações). |
| RNF-08 | **Acessibilidade:** contraste adequado no tema escuro, navegação por teclado na busca e formulários, labels associados a inputs. |
| RNF-09 | **Idioma:** toda a interface em português (pt-BR). |
| RNF-10 | **Privacidade:** plataforma de acesso restrito (login obrigatório em todas as rotas); nada é indexado por buscadores. |

---

## 4. Módulos — Descrição Detalhada

### 4.1 Dashboard
Página inicial pós-login. Estrutura:

- **Cabeçalho** com busca global destacada.
- **Linha de métricas** (cards): Famílias ativas · Membros ativos · Alianças vigentes · Rivalidades vigentes.
- **Coluna principal:** Atividades recentes (do log de auditoria) e Famílias atualizadas recentemente (cards com logotipo).
- **Coluna secundária:** Atalhos rápidos (Nova família, Novo membro, Nova relação) e, na fase 2, Investigações recentes.

### 4.2 Famílias e Organizações
- **Lista:** grid de cards (logotipo, nome, status, nº de membros, relações resumidas) + filtros por status e ordenação; alternativa em tabela (toggle).
- **Página da família:** hero com logo/nome/status/território; blocos de Membros ativos (por hierarquia), Membros passados, Relações (agrupadas por tipo, com evidências), Dados cadastrais, Observações investigativas (texto longo, com edição inline); histórico de alterações daquela família (do log).
- **Formulário:** criação/edição com upload de logo (drag-and-drop) e seleção de líder/vice a partir de membros vinculados.

### 4.3 Membros
- **Lista:** tabela densa (foto pequena, vulgo, nome, família atual, cargo, status, IDs) com filtros por família/status e busca; cards no mobile.
- **Perfil do membro:** foto grande, identificação (vulgo como título, nome e IDs como detalhes), status; **linha do tempo de vínculos** (família, cargo, período, motivo da saída); vínculo atual em destaque com link para a família; relações da família atual; observações; histórico de alterações do membro.
- **Formulário:** upload de foto; adicionar múltiplos IDs de servidor dinamicamente; gerenciar vínculos (criar vínculo novo = histórico; encerrar vínculo ativo = saída/expulsão com data e motivo).

### 4.4 Hierarquia e Cargos
- **Página de cargos:** lista ordenada por nível, com reordenação e criação/edição/arquivamento.
- **Visualização por família:** os vínculos ativos agrupados por cargo, do topo à base.
- Regras de uso em RF-30 a RF-33.

### 4.5 Alianças e Rivalidades
- **Lista:** tabela/todos os registros com filtros por tipo e status, e busca.
- **Página da relação:** famílias conectadas (com logos), tipo, data de início, descrição, **exceções unilaterais**, evidências (galeria de imagens), observações, autor.
- **Formulário:** seleção das duas famílias, tipo, evidências; validações de duplicidade.
- **Nas páginas das famílias:** relações vigentes agrupadas por tipo, com link para a relação.

### 4.6 Pesquisa Global
- Barra fixa no topo; Enter abre a página de resultados.
- Página de resultados com abas por categoria, contagem por aba, snippet de contexto ("Vulgo: X · Família: Y · Cargo: Z") e filtros por categoria.
- Detalhes em RF-50 a RF-53.

### 4.7 Arquivo (soft delete)
- Listagem por tipo de entidade (famílias, membros, relações, cargos).
- Mostra quem arquivou, quando e o motivo (opcional, coletado no modal de confirmação).
- Ação de restaurar devolve o registro às listas normalmente.

### 4.8 Configurações
- Usuários: criar, desativar, redefinir senha (somente administrador, no MVP qualquer usuário pode ser designado admin pelo próprio banco/config).
- Cargos (atalho para o módulo de hierarquia).
- Backup: botão para baixar cópia do banco + instruções de rotina.

---

## 5. Regras de Negócio

| ID | Regra |
|---|---|
| RN-01 | **Identidade:** o vulgo identifica a pessoa. IDs de servidor são atributos informativos e podem ser vários por membro; a busca deve localizar por qualquer ID conhecido. |
| RN-02 | **Vínculo:** um membro pode ter vários vínculos históricos, mas no máximo **um vínculo ativo por vez**. Encerrar o vínculo ativo exige data de saída (padrão: hoje) e motivo opcional. |
| RN-03 | **Hierarquia:** o cargo de um membro pertence ao **vínculo**, não à pessoa — ao trocar de família, o cargo é o do novo vínculo. |
| RN-04 | **Liderança:** líder e vice-líder da família devem ter vínculo ativo naquela família. |
| RN-05 | **Relações:** máx. 1 relação vigente por par de famílias (qualquer tipo). Relações são mútuas; exceções unilaterais são registradas na relação e não criam registros separados. |
| RN-06 | **Estado atual:** encerrar uma relação não apaga o registro — passa a status inativo e permanece consultável no Arquivo/na relação. |
| RN-07 | **Soft delete:** nada é apagado fisicamente. Registros arquivados não aparecem em listas, buscas nem métricas, mas permanecem vinculáveis para integridade histórica (ex.: vínculo antigo aponta para família arquivada). |
| RN-08 | **Integridade de arquivamento:** arquivar uma família com vínculos ativos exige escolha: encerrar automaticamente os vínculos ativos (data = hoje) ou bloquear até revisão. Sugestão: **encerrar automaticamente, deixando registrado no log**. |
| RN-09 | **Autoria:** toda criação, edição, arquivamento e restauração grava autor e timestamp; edições não guardam valor antigo/novo por campo no MVP (log por evento). |
| RN-10 | **Cargo:** um cargo em uso por vínculo ativo não pode ser arquivado. |
| RN-11 | **Uploads:** apenas imagens (jpg, png, webp), máx. 5 MB; nomes de arquivo sanitizados e únicos. |
| RN-12 | **Confirmação:** toda ação destrutiva (arquivar, encerrar vínculo, encerrar relação) exige modal de confirmação. |

---

## 6. Estrutura de Navegação

```
Sidebar (fixa, colapsável no mobile)
├── Dashboard                 → /
├── Investigação (grupo)
│   ├── Famílias              → /familias
│   ├── Membros               → /membros
│   ├── Relações              → /relacoes
│   └── Cargos                → /cargos
├── Fase 2 (visíveis mas desabilitadas)
│   ├── Produtos              → /produtos
│   ├── Investigação          → /investigacoes
│   └── Mapa de relações      → /mapa
├── Arquivo                   → /arquivo
└── Configurações             → /configuracoes
    └── Usuários              → /configuracoes/usuarios

Topbar (fixa em todas as páginas)
├── Busca global (input, Enter → /busca?q=...)
└── Usuário (nome + sair)

Rotas de detalhe
/familias/:id  /membros/:id  /relacoes/:id
/familias/nova /familias/:id/editar  ...
```

---

## 7. Fluxos de Usuário

### Fluxo 1 — Consulta rápida (uso principal)
1. Evento no RP → investigador abre a plataforma (mobile/segunda tela).
2. Digita o vulgo ou ID na barra fixa → Enter.
3. Aba "Membros" dos resultados → clica no membro.
4. Perfil mostra família atual, cargo e relações → clica na família se necessário.
5. Fim. **Alvo: 3 cliques a partir da home.**

### Fluxo 2 — Registrar novo membro pós-evento
1. Membros → "Novo membro" (ou atalho do dashboard).
2. Preenche vulgo (obrigatório), nome, IDs, foto (opcional, pode adicionar depois).
3. Cria vínculo: família, cargo, data de entrada (padrão hoje).
4. Salva → redireciona ao perfil; log registra a autoria.

### Fluxo 3 — Atualizar estrutura de família
1. Abre a família → bloco "Membros ativos".
2. Para saída: encerra vínculo (modal pede data e motivo: saiu/expulso/desapareceu).
3. Para mudança de cargo: edita o vínculo (cargo novo).
4. Se mudou a liderança: edita líder/vice na família (valida vínculo ativo).

### Fluxo 4 — Registrar aliança ou rivalidade
1. Relações → "Nova relação".
2. Seleciona as duas famílias, tipo, data de início, descrição, evidências.
3. Se houver, registra exceção unilateral em texto.
4. Salva → relação aparece nas páginas de ambas as famílias.

### Fluxo 5 — Arquivar e restaurar
1. Em qualquer registro → ação "Arquivar" → modal de confirmação (com motivo opcional).
2. Registro some das listas/métricas; evento vai para o log e para o Arquivo.
3. Arquivo → localiza o registro → "Restaurar" → volta às listas.

### Fluxo 6 — Primeiro acesso / migração
1. Administrador sobe a aplicação (local ou VPS) com variáveis de ambiente.
2. Cria usuários da equipe em Configurações.
3. Importa/seed de dados: cargos padrão e, opcionalmente, migração das organizações já existentes no banco do protótipo v1.0.

---

## 8. Estrutura do Banco de Dados

SQLite (better-sqlite3). Tabelas no padrão snake_case, chaves estrangeiras ativas, `archived_at` para soft delete.

```sql
-- ===== Acesso e auditoria =====
users (
  id            INTEGER PK,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)

audit_log (
  id          INTEGER PK,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,      -- create | update | archive | restore | login | ...
  entity_type TEXT NOT NULL,      -- family | member | membership | relation | role | user ...
  entity_id   INTEGER,
  entity_name TEXT,               -- snapshot do nome na hora do evento
  detail      TEXT,               -- resumo opcional ("encerrou vínculo: expulso")
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
-- índice: (created_at DESC), (entity_type, entity_id)

-- ===== Hierarquia =====
roles (
  id          INTEGER PK,
  name        TEXT UNIQUE NOT NULL,
  level       INTEGER NOT NULL,   -- 1 = topo; usado na ordenação
  description TEXT,
  archived_at TEXT
)

-- ===== Famílias =====
families (
  id          INTEGER PK,
  name        TEXT NOT NULL,
  logo_path   TEXT,
  description TEXT,
  founded_on  TEXT,               -- data de criação (in-ficção)
  territory   TEXT,
  status      TEXT NOT NULL DEFAULT 'ativa',  -- ativa | inativa | dissolvida
  leader_member_id    INTEGER REFERENCES members(id),
  vice_leader_member_id INTEGER REFERENCES members(id),
  observations TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  archived_at TEXT
)

-- ===== Membros =====
members (
  id          INTEGER PK,
  nickname    TEXT NOT NULL,      -- vulgo (identidade principal)
  full_name   TEXT,
  photo_path  TEXT,
  status      TEXT NOT NULL DEFAULT 'ativo',  -- ativo | afastado | expulso | desaparecido
  observations TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  archived_at TEXT
)

member_ids (                    -- múltiplos IDs de servidor (informativo)
  id         INTEGER PK,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  server_id  TEXT NOT NULL,
  UNIQUE(server_id)
)
-- índice em server_id para a busca global

-- ===== Vínculo (histórico membro ↔ família) =====
family_memberships (
  id          INTEGER PK,
  member_id   INTEGER NOT NULL REFERENCES members(id),
  family_id   INTEGER NOT NULL REFERENCES families(id),
  role_id     INTEGER REFERENCES roles(id),
  joined_on   TEXT NOT NULL,             -- data de entrada
  left_on     TEXT,                      -- nulo = vínculo ativo
  leave_reason TEXT,                     -- saiu | expulso | desapareceu | outro
  status      TEXT NOT NULL DEFAULT 'ativo',  -- ativo | afastado | expulso | desaparecido
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
-- regra RN-02 imposta na aplicação: 1 vínculo ativo por membro
-- índice: (member_id), (family_id)

-- ===== Relações entre famílias =====
relations (
  id          INTEGER PK,
  family_a_id INTEGER NOT NULL REFERENCES families(id),
  family_b_id INTEGER NOT NULL REFERENCES families(id),
  type        TEXT NOT NULL,      -- alianca | rivalidade | neutralidade
  started_on  TEXT,
  description TEXT,
  exceptions  TEXT,               -- exceções unilaterais (RN-05)
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
)
-- índice: (family_a_id), (family_b_id), (type) WHERE is_active=1

-- ===== Evidências genéricas (extensível p/ fase 2) =====
attachments (
  id          INTEGER PK,
  entity_type TEXT NOT NULL,      -- relation | family | member | investigation...
  entity_id   INTEGER NOT NULL,
  file_path   TEXT NOT NULL,
  caption     TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
-- índice: (entity_type, entity_id)
```

### Tabelas futuras (fase 2, apenas previstas no PRD)

```sql
products (name, photo_path, description, category, family_id, value,
          availability, observations, ...)

investigations (title, description, family_id, status, investigation_date, ...)
investigation_members (investigation_id, member_id, envolvimento)
```

O design de `attachments` e `audit_log` já cobre investigações e produtos sem mudanças estruturais — novos módulos adicionam tabelas próprias e reaproveitam esses serviços.

### Diagrama de relacionamentos (MVP)

```
users 1──* audit_log
users 1──* (created_by em families, members, relations, memberships)

roles 1──* family_memberships *──1 members
families 1──* family_memberships *──1 members
families 1──1 members (leader, vice_leader)
families 1──* relations *──1 families (par A-B)
attachments *──1 (families | members | relations)  [polimórfico]
```

---

## 9. Sistema de Permissões

**MVP:** modelo simples de dois papéis, em linha com a decisão de equipe pequena com acesso total.

| Ação | user | admin |
|---|---|---|
| Ver qualquer informação | ✅ | ✅ |
| Criar/editar registros | ✅ | ✅ |
| Arquivar/restaurar | ✅ | ✅ |
| Gerenciar usuários | ❌ | ✅ |
| Configurações/backup | ❌ | ✅ |

- Toda ação registrada em `audit_log` com autoria (RN-09).
- Rotas de escrita exigem sessão válida; rotas de administração exigem `role = admin`.
- **Evolução futura (fase 3):** papéis Investigador/Visualizador com permissões granulares por módulo, já previsto na coluna `role` e na estrutura do log.

---

## 10. Diretrizes de UX/UI

### 10.1 Conceito
"Sistema de inteligência confidencial" — sóbrio, denso em informação, elegante. Referências: bancos de dados criminais fictícios, painéis de inteligência, terminais de investigação.

### 10.2 Tema visual

| Elemento | Definição |
|---|---|
| Fundo | Preto/azul muito escuro (`#0b0e14` base, `#11151d` superfícies) |
| Painéis/cards | Cinza-escuro (`#161b26`) com borda sutil (`#232a38`) |
| Texto | Branco-gelo (`#e8ecf4`) e cinza (`#8b93a7`) para secundários |
| Acento primário | Azul elétrico (`#3b82f6`) — ações, links, foco |
| Acento crítico | Vermelho (`#ef4444`) — rivalidades, alertas, ações destrutivas |
| Acento positivo | Verde discreto (`#22c55e`) — alianças, status ativo |
| Tags de status | Pill colorida por status (ativa/inativa/dissolvida/expulso...) |
| Tipografia | Sans moderna para UI (ex.: Inter); mono para IDs e dados técnicos (ex.: JetBrains Mono) |
| Ícones | Lucide Icons (linha fina, coerente com o tema) |
| Animações | Discretas: transições de 150–200 ms, fade/slide em modais e listas; sem animações longas |
| Detalhes temáticos | Textura sutil, cabeçalhos com marca "CONFIDENCIAL"/classificação, linhas de varredura discretas em elementos-chave — sempre como detalhe, nunca interferindo na leitura |

### 10.3 Padrões de layout
- **Sidebar** fixa à esquerda (desktop), colapsável em gaveta (mobile).
- **Topbar** com busca global fixa em todas as páginas.
- **Cards** para entidades visuais (famílias), **tabelas densas** para dados tabulares (membros, relações).
- **Página de detalhe** em blocos escaneáveis: identidade → contexto (membros/relações) → observações → histórico.
- **Formulários:** campos com labels claros, upload com drag-and-drop e preview, validação inline.
- **Estados vazios** ilustrados e orientados à ação ("Nenhuma família cadastrada — adicionar a primeira").
- **Feedback:** toasts para sucesso/erro; modais de confirmação com tom de gravidade para ações destrutivas.

### 10.4 Responsividade
- Desktop: sidebar + grid de 12 colunas.
- Tablet/mobile: sidebar em gaveta, cards empilhados, tabelas viram cards ou tabela com scroll horizontal, busca global permanece acessível no topo.

---

## 11. Definição do MVP

**MVP = Núcleo investigativo** (decisão do dono do produto):

| Incluído no MVP | Postergado |
|---|---|
| Login + usuários básicos | Permissões granulares por módulo |
| Dashboard com métricas e atividades | Produtos |
| Famílias (completo, RF-10 a RF-14) | Módulo de investigação e evidências |
| Membros com histórico de vínculos (RF-20 a RF-25) | Mapa gráfico de relações |
| Hierarquia/cargos personalizáveis (RF-30 a RF-33) | Exportação de relatórios |
| Alianças e rivalidades com exceções (RF-40 a RF-45) | Busca full-text (FTS5) e busca inteligente avançada |
| Pesquisa global: barra + página de resultados (RF-50 a RF-53) | Notificações/alertas |
| Arquivo (soft delete) + log de auditoria (RF-60 a RF-64) | Importação em massa / integrações |
| Migração dos dados do protótipo v1.0 | Tema claro / customização de tema |

**Critério de pronto do MVP:** um investigador consegue, sem ajuda, registrar a estrutura completa de uma família (membros, cargos, relações) e recuperar qualquer informação em ≤ 3 cliques; todas as ações estão registradas com autoria; nenhum dado é perdido por exclusão acidental.

---

## 12. Funcionalidades Futuras (Roadmap)

### Fase 2 — Produtos e Investigação
- Catálogo de produtos (nome, foto, categoria, família responsável, valor, disponibilidade, observações) integrado às páginas de família e à busca.
- Módulo de investigações: título, descrição, organização relacionada, pessoas envolvidas, responsável, evidências/arquivos, anotações cronológicas, status (aberta, em andamento, encerrada).
- **Mapa gráfico de relações**: grafo interativo (famílias como nós, relações como arestas coloridas por tipo; clique para foco/filtragem).
- Busca full-text com SQLite FTS5 (tolerante a erros de digitação).

### Fase 3 — Gestão e escala
- Relatórios/exportação (PDF do perfil de família/membro, CSV das tabelas).
- Permissões granulares (Investigador/Visualizador) por módulo.
- Diff campo a campo no log de auditoria.
- Histórico de mudanças de tipo nas relações (versão "registro único mutável").
- Notificações internas (ex.: "nova rivalidade registrada").
- Painéis analíticos (evolução de membros por família, rede mais conectada).
- Migração formal para VPS com HTTPS, domínio e backups automatizados.
- API para integrações futuras (bot do Discord para consulta rápida).

---

## 13. Critérios de Aceitação

### Autenticação
- [ ] Login obrigatório; rota protegida redireciona para `/login`.
- [ ] Senha com hash bcrypt; rate limit bloqueia força bruta simples.
- [ ] Admin cria/desativa usuários; usuário desativado perde acesso na próxima requisição.

### Famílias
- [ ] Criar família com logo, dados obrigatórios mínimos (nome); aparece na lista e no dashboard.
- [ ] Líder/vice só aceita membro com vínculo ativo (validação impede o contrário).
- [ ] Página da família exibe membros por hierarquia, relações vigentes e histórico de alterações.
- [ ] Arquivar pede confirmação; família some das listas/métricas e volta ao restaurar.

### Membros
- [ ] Vulgo duplicado em membros ativos dispara aviso de conflito.
- [ ] Criar membro com vínculo; família atual aparece no perfil e na família.
- [ ] Encerrar vínculo exige data e motivo; membro passa a exibir o vínculo encerrado na linha do tempo.
- [ ] Buscar por qualquer ID de servidor conhecido localiza o membro.
- [ ] Recriar vínculo com outra família funciona e a linha do tempo mostra os dois períodos.

### Hierarquia
- [ ] Criar/editar/reordenar/arquivar cargos; reordenar reflete na exibição da família.
- [ ] Cargo em uso não pode ser arquivado (mensagem clara).

### Relações
- [ ] Criar relação entre duas famílias; aparece nas duas páginas, agrupada por tipo.
- [ ] Duplicata vigente do mesmo par é bloqueada; relação de família com ela mesma é bloqueada.
- [ ] Exceção unilateral é registrada e visível na página da relação.
- [ ] Encerrar relação marca inativa; nova relação entre o par passa a ser permitida.

### Pesquisa global
- [ ] Barra presente em todas as páginas; Enter abre resultados com abas por categoria e contagens.
- [ ] Busca localiza por vulgo, nome, ID, nome de família e território, com correspondência parcial e sem sensibilidade a maiúsculas.
- [ ] Resultado de membro mostra família atual; clicar abre o perfil.

### Auditoria e Arquivo
- [ ] Toda ação de escrita gera log com autor, ação, entidade e timestamp.
- [ ] Feed do dashboard reflete o log em ordem inversa.
- [ ] Arquivo lista arquivados por tipo com autor/data e restaura corretamente.

### Não funcionais
- [ ] Busca e páginas respondem dentro dos limites de RNF-01 com dados de teste realistas.
- [ ] Layout utilizável em 375 px (mobile) e 1440 px (desktop).
- [ ] Aplicação roda apenas com variáveis de ambiente (porta, segredo, caminhos) — nenhuma configuração fixa em código.

---

## 14. Sugestão de Tecnologias

**Mantidas do protótipo (decisão):**

| Camada | Tecnologia | Papel |
|---|---|---|
| Front-end | React 18 + Vite + React Router 6 | SPA com rotas por módulo |
| Back-end | Node.js + Express 4 | API REST sob `/api` |
| Banco | SQLite (better-sqlite3) | Dados relacionais em arquivo único, fácil backup/migração |
| Uploads | Multer | Upload e validação de imagens |
| Serviço | concurrently | `npm run dev` (server + client) |

**A adicionar no MVP:**

| Necessidade | Sugestão |
|---|---|
| Estilo/tema escuro consistente | Tailwind CSS (ou continuidade do `index.css` atual com design tokens em variáveis CSS) |
| Ícones | lucide-react |
| Autenticação | express-session + cookie (mesma origem) ou JWT; bcrypt para hash |
| Validação | zod (compartilhável entre rotas) |
| Rate limit | express-rate-limit (login) |
| Gráficos (fase 2) | recharts (dashboard) e vis.js / d3-force (mapa de relações) |
| Migrações de schema | script de migrações versionadas simples (SQL numerado) sobre o better-sqlite3 |

**Migração local → VPS:** mesma stack, process manager (pm2), Nginx como reverse proxy com HTTPS (Let's Encrypt), variáveis de ambiente por ambiente, backups agendados do arquivo do banco + pasta `uploads`.

---

## 15. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Exclusões acidentais perdem investigações | Alto | Soft delete + backups (RN-07, RNF-03) |
| Vulgo duplicado gera registros fantasmas | Médio | Validação de unicidade + aviso de conflito (RF-25) |
| IDs de servidor mudando confundem identidade | Médio | Vulgo como identidade; IDs como lista informativa (RN-01) |
| Dados inconsistentes após arquivar família com vínculos ativos | Médio | RN-08: encerramento automático registrado em log |
| Crescimento desorganizado de módulos futuros | Médio | `attachments`/`audit_log` polimórficos; migrações versionadas; API por domínio |
| Migração local → VPS quebrar por hardcode | Médio | RNF-04: configuração 100% por variáveis de ambiente |

---

## 16. Próximos Passos

1. **Aprovar este PRD** (ajustes pontuais conforme feedback).
2. Planejar as tarefas de implementação do MVP a partir da §11.
3. Ordem sugerida de construção: autenticação → schema/migrações + carga do protótipo → famílias → membros/vínculos → cargos → relações → busca global → arquivo/auditoria → dashboard → refinamento visual.
4. O desenvolvimento em si será iniciado após a troca para o agente de execução (build), conforme fluxo do ambiente.
