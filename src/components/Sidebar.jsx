import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GROUPS = [
  {
    label: 'Investigação',
    items: [
      { to: '/familias', label: 'Famílias', icon: '◈' },
      { to: '/membros', label: 'Membros', icon: '◉' },
      { to: '/relacoes', label: 'Relações', icon: '⇄' },
      { to: '/cargos', label: 'Cargos', icon: '☰' },
    ],
  },
  {
    label: 'Fase 2',
    items: [
      { to: '/produtos', label: 'Produtos', icon: '▣' },
      { to: '/investigacoes', label: 'Investigações', icon: '✦' },
      { to: '/mapa', label: 'Mapa de relações', icon: '⌖' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/arquivo', label: 'Arquivo', icon: '▤' },
      { to: '/perfil', label: 'Meu perfil', icon: '○' },
      { to: '/configuracoes/usuarios', label: 'Usuários', icon: '⚙', adminOnly: true },
    ],
  },
];

function Avatar({ user, size = 'side' }) {
  if (user?.avatar_path) {
    return <img src={user.avatar_path} alt="" className={`avatar avatar--${size}`} />;
  }
  const initial = (user?.nickname || user?.display_name || '?').charAt(0);
  return <div className={`avatar avatar--${size} avatar--empty`}>{initial}</div>;
}

export { Avatar };

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  return (
    <>
      {open && <div className="sidebar__backdrop" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <Link to="/" className="sidebar__brand" style={{ color: 'inherit' }} onClick={onClose}>
          <div className="sidebar__brand-mark">INV</div>
          <div>
            <span className="sidebar__brand-text">Investigativa</span>
            <span className="sidebar__brand-sub">Banco de dados</span>
          </div>
        </Link>

        <nav className="sidebar__nav">
          <div className="sidebar__group">
            <NavLink to="/" end className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`} onClick={onClose}>
              <span>▦</span> Dashboard
            </NavLink>
          </div>

          {GROUPS.map((group) => (
            <div className="sidebar__group" key={group.label}>
              <div className="sidebar__group-label">{group.label}</div>
              {group.items
                .filter((item) => !item.adminOnly || user?.role === 'admin')
                .map((item) =>
                  item.disabled ? (
                    <span key={item.to} className="sidebar__link sidebar__link--disabled" title="Disponível em breve">
                      <span>{item.icon}</span> {item.label}
                    </span>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                      onClick={onClose}
                    >
                      <span>{item.icon}</span> {item.label}
                    </NavLink>
                  )
                )}
            </div>
          ))}
        </nav>

        <div className="sidebar__profile" onClick={() => { onClose(); }}>
          <Avatar user={user} />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar__profile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nickname || user?.display_name}
            </div>
            <div className="sidebar__profile-role">{user?.role === 'admin' ? 'Administrador' : 'Investigador'}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
