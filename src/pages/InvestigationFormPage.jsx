import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchInvestigation, createInvestigation, updateInvestigation, fetchFamilies } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function InvestigationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useToast();

  const [form, setForm] = useState({
    title: '',
    description: '',
    family_id: '',
    status: 'aberta',
    investigation_date: new Date().toISOString().slice(0, 10),
  });
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFamilies({ status: 'all' }).then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchInvestigation(id)
      .then((investigation) => {
        setForm({
          title: investigation.title || '',
          description: investigation.description || '',
          family_id: investigation.family_id || '',
          status: investigation.status,
          investigation_date: investigation.investigation_date || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('O título é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateInvestigation(id, { ...form, family_id: form.family_id || null });
        notifySuccess('Investigação atualizada.');
        navigate(`/investigacoes/${id}`);
      } else {
        const created = await createInvestigation({ ...form, family_id: form.family_id || null });
        notifySuccess('Investigação aberta.');
        navigate(`/investigacoes/${created.id}`);
      }
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
          <h1>{isEdit ? 'Editar investigação' : 'Nova investigação'}</h1>
          <p>{isEdit ? <>Caso <span className="mono">#{id}</span></> : 'Registro de um caso investigativo'}</p>
        </div>
        <Link to={isEdit ? `/investigacoes/${id}` : '/investigacoes'} className="button">Cancelar</Link>
      </div>

      {error && <div className="notification notification--error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel">
          <div className="panel__title">Caso</div>
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label htmlFor="title">Título *</label>
              <input
                id="title"
                value={form.title}
                onChange={updateField('title')}
                required
                placeholder="Ex.: Chacina na doca 7"
              />
            </div>

            <div className="form-field">
              <label htmlFor="family">Organização relacionada</label>
              <select id="family" value={form.family_id} onChange={updateField('family_id')}>
                <option value="">— Nenhuma —</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>{family.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="status">Status</label>
              <select id="status" value={form.status} onChange={updateField('status')}>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="investigation_date">Data do caso</label>
              <input id="investigation_date" type="date" value={form.investigation_date} onChange={updateField('investigation_date')} />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="description">Descrição</label>
              <textarea
                id="description"
                value={form.description}
                onChange={updateField('description')}
                rows={5}
                placeholder="Resumo do caso, o que aconteceu, quem participou, contexto..."
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Link to={isEdit ? `/investigacoes/${id}` : '/investigacoes'} className="button">Cancelar</Link>
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Abrir investigação'}
          </button>
        </div>
      </form>
    </>
  );
}
