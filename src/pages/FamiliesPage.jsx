import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchFamilies } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function FamiliesPage() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'ativas', search: '', sort: 'name' });
  const [view, setView] = useState('cards');

  useEffect(() => {
    setLoading(true);
    fetchFamilies(filters)
      .then(setFamilies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Famílias e Organizações</h1>
          <p>{families.length} registro(s)</p>
        </div>
        <div className="page-header__actions">
          <button className="button button--sm" onClick={() => setView(view === 'cards' ? 'table' : 'cards')}>
            {view === 'cards' ? '◫ Ver tabela' : '▦ Ver cards'}
          </button>
          <Link to="/familias/nova" className="button button--primary">+ Nova família</Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Buscar por nome, território..."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="ativas">Status: ativas</option>
          <option value="inativa">Status: inativas</option>
          <option value="all">Status: todas</option>
        </select>
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
          <option value="name">Ordenar: nome</option>
          <option value="members">Ordenar: membros</option>
          <option value="recent">Ordenar: atualização</option>
        </select>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {loading ? (
        <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>
      ) : families.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhuma família encontrada</h3>
            <p>Ajuste os filtros ou registre uma nova organização.</p>
            <Link to="/familias/nova" className="button button--primary">Cadastrar família</Link>
          </div>
        </div>
      ) : view === 'cards' ? (
        <div className="card-grid">
          {families.map((family) => (
            <Link to={`/familias/${family.id}`} className="family-card" key={family.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {family.logo_path ? (
                  <img src={family.logo_path} alt="" className="family-card__logo" />
                ) : (
                  <div className="family-card__logo family-card__logo--empty">
                    {family.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="family-card__name">{family.name}</div>
                  <div className="family-card__meta">
                    <StatusBadge value={family.status} />
                  </div>
                </div>
              </div>
              <div className="family-card__meta">
                <span>◈ {family.member_count} membro(s)</span>
                <span>▣ {family.product_count ?? 0} produto(s)</span>
                <span>⇄ {family.relation_count} relação(ões)</span>
                {family.leader_nickname && <span>♛ {family.leader_nickname}</span>}
                {family.territory && <span>⌖ {family.territory}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Família</th>
                <th>Status</th>
                <th>Membros</th>
                <th>Relações</th>
                <th>Líder</th>
                <th>Território</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <tr key={family.id}>
                  <td>
                    <Link to={`/familias/${family.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                      {family.logo_path ? (
                        <img src={family.logo_path} alt="" className="table-logo" />
                      ) : (
                        <div className="table-logo family-card__logo--empty">{family.name.charAt(0)}</div>
                      )}
                      <strong>{family.name}</strong>
                    </Link>
                  </td>
                  <td><StatusBadge value={family.status} /></td>
                  <td>{family.member_count}</td>
                  <td>{family.relation_count}</td>
                  <td>{family.leader_nickname || '—'}</td>
                  <td>{family.territory || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
