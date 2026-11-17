import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createFamily, updateFamily, fetchFamily, fetchMembers, uploadFamilyLogo } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function FamilyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    founded_on: '',
    territory: '',
    status: 'ativa',
    observations: '',
    location_name: '',
    coordinates: '',
    location_notes: '',
    leader_member_id: '',
    vice_leader_member_id: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers({})
      .then((members) => setEligibleMembers(members.filter((member) => member.current_family_id)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchFamily(id)
      .then((family) => {
        setForm({
          name: family.name || '',
          description: family.description || '',
          founded_on: family.founded_on || '',
          territory: family.territory || '',
          status: family.status === 'dissolvida' ? 'inativa' : family.status,
          observations: family.observations || '',
          location_name: family.location_name || '',
          coordinates: family.coordinates || '',
          location_notes: family.location_notes || '',
          leader_member_id: family.leader_member_id || '',
          vice_leader_member_id: family.vice_leader_member_id || '',
        });
        if (family.logo_path) setLogoPreview(family.logo_path);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('O nome da família é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      let familyId;
      if (isEdit) {
        await updateFamily(id, { ...form, leader_member_id: form.leader_member_id || null, vice_leader_member_id: form.vice_leader_member_id || null });
        familyId = id;
      } else {
        const created = await createFamily({ ...form, leader_member_id: form.leader_member_id || null, vice_leader_member_id: form.vice_leader_member_id || null });
        familyId = created.id;
      }

      if (logoFile) {
        await uploadFamilyLogo(familyId, logoFile);
      }

      notifySuccess(isEdit ? 'Família atualizada.' : 'Família criada.');
      navigate(`/familias/${familyId}`);
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
          <h1>{isEdit ? 'Editar família' : 'Nova família'}</h1>
          <p>{isEdit ? <>Registro <span className="mono">#{id}</span></> : 'Cadastro de organização criminosa'}</p>
        </div>
        <Link to={isEdit ? `/familias/${id}` : '/familias'} className="button">Cancelar</Link>
      </div>

      {error && <div className="notification notification--error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel">
          <div className="panel__title">Identificação</div>
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="logo">Logotipo / imagem de identificação</label>
              <label className="upload-box" htmlFor="logo">
                {logoPreview ? <img src={logoPreview} alt="Prévia do logotipo" /> : null}
                <div>{logoFile || logoPreview ? 'Trocar imagem' : 'Clique para enviar (JPG, PNG ou WEBP · até 5 MB)'}</div>
              </label>
              <input id="logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>

            <div className="form-field">
              <label htmlFor="name">Nome *</label>
              <input id="name" value={form.name} onChange={updateField('name')} required placeholder="Ex.: Família Vagos" />
            </div>

            <div className="form-field">
              <label htmlFor="territory">Território / área de atuação</label>
              <input id="territory" value={form.territory} onChange={updateField('territory')} placeholder="Ex.: Zona sul" />
            </div>

            <div className="form-field">
              <label htmlFor="founded_on">Data de criação</label>
              <input id="founded_on" type="date" value={form.founded_on} onChange={updateField('founded_on')} />
            </div>

            <div className="form-field">
              <label htmlFor="status">Status</label>
              <select id="status" value={form.status} onChange={updateField('status')}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
              </select>
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="description">Descrição</label>
              <textarea id="description" value={form.description} onChange={updateField('description')} placeholder="Resumo da organização, atuação, perfil..." />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel__title">Localização e QG</div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="location_name">Nome da localização</label>
              <input id="location_name" value={form.location_name} onChange={updateField('location_name')} placeholder="Ex.: Galpão da doca 7" />
            </div>
            <div className="form-field">
              <label htmlFor="coordinates">Coordenadas (se disponíveis)</label>
              <input id="coordinates" value={form.coordinates} onChange={updateField('coordinates')} placeholder="Ex.: X: 1204.5, Y: -320.2" />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="location_notes">Observações sobre o local</label>
              <textarea
                id="location_notes"
                value={form.location_notes}
                onChange={updateField('location_notes')}
                rows={3}
                placeholder="Detalhes do território, rotas de acesso, pontos de vigilância... Fotos são adicionadas na aba 'Localização e QG'."
              />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel__title">Liderança</div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="leader">Líder principal</label>
              <select id="leader" value={form.leader_member_id} onChange={updateField('leader_member_id')}>
                <option value="">— Não definido —</option>
                {eligibleMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname}{member.current_family_name ? ` (${member.current_family_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="vice">Vice-líder</label>
              <select id="vice" value={form.vice_leader_member_id} onChange={updateField('vice_leader_member_id')}>
                <option value="">— Não definido —</option>
                {eligibleMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname}{member.current_family_name ? ` (${member.current_family_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, gridColumn: '1 / -1' }}>
              O líder precisa ter vínculo ativo com esta família. Ao editar, selecione apenas membros já vinculados a ela.
            </p>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel__title">Observações investigativas</div>
          <div className="form-field form-field--full">
            <textarea
              value={form.observations}
              onChange={updateField('observations')}
              placeholder="Anotações livre sobre comportamento, modus operandi, alertas..."
              rows={5}
            />
          </div>
        </div>

        <div className="form-actions">
          <Link to={isEdit ? `/familias/${id}` : '/familias'} className="button">Cancelar</Link>
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar família'}
          </button>
        </div>
      </form>
    </>
  );
}
