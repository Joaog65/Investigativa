import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteOrganization,
  deleteOrganizationImage,
  fetchOrganization,
  uploadBaseImages,
  uploadOrganizationLogo,
  uploadPartnershipTable,
  uploadTrackTable,
} from '../services/api';

function OrganizationPage({ onOrganizationChange }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      const organizationData = await fetchOrganization(id);
      setOrganization(organizationData);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível carregar a organização.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadOrganizationLogo(id, file);
      await loadOrganization();
      onOrganizationChange?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível enviar a logo.');
    }
  };

  const handleTrackTableUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadTrackTable(id, file);
      await loadOrganization();
      onOrganizationChange?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível enviar a tabela de pista.');
    }
  };

  const handlePartnershipTableUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadPartnershipTable(id, file);
      await loadOrganization();
      onOrganizationChange?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível enviar a tabela de parceria.');
    }
  };

  const handleBaseImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      await uploadBaseImages(id, files);
      await loadOrganization();
      onOrganizationChange?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível enviar as fotos da base.');
    }
  };

  const handleDeleteOrganization = async () => {
    const confirmed = window.confirm('Tem certeza que deseja excluir esta organização? Esta ação não poderá ser desfeita.');
    if (!confirmed) return;

    try {
      await deleteOrganization(id);
      onOrganizationChange?.();
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível excluir a organização.');
    }
  };

  const handleDeleteBaseImage = async (imageId) => {
    try {
      await deleteOrganizationImage(id, imageId);
      await loadOrganization();
      onOrganizationChange?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível remover a imagem.');
    }
  };

  const categoriesText = useMemo(
    () => organization?.categories?.map((category) => category.name).join(', ') || 'Sem categorias cadastradas',
    [organization]
  );

  if (loading) {
    return <div className="loading-state">Carregando organização...</div>;
  }

  if (!organization) {
    return (
      <div className="empty-state">
        <h3>Organização não localizada.</h3>
        <p>Verifique o identificador ou retorne à lista principal.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="organization-hero" style={{ '--org-accent': organization.primary_color || '#d92c2c' }}>
        <div className="organization-hero__logo">
          {organization.logo ? (
            <img src={organization.logo} alt={organization.name} />
          ) : (
            <span>{organization.abbreviation || 'ORG'}</span>
          )}
        </div>

        <div className="organization-hero__info">
          <div className="eyebrow">{organization.abbreviation}</div>
          <h1>{organization.name}</h1>
          <p>{categoriesText}</p>
          <div className="organization-hero__chips">
            <span className={`status-pill ${organization.partnership ? 'status-pill--success' : 'status-pill--danger'}`}>
              {organization.partnership ? 'Parceria ativa' : 'Sem parceria'}
            </span>
            <span className={`status-pill ${organization.alliance ? 'status-pill--success' : 'status-pill--neutral'}`}>
              {organization.alliance ? 'Aliança ativa' : 'Sem aliança'}
            </span>
          </div>
        </div>

        <div className="organization-hero__actions">
          <Link to={`/organization/${id}/edit`} className="primary-button">Editar organização</Link>
          <button type="button" className="danger-button" onClick={handleDeleteOrganization}>Excluir organização</button>
        </div>
      </div>

      {errorMessage && <div className="notification notification--error">{errorMessage}</div>}

      <nav className="internal-tabs">
        <a href="#overview">Visão geral</a>
        <a href="#hierarchy">Hierarquia</a>
        <a href="#products">Produtos</a>
        <a href="#tables">Tabelas</a>
        <a href="#base">Base</a>
        <a href="#relations">Relações</a>
        <a href="#investigation">Observações</a>
      </nav>

      <section id="overview" className="detail-section">
        <div className="section-head">
          <h2>Visão geral</h2>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <h3>Informações principais</h3>
            <p><strong>Abreviação:</strong> {organization.abbreviation || 'Não informada'}</p>
            <p><strong>Categorias:</strong> {categoriesText}</p>
            <p><strong>Produto principal:</strong> {organization.products?.[0]?.name || 'Não informado'}</p>
            <p><strong>Parceria:</strong> {organization.partnership ? 'Ativa' : 'Inativa'}</p>
            <p><strong>Aliança:</strong> {organization.alliance ? 'Ativa' : 'Inativa'}</p>
          </div>

          <div className="detail-card">
            <h3>Upload de imagens</h3>
            <label className="upload-input">
              <span>Logo</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
            <label className="upload-input">
              <span>Tabela de pista</span>
              <input type="file" accept="image/*" onChange={handleTrackTableUpload} />
            </label>
            <label className="upload-input">
              <span>Tabela de parceria</span>
              <input type="file" accept="image/*" onChange={handlePartnershipTableUpload} />
            </label>
            <label className="upload-input">
              <span>Fotos da base</span>
              <input type="file" accept="image/*" multiple onChange={handleBaseImageUpload} />
            </label>
          </div>
        </div>
      </section>

      <section id="hierarchy" className="detail-section">
        <div className="section-head">
          <h2>Hierarquia</h2>
        </div>
        {organization.hierarchy?.length ? (
          <div className="hierarchy-grid">
            {organization.hierarchy.map((position) => (
              <div key={`${position.title}-${position.person_name || 'sem-nome'}`} className="hierarchy-card">
                <span className="hierarchy-card__title">{position.title}</span>
                <strong>{position.person_name || 'Não informado'}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <p>Esta organização ainda não possui cargos cadastrados.</p>
          </div>
        )}
      </section>

      <section id="products" className="detail-section">
        <div className="section-head">
          <h2>Produtos</h2>
        </div>

        {organization.products?.length ? (
          <div className="card-grid">
            {organization.products.map((product, index) => (
              <div key={`${product.name}-${index}`} className="detail-card">
                <h3>{product.name}</h3>
                <p><strong>Categoria:</strong> {product.category || 'Não informada'}</p>
                <p>{product.description}</p>
                <small>{product.observation}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <p>Esta organização ainda não possui produtos cadastrados.</p>
          </div>
        )}
      </section>

      <section id="tables" className="detail-section">
        <div className="section-head">
          <h2>Tabelas</h2>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <h3>Tabela de pista</h3>
            {organization.track_table ? (
              <button type="button" className="image-button" onClick={() => setSelectedImage(organization.track_table)}>
                <img src={organization.track_table} alt="Tabela de pista" />
              </button>
            ) : (
              <div className="empty-state compact">
                <p>Esta organização ainda não possui tabela de pista.</p>
              </div>
            )}
          </div>

          <div className="detail-card">
            <h3>Tabela de parceria</h3>
            {organization.partnership_table ? (
              <button type="button" className="image-button" onClick={() => setSelectedImage(organization.partnership_table)}>
                <img src={organization.partnership_table} alt="Tabela de parceria" />
              </button>
            ) : (
              <div className="empty-state compact">
                <p>Esta organização ainda não possui tabela de parceria.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="base" className="detail-section">
        <div className="section-head">
          <h2>Base</h2>
        </div>

        {organization.images?.length ? (
          <div className="gallery-grid">
            {organization.images.map((image) => (
              <div key={image.id} className="gallery-item">
                <button type="button" className="image-button" onClick={() => setSelectedImage(image.url)}>
                  <img src={image.url} alt="Foto da base" />
                </button>
                <button type="button" className="small-button small-button--danger" onClick={() => handleDeleteBaseImage(image.id)}>
                  Excluir
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <p>Esta organização ainda não possui fotos da base.</p>
          </div>
        )}
      </section>

      <section id="relations" className="detail-section">
        <div className="section-head">
          <h2>Relações</h2>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <h3>Parceria</h3>
            <p>{organization.partnership ? 'Existe parceria ativa com esta organização.' : 'Sem parceria no registro atual.'}</p>
          </div>

          <div className="detail-card">
            <h3>Aliança</h3>
            <p>{organization.alliance ? 'Há aliança ativa.' : 'Não há aliança ativa.'}</p>
            {organization.benefits?.length ? (
              <ul className="simple-list">
                {organization.benefits.map((benefit, index) => (
                  <li key={`${benefit.benefit}-${index}`}>{benefit.benefit}</li>
                ))}
              </ul>
            ) : (
              <p>Não há benefícios registrados para a aliança.</p>
            )}
            {organization.alliance_notes && <p><strong>Observações:</strong> {organization.alliance_notes}</p>}
          </div>
        </div>
      </section>

      <section id="investigation" className="detail-section">
        <div className="section-head">
          <h2>Investigação / observações</h2>
        </div>
        <div className="detail-card detail-card--full">
          <p>{organization.observations || 'Nenhuma observação adicional foi registrada.'}</p>
        </div>
      </section>

      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <button type="button" className="lightbox__close" onClick={() => setSelectedImage(null)}>Fechar</button>
          <img src={selectedImage} alt="Visualização ampliada" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default OrganizationPage;
