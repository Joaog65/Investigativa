import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchRelation, endRelation, archiveRelation, restoreRelation,
  uploadRelationEvidence, deleteRelationEvidence,
} from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';

function formatDate(value) {
  if (!value) return '—';
  return value.split(' ')[0].split('-').reverse().join('/');
}

export default function RelationDetailPage() {
  const { id } = useParams();
  const { notifyError, notifySuccess } = useToast();

  const [relation, setRelation] = useState(null);
  const [error, setError] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const [endNotes, setEndNotes] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    fetchRelation(id).then(setRelation).catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) return <div className="notification notification--error">{error}</div>;
  if (!relation) return <div className="loading"><div className="spinner" />Carregando...</div>;

  const isActive = relation.is_active && !relation.archived_at;

  const handleEnd = async () => {
    try {
      await endRelation(id, endNotes);
      notifySuccess('Relação encerrada.');
      setEndOpen(false);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveRelation(id);
      notifySuccess('Relação arquivada.');
      setArchiveOpen(false);
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleRestore = async () => {
    try {
      await restoreRelation(id);
      notifySuccess('Relação restaurada.');
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
      await uploadRelationEvidence(id, files);
      notifySuccess('Evidências adicionadas.');
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
      await deleteRelationEvidence(attachmentId);
      notifySuccess('Evidência removida.');
      load();
    } catch (err) {
      notifyError(err.message);
    }
  };

  return (
    <>
      <div className="page-header">
        <Link to="/relacoes" className="button button--ghost">← Voltar</Link>
        <div className="page-header__actions">
          {isActive && (
            <>
              <Link to={`/relacoes/${id}/editar`} className="button">Editar</Link>
              <button className="button button--danger" onClick={() => setEndOpen(true)}>Encerrar relação</button>
            </>
          )}
          {!relation.archived_at && <button className="button" onClick={() => setArchiveOpen(true)}>Arquivar</button>}
          {relation.archived_at && <button className="button button--primary" onClick={handleRestore}>Restaurar</button>}
        </div>
      </div>

      {relation.archived_at && (
        <div className="notification notification--warning">Este registro está <strong>arquivado</strong>.</div>
      )}

      <div className="detail-hero">
        <div style={{ minWidth: 0, width: '100%' }}>
          <div className="detail-hero__title">
            <StatusBadge value={relation.type} />
            <StatusBadge value={isActive ? 'vigente' : 'encerrada'} />
          </div>
          <div className="detail-hero__meta" style={{ marginTop: 10 }}>
            <Link to={`/familias/${relation.family_a_id}`}>
              <strong>{relation.family_a_name}</strong>
            </Link>
            <span style={{ fontSize: 18 }}>⇄</span>
            <Link to={`/familias/${relation.family_b_id}`}>
              <strong>{relation.family_b_name}</strong>
            </Link>
            {relation.started_on && <span>desde {formatDate(relation.started_on)}</span>}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Descrição</div>
            <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {relation.description || 'Nenhuma descrição registrada.'}
            </p>
          </div>

          {relation.exceptions && (
            <div className="panel" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
              <div className="panel__title" style={{ color: 'var(--warning)' }}>⚠ Exceções unilaterais</div>
              <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>{relation.exceptions}</p>
            </div>
          )}

          <div className="panel">
            <div className="panel__title">
              <span>Evidências ({relation.attachments.length})</span>
              {isActive && (
                <label className="button button--sm" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? 'Enviando...' : '+ Adicionar'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
              )}
            </div>
            {relation.attachments.length ? (
              <div className="attachment-grid">
                {relation.attachments.map((attachment) => (
                  <div className="attachment-thumb" key={attachment.id}>
                    <a href={attachment.file_path} target="_blank" rel="noreferrer">
                      <img src={attachment.file_path} alt={attachment.caption || ''} />
                    </a>
                    <button onClick={() => handleDeleteEvidence(attachment.id)} title="Remover">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma evidência anexada.</p>
            )}
          </div>
        </div>

        <div className="detail-stack">
          <div className="panel">
            <div className="panel__title">Registro</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Início:</span> <span className="mono">{formatDate(relation.started_on)}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Criada em:</span> <span className="mono">{formatDate(relation.created_at)}</span></div>
              {relation.archived_at && (
                <div><span style={{ color: 'var(--text-muted)' }}>Arquivada em:</span> <span className="mono">{formatDate(relation.archived_at)}</span></div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Histórico de alterações</div>
            {relation.audit.length ? (
              relation.audit.slice(0, 10).map((entry) => (
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
        open={endOpen}
        title="Encerrar relação"
        message={
          <>
            <p>
              A relação entre <strong>{relation.family_a_name}</strong> e <strong>{relation.family_b_name}</strong>{' '}
              será marcada como <strong>encerrada</strong> (estado atual). O registro permanece consultável e novas
              relações entre o par serão permitidas.
            </p>
            <div className="form-field">
              <label>Observação (opcional)</label>
              <input value={endNotes} onChange={(event) => setEndNotes(event.target.value)} placeholder="Ex.: aliança rompida após ataque" />
            </div>
          </>
        }
        confirmLabel="Encerrar"
        onConfirm={handleEnd}
        onCancel={() => setEndOpen(false)}
      />

      <ConfirmModal
        open={archiveOpen}
        title="Arquivar relação"
        message={
          <p>
            O registro sairá das listagens e poderá ser restaurado no Arquivo. Se estiver vigente, será encerrada.
          </p>
        }
        confirmLabel="Arquivar"
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />
    </>
  );
}
