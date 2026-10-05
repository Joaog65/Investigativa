import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import OrganizationFormPage from './pages/OrganizationFormPage';
import OrganizationPage from './pages/OrganizationPage';
import { fetchCategories, fetchOrganizations } from './services/api';

const defaultFilters = {
  search: '',
  category: '',
  product: '',
  partnership: '',
  alliance: '',
  color: '',
};

function App() {
  const [categories, setCategories] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const refreshData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [categoriesResponse, organizationsResponse] = await Promise.all([
        fetchCategories(),
        fetchOrganizations(nextFilters),
      ]);

      setCategories(categoriesResponse);
      setOrganizations(organizationsResponse);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível carregar os dados do sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (nextFilters) => {
    setFilters(nextFilters);
    refreshData(nextFilters);
  };

  return (
    <div className="app-shell">
      <Sidebar categories={categories} organizations={organizations} />

      <main className="main-panel">
        <header className="topbar">
          <Link to="/" className="topbar__brand">Investigativa</Link>
          <div className="topbar__actions">
            <Link to="/organization/new" className="primary-button">Adicionar organização</Link>
          </div>
        </header>

        {errorMessage && <div className="notification notification--error">{errorMessage}</div>}

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                categories={categories}
                organizations={organizations}
                filters={filters}
                onFiltersChange={handleFilterChange}
                loading={loading}
              />
            }
          />

          <Route
            path="/organization/new"
            element={<OrganizationFormPage categories={categories} onSaveComplete={() => refreshData(filters)} />}
          />

          <Route
            path="/organization/:id"
            element={<OrganizationPage onOrganizationChange={() => refreshData(filters)} />}
          />

          <Route
            path="/organization/:id/edit"
            element={<OrganizationFormPage categories={categories} onSaveComplete={() => refreshData(filters)} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
