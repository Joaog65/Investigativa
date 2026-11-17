import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { useAuth } from './context/AuthContext';
import { logout } from './services/api';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FamiliesPage from './pages/FamiliesPage';
import FamilyDetailPage from './pages/FamilyDetailPage';
import FamilyFormPage from './pages/FamilyFormPage';
import MembersPage from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import MemberFormPage from './pages/MemberFormPage';
import RolesPage from './pages/RolesPage';
import RelationsPage from './pages/RelationsPage';
import RelationDetailPage from './pages/RelationDetailPage';
import RelationFormPage from './pages/RelationFormPage';
import SearchPage from './pages/SearchPage';
import ArchivePage from './pages/ArchivePage';
import UsersPage from './pages/UsersPage';
import ProductsPage from './pages/ProductsPage';
import ProfilePage from './pages/ProfilePage';
import InvestigationsPage from './pages/InvestigationsPage';
import InvestigationFormPage from './pages/InvestigationFormPage';
import InvestigationDetailPage from './pages/InvestigationDetailPage';
import RelationMapPage from './pages/RelationMapPage';

function ProtectedShell({ children }) {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onUnauthorized = () => {
      logout().catch(() => {});
      window.location.href = '/login';
    };
    window.addEventListener('inv:unauthorized', onUnauthorized);
    return () => window.removeEventListener('inv:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="loading">
        <div>
          <div className="spinner" style={{ margin: '0 auto 10px' }} />
          Verificando sessão...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-panel">
        <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} />
        <div className="content-scroll">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedShell>
            <DashboardPage />
          </ProtectedShell>
        }
      />

      {[
        ['/familias', <FamiliesPage />],
        ['/familias/nova', <FamilyFormPage />],
        ['/familias/:id', <FamilyDetailPage />],
        ['/familias/:id/editar', <FamilyFormPage />],
        ['/membros', <MembersPage />],
        ['/membros/novo', <MemberFormPage />],
        ['/membros/:id', <MemberDetailPage />],
        ['/membros/:id/editar', <MemberFormPage />],
        ['/relacoes', <RelationsPage />],
        ['/relacoes/nova', <RelationFormPage />],
        ['/relacoes/:id', <RelationDetailPage />],
        ['/relacoes/:id/editar', <RelationFormPage />],
        ['/cargos', <RolesPage />],
        ['/produtos', <ProductsPage />],
        ['/perfil', <ProfilePage />],
        ['/investigacoes', <InvestigationsPage />],
        ['/investigacoes/nova', <InvestigationFormPage />],
        ['/investigacoes/:id', <InvestigationDetailPage />],
        ['/investigacoes/:id/editar', <InvestigationFormPage />],
        ['/mapa', <RelationMapPage />],
        ['/busca', <SearchPage />],
        ['/arquivo', <ArchivePage />],
        ['/configuracoes/usuarios', <UsersPage />],
      ].map(([path, element]) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedShell>
              {element}
            </ProtectedShell>
          }
        />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
