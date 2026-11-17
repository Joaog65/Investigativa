import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchInvestigation, fetchMembers, addInvolvedMember, removeInvolvedMember,
  addInvestigationNote, deleteInvestigationNote,
  uploadInvestigationEvidence, deleteInvestigationEvidence,
  archiveInvestigation, restoreInvestigation,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import Lightbox from '../components/Lightbox';
import { useToast } from '../context/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  const [datePart] = value.split(' ');
  return datePart.split('-').reverse().join('/');
}

export default function InvestigationDetailPage() {
  const { id } = useParams();
  const { notifyError, notifySuccess } = useToast();

  const [investigation, setInvestigation] = useState(null);
  const [error, setError] = useState('');
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [involvement, setInvolvement] = useState('');
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [noteDeleteTarget, setNoteDeleteTarget] = useState(null);

  const load = () => {
    fetchInvestigation(id).then(setInvestigation).catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
    fetchMembers({}).then(setMembers).catch(() => {});
  }, [id]);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!investigation) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const isArchived = Boolean(investigation.archived_at);
  const involvedIds = new Set(investigation.involved.map((link) => link.member_id));
  const memberOptions = members
    .filter((member) => !involvedIds.has(member.id))
    .filter((member) =>
      !memberSearch ||
      member.nickname.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (member.full_name || '').toLowerCase().includes(memberSearch.toLowerCase()));

  const handleAddMember = async () => {
    const select = document.getElementById('involved-select');
    const memberId = Number(select?.value);
    if (!memberId) return;
    try {
      await addInvolvedMember(id, { member_id: memberId, involvement: involvement || null });
      notifySuccess('Pessoa envolvida registrada.');
      setInvolvement('');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleRemoveMember = async (linkId) => {
    try {
      await removeInvolvedMember(id, linkId);
      notifySuccess('Pessoa removida do caso.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await addInvestigationNote(id, noteText.trim());
      notifySuccess('Anotação registrada.');
      setNoteText('');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteNote = async () => {
    try {
      await deleteInvestigationNote(id, noteDeleteTarget.id);
      notifySuccess('Anotação excluída.');
      setNoteDeleteTarget(null);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      await uploadInvestigationEvidence(id, files);
      notifySuccess('Evidências anexadas.');
      load();
    } catch (err) {
      notifyError(err.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteEvidence = async (attachmentId) => {
    try {
      await deleteInvestigationEvidence(attachmentId);
      notifySuccess('Evidência removida.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveInvestigation(id);
      notifySuccess('Investigação arquivada.');
      setArchiveOpen(false);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreInvestigation(id);
      notifySuccess('Investigação restaurada.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <Link to="/investigacoes" className="button button--ghost">← Voltar</Link>
        <div className="page-header__actions">
          {!isArchived && (
            <>
              <Link to={`/investigacoes/${id}/editar`} className="button">Editar</Link>
              <button className="button button--danger" onClick={() => setArchiveOpen(true)}>Arquivar</button>
            </>
          )}
          {isArchived && <button className="button button--primary" onClick={handleRestore}>Restaurar</button>}
        </div>
      </div>

      {isArchived && (
        <div className="notification notification--warning">Este caso está <strong>arquivado</strong>.</div>
      )}

      <div className="detail-hero">
        <div style={{ minWidth: 0 }}>
          <div className="detail-hero__title">
            ✦ {investigation.title} <StatusBadge value={investigation.status} />
          </div>
          <div className="detail-hero__meta">
            {investigation.family_id && (
              <span>◈ <Link to={`/familias/${investigation.family_id}`}>{investigation.family_name}</Link></span>
            )}
            {investigation.investigation_date && <span>data do caso: {formatDate(investigation.investigation_date)}</span>}
            <span>aberta por {investigation.created_by_name || '—'}</span>
            <span className="mono">{formatDate(investigation.created_at)}</span>
          </div>
          {investigation.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 10, whiteSpace: 'pre-wrap' }}>
              {investigation.description}
            </p>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Pessoas envolvidas ({investigation.involved.length})</div>
            {investigation.involved.map((link) => (
              <div className="relation-row" key={link.link_id}>
                {link.photo_path ? (
                  <img src={link.photo_path} alt="" className="table-avatar" />
                ) : (
                  <div className="table-avatar avatar--empty">{link.nickname.charAt(0).toUpperCase()}</div>
                )}
                <div style={{ flex: 1 }}>
                  <Link to={`/membros/${link.member_id}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {link.nickname}
                  </Link>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {link.current_family_name || 'sem vínculo'}{link.involvement ? ` · ${link.involvement}` : ''}
                  </div>
                </div>
                {!isArchived && (
                  <button className="button button--sm button--danger" onClick={() => handleRemoveMember(link.link_id)}>
                    Remover
                  </button>
                )}
              </div>
            ))}
            {investigation.involved.length === 0 && <EmptyHint>Nenhuma pessoa registrada no caso.</EmptyHint>}

            {!isArchived && (
              <div className="filter-bar" style={{ marginTop: 12 }}>
                <input
                  placeholder="Buscar membro..."
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <select id="involved-select" style={{ maxWidth: 220 }}>
                  <option value="">— Selecione —</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nickname}{member.current_family_name ? ` (${member.current_family_name})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Envolvimento (ex.: atirador)"
                  value={involvement}
                  onChange={(event) => setInvolvement(event.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <button className="button button--sm button--primary" onClick={handleAddMember}>+ Registrar</button>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel__title">Anotações cronológicas ({investigation.notes.length})</div>
            {investigation.notes.map((note) => (
              <div className="activity-item" key={note.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{note.note}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                    {note.user_name || '—'} · {formatDate(note.created_at)}
                  </div>
                </div>
                {!isArchived && (
                  <button className="button button--ghost button--sm" onClick={() => setNoteDeleteTarget(note)}>✕</button>
                )}
              </div>
            ))}
            {investigation.notes.length === 0 && <EmptyHint>Nenhuma anotação ainda.</EmptyHint>}

            {!isArchived && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={3}
                  placeholder="Nova anotação do caso..."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="button button--sm button--primary" onClick={handleAddNote} disabled={!noteText.trim()}>
                    + Adicionar anotação
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">
              <span>Evidências ({investigation.attachments.length})</span>
              {!isArchived && (
                <label className="button button--sm" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'Enviando...' : '+ Anexar'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
              )}
            </div>
            {investigation.attachments.length ? (
              <div className="attachment-grid">
                {investigation.attachments.map((attachment, index) => (
                  <div className="attachment-thumb" key={attachment.id}>
                    <img src={attachment.file_path} alt="" onClick={() => setLightboxIndex(index)} style={{ cursor: 'zoom-in' }} />
                    {!isArchived && (
                      <button onClick={() => handleDeleteEvidence(attachment.id)} title="Remover">✕</button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint>Nenhuma evidência anexada.</EmptyHint>
            )}
          </div>

          <div className="panel">
            <div className="panel__title">Histórico do caso</div>
            {investigation.audit.length ? (
              investigation.audit.slice(0, 12).map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <div>
                    <strong>{entry.action}</strong> {entry.detail && <span style={{ color: 'var(--text-muted)' }}>— {entry.detail}</span>}
                  </div>
                  <span className="activity-item__time" style={{ marginLeft: 'auto' }}>{formatDate(entry.created_at)}</span>
                </div>
              ))
            ) : (
              <EmptyHint>Sem eventos registrados.</EmptyHint>
            )}
          </div>
        </div>
      </div>

      <Lightbox
        photos={investigation.attachments}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      <ConfirmModal
        open={archiveOpen}
        title="Arquivar investigação"
        message={<p>O caso <strong>{investigation.title}</strong> sairá das listagens e poderá ser restaurado no Arquivo.</p>}
        confirmLabel="Arquivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmModal
        open={Boolean(noteDeleteTarget)}
        title="Excluir anotação"
        message={<p>Excluir esta anotação do caso? A ação remove o texto permanentemente.</p>}
        confirmLabel="Excluir"
        onConfirm={handleDeleteNote}
        onCancel={() => setNoteDeleteTarget(null)}
      />
    </>
  );
}

function EmptyHint({ children }) {
  return <p style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}
