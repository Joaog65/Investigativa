import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

const ACTION_LABELS = {
  create: 'criou',
  update: 'atualizou',
  archive: 'arquivou',
  restore: 'restaurou',
  login: 'entrou no sistema',
  seed: 'configurou',
  migrate: 'migrou',
};

const ENTITY_LABELS = {
  family: 'família',
  member: 'membro',
  membership: 'vínculo',
  relation: 'relação',
  role: 'cargo',
  user: 'usuário',
  product: 'produto',
  investigation: 'investigação',
  system: 'sistema',
};

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!data) return <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>;

  const { metrics, activities, recent_families, recent_investigations } = data;

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Bem-vindo, {user.display_name.split(' ')[0]}</h1>
          <p>Visão geral do banco de dados investigativo</p>
        </div>
        <div className="page-header__actions">
          <Link to="/familias/nova" className="button button--primary">+ Nova família</Link>
          <Link to="/membros/novo" className="button">+ Novo membro</Link>
          <Link to="/investigacoes/nova" className="button">+ Nova investigação</Link>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card__value">{metrics.families_active}</div>
          <div className="metric-card__label">Famílias ativas</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__value">{metrics.memberships_active}</div>
          <div className="metric-card__label">Membros vinculados</div>
        </div>
        <div className="metric-card metric-card--success">
          <div className="metric-card__value">{metrics.alliances}</div>
          <div className="metric-card__label">Alianças vigentes</div>
        </div>
        <div className="metric-card metric-card--danger">
          <div className="metric-card__value">{metrics.rivalries}</div>
          <div className="metric-card__label">Rivalidades vigentes</div>
        </div>
        <div className="metric-card">
          <div className="metric-card__value">{metrics.products}</div>
          <div className="metric-card__label">Produtos cadastrados</div>
        </div>
        <div className="metric-card metric-card--danger">
          <div className="metric-card__value">{metrics.investigations_open}</div>
          <div className="metric-card__label">Investigações abertas</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">
              <span>Famílias atualizadas recentemente</span>
              <Link to="/familias" style={{ fontSize: 11 }}>ver todas</Link>
            </div>
            {recent_families.length ? (
              <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {recent_families.map((family) => (
                  <Link to={`/familias/${family.id}`} className="family-card" key={family.id}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {family.logo_path ? (
                        <img src={family.logo_path} alt="" className="family-card__logo" />
                      ) : (
                        <div className="family-card__logo family-card__logo--empty">
                          {family.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="family-card__name">{family.name}</div>
                        <div className="family-card__meta">
                          <span>{family.member_count} membro(s)</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>Nenhuma família cadastrada</h3>
                <p>Registre a primeira organização para começar.</p>
                <Link to="/familias/nova" className="button button--primary">Cadastrar família</Link>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel__title">
              <span>Investigações recentes</span>
              <Link to="/investigacoes" style={{ fontSize: 11 }}>ver todas</Link>
            </div>
            {recent_investigations?.length ? (
              recent_investigations.map((investigation) => (
                <div className="activity-item" key={investigation.id}>
                  <div>
                    <Link to={`/investigacoes/${investigation.id}`}><strong>✦ {investigation.title}</strong></Link>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {investigation.family_name || 'sem organização'}
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto' }}><StatusBadge value={investigation.status} /></span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma investigação aberta ainda.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">
            <span>Atividades recentes</span>
            <Link to="/arquivo" style={{ fontSize: 11 }}>arquivo</Link>
          </div>
          {activities.length ? (
            activities.map((activity) => (
              <div className="activity-item" key={activity.id}>
                <div>
                  <div>
                    <strong>{activity.user_name || 'Sistema'}</strong>{' '}
                    {ACTION_LABELS[activity.action] || activity.action}{' '}
                    {ENTITY_LABELS[activity.entity_type] || activity.entity_type}{' '}
                    {activity.entity_name && activity.action !== 'login' && (
                      <Link to={
                        activity.entity_type === 'family' ? `/familias/${activity.entity_id}`
                          : activity.entity_type === 'member' ? `/membros/${activity.entity_id}`
                            : activity.entity_type === 'relation' ? `/relacoes/${activity.entity_id}`
                              : activity.entity_type === 'investigation' ? `/investigacoes/${activity.entity_id}`
                                : '#'
                      }>
                        {activity.entity_name}
                      </Link>
                    )}
                    {activity.detail && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{activity.detail}</div>
                    )}
                  </div>
                </div>
                <span className="activity-item__time" style={{ marginLeft: 'auto' }}>{formatTime(activity.created_at)}</span>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma atividade registrada ainda.</p>
          )}
        </div>
      </div>
    </>
  );
}
