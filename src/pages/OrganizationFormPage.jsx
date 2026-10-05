import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createOrganization, fetchCategories, fetchOrganization, updateOrganization } from '../services/api';

const defaultForm = {
  name: '',
  abbreviation: '',
  logo: '',
  categories: [],
  products: [{ name: '', category: '', description: '', observation: '' }],
  primaryColor: '#d92c2c',
  secondaryColor: '#f5f5f5',
  partnership: true,
  alliance: false,
  allianceNotes: '',
  allianceBenefits: [''],
  hierarchy: [
    { title: 'Líder / 01', personName: '', rank: 1 },
    { title: 'Gerente Geral', personName: '', rank: 2 },
  ],
  observations: '',
  trackTable: '',
  partnershipTable: '',
};

function OrganizationFormPage({ categories, onSaveComplete }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [formData, setFormData] = useState(defaultForm);
  const [loading, setLoading] = useState(Boolean(id));
  const [errorMessage, setErrorMessage] = useState('');
  const [availableCategories, setAvailableCategories] = useState(categories || []);

  useEffect(() => {
    setAvailableCategories(categories || []);
  }, [categories]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(defaultForm);
      return;
    }

    const loadOrganization = async () => {
      try {
        const organization = await fetchOrganization(id);
        setFormData({
          name: organization.name || '',
          abbreviation: organization.abbreviation || '',
          logo: organization.logo || '',
          categories: organization.categories?.map((category) => category.name) || [],
          products: organization.products?.length
            ? organization.products
            : [{ name: '', category: '', description: '', observation: '' }],
          primaryColor: organization.primary_color || '#d92c2c',
          secondaryColor: organization.secondary_color || '#f5f5f5',
          partnership: Boolean(organization.partnership),
          alliance: Boolean(organization.alliance),
          allianceNotes: organization.alliance_notes || '',
          allianceBenefits: organization.benefits?.length
            ? organization.benefits.map((benefit) => benefit.benefit)
            : [''],
          hierarchy: organization.hierarchy?.length
            ? organization.hierarchy.map((position) => ({
                title: position.title,
                personName: position.person_name || position.personName || '',
                rank: position.rank ?? 1,
              }))
            : [
                { title: 'Líder / 01', personName: '', rank: 1 },
                { title: 'Gerente Geral', personName: '', rank: 2 },
              ],
          observations: organization.observations || '',
          trackTable: organization.track_table || '',
          partnershipTable: organization.partnership_table || '',
        });
      } catch (error) {
        setErrorMessage(error.message || 'Não foi possível carregar a organização.');
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, [id, isEditing]);

  const mainCategories = useMemo(() => availableCategories, [availableCategories]);

  const updateField = (field, value) => {
    setFormData((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const toggleCategory = (categoryName) => {
    setFormData((currentForm) => {
      const categories = currentForm.categories.includes(categoryName)
        ? currentForm.categories.filter((name) => name !== categoryName)
        : [...currentForm.categories, categoryName];

      return { ...currentForm, categories };
    });
  };

  const updateProduct = (index, field, value) => {
    setFormData((currentForm) => {
      const nextProducts = [...currentForm.products];
      nextProducts[index] = { ...nextProducts[index], [field]: value };
      return { ...currentForm, products: nextProducts };
    });
  };

  const updateHierarchy = (index, field, value) => {
    setFormData((currentForm) => {
      const nextHierarchy = [...currentForm.hierarchy];
      nextHierarchy[index] = { ...nextHierarchy[index], [field]: value };
      return { ...currentForm, hierarchy: nextHierarchy };
    });
  };

  const addProduct = () => {
    setFormData((currentForm) => ({
      ...currentForm,
      products: [...currentForm.products, { name: '', category: '', description: '', observation: '' }],
    }));
  };

  const removeProduct = (index) => {
    setFormData((currentForm) => ({
      ...currentForm,
      products: currentForm.products.filter((_, productIndex) => productIndex !== index),
    }));
  };

  const addHierarchy = () => {
    setFormData((currentForm) => ({
      ...currentForm,
      hierarchy: [...currentForm.hierarchy, { title: 'Novo Cargo', personName: '', rank: currentForm.hierarchy.length + 1 }],
    }));
  };

  const addAllianceBenefit = () => {
    setFormData((currentForm) => ({
      ...currentForm,
      allianceBenefits: [...currentForm.allianceBenefits, ''],
    }));
  };

  const updateAllianceBenefit = (index, value) => {
    setFormData((currentForm) => {
      const nextBenefits = [...currentForm.allianceBenefits];
      nextBenefits[index] = value;
      return { ...currentForm, allianceBenefits: nextBenefits };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const payload = {
      ...formData,
      products: formData.products.filter((product) => product.name || product.description || product.observation),
      hierarchy: formData.hierarchy.filter((item) => item.title || item.personName),
      allianceBenefits: formData.allianceBenefits.filter(Boolean),
    };

    try {
      if (isEditing) {
        await updateOrganization(id, payload);
      } else {
        const createdOrganization = await createOrganization(payload);
        onSaveComplete?.(createdOrganization);
        navigate(`/organization/${createdOrganization.id}`);
        return;
      }

      navigate(`/organization/${id}`);
      onSaveComplete?.();
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível salvar esta organização.');
    }
  };

  if (loading) {
    return <div className="loading-state">Carregando formulário...</div>;
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <div className="section-head">
        <h2>{isEditing ? 'Editar organização' : 'Nova organização'}</h2>
      </div>

      {errorMessage && <div className="notification notification--error">{errorMessage}</div>}

      <div className="form-grid">
        <div className="field-group">
          <label htmlFor="name">Nome</label>
          <input id="name" value={formData.name} onChange={(event) => updateField('name', event.target.value)} required />
        </div>

        <div className="field-group">
          <label htmlFor="abbreviation">Abreviação</label>
          <input id="abbreviation" value={formData.abbreviation} onChange={(event) => updateField('abbreviation', event.target.value)} />
        </div>

        <div className="field-group field-group--wide">
          <label htmlFor="logo">URL da logo</label>
          <input id="logo" value={formData.logo} onChange={(event) => updateField('logo', event.target.value)} />
        </div>

        <div className="field-group field-group--wide">
          <label>Categoria(s)</label>
          <div className="checkbox-list">
            {mainCategories.map((category) => (
              <label key={category.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={formData.categories.includes(category.name)}
                  onChange={() => toggleCategory(category.name)}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="primaryColor">Cor principal</label>
          <input id="primaryColor" type="color" value={formData.primaryColor} onChange={(event) => updateField('primaryColor', event.target.value)} />
        </div>

        <div className="field-group">
          <label htmlFor="secondaryColor">Cor secundária</label>
          <input id="secondaryColor" type="color" value={formData.secondaryColor} onChange={(event) => updateField('secondaryColor', event.target.value)} />
        </div>

        <div className="field-group checkbox-inline">
          <label>
            <input type="checkbox" checked={formData.partnership} onChange={(event) => updateField('partnership', event.target.checked)} />
            Parceria ativa
          </label>
        </div>

        <div className="field-group checkbox-inline">
          <label>
            <input type="checkbox" checked={formData.alliance} onChange={(event) => updateField('alliance', event.target.checked)} />
            Aliança ativa
          </label>
        </div>

        <div className="field-group field-group--wide">
          <label htmlFor="observations">Observações gerais</label>
          <textarea id="observations" value={formData.observations} onChange={(event) => updateField('observations', event.target.value)} rows={4} />
        </div>
      </div>

      <section className="section-box">
        <h3>Produtos</h3>
        {formData.products.map((product, index) => (
          <div key={`product-${index}`} className="sub-form-card">
            <div className="field-grid">
              <div className="field-group">
                <label>Nome</label>
                <input value={product.name} onChange={(event) => updateProduct(index, 'name', event.target.value)} />
              </div>
              <div className="field-group">
                <label>Categoria</label>
                <input value={product.category} onChange={(event) => updateProduct(index, 'category', event.target.value)} />
              </div>
            </div>
            <div className="field-group">
              <label>Descrição</label>
              <textarea rows={3} value={product.description} onChange={(event) => updateProduct(index, 'description', event.target.value)} />
            </div>
            <div className="field-group">
              <label>Observação</label>
              <textarea rows={2} value={product.observation} onChange={(event) => updateProduct(index, 'observation', event.target.value)} />
            </div>
            <button type="button" className="text-button" onClick={() => removeProduct(index)}>Remover produto</button>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={addProduct}>Adicionar produto</button>
      </section>

      <section className="section-box">
        <h3>Aliança e benefícios</h3>
        <div className="field-group">
          <label>Observações da aliança</label>
          <textarea rows={3} value={formData.allianceNotes} onChange={(event) => updateField('allianceNotes', event.target.value)} />
        </div>
        {formData.allianceBenefits.map((benefit, index) => (
          <div key={`benefit-${index}`} className="inline-row">
            <input value={benefit} onChange={(event) => updateAllianceBenefit(index, event.target.value)} placeholder="Benefício da aliança" />
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={addAllianceBenefit}>Adicionar benefício</button>
      </section>

      <section className="section-box">
        <h3>Hierarquia</h3>
        {formData.hierarchy.map((position, index) => (
          <div key={`hierarchy-${index}`} className="field-grid">
            <div className="field-group">
              <label>Cargo</label>
              <input value={position.title} onChange={(event) => updateHierarchy(index, 'title', event.target.value)} />
            </div>
            <div className="field-group">
              <label>Responsável</label>
              <input value={position.personName} onChange={(event) => updateHierarchy(index, 'personName', event.target.value)} />
            </div>
            <div className="field-group small-field">
              <label>Posição</label>
              <input type="number" value={position.rank ?? index + 1} onChange={(event) => updateHierarchy(index, 'rank', Number(event.target.value))} />
            </div>
          </div>
        ))}
        <button type="button" className="secondary-button" onClick={addHierarchy}>Adicionar cargo</button>
      </section>

      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>Cancelar</button>
        <button type="submit" className="primary-button">Salvar organização</button>
      </div>
    </form>
  );
}

export default OrganizationFormPage;
