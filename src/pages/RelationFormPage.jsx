import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchRelation, fetchFamilies, createRelation, updateRelation } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function RelationFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { notifyError, notifySuccess } = useToast();

  const [form, setForm] = useState({
    family_a_id: '',
    family_b_id: '',
    type: 'alianca',
    started_on: new Date().toISOString().slice(0, 10),
    description: '',
    exceptions: '',
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
    fetchRelation(id)
      .then((relation) => {
        setForm({
          family_a_id: relation.family_a_id,
          family_b_id: relation.family_b_id,
          type: relation.type,
          started_on: relation.started_on || '',
          description: relation.description || '',
          exceptions: relation.exceptions || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.family_a_id || !form.family_b_id) {
      setError('Selecione as duas famílias.');
      return;
    }
    if (form.family_a_id === form.family_b_id) {
      setError('Uma família não pode ter relação com ela mesma.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRelation(id, form);
        notifySuccess('Relação atualizada.');
        navigate(`/relacoes/${id}`);
      } else {
        const created = await createRelation(form);
        notifySuccess('Relação registrada.');
        navigate(`/relacoes/${created.id}`);
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
          <h1>{isEdit ? 'Editar relação' : 'Nova relação'}</h1>
          <p>Aliança, rivalidade ou neutralidade entre duas famílias</p>
        </div>
        <Link to={isEdit ? `/relacoes/${id}` : '/relacoes'} className="button">Cancelar</Link>
      </div>

      {error && <div className="notification notification--error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel">
          <div className="panel__title">Relação</div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="family_a">Família A</label>
              <select id="family_a" value={form.family_a_id} onChange={updateField('family_a_id')} required>
                <option value="">— Selecione —</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>{family.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="family_b">Família B</label>
              <select id="family_b" value={form.family_b_id} onChange={updateField('family_b_id')} required>
                <option value="">— Selecione —</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>{family.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="type">Tipo de relação</label>
              <select id="type" value={form.type} onChange={updateField('type')}>
                <option value="alianca">Aliança</option>
                <option value="rivalidade">Rivalidade</option>
                <option value="neutralidade">Neutralidade</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="started_on">Data de início</label>
              <input id="started_on" type="date" value={form.started_on} onChange={updateField('started_on')} />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="description">Descrição</label>
              <textarea
                id="description"
                value={form.description}
                onChange={updateField('description')}
                rows={4}
                placeholder="Contexto da relação, como surgiu, evidências observadas..."
              />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="exceptions">Exceções unilaterais (opcional)</label>
              <textarea
                id="exceptions"
                value={form.exceptions}
                onChange={updateField('exceptions')}
                rows={3}
                placeholder="Ex.: publicamente aliadas, mas a Família A vê a Família B como rival em segredo."
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <Link to={isEdit ? `/relacoes/${id}` : '/relacoes'} className="button">Cancelar</Link>
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar relação'}
          </button>
        </div>
      </form>
    </>
  );
}
