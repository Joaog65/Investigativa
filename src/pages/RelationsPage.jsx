import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRelations } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function RelationsPage() {
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ type: '', status: 'vigente', search: '' });

  useEffect(() => {
    setLoading(true);
    fetchRelations(filters)
      .then(setRelations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Alianças e Rivalidades</h1>
          <p>{relations.length} registro(s)</p>
        </div>
        <div className="page-header__actions">
          <Link to="/relacoes/nova" className="button button--primary">+ Nova relação</Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Buscar famílias ou descrição..."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
          <option value="">Tipo: todos</option>
          <option value="alianca">Aliança</option>
          <option value="rivalidade">Rivalidade</option>
          <option value="neutralidade">Neutralidade</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="vigente">Status: vigentes</option>
          <option value="encerrada">Status: encerradas</option>
          <option value="">Status: todas</option>
        </select>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {loading ? (
        <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>
      ) : relations.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhuma relação encontrada</h3>
            <p>Registre alianças, rivalidades e neutralidades entre famílias.</p>
            <Link to="/relacoes/nova" className="button button--primary">Registrar relação</Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Famílias</th>
                <th>Status</th>
                <th>Início</th>
                <th>Evidências</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((relation) => (
                <tr key={relation.id}>
                  <td><StatusBadge value={relation.type} /></td>
                  <td>
                    <Link to={`/relacoes/${relation.id}`} style={{ color: 'var(--text-primary)' }}>
                      <strong>{relation.family_a_name}</strong> ⇄ <strong>{relation.family_b_name}</strong>
                    </Link>
                    {relation.exceptions && (
                      <div style={{ color: 'var(--warning)', fontSize: 12 }}>⚠ exceções registradas</div>
                    )}
                  </td>
                  <td><StatusBadge value={relation.is_active ? 'vigente' : 'encerrada'} /></td>
                  <td className="mono">{relation.started_on ? relation.started_on.split('-').reverse().join('/') : '—'}</td>
                  <td>{relation.evidence_count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
