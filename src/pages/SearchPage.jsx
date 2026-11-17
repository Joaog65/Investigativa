import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { globalSearch } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const TABS = [
  { key: 'members', label: 'Membros' },
  { key: 'families', label: 'Famílias' },
  { key: 'products', label: 'Produtos' },
  { key: 'relations', label: 'Relações' },
  { key: 'investigations', label: 'Investigações' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) {
      setResults({ families: [], members: [], relations: [], products: [], investigations: [] });
      return;
    }
    globalSearch(query)
      .then(setResults)
      .catch((err) => setError(err.message));
  }, [query]);

  const activeTab = results
    ? TABS.find((tab) => (results[tab.key] || []).length > 0)?.key || 'members'
    : 'members';

  const [selectedTab, setSelectedTab] = useState(activeTab);

  useEffect(() => {
    setSelectedTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Resultados da busca</h1>
          <p>Termo: <strong className="mono">"{query}"</strong></p>
        </div>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {!results ? (
        <div className="loading"><div className="spinner" />Buscando...</div>
      ) : (
        <>
          <div className="search-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`search-tab${selectedTab === tab.key ? ' search-tab--active' : ''}`}
                onClick={() => setSelectedTab(tab.key)}
              >
                {tab.label} ({(results[tab.key] || []).length})
              </button>
            ))}
          </div>

          {selectedTab === 'members' && (
            <div className="panel" style={{ padding: 0 }}>
              {results.members.length ? (
                results.members.map((member) => (
                  <Link key={member.id} to={`/membros/${member.id}`} className="result-item">
                    {member.photo_path ? (
                      <img src={member.photo_path} alt="" className="table-avatar" />
                    ) : (
                      <div className="table-avatar family-card__logo--empty">{member.nickname.charAt(0).toUpperCase()}</div>
                    )}
                    <div>
                      <strong>{member.nickname}</strong>
                      {member.full_name && <span style={{ color: 'var(--text-muted)' }}> · {member.full_name}</span>}
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
                        {member.current_family_name ? (
                          <>◈ {member.current_family_name}{member.current_role_name ? ` · ${member.current_role_name}` : ''}</>
                        ) : 'sem vínculo ativo'}
                        {member.server_ids && <> · <span className="mono">ID: {member.server_ids}</span></>}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto' }}><StatusBadge value={member.status} /></span>
                  </Link>
                ))
              ) : (
                <div className="empty-state"><p>Nenhum membro encontrado.</p></div>
              )}
            </div>
          )}

          {selectedTab === 'families' && (
            <div className="panel" style={{ padding: 0 }}>
              {results.families.length ? (
                results.families.map((family) => (
                  <Link key={family.id} to={`/familias/${family.id}`} className="result-item">
                    {family.logo_path ? (
                      <img src={family.logo_path} alt="" className="table-logo" />
                    ) : (
                      <div className="table-logo family-card__logo--empty">{family.name.charAt(0)}</div>
                    )}
                    <div>
                      <strong>{family.name}</strong>
                      {family.territory && <span style={{ color: 'var(--text-muted)' }}> · ⌖ {family.territory}</span>}
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{family.member_count} membro(s)</div>
                    </div>
                    <span style={{ marginLeft: 'auto' }}><StatusBadge value={family.status} /></span>
                  </Link>
                ))
              ) : (
                <div className="empty-state"><p>Nenhuma família encontrada.</p></div>
              )}
            </div>
          )}

          {selectedTab === 'products' && (
            <div className="panel" style={{ padding: 0 }}>
              {results.products?.length ? (
                results.products.map((product) => (
                  <Link key={product.id} to={`/familias/${product.family_id}`} className="result-item">
                    {product.photo_path ? (
                      <img src={product.photo_path} alt="" className="table-logo" />
                    ) : (
                      <div className="table-logo avatar--empty">▣</div>
                    )}
                    <div>
                      <strong>{product.name}</strong>
                      {product.price && <span className="mono" style={{ color: 'var(--accent-hover)' }}> · R$ {product.price}</span>}
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>◈ {product.family_name}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty-state"><p>Nenhum produto encontrado.</p></div>
              )}
            </div>
          )}

          {selectedTab === 'investigations' && (
            <div className="panel" style={{ padding: 0 }}>
              {results.investigations?.length ? (
                results.investigations.map((investigation) => (
                  <Link key={investigation.id} to={`/investigacoes/${investigation.id}`} className="result-item">
                    <div className="table-logo avatar--empty" style={{ display: 'grid', placeItems: 'center' }}>✦</div>
                    <div>
                      <strong>{investigation.title}</strong>
                      {investigation.family_name && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>◈ {investigation.family_name}</div>
                      )}
                    </div>
                    <span style={{ marginLeft: 'auto' }}><StatusBadge value={investigation.status} /></span>
                  </Link>
                ))
              ) : (
                <div className="empty-state"><p>Nenhuma investigação encontrada.</p></div>
              )}
            </div>
          )}

          {selectedTab === 'relations' && (
            <div className="panel" style={{ padding: 0 }}>
              {results.relations.length ? (
                results.relations.map((relation) => (
                  <Link key={relation.id} to={`/relacoes/${relation.id}`} className="result-item">
                    <StatusBadge value={relation.type} />
                    <div>
                      <strong>{relation.family_a_name}</strong> ⇄ <strong>{relation.family_b_name}</strong>
                    </div>
                    <span style={{ marginLeft: 'auto' }}>
                      <StatusBadge value={relation.is_active ? 'vigente' : 'encerrada'} />
                    </span>
                  </Link>
                ))
              ) : (
                <div className="empty-state"><p>Nenhuma relação encontrada.</p></div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
