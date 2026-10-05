import { Link } from 'react-router-dom';
import OrganizationCard from '../components/OrganizationCard';

function HomePage({ categories, organizations, filters, onFiltersChange, loading }) {
  const handleChange = (event) => {
    const { name, value } = event.target;
    onFiltersChange({ ...filters, [name]: value });
  };

  if (loading) {
    return <div className="loading-state">Carregando organizações...</div>;
  }

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div className="hero-panel__logo">I</div>
        <h1>Investigativa</h1>
        <p>Sistema interno de gerenciamento e investigação de organizações.</p>
      </section>

      <section className="filter-panel">
        <div className="field-group field-group--wide">
          <label htmlFor="search">Pesquisa</label>
          <input id="search" name="search" value={filters.search} onChange={handleChange} placeholder="Nome, abreviação, categoria ou produto" />
        </div>

        <div className="field-group">
          <label htmlFor="category">Categoria</label>
          <select id="category" name="category" value={filters.category} onChange={handleChange}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="product">Produto</label>
          <input id="product" name="product" value={filters.product} onChange={handleChange} placeholder="Ex.: Munição" />
        </div>

        <div className="field-group">
          <label htmlFor="partnership">Parceria</label>
          <select id="partnership" name="partnership" value={filters.partnership} onChange={handleChange}>
            <option value="">Todas</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="alliance">Aliança</label>
          <select id="alliance" name="alliance" value={filters.alliance} onChange={handleChange}>
            <option value="">Todas</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
        </div>
      </section>

      <div className="section-head">
        <h2>Organizações cadastradas</h2>
        <Link to="/organization/new" className="primary-button">Adicionar organização</Link>
      </div>

      {organizations.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhuma organização encontrada.</h3>
          <p>Teste outra combinação de filtros ou cadastre a primeira organização do sistema.</p>
        </div>
      ) : (
        <section className="organization-grid">
          {organizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </section>
      )}
    </div>
  );
}

export default HomePage;
