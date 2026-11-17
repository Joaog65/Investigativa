import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(username.trim(), password);
      signIn(data.user);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <div className="login-card__mark">INV</div>
          <h1 style={{ fontSize: 18 }}>Investigativa</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>
            Banco de dados investigativo — acesso restrito
          </p>
          <span className="login-card__classification">Confidencial</span>
        </div>

        {error && <div className="notification notification--error">{error}</div>}

        <div className="form-field" style={{ marginBottom: 12 }}>
          <label htmlFor="username">Usuário</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="form-field" style={{ marginBottom: 18 }}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="button button--primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Acessar sistema'}
        </button>
      </form>
    </div>
  );
}
