import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchArchive, restoreFamily, restoreMember, restoreRole, restoreRelation, restoreInvestigation } from '../services/api';
import { useToast } from '../context/ToastContext';

const TYPE_LABELS = { alianca: 'Aliança', rivalidade: 'Rivalidade', neutralidade: 'Neutralidade' };

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

export default function ArchivePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('families');
  const { notifyError, notifySuccess } = useToast();

  const load = () => {
    fetchArchive().then(setData).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!data) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const counts = {
    families: data.families.length,
    members: data.members.length,
    relations: data.relations.length,
    roles: data.roles.length,
    investigations: data.investigations?.length || 0,
  };

  const handleRestore = async (restoreFn, id, label) => {
    try {
      await restoreFn(id);
      notifySuccess(`${label} restaurado.`);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Arquivo</h1>
          <p>Registros arquivados — nada é apagado definitivamente</p>
        </div>
      </div>

      <div className="search-tabs">
        {[['families', 'Famílias'], ['members', 'Membros'], ['relations', 'Relações'], ['roles', 'Cargos'], ['investigations', 'Investigações']].map(([key, label]) => (
          <button
            key={key}
            className={`search-tab${tab === key ? ' search-tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {tab === 'families' && (
          data.families.length ? data.families.map((family) => (
            <div className="result-item" key={family.id}>
              <div>
                <Link to={`/familias/${family.id}`}><strong>{family.name}</strong></Link>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  arquivada em {formatDate(family.archived_at)}
                  {family.archived_info && <> · por {family.archived_info.user_name || 'sistema'}{family.archived_info.detail ? ` · ${family.archived_info.detail}` : ''}</>}
                </div>
              </div>
              <button className="button button--sm" style={{ marginLeft: 'auto' }} onClick={() => handleRestore(restoreFamily, family.id, 'Família')}>
                Restaurar
              </button>
            </div>
          )) : <div className="empty-state"><p>Nenhuma família arquivada.</p></div>
        )}

        {tab === 'members' && (
          data.members.length ? data.members.map((member) => (
            <div className="result-item" key={member.id}>
              <div>
                <Link to={`/membros/${member.id}`}><strong>{member.nickname}</strong></Link>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  arquivado em {formatDate(member.archived_at)}
                  {member.archived_info && <> · por {member.archived_info.user_name || 'sistema'}{member.archived_info.detail ? ` · ${member.archived_info.detail}` : ''}</>}
                </div>
              </div>
              <button className="button button--sm" style={{ marginLeft: 'auto' }} onClick={() => handleRestore(restoreMember, member.id, 'Membro')}>
                Restaurar
              </button>
            </div>
          )) : <div className="empty-state"><p>Nenhum membro arquivado.</p></div>
        )}

        {tab === 'relations' && (
          data.relations.length ? data.relations.map((relation) => (
            <div className="result-item" key={relation.id}>
              <div>
                <span className="badge badge--neutralidade">{TYPE_LABELS[relation.type] || relation.type}</span>{' '}
                <Link to={`/relacoes/${relation.id}`}>
                  <strong>{relation.family_a_name}</strong> ⇄ <strong>{relation.family_b_name}</strong>
                </Link>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>arquivada em {formatDate(relation.archived_at)}</div>
              </div>
              <button className="button button--sm" style={{ marginLeft: 'auto' }} onClick={() => handleRestore(restoreRelation, relation.id, 'Relação')}>
                Restaurar
              </button>
            </div>
          )) : <div className="empty-state"><p>Nenhuma relação arquivada.</p></div>
        )}

        {tab === 'roles' && (
          data.roles.length ? data.roles.map((role) => (
            <div className="result-item" key={role.id}>
              <div>
                <strong>{role.name}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>arquivado em {formatDate(role.archived_at)}</div>
              </div>
              <button className="button button--sm" style={{ marginLeft: 'auto' }} onClick={() => handleRestore(restoreRole, role.id, 'Cargo')}>
                Restaurar
              </button>
            </div>
          )) : <div className="empty-state"><p>Nenhum cargo arquivado.</p></div>
        )}

        {tab === 'investigations' && (
          (data.investigations?.length ? data.investigations.map((investigation) => (
            <div className="result-item" key={investigation.id}>
              <div>
                <span className="badge badge--encerrada">{investigation.status}</span>{' '}
                <Link to={`/investigacoes/${investigation.id}`}><strong>{investigation.title}</strong></Link>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  arquivada em {formatDate(investigation.archived_at)}
                  {investigation.archived_info && <> · por {investigation.archived_info.user_name || 'sistema'}</>}
                </div>
              </div>
              <button className="button button--sm" style={{ marginLeft: 'auto' }} onClick={() => handleRestore(restoreInvestigation, investigation.id, 'Investigação')}>
                Restaurar
              </button>
            </div>
          )) : <div className="empty-state"><p>Nenhuma investigação arquivada.</p></div>)
        )}
      </div>
    </>
  );
}
