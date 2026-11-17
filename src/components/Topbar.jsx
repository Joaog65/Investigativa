import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Avatar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ onMenuClick }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleSubmit = (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term) {
      navigate(`/busca?q=${encodeURIComponent(term)}`);
    }
  };

  return (
    <header className="topbar">
      <button className="topbar__menu" onClick={onMenuClick} aria-label="Abrir menu">☰</button>

      <form className="topbar__search" onSubmit={handleSubmit}>
        <span className="topbar__search-icon">⌕</span>
        <input
          type="search"
          placeholder="Buscar famílias, membros, produtos, IDs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Pesquisa global"
        />
      </form>

      <div className="topbar__spacer" />
      <Link to="/perfil" className="topbar__avatar" title="Meu perfil">
        <span className="topbar__user-name">{user?.nickname || user?.display_name}</span>
        <Avatar user={user} size="sm" />
      </Link>
    </header>
  );
}
