import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMember, archiveMember, restoreMember, closeMembership, updateMembership, fetchRoles } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

const REASON_LABELS = { saiu: 'Saiu', expulso: 'Expulso', desapareceu: 'Desapareceu', outro: 'Outro' };

export default function MemberDetailPage() {
  const { id } = useParams();
  const { notifyError, notifySuccess } = useToast();

  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);

  // Modais
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeForm, setCloseForm] = useState({ left_on: new Date().toISOString().slice(0, 10), leave_reason: 'saiu' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ role_id: '', status: 'ativo' });

  const load = () => {
    fetchMember(id)
      .then(setMember)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    fetchRoles().then((data) => setRoles(data.active)).catch(() => {});
  }, []);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!member) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const isArchived = Boolean(member.archived_at);
  const activeMembership = member.memberships.find((m) => !m.left_on);

  const handleArchive = async () => {
    try {
      await archiveMember(id, archiveReason);
      notifySuccess('Membro arquivado.');
      setArchiveOpen(false);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMember(id);
      notifySuccess('Membro restaurado.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleCloseMembership = async () => {
    try {
      await closeMembership(closeTarget.id, closeForm);
      notifySuccess('Vínculo encerrado.');
      setCloseTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleEditMembership = async () => {
    try {
      await updateMembership(editTarget.id, { ...editForm, role_id: editForm.role_id || null });
      notifySuccess('Vínculo atualizado.');
      setEditTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <Link to="/membros" className="button button--ghost">← Voltar</Link>
        <div className="page-header__actions">
          {!isArchived && (
            <>
              <Link to={`/membros/${id}/editar`} className="button">Editar</Link>
              <button className="button button--danger" onClick={() => setArchiveOpen(true)}>Arquivar</button>
            </>
          )}
          {isArchived && <button className="button button--primary" onClick={handleRestore}>Restaurar</button>}
        </div>
      </div>

      {isArchived && (
        <div className="notification notification--warning">
          Este registro está <strong>arquivado</strong>. Restaure-o para editar.
        </div>
      )}

      <div className="detail-hero">
        {member.photo_path ? (
          <img src={member.photo_path} alt="" className="detail-hero__logo" />
        ) : (
          <div className="detail-hero__logo detail-hero__logo--empty">
            {member.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="detail-hero__title">
            {member.nickname}
            {isArchived && <span className="badge badge--encerrada">Arquivado</span>}
          </div>
          <div className="detail-hero__meta">
            {member.full_name && <span>✦ {member.full_name}</span>}
            {member.current_family_id ? (
              <span>
                ◈ <Link to={`/familias/${member.current_family_id}`}>{member.current_family_name}</Link>
                {member.current_role_name ? ` · ${member.current_role_name}` : ''}
              </span>
            ) : (
              <span>◈ sem família atual</span>
            )}
            {member.server_id_list?.length > 0 && <span className="mono">ID: {member.server_id_list.join(', ')}</span>}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Linha do tempo — vínculos com famílias</div>
            <div className="timeline">
              {member.memberships.map((membership) => (
                <div key={membership.id} className={`timeline-item${membership.left_on ? ' timeline-item--closed' : ''}`}>
                  <div className="timeline-item__title">
                    <Link to={`/familias/${membership.family_id}`}>{membership.family_name}</Link>
                    {' · '}{membership.role_name || 'sem cargo'}
                  </div>
                  <div className="timeline-item__meta">
                    Entrada {formatDate(membership.joined_on)}
                    {membership.left_on
                      ? ` · Saída ${formatDate(membership.left_on)}${membership.leave_reason ? ` (${REASON_LABELS[membership.leave_reason]})` : ''}`
                      : ' · vínculo ativo'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {!membership.left_on && !isArchived && (
                      <>
                        <button
                          className="button button--sm"
                          onClick={() => {
                            setEditTarget(membership);
                            setEditForm({ role_id: membership.role_id || '', status: membership.status });
                          }}
                        >
                          Editar cargo
                        </button>
                        <button
                          className="button button--sm button--danger"
                          onClick={() => {
                            setCloseTarget(membership);
                            setCloseForm({ left_on: new Date().toISOString().slice(0, 10), leave_reason: 'saiu' });
                          }}
                        >
                          Encerrar vínculo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {member.memberships.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>Nenhum vínculo registrado.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Relações da família atual</div>
            {member.relations.length && activeMembership ? (
              member.relations.map((relation) => {
                const other = relation.family_a_id === activeMembership.family_id ? relation.family_b_name : relation.family_a_name;
                return (
                  <Link key={relation.id} to={`/relacoes/${relation.id}`} className="relation-row">
                    <StatusBadge value={relation.type} />
                    <span className="relation-row__families">{other}</span>
                  </Link>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma relação vigente da família atual.</p>
            )}
          </div>
        </div>

        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Identificação</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Vulgo:</span> <strong>{member.nickname}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Nome:</span> {member.full_name || '—'}</div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>IDs do servidor:</span>{' '}
                {member.server_id_list?.length ? <span className="mono">{member.server_id_list.join(', ')}</span> : '—'}
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>Cadastro:</span> <span className="mono">{formatDate(member.created_at)}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Atualização:</span> <span className="mono">{formatDate(member.updated_at)}</span></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Observações</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>
              {member.observations || 'Nenhuma observação registrada.'}
            </p>
          </div>

          <div className="panel">
            <div className="panel__title">Histórico de alterações</div>
            {member.audit.length ? (
              member.audit.slice(0, 10).map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <div>
                    <strong>{entry.action}</strong> {entry.detail && <span style={{ color: 'var(--text-muted)' }}>— {entry.detail}</span>}
                  </div>
                  <span className="activity-item__time" style={{ marginLeft: 'auto' }}>{formatDate(entry.created_at)}</span>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Sem eventos registrados.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={archiveOpen}
        title="Arquivar membro"
        message={
          <>
            <p>
              O membro <strong>{member.nickname}</strong> será arquivado e seu vínculo ativo encerrado automaticamente.
              Nada é apagado — pode ser restaurado no Arquivo.
            </p>
            <div className="form-field">
              <label>Motivo (opcional)</label>
              <input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} />
            </div>
          </>
        }
        confirmLabel="Arquivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmModal
        open={Boolean(closeTarget)}
        title="Encerrar vínculo"
        message={
          <>
            <p>
              Encerrar o vínculo de <strong>{member.nickname}</strong> com{' '}
              <strong>{closeTarget?.family_name}</strong>.
            </p>
            <div className="form-grid">
              <div className="form-field">
                <label>Data de saída</label>
                <input
                  type="date"
                  value={closeForm.left_on}
                  onChange={(event) => setCloseForm({ ...closeForm, left_on: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Motivo</label>
                <select
                  value={closeForm.leave_reason}
                  onChange={(event) => setCloseForm({ ...closeForm, leave_reason: event.target.value })}
                >
                  <option value="saiu">Saiu</option>
                  <option value="expulso">Expulso</option>
                  <option value="desapareceu">Desapareceu</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
          </>
        }
        confirmLabel="Encerrar vínculo"
        onConfirm={handleCloseMembership}
        onCancel={() => setCloseTarget(null)}
      />

      <ConfirmModal
        open={Boolean(editTarget)}
        title="Editar vínculo"
        message={
          <>
            <p>
              Vínculo de <strong>{member.nickname}</strong> com <strong>{editTarget?.family_name}</strong>.
            </p>
            <div className="form-grid">
              <div className="form-field">
                <label>Cargo</label>
                <select
                  value={editForm.role_id}
                  onChange={(event) => setEditForm({ ...editForm, role_id: event.target.value })}
                >
                  <option value="">— Sem cargo —</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Status do vínculo</label>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                >
                  <option value="ativo">Ativo</option>
                  <option value="afastado">Afastado</option>
                  <option value="desaparecido">Desaparecido</option>
                </select>
              </div>
            </div>
          </>
        }
        confirmLabel="Salvar"
        confirmTone="primary"
        onConfirm={handleEditMembership}
        onCancel={() => setEditTarget(null)}
      />
    </>
  );
}
