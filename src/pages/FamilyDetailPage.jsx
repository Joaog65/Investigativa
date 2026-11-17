import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  fetchFamily, archiveFamily, restoreFamily,
  fetchProducts, createProduct, updateProduct, deleteProduct, uploadProductPhoto,
  uploadFamilyPhotos, deleteFamilyPhoto,
  fetchInvestigations,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import Lightbox from '../components/Lightbox';
import { useToast } from '../context/ToastContext';

const TABS = [
  ['overview', 'Visão geral'],
  ['members', 'Membros'],
  ['hierarchy', 'Hierarquia'],
  ['products', 'Produtos'],
  ['relations', 'Alianças e rivalidades'],
  ['location', 'Localização e QG'],
  ['investigations', 'Investigações'],
  ['observations', 'Observações'],
];

const PHOTO_CATEGORIES = [
  ['localizacao', 'Localização'],
  ['qg_fachada', 'QG — fachada'],
  ['qg_interna', 'QG — interno'],
  ['territorio', 'Território'],
  ['veiculos', 'Veículos'],
  ['outros', 'Outros'],
];

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

function EmptyHint({ children }) {
  return <p style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}

export default function FamilyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useToast();

  const [family, setFamily] = useState(null);
  const [products, setProducts] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Arquivamento
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // Produtos
  const [productModal, setProductModal] = useState(null); // {id?, name, description, category, price}
  const [productPhoto, setProductPhoto] = useState(null);
  const [productDeleteTarget, setProductDeleteTarget] = useState(null);

  // Fotos localização/QG
  const [photoCategory, setPhotoCategory] = useState('localizacao');
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const load = () => {
    fetchFamily(id).then(setFamily).catch((err) => setError(err.message));
    fetchProducts({ family: id }).then(setProducts).catch(() => {});
    fetchInvestigations({ family: id, sort: 'recent' }).then(setInvestigations).catch(() => {});
  };

  useEffect(load, [id]);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!family) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const isArchived = Boolean(family.archived_at);
  const relationsByType = family.relations.reduce((acc, relation) => {
    (acc[relation.type] = acc[relation.type] || []).push(relation);
    return acc;
  }, {});

  const photoGroups = PHOTO_CATEGORIES.map(([key, label]) => ({
    key,
    label,
    photos: family.attachments.filter((attachment) => (attachment.category || 'outros') === key),
  }));
  const allPhotos = family.attachments;

  // ===== Ações =====
  const handleArchive = async () => {
    try {
      await archiveFamily(id, archiveReason);
      notifySuccess('Família arquivada.');
      setArchiveOpen(false);
      navigate('/familias');
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreFamily(id);
      notifySuccess('Família restaurada.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleSaveProduct = async () => {
    try {
      let productId;
      if (productModal.id) {
        await updateProduct(productModal.id, productModal);
        productId = productModal.id;
      } else {
        const created = await createProduct({ ...productModal, family_id: Number(id) });
        productId = created.id;
      }
      if (productPhoto) await uploadProductPhoto(productId, productPhoto);
      notifySuccess(productModal.id ? 'Produto atualizado.' : 'Produto cadastrado.');
      setProductModal(null);
      setProductPhoto(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteProduct = async () => {
    try {
      await deleteProduct(productDeleteTarget.id);
      notifySuccess('Produto excluído.');
      setProductDeleteTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUploadPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploadingPhotos(true);
    try {
      await uploadFamilyPhotos(id, files, photoCategory);
      notifySuccess('Fotos adicionadas à galeria.');
      load();
    } catch (err) {
      notifyError(err.message);
    } finally {
      setUploadingPhotos(false);
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (attachmentId) => {
    try {
      await deleteFamilyPhoto(attachmentId);
      notifySuccess('Foto removida.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const openLightboxFrom = (photos, localIndex) => {
    const photoId = photos[localIndex].id;
    setLightboxIndex(allPhotos.findIndex((photo) => photo.id === photoId));
  };

  // ===== Abas =====
  const renderOverview = (
    <>
      <div className="detail-hero">
        {family.logo_path ? (
          <img src={family.logo_path} alt="" className="detail-hero__logo" />
        ) : (
          <div className="detail-hero__logo detail-hero__logo--empty">
            {family.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="detail-hero__title">
            {family.name} <StatusBadge value={family.status} />
            {isArchived && <span className="badge badge--encerrada">Arquivada</span>}
          </div>
          <div className="detail-hero__meta">
            {family.territory && <span>⌖ {family.territory}</span>}
            {family.location_name && <span>⌂ {family.location_name}</span>}
            {family.founded_on && <span>criada em {formatDate(family.founded_on)}</span>}
          </div>
          {family.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 10, marginBottom: 0 }}>
              {family.description}
            </p>
          )}
          <div className="overview-stats">
            <div className="overview-stat">
              <div className="overview-stat__value">{family.member_count}</div>
              <div className="overview-stat__label">Membros</div>
            </div>
            <div className="overview-stat">
              <div className="overview-stat__value">{products.length}</div>
              <div className="overview-stat__label">Produtos</div>
            </div>
            <div className="overview-stat">
              <div className="overview-stat__value">{family.relation_count}</div>
              <div className="overview-stat__label">Relações</div>
            </div>
            <div className="overview-stat">
              <div className="overview-stat__value">{allPhotos.length}</div>
              <div className="overview-stat__label">Fotos</div>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="panel__title">Liderança</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Líder:</span>{' '}
              {family.leader_member_id ? (
                <Link to={`/membros/${family.leader_member_id}`}>{family.leader_nickname}</Link>
              ) : '—'}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Vice-líder:</span>{' '}
              {family.vice_leader_member_id ? (
                <Link to={`/membros/${family.vice_leader_member_id}`}>
                  {family.active_members.find((m) => m.member_id === family.vice_leader_member_id)?.nickname || `#${family.vice_leader_member_id}`}
                </Link>
              ) : '—'}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Coordenadas:</span>{' '}
              {family.coordinates ? <span className="mono">{family.coordinates}</span> : '—'}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Alianças vigentes</div>
          {family.relations.some((relation) => relation.is_active && relation.type === 'alianca') ? (
            family.relations.filter((relation) => relation.is_active && relation.type === 'alianca').map((relation) => {
              const other = relation.family_a_id === family.id ? relation.family_b_name : relation.family_a_name;
              return (
                <Link key={relation.id} to={`/relacoes/${relation.id}`} className="relation-row">
                  <span className="relation-row__families">{other}</span>
                </Link>
              );
            })
          ) : (
            <EmptyHint>Nenhuma aliança vigente.</EmptyHint>
          )}
        </div>
      </div>
    </>
  );

  const renderMembers = (
    <>
      <div className="panel">
        <div className="panel__title">
          <span>Membros atuais ({family.active_members.length})</span>
          <Link to={`/membros?family=${id}`} style={{ fontSize: 11 }}>ver na lista de membros</Link>
        </div>
        {family.active_members.length ? (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr><th>Membro</th><th>Entrada</th><th></th></tr>
              </thead>
              <tbody>
                {family.active_members.map((member) => (
                  <tr key={member.membership_id}>
                    <td>
                      <Link to={`/membros/${member.member_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                        {member.photo_path ? (
                          <img src={member.photo_path} alt="" className="table-avatar" />
                        ) : (
                          <div className="table-avatar avatar--empty">{member.nickname.charAt(0).toUpperCase()}</div>
                        )}
                        <strong>{member.nickname}</strong>
                        {member.full_name && <span style={{ color: 'var(--text-muted)' }}>{member.full_name}</span>}
                      </Link>
                    </td>
                    <td className="mono">{formatDate(member.joined_on)}</td>
                    <td>{member.role_name || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyHint>Nenhum membro vinculado.</EmptyHint>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__title">Membros passados ({family.past_members.length})</div>
        {family.past_members.length ? (
          <table style={{ fontSize: 13 }}>
            <tbody>
              {family.past_members.map((member) => (
                <tr key={member.membership_id}>
                  <td>
                    <Link to={`/membros/${member.member_id}`} style={{ color: 'var(--text-primary)' }}>
                      <strong>{member.nickname}</strong>
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{member.role_name || '—'}</td>
                  <td className="mono">
                    {formatDate(member.joined_on)} → {formatDate(member.left_on)}
                  </td>
                  <td>
                    {member.leave_reason === 'expulso' && <span className="badge badge--expulso">Expulso</span>}
                    {member.leave_reason === 'saiu' && <span className="badge badge--neutralidade">Saiu</span>}
                    {member.leave_reason === 'desapareceu' && <span className="badge badge--desaparecido">Desapareceu</span>}
                    {(!member.leave_reason || member.leave_reason === 'outro') && <span className="badge badge--encerrada">Encerrado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyHint>Nenhum histórico de saídas.</EmptyHint>
        )}
      </div>
    </>
  );

  const renderHierarchy = (
    <div className="panel">
      <div className="panel__title">Hierarquia atual (topo → base)</div>
      {family.active_members.length ? (
        family.active_members.map((member) => (
          <div className="relation-row" key={member.membership_id}>
            <span className="mono" style={{ width: 26 }}>{member.role_level ?? '—'}</span>
            <Link to={`/membros/${member.member_id}`} style={{ color: 'var(--text-primary)', flex: 1 }}>
              <strong>{member.nickname}</strong>
            </Link>
            <span style={{ color: 'var(--text-secondary)' }}>{member.role_name || 'sem cargo'}</span>
          </div>
        ))
      ) : (
        <EmptyHint>Nenhum membro vinculado.</EmptyHint>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
        Cargos são gerenciados em <Link to="/cargos">Cargos</Link> e definidos por vínculo no perfil de cada membro.
      </p>
    </div>
  );

  const renderProducts = (
    <div className="panel">
      <div className="panel__title">
        <span>Catálogo exclusivo da família ({products.length})</span>
        {!isArchived && (
          <button
            className="button button--sm button--primary"
            onClick={() => {
              setProductModal({ id: null, name: '', description: '', category: '', price: '' });
              setProductPhoto(null);
            }}
          >
            + Novo produto
          </button>
        )}
      </div>
      {products.length ? (
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {products.map((product) => (
            <div className="product-card" key={product.id}>
              <div
                className="product-card__photo"
                onClick={() => product.photo_path && window.open(product.photo_path, '_blank')}
              >
                {product.photo_path ? <img src={product.photo_path} alt={product.name} /> : '▣'}
              </div>
              <div className="product-card__body">
                <div className="product-card__name">{product.name}</div>
                {product.price && <div className="product-card__price">R$ {product.price}</div>}
                {product.category && <div className="product-card__meta">{product.category}</div>}
                {product.description && <div className="product-card__desc">{product.description}</div>}
              </div>
              {!isArchived && (
                <div className="product-card__actions">
                  <button
                    className="button button--sm"
                    onClick={() => {
                      setProductModal({
                        id: product.id,
                        name: product.name,
                        description: product.description || '',
                        category: product.category || '',
                        price: product.price || '',
                      });
                      setProductPhoto(null);
                    }}
                  >
                    Editar
                  </button>
                  <button className="button button--sm button--danger" onClick={() => setProductDeleteTarget(product)}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint>Nenhum produto cadastrado para esta família.</EmptyHint>
      )}
    </div>
  );

  const renderRelations = (
    <div className="panel">
      <div className="panel__title">Todas as relações</div>
      {family.relations.length ? (
        Object.entries(relationsByType).map(([type, relations]) => (
          <div key={type} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}><StatusBadge value={type} /></div>
            {relations.map((relation) => {
              const other = relation.family_a_id === family.id ? relation.family_b_name : relation.family_a_name;
              return (
                <Link key={relation.id} to={`/relacoes/${relation.id}`} className="relation-row">
                  <StatusBadge value={relation.is_active ? 'vigente' : 'encerrada'} />
                  <span className="relation-row__families">{other}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
                    {relation.started_on ? `desde ${formatDate(relation.started_on)}` : ''}
                  </span>
                </Link>
              );
            })}
          </div>
        ))
      ) : (
        <>
          <EmptyHint>Nenhuma relação registrada.</EmptyHint>
          <Link to="/relacoes/nova" className="button button--primary">Registrar relação</Link>
        </>
      )}
    </div>
  );

  const renderLocation = (
    <>
      <div className="panel">
        <div className="panel__title">Informações do local</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Nome da localização:</span> {family.location_name || '—'}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Território:</span> {family.territory || '—'}</div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Coordenadas:</span>{' '}
            {family.coordinates ? <span className="mono">{family.coordinates}</span> : '—'}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Observações do local:</span>
            <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {family.location_notes || '—'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link to={`/familias/${id}/editar`} className="button button--sm">Editar informações</Link>
        </div>
      </div>

      {!isArchived && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel__title">Adicionar fotos</div>
          <div className="filter-bar" style={{ marginBottom: 10 }}>
            <select value={photoCategory} onChange={(event) => setPhotoCategory(event.target.value)}>
              {PHOTO_CATEGORIES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <label className="button button--sm button--primary" style={{ cursor: uploadingPhotos ? 'wait' : 'pointer' }}>
              {uploadingPhotos ? 'Enviando...' : '+ Enviar fotos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleUploadPhotos}
                style={{ display: 'none' }}
                disabled={uploadingPhotos}
              />
            </label>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            As fotos serão categorizadas como "{PHOTO_CATEGORIES.find(([key]) => key === photoCategory)?.[1]}".
          </p>
        </div>
      )}

      {photoGroups.map((group) => (
        group.photos.length > 0 && (
          <div className="panel photo-section" key={group.key} style={{ marginTop: 16 }}>
            <div className="photo-section__title">
              <span>{group.label} ({group.photos.length})</span>
            </div>
            <div className="photo-grid">
              {group.photos.map((photo, index) => (
                <div className="photo-thumb" key={photo.id} onClick={() => openLightboxFrom(group.photos, index)}>
                  <img src={photo.file_path} alt={photo.caption || group.label} />
                  {!isArchived && (
                    <button
                      className="photo-thumb__remove"
                      onClick={(event) => { event.stopPropagation(); handleDeletePhoto(photo.id); }}
                      title="Remover foto"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {allPhotos.length === 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <EmptyHint>Nenhuma foto de localização/QG cadastrada ainda.</EmptyHint>
        </div>
      )}
    </>
  );

  const renderObservations = (
    <>
      <div className="panel">
        <div className="panel__title">Observações investigativas</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, whiteSpace: 'pre-wrap', margin: 0 }}>
          {family.observations || 'Nenhuma observação registrada. Use "Editar" para adicionar.'}
        </p>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__title">Histórico de alterações</div>
        {family.audit.length ? (
          family.audit.slice(0, 15).map((entry) => (
            <div className="activity-item" key={entry.id}>
              <div>
                <strong>{entry.action}</strong> {entry.detail && <span style={{ color: 'var(--text-muted)' }}>— {entry.detail}</span>}
              </div>
              <span className="activity-item__time" style={{ marginLeft: 'auto' }}>{formatDate(entry.created_at)}</span>
            </div>
          ))
        ) : (
          <EmptyHint>Sem eventos registrados.</EmptyHint>
        )}
      </div>
    </>
  );

  const renderInvestigations = (
    <div className="panel">
      <div className="panel__title">
        <span>Investigações ligadas à família ({investigations.length})</span>
        <Link to="/investigacoes/nova" style={{ fontSize: 11 }}>+ nova investigação</Link>
      </div>
      {investigations.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Investigação</th>
                <th>Status</th>
                <th>Pessoas</th>
                <th>Evidências</th>
                <th>Atualização</th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((investigation) => (
                <tr key={investigation.id}>
                  <td>
                    <Link to={`/investigacoes/${investigation.id}`} style={{ color: 'var(--text-primary)' }}>
                      <strong>✦ {investigation.title}</strong>
                    </Link>
                  </td>
                  <td><StatusBadge value={investigation.status} /></td>
                  <td>{investigation.member_count}</td>
                  <td>{investigation.evidence_count}</td>
                  <td className="mono">{formatDate(investigation.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyHint>
          Nenhuma investigação registrada para esta família.
          Abra um caso em <Link to="/investigacoes/nova">Investigações</Link> vinculando-a aqui.
        </EmptyHint>
      )}
    </div>
  );

  const tabRenderers = {
    overview: renderOverview,
    members: renderMembers,
    hierarchy: renderHierarchy,
    products: renderProducts,
    relations: renderRelations,
    location: renderLocation,
    investigations: renderInvestigations,
    observations: renderObservations,
  };

  return (
    <>
      <div className="page-header">
        <Link to="/familias" className="button button--ghost">← Voltar</Link>
        <div className="page-header__actions">
          {!isArchived && (
            <>
              <Link to={`/familias/${id}/editar`} className="button">Editar</Link>
              <button className="button button--danger" onClick={() => setArchiveOpen(true)}>Arquivar</button>
            </>
          )}
          {isArchived && <button className="button button--primary" onClick={handleRestore}>Restaurar</button>}
        </div>
      </div>

      {isArchived && (
        <div className="notification notification--warning">
          Este registro está <strong>arquivado</strong> e não aparece nas listagens. Restaure-o para editar.
        </div>
      )}

      <div className="tab-bar">
        {TABS.map(([key, label]) => (
          <button key={key} className={`tab-button${tab === key ? ' tab-button--active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tabRenderers[tab]}

      <Lightbox
        photos={allPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      <ConfirmModal
        open={archiveOpen}
        title="Arquivar família"
        message={
          <>
            <p>
              A família <strong>{family.name}</strong> será arquivada: sairá das listagens e métricas, seus vínculos
              ativos e relações vigentes serão <strong>encerrados automaticamente</strong>. Nada será apagado —
              será possível restaurar pelo Arquivo.
            </p>
            <div className="form-field">
              <label>Motivo (opcional)</label>
              <input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} />
            </div>
          </>
        }
        confirmLabel="Arquivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmModal
        open={Boolean(productModal)}
        title={productModal?.id ? `Editar produto: ${productModal.name}` : 'Novo produto'}
        message={
          productModal && (
            <>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Nome *</label>
                <input
                  value={productModal.name}
                  onChange={(event) => setProductModal({ ...productModal, name: event.target.value })}
                  placeholder="Ex.: Munição premium"
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label>Preço (R$)</label>
                  <input
                    value={productModal.price}
                    onChange={(event) => setProductModal({ ...productModal, price: event.target.value })}
                    placeholder="Ex.: 50.000"
                  />
                </div>
                <div className="form-field">
                  <label>Categoria</label>
                  <input
                    value={productModal.category}
                    onChange={(event) => setProductModal({ ...productModal, category: event.target.value })}
                    placeholder="Ex.: Munição, Armas..."
                  />
                </div>
              </div>
              <div className="form-field" style={{ marginTop: 10 }}>
                <label>Descrição</label>
                <textarea
                  value={productModal.description}
                  onChange={(event) => setProductModal({ ...productModal, description: event.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-field">
                <label>Foto do produto</label>
                <label className="upload-box">
                  {productPhoto ? <img src={URL.createObjectURL(productPhoto)} alt="Prévia" /> : null}
                  <div>{productPhoto ? 'Trocar foto' : 'Clique para enviar (JPG, PNG, WEBP)'}</div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setProductPhoto(event.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </>
          )
        }
        confirmLabel={productModal?.id ? 'Salvar' : 'Cadastrar'}
        confirmTone="primary"
        onConfirm={handleSaveProduct}
        onCancel={() => { setProductModal(null); setProductPhoto(null); }}
      />

      <ConfirmModal
        open={Boolean(productDeleteTarget)}
        title="Excluir produto"
        message={
          <p>
            Excluir <strong>{productDeleteTarget?.name}</strong> do catálogo de{' '}
            <strong>{family.name}</strong>? Essa ação registra quem realizou a exclusão.
          </p>
        }
        confirmLabel="Excluir"
        onConfirm={handleDeleteProduct}
        onCancel={() => setProductDeleteTarget(null)}
      />
    </>
  );
}
