import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMembers, fetchFamilies } from '../services/api';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', family: '', status: '', sort: 'nickname' });

  useEffect(() => {
    fetchFamilies({ status: 'all' }).then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMembers(filters)
      .then(setMembers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Membros</h1>
          <p>{members.length} registro(s)</p>
        </div>
        <div className="page-header__actions">
          <Link to="/membros/novo" className="button button--primary">+ Novo membro</Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Buscar vulgo, nome ou ID..."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.family} onChange={(event) => setFilters({ ...filters, family: event.target.value })}>
          <option value="">Família: todas</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>{family.name}</option>
          ))}
        </select>
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
          <option value="nickname">Ordenar: vulgo</option>
          <option value="family">Ordenar: família</option>
          <option value="recent">Ordenar: atualização</option>
        </select>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {loading ? (
        <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>
      ) : members.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhum membro encontrado</h3>
            <p>Ajuste os filtros ou registre um novo membro.</p>
            <Link to="/membros/novo" className="button button--primary">Cadastrar membro</Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Membro</th>
                <th>Família atual</th>
                <th>Cargo</th>
                <th>IDs</th>
                <th>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Link to={`/membros/${member.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                      {member.photo_path ? (
                        <img src={member.photo_path} alt="" className="table-avatar" />
                      ) : (
                        <div className="table-avatar family-card__logo--empty">{member.nickname.charAt(0).toUpperCase()}</div>
                      )}
                      <div>
                        <strong>{member.nickname}</strong>
                        {member.full_name && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{member.full_name}</div>}
                      </div>
                    </Link>
                  </td>
                  <td>
                    {member.current_family_id ? (
                      <Link to={`/familias/${member.current_family_id}`}>
                        {member.current_family_name}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>— sem vínculo —</span>
                    )}
                  </td>
                  <td>{member.current_role_name || '—'}</td>
                  <td className="mono">{member.server_ids || '—'}</td>
                  <td className="mono">{member.current_joined_on ? member.current_joined_on.split(' ')[0].split('-').reverse().join('/') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
