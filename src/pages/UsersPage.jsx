import { useEffect, useState } from 'react';
import { fetchUsers, createUser, updateUser, updateUserPassword, logout } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function UsersPage() {
  const { user, signOut } = useAuth();
  const { notifyError, notifySuccess } = useToast();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'user' });
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordValue, setPasswordValue] = useState('');

  const load = () => {
    fetchUsers().then(setUsers).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (user?.role !== 'admin') {
    return <div className="notification notification--error">Acesso restrito ao administrador.</div>;
  }

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      await createUser(form);
      notifySuccess('Usuário criado.');
      setForm({ username: '', display_name: '', password: '', role: 'user' });
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUpdate = async (target, patch) => {
    try {
      await updateUser(target.id, patch);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handlePassword = async () => {
    try {
      await updateUserPassword(passwordTarget.id, passwordValue);
      notifySuccess('Senha redefinida.');
      setPasswordTarget(null);
      setPasswordValue('');
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    signOut();
    window.location.href = '/login';
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Usuários</h1>
          <p>Gestão de acessos da equipe investigativa</p>
        </div>
        <button className="button" onClick={handleLogout}>Sair da sessão</button>
      </div>

      {error && <div className="notification notification--error">{error}</div>}

      <div className="detail-grid">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.display_name}</strong>
                    <div className="mono">@{item.username}</div>
                  </td>
                  <td>
                    <select
                      value={item.role}
                      onChange={(event) => handleUpdate(item, { role: event.target.value })}
                      disabled={item.id === user.id}
                    >
                      <option value="user">Investigador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${item.is_active ? 'badge--ativo' : 'badge--encerrada'}`}>
                      {item.is_active ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="button button--sm" onClick={() => { setPasswordTarget(item); setPasswordValue(''); }}>
                      Senha
                    </button>
                    <button
                      className="button button--sm"
                      onClick={() => handleUpdate(item, { is_active: !item.is_active })}
                      disabled={item.id === user.id}
                    >
                      {item.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel__title">Novo usuário</div>
          <form onSubmit={handleCreate}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Usuário (login)</label>
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Nome de exibição</label>
              <input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} required />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Senha (mín. 6 caracteres)</label>
              <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={6} />
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Papel</label>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="user">Investigador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button type="submit" className="button button--primary" style={{ width: '100%', justifyContent: 'center' }}>
              Criar usuário
            </button>
          </form>
        </div>
      </div>

      {passwordTarget && (
        <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setPasswordTarget(null)}>
          <div className="modal">
            <div className="modal__header"><h3>Redefinir senha: {passwordTarget.display_name}</h3></div>
            <div className="modal__body">
              <div className="form-field">
                <label>Nova senha (mín. 6 caracteres)</label>
                <input type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal__actions">
              <button className="button" onClick={() => setPasswordTarget(null)}>Cancelar</button>
              <button className="button button--primary" onClick={handlePassword} disabled={passwordValue.length < 6}>
                Redefinir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
