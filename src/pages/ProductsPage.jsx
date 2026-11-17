import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts, fetchFamilies } from '../services/api';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ family: '', search: '' });

  useEffect(() => {
    fetchFamilies({ status: 'all' }).then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts(filters)
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Produtos</h1>
          <p>Catálogo geral — cada produto pertence à sua família de origem</p>
        </div>
        <div className="page-header__actions">
          <Link to="/familias" className="button" style={{ fontSize: 12.5 }}>
            Gerenciar no perfil de cada família
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="Buscar produto, categoria..."
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.family} onChange={(event) => setFilters({ ...filters, family: event.target.value })}>
          <option value="">Família: todas</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>{family.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {loading ? (
        <div className="loading"><div><div className="spinner" style={{ margin: '0 auto 10px' }} />Carregando...</div></div>
      ) : products.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <h3>Nenhum produto encontrado</h3>
            <p>Os produtos são cadastrados dentro da página de cada família, na aba "Produtos".</p>
            <Link to="/familias" className="button button--primary">Ir para famílias</Link>
          </div>
        </div>
      ) : (
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
                <Link
                  to={`/familias/${product.family_id}`}
                  className="product-card__meta"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  ◈ {product.family_name}
                </Link>
                {product.category && <div className="product-card__meta">{product.category}</div>}
                {product.description && <div className="product-card__desc">{product.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
