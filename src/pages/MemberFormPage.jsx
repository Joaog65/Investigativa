import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchMember, fetchFamilies, fetchRoles, createMember, updateMember, createMembership, uploadMemberPhoto } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function MemberFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useToast();

  const [form, setForm] = useState({ nickname: '', full_name: '', status: 'ativo', observations: '' });
  const [serverIds, setServerIds] = useState(['']);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [families, setFamilies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [membership, setMembership] = useState({ family_id: '', role_id: '', joined_on: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    fetchFamilies({ status: 'all' }).then(setFamilies).catch(() => {});
    fetchRoles().then((data) => setRoles(data.active)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchMember(id)
      .then((member) => {
        setForm({
          nickname: member.nickname || '',
          full_name: member.full_name || '',
          status: member.status,
          observations: member.observations || '',
        });
        setServerIds([...(member.server_id_list || []), '']);
        if (member.photo_path) setPhotoPreview(member.photo_path);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setWarning('');

    if (!form.nickname.trim()) {
      setError('O vulgo do membro é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const ids = serverIds.map((value) => value.trim()).filter(Boolean);
      let memberId;

      if (isEdit) {
        await updateMember(id, { ...form, server_ids: ids });
        memberId = id;
        if (photoFile) {
          await uploadMemberPhoto(memberId, photoFile);
        }
        notifySuccess('Membro atualizado.');
      } else {
        const payload = {
          ...form,
          server_ids: ids,
          membership:
            membership.family_id && membership.joined_on
              ? { ...membership, role_id: membership.role_id || null }
              : null,
        };
        const created = await createMember(payload);
        memberId = created.id;
        if (created.warning) setWarning(created.warning);
        if (photoFile) {
          await uploadMemberPhoto(memberId, photoFile);
        }
        notifySuccess('Membro cadastrado.');
      }

      navigate(`/membros/${memberId}`);
    } catch (err) {
      setError(err.message);
      notifyError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />Carregando...</div>;

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>{isEdit ? 'Editar membro' : 'Novo membro'}</h1>
          <p>{isEdit ? <>Registro <span className="mono">#{id}</span></> : 'Cadastro de investigado'}</p>
        </div>
        <Link to={isEdit ? `/membros/${id}` : '/membros'} className="button">Cancelar</Link>
      </div>

      {error && <div className="notification notification--error">{error}</div>}
      {warning && <div className="notification notification--warning">{warning} Você pode mantê-lo mesmo assim ou revisar o cadastro.</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel">
          <div className="panel__title">Identificação</div>
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label>Fotografia</label>
              <label className="upload-box">
                {photoPreview ? <img src={photoPreview} alt="Prévia" /> : null}
                <div>{photoFile || photoPreview ? 'Trocar foto' : 'Clique para enviar a foto do integrante (JPG, PNG, WEBP · 5 MB)'}</div>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="nickname">Vulgo / apelido *</label>
              <input id="nickname" value={form.nickname} onChange={updateField('nickname')} required placeholder="Ex.: Zé do Bar" />
            </div>

            <div className="form-field">
              <label htmlFor="full_name">Nome completo (se souber)</label>
              <input id="full_name" value={form.full_name} onChange={updateField('full_name')} placeholder="Ex.: José da Silva" />
            </div>

            <div className="form-field form-field--full">
              <label>IDs no servidor (informativo, vários permitidos)</label>
              {serverIds.map((value, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input
                    className="mono"
                    value={value}
                    onChange={(event) => {
                      const next = [...serverIds];
                      next[index] = event.target.value;
                      setServerIds(next);
                    }}
                    placeholder="Ex.: 428"
                  />
                  {serverIds.length > 1 && (
                    <button type="button" className="button button--ghost button--sm" onClick={() => setServerIds(serverIds.filter((_, i) => i !== index))}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="button button--sm" onClick={() => setServerIds([...serverIds, ''])}>
                + Adicionar ID
              </button>
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel__title">Vínculo inicial (opcional)</div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="family">Família</label>
                <select
                  id="family"
                  value={membership.family_id}
                  onChange={(event) => setMembership({ ...membership, family_id: event.target.value })}
                >
                  <option value="">— Sem vínculo —</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>{family.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="role">Cargo</label>
                <select
                  id="role"
                  value={membership.role_id}
                  onChange={(event) => setMembership({ ...membership, role_id: event.target.value })}
                  disabled={!membership.family_id}
                >
                  <option value="">— Sem cargo —</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="joined_on">Data de entrada</label>
                <input
                  id="joined_on"
                  type="date"
                  value={membership.joined_on}
                  onChange={(event) => setMembership({ ...membership, joined_on: event.target.value })}
                  disabled={!membership.family_id}
                />
              </div>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel__title">Observações</div>
          <textarea
            value={form.observations}
            onChange={updateField('observations')}
            rows={5}
            placeholder="Anotações investigativas sobre o membro..."
          />
        </div>

        <div className="form-actions">
          <Link to={isEdit ? `/membros/${id}` : '/membros'} className="button">Cancelar</Link>
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar membro'}
          </button>
        </div>
      </form>
    </>
  );
}
