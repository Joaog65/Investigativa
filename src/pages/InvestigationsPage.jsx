import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchInvestigations, fetchFamilies } from '../services/api';
import StatusBadge from '../components/StatusBadge';

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', family: '', search: '', sort: 'status' });

  useEffect(() => {
    fetchFamilies({ status: 'all' }).then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchInvestigations(filters)
      .then(setInvestigations)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Investigações</h1>
          <p>Casos abertos, em andamento e encerrados — {investigations.length} registro(s)</p>
        </div>
        <div className="page-header__actions">
          <Link to="/investigacoes/nova" className="button button--primary">+ Nova investigação</Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Buscar título ou descrição..."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Status: todos</option>
          <option value="aberta">Aberta</option>
          <option value="em_andamento">Em andamento</option>
          <option value="encerrada">Encerrada</option>
        </select>
        <select value={filters.family} onChange={(event) => setFilters({ ...filters, family: event.target.value })}>
          <option value="">Família: todas</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>{family.name}</option>
          ))}
        </select>
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
          <option value="status">Ordenar: status</option>
          <option value="recent">Ordenar: atualização</option>
          <option value="created">Ordenar: criação</option>
          <option value="title">Ordenar: título</option>
        </select>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {loading ? (
        <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>
      ) : investigations.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhuma investigação registrada</h3>
            <p>Abra um caso para documentar evidências, pessoas envolvidas e anotações.</p>
            <Link to="/investigacoes/nova" className="button button--primary">Abrir investigação</Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Investigação</th>
                <th>Status</th>
                <th>Família</th>
                <th>Pessoas</th>
                <th>Evidências</th>
                <th>Anotações</th>
                <th>Atualização</th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((investigation) => (
                <tr key={investigation.id}>
                  <td>
                    <Link to={`/investigacoes/${investigation.id}`} style={{ color: 'var(--text-primary)' }}>
                      <strong>{investigation.title}</strong>
                    </Link>
                    {investigation.investigation_date && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        data do caso: {formatDate(investigation.investigation_date)}
                      </div>
                    )}
                  </td>
                  <td><StatusBadge value={investigation.status} /></td>
                  <td>
                    {investigation.family_id ? (
                      <Link to={`/familias/${investigation.family_id}`}>{investigation.family_name}</Link>
                    ) : '—'}
                  </td>
                  <td>{investigation.member_count}</td>
                  <td>{investigation.evidence_count}</td>
                  <td>{investigation.note_count}</td>
                  <td className="mono">{formatDate(investigation.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
