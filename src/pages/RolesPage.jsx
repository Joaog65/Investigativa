import { useEffect, useState } from 'react';
import { fetchRoles, createRole, updateRole, reorderRoles, archiveRole, restoreRole } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

export default function RolesPage() {
  const { notifyError, notifySuccess } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [archiveTarget, setArchiveTarget] = useState(null);

  const load = () => {
    fetchRoles().then(setData).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!data) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const move = async (index, direction) => {
    const ids = data.active.map((role) => role.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorderRoles(ids);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!newRole.name.trim()) return;
    try {
      await createRole(newRole);
      setNewRole({ name: '', description: '' });
      notifySuccess('Cargo criado.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateRole(editTarget.id, editForm);
      notifySuccess('Cargo atualizado.');
      setEditTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveRole(archiveTarget.id);
      notifySuccess('Cargo arquivado.');
      setArchiveTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
      setArchiveTarget(null);
    }
  };

  const handleRestore = async (roleId) => {
    try {
      await restoreRole(roleId);
      notifySuccess('Cargo restaurado.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header__title">
          <h1>Hierarquia e Cargos</h1>
          <p>A ordem define a posição na hierarquia (topo → base)</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Cargos ativos ({data.active.length})</div>
            {data.active.map((role, index) => (
              <div className="relation-row" key={role.id}>
                <span className="mono" style={{ width: 28 }}>{role.level}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{role.name}</div>
                  {role.description && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{role.description}</div>}
                </div>
                <span className="mono">{role.active_usage} em uso</span>
                <button className="button button--ghost button--sm" onClick={() => move(index, -1)} disabled={index === 0}>▲</button>
                <button className="button button--ghost button--sm" onClick={() => move(index, 1)} disabled={index === data.active.length - 1}>▼</button>
                <button
                  className="button button--sm"
                  onClick={() => {
                    setEditTarget(role);
                    setEditForm({ name: role.name, description: role.description || '' });
                  }}
                >
                  Editar
                </button>
                <button className="button button--sm button--danger" onClick={() => setArchiveTarget(role)}>Arquivar</button>
              </div>
            ))}
          </div>

          {data.archived.length > 0 && (
            <div className="panel">
              <div className="panel__title">Cargos arquivados</div>
              {data.archived.map((role) => (
                <div className="relation-row" key={role.id}>
                  <div style={{ flex: 1 }}>{role.name}</div>
                  <button className="button button--sm" onClick={() => handleRestore(role.id)}>Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel__title">Novo cargo</div>
          <form onSubmit={handleCreate}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Nome</label>
              <input
                value={newRole.name}
                onChange={(event) => setNewRole({ ...newRole, name: event.target.value })}
                placeholder="Ex.: Conselheiro"
                required
              />
            </div>
            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Descrição (opcional)</label>
              <textarea
                value={newRole.description}
                onChange={(event) => setNewRole({ ...newRole, description: event.target.value })}
                rows={3}
              />
            </div>
            <button type="submit" className="button button--primary" style={{ width: '100%', justifyContent: 'center' }}>
              Adicionar ao fim da hierarquia
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(editTarget)}
        title={`Editar cargo: ${editTarget?.name || ''}`}
        message={
          <div className="form-field">
            <label>Nome</label>
            <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            <label style={{ marginTop: 8 }}>Descrição</label>
            <textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} rows={3} />
          </div>
        }
        confirmLabel="Salvar"
        confirmTone="primary"
        onConfirm={handleUpdate}
        onCancel={() => setEditTarget(null)}
      />

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="Arquivar cargo"
        message={
          <p>
            O cargo <strong>{archiveTarget?.name}</strong> sairá da lista de seleção nos vínculos.
            {archiveTarget?.active_usage > 0
              ? ` Atenção: ele está em uso por ${archiveTarget.active_usage} vínculo(s) ativo(s) e será bloqueado pelo servidor.`
              : ''}
          </p>
        }
        confirmLabel="Arquivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
