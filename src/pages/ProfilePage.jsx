import { useEffect, useState } from 'react';
import { fetchMe, updateProfile, updateProfilePassword, uploadProfileAvatar, fetchAuditLog } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

export default function ProfilePage() {
  const { user, signIn } = useAuth();
  const { notifyError, notifySuccess } = useToast();

  const [me, setMe] = useState(null);
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({ nickname: '', display_name: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [passwords, setPasswords] = useState({ current_password: '', password: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchMe()
      .then((data) => {
        setMe(data.user);
        setForm({ nickname: data.user.nickname || '', display_name: data.user.display_name || '' });
        if (data.user.avatar_path) setAvatarPreview(data.user.avatar_path);
      })
      .catch((err) => notifyError(err.message));
    fetchAuditLog(200)
      .then((entries) => setActivities(entries.filter((entry) => entry.user_id === user?.id).slice(0, 12)))
      .catch(() => {});
  };

  useEffect(load, []);

  if (!me) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      if (avatarFile) {
        await uploadProfileAvatar(avatarFile);
        setAvatarFile(null);
      }
      notifySuccess('Perfil atualizado.');
      const refreshed = await fetchMe();
      signIn(refreshed.user);
      setMe(refreshed.user);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    try {
      await updateProfilePassword(passwords.current_password, passwords.password);
      notifySuccess('Senha alterada.');
      setPasswords({ current_password: '', password: '' });
    } catch (err) {
      notifyError(err.message);
    }
  };

  const displayName = me.nickname || me.display_name;

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Meu perfil</h1>
          <p>Configurações pessoais da sua conta</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Identificação</div>
            <div className="form-grid">
              <div className="form-field form-field--full">
                <label>Foto de perfil</label>
                <label className="upload-box">
                  {avatarPreview ? <img src={avatarPreview} alt="Prévia" style={{ borderRadius: '50%', width: 96, height: 96, objectFit: 'cover' }} /> : null}
                  <div>{avatarFile || avatarPreview ? 'Trocar foto' : 'Clique para enviar (JPG, PNG, WEBP)'}</div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="form-field">
                <label>Nickname</label>
                <input
                  value={form.nickname}
                  onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                  placeholder="Como quer ser identificado na plataforma"
                />
              </div>

              <div className="form-field">
                <label>Nome de exibição</label>
                <input
                  value={form.display_name}
                  onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                  placeholder="Ex.: Ana Souza"
                />
              </div>

              <div className="form-field">
                <label>Usuário de login</label>
                <input value={me.username} disabled className="mono" style={{ opacity: 0.7 }} />
              </div>
            </div>
            <div className="form-actions">
              <button className="button button--primary" onClick={handleSaveProfile} disabled={saving || !form.display_name.trim()}>
                {saving ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Alterar senha</div>
            <div className="form-grid">
              <div className="form-field">
                <label>Senha atual</label>
                <input
                  type="password"
                  value={passwords.current_password}
                  onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Nova senha (mín. 6)</label>
                <input
                  type="password"
                  value={passwords.password}
                  onChange={(event) => setPasswords({ ...passwords, password: event.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="button button--primary"
                onClick={handleSavePassword}
                disabled={passwords.password.length < 6 || !passwords.current_password}
              >
                Alterar senha
              </button>
            </div>
          </div>
        </div>

        <div className="detail-stack">
          <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {me.avatar_path ? (
              <img src={me.avatar_path} alt="" className="avatar avatar--lg" />
            ) : (
              <div className="avatar avatar--lg avatar--empty">{displayName.charAt(0)}</div>
            )}
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div>
              <div style={{ color: 'var(--text-secondary)' }}>@{me.username}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${me.role === 'admin' ? 'badge--admin' : 'badge--neutralidade'}`}>
                  {me.role === 'admin' ? 'Administrador' : 'Investigador'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                Cadastrado em {formatDate(me.created_at)}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Suas atividades recentes</div>
            {activities.length ? (
              activities.map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <div>
                    <strong>{entry.action}</strong>{' '}
                    {entry.entity_name && <span>{entry.entity_name}</span>}
                    {entry.detail && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry.detail}</div>}
                  </div>
                  <span className="activity-item__time" style={{ marginLeft: 'auto' }}>{formatDate(entry.created_at)}</span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma atividade registrada ainda.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
