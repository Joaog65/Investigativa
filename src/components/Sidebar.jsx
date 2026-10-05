import { Link } from 'react-router-dom';

function Sidebar({ categories, organizations }) {
  const groupedCategories = categories.map((category) => ({
    ...category,
    organizations: organizations.filter((organization) =>
      organization.categories?.some((entry) => entry.name === category.name)
    ),
  }));

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Link to="/" className="brand-link">
          <span className="brand-mark">I</span>
          <span>Investigativa</span>
        </Link>
      </div>

      <nav className="sidebar__nav" aria-label="Navegação principal">
        {groupedCategories.map((category) => (
          <div className="sidebar__group" key={category.id}>
            <h3>{category.name}</h3>
            <ul>
              {category.organizations.length === 0 ? (
                <li className="sidebar__empty">Nenhuma organização</li>
              ) : (
                category.organizations.map((organization) => (
                  <li key={organization.id}>
                    <Link to={`/organization/${organization.id}`}>
                      {organization.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
