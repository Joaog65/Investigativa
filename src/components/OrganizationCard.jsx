import { Link } from 'react-router-dom';

function OrganizationCard({ organization }) {
  const primaryProduct = organization.products?.[0]?.name || 'Produto principal não informado';
  const categoriesText = organization.categories?.map((category) => category.name).join(', ') || 'Sem categoria';

  return (
    <article className="organization-card" style={{ '--org-accent': organization.primary_color || '#d92c2c' }}>
      <div className="organization-card__header">
        <div className="organization-card__logo">
          {organization.logo ? (
            <img src={organization.logo} alt={organization.name} />
          ) : (
            <span>{organization.abbreviation || 'ORG'}</span>
          )}
        </div>

        <div className="organization-card__titles">
          <h3>{organization.name}</h3>
          <span>{organization.abbreviation}</span>
        </div>
      </div>

      <div className="organization-card__meta">
        <p><strong>Produto principal:</strong> {primaryProduct}</p>
        <p><strong>Categoria:</strong> {categoriesText}</p>
      </div>

      <div className="organization-card__status-row">
        <span className={`status-pill ${organization.partnership ? 'status-pill--success' : 'status-pill--danger'}`}>
          {organization.partnership ? 'Parceria ativa' : 'Sem parceria'}
        </span>
        <span className={`status-pill ${organization.alliance ? 'status-pill--success' : 'status-pill--neutral'}`}>
          {organization.alliance ? 'Aliança ativa' : 'Sem aliança'}
        </span>
      </div>

      <div className="organization-card__footer">
        <Link to={`/organization/${organization.id}`} className="primary-button">
          Abrir organização
        </Link>
      </div>
    </article>
  );
}

export default OrganizationCard;
